# Pricing → login → checkout friction fix

**Date:** 2026-07-31
**Trigger:** Chris ran a live test-mode checkout and found the logged-out flow too long — clicking "Start with Pro" on `/pricing` sent the user to `/login`, and both Google OAuth and magic-link sign-in hardcoded the post-auth redirect to `/dashboard`, dropping all upgrade intent. The user had to manually navigate back to `/pricing` and click "Upgrade" a second time to reach Stripe Checkout — roughly 6 steps for what should be 2-3.

## Decision

Two options were scoped:

- **Option A (chosen):** keep the login-before-pay model, but carry upgrade intent (`plan`, `period`) through login via URL query params, and auto-resume checkout on `/pricing` once the user lands back there authenticated. Small, no schema changes, ships same-day.
- **Option B (deferred, not built):** "pay-first" — send logged-out visitors straight to Stripe Checkout, create/match the Supabase account afterward via webhook by email. Removes login-before-pay entirely, closer to Stripe's own recommended pattern, but touches account-creation and entitlement logic and needs a plan for reconciling duplicate/zero matching Supabase accounts by email. Bigger scope — its own initiative if pursued.

Chris chose Option A for this fix. Option B remains a live idea for a future, separately-scoped pass if login-before-pay is still judged too much friction after this ships.

## What shipped

- `src/contexts/AuthContext.js`: `signInWithGoogle` / `sendMagicLink` accept an optional `redirectPath` (default `/dashboard`), used to build `redirectTo`/`emailRedirectTo`.
- `src/pages/Login.js`: reads `?redirect=&intent=&plan=&period=` from the URL, validates `redirect` is a same-origin relative path (falls back to `/dashboard` otherwise — open-redirect guard), and threads the reconstructed path through both auth methods and the already-authenticated bounce effect.
- `src/pages/Pricing.js`: the logged-out "Start with Pro" CTA now links to `/login?redirect=/pricing&intent=upgrade&plan=pro&period={monthly|yearly}`. A new effect on `/pricing`, gated on the subscription-status fetch having resolved and a one-shot ref guard, auto-calls `handleUpgrade()` when `intent=upgrade` is present and the user isn't already on Pro — so checkout launches automatically after login instead of requiring a second click.

No changes to `plans`, `subscriptions`, `bill_splits`, or `check_entitlement` — this is client-side routing/redirect plumbing only, per the guardrails in `CLAUDE.md`.

## Not done here

- `src/App.js`'s `RequireAuth` still has no generic return-to (`state={{from: location}}`) for other protected routes (e.g. `/dashboard`). This is a separate, smaller UX gap, flagged as a follow-up rather than bundled into this fix.
- Option B (pay-first checkout) — not started, needs its own design pass if picked up later.
