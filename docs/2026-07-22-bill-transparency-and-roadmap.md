# 2026-07-22 — Bill breakdown transparency redesign, design system, and current roadmap

This doc exists because decisions made in a Claude Code session were previously only tracked in that session's ephemeral local plan file, not in the repo. Going forward (see the new bullet in `CLAUDE.md`'s "Working conventions"), any new requirement, feature decision, or scope change gets written here (or a new dated doc) in the same PR that implements it.

## What shipped this round

### Design system (`docs/design-system.md`)
First written design reference for this repo — colors, typography, icon sizing, spacing, and component primitives already implicit in `tailwind.config.js`/`src/index.css`, plus a new documented pattern (the inline-edit-field-chip spec) and a design review checklist. Piloted by rebuilding the due-date editor in `PropertyDetail.js`, which had shipped without following any of these conventions and looked cramped as a result.

### Bill breakdown transparency redesign
Chris's UAT (hero mockup + `/demo-bill`) surfaced two things:

1. The hero mockup's rounded `33.33%` sitting next to an exact `$40.00` read as "doesn't add up" even though the math was always correct ($120 total, 30÷90 exactly). Fixed by adding an explicit "Example" tag to the hero card and dropping the invented "tenant-days" unit name from its copy.
2. The detailed breakdown's aggregate-only numbers ("total tenant-days: 96", "other tenants' tenant-days: 66") didn't explain a mixed-occupancy bill (e.g. one tenant moved in mid-period) — a landlord-facing shared house isn't individually metered, so Chris decided tenants on the same bill should see each other's occupancy days and % share by name, not just an opaque combined figure.

**Deliberate privacy-policy change** (Chris's explicit call, not a default): a tenant's link now shows every tenant's occupancy days/% for that *specific bill* — never another tenant's contact details, other bills, or balance. The three places that previously promised "never see another tenant's info" (`Pricing.js` FAQ, `Privacy.js`, `Home.js`'s "Private by Design" card) were rewritten to state the new, accurate scope precisely, not just softened.

Also dropped the invented "tenant-days" unit name everywhere (`TenantBillView.js`, `DemoBill.js`, `Home.js`'s hero mockup) in favor of plain arithmetic sentences, and added a "Something look wrong? Email {landlord}" mailto link on the tenant bill view as a lightweight dispute escape hatch — no new schema, just making the existing "landlord handles it directly" model reachable from the tenant page. Needed the RPC (`get_bill_split_by_token`) to additionally return the landlord's real email (previously only a display-name fallback) and a `peer_splits` array with every tenant's occupancy on the same bill — migration `supabase/migrations/20260722100000_tenant_bill_peer_breakdown.sql`.

## Explicitly deferred (own future phase, not yet scoped in detail)

- **Occupancy exceptions** — a tenant negotiates not to pay for part of a bill period (e.g. a 3-week holiday absence). No existing column can carry this; needs a new migration (a new adjustments table, or nullable columns on `bill_splits`), read as an extra input to `computeSplits` (`src/lib/billSplit.js`), gated by the same paid-split/reissue guards `recalculateBill`/`updateBill` already enforce. Logging it to `bill_events` once that table exists (Phase B1 — confirmed not yet built despite being referenced in `CLAUDE.md`'s guardrails).
- **Rent Bills section redesign** — the "why does this section exist" confusion, backfill/history handling, tabs vs. one long scroll, effective-date annotations. Queued from an earlier UAT round, still pending, now with a written design system to build it against.

## Where this leaves the original roadmap

Phase A (monetization) and the rebrand are merged and live. Phase B (operator plane) is still the next big structural phase per `docs/2026-07-19-settleroo-v2-roadmap.md`, but has been paused this whole session while UAT feedback and trust/transparency fixes took priority — reasonable given a solo founder actively user-testing the live product. Suggested next order once the two deferred items above are scoped: Rent Bills redesign → occupancy exceptions → resume Phase B.
