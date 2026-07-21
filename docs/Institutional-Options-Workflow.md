# Institutional Options Workflow

An end-to-end walkthrough of how the Options Income Engine (Phase 35,
`/options-income-workspace`) and the Position Lifecycle Manager (Phase 36,
`/options-lifecycle-manager`) work together across a position's real
life — from research to archive. **Every step below is deterministic and
user-driven.** No step in this workflow is automated, predicted, or
recommended by this platform.

## 1. Research & entry (existing, protected)

A position is opened through this platform's own existing, protected
order-entry and execution path (`execution.ts`, `optionsMath.ts`,
`risk.ts`, unmodified by Phases 35–36) — manually, or via the semi-auto
ticket flow already shipped in earlier phases. Once a `trades` row exists
with `status = "open"`, it immediately shows up in both engines below.

## 2. Position appears in the Options Income Workspace

`/options-income-workspace` → **Positions** tab shows the new position's
Underlying, Strategy, Expiration, Premium, Collateral, live Greeks,
Status, and an honestly-derived Lifecycle classification
(`open`/`closed_expired`/`closed_assigned`/…) — the same instant the
`trades` row exists, no extra step required.

## 3. Set an explicit lifecycle stage and review cadence

`/options-lifecycle-manager` → **Position Workspace** tab: select the
position, then explicitly set its stage (`draft` → `planned` → `open` →
…) and its review cadence (`daily`/`weekly`/`monthly`/`expiration`/
`manual`). Until this step, the position shows the honest default derived
from its own real `trades.status` — never a fabricated stage. **This is
the only way either field ever changes.**

## 4. Build the position's checklist

`/options-lifecycle-manager` → **Checklist** tab: choose the strategy the
position matches (from the same 9-key Strategy Library Phase 35 already
built), instantiating the static institutional checklist template for
that strategy. Check items off as you confirm them. Completing every item
never submits an order, never triggers an adjustment, and never advances
the lifecycle stage automatically.

## 5. Ongoing monitoring — reviews, adjustment notes, assignment notes

As the position matures, log dated entries on its own Position Timeline:

- A **review** (tagged with the same cadence vocabulary as the review
  schedule) records what you checked and what you concluded.
- An **adjustment note** records a real decision you made outside this
  platform (e.g., "rolled the short put down 5 strikes") — the
  **Adjustment Journal** is this same log, filtered.
- An **assignment note** records your own assessment of assignment risk
  over time — the **Assignment Tracker** is this same log, filtered. It
  never predicts whether a specific position will actually be assigned.

Move the stage forward explicitly as circumstances change —
`monitoring` → `near_expiration` → `assignment_risk` as appropriate —
each move is itself recorded onto the same timeline as a `stage_change`
event.

## 6. Portfolio-wide review

`/options-lifecycle-manager` → **Portfolio Management** tab (or the
equivalent Options Income Workspace tabs): review position/strategy/
sector concentration, the expiration ladder, capital and buying-power
utilisation, income allocation, the Expiration Tracker, and the Portfolio
Exposure Timeline — all reused directly from the existing Portfolio Risk
Dashboard and Options Income Engine, plus the Position Lifecycle Summary
tallying every position by its own real stage.

## 7. Learn as you go

`/options-lifecycle-manager` → **Coach & Learning** tab: the deterministic
AI Coach explains lifecycle mechanics, the review process, assignment
mechanics, capital allocation, and portfolio concentration — never a
trade recommendation. Below it, each lifecycle stage links out to
relevant, already-existing Learning Centre lessons (never duplicated
content) — `near_expiration`/`assignment_risk` link directly to the
Assignment Mechanics lesson.

## 8. Close the position

The position closes through the existing, protected close/exit flow.
Its lifecycle stage naturally defaults to `closed` once
`trades.status = "closed"` (or can be set explicitly beforehand). A final
review or closing note can be logged on its own timeline before moving it
to `archived` for long-term record-keeping.

## 9. Reporting

At any point, generate a point-in-time report from the Institutional
Reporting Centre (`/reporting-centre`, or the direct deep links on the
Lifecycle Manager's **Reporting** tab):

- **Options Portfolio Review** — the full portfolio-management picture.
- **Position Lifecycle Summary** — the stage tally and awaiting-review
  count.
- **Options Income Summary** (Phase 35) — income overview, theta
  projection, strategy mix, upcoming expirations.

Every report can be saved, listed, and deleted like any other report type
on the platform.

## What never happens automatically

At no point in this workflow does the platform: place a live order,
auto-execute a trade, auto-adjust a position, predict a direction,
recommend a position, send a trade alert, automatically roll a position,
or automatically handle an assignment. Every state change described above
is a real, explicit HTTP request initiated by the user.
