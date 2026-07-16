-- Design Partner Release: utility bills get a draft/locked lifecycle.
-- While a utility bill has never been sent to a tenant, it's a live draft —
-- the split recomputes automatically as the tenant roster changes (fixes
-- the "100% for tenant 1" bug where adding a second tenant didn't update an
-- unsent bill). The moment it's first sent to any tenant, it locks: further
-- roster changes never silently rewrite it (same immutability principle as
-- paid splits) — instead needs_reissue flags it for an explicit landlord
-- reissue action. Rent bills are unaffected; they're a different object
-- with their own lifecycle.

alter table public.bills add column if not exists locked_at timestamptz;
alter table public.bills add column if not exists needs_reissue boolean not null default false;
