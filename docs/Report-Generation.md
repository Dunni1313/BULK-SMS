# Report Generation

**Phase 22 — Institutional Reporting & Client Presentation Engine.** How `lib/institutionalReporting.ts` assembles each of the 9 report types, and how a generated report is persisted.

## 1. The shared shape

Every report is an `InstitutionalReport`:

```ts
interface InstitutionalReport {
  reportType: InstitutionalReportType;
  title: string;
  subtitle: string;
  symbol: string | null;
  portfolioId: number | null;
  generatedAt: string;
  dataSource: string; // "SIMULATED" | "LIVE" | "MIXED" | "N/A"
  sections: ReportSection[]; // {id, title, body, bullets?} — the same shape valueReport.ts (Phase 2) already established
  disclaimer: string;
}
```

`sections` is deliberately the exact same `ReportSection` shape `ValueResearchReport.sections` already exposes (and the OpenAPI `ValueReportSection` schema already models) — never a new section shape. A handful of section builders (`businessQualitySection`, `financialStrengthSection`, `valuationSection`, `marginOfSafetySection`, `investmentCommitteeSection`) literally return the matching entry out of `report.sections` unchanged (`report.sections.find(s => s.id === "business")`, etc.) — proven byte-identical by `institutionalReporting.test.ts`'s own dedicated regression assertions.

## 2. Section Selector is client-side only

The backend always returns the **full** applicable section set for a report type. There is no server-side "which sections do you want" parameter — `ReportingCentre.tsx`'s Section Selector is a pure client-side filter over the already-returned `sections` array (toggling membership in a `Set<string>` of section ids). This keeps every report type's composition logic in exactly one place (the backend builder) and avoids a second code path for "generate everything" vs. "generate a subset."

## 3. The 9 report types

| # | Report type (`reportType`) | Route | Inputs | Sections (in order) |
|---|---|---|---|---|
| 1 | `investment-committee` | `GET /reporting/investment-committee/:symbol` | symbol (+ optional `?portfolioId=`) | Executive Summary, Investment Committee, Decision Engine, Evidence, Portfolio Impact |
| 2 | `company-research` | `GET /reporting/company-research/:symbol` | symbol (+ optional `?portfolioId=&includeCoach=`) | Executive Summary, Business Quality, Financial Strength, Valuation, Margin of Safety, Decision Engine, Investment Committee, Portfolio Impact, Evidence, Monitoring, Research Notes, Investment Memo, AI Coach |
| 3 | `portfolio-review` | `GET /reporting/portfolio-review/:portfolioId` | portfolio | Executive Summary, Portfolio Health, Diversification & Concentration, Position Quality Ranking, Portfolio Impact (Upgrade/Trim/Exit), Capital Allocation, Opportunity Discovery (replacement/cash-deployment) |
| 4 | `portfolio-health` | `GET /reporting/portfolio-health/:portfolioId` | portfolio | Executive Summary, Portfolio Health, Weighted Metrics, Diversification (Allocation Mix), Portfolio Risk, Income, Performance |
| 5 | `watchlist` | `GET /reporting/watchlist` | none | Executive Summary, Watchlist Items |
| 6 | `opportunity-discovery` | `GET /reporting/opportunity-discovery` | none | Executive Summary, one section per matched bucket |
| 7 | `monitoring-summary` | `GET /reporting/monitoring-summary` | none | Executive Summary, Monitoring |
| 8 | `ai-coach-summary` | `GET /reporting/ai-coach-summary` | none | Executive Summary, Progress Overview, Path Completion, Quiz Performance, Recent Activity |
| 9 | `executive-summary` | `GET /reporting/executive-summary` | none | Executive Summary, Engine 1 — Institutional Investing, Engine 2 — Institutional Trading, Engine 3 — Options Income |

`GET /reporting/types` returns the machine-readable metadata (`label`, `description`, `requiresSymbol`, `requiresPortfolio`) driving the Report Builder's own form.

## 4. Symbol-scoped reports never invent management quality or portfolio context

Reports 1 and 2 reuse the exact `resolveDecisionManagementQuality()`/`resolveDecisionPortfolioContext()` helpers `/decision/:symbol` and `/investment-memo/:symbol` already call (exported from `routes/stockAnalyst.ts` this phase). Management Quality is honestly `unavailable` whenever Document Intelligence/EDGAR can't resolve a filing; Portfolio Fit is honestly `unavailable` when no `?portfolioId=` is supplied — never approximated.

## 5. The "Investment Memo" section is the full document, verbatim

Unlike the other Company Research Report sections (each a single analytical lens), the `investment-memo` section attaches the **entire** `InvestmentMemo` document: `body` is the memo's own `overview`, and `bullets` is one line per memo section (`"{heading}: {first paragraph}"`). This is a deliberate design choice — the granular sections above it are individual pillars pulled from the engine; the Investment Memo section is the complete, already-formal memo document included for institutional filing purposes, without duplicating its content into a second prose format.

## 6. Persistence — `institutional_reports`

`POST /reporting/reports` takes `{reportType, symbol?, portfolioId?}` and **regenerates the report server-side** (never trusts a client-supplied report body — the same discipline `routes/portfolioAI.ts`'s own `POST /reports` follows for the Daily Report) before persisting the full `InstitutionalReport` as `payload` jsonb, alongside promoted `reportType`/`title`/`symbol`/`portfolioId`/`dataSource` columns for cheap listing. `GET /reporting/reports` lists the calling user's own saved reports (newest first, ownership-scoped); `GET`/`DELETE /reporting/reports/:id` fetch/remove one by id (404 for both "doesn't exist" and "isn't yours," the established convention since Sprint 7).

## Cross-references

- `docs/Institutional-Reporting.md` — the audit and the 11-surface integration.
- `docs/Professional-Reporting-Workflow.md` — the Reporting Centre's UI contract.
