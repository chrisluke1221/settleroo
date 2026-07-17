-- Recurring rent generation (fast-follow after the Design Partner Release):
-- rent charges now auto-generate each calendar month rather than requiring
-- a manual "Generate Rent Bill" click every period. Tenant notification for
-- an auto-generated rent bill is its own toggle, separate from the overdue
-- reminder toggle already on this table.

alter table public.landlord_settings add column if not exists notify_rent boolean not null default true;
