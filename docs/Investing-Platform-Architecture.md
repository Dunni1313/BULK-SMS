# Institutional Investing Engine — Platform Architecture

**Phase 23 — Executive Dashboard & Production Readiness.** A consolidated architecture reference tying together Phases 12–23 of the Institutional Investing Engine (Engine 1). This is the umbrella doc; individual pages/subsystems have their own deeper docs (see §5).

---

## 1. Engine boundary

"Institutional Investing Engine" (Engine 1) is:

`StockResearch.tsx`, `ResearchTerminal.tsx`, `InstitutionalWorkspace.tsx`, `DecisionEngine.tsx`, `InvestmentCommitteeWorkbench.tsx`, `PortfolioConstruction.tsx`, `PortfolioOptimisation.tsx`, `OpportunityDiscovery.tsx`, `MonitoringDashboard.tsx`, `InstitutionalAICoach.tsx`, `ReportingCentre.tsx`, `StockScanner.tsx`, `ValueInvestingSchool.tsx`, and, as of Phase 23, `ExecutiveDashboard.tsx`.

`PortfolioAnalyst.tsx`, `InstitutionalIntelligence.tsx`, and `InstitutionalMentor.tsx` are **Engine 3 (Options Income Engine)** pages, confirmed via their own header comments (Portfolio Dashboard/Theta Income/Paper Trading/AI Trade Journal) — despite superficially similar naming, they are out of this engine's scope.

## 2. Layered composition — the one rule that holds across every phase

Every phase since Phase 12 has followed the same discipline: **compute nothing new that an earlier phase already computed.** The dependency graph, oldest to newest:

```
Phase 2 (historical)   ValueResearchReport — 23 sections: Business Quality, Financial
                        Strength, Competitive Advantage, Valuation (4 models),
                        Margin of Safety, Investment Committee, Tom Nash, etc.
                        (lib/valueReport.ts)
        │
Phase 14                Decision Engine — synthesises the report into one
                        recommendation + confidence + evidence
                        (lib/decisionEngine.ts → InstitutionalDecisionAnalysis)
        │
Phase 15                Opportunity Discovery — scans the universe, ranks by the
                        Decision Engine's own synthesis score
                        (lib/opportunityDiscovery.ts)
        │
Phase 16                Monitoring & Alerts — watchlist/portfolio condition checks
                        (platform_notifications, computeWatchlistTargets())
        │
Phase 17                Institutional Workspace — one 3-panel cockpit reusing
                        StockResearch's own <ReportView>, unmodified
        │
Phase 18                Portfolio Optimisation — reuses Portfolio Intelligence +
                        Decision Engine + Opportunity Discovery
        │
Phase 19                Investment Memo + Recent Decisions feed — reuses the
                        Decision Engine's own analysis, reformatted as a document
        │
Phase 20                Research Terminal — Analyse/Compare/Split over the same
                        <ReportView>/Decision Engine/Investment Committee data
        │
Phase 21                Institutional AI Coach — 8 deterministic coaches reading
                        already-computed report fields, zero new scoring
        │
Phase 22                Institutional Reporting — 9 report builders, each a thin
                        reformatting of an earlier phase's own output
        │
Phase 23                Executive Dashboard — reads Phase 22's own report
                        endpoints plus Phases 15/16/19/20's own feeds
```

No phase in this list recomputes a business-quality score, a valuation, a margin of safety, or a recommendation that an earlier phase already produced. Every "new" page is a new *view* or *composition*, never a new *computation*, of the same underlying analysis.

## 3. Shared frontend infrastructure

| Module | Purpose | Introduced |
|---|---|---|
| `src/lib/investing-format.ts` | `recommendationBadgeClass`, `checklistBadgeClass`, `fmtUsd`, `fmtPct` — badge-color mapping and number formatting shared across every Engine 1 page | Phase 23 (extracted from 4 pages' own copies) |
| `src/hooks/use-institutional-decision.ts` | `useInstitutionalDecision`/`useInvestmentMemo` — the shared `?portfolioId=` Orval-workaround hooks | Phase 23 (extracted from 3 pages' own copies) |
| `src/lib/trading-format.tsx` | Engine 2's equivalent formatting module (not shared with Engine 1 — each engine's badge vocabulary is deliberately kept separate; see `docs/Production-Readiness.md` §1.6 for why a full merge was rejected) | Engine 2, referenced for contrast only |
| `<ReportView>` (in `StockResearch.tsx`) | The canonical, single rendering of a `ValueResearchReport` — reused byte-identical by `InstitutionalWorkspace.tsx` and linked-to (never re-implemented) by every other page | Phase 2, reused every phase since |
| `<CoachDrawer>` | The shared AI Coach explanation panel | Phase 21, reused by every page offering an "Explain" affordance |
| `<ReportSummaryCard>` (page-local to `ExecutiveDashboard.tsx`) | A condensed renderer for the `InstitutionalReport` shape (`{title, subtitle, sections}`) | Phase 23 |

## 4. Backend composition layers

| Layer | Files | Reused by |
|---|---|---|
| Report data | `lib/valueReport.ts`, `lib/valueInvesting.ts`, `lib/tomNashEngine.ts`, `lib/investmentCommittee.ts` | Every downstream module |
| Decision synthesis | `lib/decisionEngine.ts` | Opportunity Discovery, Portfolio Optimisation, Research Terminal, Investment Memo, Reporting Centre, Executive Dashboard |
| Portfolio composition | `lib/portfolioConstruction.ts`, `lib/portfolioIntelligence.ts`, `lib/portfolioOptimisation.ts` | Portfolio pages, Reporting Centre, Executive Dashboard |
| Opportunity scanning | `lib/opportunityDiscovery.ts` | Opportunity Discovery, Reporting Centre, Executive Dashboard |
| Monitoring | `lib/watchlistTargets.ts`, `platform_notifications` | Monitoring Dashboard, Reporting Centre, Executive Dashboard |
| Investment Memo | `lib/investmentMemo.ts` | Investment Committee Workbench, Reporting Centre |
| AI Coach | `lib/investingCoach.ts` | Institutional AI Coach, Reporting Centre |
| Learning progress | `lib/learningProgress.ts` | Value Investing School, Reporting Centre, Executive Dashboard |
| Reporting | `lib/institutionalReporting.ts` (9 report builders) | Reporting Centre, Executive Dashboard |

## 5. Deeper docs, per subsystem

- `docs/Research-Terminal-Architecture.md` — Research Terminal internals
- `docs/Workspace-Architecture.md` — Institutional Workspace internals
- `docs/Institutional-Reporting.md`, `docs/Report-Generation.md`, `docs/Professional-Reporting-Workflow.md` — Reporting Centre
- `docs/Executive-Dashboard.md` — this phase's landing page
- `docs/Production-Readiness.md` — this phase's audit and hardening record
- `docs/Performance-Optimisation.md` — this phase's performance audit
