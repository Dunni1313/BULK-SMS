# UI Standards

**Phase 10 (Institutional Platform Polish & Control Center)'s Consistency
Review deliverable.** This document formalizes conventions that were
already, organically, the dominant pattern across this platform's ~65
pages before this phase began — it is a description of the codebase's own
established norms, not a new design system imposed from outside. New
pages should follow it; existing pages already mostly do.

**Scope decision, disclosed explicitly:** a full retrofit of every
existing page against this document was judged disproportionate to a
phase whose own instruction was "unify, simplify, standardize... do not
build major new trading functionality" — rewriting ~65 already-working,
already-tested pages for cosmetic consistency would itself have been a
large, risky undertaking well outside "polish." Instead, this document
(a) formalizes what the dominant pattern already is, so future pages
are consistent by construction, and (b) the two pages this phase itself
added (`Home.tsx`, `NotificationCentre.tsx`) were built to already follow
every rule below. Retrofitting older, lower-conformance pages remains
available as a future, separately-scoped, low-risk sprint.

---

## 1. Page layout

- **Container**: `<div className="space-y-6 max-w-7xl">` (or `space-y-4`
  for a denser page) is the standard top-level wrapper — vertical rhythm
  via `space-y-*`, never manual margins between sibling sections.
- **Cards** (`components/ui/card.tsx`) are the standard content container
  for any distinct section — never a bare `<div>` with ad-hoc borders.
- **Headings**: a page's own `<h1>` is the first element inside the
  container, immediately followed by a one-line description in a muted
  color (`text-muted-foreground`).

## 2. Loading states

Every page that fetches data on mount shows a **Skeleton-based loading
state**, never a bare spinner or a blank screen — `components/ui/skeleton.tsx`
is used throughout (43 of the platform's pages use it directly). The
loading container itself carries a stable `data-testid="<page>-loading"`
(e.g. `home-loading`, `notification-centre-loading`, `dashboard-loading`)
so a test can assert the loading state exists without depending on its
exact visual shape.

## 3. Error states

A failed fetch shows a plain, factual sentence — **"Failed to load
\<the specific thing that failed\>"** (e.g. "Failed to load the portfolio
dashboard," "Failed to load the Institutional Intelligence result") —
never a raw stack trace, never a generic "Something went wrong" with no
specifics, and never a silently blank page. Error text carries its own
`data-testid` (e.g. `<page>-error`) for the same reason as loading states.

## 4. Empty states

An honest, page-specific empty-state sentence is required wherever a
list or metric could legitimately be empty — **never a fabricated zero,
never an empty-looking list indistinguishable from a real empty result
versus data that simply hasn't loaded yet.** Empty-state text carries a
`data-testid="text-<what>-empty"` (e.g. `text-dashboard-construction-empty`,
`text-journal-empty`) — this exact naming convention appears at least 15
times across the codebase already and is the one to keep extending.

## 5. Badges and status colors

Every page with a categorical status (rating, regime, risk grade,
confidence level, agreement level, etc.) defines its **own small, local,
pure function** named `<domain>BadgeClass(value): string`, returning a
Tailwind class string — never a shared, cross-engine badge-color mapping.
This is a deliberate, previously-disclosed pattern (see
`docs/Alpaca-Paper-Trading-Architecture.md` and multiple `CLAUDE.md`
sprint entries): each engine/domain owns its own vocabulary
(Engine 1's `Buy`/`Hold`/`Wait`, Engine 2's `uptrend`/`downtrend`/`range`,
Engine 3's `Excellent`/`Strong`/`Moderate`/`Elevated`/`Poor`), and mixing
them into one shared helper would blur genuinely different meanings
behind a shared color. At least 20 such helper functions already exist
(`agreementBadgeClass`, `confidenceBadgeClass`, `ratingBadgeClass`,
`riskGradeBadgeClass`, etc.) — a new page should add its own rather than
reach for an unrelated existing one. The color convention itself is
consistent even though the functions are separate: green/positive,
amber/caution, red/negative, gray/neutral or unavailable.

## 6. Tables

Use `components/ui/table.tsx` (`Table`/`TableHeader`/`TableBody`/`TableRow`/
`TableCell`) for any tabular data — never a hand-rolled `<div>` grid
pretending to be a table. Numeric columns are right-aligned; currency
values use a shared `fmtUsd()`-style helper (each page's own copy, or the
shared one in `lib/trading-format.tsx` for Engine 2 pages) rather than
ad-hoc `.toFixed(2)` calls scattered through JSX.

## 7. Buttons

Primary action = default `<Button>` variant. Secondary/navigational
actions = `variant="outline"` or `variant="ghost"`. Destructive actions
(delete a workspace, close a position) = `variant="destructive"`, and
always behind an explicit confirmation (a `Dialog` or a second click with
already-visible affordance), never a single accidental click. Icon-only
buttons **always** carry a real `aria-label` — this was a concrete,
disclosed accessibility fix made during Phase 10 for the Workspace
Switcher's own icon buttons (New / Rename / Duplicate / Delete), and is
the bar every future icon-only button should meet.

## 8. Test IDs

Every interactive or state-bearing element that a test needs to target
gets a stable `data-testid`, following the dominant existing naming
families:

| Pattern | Meaning |
|---|---|
| `<page>-loading` | The page's own loading container |
| `<page>-error` | The page's own error message |
| `text-<what>-empty` | An honest empty-state message for one specific section |
| `button-<action>` | A named action button |
| `widget-content-<id>` / `widget-content-<id>-empty` | A Personal Dashboard widget's content, and its own empty state |
| `command-item-<group>-<key>` | A Command Palette result row |
| `command-palette-input` | The Command Palette's search input |

## 9. Typography

Page title: default `<h1>` styling (no manual `text-2xl font-bold`
overrides needed — the shared base styles already apply). Section
headings inside a `Card`: `CardTitle`. Supporting text: `text-sm
text-muted-foreground`. Never introduce a new font size or weight outside
Tailwind's default scale without a specific reason.

## 10. Responsive behaviour

Widget/card grids use Tailwind's responsive grid utilities
(`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, or similar), never a fixed
pixel-width layout. The sidebar (`AppLayout.tsx`) already collapses on
narrow viewports via the existing `useIsMobile` hook — new pages don't
need to reimplement this, only avoid fighting it with a hardcoded
min-width.

---

## Cross-references

- `docs/Institutional-Control-Center.md` — the Phase 10 features (Institutional
  Home, Workspace System, Command Palette, Notification Centre) this
  document's conventions were extracted from and were built to follow.
- `docs/Operations-Handbook.md` §6.23 — day-to-day usage of the Phase 10
  features themselves, as distinct from this document's own coding
  conventions.
