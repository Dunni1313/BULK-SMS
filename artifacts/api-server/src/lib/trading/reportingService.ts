// Phase 24 — Institutional Trading Engine Foundation.
//
// Reporting service boundary. Genuinely unfilled today: Engine 1 has a
// full Institutional Reporting Engine (lib/institutionalReporting.ts,
// Phase 22 — 9 report types, a Reporting Centre UI, persisted saved
// reports) but Engine 2 has no equivalent — confirmed by direct
// inspection before writing this file, not assumed.
//
// lib/institutionalReporting.ts's own shape (a report is
// {reportType, title, subtitle, symbol, portfolioId, generatedAt,
// dataSource, sections: [{id, title, body, bullets?}], disclaimer}) is
// engine-agnostic by construction and should be reused, not
// reimplemented, once Engine 2 gets its own report types (a Market
// Structure Report, a Trading Journal Summary, etc.) — those reports
// would compose the already-shipped tradingMarketStructure.ts/
// tradingRisk.ts/tradingJournal.ts outputs exactly the way Engine 1's
// report builders compose valueReport.ts's own sections.
//
// No report is built here — this file only names the gap and the reuse
// plan for whoever picks it up next.

export const TRADING_REPORTING_STATUS = "not_yet_built" as const;
