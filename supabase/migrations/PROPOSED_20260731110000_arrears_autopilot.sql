-- CHR-41: arrears autopilot v1 — escalating overdue reminders (friendly →
-- firm → final), fixed templates (no AI/LLM call in this version — Chris's
-- call, 2026-07-31: ship the escalation/approval mechanics first, slot in
-- AI-drafted tone later as a fast-follow). One landlord-level toggle
-- unlocks the whole sequence going forward (Chris's call: not a per-stage
-- approval) — same UX pattern as the existing notify_overdue/notify_rent
-- toggles in landlord_settings.
--
-- No new table needed to track escalation stage: the stage is derived
-- purely from days-overdue at send time (see send-overdue-reminders),
-- so there's nothing to store beyond the existing last_reminder_at.
alter table public.landlord_settings
  add column if not exists arrears_autopilot_enabled boolean not null default false;

-- Audit trail for the new automated behavior — landlords are trusting this
-- to act without them, so every reminder it sends should be visible in the
-- same bill_events history as every other lifecycle step (CLAUDE.md: write
-- to bill_events on send). Adds 'reminder_sent' to the allowed event types.
alter table public.bill_events drop constraint if exists bill_events_event_type_check;
alter table public.bill_events add constraint bill_events_event_type_check
  check (event_type in (
    'issued', 'sent', 'viewed', 'claimed_paid', 'confirmed',
    'reissued', 'token_revoked', 'token_regenerated', 'email_resent',
    'partial_payment_recorded', 'reminder_sent'
  ));
