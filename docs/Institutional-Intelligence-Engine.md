# Institutional Intelligence Engine

This document covers the Institutional Intelligence Engine as it exists
after the **Institutional Intelligence Engine** sprint (Phase 8, Sprint
1 — "AI Coach Foundation"). It is a companion to
`docs/Alpaca-Paper-Trading-Architecture.md` §4.16, which covers the same
sprint at a higher level alongside the rest of the Alpaca integration —
read that document for the broader architectural context.

---

## 1. What this is — and what it is not

The Institutional Intelligence Engine is a **deterministic intelligence
layer** analysing this platform's own already-computed analytics and
producing explainable, fully-traceable observations.

**This is NOT an LLM integration. This is NOT a chatbot. This is NOT an
AI prediction engine.** No language model is ever called. No probability
or statistical forecast is ever generated. No trade recommendation or
execution suggestion is ever produced. Every field in every observation
is either a direct read of an already-computed platform figure or a
disclosed, deterministic rule (a threshold comparison, a template
lookup, a set diff) applied to those already-computed figures — every
observation is 100% reproducible by re-running the same rule against the
same inputs.

This sprint lays the foundation for future AI modules — AI Coach, AI
Teacher, AI Portfolio Analyst, AI Trade Journal, Institutional Mentor,
Learning Centre — all of which are meant to consume this engine's
services rather than build competing logic.

---

## 2. Architecture — six services, one orchestrator

`lib/intelligenceEngine.ts`'s `buildInstitutionalIntelligence(userId)` is
the single entry point, composing six services:

| Service | File | Responsibility |
|---|---|---|
| Observation Engine | `lib/intelligenceObservations.ts` | Generates deterministic observations (`buildObservations()`) |
| Explanation Engine | `lib/intelligenceObservations.ts` | Formats "why" an observation fired (`explainObservation()`) |
| Health Engine | `lib/intelligenceHealth.ts` | Aggregates every existing health metric into one overview (`buildHealthOverview()`) |
| Summary Engine | `lib/intelligenceSummary.ts` | Deterministic daily-summary template sentences (`buildDailySummary()`) |
| Timeline Engine | `lib/intelligenceTimeline.ts` | New/resolved/persistent observation diffing + trend comparisons (`buildTimeline()`, `getPriorSnapshot()`, `recordSnapshotIfNeeded()`) |
| Learning Engine | `lib/intelligenceLearning.ts` | Maps each observation category to real, existing educational pages (`learningLinksFor()`) |

A seventh, small shared module, `lib/intelligenceTrend.ts`, holds the one
`computeTrend()` primitive the Observation, Health, and Timeline Engines
all reuse — "is this figure improving, declining, or stable" is computed
exactly once, never re-derived independently by each engine. This is the
"don't duplicate calculations" discipline applied *within* this sprint's
own new code, not just against pre-existing modules.

---

## 3. Reuse — zero new pricing/risk/portfolio calculations

**This sprint introduces no new pricing, risk, or portfolio math of any
kind.** Every figure the Observation/Health/Summary/Timeline Engines read
comes from two already-existing, unmodified sources:

- **`lib/portfolioDashboard.ts`'s `buildPortfolioDashboard(userId)`**
  (Portfolio Risk Dashboard sprint) — itself already a composition of
  Position Sizing, the Portfolio Stress Test, the Earnings & Event Risk
  Portfolio Overlay, and the Correlation & Concentration Risk Overlay.
  This is the primary data source: the Health Score, Overall Risk
  Rating, all 8 health factors, guidance codes, credentials/broker
  status, and Buying Power all come from this one call, unmodified.
- **`lib/thetaIncome.ts`'s `computeThetaIncome()`**, fed by
  `lib/positionSizing.ts`'s `currentOpenTrades()` and
  `lib/serverState.ts`'s `computeTradeGreeks()` — the **exact same**
  3-function composition `routes/portfolio.ts`'s own `GET
  /portfolio/theta` route already uses, reused here rather than
  re-derived, so this engine's own theta income figure is never a
  second, competing calculation.

`portfolioDashboard.ts` itself was **not modified** this sprint —
confirmed zero-line diff. Neither were `portfolioStressTest.ts`,
`portfolioEventRisk.ts`, `portfolioConcentration.ts`, or
`positionSizing.ts`.

**Scanner/Options Dashboard reuse is deliberately scoped to Learning
Links only.** Direct inspection found `GET /scanner/top` has a real
write side-effect (`scanAndPersist()` seeds `scannerResultsTable` if
empty) — a genuine DB write triggered by a GET. To stay strictly
read-only with zero writes beyond this engine's own dedicated snapshot
table (§4), the Intelligence Engine never calls that route or reads that
table directly; Scanner and the Options Dashboard are instead referenced
only via `lib/intelligenceLearning.ts`'s catalog links — a disclosed,
bounded scope decision, not an oversight.

---

## 4. The one new table — history-keeping, not prediction

`intelligence_snapshots` (`lib/db/src/schema/intelligenceSnapshots.ts`,
migration `lib/db/manual-migrations/018_intelligence_snapshots.sql`) is
the **only new persistent state** this sprint introduces. It exists
because genuine trend observations ("Buying Power increasing", "Theta
income improving", "Portfolio Health improved") require comparing
today's already-computed figures against a prior day's — a capability no
existing table provides.

This is **history-keeping, not prediction, and not new market data**:
every persisted column is a snapshot of an already-computed value from
an existing, unmodified module (`healthScore`, `overallRiskRatingCode`,
`buyingPower`, `totalRiskPct`, the 5 per-factor health scores,
`thetaMonthly`, `netDelta`, and the day's own emitted `observationCodes`
array). No forecast, no fitted model, no statistical projection is ever
stored.

- `userId` — mandatory, `ON DELETE RESTRICT` (the universal FK
  convention across this codebase's user-scoped tables).
- A real, DB-level **unique index on `(userId, snapshotDate)`** — at most
  one row per user per calendar day, enforced by Postgres itself, not by
  application logic alone.
- Written via `.onConflictDoNothing()` targeting that exact unique
  index — safe under concurrent calls for the same user/day, a
  deliberately **safer** pattern than the sequential-`await
  getSettingsRow()` race workaround the Portfolio Dashboard sprint
  needed, since this table has a real unique constraint to lean on
  instead of application-level sequencing.
- `NOT NULL` from creation, zero existing rows, no backfill needed — the
  same precedent every other brand-new table in this codebase has
  followed since `platform_audit_log`.

`getPriorSnapshot(userId, now)` reads the most recently recorded row
whose `snapshotDate` is **strictly less than** today — it never treats
today's own just-recorded row as its own "prior."
`recordSnapshotIfNeeded()` is called once per `buildInstitutionalIntelligence()`
invocation, **after** the Timeline Engine has already read the prior row
(so a request never compares today against itself), and it is a true
at-most-once-per-calendar-day write, never automatically polled or
scheduled.

---

## 5. Observation Engine — 11 deterministic rules

`buildObservations(dash, theta, prior, timestamp)` runs 11 rule
functions and filters out the ones that don't fire, returning `Observation[]`.
Every `Observation` carries: `code`, `category`, `severity`, `title`,
`explanation`, `supportingMetrics`, `sourceModule`, `timestamp`,
`confidence`, `confidenceReason`, and `learningLinks`.

### 5.1 Trend-based rules (require a real prior snapshot; never fabricated)

| Code | Fires when | Source |
|---|---|---|
| `portfolio_health_improved` / `portfolio_health_declined` | `dash.healthScore` moves beyond a disclosed 3-point threshold vs. the prior day | `portfolioDashboard.ts — healthScore` |
| `buying_power_increasing` / `buying_power_decreasing` | `dash.buyingPower` moves beyond the default 2% threshold vs. the prior day | `portfolioDashboard.ts — buyingPower` |
| `theta_income_improving` / `theta_income_slowing` | `theta.monthly` moves beyond the default 2% threshold vs. the prior day | `thetaIncome.ts — monthly` |
| `diversification_improving` / `diversification_declining` | the `diversification` health factor's score moves beyond a disclosed 3-point threshold vs. the prior day | `portfolioConcentration.ts — breakdowns.sector.concentrationScore` |

**When no prior snapshot exists yet (a user's very first call, or any
call before the next calendar day), none of these 8 codes are ever
emitted** — `computeTrend()` returns `"insufficient_history"` and the
corresponding rule function returns `null`. A trend is never guessed or
fabricated from a single data point.

### 5.2 Point-in-time rules (always available, no history needed)

| Code | Fires when | Source |
|---|---|---|
| `concentration_elevated` | `dash.guidance` already carries `elevated_concentration` or `review_large_positions` | `portfolioConcentration.ts — riskGuidance / summary.largestConcentration` |
| `large_directional_exposure` | the `directional_exposure` health factor scores below the disclosed `LARGE_EXPOSURE_SCORE_THRESHOLD` (40) | `portfolioConcentration.ts — longShort.longPct / shortPct` |
| `large_greeks_exposure` | the `net_greeks_exposure` health factor scores below the same 40-point threshold | `portfolioConcentration.ts — greeksContributions[0].deltaSharePct` |
| `event_risk_elevated` | `dash.highestEventRisk.riskLevel` is `"high"` or `"medium"` | `portfolioEventRisk.ts — summary.highestRiskPosition` |
| `broker_disconnected` | credentials are configured but the last cached broker check reported `brokerConnected: false` | `portfolioDashboard.ts — brokerConnected / lastBrokerCheckAt` (cached — never a live check triggered by this engine) |
| `paper_trading_active` | **always** — a structural platform fact, not a derived calculation | platform — `paperTradingMode` |
| `credentials_unavailable` | `dash.credentialsConfigured` is `false` | `portfolioDashboard.ts — credentialsConfigured` |

`paper_trading_active` is the one observation that is **always** present
regardless of portfolio state — every response therefore always has at
least one observation, never an honestly-but-uselessly-empty list.

### 5.3 Confidence — never AI probability

Every observation carries exactly one of two confidence bands, each with
an explicit `confidenceReason`:

- **`"high"`** — a single, already-computed, complete metric was read
  directly (e.g. a concentration score, an event-risk level, the broker
  connected flag).
- **`"moderate"`** — a trend/comparative observation based on exactly one
  prior recorded snapshot.

Per the sprint's own explicit instruction, confidence is **derived from
source quality and completeness, never from an AI-style probability
estimate.** There is no third tier and no numeric confidence score.

### 5.4 Explanation Engine

`explainObservation(observation)` is a stable formatting entry point
returning `{ why, contributingMetrics, sourceModule, reviewSuggestion }`
— it adds **zero** new information beyond what the `Observation` already
carries; `why` is exactly `observation.explanation`, `contributingMetrics`
is exactly `observation.supportingMetrics`, and `reviewSuggestion` picks
the first non-"coming soon" learning link's own label (or an honest
"No specific existing page is directly linked to this observation."
when every link is a placeholder). This exists so every future AI
module reads "why did this happen" the same way, rather than each
re-deriving its own explanation format.

---

## 6. Health Engine — "aggregate by reference," never a second score

`buildHealthOverview(dash, prior)` deliberately **never recomputes** a
health score. `overallHealthScore` and `overallRiskRating` are the exact
same values `lib/portfolioDashboard.ts` already computed — proven
byte-identical by a dedicated regression test
(`intelligenceHealth.test.ts`). `healthDrivers` is `dash.healthFactors`
itself, re-sorted worst-first — zero new scoring. `healthTrend`/
`healthTrendDetail` reuse the shared `computeTrend()` primitive against
the prior snapshot's own `healthScore`. `brokerHealth` is a thin
relabeling of `dash.credentialsConfigured`/`dash.brokerConnected` into a
human-readable `label` ("No credentials configured" / "Connected" /
"Disconnected" / "Not yet checked"). `healthSummary` is one deterministic
template sentence, naming the weakest driver only when the portfolio
isn't already healthy.

---

## 7. Summary Engine — fixed templates only

`buildDailySummary(health, observations, now)` is a pure lookup over
already-computed bands — **never natural-language generation of any
kind.** Every sentence is chosen from a fixed, disclosed template table,
matching the sprint's own worked examples exactly: "Portfolio Health
remains strong.", "Diversification is improving.", "Concentration
remains moderate.", "Theta income continues to increase.", "No elevated
Event Risk detected.", "Buying Power remains healthy." — plus their
opposite-direction/elevated-risk counterparts. Diversification and theta
bullets are included only when the corresponding trend observation
actually fired; the other 3 bullets (headline/concentration/event-risk/
buying-power) always appear, defaulting to their calm wording when
nothing elevated was observed.

---

## 8. Timeline Engine

`buildTimeline(observations, prior, dash, theta, now)` diffs today's
observation codes against the prior snapshot's own recorded
`observationCodes` array:

- **`new`** — a code present today that wasn't in the prior snapshot.
- **`persistent`** — a code present both today and in the prior snapshot.
- **`resolved`** — a code present in the prior snapshot but absent
  today, surfaced via `labelForCode()`'s own registry (never silently
  dropped).

`labelForCode()`'s registry is kept in sync with every code
`intelligenceObservations.ts`'s `buildObservations()` can ever emit — a
dedicated test (`intelligenceTimeline.test.ts`) is the trip-wire: it
asserts every one of the 15 known observation codes has a real registry
entry, never falling back to the raw code string.

`healthChange`/`incomeChange` are populated (even reporting `"stable"`)
whenever a real prior snapshot exists — they are never suppressed just
because nothing dramatic happened, distinct from the Observation
Engine's own stricter "only alert on a genuine, actionable move" rule.
`riskRatingChange` only appears when `overallRiskRatingCode` genuinely
differs from the prior day. All three fields, and `comparedTo`, stay
`null` on a user's very first call.

---

## 9. Learning Engine

`learningLinksFor(category)` (`lib/intelligenceLearning.ts`) is a fixed
catalog mapping each of the engine's 11 observation categories to the
real, already-existing pages that cover that topic (Portfolio Dashboard,
Stress Testing, Correlation & Concentration, Event Risk, Options
Dashboard, Settings). **Every category's list ends with an honestly
disclosed `{ label: "AI Teacher", href: null, comingSoon: true }`
entry — never a fabricated URL** for a page that doesn't exist yet.
`buildInstitutionalIntelligence()`'s own `dedupeLearningLinks()`
collects every emitted observation's own links into one top-level,
deduplicated `learningLinks[]` array (keyed by `href`, so two
observations pointing at the same page never produce a duplicate
badge).

---

## 10. API surface

One new, read-only endpoint: **`GET /intelligence`**
(`routes/intelligence.ts`) — resolves the calling user via the existing
`getScopedUserId(req)` (unauthenticated requests resolve to the
legacy-owner stand-in, matching every other route in this codebase), and
returns the full `InstitutionalIntelligenceResult`. The only write this
route can ever trigger is the single, at-most-once-per-calendar-day
`intelligence_snapshots` insert described in §4 — never more than once,
never automatically polled. `openapi.yaml` gained the `/intelligence`
path plus 12 new `Intelligence`-prefixed schemas (`api-zod`/
`api-client-react` regenerated cleanly, no naming collisions).

---

## 11. Frontend

A new page, `pages/InstitutionalIntelligence.tsx`, mounted at
`/institutional-intelligence` (new nav item, positioned directly after
"Institutional Dashboard"). Displays: Executive Summary, Health
Overview, Highest Priority, Latest Observations, Portfolio/Income/Risk
Insights, the Intelligence Timeline, and Learning Links. **Four
permanent indicator badges** — "Institutional Intelligence",
"Deterministic Analysis", "Paper Trading", "Read Only" — are always
visible, per the sprint's own explicit requirement (every other page in
this codebase carries only 2 badges; this one carries 4, deliberately).
This page never submits, closes, or modifies anything, and never renders
a trade recommendation or execution suggestion anywhere — confirmed by a
dedicated frontend test asserting no such text ever appears.

---

## 12. Testing

- `lib/intelligenceTrend.test.ts` — pure unit coverage of `computeTrend()`.
- `lib/intelligenceLearning.test.ts` — pure unit coverage of `learningLinksFor()`.
- `lib/intelligenceObservations.test.ts` — pure unit coverage of `explainObservation()` (the Explanation Engine).
- `lib/intelligenceHealth.test.ts` — Health Engine coverage against a real, isolated-user dashboard plus hand-built prior-snapshot fixtures.
- `lib/intelligenceSummary.test.ts` — pure unit coverage of every Summary Engine template branch.
- `lib/intelligenceTimeline.test.ts` — pure diffing coverage plus the registry-completeness proof plus real, DB-backed `getPriorSnapshot()`/`recordSnapshotIfNeeded()` upsert behavior.
- `lib/intelligenceEngine.test.ts` — the full orchestrator against isolated, fresh test users covering: an empty/fresh portfolio, a single position, a balanced/healthy portfolio, high concentration, high Greeks exposure, high event risk, many observations together, missing credentials, timeline/trend observations against a manually-recorded real prior snapshot, health calculations, summary generation, learning links, and the at-most-once-per-day persistence/determinism/never-mutates-trades discipline.
- `routes/intelligence.route.test.ts` — live end-to-end HTTP tests against the real app, including a Broker Disconnected scenario via mocked network (mirroring `routes/brokerHealth.route.test.ts`'s own established technique).
- One new case in `lib/tenantIsolation.test.ts` (`intelligence_snapshots`, reusing the established `assertTenantIsolation` helper).
- `pages/InstitutionalIntelligence.test.tsx` — frontend smoke tests covering all 4 permanent badges, loading/error states, Executive Summary, Health Overview, Highest Priority (empty and populated with multiple observations), per-observation severity/category/confidence/source-module rendering, the 3 Insights columns, both Timeline states (no prior snapshot, and a real prior-snapshot comparison), Learning Links (including the honest "coming soon" AI Teacher entry), and the never-a-recommendation proof.

---

## 13. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts` — zero-line diff.
- `lib/portfolioDashboard.ts`, `lib/portfolioStressTest.ts`,
  `lib/portfolioEventRisk.ts`, `lib/portfolioConcentration.ts`,
  `lib/positionSizing.ts`, `lib/thetaIncome.ts`, `lib/serverState.ts`,
  `routes/portfolio.ts`, `routes/scanner.ts` — zero-line diff; every one
  of their own exported functions is reused, not reimplemented.
- No broker write operations of any kind.
- No portfolio mutation of any kind.
- No LLM call of any kind.

---

## 14. Remaining AI roadmap (not built this sprint)

Per the sprint's own framing, this engine is the **foundation** for:

- **AI Coach** — a conversational layer over the Observation/Explanation
  Engines' own already-structured output.
- **AI Teacher** — the still-`comingSoon`-only Learning Engine entry;
  real educational content/pages have not been built.
- **AI Portfolio Analyst** — a deeper narrative layer over the Health
  Engine's own aggregation.
- **AI Trade Journal** — surfacing Observation Engine output alongside
  `pages/Journal.tsx`'s own existing entries.
- **Institutional Mentor** / **Learning Centre** — a dedicated
  destination consuming the Learning Engine's catalog.

None of these were built this sprint — every future module is expected
to consume the six services documented above rather than duplicate
their logic.

---

## 15. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.16 — the higher-level
  architectural summary of this same sprint.
- `docs/Portfolio-Dashboard.md` — the Portfolio Risk Dashboard whose own
  response shape is this engine's primary data source.
- `docs/Institutional-Command-Center.md` — a separate, earlier sprint's
  own composition page; not to be confused with this engine, though both
  reuse `useGetPortfolioDashboard()`.
- `docs/Operations-Handbook.md` §6.18 — day-to-day operational usage.
- CLAUDE.md rule 1/2 — `execution.ts`/`autoExecution.ts`/`autoAdjustment.ts`
  are never modified without explicit, specific approval; this sprint
  touches none of them.
