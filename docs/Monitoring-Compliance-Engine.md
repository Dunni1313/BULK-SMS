# Institutional Portfolio Monitoring & Compliance Engine

Phase 42 — a deterministic Portfolio Monitoring & Compliance Engine that
continuously evaluates portfolio state against user-defined policies,
allocation limits, concentration thresholds, and risk rules.

**This phase provides monitoring only.** Nothing here implements or
evaluates trade recommendations, buy/sell signals, portfolio
optimisation, auto rebalancing, auto execution, AI predictions,
forecasting, machine learning, or broker integration changes. Every
current value evaluated against a user's own policy is reused verbatim
from an already-shipped, already-tested engine, or is the one
genuinely new ratio (Income Stability) — see
`docs/Portfolio-Policies.md` for the full per-policy-type breakdown.

## Where to find it

`/monitoring-compliance-engine`, linked from the sidebar navigation,
the Command Palette (inherits the nav entry automatically), the
Investing Executive Dashboard, the Executive Intelligence Hub, the
Cross-Engine Workspace's own Workspace Shortcuts, and the
Institutional Reporting Centre (two new report types). The Learning
Centre overview is reached indirectly — every Coach & Learning topic
links out to real, already-existing Learning Centre content, never a
new lesson page.

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were
confirmed present and load-bearing for this phase (full detail in
`docs/Institutional-Governance-Model.md`):

| Component | Reused for |
|---|---|
| `lib/riskExposureEngine.ts`'s `buildRiskExposureDashboard()` (Phase 37) | Sector/Strategy/Capital/Buying-Power concentration, the Greeks summary, per-symbol Investing allocation, and the Compliance Timeline (its own Concentration Timeline) |
| `lib/decisionSupportEngine.ts`'s `buildDiversificationSummary()` (Phase 40, exported this phase — a one-line, behavior-preserving change) | Investing/Options diversification scores |
| `lib/portfolioConcentration.ts`'s `buildPortfolioConcentrationOverlay()` | The Options concentration input `buildDiversificationSummary()` itself needs |
| `lib/optionsIncomeAnalytics.ts`'s `buildOptionsIncomeDashboard()` over `routes/optionsIncome.ts`'s own exported `loadOptionsIncomeSummaryInputs()` | The real monthly theta income figure behind Income Stability |
| `lib/coach.ts`'s `COACH_DISCLAIMER` | The Monitoring & Compliance Engine's own AI Coach |
| `lib/learningPaths.ts`'s existing topic content | The Monitoring & Compliance Engine's own Learning Centre links |

**Genuine gap found:** no existing table anywhere in this codebase lets
a user set and persist their own limit. Every prior phase's own
thresholds (Phase 40's Executive Alerts, Phase 2 Sprint 29's/Phase 3's
own named concentration/risk caps) are hardcoded constants. New
`compliance_policies` (the one genuinely new persistence primitive
this phase introduces) and new `lib/complianceEngine.ts` fill exactly
this gap — a pure composition + comparison layer, never a new scoring
formula except the one genuinely new Income Stability ratio.

## Views

The main page (`MonitoringComplianceEngine.tsx`), with 4 tabs:
Compliance Dashboard, Policy Configuration, Coach & Learning,
Reporting.

### Compliance Summary

Total policies, enabled policies, compliant/breach/unavailable counts,
and an overall status (`compliant` / `breach` / `no_policies`) —
computed only over **enabled** policies, so a disabled policy never
distorts the headline read.

### Policy Violations

Every enabled, currently-breached policy's own evaluation — a
deterministic observation only (e.g. "Technology allocation exceeds
policy"), never a recommended action.

### Allocation / Sector / Asset / Position / Strategy / Greeks / Buying Power / Income Stability / Diversification Limits

Nine category-grouped sections, each listing every policy of that
category (enabled or not — category membership is never gated on
`enabled`, only the summary counts and Policy Violations are), with
its own current value, limit, difference, and status. Allocation
Limits is a dashboard-level grouping spanning Sector/Position/Strategy
(`ALLOCATION_CATEGORIES` in `lib/complianceEngine.ts`), not a distinct
policy category of its own.

### Compliance Timeline

Reused directly from the Risk & Exposure Engine's own Concentration
Timeline — the closest genuine historical signal this codebase has. No
separate compliance-evaluation history is persisted this phase; every
policy evaluation is computed fresh on every read.

### Policy Configuration

Create/list/enable-disable/edit/delete the user's own policies. A
policy type is chosen from the fixed, documented 15-type catalogue
(`GET /compliance/policy-types`); the form pre-fills the suggested
default limit value and required direction, both fully editable before
creation. Nothing is ever auto-created without an explicit user
action.

## AI Coach & Learning Centre

`lib/complianceCoach.ts` — 5 deterministic, template-based explanations
(portfolio monitoring, compliance concepts, risk limits, capital
limits, governance), reusing the platform's existing
`COACH_DISCLAIMER` unmodified. **Never a trade recommendation** —
enforced structurally, since `explainComplianceTopic()`'s own
signature takes only a topic key, never a symbol, position, or
account figure.

`lib/complianceLearning.ts` connects each of 6 distinct topics
(portfolio governance, risk policies, institutional compliance,
diversification, capital allocation, portfolio monitoring) to real,
already-existing Learning Centre content — zero duplicated lesson
content. No existing Learning Centre content is titled "governance" or
"compliance" specifically, so those two topics are mapped to the
closest genuinely relevant existing content (portfolio
construction/decision-quality discipline for governance;
risk-contribution/process-over-prediction discipline for institutional
compliance) — the same "link to the closest real content, never
fabricate new lesson text" precedent `lib/rebalancingLearning.ts`
already established. Deliberately a separate topic list from the
Coach's own 5 topics, per the kickoff's own two distinct lists.

## Reporting Centre integration

Two new report types, both pure reformats of the same
`MonitoringComplianceDashboard`:

- **Compliance Report** (`GET /reporting/compliance-report`) —
  executive-summary level: the Compliance Summary and every current
  Policy Violation.
- **Policy Monitoring Report** (`GET /reporting/policy-monitoring-report`)
  — the full operational detail: all 9 category-grouped limit
  sections, plus the Compliance Timeline.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/compliance/dashboard` | The full Monitoring & Compliance dashboard for the calling user |
| GET | `/compliance/policy-types` | The fixed, documented set of 15 policy types with suggested default values |
| GET | `/compliance/policies` | The calling user's own configured policies |
| POST | `/compliance/policies` | Create a new policy |
| GET | `/compliance/policies/:id` | One policy by id (404 for another user's own or a nonexistent policy) |
| PATCH | `/compliance/policies/:id` | Update a policy's label/targetKey/direction/limitValue/enabled |
| DELETE | `/compliance/policies/:id` | Delete a policy |
| GET | `/compliance/coach` | All 5 AI Coach explanations |
| GET | `/compliance/coach/:topic` | One explanation (404 for unknown topic) |
| GET | `/compliance/learning` | All 6 topics' own Learning Centre links |
| GET | `/compliance/learning/:topic` | One topic's links (404 for unknown topic) |
| GET | `/reporting/compliance-report` | Compliance Report |
| GET | `/reporting/policy-monitoring-report` | Policy Monitoring Report |

`GET /compliance/dashboard` is deliberately a **GET**, matching
`GET /risk-exposure/dashboard`'s and `GET /rebalancing/dashboard`'s own
established GET-only precedent for a dashboard that takes no
caller-supplied input beyond the authenticated user's own identity.

## Testing

- `lib/complianceCoach.test.ts` / `lib/complianceLearning.test.ts` —
  pure unit tests for the deterministic coach/learning modules,
  mirroring the established `rebalancingCoach.test.ts`/
  `rebalancingLearning.test.ts` pattern.
- `routes/complianceEngine.route.test.ts` — live end-to-end HTTP tests
  against a real Postgres connection and the real Better-Auth instance:
  the honest empty-policy dashboard, the full policy-type catalogue,
  the full create/list/get/update/delete policy lifecycle, 400s for an
  unknown policy type or a missing required field, 404s for a
  nonexistent policy or another user's own policy, real breach/
  compliant/unavailable evaluation math against real seeded Investing
  holdings, a disabled policy's own category-vs-summary/violations
  visibility split, current values proven byte-consistent against
  `GET /risk-exposure/dashboard`, tenant isolation, the AI Coach and
  Learning Centre endpoints (including 404s for unknown topics), no
  special-auth requirement, both new Reporting Centre report types,
  and a structural scan proving no trade recommendation/buy-sell-
  signal/forecast/prediction language ever appears in any response.
- `pages/MonitoringComplianceEngine.test.tsx` — frontend smoke tests
  following the established mocked-generated-hook pattern (a plain GET
  query hook for the dashboard/policy list/policy types, and
  `useMutation`-shaped hooks for create/update/delete).
- `lib/tenantIsolation.test.ts` was extended (not rewritten) with a new
  `compliance_policies` case, reusing the established
  `assertTenantIsolation` helper unchanged.
- `routes/institutionalReporting.route.test.ts` was extended (not
  rewritten) to cover the 2 new report types and the updated
  report-type count (26 → 28).
