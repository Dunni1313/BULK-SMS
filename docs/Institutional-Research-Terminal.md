# Institutional Research Terminal

**Phase 20 — Institutional Research Terminal.** A professional, Bloomberg/Morningstar/Koyfin-style multi-panel research experience that unifies every existing Engine 1 capability into one screen: Company Search, an Analyse mode, a Compare mode, and a Split-screen mode.

**This is a pure integration and UX phase.** No new valuation model, no new scoring system, and no duplicated business logic were built this phase. Every figure is a direct reuse of the Institutional Investing Engine (Phase 2), the Decision Engine (Phase 14), Opportunity Discovery (Phase 15), the Investment Committee Workbench (Phase 19), and the Institutional Workspace (Phase 17).

---

## 1. Audit — what already existed, reused unmodified

| Capability needed | Already exists as | Reuse plan |
|---|---|---|
| Multi-panel layout | `InstitutionalWorkspace.tsx`'s `ResizablePanelGroup`/`ResizablePanel`/`ResizableHandle` | Same primitives, terminal-specific arrangement (Split-screen mode) |
| Company Search / deep linking | `useSymbolFromDeepLink()` pattern, `?symbol=`/`?portfolioId=` query conventions | Reused verbatim, extended with `?symbols=`/`?mode=` |
| Multi-company comparison / side-by-side valuation / opportunity comparison | `GET /opportunity-discovery/compare?symbols=A,B,C` (`compareOpportunities()`), already used in `PortfolioOptimisation.tsx`'s 2-symbol, star-only Comparison View | Same endpoint/hook, extended to N symbols with full value columns — a UI enhancement, zero new calculation |
| Financial Statement Explorer | `useGetFinancialStatements` (Phase 2, Sprint 19) | Reused directly, rendered as a compact table over the same already-fetched years |
| Historical Trends / Business Quality / Competitive Advantage explorers | Sections already inside `<ReportView>` | Same component |
| Decision Engine summary | `DecisionSummaryCard` (`StockResearch.tsx`) | Reused directly |
| Investment Committee summary | `report.investmentCommittee` + link into the Investment Committee Workbench | Reused |
| Investment Memo viewer | Phase 19's `GET /stock-analyst/investment-memo/:symbol` + section-rendering | Same rendering logic |
| Portfolio Impact | `decision.portfolioFit` (Phase 14) | Same pattern |
| Monitoring summary | `useListNotifications()` filtered by symbol | Reused |
| Evidence panel | `decision.supportingEvidence`/`.contradictingEvidence`/`.checklist` | Same rendering as the Investment Committee Workbench's own Evidence Panel |
| Research Notes | `<ResearchNotesCard>` | Reused directly |
| Saved Layouts | `dashboard_workspaces` table (Phase 10) exists but is scoped to the Institutional Home page's own widget config (`isActive` is a single per-user flag) — reusing it here would silently corrupt that invariant for a completely different concern | **Not reused** — client-side (localStorage), named layouts instead. No new table, no new endpoint. |
| Keyboard shortcuts | Workspace's `/`, `Escape`, `[`, `]` handlers | Same pattern, plus `1`/`2`/`3` for mode switching |
| Split-screen mode | Nothing exists | Genuinely new, but pure UI: the same per-symbol panel rendered twice |
| Navigation / Command Palette | `nav-items.ts` | One new entry, Command Palette coverage automatic |

## 2. What this phase added

### 2.1 `pages/ResearchTerminal.tsx`
A single new page at `/research-terminal`, three modes:

- **Analyse (single)** — one symbol, 9 tabs: Overview (`<ReportView>`), Statements, Decision Engine (`<DecisionSummaryCard>`), Investment Committee (`report.investmentCommittee` + link), Investment Memo (Phase 19's memo, rendered), Portfolio Impact, Monitoring, Evidence, Research Notes (`<ResearchNotesCard>`).
- **Compare** — 2+ symbols side by side over `GET /opportunity-discovery/compare`'s own already-computed `OpportunityRow` fields, showing every dimension's real value (not just a best-of star, extending `PortfolioOptimisation.tsx`'s 2-symbol star-only view).
- **Split-screen** — the exact same per-symbol panel rendered twice, independently, in a resizable two-pane layout.

### 2.2 Saved Layouts
A named, client-side (localStorage) record of `{mode, symbols, portfolioId, activeTab}` — save, load, delete. No new backend table or endpoint, since this is pure UI/UX state, not financial data.

### 2.3 Keyboard shortcuts & deep linking
`/` focuses search, `Escape` blurs it, `1`/`2`/`3` switch modes (mirroring Workspace's own `[`/`]` sidebar-toggle precedent). The URL stays in sync (`?symbols=&mode=&portfolioId=`) so any state is shareable/bookmarkable.

## 3. Never invents reasoning, never generates opinions

Every panel, tab, and comparison cell in the Terminal quotes an already-computed value from an existing engine — confirmed by construction (the Terminal makes no new provider call and computes nothing itself; every hook it calls already exists and is already tested elsewhere).

## Cross-references

- `docs/Research-Terminal-Architecture.md` — the component/data-flow architecture.
- `docs/Professional-Research-Workflow.md` — the end-to-end user workflow.
- `docs/Investment-Committee-Workbench.md`, `docs/Portfolio-Optimisation.md` — the underlying engines this module composes.
