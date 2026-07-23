# Investment Committee Workbench

**Phase 19 — Institutional Investment Committee Workbench.** A deterministic, single-symbol review workflow that brings together every existing institutional engine into one formal decision process: select a company, review its research/valuation/Decision Engine/Portfolio Optimisation/Monitoring outputs, generate a deterministic Investment Memo, and record a Committee decision.

**This is a pure orchestration and workflow layer.** No new valuation model, no new scoring system, and no duplicated business logic were built this phase. Every figure is a direct reuse of the Institutional Investing Engine (Phase 2), the Decision Engine (Phase 14), Opportunity Discovery (Phase 15), and Portfolio Optimisation (Phase 18).

---

## 1. Audit — what already existed, reused unmodified

| Capability needed | Already existed as | Reuse plan |
|---|---|---|
| Decision (recommendation, evidence, checklist, risks, catalysts, portfolio fit) | `buildInstitutionalDecision()` (`lib/decisionEngine.ts`, Phase 14) via `GET /stock-analyst/decision/:symbol` | Called through the exact hook/pattern `DecisionEngine.tsx` already uses |
| Investment Memo | Nothing structured existed — `investmentThesisGenerator.ts`'s 5-section Thesis was the closest precedent, narrower than the Memo's 14 required sections | New `lib/investmentMemo.ts` — a second, differently-shaped deterministic document over the same already-computed report/decision fields |
| Decision Timeline / Meeting History / Saved Committee Decisions / Review History | `investing_decision_snapshots` table + `GET`/`POST /stock-analyst/decision/:symbol/snapshots` (Phase 14) — the stored `analysisJson` blob already carries Evidence, Supporting Metrics, Portfolio/Risk/Diversification Impact, and a Timestamp | Reused completely unmodified — zero new persistence |
| Committee Dashboard / Active Reviews (cross-symbol) | Nothing cross-symbol existed (`/decision/:symbol/snapshots` is symbol-scoped only) | One new thin endpoint, `GET /stock-analyst/decision/snapshots/recent` — same table/formatter, symbol filter removed (mirrors Phase 17's own one-new-endpoint precedent) |
| Evidence Panel | `decision.supportingEvidence`/`.contradictingEvidence`/`.checklist` | Rendered directly, same shape `DecisionEngine.tsx` already renders |
| Research Notes | `investingResearchNotesTable` + existing `GET /research-notes/:symbol` query | Same query, reused for the Memo's Research Notes section; `<ResearchNotesCard>` reused directly for the UI |
| Monitoring Summary | `platformNotificationsTable`, existing `GET /notifications` (not symbol-filtered) | New symbol-filtered query + the now-exported `formatNotification()` (zero duplicated field mapping) |
| Portfolio Impact | `decision.portfolioFit` (Phase 14, itself reusing Portfolio Intelligence, Phase 13) | Read directly |
| Portfolio Manager | `PortfolioConstruction.tsx` ("Institutional Portfolio Manager") | Link target, per-holding "Review in Committee" button |

## 2. What this phase added

### 2.1 `lib/investmentMemo.ts` — `buildInvestmentMemo()`
A pure, template-based composition function (the same discipline as `investmentThesisGenerator.ts`, Phase 12). Given an already-built `ValueResearchReport`, an already-built `InstitutionalDecisionAnalysis`, and two already-fetched lists (research notes, monitoring alerts), it produces the 14 required sections — Business Summary, Business Quality, Competitive Advantage, Financial Strength, Valuation Summary, Margin of Safety, Decision Engine, Investment Committee Verdict, Portfolio Impact, Risk Summary, Catalysts, Research Notes, Monitoring Summary, Conclusion — each sourced from an already-computed field, never a recomputed value or an invented judgment.

### 2.2 `GET /stock-analyst/investment-memo/:symbol`
A thin route wrapper: rebuilds the same `ValueResearchReport`/`InstitutionalDecisionAnalysis` `/decision/:symbol` itself builds (reusing `resolveDecisionManagementQuality`/`resolveDecisionPortfolioContext`), fetches the user's own Research Notes and symbol-filtered Monitoring alerts, and hands everything to `buildInvestmentMemo()`. Optional `?portfolioId=` (same undocumented-query-param pattern as `/decision/:symbol`, per the established Orval-collision precedent).

### 2.3 `GET /stock-analyst/decision/snapshots/recent`
Cross-symbol decision-snapshot history for the calling user (newest first, capped at 20) — reuses `investing_decision_snapshots` and its own `decisionSnapshotItem` formatter, symbol filter removed. Powers the Workbench's Committee Dashboard / Active Reviews.

### 2.4 `pages/InvestmentCommitteeWorkbench.tsx`
New page at `/stock-analyst/investment-committee`. A Committee Dashboard (symbol/portfolio search + Active Reviews list) sits above a per-symbol workspace with 6 tabs: Memo Viewer, Decision Timeline (doubling as Meeting History), Evidence Panel, Portfolio Impact, Risks & Catalysts, and Research Notes (`<ResearchNotesCard>`, reused byte-identically from `StockResearch.tsx`). A "Record Committee Decision" button reuses the exact `useSaveDecisionSnapshot` mutation `DecisionEngine.tsx` already uses.

## 3. Never invents reasoning, never generates opinions

Every sentence produced by `buildInvestmentMemo()` quotes an already-computed score, rating, verdict, or list item — confirmed by a dedicated unit test scanning the entire memo body for forecasting vocabulary ("price target," "expected return," "we predict/forecast"). The Memo's `recommendation`/`confidence` are always byte-identical to the Decision Engine's own output for the same inputs.

## Cross-references

- `docs/Investment-Memo.md` — the Memo's own 14-section structure and reuse map, in detail.
- `docs/Committee-Workflow.md` — the end-to-end user workflow.
- `docs/Institutional-Decision-Engine.md`, `docs/Portfolio-Optimisation.md` — the underlying engines this module composes.
