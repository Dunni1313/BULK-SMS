# Institutional Monitoring & Alerts Engine

**Phase 16 — Institutional Monitoring & Alerts Engine.** This document describes the platform's Monitoring Engine — a deterministic orchestration layer that continuously evaluates portfolios, watchlists, and saved opportunity screens using every already-existing Institutional Investing engine. It introduces **no new scoring model**. Every alert is a disclosed, rule-based diff over already-computed output.

**A repository audit was performed before any code was written.** It confirmed the platform already had:

- A full Alerts & Notifications foundation (Phase 4, Sprint 56): `platform_notifications` table, a dedup-while-unread mechanism, a 5-minute background scheduler (`startAlertsScheduler`), and a header-mounted `NotificationBell`.
- Two existing trigger sources feeding that foundation: `evaluateWatchlistAlerts()` (watchlist price/margin-of-safety target crossings) and `evaluateRiskAlerts()` (Engine 2 risk hard-cap breaches).
- Every scoring/valuation building block Phase 16's own alert list needs: Business Quality, Investment Quality, Competitive Advantage, Financial Strength, Financial Ratios, Graham/DCF/Buffett valuation, the consolidated Margin of Safety, Tom Nash's conviction score, the Investment Committee's verdict, and the Institutional Decision Engine's own recommendation — all already exposed in one place via `buildOpportunityRow()` (Phase 15).
- `buildPortfolioIntelligence()` (Phase 13) already computes a `qualityDrift` scorecard from a supplied previous snapshot — an existing, proven "diff against what I saw last time" pattern.
- `lib/investingRisk.ts`'s own `capBreached` flags (Phase 2, Sprint 29) for single-symbol and sector concentration.

What did **not** exist: any mechanism to detect a *change* in a symbol's own recommendation/valuation/quality/committee-verdict/Tom-Nash-verdict/financial-strength/dividend over time, any diversification-drift check, and any connection between Opportunity Discovery's saved screens and the alert system. This phase's job was to build only those genuine gaps, as a pure orchestration layer on top of everything above.

---

## 1. What already existed (unmodified this phase)

| Capability | Module | Notes |
|---|---|---|
| Business Quality / Investment Quality / Competitive Advantage / Financial Strength / Financial Ratios / Graham / DCF / Buffett / consolidated Margin of Safety / Tom Nash / Investment Committee / Decision Engine recommendation | `buildOpportunityRow()` (`lib/opportunityDiscovery.ts`, Phase 15) | Reused directly as the canonical "current symbol state" for every symbol-level alert — never recomputed |
| Portfolio quality/risk/diversification scoring, `qualityDrift` scorecard | `buildPortfolioIntelligence()` (`lib/portfolioIntelligence.ts`, Phase 13) | Reused directly; `qualityDrift` already accepts a previous snapshot |
| Single-symbol / sector concentration caps | `lib/investingRisk.ts` (Phase 2, Sprint 29) — `concentration.capBreached`, `sectorExposure.capBreached` | Reused directly |
| Opportunity scanning/ranking/screening | `scanOpportunities()`, `applyScreenerFilters()`, `rankOpportunities()` (`lib/opportunityDiscovery.ts`, Phase 15) | Reused directly for Opportunity Alerts |
| Watchlists, Saved Screens, Portfolio Construction holdings | Existing tables (`value_watchlist`, `investing_saved_screens`, `investing_portfolios`/`investing_holdings`) | Read-only from this phase's own perspective |
| Earnings risk flag | `buildValueResearchReport()`'s own `risks[]` array (`lib/valueReport.ts`) — the "Earnings in ~N days" `RiskFlag` | Reused verbatim for Earnings Alerts, zero new fetch |
| Alerts persistence, dedup, background scheduler | `lib/notifications.ts`, `platform_notifications` (Phase 4, Sprint 56) | Extended, not replaced (see §3) |
| Provider infrastructure, Authentication, Caching, system-health Monitoring | Existing, unmodified | Reused as-is |

None of these were rewritten or duplicated. `lib/monitoringEngine.ts` composes on top of them.

## 2. Genuine gaps identified and built this phase

- **Symbol-level change detection** — comparing today's `OpportunityRow` for a watched symbol against the last one observed, framing any real difference (recommendation, valuation, quality, committee verdict, Tom Nash verdict, financial-strength deterioration, dividend change) as an alert.
- **A generic "last observed state" cache** (`investing_monitoring_states`) — the one new persistence primitive this phase introduces, purely for change-detection diffing. It is explicitly **not** the same category as the platform's existing explicit-user-save-only snapshot tables (`investing_decision_snapshots`, `investing_portfolio_snapshots`, `investing_risk_snapshots`): it is written automatically on every evaluation, overwritten (never appended), and holds no independent analytical value of its own.
- **Portfolio diversification-drift detection** — the one small, disclosed extension of `buildPortfolioIntelligence()`'s own quality-drift pattern, applied to a metric (diversification) that function doesn't already diff.
- **Opportunity Alerts** — detecting when a symbol newly appears in a saved screen's top-ranked results.
- **Alert Notes** — a lightweight, per-alert or per-symbol note table.
- **A dedicated Monitoring Dashboard UI** (Active Alerts / Alert History / Timeline / Filters / Alert Details / Alert Notes).
- **5 new fields on every alert** (`severity`, `previousValue`, `currentValue`, `evidence`, `recommendedAction`) so every alert — old and new types alike — carries a full, evidence-based explanation.

## 3. What this phase built

### 3.1 `lib/monitoringEngine.ts` — the core orchestration module

Pure, disclosed, deterministic diff functions over already-computed engine output:

- `resolveMonitoredSymbols(userId)` — the union of a user's Watchlist symbols and Portfolio Construction holding symbols. Automatic monitoring is **bounded to this set**, never the full Opportunity Discovery universe, mirroring the exact bounded-scope discipline the original Alerts evaluators already established.
- `evaluateSymbolMonitoringAlerts(userId, provider)` — for each monitored symbol, resolves `Fundamentals` → `buildValueResearchReport()` → `buildOpportunityRow()` (exactly the same composition `lib/opportunityDiscovery.ts` already performs), diffs the result against the last-observed state (`diffSymbolState()`), appends an Earnings Alert if the report's own risk flags carry one, then persists the new current state.
- `evaluatePortfolioMonitoringAlerts(userId, provider)` — for each Portfolio Construction portfolio, resolves holdings → `buildPortfolioIntelligence()` (with the last-observed snapshot passed in), reads off `qualityDrift`/`sectorExposure.capBreached`/`concentration.capBreached` directly, computes the one new diversification-drift check, then persists the new snapshot.
- `evaluateOpportunityMonitoringAlerts(userId, provider)` — **on-demand only**, never part of the automatic background tick (see §3.3). For each saved screen, re-runs the existing scan/filter/rank pipeline, diffs the top-10 symbol list against the last-observed list, and reports genuinely new entries.

`diffSymbolState()` and `earningsAlertFor()` are pure functions with zero I/O, independently unit-tested against hand-built fixtures.

### 3.2 New database objects

- `investing_monitoring_states` — `(userId, entityType, entityKey) → stateJson`, a generic, overwritten-on-every-tick cache. `entityType` is `"symbol" | "portfolio" | "saved_screen"`.
- `investing_alert_notes` — mirrors `investing_decision_notes`: a user-authored note attached to a specific notification (`notificationId`, a loose, unenforced reference) or a symbol.
- `platform_notifications` gains 5 additive columns: `severity`, `previousValue`, `currentValue`, `evidence` (jsonb string array), `recommendedAction`.

### 3.3 Automatic vs. on-demand evaluation

`evaluateAndPersistAlertsForUser()` (the function the 5-minute background scheduler already calls) now runs **four** evaluators in parallel: the two pre-existing (Watchlist, Risk) plus the two new automatic ones (Symbol, Portfolio). **Opportunity Alerts are deliberately excluded from this automatic path** — a full opportunity scan is real, non-trivial work (up to ~70 report builds per screen), and running it automatically every 5 minutes for every user with a saved screen would break Phase 15's own disclosed cost-control discipline. Opportunity Alerts are evaluated only from the new, explicit `POST /monitoring-engine/check` route.

### 3.4 New routes (`routes/monitoringEngine.ts`)

- `POST /monitoring-engine/check` — the full, on-demand check: runs the same four automatic evaluators `POST /notifications/check` already runs, **plus** Opportunity Alerts, merging and persisting all of it through the shared `persistAlertCandidates()`.
- `GET`/`POST /monitoring-engine/alert-notes`, `PATCH`/`DELETE /monitoring-engine/alert-notes/:id` — Alert Notes CRUD, ownership-scoped.

Deliberately a distinct route namespace from the existing, unrelated `GET /monitoring/status` (Phase 6, Sprint 74's system/job health monitoring) — two different meanings of "monitoring" in this codebase, never conflated.

### 3.5 UI — new `MonitoringDashboard.tsx` page at `/monitoring-dashboard`

Active Alerts / Alert History / Timeline tabs, Filters (severity/type/symbol), an always-visible "Alert Details" view per card (title, message, severity badge, data-source badge, previous → current, evidence bullets, recommended action, timestamp), Alert Notes (per-alert notes dialog), and an explicit "Run Full Check" button. Permanent labels: **Institutional Monitoring, Educational, Deterministic, Evidence Based.**

### 3.6 Integrations

- **Institutional Home** — cross-links from the existing Notifications, Decision Engine, Opportunity Discovery, and Portfolio Manager widgets to `/monitoring-dashboard`.
- **Institutional Mentor** — a new "Monitoring Alerts Review" card, a pure client-side composition reusing `GET /notifications` directly, zero change to `lib/institutionalMentor.ts`.
- **Learning Centre Glossary** — 4 new terms: Monitoring Alert, Alert Severity, Portfolio Drift Alert, Watchlist & Opportunity Triggers.
- **Command Palette / Global Search / Navigation** — automatically covered by adding "Institutional Monitoring" to the single shared `NAV_ITEMS` source (`lib/nav-items.ts`).
- **Portfolio Manager, Decision Engine, Opportunity Discovery** — each already covered via the Institutional Home cross-links above, since none of those pages themselves needed a new data fetch.

## 4. Safety invariants

- Advisory/education only — never previews, schedules, or submits any order, never touches a real brokerage account.
- Zero new scoring model, valuation formula, quality metric, or risk formula anywhere in this phase — every alert quotes an already-computed figure.
- Zero LLM calls, zero price forecasting, zero probability guessing.
- Never-fabricate discipline: a symbol/portfolio/saved-screen with no prior observed state produces **no change-type alert** on its first evaluation — a baseline is being established, not a genuine change, matching this codebase's established honest-first-run discipline (and a bug in the initial implementation of Opportunity Alerts, where "no baseline" was briefly treated as "everything is new," was found and fixed during this phase's own test-writing).

## Cross-references

- `docs/Alert-Framework.md` — the full alert-type taxonomy, required fields, severity rules, and the dedup mechanism.
- `docs/Monitoring-Workflows.md` — day-to-day usage workflows.
- `docs/Opportunity-Discovery.md` — Phase 15's own module, reused here for opportunity scanning/ranking.
- `docs/Institutional-Portfolio-Manager.md` (Phase 13) — `buildPortfolioIntelligence()`'s own documentation, reused here for portfolio-level alerts.
