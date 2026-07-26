# Repository Roadmap

Produced by the Documentation Synchronization pass (branch
`docs/repository-baseline-sync`), updated 2026-07-26 following the merge
of PR #6 (`v1.3.1`). Distinct from `docs/Version-2-Roadmap.md` (deep,
feature-by-feature Version 2 planning) — this document is the near-term,
project-status view: what's shipped, what's prioritized next, and what's
further out. Nothing in this document has been implemented as part of
producing or updating it; it is a planning artifact only.

## Completed (everything through v1.3.1)

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
- **Version 1.3.0** — the AI Trading Coach's backend foundation:
  `buildUnifiedCoachContext()`, a pure composition layer assembling
  Engine 2's Structure/Multi-Timeframe/Liquidity/Regime/Probability +
  Trading Positions risk, Engine 3's options-income Portfolio/Dashboard/
  Scanner/AI Opportunity Score, and the user's own recent Trading Journal
  reflections — zero new trading/scoring calculations, routed through the
  existing, unmodified `narrateTradeFreeform()` LLM narration path. Merged
  as PR #5 (`docs/v1.3.0-AI-Trading-Coach-Design.md`'s Sprint 1 as-built
  section, `CHANGELOG.md`'s `[v1.3.0]` entry).
- **Version 1.3.1** — the AI Trading Coach's full frontend UI (a dockable
  panel and a permanent `/ai-trading-coach` page sharing one
  `TradingCoachWorkspace`; 12 new Coach components; context-aware
  triggers on Scanner, Trade Execution Center, Options Dashboard,
  Portfolio, and Trading Research) plus coloured, full-width, engine-
  themed sidebar section headers. Merged as PR #6, merge commit `621ff40`,
  2026-07-26 (`docs/v1.3.0-AI-Trading-Coach-Design.md`'s Sprints 2–5
  as-built section, `docs/v1.3.1-Sidebar-Section-Headers.md`,
  `CHANGELOG.md`'s `[v1.3.1]` entry). Zero backend files touched; the 5
  protected files remain zero-line-diff.

## Current development

No branch is currently in active development as of this update
(2026-07-26) — `v1.3.1-ai-trading-coach-ui` was merged and its local copy
deleted; `main` is the sole active branch pending a new, explicitly
approved milestone. The former "v1.2 priorities" list below is retained
for its still-relevant items and status:

1. ~~**Trade Execution Center.**~~ **Status: SHIPPED (v1.2.0).**
2. ~~**AI Trading Coach (backend + UI).**~~ **Status: SHIPPED (v1.3.0 +
   v1.3.1).**
3. **Timeline visualization improvements.** `PortfolioConstruction.tsx`'s
   Timeline tab (Phase 13) exists and functions but is the one
   under-documented surface of that page — `docs/Institutional-Portfolio-Manager.md`
   names it as a tab without the same depth of treatment given to
   Quality/Risk/Performance. **Status: functioning, documentation-light,
   unchanged since the last update.** Candidate work: a dedicated Timeline
   section in that doc, plus a review of whether the visualization itself
   (not just its documentation) warrants enhancement.
4. **Portfolio Intelligence polish.** General upkeep across
   `lib/portfolioIntelligence.ts` and its consuming pages/reports —
   accessibility, error-state, and layout consistency passes of the kind
   Phase 23 already ran for the Investing Engine broadly, scoped
   specifically to the Portfolio Intelligence surfaces this time.
   **Status: not started; no specific defect currently on file.**
5. **Documentation alignment.** The original synchronization pass
   (`CLAUDE.md` §3a–§3e, `docs/Architecture.md`'s new sections, this
   roadmap, `docs/Technical-Debt-Register.md`) plus this update reflecting
   v1.3.0/v1.3.1 into `CHANGELOG.md`, `README.md`, and this document.
   **Status: current as of this update.**
6. **Remote branch housekeeping.** `v1.3.1-ai-trading-coach-ui` remains on
   `origin` after merge — this environment's git proxy rejects remote
   branch deletion, so removal is a manual, human-only action. **Status:
   recorded in `docs/Operations-Handbook.md` §6.25 as a pending
   maintenance item; not a release blocker** (the branch is fully merged
   and has no functional effect).

## Future

- **Frontend E2E coverage expansion.** A broader end-to-end coverage
  sweep beyond the smoke-level suite that exists today (Phase 6's own
  "unscheduled" list item, never picked up).
- **Phase 3 Route+UI redundancy review.** Confirm whether the original
  Phase 3 Market Structure/Liquidity/Multi-Timeframe pages are now
  redundant with the Phase 26/27 Workbenches that superseded them, rather
  than building anything new on top of either.
- **Live-data/live-broker verification** (Phase 6 Sprints 75/76: Live
  FMP/Alpha Vantage, Live Alpaca Broker Verification) whenever real
  credentials become available; at that point each becomes a pure
  verification pass over already-built, already-tested provider code, per
  their own established precedent — no new logic.
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
