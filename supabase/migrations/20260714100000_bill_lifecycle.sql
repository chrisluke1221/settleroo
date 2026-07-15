-- Phase 1+2: bill lifecycle (due dates, status) + public tenant bill view.
-- Run this in the SQL Editor for trfaqjkkozusxdvqnkgo after the earlier migrations.

alter table public.bills add column if not exists due_date date;

alter table public.bill_splits add column if not exists status text not null default 'pending'
  check (status in ('pending','viewed','paid'));
alter table public.bill_splits add column if not exists viewed_at timestamptz;
alter table public.bill_splits add column if not exists paid_at timestamptz;
alter table public.bill_splits add column if not exists access_token uuid not null default gen_random_uuid();

create unique index if not exists bill_splits_access_token_key on public.bill_splits(access_token);

-- Public (no-login) lookup by the unguessable token in the tenant's link.
-- security definer + explicit column list keeps this from becoming an
-- open door into the rest of the table.
create or replace function public.get_bill_split_by_token(p_token uuid)
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
  due_date date
)
language sql security definer set search_path = '' as $$
  select bs.id, bs.bill_id, bs.tenant_name, bs.room, bs.number_of_occupants,
    bs.occupancy_days, bs.person_days, bs.percentage, bs.owed_amount,
    bs.occupancy_start, bs.occupancy_end, bs.status, bs.viewed_at, bs.paid_at,
    b.bill_type, b.total_amount, b.billing_period_start, b.billing_period_end, b.due_date
  from public.bill_splits bs
  join public.bills b on b.id = bs.bill_id
  where bs.access_token = p_token;
$$;
grant execute on function public.get_bill_split_by_token(uuid) to anon, authenticated;

create or replace function public.mark_bill_split_viewed(p_token uuid)
returns void language sql security definer set search_path = '' as $$
  update public.bill_splits
  set status = case when status = 'pending' then 'viewed' else status end,
      viewed_at = coalesce(viewed_at, now())
  where access_token = p_token;
$$;
grant execute on function public.mark_bill_split_viewed(uuid) to anon, authenticated;

create or replace function public.mark_bill_split_paid(p_token uuid)
returns void language sql security definer set search_path = '' as $$
  update public.bill_splits
  set status = 'paid', paid_at = now()
  where access_token = p_token;
$$;
grant execute on function public.mark_bill_split_paid(uuid) to anon, authenticated;
