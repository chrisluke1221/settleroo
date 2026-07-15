-- R4: effective-dated rent rates. One tenant can have multiple rates over
-- time; a DB-level exclusion constraint (not just app validation) makes
-- overlapping rates for the same tenant physically impossible, matching
-- the audit's "the calculation module should be the most-tested,
-- most-protected code in the repo" principle.

create extension if not exists btree_gist;

create table public.rent_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  frequency text not null check (frequency in ('weekly', 'fortnightly', 'monthly')),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

alter table public.rent_rates
  add column effective_range daterange
  generated always as (daterange(effective_from, effective_to, '[]')) stored;

alter table public.rent_rates
  add constraint no_overlapping_rent_rates
  exclude using gist (tenant_id with =, effective_range with &&);

alter table public.tenants add column if not exists fixed_term_end date;

alter table public.rent_rates enable row level security;

create policy "Landlords can view their rent rates" on public.rent_rates for select using (auth.uid() = landlord_id);
create policy "Landlords can create rent rates" on public.rent_rates for insert with check (auth.uid() = landlord_id);
create policy "Landlords can update their rent rates" on public.rent_rates for update using (auth.uid() = landlord_id);
create policy "Landlords can delete their rent rates" on public.rent_rates for delete using (auth.uid() = landlord_id);

-- Rent bills need to show the rate breakdown (which segments/rates made
-- up the charge), for the same calculation-transparency the utility
-- bills already have.
alter table public.bill_splits add column if not exists rate_breakdown jsonb;
