# Repository Roadmap

Produced by the Documentation Synchronization pass (branch
`docs/repository-baseline-sync`). Distinct from `docs/Version-2-Roadmap.md`
(deep, feature-by-feature Version 2 planning) — this document is the
near-term, project-status view: what's shipped, what v1.2 is prioritizing
next, and what's further out. Nothing in this document has been
implemented as part of producing it; it is a planning artifact only.

## Completed (everything through v1.2.0)

- **Sprint 1–78** (`CLAUDE.md` §3) — the original 7-phase Blueprint
  buildout: platform foundation (auth, multi-tenancy, `lib/ai-core`, audit
  log), Phase 2 Institutional Investment Decision Engine (Sprints 11–31),
  Phase 3 Institutional Trading Engine (Sprints 32–51), Phase 4 Platform
  Hardening/Cross-Engine/AI Narration (Sprints 52–64), Phase 5 Housekeeping
  (Sprints 65–68), Phase 6 E2E Testing/Production Readiness (Sprints
  69–77; Sprints 75/76 remain explicitly blocked on absent live-provider
  credentials).
- **The Alpaca Paper Trading Expansion** (`CLAUDE.md` §3b) — Broker
  Health, Broker Connection UI, Paper Order Lifecycle & Reconciliation,
  Paper Portfolio Dashboard, Trade History/Performance Analytics, Order
  Preview, Position Sizing, Trade Adjustment Preview, Portfolio Stress
  Test, Event Risk, Concentration Risk, the Portfolio Risk Dashboard, the
  Institutional Command Center.
- **"Phase 8" (Sprints 1–5)** (`CLAUDE.md` §3c) — Institutional
  Intelligence Engine, AI Teacher & Learning Centre, AI Portfolio Analyst,
  AI Trade Journal, Institutional Mentor.
- **"Phase 9" through "Phase 44"** (`CLAUDE.md` §3d) — the 36-phase
  parallel institutional-engine buildout: full Investing Engine expansion
  (Investment Thesis, Portfolio Intelligence, Decision Engine, Opportunity
  Discovery, Monitoring, Portfolio Optimisation, Investment Committee
  Workbench, Research Terminal, AI Coach, Reporting Engine, Executive
  Dashboard); full Trading Engine buildout (domain model, Trade Workspace,
  Market Structure/Liquidity/Strategy Workbenches, Trading Analytics,
  Trading AI Coach); Options Income Engine institutional layer (Income
  Analytics, Position Lifecycle Manager); 8 cross-engine institutional
  intelligence modules (Risk & Exposure, Performance & Attribution,
  Scenario/Stress Testing, Decision Support, Rebalancing, Compliance,
  Watchlists, Portfolio Workspace/Workflow Center).
- **Version 1.0.0** — release-candidate hardening, test-suite fixes (100%
  deterministic pass rate at finalization: 242/242 backend files, 94/94
  frontend files), protected-file zero-diff confirmation, Version 1 freeze
  (`CLAUDE.md`'s "Version 1.0.0 — Finalization, Tag, and Freeze" section).
  Tag prepared locally; remote tag push and GitHub Release publication
  remain a manual, human-only step (`docs/GitHub-Release-v1.0.0.md`).
- **Version 1.1.0** — sidebar navigation redesign: the 82-route
  navigation registry reorganized into 10 collapsible, groupable,
  pinnable, compact-mode sidebar groups, zero routes lost, global command
  palette unaffected (`CLAUDE.md` §3e,
  `docs/v1.1.0-Sidebar-Navigation-Redesign.md`). Tag/release publication
  likewise remains manual (`docs/GitHub-Release-v1.1.0.md`).
- **Version 1.2.0** — the Trade Execution Center: a guided, single-page
  workflow over the Options Income Engine's existing Scanner/Order
  Preview/Risk Validation/Alpaca submission/Trade Monitor pipeline, built
  as a pure composition layer with zero new backend routes and zero new
  business logic (`docs/v1.2.0-Trade-Execution-Center.md`, `CHANGELOG.md`'s
  `[v1.2.0]` entry).

## Current development — v1.2 priorities

1. **Trade Execution Center.** A step-by-step workflow (Scanner → AI
   Opportunity Scoring → Strategy Selection → Order Preview → Risk Review
   → Confirm → Paper Order Submission → Order Status → Trade Monitor →
   Adjust/Close), built explicitly as a composition layer over existing
   Engine 3 modules rather than duplicating them. **Status: SHIPPED
   (v1.2.0)** — see `docs/v1.2.0-Trade-Execution-Center.md` and
   `CHANGELOG.md`'s `[v1.2.0]` entry. Zero new backend routes; zero new
   business logic; the 5 protected files remain zero-line-diff.
2. **Timeline visualization improvements.** `PortfolioConstruction.tsx`'s
   Timeline tab (Phase 13) exists and functions but is the one
   under-documented surface of that page — `docs/Institutional-Portfolio-Manager.md`
   names it as a tab without the same depth of treatment given to
   Quality/Risk/Performance. **Status: functioning, documentation-light.**
   Candidate work: a dedicated Timeline section in that doc, plus a review
   of whether the visualization itself (not just its documentation)
   warrants enhancement.
3. **Portfolio Intelligence polish.** General upkeep across
   `lib/portfolioIntelligence.ts` and its consuming pages/reports —
   accessibility, error-state, and layout consistency passes of the kind
   Phase 23 already ran for the Investing Engine broadly, scoped
   specifically to the Portfolio Intelligence surfaces this time.
   **Status: not started; no specific defect currently on file** (this
   synchronization pass found none during its own read-only inspection).
4. **Documentation alignment.** This synchronization pass itself —
   `CLAUDE.md` §3a–§3e, `docs/Architecture.md`'s new sections, this
   roadmap, and `docs/Technical-Debt-Register.md`. **Status: in progress
   as of this branch** (`docs/repository-baseline-sync`).

## Future

- **v1.3** — candidates from the Phase 6 "unscheduled" list that were
  never picked up: a broader frontend E2E coverage sweep beyond the
  smoke-level suite that exists today, and any residual Route+UI backlog
  items from Phase 3 that were superseded by the Phase 9–44 buildout's own
  equivalent surfaces (e.g. Market Structure/Liquidity/Multi-Timeframe now
  have dedicated Workbenches from Phase 26/27 — worth confirming the
  original Phase 3 pages aren't now redundant with them, rather than
  building anything new).
- **v1.4** — the two still-blocked live-data/live-broker verification
  sprints (Phase 6 Sprints 75/76: Live FMP/Alpha Vantage, Live Alpaca
  Broker Verification) whenever real credentials become available; at
  that point each becomes a pure verification pass over already-built,
  already-tested provider code, per their own established precedent — no
  new logic.
- **v2.0** — see `docs/Version-2-Roadmap.md` in full. Confirmed-still-open
  items at v1.1.0 time: a second broker integration (pending a formal
  `BrokerProvider` seam extraction — itself a protected-file-adjacent
  change requiring the highest scrutiny), a live-trading mode decision
  (Version 1 is paper-trading-only by deliberate, unconditional design),
  mobile, team collaboration, advanced notification channels (email/push,
  deferred at Phase 4 Sprint 56 in favor of in-app only), further AI
  enhancements, and enterprise administration/role-based access (no
  role-based admin functionality exists today beyond the single
  `requireAdmin` gate added in Phase 11).

## Notes on scope discipline

Nothing above should be read as authorization to begin any of this work —
each item still requires its own explicit, separately-approved
kickoff, per the per-sprint/per-phase approval process this project has
followed since Sprint 1 (`CLAUDE.md` §2/§3). This roadmap only records
priority and sequencing intent as stated by the project owner.
