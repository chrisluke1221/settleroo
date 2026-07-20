# RoomieTab v2 Roadmap — Karpathy 3-Layer Review

> *Historical document, written before the 2026-07-20 rename to Settleroo — "RoomieTab" reflects the product name at the time.*

**Reviewed:** 2026-07-19 · **Doc under review:** `2026-07-17-roomietab-v2-roadmap.md` · **Lens:** Karpathy Spec / Verifier / Environment
**Verdict:** B+ / A−. Above the median PRD by a distance. Two real gaps hold it back from an A, and they happen to be the two highest-leverage things to fix before dev.

---

## Scorecard (the 5-point bar)

| # | Standard | Grade | One-line |
|---|---|---|---|
| 1 | Goal, not just task | **Partial** | Capability goals per phase, but no business outcome the roadmap serves |
| 2 | Success criteria (measurable) | **Weak** ← biggest gap | Almost no targets; "proves demand" is undefined |
| 3 | Constraints & do-nots | **Strong** | USP guardrail + explicit parking lot + "never hand-roll billing" |
| 4 | Chunking (agile, not waterfall) | **Strong** (model example) | A–E, each its own branch/PR, checkpoints |
| 5 | Verification | **Partial** | Technical verification is real; outcome + AI verification are thin |

Net: you've nailed the *structure* layers (constraints, chunking) and under-built the *measurement* layers (outcomes, verification). That's a common and fixable shape.

---

## Layer 1 — Spec: what & why

**What's already good (keep doing):** the living-document discipline is textbook Karpathy — "read this file first," explicit supersession of the v1.5 PRD, a founder-decisions log with dates. The USP guardrail ("AI at the edges, deterministic math in the middle") is the single best line in the doc: it's a constraint, a positioning statement, and a test spec in one sentence.

**Gap 1 — no outcome goal / North Star.** Every phase states a *capability* goal ("a stranger can hit a limit and be flipped to Pro") but the roadmap never says what business decision it exists to answer. Karpathy's first rule is to separate the task from the decision underneath it. Right now a reader can't tell whether success is "20 paying customers," "validate willingness-to-pay," or "get to ramen-profitable."

> **Before** (Phase A): *Goal: a stranger can hit a limit, see why, and be flipped to Pro.*
>
> **After** — add a roadmap-level North Star, then give each phase an outcome metric:
> *Roadmap North Star: reach **20 paying Pro landlords (~A$380 MRR)** by [date], with free→Pro conversion **≥5%** and week-4 activation **≥40%**. This roadmap exists to answer one decision: **does willingness-to-pay for AI-assisted landlording clear the bar to justify [going full-time / continuing the build]?***
> *Phase A outcome: ≥30% of new free signups hit a limit within 14 days (the cap is biting); ≥8% of those view /pricing.*

**Gap 2 — "who is the user / why they pay" is asserted, not evidenced.** The doc bets the whole AI strategy on "AI becomes the strongest why-pay." That may be right, but it's an unlabelled assumption load-bearing for Phases D–E. Spec discipline means naming it as a hypothesis with the cheapest possible test.

> **Add an "Assumptions & tests" block:**
> *A1 (load-bearing): landlords pay A$19/mo primarily for AI ingestion, not for unlimited properties. Cheapest test — before any AI ships, watch Phase A/B data: do free users convert on the 1-property cap alone? If yes, AI is an expansion/retention play, not the acquisition wedge — which lowers the urgency of D and changes the marketing story.*

Cost of skipping this: you could build all of D–E and discover the real "why pay" was unlimited properties the whole time.

---

## Layer 2 — Verifier: how you'll know it's right

**What's already good:** a per-phase Verification section at all puts you ahead of 90% of PRDs. "split-sum-invariant violations (must be zero)" is a real ground-truth invariant. Phase D's "connect Claude Desktop, query balances, verify they match the dashboard exactly, revoke token → access dies" is exactly the "pull external signal" Karpathy asks for.

**Gap 3 — the AI-extraction verifier is missing, and it's the highest-leverage hole in the doc.** Your entire USP is *"ChatGPT guesses; RoomieTab proves."* Yet R7 ingestion has no accuracy bar, no eval set, no confidence threshold gating auto-draft vs. human-required, and no critic. "Confidence shown" is display, not a gate. For a trust product, this is where the framework earns its keep.

> **Add to Phase D (R7):**
> - **Eval set:** ≥50 labelled real bills, varied by type (power/water/gas/internet) and format (PDF, phone photo, forwarded email body), each with known-correct `{vendor, total, due_date, line_items}`.
> - **Accuracy AC:** field-level extraction ≥95% on `total` and `due_date`. Below that on any field → that field is **blanked and flagged low-confidence, never guessed**. (This is literally how you operationalize "AI at the edges.")
> - **Confidence gating:** below threshold T on `total` → draft is created with the total left empty + "couldn't read — enter manually." A guessed number is never written to a money field.
> - **CI regression:** the eval set runs on every model/prompt change; a change that drops accuracy fails the build. This turns "trust us" into an enforced signal.
> - **Optional critic (Karpathy's second-model check):** a cheaper model re-extracts `total` independently; disagreement forces low-confidence. Cheap insurance on the one number that must never be wrong.

**Gap 4 — success = "works," not "succeeds."** The Phase D→E gate says "sequenced after D proves demand," but "proves demand" is never defined, so it can't actually fire. Un-fireable gates get skipped under pressure.

> **Before:** *Phase E (sequenced after D proves demand).*
>
> **After:** *Gate D→E: ≥40% of Pro landlords use email-in ingestion ≥2× in month one AND draft-accept rate (drafts confirmed with no edit) ≥70%. Below either line → fix D before building E.*

---

## Layer 3 — Environment: the persistent workshop

**What's already good:** the doc *is* environment thinking — canonical, self-locating, supersession-aware. That's the spec-as-living-document behaviour Karpathy wants.

**Gap 5 — the USP guardrail is a principle, not an enforced boundary.** "AI never mutates money state" is your trust story, and right now it lives in prose. Karpathy is explicit: hard guardrails belong at the tool level, not the prompt level. A sentence in a roadmap doesn't stop a future session (human or AI) from wiring an AI path to a money table.

> **Refinement — make it a test + RLS + a CLAUDE.md guardrail, not a sentence:**
> - The edge-function/service role used for ingestion has **no write grant** to split/amount tables; a test asserts the ingestion path only ever `INSERT`s a `status='draft'` row with non-authoritative amounts until a human confirm.
> - Encode the guardrail in the repo's `CLAUDE.md` as **Always / Ask first / Never**:
>   - **Never:** AI computes or writes a split; AI mutates money state; MCP write tools (until read-only shows usage).
>   - **Ask first:** any bill status transition to `sent`/`confirmed`.
>   - **Always:** write to `bill_events`; show confidence; keep the deterministic engine as the sole splitter.
> - Promote O4's "split-sum-invariant violations (must be zero)" from a tile-you-eyeball to a **hard alert** that pages you.

If you do one Environment thing: turn the USP one-liner into a failing test. That's what makes the promise defensible instead of aspirational.

---

## Punch-list before dev (ranked by leverage)

1. **Add the roadmap North Star + per-phase outcome targets.** ~30 min, unblocks every "is this working" question. (Gap 1)
2. **Define the D→E "proves demand" gate numerically.** One sentence, saves a quarter of misdirected build. (Gap 4)
3. **Spec the AI extraction verifier** — eval set + accuracy AC + confidence gating + CI regression. The USP is only real if this exists. (Gap 3)
4. **Convert the USP guardrail from prose → test + RLS + CLAUDE.md Always/Ask/Never.** (Gap 5)
5. **Add the Assumptions block with cheapest tests.** (Gap 2)

Items 1, 2, 5 are writing (an hour total). Items 3, 4 are the ones that make the AI product trustworthy — do them when Phase D actually starts, not now.

---

## Where you already beat the framework (don't lose these)

Living-doc supersession with dated decisions · phases chunked into independent PRs · a real per-phase verification section · the USP compressed to one defensible sentence · an explicit parking lot. Most PRDs have none of these.

---

## My POV / pushback (including on Karpathy applied here)

The framework can be over-applied to a solo pre-PMF product. **Don't build the 50-bill eval set now** — build it the week Phase D starts. Karpathy's "agile speccing" cuts both ways: spec the *current* phase's verifier airtight, and keep later phases as labelled hypotheses, not fully-armoured plans. Your doc already leans this way; the fix is not "spec everything harder," it's "make the outcome measurable and make the AI phase's verifier real — later, when you build it."

The reason this makes the eventual build 10–50× better isn't the prose. It's that Gaps 1–4 are exactly what convert "build features and hope" into "build → measure → gate." Without them you can ship all of B–E flawlessly and still not know whether RoomieTab is a business. With them, every phase either earns the next or kills it early — which is the whole point of specifying instead of prompting.

---

## AI lens (per pm-brain protocol)

The irony worth internalizing: this is an AI product whose *own spec* under-specified its AI verification. The general lesson for AI-era PRDs — the deterministic parts get careful acceptance criteria out of habit, while the probabilistic parts (extraction, drafting, "ask your books") get a vibe and a confidence badge. Flip that instinct: **the AI surface needs the strictest, most measurable verifier in the doc, because it's the only part that can be confidently wrong.**
