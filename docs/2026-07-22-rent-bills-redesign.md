# 2026-07-22 — Rent Bills legibility redesign

Chris's original UAT (15-point list, see `docs/2026-07-22-bill-transparency-and-roadmap.md`) flagged the Rent Bills section as confusing: unclear copy, no explanation of why rent has no shared split, and a wall of unexplained bill history reaching back further than expected. This round addresses the UI/legibility symptoms; a related but distinct logic issue is flagged below for its own follow-up.

## What shipped

- **Copy rewrite** (`src/pages/PropertyDetail.js`, Rent section): the backfill-button description, the auto-generation mechanism description, and the "no shared split" line were all rewritten in plain English, explaining *what* and *why* instead of just stating a rule.
- **Billing period made visually distinct**: promoted from muted `text-secondary-500` to `font-semibold text-secondary-900` in the shared `renderBillSplits` (used by both Rent and Utilities), so it doesn't read at the same visual weight as the due-date line below it.
- **Effective-date annotation**: a plain-English caption added under the Rent section heading explaining what a rate's "effective from" date means.
- **Default-collapsed rent bill history + year filter**: the Rent Bills list now shows only the two most recent bills by default, with a "Show older bills (N)" toggle and a year filter (reusing the exact `<select className="input-field text-sm py-1.5">` pattern from `Dashboard.js`) — addresses the "wall of history" symptom without any schema change.
- **Tenants / Rent / Utilities tabs**: replaced the single long scroll with tabs, built via conditional rendering (no sub-component split — lowest risk, all existing handlers/state untouched). Deep-linkable via `?tab=rent` etc., following the same `useSearchParams` pattern `Properties.js` already uses for `?new=1`. New tab-nav visual spec documented in `docs/design-system.md` since none existed before.

## Explicitly flagged, not fixed this round — Chris's own words

The root cause of "bills going back to April" is `generateDueRentBillsInner` (`src/contexts/PropertyContext.js`) hardcoding exactly 4 calendar months (current + 3 prior) on *every* login, regardless of account age or when tenant/rate data was actually entered. Chris's direction: *"it should only base on whatever enters or retrieves"* — i.e. driven by actual stored data, not a blind constant. This round only changes how existing history is *displayed* (collapsed by default); it doesn't change what gets generated. Needs its own design pass: what should the real bound be (earliest active rate's `effective_from`? property creation date? something else?) — a genuine product decision, not just an engineering one.

## Where this leaves the roadmap

Per `docs/2026-07-22-bill-transparency-and-roadmap.md`'s suggested order (Rent Bills redesign → occupancy exceptions → resume Phase B), this item is now done for its UI scope. Next up, in order: fix the rent-bill auto-generation logic (above), then occupancy exceptions (tenant negotiates not paying for part of a bill period — needs a new migration, deferred earlier), then resume Phase B (operator plane).
