# GitHub Release — v1.1.0

**This document contains the prepared content for the official GitHub
Release.** It could not be published automatically this session — see the
"Publishing note" at the end for why, and the exact manual steps needed.
Copy the body below into the GitHub UI (or `gh release create`) against
tag `v1.1.0`, merge commit `1da32b276ad82a4c24488dad67342c75d590fd99`, on
branch `main`.

---

## Release title

**v1.1.0 — Sidebar Navigation Redesign**

## Release body

### Summary

The platform's sidebar had grown into a single, continuous 82-item column
with no grouping, no collapse, no compact mode, and no way to pin
favourites — increasingly hard to navigate as new engines and modules
were added across prior releases. **v1.1.0** is a bounded, frontend-only
minor release, built on top of the frozen `v1.0.0` baseline
(`docs/Version-1-Freeze-Declaration.md`), that restructures the sidebar
into 10 named, collapsible groups with active-route highlighting, a
compact icon-only mode, a reorderable "Frequently Used" pinned strip, and
persisted per-user preferences — **without removing, renaming, or
relocating any existing route**. `v1.0.0` itself remains untouched and
frozen.

### High-level UX improvements

- 82 links → 10 labelled, collapsible sections instead of one long
  scroll.
- A one-click "Frequently Used" shortcut strip (up to 6 pinned routes,
  reorderable) for the routes a user visits most.
- The section containing the current page auto-expands and scrolls its
  active link into view.
- A compact, icon-only mode (with hover tooltips) for users who want more
  screen space.
- Preferences persist across sessions.
- A real mobile-drawer usability bug was found and fixed during
  implementation (see below).

### Features

- **Collapsible navigation groups** — Home, Options Trading, Options
  Income Engine, Portfolio Management, Institutional Investing, Value
  Investing, Trading Workbench, AI & Decision Tools, Learning Centre,
  Administration. Home and Options Trading are expanded by default.
  Built on the already-installed `@radix-ui/react-collapsible` (no new
  dependency).
- **Canonical navigation configuration** — a single, data-driven
  `NAV_GROUPS` structure in `lib/nav-items.ts` is now the one source of
  truth for both the sidebar and the existing global Command Palette
  (⌘K/Ctrl+K).
- **Compact icon-only mode** — reuses `components/ui/sidebar.tsx`'s
  existing, previously-unused `collapsible="icon"` support; each item's
  title shows as a tooltip on hover.
- **Frequently Used pinned routes** — up to 6, with pin/unpin,
  reordering, and cross-session persistence.
- **Persistent navigation preferences** — expanded groups, compact mode,
  and pinned routes persist under a single `dk-sidebar-navigation-state`
  localStorage key.
- **Active-route auto-expansion** — a group containing the current page
  always renders open without overwriting a user's own saved
  expand/collapse choice elsewhere.
- **Navigation search compatibility** — the existing global Command
  Palette is unchanged and continues to find every route regardless of
  which group is currently collapsed.
- **Responsive desktop/tablet/mobile behaviour** — desktop: full
  collapsible sidebar with a header-bar compact toggle; tablet
  (768–1023px): a first-time visitor defaults to compact mode; mobile
  (<768px): the drawer now closes automatically once a route is
  selected.
- **Accessibility improvements** — Radix's native `aria-expanded`/
  keyboard handling for every group trigger; pinned/collapsed-mode item
  labels stay in the accessibility tree at all times.

### Technical Changes

**Files added**
- `src/lib/sidebar-preferences.ts` + `sidebar-preferences.test.ts`
- `src/hooks/use-sidebar-preferences.ts`
- `src/components/ui/collapsible.tsx`
- `src/components/layout/SidebarNav.tsx`
- `src/components/layout/AppLayout.mobile.test.tsx`
- `src/lib/nav-items.test.ts`
- `docs/v1.1.0-Sidebar-Navigation-Redesign.md`,
  `docs/Release-Notes-v1.1.0.md`

**Files modified**
- `src/lib/nav-items.ts` — rewritten as the single canonical
  `NAV_GROUPS`/`ALL_NAV_ITEMS`/`DEFAULT_PINNED_HREFS` structure.
- `src/components/layout/AppLayout.tsx` — renders the grouped sidebar, a
  controlled `SidebarProvider` for compact mode, and the relocated
  `SidebarTrigger`.
- `src/components/layout/AppLayout.test.tsx` — extended.
- `src/index.css` — 2 keyframes + 2 utility classes for the collapse
  animation (additive only).
- `CHANGELOG.md` — new `[v1.1.0]` entry.

**Route preservation**: all 82 original routes are preserved exactly —
none removed, renamed, or made unreachable. Verified by a dedicated
regression test (`nav-items.test.ts`) asserting set-equality against the
pre-redesign 82-route list.

**Duplicate sidebar links resolved (route itself never removed)**: 6
routes named in more than one of the redesign's proposed groups were
each resolved to a single canonical location —
`/institutional-mentor`, `/decision-engine`, `/institutional-ai-coach` →
Institutional Investing; `/trading-ai-coach` → Trading Workbench;
`/portfolio-analyst` → Portfolio Management;
`/stock-analyst/value-investing-school` → Learning Centre.

### Bug fixed during implementation

The compact-mode toggle (`SidebarTrigger`) was initially placed inside
the sidebar's own header, which — on mobile — only renders once the
drawer is already open, making it impossible to ever open the drawer.
Caught by this release's own new mobile test suite before merge; fixed
by relocating the trigger to the always-rendered main-content header.

### Test Summary

- `pnpm run typecheck` — clean across the whole workspace.
- `pnpm --filter @workspace/ravish-trading run test` — 97 files / 1129
  tests, all passing (was 94 files / 1092 tests before this release; +3
  new files, +37 new tests).
- `PORT=5000 BASE_PATH=/ pnpm run build` — succeeds. The frontend main
  bundle chunk grew from 460.62 kB to 571.15 kB (`AppLayout` is eagerly
  loaded on every page) — the same disclosed >500 kB chunk-size advisory
  category as before this release, not a new one.
- Re-verified against `main` post-merge: typecheck clean, full production
  build succeeds (all 3 packages), identical 571.15 kB main chunk.

### Protected-file confirmation

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and broker integration code all carry zero-line diff
for this release. No database migration, no `openapi.yaml` change, no
backend file of any kind was touched — this release's entire footprint
is `artifacts/ravish-trading/src/` plus documentation.

### Known Limitations

- The frontend main bundle's shared vendor chunk (571.15 kB) sits over
  Vite's 500 kB advisory build-warning threshold — grown from this
  release's own pre-redesign baseline of 460.62 kB, since `AppLayout`
  (and everything this redesign added to it) is eagerly loaded on every
  page, not lazy-split. Same disclosed category first flagged at v1.0.0,
  larger number — a future manual-chunking pass remains an open,
  disclosed item.
- The 6 suggested pinned defaults exactly fill the 6-pin cap, so a
  first-time user must remove a default before adding a new pin — an
  intentional, disclosed consequence of the spec's own numbers.

### Upgrade Notes

None. No schema change, no environment variable change, no API contract
change. A user's very first visit after this release ships establishes a
sensible default (Home + Options Trading expanded, full width on
desktop, compact on tablet-width viewports, the 6 suggested pins) —
nothing to migrate.

---

## Publishing note (why this wasn't published automatically)

This session's git remote is mediated by a local proxy
(`local_proxy@127.0.0.1:.../git/Dunni1313/BULK-SMS`) that accepts branch
pushes (the `v1.1.0-sidebar-redesign` branch pushed successfully, the PR
merged into `main` cleanly, and `main` was pulled down successfully) but
**rejected the `v1.1.0` tag push with an HTTP 403, on two attempts** —
the same limitation encountered and disclosed during the `v1.0.0` release
process. The available GitHub MCP tools in this session remain
read-only for tags/releases (`get_tag`, `get_release_by_tag`,
`list_tags`, `list_releases`, `get_latest_release`, `list_workflow_*`) —
there is no tool available to create a tag or a release via the API
either. Both are consistent with the harness treating tag/release
publication as a step requiring a human with direct push access, not
something an agent session can complete unattended.

**What already exists, ready to use:**
- A correctly-formed annotated git tag `v1.1.0` exists **locally** in
  this session's working copy, verified to point at the real merge
  commit `1da32b276ad82a4c24488dad67342c75d590fd99` (PR #2, merged into
  `main`).

**Manual steps to complete the release:**
1. From a machine/account with push access to `Dunni1313/BULK-SMS`:
   ```
   git fetch origin main
   git tag -a v1.1.0 1da32b276ad82a4c24488dad67342c75d590fd99 -m "DK Options Platform v1.1.0 – Sidebar Navigation Redesign"
   git push origin v1.1.0
   ```
   (Or, since the tag already exists in this session's local clone, that
   clone's own `git push origin v1.1.0` will succeed once run with a
   credential that has tag-push permission.)
2. On GitHub: Releases → Draft a new release → choose tag `v1.1.0` →
   paste the "Release title" and "Release body" sections above →
   Publish.
