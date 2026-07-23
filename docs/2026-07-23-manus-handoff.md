# Manus.ai handoff instructions

Chris is running low on Claude Code weekly usage and wants Manus.ai to keep development moving on Settleroo, with Claude Code resuming afterward. This document exists because two independent AI agents working on the same production codebase, sequentially or otherwise, can silently diverge on git state, database schema, or what's actually been decided — with no shared memory between them. Follow this precisely; it's what keeps that from happening.

**Read this document in full before writing any code.**

## Start here

1. Read `CLAUDE.md` (repo root) — product context, the hard guardrails, and working conventions. It is the entry point for every session on this repo, human or AI.
2. Skim the `docs/` folder, newest file first (sorted by the `YYYY-MM-DD-` prefix) — that's the real, current project history and the decisions behind it. This handoff doc is not a substitute for that history.
3. Then come back here for the rules specific to working alongside Claude Code.

## Source of truth for what to work on: Linear

The Settleroo project lives in Linear, team "CHRIS LU WORKSHOP," project "Settleroo." It is the single source of truth for what's done, what's in progress, and what's next — not this doc, not your own judgment about priority.

- **Always pick the single top-most unstarted ticket** in the list (`Todo` status before `Backlog` status, in the order they appear). Do not reorder, batch, or skip ahead based on your own judgment about what seems more valuable — Chris wants ticket order to be a reliable signal of "what's actually being worked on," which only holds if every agent follows it strictly.
- **Before starting, check whether any ticket is already `In Progress`.** That means Chris or Claude Code is already on it — skip it and move to the next `Todo`/`Backlog` ticket instead of duplicating or colliding with that work.
- **Move the ticket to `In Progress` before you start writing code.**
- **Do not move a ticket to `Done` yourself.** Leave it `In Progress` (or add a comment saying the PR is ready) once your PR is open — it only becomes `Done` once Chris has actually merged it. Moving it to `Done` prematurely would tell Claude Code or Chris that live code exists when it's actually just a pending PR.

## Working conventions — mirror these exactly

These are already established this session and Claude Code will expect them to still hold when it resumes:

- **One git branch per ticket, off the latest `main`.** Pull `main` fresh before branching — don't build on a stale local copy.
- **Before opening a PR**, both of these must be green:
  - `CI=true npx react-scripts test`
  - `CI=true npm run build`
- **Verify UI changes live** where you can (a dev server + browser, or equivalent) before calling something done. Don't rely on "it compiled" as proof it works.
- **Any new requirement, feature decision, or scope change gets its own dated `docs/YYYY-MM-DD-*.md` file, added in the same PR that implements it.** This is how Claude Code will catch up on what you did without any shared conversation history — write it as if explaining the decision to someone who wasn't in the room, because that's exactly what's happening.
- **Any new UI pattern gets added to `docs/design-system.md`** rather than inventing an undocumented one-off. If you're building something that doesn't fit an existing pattern in that doc, add the new pattern to the doc in the same PR.
- Doc naming: `YYYY-MM-DD-descriptive-name.md` in `docs/`, matching the existing files there.

## Guardrails — copied verbatim from `CLAUDE.md`, non-negotiable regardless of which agent is coding

The product's trust story is **"AI at the edges, deterministic math in the middle."**

**NEVER**
- Let any AI / LLM / edge-function path **compute or write a bill split**, or mutate money state (amounts, splits, balances). The deterministic engine is the sole splitter.
- Ship MCP **write** tools (read-only only, until usage justifies otherwise).
- Write a **guessed** number into a money field. Low-confidence extraction → leave the field blank and flag it.
- Hand-roll billing — Stripe only.
- Modify a bill's split after it's been sent to a tenant (reissue explicitly instead).

**ASK FIRST**
- Any bill status transition to `sent` / `confirmed` (needs explicit human confirm).
- Schema/migration changes to `plans`, `subscriptions`, `bill_splits`, or money tables.
- Anything that emails a real tenant.

**ALWAYS**
- Route entitlement checks through the single `check_entitlement(key)` RPC.
- Write to `bill_events` on issue/send/view/claim/confirm/reissue.
- Show extraction confidence in the UI.
- Keep the `split-sum-invariant` at exactly zero.
- Enforce account isolation via row-level security; verify with a two-account isolation test.

## This session's autonomy boundaries (Chris's explicit decisions — not a default, don't assume more access than this)

- **Migrations: propose only, never apply.** If a ticket needs a database change, write the `.sql` file under `supabase/migrations/` following the existing naming/style convention, but **do not run it against production** — you should not have Supabase production credentials at all. Put a clear note at the top of the migration file and in the PR description: `MIGRATION NOT YET APPLIED — needs Chris or Claude Code to run this against the linked Supabase project.`
- **PRs: open, don't merge.** Do the work, get tests/build green, open the PR with a clear summary — then stop. Do not merge it yourself even if everything is green. You should not have merge or admin rights on the repo.
- **Ticket order: strict, not judgment-based.** Covered above — repeating because it's the easiest rule to accidentally break with good intentions ("this other ticket seemed quicker/more valuable").

## End-of-session hygiene

- **Always push your current branch before stopping — even mid-task, even if it doesn't build yet.** Never leave uncommitted local changes stranded where nobody else can see them. If you're not done, push what you have and leave a clear note in the PR (or as a draft PR) about what's left.
- **Leave the Linear ticket status accurate** to whatever state the work is actually in — don't leave it looking further along than it is.

## Explicitly out of scope — do not do these

- Rewriting git history (`rebase -i`, `commit --amend` on pushed commits, etc.)
- Force-pushing
- Deleting branches
- Touching any Linear team or project other than Settleroo
- Applying Supabase migrations to production
- Merging your own (or anyone else's) PRs
- Skipping the `docs/` write-up for a decision because it "seems minor" — let Chris or Claude Code judge that, not you

## If something is unclear

Don't guess on anything touching money, tenant data, or the guardrails above. Leave a clear question in the PR description or as a Linear comment on the ticket, and stop there rather than proceeding on an assumption.
