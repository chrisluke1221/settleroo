-- Chris's UAT feedback (2026-07-22): tenants want to see a named, per-tenant
-- breakdown (not just an aggregate "total tenant-days" number) to trust a
-- mixed-occupancy split, and a way to email the landlord directly if a bill
-- still doesn't make sense. Both need data this RPC didn't return before:
-- the landlord's real email (today's landlord_name falls back to email only
-- when no full_name is set, so it can't be relied on as a mailto target),
-- and every sibling bill_splits row for the same bill (previously only
-- aggregated via sum()/count(), individual rows never left the database).
-- Deliberate privacy-policy change, confirmed by Chris: a valid tenant
-- token now also exposes peer tenants' occupancy days/% for the SAME bill
-- (not their contact info, other bills, or balances) — the property isn't
-- individually metered, so this is already shared context between
-- tenants. Pricing.js/Privacy.js/Home.js copy updated in the same PR to
-- match this.

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
    b.bill_type, b.total_amount, b.billing_period_start, b.billing_period_end, b.due_date,
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
