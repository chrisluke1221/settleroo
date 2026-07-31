-- CHR-21 / CHR-39: surface occupancy exceptions on the tenant-facing bill
-- page. Per the research's "provable/dispute-proof" positioning
-- (docs/2026-07-24-settleroo-integrated-research-synthesis.md, Finding 4),
-- an adjustment must be visible and explained, not hidden math — a tenant
-- who sees a peer's share is smaller than expected should see why, right
-- there in the existing peer breakdown (CHR-17's named peer table already
-- shares tenant_name/occupancy_days across tenants on the same bill, so
-- adding an exception's dates/reason to that same object doesn't cross any
-- new privacy boundary — it's the same shared-bill visibility model).
--
-- The live function's actual OUT-parameter row type didn't match what was
-- expected from create-or-replace (Postgres error 42P13) — rather than
-- guess why from local files, drop and recreate, per
-- docs/SCHEMA_REFERENCE.md's standing note that this is required whenever
-- Postgres won't accept an in-place alter.
--
-- That error is also the tell that PROPOSED_20260728100000_peer_splits_add_
-- occupants.sql is actually live already (despite never being renamed to
-- drop its PROPOSED_ prefix — a docs-sync gap, not a schema gap) — its
-- peer_splits.number_of_occupants field is what TenantBillView.js's
-- internet-bill flat-split display reads. Preserved below so this
-- migration doesn't silently regress that.
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
    select s2.bill_id,
      jsonb_agg(
        jsonb_build_object(
          'id', s2.id,
          'tenant_name', s2.tenant_name,
          'number_of_occupants', s2.number_of_occupants,
          'occupancy_days', s2.occupancy_days,
          'person_days', s2.person_days,
          'percentage', s2.percentage,
          'exceptions', coalesce(ex.exceptions, '[]'::jsonb)
        )
        order by s2.tenant_name
      ) as peer_splits
    from public.bill_splits s2
    left join (
      select bill_id, tenant_id,
        jsonb_agg(
          jsonb_build_object(
            'exception_start', exception_start,
            'exception_end', exception_end,
            'reason', reason
          )
          order by exception_start
        ) as exceptions
      from public.bill_split_exceptions
      group by bill_id, tenant_id
    ) ex on ex.bill_id = s2.bill_id and ex.tenant_id = s2.tenant_id
    group by s2.bill_id
  ) peers on peers.bill_id = bs.bill_id
  left join (
    select src.carried_forward_into_split_id as split_id,
      jsonb_agg(
        jsonb_build_object(
          'bill_type', src_bill.bill_type,
          'billing_period_start', src_bill.billing_period_start,
          'billing_period_end', src_bill.billing_period_end,
          'amount', src.owed_amount - src.amount_paid
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
