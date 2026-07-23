# Workspace Architecture

**Phase 17 — Institutional Workspace & Unified Research Cockpit.** The technical layout and UI mechanics of `/workspace` (`artifacts/ravish-trading/src/pages/InstitutionalWorkspace.tsx`).

## 1. Layout — 3-panel resizable

Built on `react-resizable-panels` (already a project dependency since before this phase, previously unused anywhere in the codebase). A new shadcn-style wrapper, `components/ui/resizable.tsx`, exports `ResizablePanelGroup`/`ResizablePanel`/`ResizableHandle` — the standard shadcn pattern, matching every other `components/ui/*` wrapper in this codebase.

```
┌─────────────────────────────────────────────────────────────┐
│  Header: symbol search, permanent labels                     │
├──────────────┬─────────────────────────────┬─────────────────┤
│ Left Sidebar │      Main Research Area       │  Right Sidebar  │
│ (resizable)  │   (research tabs + report)    │   (resizable)   │
└──────────────┴─────────────────────────────┴─────────────────┘
```

Either sidebar can be collapsed entirely (toggle buttons, or the `[`/`]` keyboard shortcuts — see §4), at which point the Main Research Area expands to fill the freed space.

## 2. Saved Layouts

`ResizablePanelGroup` is given `autoSaveId="institutional-workspace-layout"` — `react-resizable-panels`' own built-in localStorage persistence mechanism. Panel sizes the user drags are automatically restored on the next visit. **No new backend table was built for this.** The existing `dashboard_workspaces` table (Home page widget configuration) was evaluated and found not cleanly reusable: it is Home-page-widget-specific, with a partial unique index guaranteeing at most one *active* workspace per user — a different concern than this page's own per-page panel-layout state. Client-side-only persistence is a disclosed, deliberate scope decision for this phase.

## 3. Research Tabs

The Main Research Area renders one continuous `<ReportView>` (imported from `StockResearch.tsx`, byte-identical) rather than a re-fetching tab set. A thin "Research Tabs" navigation bar above it provides scroll-anchor jump links (Company Overview, Business Quality, Financial Strength, Competitive Advantage, Valuation, Margin of Safety, Decision Engine, Investment Committee, Tom Nash Analysis, Historical Trends) — each an `<a href="#workspace-section-...">` anchor into the already-rendered report, not a separate fetch or a new component per tab. This avoids re-fetching the report per tab while still giving the "Research Tabs" navigation the brief calls for.

Statements/Peers/Filings/Earnings — the heavier, on-demand tabs `StockResearch.tsx` itself gates behind its own tab clicks — remain accessible only via a deep-link to the full Value Research page. Duplicating that on-demand-tab machinery here was judged out of proportion for an integration phase; the Workspace's `?symbol=` deep-link makes that jump a single click.

## 4. Keyboard Shortcuts

| Key | Action |
|---|---|
| `/` | Focus the symbol search box |
| `Escape` | Blur the currently-focused input |
| `[` | Toggle the left sidebar |
| `]` | Toggle the right sidebar |

Deliberately chosen to avoid colliding with the existing global `Cmd+K` / `Ctrl+K` Command Palette shortcut (`AppLayout.tsx`), which continues to work identically on this page as on every other page.

## 5. Deep Links

`/workspace?symbol=AAPL` auto-loads that symbol on mount. Every symbol reference inside the Workspace (a watchlist row, a monitoring alert, a related-opportunity peer, a notes entry) is a plain click-to-select action that updates both the in-page state and the URL (`navigate()` from `wouter`'s `useLocation`), so the current symbol is always shareable/bookmarkable.

## 6. Quick Compare

Related Opportunities (right sidebar) links each peer symbol straight into `/workspace?symbol={peer}` — a one-click way to pivot research to a comparable company. A full side-by-side compare view already exists in Opportunity Discovery's own Comparison feature; the Workspace does not duplicate it, it deep-links out.

## 7. Command Palette / Navigation integration

`Institutional Workspace` was added to `lib/nav-items.ts`'s `NAV_ITEMS` array — the single source of truth `AppLayout.tsx`'s sidebar and the Command Palette's `ALL_NAV_ITEMS` "Navigate" group both already read from. No separate wiring was needed for the Command Palette to surface the new page; the existing indirection pays for itself again here.

## 8. Testing notes

`react-resizable-panels` registers document-level listeners that interfere with `@testing-library/user-event`'s key-by-key typing simulation whenever a `ResizablePanelGroup` is mounted anywhere in the render tree (confirmed via isolated reproduction during this phase — a real jsdom/library interaction, not a Workspace bug). `InstitutionalWorkspace.test.tsx`'s symbol-search test uses `fireEvent.change` to set the controlled input's value directly rather than `userEvent.type`, which remains safe and correct for every other interaction (clicks) in the test suite.

## Cross-references

- `docs/Institutional-Workspace.md` — what the Workspace is, the audit, and the reuse map.
- `docs/Research-Workflow.md` — the end-to-end workflow this architecture supports.
