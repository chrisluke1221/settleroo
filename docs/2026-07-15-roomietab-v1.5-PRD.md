# RoomieTab v1.5 — Product Initiation Document (PID)

**Status:** Approved for build · **Owner:** Chris (founder/operator) · **Date:** 2026-07-15
**Companion doc:** `2026-07-15-roomietab-v1-product-design-critique.md` (P0/P1/P2 fixes to the existing code — read it first; this PID assumes those fixes land as Increment 1).
**Audience:** Claude Code. Every requirement here is written to be implemented against the existing React + Supabase codebase.

---

## 1. Problem & positioning

Self-managing, rent-by-the-room landlords lose hours per bill working out occupancy-weighted splits across staggered move-ins/move-outs, then chasing payment across email, SMS, and bank statements. Existing tools (RentBetter, Cubbi, Baselane, TenantCloud) collect rent and attach tenant bills, but none compute room-level, occupancy-day-weighted splits or close the loop from bill to settled.

**Positioning:** *RoomieTab is the settlement layer for rent-by-the-room.*
**USP one-liner:** **"From bill to settled, without you."**
**Primary segment (only segment for v1.x):** individual landlords self-managing 1–10 room-by-room rental properties in Australia. B2B agencies are explicitly out of scope until Year 3.

## 2. Proven / Better / New — where v1.5 must stand out

Rule: don't reinvent proven things — build them exactly to industry standard. Spend all invention budget on Better and New.


| Tier                                                                        | Feature                                                        | Standard / benchmark                                                                     | Build note                                                                                                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proven** (build to standard, zero creativity)                             | Email+password auth, session handling                          | Supabase Auth defaults                                                                   | Already done. Add password reset flow (currently missing).                                                                                    |
| Proven                                                                      | Property/tenant CRUD, responsive web UI                        | Any SaaS                                                                                 | Done, needs P2 reskin per critique.                                                                                                           |
| Proven                                                                      | Transactional email                                            | Resend, verified custom domain                                                           | Replace `onboarding@resend.dev` sender before any external tenant sees an email.                                                              |
| Proven                                                                      | Multi-tenant isolation                                         | Postgres RLS, migrations in repo                                                         | Critique P0-5.                                                                                                                                |
| Proven                                                                      | Subscription billing                                           | Stripe Checkout + customer portal                                                        | P1 — see §7. Do not hand-roll billing.                                                                                                        |
| **Better** (competitors have a weak version; ours must be visibly superior) | **Occupancy-day proration engine**                             | RentBetter "tenant bills" = manual amounts; Ailo = split payments, not computed splits   | Deterministic, cents-exact, unit-tested, handles move-in/move-out/vacancy/rent-rate changes. The moat.                                        |
| Better                                                                      | **Tenant transparency page**                                   | Competitors show an amount; nobody shows the math                                        | Already the best screen in the app. Standalone shell + "Powered by RoomieTab" footer (viral loop).                                            |
| Better                                                                      | No-login tenant experience                                     | Competitor tenant portals require accounts                                               | Magic links, expiring, revocable. Tenant NEVER creates an account in v1.x.                                                                    |
| Better                                                                      | Effective-dated rent with fixed-term alerts                    | Competitors store a single rent number                                                   | §5 R4. "Room 2's fixed term ends in 30 days" beats every incumbent.                                                                           |
| **New** (nobody has it; this is the demo)                                   | **Immutable bill audit trail + versioned reissues**            | —                                                                                        | Every issued bill: inputs, math, notifications, status changes, versions. "Show the tenant exactly why" = dispute killer.                     |
| New                                                                         | **Settlement status pipeline with trustworthy signals**        | —                                                                                        | issued → delivered → viewed → claimed-paid → confirmed. Foundation for the H2 arrears autopilot. Signals must be uncorrupted (critique P1-1). |
| New                                                                         | **Operator plane**                                             | —                                                                                        | §6. Founder-facing account/impersonation/metrics dashboard from day one.                                                                      |
| New (P1, flag-gated)                                                        | **Email-in bill ingestion with AI extraction + human confirm** | Baselane has OCR-to-ledger; nobody has forward-an-email → prorated splits ready to issue | §5 R7. AI at the edges only; never in calculation path.                                                                                       |




## 3. Goals

1. A landlord processes a real bill — arrival to issued splits — in **< 2 minutes** (baseline: 30–45 min spreadsheet workflow).
2. **100% of issued bills** have splits summing exactly to the bill total, forever, provably (test suite + runtime invariant).
3. Chris can demo **three personas end-to-end on localhost with realistic seed data** (operator, 2 landlords, tenants) without touching the database by hand.
4. Pricing is live in-product: free-tier limits enforced, upgrade path visible, at least one test account on a paid plan.
5. ≥ 80% of bills settled by due date without manual chasing (measured across beta users, month 2+).



## 4. Non-goals (v1.5)

- **No payment rails** (no PayTo/Stripe payments from tenants; "claimed paid" + landlord confirm stays). Banking read-only reconciliation is Increment 3+ (H1.5 in the roadmap).
- **No B2B/agency features, no CRM links, no MCP server** — parked to H3 by explicit decision (2026-07-15).
- **No native mobile apps** — responsive web only.
- **No WhatsApp** — email + copyable link only; SMS when a beta user asks twice.
- **No self-serve Stripe in the first cut of pricing** — entitlements + pricing page first (testable locally), Stripe Checkout wired in P1.
- **No state-by-state compliance engine** — VIC rules hardcoded as warnings only (Chris's own state); engine is H2.



## 5. Requirements — Landlord & Tenant product

**R1–R3 (P0): the critique doc IS the spec** for the money core (cents + largest-remainder rounding, bill lifecycle/immutability, move-out + tenant archival), security (private attachments, RLS migrations, token expiry, transactional RPCs), and reskin (work-queue dashboard, standalone tenant shell, mobile cards, brand/copy fix). Implement per its Week 1–4 order. Acceptance criteria live there; do not duplicate or reinterpret.

**R4 (P0). Effective-dated rent.**

- `rent_rates(id, tenancy_id, amount_cents, frequency enum(weekly|fortnightly|monthly), effective_from date, effective_to date null, created_at)`.
- Validations: no overlapping periods per tenancy; no gap between consecutive rates; `effective_from ≥ tenancy.move_in_date`; editing a rate that intersects issued bills is rejected with instruction to end-date it and create a new rate.
- Rent bill generation resolves the rate in force per day of the billing period (a mid-period rent change pro-rates both rates by day).
- Fixed-term support: `tenancies.fixed_term_end date null`; dashboard surfaces "fixed term ending in ≤ 30 days" in the work queue.
- AC: Given rent $800/mo effective to Jul 31 and $880/mo from Aug 1, When a rent bill for Jul 15–Aug 14 is generated, Then the amount is exactly 17 days at the old daily rate + 14 at the new (cents-exact), And the tenant page shows both rates in the breakdown.

**R5 (P0). Landlord work-queue dashboard** (replaces logged-in marketing home).
Sections, in order: (1) Needs action — draft bills to issue, claimed-paid awaiting confirmation, tenant queries, overdue splits with days-overdue; (2) Portfolio strip — total outstanding $, overdue count, next due date, occupancy (rooms filled/total); (3) Upcoming — due dates and fixed-term expiries in the next 14 days. Every row deep-links to the object. Empty state designed ("Nothing needs you — that's the product working").

**R6 (P0). Seed & demo script** — `npm run seed` against local Supabase:

- Operator account (Chris), 2 landlord accounts, 3 properties (one 4-room with staggered move-ins including a mid-period move-in, one with a vacancy period and a move-out, one single-tenant), ~8 bills across types/statuses (draft, issued, viewed, claimed, confirmed, overdue), one rent-rate change at a fixed-term boundary, one versioned reissued bill.
- Purpose: goal 3 — persona-by-persona end-to-end testing with realistic data. AC: fresh clone + seed + login as each persona exercises every feature in this PID without manual data entry.

**R7 (P1, feature-flagged). Email-in bill ingestion.**

- Per-property ingest address (`bills+{property_short_id}@in.roomietab.com` via Resend inbound webhook → edge function).
- LLM extraction (Claude API): bill type, total, billing period, issuer, address-match confidence. Output = **draft** bill with extraction confidence shown; landlord confirms/edits before issue. AI never computes splits; the deterministic engine does.
- AC: forwarded PDF/image bill appears as draft within 60s with fields populated; address mismatch → flagged "unmatched," never auto-assigned; extraction failure → draft with attachment only + manual fields.



## 6. Requirements — Operator plane (founder dashboard) — P0, new build

The business-owner view. Distinct from the landlord dashboard; Chris-as-founder manages *accounts*, Chris-as-landlord manages *properties*. Not a separate app.

**Access model:** `operator: true` in Supabase `app_metadata` (settable only via service role). Routes under `/operator`, guarded client-side AND server-side: all operator reads/writes go through `SECURITY DEFINER` RPCs that assert the operator claim — never through widened RLS on business tables. Non-operators hitting `/operator` get a 404 (not a login prompt — don't advertise the surface).

**O1. Accounts list.** Table of landlord accounts: email/name, plan (free/pro/beta), status (active/trial/churn-risk = no login 14d), properties count, active tenants, bills issued (30d), last active, MRR contribution, signup date. Sort/filter by plan/status/activity. Row click → O2.
**O2. Account detail.** Profile + plan (operator can change plan and add account notes); usage timeline (signups, bills issued, emails sent, tenant link opens); entitlement overrides (e.g. grant +2 properties on free — writes to `entitlement_overrides`, audited); danger zone: suspend account, revoke all tenant tokens.
**O3. Impersonation.** "View as this landlord" — banner-wrapped read-only session ("Viewing as X — exit"). Every impersonation writes `operator_audit_log(operator_id, action, target_account, target_object, metadata, created_at)`. v1.5 impersonation is **read-only**; mutations while impersonating are blocked server-side.
**O4. Business metrics.** Tiles + 30/90-day trend lines: signups, activated accounts (≥1 issued bill), WAU landlords, bills processed, split-sum-invariant violations (**must display, must be zero**), tenant link open rate, claimed→confirmed conversion, MRR, plan mix. Client-rendered from RPCs is fine; no analytics vendor in v1.5.
**O5. Operations.** Resend a failed email; regenerate/revoke a tenant token; view any bill's audit trail read-only. All actions audited to `operator_audit_log`.

AC (plane-level): Given a non-operator session, When any `/operator` RPC is called directly, Then it errors and nothing is returned. Given any operator action, Then an audit row exists. Given impersonation, When the operator attempts a write, Then it is rejected server-side.

## 7. Requirements — Pricing & entitlements — P0 (enforcement + page), P1 (Stripe)

**Plans (launch hypothesis — operator-adjustable, not hardcoded in UI):**


|                          | Free — "Starter"       | Pro — A$19/mo or A$190/yr | Beta (operator-granted) |
| ------------------------ | ---------------------- | ------------------------- | ----------------------- |
| Properties               | 1                      | Unlimited                 | Unlimited               |
| Active tenants           | 4                      | Unlimited                 | Unlimited               |
| Bills issued / month     | 5                      | Unlimited                 | Unlimited               |
| Bill attachments         | ✓                      | ✓                         | ✓                       |
| Tenant page branding     | "Powered by RoomieTab" | Removable                 | Removable               |
| EOFY export (when built) | —                      | ✓                         | ✓                       |
| Email-in ingestion (R7)  | —                      | ✓                         | ✓                       |


**Data model:** `plans(id, name, price_cents_monthly, price_cents_yearly, limits jsonb)`; `subscriptions(account_id, plan_id, status enum(active|trialing|past_due|canceled), period enum(monthly|yearly), current_period_end, source enum(manual|stripe), stripe_customer_id null, stripe_subscription_id null)`; `entitlement_overrides(account_id, key, value, granted_by, expires_at null)`.
**Enforcement:** single server-side check (`check_entitlement(account_id, key)` RPC) called at the moment of the action — property create, tenant create, bill issue. Limit hit → modal: what limit, current usage, upgrade CTA. **Never enforce limits client-side only.**
**Pricing page** (`/pricing`, public + in-app): 3-column comparison from the `plans` table (not hardcoded), monthly/yearly toggle showing yearly saving, FAQ (4 entries: what happens at the limit; can I cancel; do tenants pay; is my data private), CTA = signup (public) / upgrade (in-app). Copy voice: landlord tool, money saved vs agent fees — not "roommates."
**P0 scope:** plans/subscriptions/overrides tables, enforcement RPC wired into the three actions, pricing page, operator plan-switch (source=manual) — fully testable locally (goal 4). **P1 scope:** Stripe Checkout + customer portal + webhook → `subscriptions` (source=stripe). AC (P0): Given a free account with 1 property, When it creates a second, Then it's blocked with the upgrade modal; When the operator sets the account to Pro, Then the same action succeeds immediately.

## 8. Success metrics & failure modes

**Leading (measure from beta week 1; instrument events now):** time bill-created→issued < 2 min (p75); split-sum violations = 0 (runtime invariant logged + operator tile); tenant link open rate ≥ 60% in 48h; claimed→confirmed ≥ 90% in 72h; landlord W1→W4 return ≥ 50%.
**Lagging (month 3–9):** ≥ 20 paying strangers by month 9 (the teardown's kill line); logo churn < 3%/mo; ≥ 80% of bills settled by due date; support < 30 min/week/100 accounts.

**Failure modes — named, observable, with responses:**

- **F1 Correctness failure:** any split-sum mismatch or issued-bill mutation in prod. *Signal:* invariant violation > 0. *Response:* sev-1, feature-freeze until root-caused. This failure is fatal to the brand; treat accordingly.
- **F2 Isolation failure:** any cross-account read. *Signal:* two-account smoke test fails or report from user. *Response:* take the service down first, investigate second.
- **F3 Tenant-side rejection:** open rate < 30% or landlords report tenants ignoring links. *Signal:* O4 tile. *Response:* rework delivery (subject lines, SMS) before building anything new.
- **F4 Wedge failure:** landlords try it, then return to spreadsheets. *Signal:* W4 return < 25% with healthy activation. *Response:* interview every churned user; suspect that manual bill entry is the friction → pull R7 (ingestion) forward.
- **F5 Market failure:** can't get 20 strangers to pay by month 9, or > 70% of interviewed landlords use "bills included" and won't switch. *Response:* pivot to UK HMO compliance angle or stop (per teardown).
- **F6 Founder-tool trap:** only Chris's own properties use it happily. *Signal:* activation of non-Chris accounts < 30%. *Response:* onboarding rebuild — assume the product currently encodes Chris's private context.



## 9. Build order

1. **Increment 1 :** critique doc P0/P1 — money core, security, integrity. *Nothing else starts until the invariant suite is green.*
2. **Increment 2 :** R4 rent rates · R6 seed script · §7 entitlements + pricing page (manual plans) · §6 operator plane O1–O5.
3. **Increment 3 :** critique P2 reskin — brand decision, work-queue dashboard (R5), standalone tenant shell, mobile cards, pricing-page polish.
4. **Increment 4 (P1, flag-gated):** R7 email-in ingestion · Stripe Checkout · password reset.
5. **Exit criteria for v1.5:** all §3 goals demonstrably true on localhost via seed data; two-account isolation test green; Chris runs a full operator → landlord → tenant demo unaided.



## 10. Open questions

1. **Brand name — RoomieTab vs RoomTab** (blocking Increment 3; the code says RoomTab everywhere). → Chris.
2. Final Pro price — A$19 vs A$25/mo; decide after first 5 beta conversations, not before launch. → Chris. Non-blocking (plans table makes it a data change).
3. Ingest-domain setup (`in.roomietab.com` DNS + Resend inbound) — blocking R7 only. → Chris.
4. Does read-only impersonation suffice for support, or will operator need write-with-consent by beta? → revisit after 2 weeks of beta support load. Non-blocking.

