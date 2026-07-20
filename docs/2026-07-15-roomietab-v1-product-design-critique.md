# RoomieTab v1 — Product & Design Critique + Fix Spec

> *Historical document, written before the 2026-07-20 rename to Settleroo — "RoomieTab" reflects the product name at the time.*

**Scope:** Full audit of the vibe-coded v1 (`Product build/roomtab`, React/CRA + Supabase) — code review of all 2,094 lines + live walkthrough on localhost at desktop (1440px) and mobile (390px).
**Companion doc:** `2026-07-15-roomietab-prd-teardown.md` (strategy, USP, roadmap).
**Verdict:** Strong skeleton for one week of vibe coding — the calculation-transparency instinct is exactly right and the edge function does auth properly. But it is not chargeable yet: the split math can produce totals that don't sum, paid history silently rewrites itself, move-outs don't exist in the UI, and the visual identity says "roommate side-project," not "trust me with your money." Fix the P0s before showing this to a single prospective customer.

---

## P0 — Correctness & trust. No customer conversations until these are fixed.

**P0-1. Splits can fail to sum to the bill total.**
`computeSplits` (PropertyContext.js:41–42) rounds each tenant's share independently: `Math.round(share*100)/100`. A $100.00 bill over 3 equal tenants = 3 × $33.33 = $99.99. Today's demo data happens to sum; change the numbers and it won't.
*Fix:* work in integer cents; compute n−1 shares by rounding, assign the remainder to the last share (largest-remainder method); add unit tests asserting `sum(shares) === total` across randomized inputs. This module is the product — it should be the most-tested code in the repo, and today there are zero tests.

**P0-2. Paid history rewrites itself.**
Any tenant add/edit/delete triggers `recalcBillsForProperty`, which recomputes **all** past bills for the property — including splits already marked `paid`. A tenant who settled $47.20 can have that record silently become $52.80. This violates the first rule of money software: an issued bill is an immutable fact.
*Fix:* bills get a status (`draft → issued → settled`). Issued bills are never auto-recalculated. Tenant changes affect future bills only; correcting an issued bill creates a versioned reissue (supersedes v1, keeps both, notifies tenant). The recalc-on-every-change behaviour becomes a preview, applied only to drafts.

**P0-3. Move-out doesn't exist; deleting a tenant is the only exit — and it triggers P0-2.**
`computeSplits` handles `move_out_date`, but no form captures it. The PRD's core scenario (staggered move-outs, vacancy periods) is dead code. Worse, the real-world action (tenant leaves) forces the landlord into the one operation that corrupts history.
*Fix:* add move-out date to the tenant form (with validation: ≥ move-in, warn if it intersects issued bills). Tenants become `active / former`, never hard-deleted (their splits reference them). Delete only allowed for tenants with no bill history, behind a confirm dialog — today tenant delete has **no confirmation at all** (bill delete on Properties has one; PropertyDetail's tenant/bill deletes don't).

**P0-4. Rent changes after fixed term (Chris's new requirement) — same root cause.**
Rent isn't modeled at all; it's just a bill type. When a room's rent changes after the fixed term, the system must apply the new rate from its effective date without touching history.
*Fix:* model rent as an effective-dated rate on the room/tenancy: `rent_rates(tenancy_id, amount_cents, frequency, effective_from, effective_to)`. Validations: no overlapping periods, no gaps between consecutive rates, effective_from ≥ tenancy start, retroactive changes require explicit confirmation and only affect unissued bills. Bill generation picks the rate in force for the billing period. This one table also gives you the fixed-term expiry reminder ("Room 2's fixed term ends in 30 days — review rent?") — a retention feature landlords will love.

**P0-5. Schema and RLS exist only in the Supabase dashboard.**
No SQL migrations in the repo. The homepage *claims* row-level security; nothing in version control proves or reproduces it. One wrong dashboard click = every landlord's data exposed, and you'd never see it in review.
*Fix:* `supabase db pull` into `supabase/migrations/`, commit, and from now on schema changes go through migration files. Add a smoke test with two test accounts asserting cross-account reads return zero rows.

**P0-6. Bill attachments are publicly readable.**
`getPublicUrl` on the `bill-attachments` bucket (PropertyContext.js:359, TenantBillView.js:163) — anyone with the URL reads tenants' utility bills: names, addresses, account numbers. Utility bills are identity-theft raw material.
*Fix:* private bucket + `createSignedUrl` (e.g. 1-hour expiry), issued via an RPC that validates the caller (landlord session, or valid tenant token for that split).

---

## P1 — Product integrity. Fix before real tenants touch it.

**P1-1. Landlord preview corrupts the "Viewed" signal.** Confirmed live: opening the tenant link myself flipped tenant 1 from Pending → Viewed. `mark_bill_split_viewed` fires for any visitor. The status pipeline (pending → viewed → paid) is your arrears-autopilot foundation — it must be trustworthy. *Fix:* don't mark viewed when the visitor holds a landlord session for that bill; add a distinct "Preview as tenant" mode.

**P1-2. Bills have no `property_id`.** Ownership is inferred through splits→tenants (admitted in a code comment). Orphanable, unqueryable, and it makes P0-2's recalc logic even hairier. *Fix:* add the column, backfill, make it NOT NULL.

**P1-3. Multi-step writes are non-atomic.** Bill+splits creation and every recalc are sequential client-side inserts/updates/deletes; a mid-sequence failure leaves half-written money data. *Fix:* move bill issuance and recalc into a single Postgres RPC (one transaction). Client-side orchestration of financial writes has to go.

**P1-4. Tenant tokens never expire and can't be revoked.** One UUID grants permanent access to a bill (and its attachment). Fine for a demo; not for PII + money. *Fix:* add `expires_at` (e.g. 90 days, refreshed on re-send) and a revoke path; the "invalid or expired" error message already promises this.

**P1-5. Unescaped interpolation in the email HTML.** `tenant_name`, `room`, `bill_type` go straight into the template (send-bill-email/index.ts:74–79). Landlord-supplied today, still sloppy hygiene for financial email. *Fix:* escape all interpolated values.

**P1-6. No ledger.** "What does tenant X owe in total?" — the exact 3-month tally-up pain from the PRD — is unanswerable. Status flags on splits are not an accounting record. *Fix (data model now, UI later):* `ledger_entries(tenancy_id, type: charge|payment|adjustment, amount_cents, effective_date, reference)`. Issuing a bill writes charges; marking paid writes payments. Per-tenant balance and EOFY export fall out for free.

**P1-7. Misc:** deleting a bill leaves its attachment orphaned in storage; `email_sent_at` update in the edge function isn't awaited on failure paths; CRA (`react-scripts`) is effectively EOL — migrate to Vite when convenient, not urgently.

---

## P2 — Design & CX. Why it feels uncommercial, and the direction.

Your gut is right, and the root cause is identifiable: **the app has no owner-of-money identity.** It's the stock Tailwind blue/slate starter kit (`primary-*`/`secondary-*` defaults, generic dollar-sign logo, `from-blue-50 to-indigo-100` gradient on every page) plus copy aimed at the wrong user. Specifics from the walkthrough:

1. **The copy contradicts the product.** Browser title: "RoomTab — Split Bills with Friends." Footer: "Made with ♥ for roommates everywhere © 2024." Features section: "split bills and track expenses with friends and roommates." This is a **landlord tool** — the words say Splitwise clone. And the brand is three names at once: RoomieTab (your PRD), RoomTab (the app), roomtab (the repo). Pick one, then rewrite every string against the teardown's positioning ("From bill to settled, without you").
2. **The landlord home is a marketing brochure.** Logged-in users land on a hero page with "Get Started" CTAs. A returning landlord should land on their **work queue**: bills awaiting issue, payments to confirm, tenant queries, upcoming due dates. The teardown's "inbox zero for property money" — that's the screen that makes this feel like a professional tool. Today's equivalent (Properties list) is one lonely card floating over a footer that occupies half the viewport.
3. **No trust surface.** This product asks landlords to trust it with money math, yet shows no cues: no explicit "verified/issued" states, playful bounce animations near dollar amounts, `window.confirm()` browser dialogs for destructive actions, tenant PII (full address) rendered into a page any UUID-holder can open. Money products earn trust through restraint: fewer gradients, stronger typographic hierarchy on amounts (tabular figures!), explicit states, proper confirmation modals with consequences spelled out ("This deletes 3 bills and 9 splits").
4. **The tenant page renders inside the landlord's app shell.** The tenant sees your nav, your account name, Home/Properties links, a Logout button — confusing and unprofessional, and it leaks that the landlord is logged in on shared devices. The bill view itself (breakdown card) is genuinely good — the best screen in the app. Give it a standalone shell: property name + landlord name header, no app nav, footer "Powered by RoomieTab" (that line is also your viral loop — every bill sent is a mini-ad to a houseful of future landlords).
5. **Mobile:** tenant view holds up well; landlord bill table at 390px squeezes 7 columns into unreadability, and the sticky header overlaps content while scrolling. *Fix:* on <768px, render splits as stacked cards (tenant, amount, status, actions), not a table. Landlords will run this product one-handed standing in a hallway; mobile-first is not optional.
6. **Design-direction spec (for the Claude Code session):**
   - **Palette:** drop blue-on-blue-on-indigo. One warm neutral base (stone/sand), one confident accent (deep teal or forest — money-adjacent without being bank-boring), semantic green/amber/red reserved exclusively for payment states so status colors mean something.
   - **Type:** keep Inter but actually load it (it's referenced, never imported — you're rendering system fallbacks); `font-variant-numeric: tabular-nums` on all amounts; amounts get the strongest weight on any screen, not the section headers.
   - **Layout:** kill the full marketing footer on app pages (one-line footer); dashboard = work queue + portfolio summary strip (total outstanding, overdue count, next due date); density up — cards with 24px padding around 3 lines of text is why it reads "toy."
   - **Motion:** page transitions and `bounce-gentle` out; motion only for state confirmation (payment matched, bill issued).
   - **States:** every list gets designed empty/loading/error states; current empty state is a bare "No bills yet."

---

## Suggested fix order (hand this to Claude Code)

1. **Week 1 — the money core:** cents migration + largest-remainder rounding + test suite (P0-1); bill lifecycle & immutability (P0-2); move-out + tenant archival + confirms (P0-3); `property_id` on bills (P1-2); migrations pulled into repo (P0-5).
2. **Week 2 — security & integrity:** private bucket + signed URLs (P0-6); transactional RPCs (P1-3); token expiry (P1-4); viewed-signal fix (P1-1); email escaping (P1-5).
3. **Week 3 — the model that unlocks the roadmap:** rent as effective-dated rates + validations (P0-4); ledger tables + per-tenant balance (P1-6).
4. **Week 4 — the reskin:** brand decision, copy rewrite, design tokens, dashboard-as-work-queue, standalone tenant shell, mobile cards (P2). Do the reskin *after* the model changes — the dashboard design depends on the ledger existing.

Re-audit after week 2; first customer conversations are earned then, not before.
