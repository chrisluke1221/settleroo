# Multi-property "who owes you" scaling — design decision

**Date:** 2026-07-31

## Context

CHR-40 flagged that the current Dashboard "who owes you" rollup has no real design for scale (10 properties / 30+ tenants) — a design pass was required before any implementation, per `docs/DEFINITION_OF_DONE.md`'s "design first for open-ended scope" rule.

## Findings (CHR-43)

- `Dashboard.js`'s "Who owes you" section silently caps at the top 10 tenant balances (`tenantBalances.slice(0, 10)`) — no "view all," no indication anything is hidden.
- The "Needs attention" work queue caps at 30 items but already has property/type filters.
- `Properties.js` has no financial rollup at all — no per-property outstanding total.
- `PropertyContext` loads all account data unbounded (no pagination) — not urgent today, but a real constraint at higher scale.

## Options considered (CHR-44)

- **A — remove the silent cutoffs**: cheapest, fixes the two concrete gaps, but stays a flat mixed list once expanded.
- **B — flat severity-sorted cross-property arrears list**: most scalable, ranks by collection urgency (days overdue × amount) not raw dollar amount, matches the research's collection-first framing, needs a severity formula decided.
- **C — per-property grouped view**: preserves the property-centric mental model but doesn't answer "who owes the most across everything" directly.

## Decision

**Chris chose Option B.** The severity formula: `maxDaysOverdue × totalOwedCents` per tenant (worst overdue-days across their outstanding splits, times total owed), sorted descending, tie-broken by amount. This intentionally ranks a smaller-but-older debt above a larger-but-not-yet-due one — collection urgency over raw dollar size, consistent with the research's "get the money in" framing (`docs/2026-07-24-settleroo-strategy-okrs-roadmap-backlog.md`, Pillar 1).

The split-sum-invariant check stays operator-only (Phase B) — not surfaced to landlords in this view, since it's an internal correctness check, not something a landlord can act on.

## Implementation

Tracked as CHR-46 under CHR-40 in Linear.
