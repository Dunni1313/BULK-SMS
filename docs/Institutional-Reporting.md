# Institutional Reporting

**Phase 22 — Institutional Reporting & Client Presentation Engine.** A deterministic Institutional Reporting Engine that converts the existing investing outputs into professional reports suitable for investment committees, portfolio reviews, and client presentations. This is a reporting and presentation phase — no new valuation model, no new scoring system, and no new recommendation was built.

---

## 1. Audit — what already existed, reused unmodified

| Capability needed | Already exists as | Reuse plan |
|---|---|---|
| Company research content | `ValueResearchReport` (23 sections), `InstitutionalDecisionAnalysis` (Phase 14), `InvestmentMemo` (14 sections, Phase 19) | Quote directly into new report sections — zero new analysis |
| Institutional AI Coach | `lib/investingCoach.ts` (8 coaches, Phase 21) | Reused directly for the optional AI Coach section on the Company Research Report |
| Research Terminal / Investment Committee Workbench | `ResearchTerminal.tsx`, `InvestmentCommitteeWorkbench.tsx` | Link out via new "Generate Report" entry points — never re-implemented |
| Decision Engine | `lib/decisionEngine.ts`, `buildInstitutionalDecision()` (Phase 14) | Reused directly for the Decision Engine section |
| Portfolio Optimisation / Portfolio Manager | `lib/portfolioOptimisation.ts`, `lib/portfolioIntelligence.ts`, `PortfolioConstruction.tsx` | Reused directly for the Portfolio Review / Portfolio Health reports |
| Opportunity Discovery | `lib/opportunityDiscovery.ts` (`scanOpportunities`, `bucketOpportunities`, Phase 15) | Reused directly for the Opportunity Discovery Report |
| Monitoring & Alerts | `platform_notifications` table, `formatNotification()` (Phase 16) | Reused directly for the Monitoring Summary Report |
| Research Notes | `investing_research_notes` table + routes (Phase 19) | Reused directly |
| Investment Memo | `lib/investmentMemo.ts` (Phase 19) | The full memo document is reused verbatim as its own report section |
| Learning Centre / AI Coach learning summary | `lib/learningProgress.ts` (`LearningProgressSummary`, Phase 21) | Reused directly for the AI Coach Learning Summary Report |
| Cross-engine one-pager (Executive Summary source) | `lib/crossEngineDailyReport.ts` (Phase 5, Sprint 68) | Reused directly — zero new composition needed |
| Report persistence precedent | `daily_reports` table (`payload jsonb` + scalar summary columns, Phase 3), `brokerReconciliationReportsTable` | The new `institutional_reports` table follows this exact precedent |
| PDF/print/export | Nothing existed — no `jspdf`/`html2canvas`/`react-to-print` anywhere; only client-side CSV export (`portfolio-export.ts`) | `@media print`-equivalent Tailwind `print:` classes + `window.print()` — no new dependency |
| A generalized "Reporting Centre" | Nothing existed — every report-shaped page (Investment Memo Viewer, Daily Report, Broker Reconciliation Report) is single-purpose, with no section selector and no export | **This is the phase's entire deliverable** |

**Genuine gap confirmed:** no page let a user compose, preview, and export a professional report assembled from the platform's own already-computed sections. Everything else needed was already built.

## 2. What this phase added

### 2.1 `lib/institutionalReporting.ts` — 9 deterministic report builders

A pure composition module, structurally identical in discipline to `decisionEngine.ts`/`investmentMemo.ts`/`investingCoach.ts`: it computes nothing new. Every `ReportSection` it produces is either lifted verbatim from `ValueResearchReport.sections` (the same `{id, title, body, bullets?}` shape `valueReport.ts` already established, Phase 2) or a thin reformatting of an already-computed field from `InstitutionalDecisionAnalysis`, `InvestmentMemo`, `CoachExplanation`, `PortfolioIntelligenceAnalysis`, `PortfolioOptimisationAnalysis`, `OpportunityScanResult`/`OpportunityBucket`, `platform_notifications` rows, `WatchlistTargetCheck`, `CrossEngineDailyReport`, or `LearningProgressSummary`.

| Report type | Reuses |
|---|---|
| Investment Committee Report | The Investment Committee's own report section, the Decision Engine's synthesis, evidence, and portfolio impact |
| Single Company Research Report | Business Quality, Financial Strength, Valuation, Margin of Safety, Decision Engine, Investment Committee, Portfolio Impact, Evidence, Monitoring, Research Notes, the full Investment Memo, and optionally the 8 AI Coach explanations |
| Portfolio Review Report | Portfolio Optimisation's own health, diversification, position-quality ranking, and upgrade/trim/exit candidates |
| Portfolio Health Report | Portfolio Intelligence's own quality/capital-allocation/diversification scores, allocation mix, risk, income, and performance |
| Watchlist Report | Every Watchlist item's own price/margin-of-safety target status, reused directly from `computeWatchlistTargets()` |
| Opportunity Discovery Report | The Opportunity Discovery scan's own buckets |
| Monitoring Summary Report | The user's own recorded monitoring alerts across every symbol |
| AI Coach Learning Summary | The Learning Centre's own Progress Tracker |
| Executive Summary | The Cross-Engine Daily Report's own one-pager |

The only genuinely new content in this file is deterministic string formatting (e.g. "Recommendation: Buy (confidence 82/100)."), never a new judgment about any company.

### 2.2 `institutional_reports` table

A user-saved, point-in-time snapshot of a generated report, mirroring `daily_reports`' own headline-columns-plus-`payload jsonb` pattern (Phase 3): `id, userId, reportType, title, symbol, portfolioId, dataSource, payload, createdAt`. `symbol`/`portfolioId` are genuinely nullable (a report type may be scoped to neither). No foreign key on `portfolioId` — a loose, unenforced reference, mirroring `journal_entries.trade_id`'s own established precedent, so a saved report survives even if the portfolio it was generated from is later deleted or renamed.

### 2.3 `GET /reporting/*` routes

Thin routes (`routes/institutionalReporting.ts`) reusing the exact same `buildValueResearchReport`/`buildInstitutionalDecision`/`resolveDecisionManagementQuality`/`resolveDecisionPortfolioContext` helpers `/decision/:symbol` and `/investment-memo/:symbol` already call (the latter two exported from `routes/stockAnalyst.ts` this phase, a zero-behavior-change visibility change, the same "extract on the second real consumer" precedent as `formatNotification()`). `POST /reporting/reports` always **regenerates server-side** rather than trusting a client-supplied report body, mirroring `routes/portfolioAI.ts`'s own `POST /reports` pattern (Phase 3).

### 2.4 `ReportingCentre.tsx`

See `docs/Professional-Reporting-Workflow.md` for the full UI contract (Report Builder, Section Selector, Report Preview density modes, Export Preview, Presentation View, Comparison Report, Saved Reports), and `docs/Report-Generation.md` for the exact section-to-report-type mapping.

## 3. Integration — 11 surfaces

A "Generate Report →" link (deep-linking via `?reportType=&symbol=&portfolioId=`, mirroring `DecisionEngine.tsx`'s/`InstitutionalAICoach.tsx`'s own established `?symbol=` precedent) was added to: Institutional Workspace, Research Terminal, Investment Committee Workbench, Portfolio Manager (Portfolio Construction), Institutional AI Coach, Decision Engine, Portfolio Optimisation, Institutional Monitoring, Learning Centre (a quick-link card), Navigation (`nav-items.ts`, a new "Institutional Reporting Centre" entry), and the Command Palette (automatic — it reads the same `ALL_NAV_ITEMS` array, per the established Phase 19/20/21 precedent).

## 4. Never invents reasoning, never generates opinions

Every `ReportSection` in an `InstitutionalReport` is either a direct copy of an already-computed `ValueReportSection` or a plain-string reformatting of an already-computed value — confirmed by construction (`institutionalReporting.ts` makes no new provider call and computes nothing itself beyond string templating). No LLM is called anywhere in this phase.

## Cross-references

- `docs/Report-Generation.md` — the 9 report types, their exact section composition, and persistence.
- `docs/Professional-Reporting-Workflow.md` — the Reporting Centre's UI contract (builder, preview, section selector, export, presentation, comparison).
- `docs/Institutional-AI-Coach.md`, `docs/Institutional-Research-Terminal.md`, `docs/Investment-Committee-Workbench.md`, `docs/Portfolio-Optimisation.md` — the underlying engines this phase composes.
