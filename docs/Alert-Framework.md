# Alert Framework

**Phase 16 — Institutional Monitoring & Alerts Engine.** This document specifies the alert data model: every alert type, its trigger condition, its severity rule, and the required fields every alert must (and does) carry.

---

## 1. The required fields

Every alert produced by the Monitoring Engine — old and new types alike — carries all of the following, per the Phase 16 brief:

| Field | Type | Meaning |
|---|---|---|
| `title` | string | A short, human-readable headline. |
| `message` (Reason) | string | The one-sentence explanation of why this alert fired. |
| `evidence` | string[] | The specific already-computed figures backing the alert (e.g. a synthesis-score before/after, a rank explanation sentence) — never a vague assertion. |
| `previousValue` | string \| null | The prior value being compared against, when one exists. `null` — never a fabricated placeholder — when there's no meaningful "previous" (e.g. an earnings alert). |
| `currentValue` | string \| null | The current value. |
| `severity` | `"info" \| "warning" \| "critical"` | A deterministic rule per alert type (see §3) — never a subjective judgment. |
| `recommendedAction` | string | A one-sentence pointer to the relevant page for follow-up (e.g. "Review AAPL on the Institutional Decision Engine page.") — never an instruction to buy/sell/trade. |
| `createdAt` (Timestamp) | ISO string | Server-stamped at persistence time. |
| `dataSource` | `"SIMULATED" \| "LIVE"` | Sourced from the provider that produced the underlying detection — never hardcoded. |
| `relatedSymbol` | string \| null | The symbol the alert concerns, or `null` for a portfolio-wide alert. |

These map directly onto `platform_notifications`' own columns (`lib/db/src/schema/platformNotifications.ts`) and the `AlertCandidate` interface (`lib/notifications.ts`).

## 2. Alert types

| Type | Trigger | Source engine | Automatic or on-demand |
|---|---|---|---|
| `watchlist_target_crossed` | A watchlist row's buy-price or margin-of-safety target is crossed | `computeWatchlistTargets()` (Phase 2, Sprint 27) | Automatic |
| `risk_cap_breached` | Engine 2 position-sizing or portfolio-risk-budget cap breached | `buildTradingRiskAnalysis()` (Phase 3, Sprint 38/44) | Automatic |
| `decision_change` | A monitored symbol's Decision Engine recommendation changed | `buildOpportunityRow()` (Phase 15) | Automatic |
| `valuation_change` | A monitored symbol's valuation rating changed | `buildOpportunityRow()` | Automatic |
| `quality_change` | A monitored symbol's Business Quality rating changed | `buildOpportunityRow()` | Automatic |
| `committee_change` | A monitored symbol's Investment Committee verdict changed | `buildOpportunityRow()` | Automatic |
| `tomnash_change` | A monitored symbol's Tom Nash verdict changed | `buildOpportunityRow()` | Automatic |
| `financial_deterioration` | A monitored symbol's Financial Strength rating **downgraded** (never on an upgrade or no-change) | `buildOpportunityRow()` | Automatic |
| `dividend_change` | A monitored symbol's dividend yield was cut to zero, or moved by ≥25% in either direction | `buildOpportunityRow()` | Automatic |
| `earnings_alert` | A monitored symbol's report carries an "Earnings in ~N days" risk flag | `buildValueResearchReport()`'s own `risks[]` (verbatim reuse) | Automatic |
| `portfolio_drift` | A portfolio's quality score or diversification score moved ≥10 points since the last check | `buildPortfolioIntelligence()`'s own `qualityDrift`, plus the new diversification-drift extension | Automatic |
| `sector_concentration_breach` | A portfolio's largest sector exceeds the 40% cap | `lib/investingRisk.ts`'s `sectorExposure.capBreached` | Automatic |
| `position_sizing_breach` | A portfolio's largest single symbol exceeds the 25% cap | `lib/investingRisk.ts`'s `concentration.capBreached` | Automatic |
| `opportunity_match` | A symbol newly appears in a saved screen's top-10 ranked results | `scanOpportunities()`/`applyScreenerFilters()`/`rankOpportunities()` (Phase 15) | **On-demand only** — never part of the automatic 5-minute tick |

## 3. Severity rules

Severity is a fixed, disclosed rule per type — never a judgment call:

- **Critical**: a Decision Engine recommendation moving to Sell/Avoid; a dividend cut to zero; Financial Strength downgrading to Risky.
- **Warning**: a Decision Engine recommendation moving to Reduce; a valuation rating moving to Very Expensive; Business Quality moving to Weak; the Investment Committee or Tom Nash verdict moving to Wait; any Financial Strength downgrade not reaching Risky; a dividend cut of ≥25% (but not to zero); a portfolio-level quality/diversification drift, sector-concentration breach, or position-sizing breach; a risk hard-cap breach.
- **Info**: every other change (a recommendation moving to Buy/Accumulate/Hold, a dividend increase, an earnings alert, a watchlist target crossing, an opportunity match).

## 4. Change-detection discipline

Every change-type alert (everything except the two pre-existing trigger sources, `watchlist_target_crossed`/`risk_cap_breached`, which detect a live threshold rather than a change) requires a **prior observed state** to compare against. On the very first evaluation of a symbol, portfolio, or saved screen — with no baseline yet — **no change-type alert fires**: the baseline is simply being established. This is deliberate and consistent across every evaluator in `lib/monitoringEngine.ts`.

## 5. Persistence and dedup

Every alert is persisted to `platform_notifications` via the shared `persistAlertCandidates()` (`lib/notifications.ts`). A candidate is skipped — never duplicated — if an **unread** notification with the same `dedupKey` already exists for that user (a partial unique index on `(user_id, dedup_key) WHERE is_read = false`). Marking an alert read frees its dedup key, so a still-true condition can re-fire once the user has acknowledged it — level-triggered-respecting-read-state, not a full edge-triggered state machine, matching the design Phase 4 Sprint 56 already established.

`dedupKey` format, by category:

- Symbol changes: `monitoring:symbol:{symbol}:{dimension}:{from}->{to}` (or `:cut`/`:increased:{value}` for dividends).
- Earnings: `monitoring:symbol:{symbol}:earnings:{riskFlagText}`.
- Portfolio: `monitoring:portfolio:{portfolioId}:{dimension}`.
- Opportunity matches: `monitoring:saved-screen:{screenId}:match:{symbol}`.

## Cross-references

- `docs/Monitoring-Engine.md` — the full architecture and reuse map.
- `docs/Monitoring-Workflows.md` — day-to-day usage workflows.
