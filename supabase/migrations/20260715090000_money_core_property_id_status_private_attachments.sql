-- P1-2: bills need their own property_id instead of being inferred through
-- splits->tenants (which breaks the moment a bill has zero splits).
alter table public.bills add column if not exists property_id uuid references public.properties(id) on delete cascade;

update public.bills b
set property_id = (
  select t.property_id
  from public.bill_splits bs
  join public.tenants t on t.id = bs.tenant_id
  where bs.bill_id = b.id
  limit 1
)
where b.property_id is null;

-- Only enforced if every existing bill backfilled successfully; if this
-- statement errors, some bill has zero splits and needs manual attention
-- before it can be made required.
alter table public.bills alter column property_id set not null;

-- P0-2: bills need a lifecycle so issued/settled bills are never silently
-- rewritten by later tenant changes.
alter table public.bills add column if not exists status text not null default 'issued'
  check (status in ('draft', 'issued', 'settled'));

-- P0-3: tenants need an archival state instead of hard delete, since
-- deleting a tenant with bill history destroys that history's referent.
alter table public.tenants add column if not exists status text not null default 'active'
  check (status in ('active', 'former'));

-- P0-6: bill attachments currently sit in a public bucket — a public URL
-- with a guessable-enough path is enough to leak tenant PII (names,
-- addresses, account numbers on the original bill). Flip to private;
-- access now goes through signed URLs issued by the landlord's own
-- session (owner-scoped RLS below) or the send-bill-attachment-url
-- edge function for tenants (service-role, validates the bill token).
update storage.buckets set public = false where id = 'bill-attachments';

drop policy if exists "Public can view bill attachments" on storage.objects;

drop policy if exists "Owners can view their bill attachments" on storage.objects;
create policy "Owners can view their bill attachments"
on storage.objects for select
to authenticated
using (bucket_id = 'bill-attachments' and owner = auth.uid());
