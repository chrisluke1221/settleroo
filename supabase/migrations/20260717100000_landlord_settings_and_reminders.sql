-- Design Partner Release: minimal per-landlord settings (currently just the
-- overdue-reminder toggle) + tracking so the reminder job doesn't re-notify
-- the same overdue split every time it runs.

create table public.landlord_settings (
  landlord_id uuid primary key references auth.users(id) on delete cascade,
  notify_overdue boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.landlord_settings enable row level security;

create policy "Landlords can view their own settings" on public.landlord_settings
  for select using (auth.uid() = landlord_id);
create policy "Landlords can upsert their own settings" on public.landlord_settings
  for insert with check (auth.uid() = landlord_id);
create policy "Landlords can update their own settings" on public.landlord_settings
  for update using (auth.uid() = landlord_id);

alter table public.bill_splits add column if not exists last_reminder_at timestamptz;

-- --------------------------------------------------------------------------
-- The reminder job itself (send-overdue-reminders edge function + pg_cron
-- schedule) needs manual setup beyond this file, since it involves creating
-- a secret and deploying a function — steps outside plain SQL:
--
-- 1. Deploy the function:
--      supabase functions deploy send-overdue-reminders
--    Set its secrets (a random string only you and the cron job know):
--      supabase secrets set CRON_SECRET=<a-random-string-you-generate>
--
-- 2. In the Supabase dashboard: Project Settings -> Vault -> add a secret
--    named `cron_secret` with the SAME value as CRON_SECRET above.
--
-- 3. Enable the two extensions this needs (Database -> Extensions, or run
--    here if your project allows it):
--      create extension if not exists pg_cron;
--      create extension if not exists pg_net;
--
-- 4. Schedule it (adjust the URL to your project ref; runs daily at 9am UTC):
--      select cron.schedule(
--        'send-overdue-reminders',
--        '0 9 * * *',
--        $$
--        select net.http_post(
--          url := 'https://<your-project-ref>.functions.supabase.co/send-overdue-reminders',
--          headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
--          ),
--          body := '{}'::jsonb
--        );
--        $$
--      );
-- --------------------------------------------------------------------------
