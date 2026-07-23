# Manus Session 1 Handoff — 2026-07-23

## What was completed this session

All work follows the three guardrails from `docs/2026-07-23-manus-handoff.md`:
migrations proposed but never applied, PRs opened but never merged, tickets worked in strict order.

### PRs opened (all awaiting Chris's review + merge)

| PR | Tickets | Branch | Status |
|----|---------|--------|--------|
| [#23](https://github.com/chrisluke1221/settleroo/pull/23) | CHR-20 | `chr-20-rent-bill-auto-generation` | Open |
| [#24](https://github.com/chrisluke1221/settleroo/pull/24) | CHR-26, CHR-28, CHR-27, CHR-24 (batch) | `chr-26-28-27-24-ui-polish` | Open |
| [#25](https://github.com/chrisluke1221/settleroo/pull/25) | CHR-25 | `chr-25-overdue-email-copy` | Open |
| [#26](https://github.com/chrisluke1221/settleroo/pull/26) | CHR-23 + CHR-24 | `chr-23-multi-select-bill-type` | Open |

> Note: CHR-24 (description field) appears in both PR #24 and PR #26. PR #26 is the canonical implementation
> because it integrates correctly with the CHR-23 `billTypes` array. PR #24's CHR-24 changes should be
> dropped/superseded when merging — Chris should merge PR #26 for CHR-24, not PR #24's version.

### Proposed migrations (not applied — require Chris to run in Supabase)

| File | Ticket | What it does |
|------|--------|-------------|
| `supabase/migrations/PROPOSED_20260723090000_bill_description.sql` | CHR-24 | Adds `description text` to `bills` |
| `supabase/migrations/PROPOSED_20260723100000_bill_types_multiselect.sql` | CHR-23 | Adds `bill_types text[]` to `bills`, backfills, updates `get_bill_split_by_token` RPC |

**Apply order:** CHR-24 migration first, then CHR-23 migration (CHR-23 migration supersedes CHR-24's
`description` column add since it rebuilds the RPC — check for conflicts before applying both).

### Key design decisions made this session

1. **CHR-20 (rent bill bounds):** Dynamic lower bound = earliest `effective_from` across active tenants'
   rent rates, capped at 12 months (AU financial year). Silent history: auto-emails only sent for the
   current calendar month; historical backfill bills are generated silently (no tenant spam on onboarding).
   See `docs/2026-07-23-rent-bill-generation-bounds.md` for full decision record.

2. **CHR-23 (multi-select bill type):** Additive strategy — `bill_types text[]` added alongside legacy
   `bill_type text`. All display code uses `bill_types || [bill_type]` fallback. Rent/non-rent discriminator
   (`bill_type !== 'rent'`) unchanged. `formatBillTypes(['electricity','gas'])` → `'Electricity + Gas'`.

3. **CHR-28 (Powered by Settleroo badge):** Removed entirely. The JTBD critique is correct — tenants
   aren't prospective landlords. The `branding_removable` pricing feature can be repurposed later.

4. **CHR-25 (overdue email copy):** The `send-bill-email` Edge Function now checks `due_date` against
   today. If overdue: red header, urgent subject, "OVERDUE" CTA. If upcoming: standard indigo treatment.

---

## What to pick up next session

### Strict order (per Linear backlog)

**Next ticket: CHR-22** — Merge tenant + rent-rate entry into one form.

This is a UI refactor: the current flow requires the landlord to (1) create a tenant, then (2) separately
add a rent rate. CHR-22 collapses these into a single form. The `rentAmount` and `rentFrequency` fields
already exist in `emptyTenant` and `handleTenantSubmit` — they're just not wired to `addRentRate` on
tenant creation. The fix is to call `addRentRate` inside `createTenant` when `rentAmountCents` is provided.

**After CHR-22: CHR-21** — Occupancy exceptions (tenant negotiates not paying for part of a period).
This requires a new `bill_adjustments` table or nullable columns on `bill_splits`. Needs a proposed
migration. Discuss the schema design with Chris before implementing — it touches money logic.

**After CHR-21: CHR-29** — Phase B (Operator plane). Large structural work. Discuss scope with Chris first.

---

## How to test the PRs locally

```bash
cd roomtab
npm start
# open http://localhost:3000
```

**CHR-20:** Go to a property → Rent tab. Bills should now generate from when the tenant's rate actually
started (not just the last 4 months). New tenants won't get spam emails for historical bills.

**CHR-26:** Go to a property → Utilities tab → click Send on a bill with no attachment. Should show a
confirmation dialog warning about the missing attachment. File size limit note visible near upload button.

**CHR-28:** Open a tenant bill link (e.g. from a sent email). The "Powered by Settleroo" footer badge
should be gone.

**CHR-27:** Go to `/terms`. Governing law clause should now say "the laws of Australia" (not Victoria-only).
Contact email should be updated.

**CHR-25:** Send a bill email for an overdue bill (due_date in the past). Check the received email —
should have red header and "OVERDUE" copy. Send for an upcoming bill — should have standard indigo treatment.

**CHR-23:** Go to a property → Utilities tab → Add Bill. Pill buttons should replace the dropdown.
Click multiple types (e.g. Electricity + Gas) — bill card should show "Electricity + Gas — $X.XX".
Select "Other utility" — description field should appear and be required.

---

## Guardrail reminders for next session

- **No migrations applied** — write to `PROPOSED_*.sql`, never run `supabase db push` or `supabase migration up`
- **No PRs merged** — open PRs only, let Chris merge
- **Strict ticket order** — CHR-22 next, then CHR-21, then CHR-29
- **No Supabase credentials** — no CLI access, no service role key
- **Money logic changes** — always ask Chris before touching bill amounts, splits, or payment status
