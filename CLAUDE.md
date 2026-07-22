# Settleroo — Claude Code Entry Point

Settleroo is a React + Supabase web app for landlords who rent by the room: it splits shared bills (power/water/rent) by the exact days each tenant occupied a property, and chases tenants to settled via no-login links. Live at roomietab.netlify.app.

## ▶ Where to resume (read in this order)

1. **`docs/2026-07-19-settleroo-v2-roadmap.md`** — the CANONICAL roadmap/spec. Read this first. (It supersedes `2026-07-17-roomietab-v2-roadmap.md`, which is kept only as history.)
2. `docs/2026-07-19-roomietab-v2-karpathy-review.md` — the spec-quality review the refined roadmap answers.
3. `docs/2026-07-15-roomietab-v1.5-PRD.md` — prior build order (context).
4. `docs/2026-07-19-roomietab-fable-product-critique.md` — product/pricing/positioning critique (informs the OPEN pricing question).

**Current state:** Phase A (monetization spine), the rebrand to Settleroo, and several rounds of live UAT fixes (auth/session bugs, bill-breakdown clarity, a written design system, the Rent Bills legibility redesign) are merged and live — see `docs/2026-07-22-rent-bills-redesign.md` for the latest round and what's queued next. **Phase B (Operator plane + `npm run seed`) is still the next big structural phase**, paused while UAT/trust fixes took priority. Start from the "Phase B" section of the canonical roadmap when resumed. **Build order: B → C → M → D → E** (M = marketing polish, can run in parallel once B is merged).

**Locked decisions (rev 2, 2026-07-19):** pricing = **per-property (~A$10/door/mo)**, no bills/month cap; ICP = **2–10 property operators**; Phase D ingestion first pass is **human-reviewed only (no auto-send)** — auto-send + trust ladder are Phase E, gated on eval calibration.

## Hard guardrails — Always / Ask first / Never

The product's trust story is **"AI at the edges, deterministic math in the middle."** These are enforced boundaries, not suggestions:

**NEVER**
- Let any AI / LLM / edge-function path **compute or write a bill split**, or mutate money state (amounts, splits, balances). The deterministic engine is the sole splitter.
- Ship MCP **write** tools (read-only only, until usage justifies otherwise).
- Write a **guessed** number into a money field. Low-confidence extraction → leave the field blank and flag it.
- Hand-roll billing — Stripe only.
- Modify a bill's split after it's been sent to a tenant (reissue explicitly instead).

**ASK FIRST**
- Any bill status transition to `sent` / `confirmed` (needs explicit human confirm).
- Schema/migration changes to `plans`, `subscriptions`, `bill_splits`, or money tables.
- Anything that emails a real tenant.

**ALWAYS**
- Route entitlement checks through the single `check_entitlement(key)` RPC.
- Write to `bill_events` on issue/send/view/claim/confirm/reissue.
- Show extraction confidence in the UI.
- Keep the `split-sum-invariant` at exactly zero (Phase B surfaces it as a hard alert).
- Enforce account isolation via row-level security; verify with a two-account isolation test.

## Working conventions

- **Each phase = its own branch/PR off `main`.** Don't bundle phases.
- **Before opening a PR, run that phase's verification block** (in the roadmap) plus the guardrail tests, and:
  - `CI=true npx react-scripts test`
  - `CI=true npm run build`
- Doc naming: `YYYY-MM-DD-descriptive-name.md` in `docs/`.
- **Any new requirement, feature decision, or scope change discussed in a session gets written into a dated `docs/YYYY-MM-DD-*.md` file in the same PR that implements it.** Decisions must not live only in a session's ephemeral local plan file — this repo is the durable, version-controlled record.
- Pricing/limits live in the `plans` table (data, not code) — reprice by editing the row, not by hardcoding. Pricing metric is **per-property**: Stripe quantity = active property count (Phase C).

## Where things live

- `src/pages/` — routes (Home = marketing, Pricing, Dashboard, Properties, PropertyDetail, Login, TenantBillView).
- `src/components/` — Header, Footer, UpgradeModal, etc.
- `src/contexts/` — `AuthContext`, `PropertyContext` (entitlement enforcement wired here).
- `src/lib/` — Supabase client.
- `supabase/migrations/` — SQL migrations. `supabase/functions/` — edge functions.
- `docs/` — all specs, PRDs, reviews, handoffs.
- **`docs/design-system.md`** — colors, typography, spacing, component primitives, and a design review checklist. Check any new UI against this before shipping.
