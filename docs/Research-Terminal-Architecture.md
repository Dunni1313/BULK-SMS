# Research Terminal Architecture

**Phase 20 — Institutional Research Terminal.** How `pages/ResearchTerminal.tsx` is put together, and why.

## Component structure

```
ResearchTerminal (page)
├── header: symbol search, mode toggle (Analyse/Compare/Split), portfolio select
├── open-symbols strip (chips, click to make primary, × to close)
├── saved-layouts strip (name input, Save, load/delete per saved layout)
└── body, by mode:
    ├── single  → <SymbolPanel symbol={primary} .../>
    ├── compare → <CompareTable symbols={all open symbols} />
    └── split   → <ResizablePanelGroup> [ <SymbolPanel/> | <SymbolPanel/> ]

SymbolPanel (per symbol, used in both single and split modes)
├── header: name/symbol, "Open Workspace →" link, close button (split mode)
└── Tabs: Overview | Statements | Decision Engine | Investment Committee |
          Investment Memo | Portfolio Impact | Monitoring | Evidence | Notes
    - Overview           → <ReportView report={...} /> (StockResearch.tsx)
    - Statements         → useGetFinancialStatements, a compact table
    - Decision Engine    → <DecisionSummaryCard symbol={...} /> (StockResearch.tsx)
    - Investment Committee → report.investmentCommittee + link to the Workbench
    - Investment Memo    → useInvestmentMemo() (local hook, see below), sections rendered
    - Portfolio Impact   → useInstitutionalDecision().portfolioFit
    - Monitoring         → useListNotifications() filtered by symbol
    - Evidence           → useInstitutionalDecision().supportingEvidence/.checklist
    - Notes              → <ResearchNotesCard symbol={...} /> (StockResearch.tsx)

CompareTable (Compare mode)
└── useCompareOpportunitiesRoute({symbols}) → full-value table over
    OpportunityRow's own already-computed fields, best-by-dimension starred
```

## Data flow — every fetch is a reuse

`SymbolPanel` makes exactly the same fetches `InstitutionalWorkspace.tsx`/`DecisionEngine.tsx`/`InvestmentCommitteeWorkbench.tsx` already make for a given symbol:

- `useGetValueReport(symbol)` — the same `ValueResearchReport` every other Engine 1 page fetches.
- `useInstitutionalDecision(symbol, portfolioId)` — a local hook, identical in shape to the one already defined in `DecisionEngine.tsx`/`InvestmentCommitteeWorkbench.tsx` (a plain `useQuery` wrapping the generated `getInstitutionalDecision` fetch function, since the undocumented `?portfolioId=` override can't be expressed through the generated hook without re-triggering Orval's own known duplicate-`GetXParams`-export collision, first disclosed at Sprint 40).
- `useInvestmentMemo(symbol, portfolioId)` — the same trick, for Phase 19's `GET /stock-analyst/investment-memo/:symbol`.
- `useGetFinancialStatements(symbol)`, `useListNotifications()` — generated hooks, used exactly as elsewhere.

**No new provider call, no new database query, no new calculation exists anywhere in this file.**

## Saved Layouts — deliberately client-side

`useSavedLayouts()` is a small hook backed by `localStorage` (key `research-terminal-layouts`), holding an array of `{name, mode, symbols, portfolioId, activeTab}`. This was a considered choice, not an oversight:

- The existing `dashboard_workspaces` table (Phase 10) already provides named, saved layout persistence — but its `isActive` column is a **single per-user flag** wired specifically to the Institutional Home page's own widget-visibility config. Reusing that table for a completely different concern (which symbols/mode/tab the Research Terminal has open) would mean either corrupting that invariant (two unrelated features fighting over one "active" flag) or adding an awkward discriminator column to a table whose own header comment explicitly scopes it to Home.
- Saved layouts are pure UI/UX preference, not financial or research data — nothing here needs multi-device sync, audit logging, or tenant-isolation testing the way an actual research artifact (a note, a decision snapshot) does.

Given both points, a new table or endpoint would have been over-engineering for what the feature actually needs. If a future phase wants saved layouts to sync across devices, that's a legitimate, separate, explicitly-approved decision — not implied by this phase's own scope.

## Cross-references

- `docs/Institutional-Research-Terminal.md` — the audit and reuse map.
- `docs/Professional-Research-Workflow.md` — the end-to-end user workflow.
