# Committee Workflow

**Phase 19 — Institutional Investment Committee Workbench.** The end-to-end user workflow the Investment Committee page (`/stock-analyst/investment-committee`) is designed to support, per the phase's own brief:

> Select a company → Review research → Review valuation → Review Decision Engine → Review Portfolio Optimisation → Review Monitoring → Review evidence → Create Investment Memo → Record Committee Decision → Save Review. All within the Institutional Workspace.

## Step-by-step

1. **Select a company.** Enter a symbol in the Committee Dashboard's search box (optionally with a portfolio for Portfolio Impact context), or reopen a recent one from **Active Reviews** — a list of the calling user's own most recently recorded Committee decisions across every symbol (`GET /decision/snapshots/recent`, the one genuine cross-symbol gap this phase's audit found). Every other page in the platform that surfaces a symbol (Institutional Workspace, Decision Engine, Portfolio Optimisation, Portfolio Manager, Opportunity Discovery, Institutional Mentor, Institutional Monitoring) also deep-links directly into this workflow via `?symbol=`.

2. **Review research / valuation / Decision Engine.** The moment a symbol resolves, the page fetches the same `ValueResearchReport` and `InstitutionalDecisionAnalysis` every other engine page already builds — the recommendation badge, confidence score, and portfolio context (if supplied) appear immediately above the tabs.

3. **Review Portfolio Optimisation.** The **Portfolio Impact** tab shows the Decision Engine's own `portfolioFit` (already-held weight, sector exposure) and a "Review Portfolio Optimisation →" link straight into that page (Phase 18) for the fuller Upgrade/Trim/Exit analysis.

4. **Review Monitoring.** The Investment Memo's own **Monitoring Summary** section (in the Memo Viewer tab) surfaces the user's own recorded alerts for this symbol; the platform-wide Institutional Monitoring page (`/monitoring-dashboard`) also links back into this workflow from any alert for a symbol.

5. **Review evidence.** The **Evidence Panel** tab shows Supporting/Contradicting Evidence and the full 15-item Supporting Metrics checklist — the exact same evidence `DecisionEngine.tsx` already renders, never re-derived.

6. **Create Investment Memo.** The **Memo Viewer** tab renders the deterministic 14-section Investment Memo (`docs/Investment-Memo.md`) the moment the symbol resolves — no separate "generate" click, since it's a pure, cheap composition over data already fetched for this review.

7. **Record Committee Decision.** The "Record Committee Decision" button (always visible once a symbol resolves) saves the current decision as a point-in-time snapshot — reusing the exact same `investing_decision_snapshots` table and `POST /decision/:symbol/snapshots` route the standalone Decision Engine page already uses. Zero new persistence.

8. **Save Review.** The **Decision Timeline** tab (also serving as **Meeting History**) lists every snapshot ever recorded for this symbol, newest first — the literal "Review History" the brief calls for, since a saved snapshot already carries its own Evidence/Supporting Metrics/Portfolio/Risk/Diversification Impact (the stored `analysisJson` blob) plus a Timestamp.

Every step above happens on the same page, without leaving the Investment Committee workflow — consistent with the Institutional Workspace's own established "one page, one symbol, every engine" design (Phase 17).

## Cross-references

- `docs/Investment-Committee-Workbench.md` — the full audit and reuse map.
- `docs/Investment-Memo.md` — the Memo's own 14-section structure.
- `docs/Institutional-Decision-Engine.md`, `docs/Portfolio-Optimisation.md`, `docs/Institutional-Investing-Engine.md` — the underlying engines this workflow composes.
