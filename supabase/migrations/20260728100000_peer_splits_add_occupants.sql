-- Round C fix: add number_of_occupants to the peer_splits JSON in
-- get_bill_split_by_token so TenantBillView can render the correct
-- flat-per-person explanation for internet bills.
--
-- The function signature is unchanged; only the peer_splits JSONB payload
-- gains the extra field. All existing callers are unaffected because they
-- only read the fields they need from the JSONB object.

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
  amount_paid numeric,
  carried_over_amount numeric,
  carry_forward_sources jsonb,
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
    bs.amount_paid, bs.carried_over_amount,
    coalesce(sources.carry_forward_sources, '[]'::jsonb),
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
          'id',                  s2.id,
          'tenant_name',         s2.tenant_name,
          'number_of_occupants', s2.number_of_occupants,
          'occupancy_days',      s2.occupancy_days,
          'person_days',         s2.person_days,
          'percentage',          s2.percentage
        )
        order by s2.tenant_name
      ) as peer_splits
    from public.bill_splits s2
    group by bill_id
  ) peers on peers.bill_id = bs.bill_id
  left join (
    select src.carried_forward_into_split_id as split_id,
      jsonb_agg(
        jsonb_build_object(
          'bill_type',            src_bill.bill_type,
          'billing_period_start', src_bill.billing_period_start,
          'billing_period_end',   src_bill.billing_period_end,
          'amount',               src.owed_amount - src.amount_paid
        )
        order by src_bill.billing_period_start
      ) as carry_forward_sources
    from public.bill_splits src
    join public.bills src_bill on src_bill.id = src.bill_id
    where src.carried_forward_into_split_id is not null
    group by src.carried_forward_into_split_id
  ) sources on sources.split_id = bs.id
  where bs.access_token = p_token
    and bs.expires_at > now();
$$;
grant execute on function public.get_bill_split_by_token(uuid) to anon, authenticated;
