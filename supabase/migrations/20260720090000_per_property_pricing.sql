-- Rev 2 of the v2 roadmap (docs/2026-07-19-roomietab-v2-roadmap.md), founder
-- decisions locked 2026-07-19 after the Fable positioning critique:
--   1. Pro reprices from a flat $19/mo to a per-property metric (~A$10/door/mo,
--      ~A$100/door/yr — value scales with doors under management, so the
--      price should too; a flat price simultaneously overcharges a 1-2
--      property operator and undercharges an 8-property one).
--   2. The free tier's bills/month cap is removed entirely (on both plans —
--      Pro's was already unlimited). Auto-generated recurring rent bills
--      count against it, so a full 4-tenant free house could exhaust it on
--      rent alone before a single utility bill; that's a hidden aggressive
--      cap, not an intentional monetization lever. Properties + tenants are
--      the only levers now.
--
-- price_unit is new: lets the /pricing page render the right unit ("/month"
-- vs "/property/month") from data, the same way the price itself already is,
-- rather than hardcoding per-plan display logic in the component.

alter table public.plans add column if not exists price_unit text not null default 'flat'
  check (price_unit in ('flat', 'per_property'));

update public.plans
set price_unit = 'per_property'
where id = 'pro';

update public.plans
set price_cents_monthly = 1000, price_cents_yearly = 10000
where id = 'pro';

update public.plans
set limits = limits || '{"max_bills_per_month": null}'::jsonb
where id in ('free', 'pro', 'beta');
