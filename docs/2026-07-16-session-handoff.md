# Session Handoff — 2026-07-16

Read this first in a new session, alongside `2026-07-15-roomietab-v1.5-PRD.md`
and `2026-07-15-roomietab-v1-product-design-critique.md`. It exists because
the prior session's context window ran out mid-project — everything below is
what a fresh session needs to resume without re-deriving it.

## What's live

**Supabase project:** `trfaqjkkozusxdvqnkgo`. Schema is fully tracked in
`supabase/migrations/`, applied in filename order — that folder is now the
source of truth for schema state; no ad hoc SQL should be run outside it
going forward. Migrations run through
`20260716091000_token_lookup_rate_breakdown.sql` are confirmed applied
(verified via REST API spot-checks, not just "ran without error").

**Deployed app:** Netlify, `roomietab.netlify.app`. Auto-deploys from `main`.

**Edge Functions** (deployed via `supabase functions deploy <name>`, no
Docker required despite the CLI's warning — that warning only affects
`db pull`'s shadow-database diffing, not function deploys):
- `send-bill-email` — landlord-triggered, sends via Resend, verifies caller owns the bill.
- `get-bill-attachment-url` — tenant-side signed URL for private bill attachments.

**Email (Resend):** sandbox sender `onboarding@resend.dev`. In this mode
Resend will only actually deliver to the account owner's own address,
`chrisluke1221@gmail.com` — sending to any other address returns a 403 from
Resend's API. **This blocks real tenant emails in production** until a
custom domain is verified at resend.com/domains and `EMAIL_FROM` is updated
via `supabase secrets set`. Flag this before any real launch.

**Test account:** `roomtab.test.landlord@example.com` /
`TestPass2026!` — self-signed-up throwaway account, has "Test Property
Renamed" with 3 tenants (Alice, Bob, Charlie), a rent rate history on Alice
(the exact PRD R4 acceptance-criteria example is reproduced there), and
several utility/rent bills in mixed pending/paid/viewed states. Useful as a
ready-made fixture for further manual QA.

**Important:** Supabase Auth → Providers → Email → "Confirm email" is
currently **disabled** on this project (turned off mid-session to allow
instant self-signup for testing). Decide whether to re-enable it before
real users sign up — right now anyone can create an account with an
unverified email address.

## What's done

- **Full localStorage → Supabase rebuild** of the original expired-project app onto a landlord/tenant/property/bill model (schema recovered from an old `pg_dump` backup, cross-referenced against a separate audit/critique pass).
- **Increment 1** (all P0/P1 items in `2026-07-15-roomietab-v1-product-design-critique.md`): cents-exact largest-remainder split rounding (`src/lib/billSplit.js`, tested), bill/tenant immutability once paid (no more silent rewrites of settled amounts), tenant archival instead of hard delete, private bill attachments via signed URLs, tenant link expiry (90 days) + landlord-triggered revocation, the "viewed" signal no longer false-triggers on landlord self-previews, HTML-escaped email templates, property_id as a real FK on bills. Full manual test checklist in `2026-07-15-increment-1-test-cases.md` — all passed via self-driven QA using the test account above.
- **R4 — effective-dated rent rates** (PRD §5): `rent_rates` table with a Postgres exclusion constraint (gist) making overlapping rates for one tenant physically impossible at the DB level, not just app-validated. Day-by-day proration (`src/lib/rentCalc.js`, tested) verified against the PRD's own numbers end-to-end through the running app. New rate auto-closes the prior open-ended one (no gaps). Rate edit/delete blocked once it touches an already-paid bill.

Both are committed and pushed to `main`.

## What's not started

In PRD build order (`2026-07-15-roomietab-v1.5-PRD.md` §9), remaining work:
- **§7 Entitlements & Pricing** — chosen as the next increment (see below), ahead of R6 and §6 by the user's explicit preference.
- **R6** — seed/demo script for realistic multi-persona local data.
- **§6** — operator/founder admin plane.
- **Increment 3** — P2 reskin (brand name decision — PRD says "RoomieTab", code/UI still says "RoomTab" everywhere — copy rewrite, work-queue dashboard, standalone tenant shell, mobile card layout).
- **Increment 4** — email-in bill ingestion, Stripe Checkout, **password reset flow** (currently missing entirely — a real user hit this gap during the session and flagged it as "so wrong").

## Next task: §7 Entitlements & Pricing

Full scoped brief is in the approved plan file this doc was written alongside
(`/Users/chrislu/.claude/plans/what-should-be-the-declarative-barto.md`) —
summary:

- New tables: `plans`, `subscriptions`, `entitlement_overrides` (P0 scope only — Stripe is explicitly P1, out of scope for this pass).
- A `check_entitlement(account_id, key)` security-definer RPC, following the same pattern as `revoke_bill_split_token` in `supabase/migrations/20260715100000_tenant_token_expiry.sql`.
- Wire the check into `createProperty`, `createTenant`, `createBillWithSplits`/`createRentBill` in `src/contexts/PropertyContext.js` — same "throw a clear Error, let the UI catch it" shape as the existing `rentRateEditGuard` and paid-bill guards already in that file.
- A public `/pricing` route reading from the `plans` table (not hardcoded).
- Acceptance test to reproduce: free account blocked from creating a 2nd property → upgrade modal; manually flip their `subscriptions` row to Pro → same action succeeds immediately.

## Working conventions established this session

- Every schema change is a new timestamped file in `supabase/migrations/`, run manually via the Supabase SQL Editor (this sandbox has no direct DB connection — no `psql`, no Docker for `db pull`/`db push`). Always paste the full SQL for the user to run, then verify via a REST API curl check afterward rather than trusting "it ran."
- This environment can commit locally but **cannot push to GitHub** (no cached credentials) — always ask the user to run `git push origin main` themselves after a commit, then verify with `git fetch && git log origin/main --oneline -1`.
- Money-critical logic lives in `src/lib/*.js` as pure, unit-tested functions (`billSplit.js`, `rentCalc.js`) separate from the Supabase-calling context — keep this pattern for any new calculation logic.
- Run `CI=true npx react-scripts test` before every commit.
- Prefer testing end-to-end yourself via the Browser tools against the test account over asking the user to manually click through checklists — it's faster and catches real bugs (this session found and fixed several this way: edge function CORS, Resend sandbox restrictions, a rate-overlap auto-close bug).
