-- Recurring rent generation can run from two overlapping calls (React
-- StrictMode double-invokes effects in dev; two browser tabs could race in
-- production too) — both see "no rent bill for this period yet" and both
-- insert. A client-side in-flight guard closes the common case, but the
-- real safety net has to be at the database: two rent bills for the exact
-- same property+period should never coexist. Only applies to bill_type =
-- 'rent'; utility bills are always landlord-entered for a period they
-- choose, and don't have this auto-generation race.

-- Clean up any duplicates the race already created before this fix shipped
-- (keeps the earliest bill per property+period). Never touches a duplicate
-- that has a paid split — if that ever happens, it's left for the landlord
-- to resolve manually rather than silently deleted.
with ranked as (
  select id, row_number() over (
    partition by property_id, billing_period_start, billing_period_end
    order by created_at asc
  ) as rn
  from public.bills
  where bill_type = 'rent'
),
safe_duplicates as (
  select r.id
  from ranked r
  where r.rn > 1
    and not exists (
      select 1 from public.bill_splits s where s.bill_id = r.id and s.status = 'paid'
    )
)
delete from public.bill_splits where bill_id in (select id from safe_duplicates);

with ranked as (
  select id, row_number() over (
    partition by property_id, billing_period_start, billing_period_end
    order by created_at asc
  ) as rn
  from public.bills
  where bill_type = 'rent'
),
safe_duplicates as (
  select r.id
  from ranked r
  where r.rn > 1
    and not exists (
      select 1 from public.bill_splits s where s.bill_id = r.id and s.status = 'paid'
    )
)
delete from public.bills where id in (select id from safe_duplicates);

create unique index if not exists bills_unique_rent_period
  on public.bills (property_id, billing_period_start, billing_period_end)
  where bill_type = 'rent';
