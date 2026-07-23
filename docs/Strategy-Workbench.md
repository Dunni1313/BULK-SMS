# Institutional Strategy Workbench

Phase 31. A workflow and orchestration layer over the Phase 30
Institutional Strategy Framework: browse your own registered strategies,
open one in a working Workspace, compare several side by side, consult the
Strategy Coach, record notes, and save your review session — all without
implementing or evaluating any named trading methodology.

**This is a workflow phase, not a strategy phase.** Like Phase 30, nothing
here ships ICT, SMC, ASAD, Trader Bill's method, Tom Nash's method, the
Dunni Framework, or any other named methodology. No automated entries or
exits, no trading signals, no broker execution. Strategies remain metadata
and workflow only.

## Where to find it

`/strategy-workbench`, linked from the sidebar navigation, the Command
Palette (inherits the nav entry automatically), the Trade Workspace, Trade
Planning Studio, Trading AI Coach, the Learning Centre overview, and the
Investing Executive Dashboard's own navigation-shortcut card.

## What it is

- **Strategy Browser** — the left-hand panel listing every strategy
  you've registered. Click a strategy to open it in the Workspace; check
  its box to add it to the Comparison set below.
- **Strategy Workspace** — the active strategy's own metadata, Strategy
  Validation Summary, Evidence Viewer, Checklist Review, Learning
  Viewer, Strategy Coach panel, and Strategy Notes — all reused from the
  Phase 30 Strategy Framework's own components, not a second copy of
  their logic.
- **Strategy Checklist Review** — instantiate a real checklist from the
  strategy's own template, toggle item completion, and record checklist
  notes — identical engine to Phase 30's Checklist Engine.
- **Strategy Evidence Explorer** — which existing deterministic engines
  (Market Structure, Liquidity & Session, Risk, Trade Planning, Journal,
  AI Coach) this strategy's author considers relevant. A pure citation
  list, never a calculation.
- **Strategy Notes** — free-text notes about your review session, reused
  from the existing Trade Workspace notes system (`trading_workspace_notes`,
  Phase 25) under a `STRATEGY:<id>` pseudo-symbol — no new persistence.
- **Strategy Learning Panel** — the strategy's own educational notes and
  references, plus a "Mark as viewed" action that records real Learning
  Progress.
- **Strategy Coach Panel** — the 9th deterministic Trading Coach
  (Phase 30), explaining the strategy's own metadata and checklist
  completion. Never evaluates whether the methodology itself is sound.
- **Strategy Validation Summary** — an honest read-back of the real
  structural validation every persisted strategy already passed at write
  time.
- **Strategy Comparison** — a deterministic, metadata-only comparison
  table over every strategy you've checked in the Browser. See
  `docs/Strategy-Comparison.md` for exactly what is and isn't compared.
- **Strategy Report Viewer** — an embedded, compact view of the
  Reporting Centre's own Strategy Framework Summary report, with a link
  out to the full Reporting Centre.
- **Save Workspace** — names and saves your current active strategy +
  comparison selection locally in this browser (`localStorage`), the same
  Saved-Layouts pattern the Research Terminal (Phase 20) already
  established. No server persistence.

## Workflow

Browse Strategy Registry → Select Strategy → Review Metadata → Review
Checklist → Review Evidence Requirements → Compare Strategies → Open
Learning → Consult Strategy Coach → Record Notes → Save Workspace.

The page's own header renders this exact sequence as a numbered step
list, so the intended flow is always visible, though every panel remains
independently usable — nothing forces a strict linear order.

## What it deliberately does not do

- No strategy performance analytics, backtest, or win-rate figure
  anywhere on this page.
- No ranking of strategies by any notion of quality — the Comparison view
  only ever presents metadata side by side.
- No new trading logic, automated entries/exits, signals, or broker
  execution of any kind.

See `docs/Strategy-Comparison.md` and `docs/Strategy-Learning.md` for the
Comparison and Learning integration specifics, and `docs/Strategy-Framework.md`
/ `docs/Strategy-Architecture.md` / `docs/Strategy-Integration.md` (Phase 30)
for the underlying framework this page orchestrates.
