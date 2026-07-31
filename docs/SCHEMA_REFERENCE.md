# Schema reference — the single source of truth for the real current schema

This doc exists because there was no single place to check a table's actual
column names before writing new SQL against it — every agent (Manus, Claude
Code, anyone) had to reconstruct it from ~20 scattered migration files, and
that reconstruction has been wrong more than once (see
`docs/2026-07-29-phase-b-migration-fixes.md` and
`docs/DEFINITION_OF_DONE.md`).

**Rule: before writing any SQL that references an existing table, check it
against this doc first.** If a table or column you need isn't listed here,
grep `supabase/migrations/*.sql` for its real definition — never assume or
pattern-match a name from convention or memory.

**Any migration that changes a table's shape must update this doc in the
same PR.** This doc reflects columns actually applied to production, not
what's proposed in an unapplied `PROPOSED_*.sql` file.

All money columns are `numeric` **dollars**, not integer cents, unless the
column name explicitly ends in `_cents` (those are the only integer-cents
columns in the schema: `rent_rates.amount_cents`, `plans.price_cents_monthly`,
`plans.price_cents_yearly`).

---

## `public.properties`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `address` | text | |
| `description` | text | nullable |
| `landlord_id` | uuid | → `auth.users(id)` |
| `created_at` / `updated_at` | timestamptz | |

## `public.tenants`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | nullable, unused today |
| `name` | text | |
| `email` | text | nullable |
| `phone` | text | nullable |
| `room` | text | |
| `move_in_date` | date | |
| `move_out_date` | date | nullable — does **not** auto-close an open `rent_rates` row; that's handled separately in `updateTenant` |
| `current_balance` | numeric(10,2) | legacy, not the source of truth for balances (that's derived from `bill_splits`) |
| `payment_status` | text | legacy, check `('paid','pending','overdue')` — not the same as `bill_splits.status` |
| `number_of_occupants` | integer | > 0 |
| `status` | text | `default 'active'`, used for archival (`'former'` etc.) instead of hard delete |
| `fixed_term_end` | date | nullable |
| `landlord_id` | uuid | → `auth.users(id)` |
| `property_id` | uuid | → `properties(id)` |
| `created_at` / `updated_at` | timestamptz | |

## `public.bills`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bill_type` | text | `'rent'`, or a utility type (`electricity`/`water`/`gas`/`internet`/`other`) |
| `total_amount` | numeric | **dollars.** For a utility bill, the landlord-entered total; for a rent bill, the sum of all per-tenant charges. `sum(bill_splits.owed_amount - carried_over_amount)` for this bill must equal this value (the split-sum invariant) |
| `billing_period_start` / `billing_period_end` | date | |
| `property_id` | uuid | → `properties(id)` |
| `due_date` | date | nullable |
| `status` | text | `check ('draft','issued','settled')`, default `'issued'` — in practice bills are always created `'issued'`, `'draft'` is not currently used by any app code path |
| `description` | text | nullable, only populated when `bill_type = 'other'` |
| `attachment_path` / `attachment_name` / `attachment_type` | text | nullable |
| `locked_at` | timestamptz | nullable — set on first send for a utility bill; blocks silent recompute |
| `needs_reissue` | boolean | default false |
| `landlord_id` | uuid | → `auth.users(id)` |
| `created_at` / `updated_at` | timestamptz | |

## `public.bill_splits`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bill_id` | uuid | → `bills(id)` |
| `tenant_id` | uuid | → `tenants(id)` |
| `tenant_name`, `room`, `number_of_occupants` | text/int | snapshotted at split-creation time |
| `occupancy_days`, `person_days`, `percentage` | numeric | `person_days` means headcount, not days, for a flat-split bill (internet) — see `computeFlatSplitByHeadcount` |
| `owed_amount` | numeric | **dollars.** Includes any `carried_over_amount` added on top of this bill's own base share |
| `occupancy_start` / `occupancy_end` | date | |
| `landlord_id` | uuid | → `auth.users(id)` |
| `created_at` | timestamptz | |
| `access_token` | **uuid**, not text | `default gen_random_uuid()`, unique — the tenant's no-login link token. **Not named `token`.** |
| `status` | text | `check ('pending','viewed','paid')` — `'overdue'`, `'partial'`, `'carried_forward'` are all **derived**, never stored (see `src/lib/paymentStatus.js`) |
| `viewed_at` / `paid_at` | timestamptz | nullable |
| `email_sent_at` | timestamptz | nullable |
| `expires_at` | timestamptz | default `now() + 90 days` |
| `rate_breakdown` | jsonb | rent splits only — array of `{rateId, amountCents, frequency, from, to, days, cents}` segments |
| `last_reminder_at` | timestamptz | nullable |
| `amount_paid` | numeric | **dollars**, default 0 — cumulative amount actually paid, landlord-recorded |
| `carried_over_amount` | numeric | **dollars**, default 0 — how much of `owed_amount` came from an earlier unresolved utility bill |
| `carried_forward_into_split_id` | uuid | nullable, self-referencing FK → `bill_splits(id)` — set on a *source* split once its remainder has moved to a newer split; metadata only, never changes `owed_amount` on the source |

## `public.bill_split_exceptions` (CHR-21 / CHR-36)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bill_id` | uuid | → `bills(id)` |
| `tenant_id` | uuid | → `tenants(id)` |
| `exception_start` / `exception_end` | date | the negotiated absence sub-period; `exception_end >= exception_start` enforced |
| `reason` | text | nullable, landlord's note |
| `landlord_id` | uuid | → `auth.users(id)` |
| `created_at` | timestamptz | |
| Trigger | | `bill_split_exceptions_block_after_lock` rejects insert if the referenced `bills.locked_at` is already set — an exception can only be added before a bill is sent, same as every other post-send split guardrail |

## `public.rent_rates`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid | → `tenants(id)` |
| `landlord_id` | uuid | → `auth.users(id)` |
| `amount_cents` | **integer** | one of the only real cents columns in the schema |
| `frequency` | text | `check ('weekly','fortnightly','monthly')` |
| `effective_from` | date | |
| `effective_to` | date | nullable = open-ended/current rate |
| `effective_range` | daterange | generated column, used by the exclusion constraint |
| `created_at` | timestamptz | |
| Exclusion constraint | | no two rates for the same tenant may have overlapping `effective_range` |

## `public.landlord_settings`
| Column | Type | Notes |
|---|---|---|
| `landlord_id` | uuid PK | → `auth.users(id)` |
| `notify_overdue` | boolean | default true |
| `notify_rent` | boolean | default true |
| `updated_at` | timestamptz | |

## `public.plans`
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `'free'`, `'pro'`, `'beta'` |
| `price_cents_monthly` / `price_cents_yearly` | **integer** | real cents columns |
| `price_unit` | text | `check ('flat','per_property')` |
| `limits` | jsonb | e.g. `max_bills_per_month` (currently `null` = unlimited on all plans) |
| `stripe_price_id_monthly` | text | nullable — Stripe Price ID for monthly billing. Null = plan not available via Checkout. Set by operator, never by app code. |
| `stripe_price_id_yearly` | text | nullable — Stripe Price ID for yearly billing. |
| (name, sort_order, is_public, etc.) | | see `20260719090000_plans_and_entitlements.sql` for the full original list |

## `public.subscriptions`
| Column | Type | Notes |
|---|---|---|
| `account_id` | uuid PK | → `auth.users(id)` — one row per account |
| `plan_id` | text | → `plans(id)` |
| `status` | text | `check ('active','trialing','past_due','canceled')` |
| `period` | text | `check ('monthly','yearly')` |
| `current_period_end` | timestamptz | nullable |
| `source` | text | `check ('manual','stripe')` |
| `stripe_customer_id` / `stripe_subscription_id` | text | nullable |
| `created_at` / `updated_at` | timestamptz | |

## `public.entitlement_overrides`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid | → `auth.users(id)` |
| `key` | text | |
| `value` | jsonb | |
| `granted_by` | uuid | nullable → `auth.users(id)` |
| `expires_at` | timestamptz | nullable |
| `created_at` | timestamptz | |
| Unique | | `(account_id, key)` |

## `public.bill_events` (Phase B / CHR-29)
Append-only, no UPDATE/DELETE. `id`, `bill_id` (→ `bills`), `event_type`
(`check` list — see migration), `actor_type` (`'landlord'|'tenant'|'operator'|'system'`),
`actor_id` (nullable uuid), `actor_token` (nullable text), `payload` (jsonb),
`created_at`.

## `public.operator_audit_log` (Phase B / CHR-29)
`id`, `operator_id` (→ `auth.users`), `action` (text), `target_account`
(nullable → `auth.users`), `target_object` (nullable text, e.g. `'bill:uuid'`),
`metadata` (jsonb), `created_at`.

## Access model notes
- The operator claim lives in `auth.users.raw_app_meta_data->'operator'`
  (boolean), settable only via the service role — never through app code.
- `private.assert_operator()` is the gate every operator RPC calls first;
  the `private` schema is not exposed to any client role.
- `auth.users.email` is the real landlord email — `raw_user_meta_data->>'full_name'`
  is only a display name, don't use it as a contact address.

## RPC signatures worth knowing before writing a new one
- `revoke_bill_split_token(p_split_id uuid) returns uuid` — the canonical
  pattern for rotating `access_token`: `gen_random_uuid()`, never
  `encode(gen_random_bytes(...), 'base64url')`.
- `get_bill_split_by_token(p_token uuid) returns table (...)` — the
  tenant-facing token lookup; touched by nearly every feature that changes
  `bill_splits`' shape. `CREATE OR REPLACE` requires `DROP FUNCTION` first
  whenever the return signature changes (Postgres won't let you alter an
  existing function's return columns in place).
- `check_entitlement(p_key text) returns jsonb` — the single entitlement-check
  RPC, reads `auth.uid()` itself (no account_id param) — every create action
  routes through it, per `CLAUDE.md`'s guardrails.
