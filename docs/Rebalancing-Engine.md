# Institutional Portfolio Rebalancing & Allocation Planning Engine

Phase 41 — a deterministic Portfolio Rebalancing & Allocation Planning
Engine that lets institutional users compare current allocations with
target allocations and evaluate proposed portfolio changes.

**This phase provides planning and analysis only.** Nothing here
implements or evaluates trade recommendations, buy/sell signals,
automatic portfolio optimisation, automatic rebalancing, auto
execution, AI predictions, forecasting, machine learning, or broker
integration changes. Every figure is either reused verbatim from an
existing, already-tested engine, or plain deterministic arithmetic
(drift, capital movement in dollars) over those already-computed
figures.

## Where to find it

`/rebalancing-engine`, linked from the sidebar navigation, the Command
Palette (inherits the nav entry automatically), the Investing Executive
Dashboard, the Executive Intelligence Hub, the Cross-Engine Workspace's
own Workspace Shortcuts, and the Institutional Reporting Centre (two
new report types). The Learning Centre overview is reached indirectly
— every Coach & Learning topic links out to real, already-existing
Learning Centre content, never a new lesson page.

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were
confirmed present and load-bearing for this phase (full detail in
`docs/Institutional-Rebalancing-Model.md`):

| Component | Reused for |
|---|---|
| `lib/portfolioConstruction.ts`'s `computePortfolioAllocation()` (Phase 2 Sprint 28) | The entire Current Allocation / Target Allocation / Allocation Drift engine — called twice per Rebalancing Planner comparison, once against a portfolio's own stored target weights, once against a caller-supplied proposed set |
| `lib/riskExposureEngine.ts`'s `buildRiskExposureDashboard()` (Phase 37) | Sector Allocation, Asset Allocation, Strategy Allocation, Capital Allocation, Buying Power Overview, and the Allocation Timeline (its own Concentration Timeline) |
| `lib/coach.ts`'s `COACH_DISCLAIMER` | The Rebalancing Engine's own AI Coach |
| `lib/learningPaths.ts`'s existing topic content | The Rebalancing Engine's own Learning Centre links |

**Genuine gap found:** the platform's existing Portfolio Optimizer
(`lib/portfolioOptimisation.ts`, Phase 18) is a quality-based
Upgrade/Trim/Exit/Core classifier driven by the Decision Engine's own
Buy/Hold/Sell recommendations — an entirely different concept from a
Current-vs-Target weight comparison, and shares no reusable core logic
with what this phase needs. Trading positions and Options trades also
carry **no stored target-weight field anywhere in this codebase** —
only `investing_holdings.target_weight_pct` exists — so Current vs.
Target Allocation and the Rebalancing Planner are honestly
Investing-only, disclosed via `targetAllocationAvailability` rather
than approximated for the other two engines. New
`lib/rebalancingEngine.ts` is the pure composition + one genuinely new
arithmetic layer (capital movement required) that fills these gaps.

## Views

The main page (`RebalancingEngine.tsx`), with 4 tabs: Allocation
Dashboard, Rebalancing Planner, Coach & Learning, Reporting.

### Current Allocation / Target Allocation / Allocation Drift

Per Investing portfolio, every holding's own already-computed current
(market-value-weighted) percentage, stored target percentage, drift in
percentage points, and rebalance-action classification (`buy`/`sell`/
`hold`/`unknown`) — reused verbatim from `computePortfolioAllocation()`,
zero recomputed allocation math.

### Sector Allocation / Asset Allocation / Strategy Allocation

Direct reuse of the Risk & Exposure Engine's own already-computed
`sectorConcentration`/`assetAllocation`/`strategyConcentration` fields
— zero new sector/strategy scoring in this phase.

### Capital Allocation

Investing, Trading, and Options capital figures shown side by side,
reused directly from the Risk & Exposure Engine's own
`capitalAllocation` — **never blended into one total**, since a
target-weight construction book, a real trading account, and an
options income book are genuinely different kinds of capital.

### Allocation Timeline

The Risk & Exposure Engine's own Concentration Timeline, reused
verbatim — real, historical data points from saved Investing risk
snapshots and the Options Exposure Timeline, never a fabricated
history.

### Rebalancing Planner (Proposed Allocation Comparison)

The one interactive feature of this phase: pick a portfolio, enter
manual proposed target weights per holding, and compare against the
current allocation. Computes, per holding, the current weight, the
stored target, the proposed target, the drift from the proposed
target, the rebalance action against the proposed target, and the
dollar **capital movement required** — the amount that would need to
move in or out of that holding to close its drift from the proposed
target exactly. **Never a suggested trade, never a share count, never
an order** — a dollar figure only, computed as
`-(driftPct / 100) * totalMarketValue`. Totals roll up into "capital to
deploy" and "capital to raise."

### Target Allocation Availability

An honest, always-present disclosure of which engines have a genuine,
stored target-weight concept to compare against: Investing available;
Trading and Options unavailable, each with its own stated reason.
Never approximated for an engine that has none.

## AI Coach & Learning Centre

`lib/rebalancingCoach.ts` — 5 deterministic, template-based
explanations (portfolio allocation, rebalancing concepts,
diversification, capital efficiency, portfolio construction), reusing
the platform's existing `COACH_DISCLAIMER` unmodified. **Never a trade
recommendation** — enforced structurally, since
`explainRebalancingTopic()`'s own signature takes only a topic key,
never a symbol, position, or account figure.

`lib/rebalancingLearning.ts` connects each of 6 distinct topics (asset
allocation, portfolio construction, diversification, capital
allocation, institutional rebalancing, risk management) to real,
already-existing Learning Centre content — zero duplicated lesson
content. Deliberately a separate topic list from the Coach's own 5
topics, per the kickoff's own two distinct lists.

## Reporting Centre integration

Two new report types, both pure reformats of already-computed engine
output — see `docs/Allocation-Planning.md` for full detail on the
Rebalancing Planning Report.

- **Portfolio Allocation Report** (`GET /reporting/portfolio-allocation-report`)
  — Current vs. Target Allocation and Drift per portfolio, plus
  cross-engine Sector/Asset/Strategy/Capital Allocation and the
  Allocation Timeline.
- **Rebalancing Planning Report** (`GET /reporting/rebalancing-planning-report/:portfolioId`)
  — one portfolio's own Proposed Allocation Comparison, defaulting the
  "proposed" targets to the portfolio's own stored targets when the
  generic Reporting Centre flow supplies no caller-specific proposal
  (the interactive Rebalancing Planner with a real caller-supplied
  proposal remains `POST /rebalancing/portfolios/:id/propose`).

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/rebalancing/dashboard` | The full Rebalancing dashboard for the calling user |
| POST | `/rebalancing/portfolios/:id/propose` | The Rebalancing Planner — compares current allocation against a caller-supplied set of proposed target weights |
| GET | `/rebalancing/coach` | All 5 AI Coach explanations |
| GET | `/rebalancing/coach/:topic` | One explanation (404 for unknown topic) |
| GET | `/rebalancing/learning` | All 6 topics' own Learning Centre links |
| GET | `/rebalancing/learning/:topic` | One topic's links (404 for unknown topic) |
| GET | `/reporting/portfolio-allocation-report` | Portfolio Allocation Report |
| GET | `/reporting/rebalancing-planning-report/:portfolioId` | Rebalancing Planning Report |

`GET /rebalancing/dashboard` is deliberately a **GET**, matching
`GET /risk-exposure/dashboard`'s and
`GET /decision-support/dashboard`'s own established GET-only precedent
for a dashboard that takes no caller-supplied input beyond the
authenticated user's own identity. `POST /rebalancing/portfolios/:id/propose`
is a **POST** because it accepts a caller-supplied body (the proposed
target weights) — it never persists that body, matching the
kickoff's own explicit "no execution plans" constraint.

## Testing

- `lib/rebalancingCoach.test.ts` / `lib/rebalancingLearning.test.ts` —
  pure unit tests for the deterministic coach/learning modules,
  mirroring the established `decisionSupportCoach.test.ts`/
  `decisionSupportLearning.test.ts` pattern.
- `routes/rebalancingEngine.route.test.ts` — live end-to-end HTTP tests
  against a real Postgres connection and the real Better-Auth instance:
  the honest empty-portfolio dashboard, real per-portfolio Current/
  Target/Drift proven byte-consistent against
  `GET /portfolio-construction/portfolios/:id`, real cross-engine
  Sector/Asset/Strategy/Capital Allocation and the Allocation Timeline
  proven byte-consistent against `GET /risk-exposure/dashboard`, the
  honest Trading/Options `targetAllocationAvailability` disclosure, the
  Rebalancing Planner's correct drift/capital-movement arithmetic
  against a real proposed target, 404 for another user's portfolio or a
  nonexistent portfolio, 400 for a malformed proposal body, tenant
  isolation, the AI Coach and Learning Centre endpoints (including 404s
  for unknown topics), no special-auth requirement, both new Reporting
  Centre report types, and a structural scan proving no trade
  recommendation/buy-sell-signal/forecast/prediction language ever
  appears in any response.
- `pages/RebalancingEngine.test.tsx` — frontend smoke tests following
  the established mocked-generated-hook pattern (a plain GET query hook
  for the dashboard, a `useMutation`-shaped hook for the Rebalancing
  Planner).
- `routes/institutionalReporting.route.test.ts` was extended (not
  rewritten) to cover the 2 new report types and the updated report-type
  count (24 → 26).
