# Institutional Governance Model — Design & Audit Record (Phase 42)

The exact design decisions behind `lib/complianceEngine.ts` and
`lib/compliancePolicies.ts`, kept as a permanent record for future
phases, mirroring the role `docs/Institutional-Rebalancing-Model.md`
plays for Phase 41, `docs/Institutional-Decision-Model.md` plays for
Phase 40, and `docs/Institutional-Risk-Model.md` plays for Phase 37.

## Guiding constraint

The Phase 42 kickoff was explicit: **this phase is monitoring only.**
Do NOT implement trade recommendations, buy/sell signals, portfolio
optimisation, auto rebalancing, auto execution, AI predictions,
forecasting, machine learning, or broker integration changes. Every
figure below was designed against that constraint first — every value
is either (a) reused verbatim from an existing, already-computed
engine output, (b) a generic, reusable comparison (current value vs. a
user-chosen limit), or (c) the one genuinely new arithmetic ratio
(Income Stability), a plain division of two already-computed figures.

## Audit performed before implementation

Before writing any code, the following components were investigated
via direct source reads, per the kickoff's own required audit.

### INVESTING

| Component | Investigated for | Verdict |
|---|---|---|
| Portfolio Dashboard (`lib/portfolioDashboard.ts`, Options-side) | Health-scoring shape | Not applicable — this is the Options Income Engine's own dashboard, not a policy/compliance surface |
| Risk & Exposure Engine (`lib/riskExposureEngine.ts`, Phase 37) | Cross-engine Sector/Strategy/Capital/Buying-Power concentration, Greeks, per-symbol allocation, Concentration Timeline | **Reused directly for nearly every policy type's current-value resolution** — the single largest reuse target this phase has |
| Performance Engine (`lib/performanceAttribution.ts`, Phase 38) | Policy-adjacent figures | Investigated; performance attribution is P&L-oriented, not limit/threshold-oriented — not applicable to this phase's scope |
| Scenario Engine (`lib/scenarioEngine.ts`, Phase 39) | Policy-adjacent figures | Investigated; scenario impact is hypothetical-shock-oriented, not limit/threshold-oriented — not applicable to this phase's scope |
| Decision Support Engine (`lib/decisionSupportEngine.ts`, Phase 40) | Diversification scoring, precedent for composition-layer design | **Reused directly** — `buildDiversificationSummary()` (exported this phase, a one-line, behavior-preserving change) supplies Investing/Options diversification scores; also reused as the structural template for "pure composition, zero new scoring formulas" |
| Rebalancing Engine (`lib/rebalancingEngine.ts`, Phase 41) | Precedent for reuse-heavy composition-layer design, drift-threshold conventions | **Reused as a second structural template** — same "extract on the second real caller, one genuinely new formula, everything else reused" discipline |

### TRADING

| Component | Investigated for | Verdict |
|---|---|---|
| Trading Analytics (`lib/tradingAnalytics.ts`) | A policy-adjacent concept | Investigated; no reusable limit/threshold concept beyond what `riskExposureEngine.ts` already surfaces |
| Risk Engine (`lib/tradingRisk.ts`) | Named risk-cap precedent | **Reused for its own named constants' values** (`MAX_PORTFOLIO_RISK_PCT` as this phase's `trading_buying_power_utilization_max` suggested default) via `riskExposureEngine.ts`'s own already-computed Trading risk summary — the constant's own module was never imported directly |
| Performance Engine | Policy-adjacent figures | Not applicable, per Investing's own finding above |

### OPTIONS

| Component | Investigated for | Verdict |
|---|---|---|
| Options Income Engine (`lib/optionsIncomeAnalytics.ts`, Phase 35) | The real monthly theta income figure | **Reused directly** — `buildOptionsIncomeDashboard()` over `routes/optionsIncome.ts`'s own exported `loadOptionsIncomeSummaryInputs()` supplies the one input Income Stability needs that `riskExposureEngine.ts` doesn't already carry |
| Position Lifecycle (`lib/optionsLifecycle.ts`) | Policy-adjacent figures | Investigated; lifecycle tracking is position-state-oriented, not limit/threshold-oriented — not applicable to this phase's scope |
| Greeks | Portfolio-level Greeks limits | **Reused directly** via `riskExposureEngine.ts`'s own already-computed `combined.greeksSummary` (delta/gamma/theta) |
| Portfolio Exposure | Capital/Buying-Power/Expiration-concentration figures | **Reused directly** via `riskExposureEngine.ts`'s own already-computed Options risk summary and `dashboard.expirationDistribution` |

### SHARED

| Component | Investigated for | Verdict |
|---|---|---|
| Executive Dashboard / Executive Intelligence / Cross-Engine Workspace | Integration surfaces | **Extended** — one new deep link each, mirroring the exact pattern Phase 41's own Rebalancing Engine link established |
| Reporting Centre (`lib/institutionalReporting.ts`) | Report-generation framework | **Reused directly** — the existing `ReportSection`/`InstitutionalReport` shape, `REPORT_TYPE_META` array, and `regenerate()` dispatcher, extended with 2 new entries each |
| Learning Centre (`lib/learningPaths.ts`) | Existing topic content | **Reused directly** — every Compliance Learning link resolves a real, already-existing topic key, verified to exist before use |
| Institutional AI Coach (`lib/coach.ts`) | The shared disclaimer contract | **Reused directly** — `COACH_DISCLAIMER`, imported unmodified |
| Navigation / Command Palette (`lib/nav-items.ts`) | The single navigation index | **Extended** — one new `NavItem`; the Command Palette and sidebar both read this same array, so no second wiring point was needed |

**Genuine gap found, and how it was resolved:** no existing table
anywhere in this codebase lets a user set and persist their own limit
against an already-computed figure — every prior phase's own
thresholds are hardcoded constants (Phase 40's Executive Alerts, Phase
2 Sprint 29's/Phase 3's own named concentration/risk caps). The
`investing_monitoring_states` table (Phase 16) was investigated and
found to be a **different concept entirely** — a generic "last
observed signal state" diff-cache for the Investing-only watchlist/
portfolio/saved-screen change-monitoring engine
(`lib/monitoringEngine.ts`), never a policy/compliance system; this
phase's own `lib/complianceEngine.ts`/`lib/compliancePolicies.ts` and
new table are deliberately named distinctly (`compliance_policies`,
not `monitoring_states`) to avoid confusion with that pre-existing,
unrelated engine. New `compliance_policies` (the one genuinely new
persistence primitive this phase introduces) fills this gap.

## What is genuinely new vs. reused, at a glance

This phase introduces exactly **one genuinely new formula**:

1. **Income Stability** — `(optionsThetaMonthly / optionsBuyingPower) * 100`,
   a plain division of two already-computed figures. See
   `docs/Portfolio-Policies.md` for the full derivation.

Everything else is either a direct re-export of an already-computed
figure (every other policy type's current-value resolution, reading
straight from `RiskExposureDashboard`/`DiversificationSummary`) or a
generic, reusable comparison function (`evaluatePolicy()`'s own
current-vs-limit logic, identical in shape for all 15 policy types,
never a per-type bespoke scoring formula).

## Never blended across engines

Every cross-engine-adjacent policy type in this phase deliberately
keeps Investing/Trading/Options figures **separate**, never summed
into one blended total — the same discipline every prior cross-engine
dashboard in this project (Phases 37–41) already established:

- Capital allocation and buying-power utilization are **per-engine
  policy types** (`investing_capital_allocation_max` /
  `trading_capital_allocation_max` / `options_capital_allocation_max`,
  and `trading_buying_power_utilization_max` /
  `options_buying_power_utilization_max`) rather than a single policy
  type with a `targetKey`-selected engine — a structural choice made
  deliberately during design, so a policy row can never be ambiguous
  about which engine's figure it reads, and the "never blend" rule is
  enforced by the schema itself, not just by convention.
- The Compliance Summary and Policy Violations never mix an
  Investing-scoped policy's breach with an Options-scoped policy's
  breach into one combined "risk score" — each evaluation stays its
  own row, with its own `policyType`/`category`/`status`.

## The Policy Engine's honesty guarantees

- A policy's `currentValue`/`differenceValue` are `null`, not `0` or a
  fabricated compliant/breach guess, whenever the underlying figure
  can't be resolved (e.g. a `targetKey` matching nothing) — the same
  honest-null-over-fabricated-value discipline every prior phase's own
  engines already established.
- `unavailable` is a genuinely distinct third status, never conflated
  with `compliant` — an unavailable policy is honestly excluded from
  both the compliant and breach counts in the Compliance Summary, and
  from Policy Violations.
- A disabled policy is never silently dropped from its own category
  list (so a user can still see and re-enable it), but is honestly
  excluded from the Compliance Summary's counts and from Policy
  Violations, even when its own current value would otherwise breach.
- No policy evaluation is ever persisted or cached — every read of
  `GET /compliance/dashboard` recomputes every evaluation fresh from
  the calling user's own current portfolio state.
- Suggested default limit values are reused, named constants from
  elsewhere in this codebase — never invented numbers.

## What was deliberately NOT built

- **No trade recommendations, buy/sell signals, or suggested trades.**
  Every policy evaluation's `detail` sentence describes a real,
  already-computed current state against a user's own chosen limit —
  it describes what *is*, never what to *do*.
- **No portfolio optimisation, auto rebalancing, or auto execution.**
  This phase reads, compares, and presents — it never writes to a
  trade, position, or order, and never calls any execution-adjacent
  code.
- **No AI predictions, forecasting, or machine learning.** Every
  figure is either a direct reuse of an already-computed value or
  plain deterministic arithmetic — no statistical model, no trained
  model, no probability distribution. The AI Coach's own 5
  explanations are deterministic, template-based prose about concepts
  only, enforced structurally since `explainComplianceTopic()`'s own
  signature takes only a topic key, never a symbol, position, or
  account figure.
- **No separate compliance-evaluation history table.** The Compliance
  Timeline is reused directly from the Risk & Exposure Engine's own
  Concentration Timeline — the closest genuine historical proxy this
  codebase has — rather than introducing a second, redundant
  time-series table for a first-of-its-kind capability.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not
modified by any file in this phase. `lib/riskExposureEngine.ts`,
`lib/portfolioConcentration.ts`, and `lib/optionsIncomeAnalytics.ts`
were also not modified — reused verbatim. `lib/decisionSupportEngine.ts`'s
own `buildDiversificationSummary()` behavior is confirmed byte-identical
before and after this phase's one additive, behavior-preserving
change (the `export` keyword).
