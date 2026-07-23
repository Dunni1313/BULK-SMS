# AI Portfolio Analyst

This document covers the AI Portfolio Analyst as it exists after the
**AI Portfolio Analyst** sprint (Phase 8, Sprint 3). It is a companion
to `docs/Alpaca-Paper-Trading-Architecture.md` §4.18, which covers the
same sprint at a higher level alongside the rest of the Alpaca
integration — read that document for the broader architectural context.

---

## 1. What this is — and what it is not

The AI Portfolio Analyst is the **executive portfolio briefing layer**
for the Ravish Institutional Trading Operating System —
`lib/intelligenceEngine.ts`'s own header comment already named it as a
future consumer when the Institutional Intelligence Engine (Phase 8,
Sprint 1) was built. It transforms every existing analytic this platform
already computes into one concise, institutional-quality summary:
Executive Daily Briefing, Portfolio Snapshot, Health Summary, Risk
Summary, Income Summary, Performance Summary, Greeks Summary, Event
Summary, Learning Summary, Portfolio Timeline, and Institutional
Insights.

**This is NOT an LLM. This is NOT a chatbot. This is NOT predictive AI.
This is NOT financial advice. This is NOT a trade-recommendation
engine.** No language model is ever called. No probability or
statistical forecast is ever generated. Every field is either a direct
pass-through of an already-computed platform figure, a plain array
filter/sort/group operation over already-computed values, or a
disclosed, deterministic template sentence gated by an already-computed
threshold — every statement is 100% reproducible by re-running the same
rule against the same inputs.

---

## 2. Architecture — pure composition, zero new calculations

`lib/portfolioAnalyst.ts`'s `buildPortfolioAnalyst(userId, now?)` is the
single entry point. It introduces **zero new pricing, risk, or scoring
calculations** — every section is assembled from already-existing,
unmodified modules:

| Section | Reuses |
|---|---|
| Executive Daily Briefing | The Institutional Intelligence Engine's own Summary Engine (`intel.executiveSummary.bullets`, verbatim), plus 2 additional template sentences (Net Delta trend, current largest exposure) using the same fixed-template-lookup technique |
| Portfolio Snapshot | `buildPortfolioDashboard()` (Health Score, Overall Risk Rating, Buying Power, Open Positions, Total Exposure) + the exact 3-function theta composition (`currentOpenTrades()` → `computeTradeGreeks()` → `computeThetaIncome()`) `intelligenceEngine.ts`'s own private `buildThetaIncome()` already uses |
| Health Summary | The Institutional Intelligence Engine's own Health Engine (`intel.health`) — strengths/weaknesses are a pure slice of its own already worst-first-sorted `healthDrivers` array |
| Risk Summary | `buildPortfolioDashboard()`'s `stressTestSummary`, `highestEventRisk`, `highestConcentration`, `largestPosition`, `guidance`, and the `diversification` health factor — `riskTrend` reuses the shared `computeTrend()` primitive against the genuinely stored prior day's own `totalRiskPct` |
| Income Summary | `computeThetaIncome()` directly (`bySymbol`/`byStrategy` breakdowns) — `incomeHealth` reuses `computeTrend()` against the stored prior day's own `thetaMonthly` |
| Performance Summary | The pre-existing, entirely **SIMULATED** Performance Analytics engine (`lib/performanceAnalytics.ts`), fetched independently on the frontend — explicitly labeled, never presented as this account's own real trade history (see §5) |
| Greeks Summary | `buildPortfolioDashboard()`'s `netGreeks`/`largestRiskContributor` — `deltaTrend` reuses `computeTrend()` against the stored prior day's own `netDelta` (the only Greek with real persisted history) |
| Event Summary | `buildPortfolioEventRiskOverlay()`'s own full per-position list (safe/at-risk counts) and `buildPortfolioDashboard()`'s `eventTimelineSummary`/`highestEventRisk`/`expirationDistribution` |
| Learning Summary | `intelligenceLearning.ts`'s `learningLinksFor()` (lesson + glossary links) plus `strategyAcademy.ts`'s `getStrategyAcademyEntry()` (one new, small, disclosed category-to-strategy-key lookup table) |
| Portfolio Timeline | The Institutional Intelligence Engine's own Timeline Engine (`intel.timeline`, grouped by its own already-computed `new`/`resolved`/`persistent` status) plus a new, minimal "This Week" 7-day rollup (see §4) |
| Institutional Insights | Fixed-template sentences gated by already-computed thresholds off `buildPortfolioDashboard()`'s health factors and the Risk/Income/Health Summaries above |

`buildInstitutionalIntelligence()`, `buildPortfolioDashboard()`,
`buildPortfolioEventRiskOverlay()`, `currentOpenTrades()`,
`computeTradeGreeks()`, `computeThetaIncome()`, `computeTrend()`,
`learningLinksFor()`, `getGlossaryTerm()`, `getLearningTopic()`, and
`getStrategyAcademyEntry()` are all reused unmodified — confirmed
zero-line diff, and confirmed byte-identical output via dedicated
regression tests comparing this module's own figures directly against a
standalone call to each reused function.

---

## 3. Sequential composition, not `Promise.all` — a genuine, disclosed fix

`buildPortfolioAnalyst()`'s own top-level assembly calls its 5
sub-builders (`buildInstitutionalIntelligence`, `buildPortfolioDashboard`,
`buildThetaIncome`, `buildPortfolioEventRiskOverlay`,
`buildWeeklySummary`) **sequentially, not via `Promise.all`.** Several of
these independently resolve the same per-user settings row via
`serverState.ts`'s own pre-existing `getSettingsRow()` — a plain
check-then-insert, not an upsert. For a genuinely brand-new user whose
settings row doesn't exist yet, firing them concurrently races two
inserts against the same `settings_user_id_unique` constraint (the exact
same category of pre-existing `getSettingsRow()` race first disclosed at
Sprint 70, and independently rediscovered by this sprint's own test
suite). `getSettingsRow()` itself is shared, foundational code and was
**not** modified this sprint — a sequential `await` inside this module's
own new assembly function avoids the race entirely with no other
behavior change, since generating one executive briefing is not a
latency-sensitive request.

---

## 4. "This Week" — a new, minimal, read-only 7-day rollup

The Institutional Intelligence Engine's own Timeline Engine only ever
compares today against the single most recently recorded prior day.
Satisfying this sprint's own "This Week" requirement needed a genuinely
new (but strictly read-only) query: `buildWeeklySummary(userId, now)`
selects every `intelligence_snapshots` row within the last 7 calendar
days for the calling user, and reports `daysRecorded`, the min/max
`healthScore` across that window, and a trend (via the shared
`computeTrend()` primitive comparing the oldest vs. newest row in the
window). This is a **plain `SELECT` + array min/max**, never a new
scoring formula, and it honestly reports `insufficient_history` (with
`daysRecorded: 0`) whenever fewer than 2 rows exist in the window — never
fabricated. No new table, no new column — `intelligence_snapshots`
already accumulates one row per user per calendar day (Sprint 1), so
genuine multi-day history exists for any user who has used the platform
across more than one day.

---

## 5. Performance Summary — a genuine, disclosed engine boundary

The sprint's own requested fields (Return, Drawdown, Win Rate,
Expectancy, Average Winner, Average Loser, Portfolio Growth) map exactly
onto the pre-existing, already-shipped **Performance Analytics engine**
(`lib/performanceAnalytics.ts`, `GET /performance/analytics`) — but that
engine is **entirely SIMULATED**: a deterministic, seeded population of
sample trades, explicitly disclosed in its own header as never touching
the real `trades` table. This is a genuinely different engine from the
one this sprint's other 9 sections draw on (which all read the real
Paper Trading `trades` table via `buildPortfolioDashboard()`/
`buildPortfolioEventRiskOverlay()`/`computeThetaIncome()`).

Rather than silently blend two differently-sourced datasets into one
backend response, or duplicate Performance Analytics' own math into
`lib/portfolioAnalyst.ts` (violating the sprint's own explicit "do not
create new calculations" instruction), Performance Summary is fetched
**independently on the frontend** via the pre-existing
`useGetPerformanceAnalytics({ period: "all" })` hook — the exact same
multi-hook composition pattern `CommandCenter.tsx` already established
for combining data from more than one engine on one page. The Performance
Summary card is explicitly labeled **"SIMULATED"** in the UI, and its
own description states plainly that it reflects "a deterministic, seeded
population of sample trades, not this account's own real Paper Trading
history" — never presented as if it were this session's real performance.

Net Liquidation and Daily P/L (Portfolio Snapshot's own two remaining
fields) follow the identical pattern: `routes/portfolio.ts`'s `GET
/portfolio/summary` computes `accountValue`/`dayPnl` inline in its own
route handler (never extracted into a reusable `lib` function), so
rather than duplicate that arithmetic in the new backend module, the
frontend independently calls the pre-existing `useGetPortfolioSummary()`
hook a second time — these two fields are real, not simulated, sourced
from the same real `trades` table every other section of this page
reads.

---

## 6. Learning Summary — one small, disclosed new mapping

Every section (Health, Risk, Income, Greeks, Event) gets a
`LearningCrossLink` — a related lesson, a related glossary term, and a
related strategy. The lesson/glossary pair is a direct, unmodified reuse
of `intelligenceLearning.ts`'s own `learningLinksFor(category)` catalog
(built by the Institutional Intelligence Engine sprint, extended by the
AI Teacher & Learning Centre sprint). The one genuinely new piece of
code this sprint adds is a small, disclosed `SECTION_STRATEGY` lookup
table mapping each of the 5 sections to one representative, **real**
`StrategyAcademyKey` (e.g. Risk → Vertical Spread, Income → Covered
Call) — never a fabricated strategy name, resolved via the pre-existing
`getStrategyAcademyEntry()`.

---

## 7. API surface

One new, read-only endpoint: **`GET /portfolio-analyst`**
(`routes/portfolioAnalyst.ts`) — resolves the calling user via the
existing `getScopedUserId(req)` (unauthenticated requests resolve to the
legacy-owner stand-in, matching every other route in this codebase), and
returns the full `PortfolioAnalystResult`. The only write this route can
ever trigger is the same, already-existing, at-most-once-per-calendar-day
`intelligence_snapshots` insert `buildInstitutionalIntelligence()` itself
already performs — never a second, competing write.

`openapi.yaml` gained the `/portfolio-analyst` path plus 13 new
`Analyst`-prefixed component schemas. **The `Analyst` prefix is a
deliberate, disclosed collision-avoidance choice**: a pre-existing
`PortfolioSnapshot` schema already exists (Position Sizing & Portfolio
Impact, an unrelated, differently-shaped schema) — this sprint's own
snapshot schema is named `AnalystPortfolioSnapshot` to avoid the exact
kind of Orval schema-naming collision first disclosed at Phase 2 Sprint
28. `executiveBriefing` deliberately reuses the pre-existing
`IntelligenceDailySummary` schema directly (its `{headline, bullets,
generatedAt}` shape is byte-identical to what this sprint needed) rather
than defining a redundant new one. `api-zod`/`api-client-react`
regenerated cleanly, no naming collisions.

---

## 8. Frontend

A new page, `pages/PortfolioAnalyst.tsx`, mounted at
`/portfolio-analyst` (new nav item, positioned directly after
"Institutional Intelligence"). Displays all 11 requested sections as
individual cards: Executive Daily Briefing, Portfolio Snapshot, Health
Summary, Risk Summary, Income Summary, Performance Summary (labeled
SIMULATED), Greeks Summary, Event Summary, Learning Summary, Portfolio
Timeline, and Institutional Insights. **Five permanent indicator
badges** — "AI Portfolio Analyst", "Institutional Intelligence",
"Deterministic Analysis", "Paper Trading", "Read Only" — are always
visible, per the sprint's own explicit requirement. This page never
submits, closes, or modifies anything, and never renders a trade
recommendation or execution suggestion anywhere — confirmed by a
dedicated frontend test asserting no such text ever appears.

---

## 9. Testing

- `lib/portfolioAnalyst.test.ts` — the full orchestrator against
  isolated, fresh test users covering every scenario the sprint's own
  Testing section requested: empty portfolio, healthy (balanced,
  multi-symbol) portfolio, large portfolio (8 positions), high
  concentration, high Greeks exposure, high event risk, high theta
  income, timeline (with a real, manually-recorded prior-day snapshot),
  persistence discipline (at-most-once-per-day, never mutates trades,
  deterministic), and learning integration. "Negative Performance"/
  "Positive Performance" are covered by the pre-existing, unmodified
  `lib/performanceAnalytics.test.ts` — Performance Summary is a
  frontend-fetched, independently-tested engine (§5), not this module's
  own responsibility.
- `routes/portfolioAnalyst.route.test.ts` — live end-to-end HTTP tests
  against the real app, proving the response shape, the
  never-a-broker-write-surface/never-a-recommendation-field proof, and
  determinism across repeated calls.
- `pages/PortfolioAnalyst.test.tsx` — frontend smoke tests covering all
  5 permanent badges, loading/error states, every one of the 11
  sections' own rendering (including honest empty-state paths), the
  Performance Summary's SIMULATED labeling and its own honest-
  unavailable state, Net Liquidation/Daily P/L's real-vs-unavailable
  states (the independent `useGetPortfolioSummary()` hook), and the
  never-a-recommendation proof.

---

## 10. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts`, `portfolioStressTest.ts`, `portfolioDashboard.ts`
  — zero-line diff (the 7 files explicitly named as protected for this
  sprint).
- `intelligenceEngine.ts`, `intelligenceObservations.ts`,
  `intelligenceHealth.ts`, `intelligenceSummary.ts`,
  `intelligenceTimeline.ts`, `intelligenceLearning.ts`,
  `portfolioEventRisk.ts`, `positionSizing.ts`, `serverState.ts`,
  `thetaIncome.ts`, `performanceAnalytics.ts`, `routes/portfolio.ts` —
  zero-line diff; every one of their own exported functions is reused,
  not reimplemented.
- No broker write operations of any kind.
- No portfolio mutation of any kind.
- No LLM call of any kind.
- The platform remains **Paper Trading only** throughout.

---

## 11. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.18 — the higher-level
  architectural summary of this same sprint.
- `docs/Institutional-Intelligence-Engine.md` — the Institutional
  Intelligence Engine this sprint composes on top of (the Observation,
  Explanation, Health, Summary, Timeline, and Learning Engines).
- `docs/AI-Teacher-Learning-Centre.md` — the source of the lesson/
  glossary links reused by this sprint's own Learning Summary section.
- `docs/Portfolio-Dashboard.md` — the Portfolio Risk Dashboard whose own
  response shape backs this sprint's Snapshot/Risk/Greeks/Event
  Summaries.
- `docs/Operations-Handbook.md` §6.20 — day-to-day operational usage.
- CLAUDE.md rule 1/2 — `execution.ts`/`autoExecution.ts`/
  `autoAdjustment.ts` are never modified without explicit, specific
  approval; this sprint touches none of them.
