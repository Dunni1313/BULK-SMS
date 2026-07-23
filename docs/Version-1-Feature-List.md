# Version 1 Feature List

Every feature below is real, shipped, tested, and reachable from the
platform's own navigation as of v1.0.0 — this list was generated from
the actual navigation registry (`lib/nav-items.ts`), not written from
memory. For the full build history behind each item, see `CLAUDE.md`.

## Engine 1 — Institutional Investing

- **Research & valuation**: Research Terminal, Value Research, Investment
  Committee (AI-synthesized, consolidating Graham/Buffett/Tom Nash/DCF
  valuation models), Decision Engine / Decision Support Engine.
- **Portfolio**: Portfolio Construction, Rebalancing Engine, Portfolio
  Optimisation.
- **Risk & performance**: Risk & Exposure Engine, Concentration Risk,
  Event Risk, Scenario & Stress Testing Engine, Performance & Attribution
  Engine.
- **Compliance & governance**: Monitoring & Compliance Engine.
- **Discovery**: Opportunity Discovery, Watchlists & Opportunity
  Dashboard.
- **AI & education**: Institutional AI Coach, Institutional Mentor, AI
  Teacher & Learning Centre, Learning Paths, Glossary, Value Investing
  School, Strategy Academy.

## Engine 2 — Institutional Trading

- **Structure & regime**: Market Structure Workbench, Liquidity & Session
  Workbench, Trading Research.
- **Workspace**: Trade Workspace, Trade Planning & Risk Studio, Trading
  Analytics.
- **Journal & review**: Trading Journal, Trading Backtest.
- **AI**: Trading AI Coach.

## Engine 3 — Options Income (the platform's original foundation)

- **Scanning & strategy**: Stock Scanner, Scanner, Strategy Workbench,
  Strategy Framework, Opportunity Discovery.
- **Positions & execution**: Trades, Position Lifecycle Manager, Trade
  History, Adjustment Preview, Adjustments, Order Preview, Position
  Sizing, Option Chain.
- **Automation**: AutoPilot — with an explicit, live-re-checked kill
  switch (`autoExecuteEnabled`/`autoAdjustEnabled`) gating every automated
  action, never a fire-and-forget cycle.
- **Portfolio**: Portfolio, Portfolio AI, Options Dashboard, Options
  Income Workspace, Portfolio Dashboard, Paper Portfolio, Broker
  Reconciliation.
- **Performance & backtesting**: Performance, Trade Performance, Backtest,
  Options Backtest, Leaderboard.
- **Journal & education**: AI Trade Journal, Trade Lessons, Delta
  Masterclass, Greeks Tutor, Trading Quiz.

## Shared platform

- **Executive surfaces**: Command Center, Institutional Dashboard,
  Institutional Home, Investing Executive Dashboard, Executive
  Intelligence, Institutional Intelligence, Institutional Workspace,
  Cross-Engine Workspace, Institutional Portfolio Workspace (the primary
  cross-engine operating interface — Executive Home, Portfolio Snapshot,
  per-engine overviews, Recent Reports, Active Workflows, Outstanding
  Issues, all composed from already-built engines).
- **Workflow Center**: 9 deterministic, checklist-style institutional
  review workflows (Morning/Weekly/Monthly/Quarterly/Portfolio/Risk/
  Compliance/Performance/Scenario Review) guiding a user through existing
  modules only — never a recommendation, never an automated action.
- **Reporting**: Institutional Reporting Centre — 32 report types, one
  shared envelope and rendering surface, reused across every engine.
- **Alerts**: Notifications (in-app), Event Calendar, Daily Report
  (on-demand, cross-engine, AI-narrated).
- **Operations**: Operations Dashboard (admin-only), Settings.
- **AI Assistant**: AI Assistant (options-domain coach chat).

## Cross-engine intelligence (never blends engines into one fabricated figure)

- **Cross-Engine Command Center**: Engine 1's Investment Committee verdict
  and Engine 2's technical read shown side by side for one symbol, on one
  screen.
- **Macro/Regime Side-by-Side View**: Engine 1's macro context, Engine 2's
  market regime, and Engine 3's market briefing, each independently
  attributed to its own originating engine.
- **Cross-Engine Daily Report**: on-demand, AI-narrated summary combining
  Engine 1's watchlist/macro read, Engine 2's portfolio risk read, and
  Engine 3's options-income health read.

## Platform-wide guarantees

- **Tenant isolation**: every user-scoped table is verified, by a
  dedicated test suite, to never leak data across users.
- **Honesty discipline**: every analytical module reports a genuine
  "unavailable"/"insufficient data" state rather than fabricating a value
  it can't actually compute — enforced structurally throughout, not just
  by convention.
- **SIMULATED-first, honestly labeled**: every deterministic/synthetic
  data source carries an explicit `dataSource: "SIMULATED" | "LIVE"` field
  — never presented as real market data when it isn't.
- **Disclaimer enforcement**: every AI-narrated response, across every
  engine, carries the platform's coach disclaimer, enforced centrally by
  `lib/ai-core`, never bypassable by a new caller.
