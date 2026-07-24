-- CHR-23: Support multi-select utility bill types (e.g. electricity + gas on one bill).
--
-- Strategy: add a new bill_types text[] column alongside the existing bill_type text column.
-- bill_type is preserved for backward compat (set to the first element of bill_types).
-- bill_types is the source of truth for new bills created after this migration.
--
-- PROPOSED — do not apply without Chris review.

-- 1. Add the new array column, defaulting to empty array.
alter table public.bills
  add column if not exists bill_types text[] not null default '{}'::text[];

-- 2. Backfill bill_types from the existing bill_type for all existing rows.
update public.bills
  set bill_types = array[bill_type]
  where bill_types = '{}'::text[];

-- 3. Add a check constraint: bill_types must have at least one element for non-rent bills.
--    Rent bills are auto-generated and always have bill_type = 'rent'.
alter table public.bills
  add constraint bills_bill_types_nonempty
  check (
    bill_type = 'rent'
    or (bill_types is not null and array_length(bill_types, 1) >= 1)
  );

-- 4. Update get_bill_split_by_token to also return bill_types so the tenant view
--    can show "Electricity + Gas Bill" instead of just "electricity Bill".
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
  bill_types text[],
  total_amount numeric,
  billing_period_start date,
  billing_period_end date,
  due_date date,
  bill_total_person_days bigint,
  bill_tenant_count bigint,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  rate_breakdown jsonb,
  property_name text,
  landlord_name text,
  landlord_email text,
  peer_splits jsonb
)
language sql security definer set search_path = '' as $$
  select bs.id, bs.bill_id, bs.tenant_name, bs.room, bs.number_of_occupants,
    bs.occupancy_days, bs.person_days, bs.percentage, bs.owed_amount,
    bs.occupancy_start, bs.occupancy_end, bs.status, bs.viewed_at, bs.paid_at,
    b.bill_type, b.bill_types, b.total_amount, b.billing_period_start, b.billing_period_end, b.due_date,
    totals.total_person_days, totals.tenant_count,
    b.attachment_path, b.attachment_name, b.attachment_type,
    bs.rate_breakdown,
    p.name as property_name,
    coalesce(au.raw_user_meta_data->>'full_name', au.email) as landlord_name,
    au.email as landlord_email,
    peers.peer_splits
  from public.bill_splits bs
  join public.bills b on b.id = bs.bill_id
  join public.properties p on p.id = b.property_id
  join auth.users au on au.id = p.landlord_id
  join (
    select bill_id, sum(person_days) as total_person_days, count(*) as tenant_count
    from public.bill_splits
    group by bill_id
  ) totals on totals.bill_id = bs.bill_id
  join (
    select bill_id,
      jsonb_agg(
        jsonb_build_object(
          'id', s2.id,
          'tenant_name', s2.tenant_name,
          'occupancy_days', s2.occupancy_days,
          'person_days', s2.person_days,
          'percentage', s2.percentage
        )
        order by s2.tenant_name
      ) as peer_splits
    from public.bill_splits s2
    group by bill_id
  ) peers on peers.bill_id = bs.bill_id
  where bs.access_token = p_token
    and bs.expires_at > now();
$$;
grant execute on function public.get_bill_split_by_token(uuid) to anon, authenticated;
