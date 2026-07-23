# Monitoring Workflows

**Phase 16 — Institutional Monitoring & Alerts Engine.** This document describes how the Monitoring Engine actually runs day to day, and the typical user workflows on the Monitoring Dashboard.

---

## 1. How evaluation actually runs

### 1.1 Automatic (background, every 5 minutes)

`startAlertsScheduler()` (`index.ts`, unchanged from Phase 4 Sprint 56) ticks every 5 minutes and, for every user with `alertsEnabled=true`, calls `evaluateAndPersistAlertsForUser(userId)`. As of Phase 16, that function runs **four** evaluators in parallel:

1. `evaluateWatchlistAlerts` — watchlist target crossings (Engine 1, pre-existing).
2. `evaluateRiskAlerts` — Engine 2 risk cap breaches (pre-existing).
3. `evaluateSymbolMonitoringAlerts` — recommendation/valuation/quality/committee/Tom-Nash/financial-strength/dividend/earnings changes across the user's Watchlist + Portfolio Construction holding symbols (new this phase).
4. `evaluatePortfolioMonitoringAlerts` — quality/diversification drift, sector and single-symbol concentration breaches across the user's Portfolio Construction portfolios (new this phase).

Every genuinely new alert is persisted (subject to the dedup rule in `docs/Alert-Framework.md` §5); nothing is ever pushed to email or SMS — the delivery channel remains in-app only, per Phase 4 Sprint 56's own decision.

**Opportunity Alerts are never part of this automatic tick.** A full opportunity scan (up to ~70 report builds per saved screen) is real work; running it automatically for every user with a saved screen every 5 minutes would be a meaningful, undisclosed cost increase. It only runs when a user explicitly asks for it.

### 1.2 On-demand ("Run Full Check")

Clicking **Run Full Check** on the Monitoring Dashboard (or calling `POST /monitoring-engine/check` directly) runs all four automatic evaluators **plus** Opportunity Alerts, in one request. This is the only way Opportunity Alerts get evaluated. The existing header `NotificationBell`'s own "Check now" button still calls the narrower `POST /notifications/check` (the four automatic evaluators only) — both buttons are legitimate, they just cover different scope.

## 2. Typical user workflows

### 2.1 "What changed since I last looked?"

1. Open **Institutional Monitoring** (`/monitoring-dashboard`) from the sidebar, Command Palette, or any of the cross-links on Institutional Home / Institutional Mentor.
2. The **Active Alerts** tab shows every unread alert, each with its reason, evidence, previous → current values, severity, and recommended action.
3. Use the **Filters** row (severity, alert type, symbol) to narrow down to what matters right now — e.g. filter to `critical` severity to see only the alerts that need immediate attention.
4. Click **Mark read** once you've acted on or acknowledged an alert. It moves to **Alert History**.

### 2.2 "Has anything changed on my portfolio's composition?"

Portfolio-level alerts (`portfolio_drift`, `sector_concentration_breach`, `position_sizing_breach`) appear the same way as symbol-level ones, with `relatedSymbol: null` for drift/sector alerts (portfolio-wide) or the specific over-concentrated symbol for a position-sizing breach. Follow the **Recommended: Review "..." on the Institutional Portfolio Manager page** link to act on it.

### 2.3 "Did my saved opportunity screen surface anything new?"

Opportunity matches only ever appear after a **Run Full Check**. If you've never run one for a given saved screen, the first check establishes the baseline (no alerts fire yet — see the honest-first-run discipline in `docs/Alert-Framework.md` §4); the *next* check after that reports genuinely new top-10 entries.

### 2.4 Keeping notes

Click **Notes** on any alert to open its Alert Notes dialog. Notes are yours alone — never read by any detection logic, never shared, never affecting severity or dedup. Use them to record why you did or didn't act on a particular alert, for your own future reference.

### 2.5 Reviewing history and the full timeline

- **Alert History** — every alert you've already marked read, still filterable.
- **Timeline** — every alert (read and unread) in one reverse-chronological list, for a full audit trail of what the Monitoring Engine has surfaced over time.

## 3. Where alerts also surface

- The header **NotificationBell** (every page) — unread count + a lightweight popover, unchanged from Phase 4.
- **Institutional Home** — the existing Notifications widget, plus new cross-links from the Decision Engine, Opportunity Discovery, and Portfolio Manager widgets pointing to the full Monitoring Dashboard.
- **Institutional Mentor** — a "Monitoring Alerts Review" card summarizing active-alert counts by severity.

## 4. What this system will never do

- Never place, modify, or cancel a real order.
- Never send an alert via email, SMS, or push notification (in-app only, per the established Phase 4 decision).
- Never fabricate a "why" for an alert — every `evidence` entry quotes a real, already-computed number.
- Never re-alert on a still-true condition while the prior alert remains unread.

## Cross-references

- `docs/Monitoring-Engine.md` — the full architecture and reuse map.
- `docs/Alert-Framework.md` — the alert-type taxonomy and required fields.
