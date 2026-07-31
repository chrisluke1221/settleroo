# Phase Collection backlog reorganized in Linear

**Date:** 2026-07-31

## Decision

Chris confirmed the Linear backlog rebuild stays within **Rev 3's current Phase Collection scope** (`docs/2026-07-30-collection-first-pivot.md`) — CHR-21 (occupancy exceptions), the multi-property "who owes you" design pass, and the two Phase E candidates pulled forward (arrears autopilot, "explain my bill").

This deliberately does **not** pull in the two other P0 items from the 4-agent research's backlog (`docs/2026-07-24-settleroo-strategy-okrs-roadmap-backlog.md` §6): **pay-through** (Stripe/PayID tenant payments + reconciliation) and the **VCAT/tribunal evidence export**. Rev 3 — the roadmap doc that formally adopted the research findings — explicitly kept "payment rails / tenant money movement" as parked, not adopted into Phase Collection. Reopening that is a real scope decision (it's real money movement, touches the CLAUDE.md Stripe-only/ask-first guardrails) and wasn't made today — it stays a live option for a future, separately-scoped pass if pursued.

## What's now in Linear (team CHR, project Settleroo)

- **CHR-35** (Done) — pricing→login→checkout friction fix, logged retroactively for traceability (PR #43).
- **CHR-21** (Backlog, High priority) — Occupancy exceptions, updated with full BRD/PRD context and guardrails, broken into 4 sub-issues:
  - CHR-36 — migration design + apply (ask-first on schema change)
  - CHR-37 — landlord UI to record an adjustment
  - CHR-38 — `computeSplits` logic + split-sum-invariant tests
  - CHR-39 — tenant-facing transparency on the no-login bill view
- **CHR-40** (Backlog, Medium) — Multi-property "who owes you" scaling, a *design pass only* (no code), broken into 3 sub-issues:
  - CHR-43 — research where the current rollup breaks at scale
  - CHR-44 — propose 2-3 design options with tradeoffs
  - CHR-45 — Chris signs off before any implementation issue is created
- **CHR-41** (Backlog, Medium) — Arrears autopilot, BRD/PRD-level only (not yet broken into sub-issues — explicitly deferred until CHR-21/CHR-40 are further along, per the roadmap's own re-evaluation note).
- **CHR-42** (Backlog, Medium) — "Explain my bill" tenant assistant, same treatment as CHR-41.

## Why CHR-41/CHR-42 aren't broken into sub-issues yet

The roadmap (`docs/2026-07-19-settleroo-v2-roadmap.md`, Phase Collection section) explicitly says these two are *candidates to evaluate pulling forward* once CHR-21 and the multi-property design pass ship — not committed work yet. Writing detailed user stories for them now would imply a commitment that hasn't been made. They're scoped at BRD/PRD level with their guardrails stated so the eventual breakdown is fast, not because they're not thought through.

## Follow-up

Once CHR-21 and CHR-40 progress, re-evaluate CHR-41/CHR-42 and break them into user stories with acceptance criteria at that point, per the roadmap's guidance.
