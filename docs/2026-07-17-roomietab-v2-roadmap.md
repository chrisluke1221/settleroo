# RoomieTab v2 Roadmap — Monetization, Operator CRM, and the AI Wedge

**Status:** Phase A shipped ([PR #7](https://github.com/chrisluke1221/roomtab/pull/7)) · Phases B–E planned, not started
**Owner:** Chris (founder/operator) · **Written:** 2026-07-17 · **Phase A completed:** 2026-07-18
**Companion doc:** `2026-07-15-roomietab-v1.5-PRD.md` — this roadmap picks up where that PRD's build order leaves off, and formally overrides a few of its decisions (see below).

This is the canonical spec for what comes after v1.5. Read this file first when resuming this work in a new session — it supersedes any planning notes that may exist outside this repo (e.g. under `~/.claude/plans/`, which is a machine-local scratch folder, not part of this project, and not something a future session or collaborator can see).

---

## Context

All of v1.5's landlord-facing product work (Increments 1–3 + Design Partner Release + fast-follows) is merged to `main` and live at roomietab.netlify.app. What existed at the time this roadmap was written was a polished single-segment product: a landlord can split bills, generate recurring rent, and chase tenants. What did **not** exist was everything that makes it a *business*: no way to charge anyone, no cap on free usage, no founder-facing view of accounts, and none of the AI capabilities that answer "why is this an AI-era product."

Gaps identified 2026-07-17 (checked against code directly):
- No entitlements/pricing, no operator plane, no audit trail, no seed script, no AI anywhere.
- Launch blockers: Resend sandbox email limitation, missing delete-property UI, Google OAuth not enabled.

### Founder decisions (2026-07-17, supersede the v1.5 PRD where conflicting)
1. **Pricing**: Keep PRD §7 hypothesis — Free "Starter" (1 property / 4 tenants / 5 bills/mo / "Powered by RoomieTab") vs Pro A$19/mo / A$190/yr. **All AI features are Pro-only** — AI becomes the strongest "why pay."
2. **MCP pulled forward** (reverses the PRD's "parked to H3" decision): ship a **read-only MCP server** as a Pro feature.
3. **AI flagship = R7 email-in ingestion** ("forward the bill, done") — leads the marketing story and demo.
4. **Stripe stays P1**: manual (operator-granted) plans first; Stripe Checkout lands the phase after the operator plane exists.

### The USP guardrail for every AI feature
**"AI at the edges, deterministic math in the middle."** AI reads bills, drafts messages, answers questions, and exports summaries — it never computes a split, never mutates money state without explicit human confirm. This is the trust story that lets a landlord defend every number to a tenant, and it's the one-line answer to "why not just ask ChatGPT to split my bills": *ChatGPT guesses; RoomieTab proves.*

---

## Segment map (who gets what)

| Capability | Freemium landlord | Pro landlord | Operator (founder) |
|---|---|---|---|
| Split engine, tenant no-login links, recurring rent | ✓ (1 property) | ✓ unlimited | n/a |
| Tenant page branding | "Powered by RoomieTab" (viral loop) | removable | n/a |
| Email-in AI ingestion (R7) | — | ✓ | n/a |
| MCP server / "ask your books" | — | ✓ (read-only tokens) | ✓ (own books) |
| Arrears autopilot (Phase E) | — | ✓ | n/a |
| EOFY tax pack (Phase E) | — | ✓ | n/a |
| Accounts CRM, impersonation, metrics, plan grants | — | — | ✓ (§6 O1–O5) |

---

## Phase A — Monetization spine + launch blockers — ✅ SHIPPED (PR #7, 2026-07-18)

**Goal:** a stranger can hit a limit, see why, and be flipped to Pro; nothing embarrassing blocks real users.

Built:
- `plans` / `subscriptions` / `entitlement_overrides` tables (migration `20260719090000_plans_and_entitlements.sql`) + seed rows.
- `check_entitlement(key)` SECURITY DEFINER RPC — single enforcement point, wired into `createProperty`, `createTenant`, `createBillWithSplits`, `createRentBill` in `src/contexts/PropertyContext.js`.
- Global upgrade modal (`src/components/UpgradeModal.js`) + public `/pricing` page (`src/pages/Pricing.js`) rendered from the `plans` table.
- Delete-property UI with cascade-count confirm dialog (`src/pages/PropertyDetail.js`).

**Verified live**: free account blocked at property #4 → upgrade modal with correct usage copy; operator-flip to Pro via manual `subscriptions` row → identical action succeeds immediately. Tests 14/14, build clean.

**Still open (founder actions, not code):**
- Verify a custom domain at resend.com/domains + `supabase secrets set EMAIL_FROM=...` (Resend sandbox only delivers to your own inbox today).
- Enable the Google OAuth provider in the Supabase dashboard (Authentication → Providers → Google).

## Phase B — Operator plane: the founder CRM (PRD §6 O1–O5 + R6) — not started

**Goal:** Chris-as-founder manages *accounts* the way Chris-as-landlord manages *properties*.

1. **Access model** per PRD §6: `operator: true` in `app_metadata` (service-role only), `/operator` routes, all reads/writes via SECURITY DEFINER RPCs asserting the claim, 404 for non-operators.
2. **O1 Accounts list** (the CRM core): email/name, plan, status incl. churn-risk (no login 14d), properties/tenants/bills-30d counts, last active, MRR, signup date; sort/filter.
3. **O2 Account detail**: plan switch (this is how manual Pro grants work — pairs with Phase A's `subscriptions` table), founder notes, usage timeline, entitlement overrides, danger zone (suspend, revoke tokens).
4. **O3 Read-only impersonation** with banner + `operator_audit_log` on every action; writes blocked server-side.
5. **O4 Business metrics tiles**: signups, activation, WAU, bills processed, **split-sum-invariant violations (must display, must be zero)**, link open rate, claimed→confirmed, MRR, plan mix.
6. **O5 Operations**: resend failed email, regenerate/revoke tenant token, view bill audit trail.
7. **Bill audit trail** (prereq for O5 and the dispute-killer USP): `bill_events(bill_id, event_type, actor, payload jsonb, created_at)` append-only; write events from issue/send/view/claim/confirm/reissue paths.
8. **R6 seed script** (`npm run seed`): operator + 2 landlords + 3 properties + ~8 bills across all statuses + rate change + versioned reissue — makes every persona demoable and every later phase testable.
9. **CRM extensions beyond PRD** (founder-requested): activation funnel view (signed up → added property → issued first bill), a feedback/notes inbox per account, churn-risk flag surfaced as a work-queue for the founder ("3 accounts going quiet this week").

## Phase C — Stripe self-serve (P1 unlock) — not started

Stripe Checkout + customer portal + webhook → `subscriptions` (source=stripe), per PRD §7 P1. Small phase; do immediately after B so a stranger can pay without founder involvement. Never hand-roll billing.

## Phase D — AI wedge 1: the flagship — not started

1. **R7 email-in ingestion** exactly per PRD (per-property `bills+{short_id}@in.roomietab.com` via Resend inbound → edge function → Claude API extraction → **draft** bill with confidence shown → landlord confirms → deterministic engine splits). Feature-flagged, Pro-only. AC: forwarded bill → draft in 60s; address mismatch → "unmatched", never auto-assigned; extraction failure → attachment-only draft.
   - Founder prereq: `in.roomietab.com` DNS + Resend inbound.
2. **Read-only MCP server** (new scope, replaces PRD's H3 parking):
   - A remote MCP server (Supabase edge function or small host) exposing per-landlord scoped tools: `get_balances`, `get_bill(id)`, `list_overdue`, `get_property_summary`, `get_tenant_ledger`. Auth via a landlord-generated scoped API token (revocable, shown once — same pattern as tenant link tokens).
   - Positioning: "Your rental ledger, readable by your AI." Works from Claude, ChatGPT, or any MCP client the landlord already uses.
   - **Read-only in this phase** — no mutations, no money actions.
3. **In-app "ask your books"** (thin chat over the same tool surface, for non-AI-native landlords): grounded strictly in the same RPCs, never free-generated numbers.
4. Marketing page update: ingestion becomes the hero demo; MCP the second act.

## Phase E — AI wedge 2: close the loop (sequenced after D proves demand) — not started

1. **Arrears autopilot**: AI-drafted escalating reminder sequences (friendly → firm → final), landlord approves the sequence once, app executes on schedule. The literal USP — "from bill to settled, **without you**." Requires the `bill_events` trail from Phase B.
2. **EOFY tax pack** (seasonal, AU): per-property annual export, AI-categorized, accountant-ready. Pro-only; time the launch for May–June.
3. **"Explain my bill" tenant-side assistant**: ask-why box on the no-login tenant page, grounded strictly in the stored deterministic breakdown.
4. **Bill anomaly nudge**: "This power bill is 38% above the same period last year — check it before splitting."

### Explicitly still parked
Payment rails (tenant money movement), native apps, WhatsApp, state-by-state compliance engine, B2B/agency multi-seat. MCP **write** tools parked until read-only MCP shows usage.

---

## Verification (per phase)

- **Phase A** ✅: reproduced live (see above). `CI=true npx react-scripts test` + `CI=true npm run build`.
- **Phase B**: two-account isolation test (non-operator hitting `/operator` RPCs errors, 404 on routes); every operator action produces an `operator_audit_log` row; `npm run seed` + login as all three personas end-to-end.
- **Phase C**: Stripe test-mode checkout → webhook flips `subscriptions` → entitlement immediately honored.
- **Phase D**: forward a real PDF bill to the ingest address → draft within 60s; connect Claude Desktop to the MCP server with a scoped token → query balances → verify numbers match the dashboard exactly; revoke token → access dies.
- **Phase E**: autopilot dry-run mode (drafts logged, not sent) verified against seed data before any real send.

## Execution note

Each phase is its own branch/PR off `main`. Phase B is next — the operator plane and seed script are foundational for testing everything after it.
