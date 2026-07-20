# Executive Dashboard

**Phase 23 — Executive Dashboard & Production Readiness.** One executive landing page for the Institutional Investing Engine, consolidating 11 already-shipped feeds into a single screen. This is a consolidation phase, not a feature phase — no new valuation model, no new scoring system, and no new recommendation was built for this dashboard.

---

## 1. What it is

`ExecutiveDashboard.tsx`, mounted at `/stock-analyst/executive-dashboard` (nav label "Investing Executive Dashboard", to avoid confusion with the pre-existing Engine 2/3 "Institutional Dashboard" at `/institutional-dashboard`). It surfaces 11 panels on one screen:

| Panel | Data source | Phase originally built |
|---|---|---|
| Daily Executive Summary | `GET /reporting-centre/reports/executive-summary` | 22 |
| Portfolio Health | `GET /reporting-centre/reports/portfolio-health/:portfolioId` (first portfolio) | 22 |
| Active Opportunities | `GET /reporting-centre/reports/opportunity-discovery` | 22 |
| Monitoring Summary | `GET /reporting-centre/reports/monitoring-summary` | 22 |
| Investment Committee Activity | `GET /reporting-centre/reports/investment-committee/:symbol`, for the most recently decided symbol | 22 (report), 19 (recent-decisions feed) |
| AI Coach Progress | `GET /reporting-centre/reports/ai-coach-summary` | 22 |
| Recent Reports | `GET /reporting-centre/reports` (saved report history) | 22 |
| Watchlists | `GET /stock-analyst/value-watchlist` | 15 |
| Saved Research | `GET /stock-analyst/research-notes` | 20 |
| Recent Decisions | `GET /stock-analyst/decision/snapshots/recent` | 19 |
| Research Terminal shortcuts | Static navigation links (Analyse/Compare/Split), no fetch | 20 |

**Zero new backend routes, zero new database tables, zero new `openapi.yaml` schemas.** Every one of the 11 panels reads an endpoint that already existed and was already independently tested before this phase began.

## 2. Design decisions

- **The 6 report-shaped panels** (Daily Executive Summary, Portfolio Health, Active Opportunities, Monitoring Summary, Investment Committee Activity, AI Coach Progress) all share one page-local `<ReportSummaryCard>` component — a condensed view of the same `InstitutionalReport` shape (`{title, subtitle, sections: [{id, title, body, bullets?}]}`) that `ReportingCentre.tsx` already renders in full. The dashboard never re-derives a section's content; it shows the first 2 sections' body/bullets and links out to the full report in the Reporting Centre.
- **Investment Committee Activity** needed a symbol to fetch (`getInvestmentCommitteeReport(symbol)` has no zero-arg form). Rather than fabricate a "most active symbol" concept, the dashboard uses the most recently decided symbol from the existing Recent Decisions feed (`GET /stock-analyst/decision/snapshots/recent`) — a real, already-computed piece of activity, not an invented one. When there are no recent decisions, the panel honestly shows "No recent decisions yet" rather than a fabricated committee read.
- **Portfolio Health** picks the first portfolio returned by `GET /portfolio-construction/portfolios`. A user with no portfolios sees an honest empty state linking to Portfolio Construction, never a fabricated health score.
- **Recent Reports/Watchlists/Saved Research/Recent Decisions** are plain condensed lists (not `ReportSummaryCard`s, since their underlying data isn't report-shaped) with a "view full" link to their own existing page.
- **Research Terminal shortcuts** are pure `<Link>` navigation to `/research-terminal`, `/research-terminal?mode=compare`, `/research-terminal?mode=split` — all three query params were already read by `ResearchTerminal.tsx` itself (Phase 20), so no new deep-link contract was invented.
- Every panel independently shows its own loading skeleton, honest error state, and honest empty state — one panel failing or being empty never blocks or fabricates data for any other panel on the page.

## 3. What was deliberately not built

- No new "combined portfolio health score" or "combined risk score" across panels — each panel's number is exactly what its own already-shipped engine computed, never blended into a new synthesis metric.
- No auto-refresh/polling was added beyond each underlying hook's own existing cache behavior — the dashboard is a read surface, not a new real-time feed.
- No new report type, no new report section, no new `institutional_reports` row shape.

## 4. Testing

`ExecutiveDashboard.test.tsx` (6 tests) follows the established mocked-generated-hook pattern already used across every other Institutional Investing Engine page test: an honestly-empty render with zero data anywhere, real report data rendering in the report-shaped panels, an honest per-panel error state, real list data in the 4 non-report panels, and the Investment Committee Activity panel's deep-link correctly following the most recently decided symbol.
