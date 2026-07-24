# 2026-07-23 — Rent Bill Auto-generation Bounds (CHR-20)

This document records the fix for CHR-20 (the rent-bill auto-generation logic looking back a hardcoded 4 months) and the product decisions made during its implementation.

## The Problem
Previously, `generateDueRentBillsInner` (`src/contexts/PropertyContext.js`) looked back exactly 4 calendar months (current + 3 prior) on every login. This meant a brand new account with a tenant who moved in today would still generate 3 months of empty/unbillable periods, and more importantly, an account older than 4 months would silently stop backfilling earlier data if the landlord hadn't logged in.

## The Solution
The auto-generation lower bound is now data-driven, anchored to the earliest `effective_from` date among all rent rates for a property's active tenants. 

**Design Decisions (Confirmed by Chris):**
1. **12-Month Lookback Cap:** To prevent pathological backfills (e.g. if a landlord accidentally enters a rate starting in 1970) and to align with the Australian financial year cycle, the lower bound is capped at 12 months ago.
2. **The "Silent History" Rule:** A hidden UX landmine existed where backfilling 12 months of history would instantly trigger 12 rent-due emails to the tenant. The auto-generation logic was modified to *only* send the auto-email for the **current calendar month**. All historical backfill periods are generated silently (they remain in `pending` status, but no email is sent).

## Implementation Details
- Extracted the pure logic into `src/lib/rentGeneration.js` (`earliestGenerationMonthForProperty` and `buildGenerationPeriods`) so it could be unit-tested without React or Supabase mocking.
- Wrote 15 new unit tests in `src/lib/rentGeneration.test.js` covering boundary conditions, leap years, missing rates, and the 12-month cap.
- Updated `generateDueRentBillsInner` to use these pure functions and enforce the "Silent History" email rule.

## What's Next
This fixes the core data generation issue without spamming tenants. A fast-follow UI ticket should be created to add a "Mark all past rent as Paid" bulk-action button to the Rent Bills tab, allowing onboarding landlords to easily settle the silently-generated historical bills.
