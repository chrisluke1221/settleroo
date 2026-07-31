-- CHR-21 / CHR-36: occupancy exceptions — let a landlord record a negotiated
-- absence adjustment for a specific tenant on a specific bill.
--
-- Confirmed via a full schema trace (docs/2026-07-19-settleroo-v2-roadmap.md,
-- Phase Collection section) that no existing column on bill_splits/tenants
-- can carry this. A new table is the minimal shape: an exception is scoped
-- to one bill + one tenant (never a standing tenant-level setting), matching
-- the "record it when creating/editing a bill, never after it's been sent"
-- guardrail in CLAUDE.md — the same reason bill_splits itself is never
-- mutated post-send. Reissue is the only path to change an exception once
-- a bill has gone out, exactly like every other post-send split change.
--
-- Redistribution model (Chris's call, 2026-07-31): the exempted days are
-- simply excluded from that tenant's occupancy_days for this bill, which
-- computeSplits (src/lib/billSplit.js) already turns into a pro-rata
-- reduction in totalPersonDays — every other tenant's share increases
-- automatically via the existing percentage-of-total math. No new
-- redistribution algorithm needed; the split-sum invariant holds for free
-- because it's the same proportional split, just over fewer person-days
-- for the exempted tenant.
create table public.bill_split_exceptions (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exception_start date not null,
  exception_end date not null,
  reason text,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bill_split_exceptions_valid_range check (exception_end >= exception_start)
);

alter table public.bill_split_exceptions enable row level security;

create policy "Landlords can view their bill split exceptions" on public.bill_split_exceptions for select using (auth.uid() = landlord_id);
create policy "Landlords can create bill split exceptions" on public.bill_split_exceptions for insert with check (auth.uid() = landlord_id);
create policy "Landlords can update their bill split exceptions" on public.bill_split_exceptions for update using (auth.uid() = landlord_id);
create policy "Landlords can delete their bill split exceptions" on public.bill_split_exceptions for delete using (auth.uid() = landlord_id);

-- A bill that has already been locked (locked_at set — see utility_bill_lock.sql)
-- must not gain a new exception; enforce it as a trigger rather than trusting
-- every client call site to check first, matching how the "never modify a
-- sent split" rule is enforced elsewhere as a server-side guard, not just a
-- UI convention.
create or replace function public.prevent_exception_on_locked_bill()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.bills
    where id = new.bill_id and locked_at is not null
  ) then
    raise exception 'Cannot add an occupancy exception to a bill that has already been sent. Use reissue instead.';
  end if;
  return new;
end;
$$;

create trigger bill_split_exceptions_block_after_lock
  before insert on public.bill_split_exceptions
  for each row execute function public.prevent_exception_on_locked_bill();
