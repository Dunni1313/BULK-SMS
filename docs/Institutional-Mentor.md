# Institutional Mentor

This document covers the Institutional Mentor as it exists after the
**Institutional Mentor** sprint (Phase 8, Sprint 5). It is a companion
to `docs/AI-Portfolio-Analyst.md` (Sprint 3) and `docs/AI-Trade-Journal.md`
(Sprint 4) — read both alongside this document, since the Institutional
Mentor is the third and final intelligence layer built on top of them.

---

## 1. What this is — and what it is not

The Institutional Mentor is the **final intelligence layer** of the
Ravish Institutional Trading Operating System. Unlike the AI Teacher
(explains concepts) and the AI Portfolio Analyst (summarises portfolio
analytics), the Institutional Mentor **teaches institutional thinking**
— how a professional portfolio manager would evaluate the user's own
existing Paper Trading portfolio — using the exact same platform data
every other engine already computes: a 9-category Portfolio Scorecard,
a Professional Review, a Decision Review, and narrative Capital
Allocation, Risk, Income, and Behaviour reviews, each cross-linked to
Institutional Lessons.

**This is NOT a chatbot. This is NOT an AI trading signal engine. This
is NOT financial advice. This is NOT portfolio optimisation. This is
NOT execution logic.** No language model is ever called. No prediction
of any kind is ever generated. No trade is ever recommended. Every
score, observation, and review sentence is deterministic and fully
traceable to an existing calculation — every output is 100%
reproducible by re-running the same rule against the same inputs.

---

## 2. Architecture — pure composition, one small disclosed threshold set

`lib/institutionalMentor.ts`'s `buildInstitutionalMentor(userId)` is the
single entry point. It introduces **zero new pricing or risk
calculations** beyond a small, named, disclosed set of threshold-banding
constants (`INCOME_POSITIVE_THETA_BASE_SCORE` / `INCOME_ZERO_THETA_BASE_SCORE`
/ `INCOME_NEGATIVE_THETA_BASE_SCORE` / `INCOME_TREND_ADJUSTMENT`) for the
**one genuinely new figure** this sprint introduces — Income
Generation's 0-100 score, since no existing 0-100 income score exists
anywhere else in this codebase to project directly (the same honest gap
`docs/AI-Portfolio-Analyst.md`'s own Income Summary already disclosed
for Premium Collected/Income Forecast). Everything else is a direct
pass-through, a plain array filter/sort/group, or the already-existing
`computeTrend()` primitive applied to a genuinely stored historical
figure.

Genuine, real reuse (all unmodified): `buildPortfolioDashboard()`
(`portfolioDashboard.ts` — Health/Risk/Capital/Position-Sizing/Greeks/
Event source data), `buildPortfolioConcentrationOverlay()`
(`portfolioConcentration.ts` — Diversification/Capital-Allocation/
Correlation source data), `buildPortfolioStressTest()`
(`portfolioStressTest.ts` — Risk Management source data),
`buildTradeJournal()` (`tradeJournal.ts` — Discipline/Behaviour/Decision
source data, the AI Trade Journal, Phase 8 Sprint 4), `currentOpenTrades()`/
`computeTradeGreeks()`/`computeThetaIncome()` (Income source data),
`computeTrend()` (`intelligenceTrend.ts` — every historical trend in
this document), `learningLinksFor()`/`getLearningTopic()`/
`getGlossaryTerm()`/`getStrategyAcademyEntry()` (Institutional Lessons).

**A small, disclosed, real 7-day trend**, mirroring
`portfolioAnalyst.ts`'s own `buildWeeklySummary()` precedent exactly: a
plain `SELECT` over `intelligence_snapshots`' own already-stored
`diversificationScore` column across the trailing 7 recorded days, then
`computeTrend()` between the oldest and newest recorded value — never a
new statistical model, just history-keeping over an already-computed
figure the Institutional Intelligence Engine (Phase 8, Sprint 1) already
persists once per calendar day.

**This module never writes to `intelligence_snapshots` itself** — unlike
AI Portfolio Analyst (which calls `buildInstitutionalIntelligence()`,
itself writing the day's snapshot row), the Institutional Mentor never
calls that function, so it triggers **no database write of any kind**,
confirmed by a dedicated test.

---

## 3. Portfolio Scorecard — 9 categories, every score traceable

`buildScorecard()` produces 9 categories, each a direct projection of an
already-computed figure from one of the reused overlays, with a real,
cited `sourceModule` so this is auditable rather than opaque — mirroring
`portfolioDashboard.ts`'s own `buildHealthFactors()` discipline exactly:

| Category | Source | Distinct from |
|---|---|---|
| Capital Allocation | `100 − portfolioConcentration.ts` strategy-breakdown `concentrationScore` | balance across strategies specifically |
| Risk Management | `portfolioStressTest.ts` — worst scenario's `riskScoreAfter` | the base-case (pre-shock) score used by Position Sizing below |
| Diversification | `portfolioConcentration.ts` — `summary.diversificationScore` | |
| Discipline | `tradeJournal.ts` — `disciplineScore` (the AI Trade Journal) | |
| Income Generation | disclosed banding of `thetaIncome.ts`'s monthly theta + trend (§2) | the one genuinely new figure |
| Position Sizing | `portfolioDashboard.ts` — `healthFactors.position_sizing_quality` (itself from `portfolioStressTest.ts`'s **base-case** `riskScoreBefore`) | the worst-case figure used by Risk Management above |
| Greeks Management | `portfolioDashboard.ts` — `healthFactors.net_greeks_exposure` | |
| Event Preparation | `portfolioDashboard.ts` — `healthFactors.event_risk` | |
| Portfolio Health | `portfolioDashboard.ts` — `healthScore` (the full blended figure) | |

Every entry's grade (`Excellent`/`Good`/`Fair`/`Poor`) reuses
`portfolioDashboard.ts`'s own already-exported 4-tier banding thresholds
(`DASHBOARD_HEALTHY_MIN`/`MODERATE_MIN`/`ELEVATED_MIN`) rather than a
second, competing threshold set.

---

## 4. Professional Review — deterministic, institutional-PM voice

`buildProfessionalReview()` produces fixed-template observations in
exactly the requested style ("An institutional portfolio manager would
note that technology exposure represents 41% of total allocation.",
"Capital allocation remains balanced across strategies.", "Income
generation is stable.", "Portfolio health remains excellent.", "Risk
remains moderate.", "Diversification improved this week.") — every
sentence is gated by an already-computed threshold or the genuine
7-day diversification trend (§2), the exact same technique the Summary
Engine (`intelligenceSummary.ts`) and AI Portfolio Analyst's own
`buildInstitutionalInsights()` already established.

---

## 5. Decision Review — explains completed decisions, never a recommendation

`buildDecisionReview()` composes two genuinely different, already-
computed sources — never re-deriving either:

| Item | Source |
|---|---|
| `sizing_followed_plan` / `sizing_exceeded_policy` | `tradeJournal.ts` — `decisionQualitySummary.sizingRespectedRatePct` vs. `tradeJournal.ts`'s own exported `DISCIPLINE_PATTERN_THRESHOLD_PCT` (70%) |
| `risk_allocation_followed` / `risk_allocation_exceeded` | `portfolioDashboard.ts` — `guidance` advisories (`elevated_concentration`/`review_large_positions`/`elevated_risk`/`high_risk`) |
| `diversification_improved` / `diversification_declined` | the real 7-day `diversificationScore` trend (§2) |
| `income_consistency_improved` / `income_consistency_declined` | monthly theta trend vs. the prior recorded snapshot |
| `held_through_earnings` | `tradeJournal.ts` — `behaviorPatterns.repeated_earnings_exposure` |
| `avoided_excessive_leverage` / `leverage_review_recommended` | `portfolioDashboard.ts` — `overallRiskRating` |

Every item is scored `followed`/`exceeded`/`improved`/`declined`/`neutral`
via a deterministic rule — never subjective AI judgement.

---

## 6. Capital Allocation, Risk, Income, and Behaviour Reviews

- **Capital Allocation Review** — reuses `portfolioDashboard.ts` (buying
  power, portfolio value) and `portfolioConcentration.ts`'s own
  strategy/symbol breakdowns. Cash utilisation is simple arithmetic on 2
  already-computed numbers (`1 − buyingPower/portfolioValue`) — not a
  new statistical model.
- **Risk Review** — reuses Stress Testing (the worst scenario by dollar
  impact, mirroring `portfolioAnalyst.ts`'s own precedent), Event Risk,
  and Concentration, all already-computed pass-through fields off
  `buildPortfolioDashboard()`. Risk trend reuses `computeTrend()` against
  the genuinely stored prior day's own `totalRiskPct`
  (`intelligence_snapshots.total_risk_pct`).
- **Income Review** — Theta Income is the one genuinely already-built
  income metric for this platform's real Paper Trading positions;
  Premium Collected and Historical Income for real closed trades do not
  exist anywhere in this codebase and are honestly NOT fabricated here
  — the same disclosure `docs/AI-Portfolio-Analyst.md`'s own Income
  Summary already made. Income Projection reuses Theta Income's own
  already-computed weekly/monthly/annualized figures directly.
- **Behaviour Review** — a direct pass-through of the AI Trade Journal's
  own already-computed `disciplineScore`/`decisionQualitySummary`/
  `behaviorPatterns`/`behaviorTrend`/`strengths`/`areasToImprove` — zero
  new scoring; this review's whole purpose is to explain the long-term
  behavioural improvements the AI Trade Journal already tracks.

---

## 7. Institutional Lessons

Mirrors `portfolioAnalyst.ts`'s own `crossLinkFor()` pattern exactly:
reuses `intelligenceLearning.ts`'s own per-category catalog (which
already appends **"Your Portfolio, Explained"** — Explain Mode's own
contextual portfolio-explanation view, `/learn?tab=portfolio` — and the
AI Teacher entry point to every category) plus a real Strategy Academy
entry. Every section produces a `MentorLearningCrossLink` carrying
`lessonHref`/`glossaryHref`/`strategyHref`/`explainModeHref` — the
literal "Related Learning Centre lesson, Strategy Academy page,
Glossary terms, Explain Mode" requirement, never a fabricated URL.
Behaviour has no direct `LearningCategory` match (it is a Trade-Journal
concept, not a portfolio-overlay one) — falls back to the same
`institutional-decision-quality` learning-path topic the AI Trade
Journal itself already uses for exactly this reason.

---

## 8. API surface

One new, read-only endpoint: **`GET /institutional-mentor`**
(`routes/institutionalMentor.ts`) — the full `InstitutionalMentorResult`.
It can never trigger a write of any kind (see §2 — this module never
calls `buildInstitutionalIntelligence()`, unlike AI Portfolio Analyst).
`openapi.yaml` gained the path plus 12 new `Mentor`-prefixed schemas —
the `Mentor` prefix avoids any collision with the pre-existing
`Analyst`- and `Journal`-prefixed schemas from the same Phase 8 sprint
family. `api-zod`/`api-client-react` regenerated cleanly, no naming
collisions (`ThetaBreakdown`/`HighestRiskPosition`/`ConcentrationBucket`/
`DashboardGuidanceAdvisory`/`JournalDecisionQualitySummary`/
`JournalBehaviorPattern`/`JournalBehaviorTrend` are all reused via `$ref`
rather than redefined).

---

## 9. Frontend

A new page, `pages/InstitutionalMentor.tsx`, mounted at
`/institutional-mentor` (new nav item, `Landmark` icon, positioned
directly after "AI Trade Journal"). Displays: the Portfolio Scorecard
(a 9-card grid, each with its score/grade/why/sourceModule), the
Professional Review, the Decision Review, and a 2×2 grid of the Capital
Allocation, Risk, Income, and Behaviour Reviews, followed by
Institutional Lessons. **Five permanent indicator badges** —
"Institutional Mentor", "Professional Portfolio Review", "Deterministic
Analysis", "Paper Trading", "Educational Only" — are always visible, per
the sprint's own explicit requirement. This page never submits, closes,
or modifies anything, and never renders a trade recommendation or
execution suggestion anywhere — confirmed by a dedicated frontend test
asserting no such text ever appears.

---

## 10. Testing

- `lib/institutionalMentor.test.ts` — the full orchestrator against
  isolated, fresh test users covering every scenario the sprint's own
  Testing section requested: healthy/balanced portfolio, high
  concentration, high Greeks, large Theta, high Event Risk, poor vs.
  strong diversification, long trade history, and an empty portfolio —
  plus explicit proofs that every Scorecard score is byte-identical to
  the real underlying Dashboard/Concentration/StressTest/Journal
  figures, that the module never writes to `intelligence_snapshots`,
  never mutates the trades table, and is deterministic across repeated
  same-state calls.
- `routes/institutionalMentor.route.test.ts` — live end-to-end HTTP
  tests against the real app, proving the response shape (all 9
  Scorecard categories, real Decision Review statuses, real Learning
  Summary cross-links), the never-a-broker-write/order-creation/trade-
  recommendation-field proof, and determinism across repeated calls.
- `pages/InstitutionalMentor.test.tsx` — frontend smoke tests covering
  all 5 permanent badges, loading/error states, all 9 Scorecard entries,
  the Professional Review (including its own honest empty state), the
  Decision Review, the Capital Allocation/Risk/Income/Behaviour Reviews'
  real figures, Institutional Lessons (including the Explain Mode link),
  and the never-a-recommendation proof.

---

## 11. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts`, `portfolioDashboard.ts`, `portfolioStressTest.ts`
  — zero-line diff (the 7 files explicitly named as protected for this
  sprint).
- `portfolioConcentration.ts`, `positionSizing.ts`, `thetaIncome.ts`,
  `serverState.ts`, `intelligenceTrend.ts`, `intelligenceLearning.ts`,
  `learningPaths.ts`, `glossary.ts`, `strategyAcademy.ts`,
  `tradeJournal.ts`, `lib/portfolioAnalyst.ts` — zero-line diff; every
  one of their own exported functions is reused, not reimplemented.
- No broker write operations of any kind.
- No portfolio mutation of any kind.
- No write to `intelligence_snapshots` (§2).
- No LLM call of any kind.
- No trade prediction or recommendation of any kind.
- The platform remains **Paper Trading only** throughout.

---

## 12. Cross-references

- `docs/AI-Portfolio-Analyst.md` — the sibling AI module (Phase 8,
  Sprint 3) this sprint's own `crossLinkFor()`-style Institutional
  Lessons technique and weekly-trend pattern parallel (a small,
  disclosed, local re-implementation in each file, not a shared
  import).
- `docs/AI-Trade-Journal.md` — the sibling AI module (Phase 8, Sprint 4)
  the Behaviour Review and Decision Review directly reuse.
- `docs/Institutional-Intelligence-Engine.md` — the Institutional
  Intelligence Engine whose `intelligence_snapshots` table this sprint
  reads (read-only, §2) but never writes to.
- `docs/AI-Teacher-Learning-Centre.md` — the source of the lesson/
  glossary/strategy links reused by this sprint's own Institutional
  Lessons.
- `docs/Operations-Handbook.md` §6.22 — day-to-day operational usage.
- `docs/Alpaca-Paper-Trading-Architecture.md` §4.20 — the higher-level
  architectural summary of this same sprint.
- CLAUDE.md rule 1/2 — `execution.ts`/`autoExecution.ts`/
  `autoAdjustment.ts` are never modified without explicit, specific
  approval; this sprint touches none of them.
