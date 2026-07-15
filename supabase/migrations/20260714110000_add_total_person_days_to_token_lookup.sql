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
  bill_tenant_count bigint
)
language sql security definer set search_path = '' as $$
  select bs.id, bs.bill_id, bs.tenant_name, bs.room, bs.number_of_occupants,
    bs.occupancy_days, bs.person_days, bs.percentage, bs.owed_amount,
    bs.occupancy_start, bs.occupancy_end, bs.status, bs.viewed_at, bs.paid_at,
    b.bill_type, b.total_amount, b.billing_period_start, b.billing_period_end, b.due_date,
    totals.total_person_days, totals.tenant_count
  from public.bill_splits bs
  join public.bills b on b.id = bs.bill_id
  join (
    select bill_id, sum(person_days) as total_person_days, count(*) as tenant_count
    from public.bill_splits
    group by bill_id
  ) totals on totals.bill_id = bs.bill_id
  where bs.access_token = p_token;
$$;
grant execute on function public.get_bill_split_by_token(uuid) to anon, authenticated;
