-- CHR-24: Add free-text description to bills table.
-- Resolves the "Other utility" data-quality problem: without a description,
-- nobody remembers what the bill was for months later.
--
-- PROPOSED — do not apply until reviewed by Chris.
-- Apply via: supabase db push  OR  paste into Supabase SQL Editor.
--
-- Safe to run multiple times (idempotent).

alter table public.bills
  add column if not exists description text;

-- Also expose description in the tenant-facing token lookup view so tenants
-- can see what "Other" actually means on their bill page.
-- The view is rebuilt by the latest migration; we just need to add the column
-- to the SELECT list. The view is defined in 20260722100000_tenant_bill_peer_breakdown.sql
-- and will need to be updated there (or in a new migration) to include description.
-- For now, the column is available on the bills table and the landlord UI can use it.
-- A follow-up migration will expose it to the tenant token view.

comment on column public.bills.description is
  'Free-text description, required when bill_type = ''other''. Helps landlords remember what the bill was for months later.';
