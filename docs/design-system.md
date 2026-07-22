# Settleroo — Design System

A written reference for the visual conventions already in use across the app, plus the standing checklist to run new UI against before shipping. This exists because the inline due-date editor (added 2026-07-21) skipped every one of these patterns and shipped looking cramped and unintentional — this doc is the fix for that class of problem, not just that one instance.

This is a **codification of what's already in `tailwind.config.js` and `src/index.css`**, not a redesign. If a new screen needs something not covered here, extend this doc in the same PR that adds it — don't let a second undocumented pattern accumulate.

## Color tokens

Defined in `tailwind.config.js`:

- **`primary`** (deep teal, 50–900) — brand color, all primary actions and links.
- **`secondary`** (warm neutral, 50–900) — the only text/background/border scale. Never use Tailwind's stock `slate`/`gray`.
- **`success` / `warning` / `danger`** (50, 100, 600, 700 only — no full scale) — reserved exclusively for payment/status states (paid, overdue, viewed, errors). Never used decoratively for anything else — don't reach for `success-600` to make a button "feel positive," it's for actual paid/settled state only.

## Text color ladder

Reverse-engineered from actual usage across the app — every new screen's text colors should map onto this, not pick an arbitrary shade:

| Token | Use |
|---|---|
| `text-secondary-900` | Primary content — headings, names, the main value in a row (e.g. a money amount's label) |
| `text-secondary-700` | Body/supporting copy — denser paragraph text, `.btn-secondary`'s label color |
| `text-secondary-600` | Loading/empty-state copy, "supporting sentence" text, moderately-emphasized icon tint |
| `text-secondary-500` | Meta/eyebrow text — sub-labels under a heading, uppercase section labels, "of total bill"-style annotations |
| `text-secondary-400` | Muted/divider text — "or" dividers, decorative chevrons, small inline connector text (`· PropertyName`) |
| `text-secondary-300` | Idle icon-button state before hover (`text-secondary-300 hover:text-primary-600`), empty-state large decorative icons |

## Typography scale

| Element | Class |
|---|---|
| Page `<h1>` | `text-3xl font-bold text-secondary-900` (marketing hero scales to `text-4xl md:text-5xl`) |
| Section `<h2>` | `text-2xl`–`text-3xl font-bold text-secondary-900` |
| Card/subsection `<h3>` | `text-lg font-semibold text-secondary-900` (or `text-base font-semibold` for a tighter sub-heading) |
| Eyebrow / overline label | `text-xs` or `text-sm font-semibold text-secondary-500 uppercase tracking-wide` |
| Body copy | `text-sm` — this app's default. Tailwind's stock `text-base` is essentially unused; don't introduce it. |
| Caption / meta / timestamp | `text-xs` |

Font weight: `font-bold` for headings only, `font-semibold` for card titles/labels/status text, `font-medium` for buttons/links/inline emphasis. No `font-light`.

## Icon sizing

| Size | Use |
|---|---|
| `w-3 h-3` | Tiny disclosure chevrons only (expand/collapse toggles) |
| `w-4 h-4` | **Default.** Anything inline with text or inside a button — the workhorse size |
| `w-5 h-5` | A bit more emphasis — form-field leading icons, list-row leading icons |
| `w-8 h-8` and up | Standalone/decorative only — avatar circles, empty-state hero icons, marketing icon circles. **Never an inline action icon.** |

## Spacing

- **Icon/button clusters**: `space-x-2` or `space-x-3`.
- **Stacked sections**: `space-y-3` or `space-y-4`.
- **Grids**: `gap-4`.
- **In-component rhythm**: `mb-1` / `mb-2` / `mb-4` for tight vertical spacing within one component; reserve `mb-6`+ for separating distinct sections.
- **Corner radius**: `rounded-lg` is the default everywhere (buttons, inputs, small containers). `rounded-xl` is reserved for `.card` only. `rounded-full` is reserved for pills/badges/avatars/spinners.

## Component primitives — reuse these, don't reinvent them

Defined in `src/index.css` `@layer components`:

```css
.btn-primary   /* bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg */
.btn-secondary /* bg-secondary-100 hover:bg-secondary-200 text-secondary-700 font-medium py-2 px-4 rounded-lg */
.card          /* bg-white rounded-xl shadow-sm border border-secondary-200 p-6 */
.input-field   /* w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 */
```

Compact variants of the two button classes exist for dense contexts (e.g. the rent-rate edit form in `PropertyDetail.js`): `btn-primary text-xs px-3 py-1` / `btn-secondary text-xs px-3 py-1`. Use these instead of shrinking `.input-field` or inventing a new size.

**Third button variant (unwritten until now, but already consistent in practice): the text-link action.** Used for Save/Edit/Cancel-style actions that shouldn't have full button chrome:
- Affirmative (Save, Edit): `text-primary-600 hover:text-primary-700 font-medium`
- Neutral/dismissive (Cancel): `text-secondary-400 hover:text-secondary-600`

**Destructive actions** are never a filled red button — they're an idle→hover icon: `text-secondary-300 hover:text-danger-600` (or `text-secondary-400 hover:text-danger-600` for a slightly more visible starting state). There is no `.btn-danger`; don't add one without a real reason.

**`StatusBadge`** (`src/components/StatusBadge.js`) is the one badge spec — pill shape, `inline-block px-2 py-0.5 rounded-full text-xs font-medium`, colors from the centralized `STATUS_STYLES` map in `src/lib/paymentStatus.js` (`bg-{color}-100 text-{color}-700`, except neutral/pending which is `bg-secondary-100 text-secondary-600`). Any new status pill should extend that map, not create a new badge component.

**`Money`** (`src/components/Money.js`) is the one number-formatting authority — every dollar amount renders through it (`tabular-nums font-semibold`). Never hand-format a money value with `toFixed(2)` on a screen.

## Tab navigation

New pattern, first used in `PropertyDetail.js`'s Tenants/Rent/Utilities
redesign (2026-07-22) — no tab UI existed anywhere in the app before this.
Reuse this spec rather than inventing a new one:

```jsx
<div className="border-b border-secondary-200 mb-8 flex space-x-6">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => handleTabClick(tab.id)}
      className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-200 ${
        activeTab === tab.id
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-secondary-500 hover:text-secondary-700'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

Drive the initial active tab from a `?tab=` query param via `useSearchParams`
(same pattern `Properties.js` already uses for its `?new=1` flag), and update
the param on click so the tab is deep-linkable and survives a refresh.

## The inline-edit-field-chip pattern

**New pattern, added because its absence is exactly what went wrong.** Any control that lets a user edit a single value in place (not a full modal/form) must be promoted into its own bounded container — never left as loose children inside a paragraph of surrounding text.

Benchmarked against how mature billing UIs (Xero, Stripe, Midday) handle this: they never edit a value in run-in text — the edit state is always a clearly bounded control, and a label is never separated from its input by text wrapping.

**Spec:**
- Container: `bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-2` — visually distinct from the surrounding view-mode text, not the same paragraph.
- Input: full-size `.input-field` (or the compact variant if space-constrained) — never truncate its padding/text-size below what's used elsewhere in the app.
- Actions: compact `.btn-primary` / `.btn-secondary` (`text-xs px-3 py-1`) for Save/Cancel.
- Validation errors render *inside* the same container, directly below the input — never as a disconnected `<p>` floating after the whole row.
- The whole edit unit moves and wraps together as a block on narrow widths. A label is never separated from its control by `flex-wrap` mid-phrase — if it needs to wrap, stack the whole chip vertically, don't let individual words drop to a new line independently.
- View mode (before editing starts) gets its own small flex row too — e.g. an icon + value + a text-link "Edit" action — kept visually and structurally separate from any other unrelated text on the same line (like a billing-period date range).

## Design review checklist

Run any new UI against this before shipping:

- [ ] Uses the canonical primitives (`.card`, `.btn-primary`/`.btn-secondary`, `.input-field`, `StatusBadge`, `Money`) instead of ad hoc classes.
- [ ] Text colors follow the 900→300 ladder above — no arbitrary shade picks.
- [ ] Icons are `w-4 h-4` (inline default) or `w-5 h-5` (emphasis) — nothing ad hoc, nothing ≥ `w-8 h-8` used as an inline action icon.
- [ ] Any multi-element control (edit forms, action groups) lives in one flex container with **one** consistent gap value — not mixed spacing between siblings.
- [ ] An "edit mode" gets a visually distinct container from "view mode" — never just swapping inline children into the same text flow.
- [ ] A label is never separated from its input/control by flex-wrap — group as a unit, or stack the whole unit vertically.
- [ ] Destructive actions stay icon-only idle→hover — never a filled red button.
- [ ] Semantic colors (`success`/`warning`/`danger`) are only used for actual payment/status states, never decoratively.
