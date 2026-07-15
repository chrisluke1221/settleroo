-- P1-4: tenant bill tokens never expired and couldn't be revoked. Give
-- every split an expiry, refreshed whenever the bill email is (re)sent,
-- and have the token lookup honor it.
alter table public.bill_splits add column if not exists expires_at timestamptz not null default (now() + interval '90 days');

drop function if exists public.get_bill_split_by_token(uuid);

create function public.get_bill_split_by_token(p_token uuid)
returns table (
  id uuid,
  bill_id uuid,
  tenant_name text,
  room text,
  number_of_occupants int,
  occupancy_days int,
  person_days int,
  percentage numeric,
  owed_amount numeric,
  occupancy_start date,
  occupancy_end date,
  status text,
  viewed_at timestamptz,
  paid_at timestamptz,
  bill_type text,
  total_amount numeric,
  billing_period_start date,
  billing_period_end date,
  due_date date,
  bill_total_person_days bigint,
  bill_tenant_count bigint,
  attachment_path text,
  attachment_name text,
  attachment_type text
)
language sql security definer set search_path = '' as $$
  select bs.id, bs.bill_id, bs.tenant_name, bs.room, bs.number_of_occupants,
    bs.occupancy_days, bs.person_days, bs.percentage, bs.owed_amount,
    bs.occupancy_start, bs.occupancy_end, bs.status, bs.viewed_at, bs.paid_at,
    b.bill_type, b.total_amount, b.billing_period_start, b.billing_period_end, b.due_date,
    totals.total_person_days, totals.tenant_count,
    b.attachment_path, b.attachment_name, b.attachment_type
  from public.bill_splits bs
  join public.bills b on b.id = bs.bill_id
  join (
    select bill_id, sum(person_days) as total_person_days, count(*) as tenant_count
    from public.bill_splits
    group by bill_id
  ) totals on totals.bill_id = bs.bill_id
  where bs.access_token = p_token
    and bs.expires_at > now();
$$;
grant execute on function public.get_bill_split_by_token(uuid) to anon, authenticated;

-- Same expiry guard on the viewed/paid mutations and the attachment
-- lookup, so an expired link can't be used to change state either.
create or replace function public.mark_bill_split_viewed(p_token uuid)
returns void language sql security definer set search_path = '' as $$
  update public.bill_splits
  set status = case when status = 'pending' then 'viewed' else status end,
      viewed_at = coalesce(viewed_at, now())
  where access_token = p_token and expires_at > now();
$$;

create or replace function public.mark_bill_split_paid(p_token uuid)
returns void language sql security definer set search_path = '' as $$
  update public.bill_splits
  set status = 'paid', paid_at = now()
  where access_token = p_token and expires_at > now();
$$;

-- Landlord-triggered revoke: rotates the token so the old link stops
-- working immediately.
create or replace function public.revoke_bill_split_token(p_split_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_new_token uuid := gen_random_uuid();
  v_landlord_id uuid;
begin
  select landlord_id into v_landlord_id from public.bill_splits where id = p_split_id;
  if v_landlord_id is null or v_landlord_id != auth.uid() then
    raise exception 'not authorized';
  end if;

  update public.bill_splits set access_token = v_new_token where id = p_split_id;
  return v_new_token;
end;
$$;
grant execute on function public.revoke_bill_split_token(uuid) to authenticated;
