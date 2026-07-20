# Institutional Strategy Framework

Phase 30. A reusable framework that lets you register **your own** trading
methodology as structured, versioned metadata, formalize it into a
checklist, ground each checklist item in the platform's own deterministic
evidence, and review your own discipline through a 9th deterministic
Trading Coach.

**This is a framework, not a strategy.** The platform does not ship ICT,
SMC, ASAD, Trader Bill's method, Tom Nash's method, the Dunni Framework, or
any other named trading methodology. It never will, unless you author it
yourself as your own Strategy metadata. Nothing here trades, signals an
entry/exit, or predicts price — every output is a read-back of what you
entered plus a citation of already-computed, already-existing platform
data.

## What it is

- **Strategy Registry** — a personal list of trading methodologies you
  define: name, description, category (a generic bucket like Trend,
  Reversal, Breakout — never a named school), timeframes, markets, the
  evidence types you require, an educational-notes field, references, and
  a version string.
- **Checklist Engine** — turn a strategy's checklist template into a
  live, per-trade or per-symbol checklist instance. Track required vs.
  optional items, completion state, notes, and evidence links. A
  checklist is honestly "complete" only when every *required* item is
  checked — an empty checklist is never reported complete.
- **Evidence Framework** — every checklist item can cite a piece of
  already-computed platform data: Market Structure, Liquidity, Session,
  Risk, a Trade Plan, a Journal entry, or an AI Coach explanation. The
  framework only packages a citation (source type, label, detail, and a
  deep link) — it never runs a new calculation.
- **Strategy Coach** — the platform's 9th deterministic Trading Coach.
  Explains *your own* registered strategy and *your own* checklist
  progress: what evidence types the strategy asks for, how complete the
  active checklist is, what's missing, common misuse warnings (e.g.
  mistaking a completed checklist for a trading signal). It never
  evaluates whether your methodology itself is sound, and never invents
  a rule you did not write.
- **Strategy Learning** — a new Learning Centre path (`strategy-framework`)
  walking through what a Strategy is in this framework, categories and
  evidence types, how the checklist engine works, and what the Strategy
  Coach can and cannot tell you. Progress tracking reuses the existing
  Learning Progress system.
- **Strategy Framework Summary Report** — a new Reporting Centre report
  type listing your registered strategies and their checklist
  completion stats. It does not compute or project strategy performance.

## Where to find it

- **Strategy Framework** page (`/strategy-framework`) — the Strategy
  Registry, Strategy Detail (metadata + Evidence Viewer + Checklist
  Viewer + Learning Viewer + Strategy Coach), new-strategy form, Guided
  Learning Mode, and Progress Tracker.
- Linked from the **Trade Workspace**, **Trade Planning Studio**, and
  **Trading AI Coach** pages ("Register or review your own Strategy
  Framework").
- Linked from the **Learning Centre** overview tile ("Institutional
  Strategy Framework").
- Available as a report type in the **Reporting Centre**
  ("Strategy Framework Summary").
- Searchable via the **Command Palette** (inherits automatically from
  the shared navigation list).

## What it deliberately does not do (yet)

- No trading logic, no automated entries or exits, no broker execution.
- No strategy-specific checklist content is shipped — you author your
  own checklist items.
- No strategy-specific lessons are shipped — the Learning path teaches
  the *framework*, not a methodology.
- No strategy performance analytics (win rate, expectancy, backtest) —
  the Reporting Centre extension only reports registry/checklist counts
  and completion state.
- No evaluation of whether a strategy's own rules are sound — the
  Validation Framework only checks that the metadata itself is
  well-formed (non-empty fields, valid category, unique checklist item
  ids, a parseable version string).

These are intentional boundaries of this phase, not omissions — see
`docs/Strategy-Architecture.md` for the reasoning and
`docs/Strategy-Integration.md` for exactly how it plugs into the rest of
the Trading Engine.
