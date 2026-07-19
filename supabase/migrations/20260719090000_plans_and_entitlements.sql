-- §7 Entitlements & Pricing, P0 scope: plans / subscriptions /
-- entitlement_overrides + a single server-side check_entitlement RPC.
-- Enforcement is never client-side only — the client calls the RPC at the
-- moment of the action (property create, tenant create, bill create) and
-- shows the upgrade modal when blocked.
--
-- An account with no subscriptions row is on the free plan. Plans are data,
-- not code: the pricing page renders from this table, and the operator (or
-- later, Stripe webhooks) changes an account's plan by writing a
-- subscriptions row — no deploy needed to reprice.

create table public.plans (
  id text primary key,
  name text not null,
  price_cents_monthly integer not null default 0,
  price_cents_yearly integer not null default 0,
  limits jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  account_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled')),
  period text not null default 'monthly'
    check (period in ('monthly', 'yearly')),
  current_period_end timestamptz,
  source text not null default 'manual'
    check (source in ('manual', 'stripe')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

create table public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  granted_by uuid references auth.users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, key)
);

-- RLS: plans are public (the /pricing page renders logged-out); an account
-- can read its own subscription and overrides. All writes go through the
-- service role or (later) operator RPCs — no client write policies at all.
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlement_overrides enable row level security;

create policy "Plans are publicly readable" on public.plans
  for select using (is_public = true);
create policy "Accounts can view their own subscription" on public.subscriptions
  for select using (auth.uid() = account_id);
create policy "Accounts can view their own overrides" on public.entitlement_overrides
  for select using (auth.uid() = account_id);

-- Launch plans (operator-adjustable data, not hardcoded UI).
insert into public.plans (id, name, price_cents_monthly, price_cents_yearly, limits, sort_order, is_public) values
  ('free', 'Starter', 0, 0,
   '{"max_properties": 1, "max_active_tenants": 4, "max_bills_per_month": 5, "branding_removable": false, "email_ingestion": false, "eofy_export": false, "mcp_access": false}',
   1, true),
  ('pro', 'Pro', 1900, 19000,
   '{"max_properties": null, "max_active_tenants": null, "max_bills_per_month": null, "branding_removable": true, "email_ingestion": true, "eofy_export": true, "mcp_access": true}',
   2, true),
  ('beta', 'Beta', 0, 0,
   '{"max_properties": null, "max_active_tenants": null, "max_bills_per_month": null, "branding_removable": true, "email_ingestion": true, "eofy_export": true, "mcp_access": true}',
   3, false);

-- The single enforcement point. Resolves, in priority order:
--   1. an unexpired entitlement_overrides row for this account+key
--   2. the account's active/trialing subscription's plan limits
--   3. the free plan's limits
-- A null limit means unlimited. Numeric keys compare against live usage
-- counts; boolean keys pass through. Returns everything the upgrade modal
-- needs in one round trip.
create or replace function public.check_entitlement(p_key text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_account uuid := auth.uid();
  v_limit jsonb;
  v_override jsonb;
  v_plan_id text;
  v_plan_name text;
  v_current bigint := 0;
  v_allowed boolean;
begin
  if v_account is null then
    raise exception 'not authorized';
  end if;

  select s.plan_id, p.name, p.limits -> p_key
    into v_plan_id, v_plan_name, v_limit
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.account_id = v_account and s.status in ('active', 'trialing');

  if v_plan_id is null then
    select p.id, p.name, p.limits -> p_key into v_plan_id, v_plan_name, v_limit
    from public.plans p where p.id = 'free';
  end if;

  select o.value into v_override
  from public.entitlement_overrides o
  where o.account_id = v_account and o.key = p_key
    and (o.expires_at is null or o.expires_at > now())
  order by o.created_at desc limit 1;

  if v_override is not null then
    v_limit := v_override;
  end if;

  if p_key = 'max_properties' then
    select count(*) into v_current from public.properties where landlord_id = v_account;
  elsif p_key = 'max_active_tenants' then
    select count(*) into v_current from public.tenants
      where landlord_id = v_account and status = 'active';
  elsif p_key = 'max_bills_per_month' then
    select count(*) into v_current from public.bills
      where landlord_id = v_account and created_at >= date_trunc('month', now());
  end if;

  if v_limit is null or v_limit = 'null'::jsonb then
    v_allowed := true;
  elsif jsonb_typeof(v_limit) = 'boolean' then
    v_allowed := (v_limit)::boolean;
  else
    v_allowed := v_current < (v_limit)::bigint;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'key', p_key,
    'limit', v_limit,
    'current', v_current,
    'plan_id', v_plan_id,
    'plan_name', v_plan_name
  );
end;
$$;
grant execute on function public.check_entitlement(text) to authenticated;
