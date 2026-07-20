# Executive Intelligence Summary Report — Reporting Centre Extension

Phase 33. Extends the existing Institutional Reporting Centre
(`lib/institutionalReporting.ts`, Phase 22) with a 13th report type,
`executive-intelligence-summary`, following the exact same pattern every
prior extension of this module has already established (most recently
Phase 32's own `trading-analytics-summary`, the 12th).

## What was added

- A new `InstitutionalReportType` member, `executive-intelligence-summary`,
  and a matching `REPORT_TYPE_META` entry (label, description,
  `requiresSymbol: false`, `requiresPortfolio: false`).
- `buildExecutiveIntelligenceSummaryReport(hub: ExecutiveIntelligenceHub):
  InstitutionalReport` — a pure reformatting function. It computes **no
  new metric**: every section is a direct quote of a field the Executive
  Intelligence Hub (`lib/executiveIntelligence.ts`, this phase) already
  computed.
- `GET /reporting/executive-intelligence-summary` — a standalone route
  that calls `loadExecutiveIntelligenceInputs()`/
  `buildInvestingAnalyticsDashboard()`/`buildTradingAnalyticsDashboard()`/
  `buildExecutiveIntelligenceHub()` (the exact same functions
  `GET /executive/intelligence` itself calls) and reformats the result.
- A new `case "executive-intelligence-summary"` in the existing
  `regenerate()` switch, so the report also participates in the standard
  save/list/get/delete persistence flow every other report type already
  uses (`POST /reporting/reports`, `GET /reporting/reports`, etc.) — no
  new persistence code, the same `institutional_reports` table, no
  migration.

## Report sections

10 sections, each a thin reformatting of one field on the already-computed
`ExecutiveIntelligenceHub` — mirroring the section-per-field pattern
`buildTradingAnalyticsSummaryReport()` (Phase 32) already established:

| Section id | Title | Source field |
|---|---|---|
| `executive-summary` | Executive Overview | `hub.overview.summary` |
| `investment-committee` | Investing Summary | `hub.investing.*` |
| `portfolio-risk` | Trading Summary | `hub.trading.*` |
| `strategy-usage` | Strategy Summary | `hub.strategy` (pass-through of `trading.strategyUsage`) |
| `portfolio-health` | Portfolio Summary | `hub.portfolio` (pass-through of `investing.portfolio`) |
| `risk-analytics` | Risk Summary | `hub.risk` |
| `learning-analytics` | Learning Summary | `hub.learning` |
| `coach-analytics` | AI Coach Summary | `hub.coach` |
| `monitoring` | Reporting Summary | `hub.reporting` |
| `checklist` | Activity Timeline | `hub.activity` (first 15 entries) |

Section ids were deliberately chosen to reuse existing, already-established
ids from other report types (`executive-summary`, `investment-committee`,
`portfolio-risk`, `strategy-usage`, `portfolio-health`, `risk-analytics`,
`learning-analytics`, `coach-analytics`, `monitoring`, `checklist`) rather
than inventing new ones — consistent with the Reporting Centre's own
existing convention of reusing a small, stable id vocabulary across report
types wherever the underlying content is the same shape.

## Frontend integration

`ReportingCentre.tsx`'s `<Select>` for choosing a report type is already
populated dynamically from `GET /reporting/types`, so the new type appears
there with zero frontend change. What genuinely needed a code change:
the page's own local `ReportType` TypeScript union and `REPORT_TYPE_VALUES`
array (used for deep-link validation and the per-type query-hook dispatch
table) gained the 13th value, a new `useGetExecutiveIntelligenceSummaryReport`
hook call was added, and it was wired into the existing `byType` dispatch
record — the same mechanical, 4-line addition every prior report type has
required.

Deep-linking works identically to every other report type:
`/reporting-centre?reportType=executive-intelligence-summary` auto-generates
and displays the report on load.

## What this deliberately does not do

- No new valuation model, scoring system, or recommendation — the same
  disclaimer every Reporting Centre report already carries
  ("`REPORT_DISCLAIMER`... this module creates no new valuation model, no
  new scoring system, and no new investment recommendation") applies here
  unchanged.
- No new database table or migration.
- No changes to any of the other 12 report types' own builder functions,
  routes, or sections.

See `docs/Executive-Intelligence.md` for the full Executive Intelligence
Hub this report reformats, and `docs/Institutional-Reporting.md` for the
Reporting Centre's own original Phase 22 architecture.
