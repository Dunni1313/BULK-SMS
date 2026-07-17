# AI Teacher & Learning Centre

**Phase 8 — Institutional Intelligence Engine, Sprint 2.** A unified
educational layer consolidating this platform's existing educational
functionality (Delta Masterclass, Greeks Tutor, Trading Quiz, Trade
Lessons, Value Investing School) with new, deterministic education:
structured Learning Paths, a Strategy Academy, a cross-linked Glossary,
Contextual Explain Mode, Portfolio Learning Mode, Interactive
Simulations, and unified Learning Progress tracking.

**Paper Trading only. Educational only. Read-only**, except Learning
Progress (view/complete) — the **only** user-state mutation this sprint
introduces. **No LLM. No hallucinated content.** Every piece of
educational content is a plain, deterministic, version-controlled
TypeScript literal. No trade recommendations. No portfolio mutation. No
broker writes. No execution logic touched.

---

## 1. Repository investigation, before writing any code

Direct inspection of the existing codebase, per the sprint's own
explicit instruction to reuse rather than rebuild, found:

- **`pages/learn/DeltaMasterclass.tsx`** (`/learn/delta`) and
  **`pages/learn/GreeksTutor.tsx`** (`/learn/greeks`) — real, existing
  Greeks-education pages with live worked examples.
- **`pages/learn/TradeLessons.tsx`** (`/lessons`) — existing static
  lesson content backed by `lib/coach.ts`'s `LearnContent`.
- **`pages/learn/Quiz.tsx`** (`/learn/quiz`) — the **Greeks quiz**,
  backed by `lib/coach.ts` + `routes/coach.ts` + the
  `greeks_quiz_results` table, with a real `GET /coach/quiz/progress`
  endpoint (attempts, best-by-topic, streak, improvement).
- **`pages/ValueInvestingSchool.tsx`**
  (`/stock-analyst/value-investing-school`) — the **Value Investing
  quiz**, backed by `lib/valueSchool.ts` + `routes/stockAnalyst.ts` +
  the `value_quiz_results` table — but with **no progress endpoint at
  all**, a real, pre-existing gap this sprint closes (§4 below).
- **`lib/intelligenceLearning.ts`** (Phase 8, Sprint 1) — a fixed
  catalog mapping each Institutional Intelligence Engine observation
  category to a real existing page, always ending with an honestly
  disclosed `{ label: "AI Teacher", href: null, comingSoon: true }`
  placeholder — the explicit gap this sprint's own "Institutional
  Intelligence Integration" requirement resolves (§8 below).
- **No existing glossary, no existing Strategy Academy, no existing
  Explain Mode, no existing Interactive Simulations, no existing
  cross-quiz Learning Progress tracking.**

**Decision: reuse, not rebuild.** Nothing above was replaced. The
Greeks quiz's own streak/progress aggregation was extracted into a
shared module and reused (not duplicated) for the Value quiz. Delta
Masterclass, Greeks Tutor, Trade Lessons, and the Greeks quiz all stay
exactly where they are — the new Learning Centre links out to them
rather than re-authoring their content.

---

## 2. Architecture — 7 new backend modules, all deterministic

| Module | Role |
|---|---|
| `lib/glossary.ts` | ~52 terms across 7 categories, cross-linked to each other and to lesson keys. |
| `lib/learningPaths.ts` | 7 structured Learning Paths (47 topics total), each linking real existing pages/tools where one already exists, and to the new Strategy Academy/Glossary where relevant. |
| `lib/strategyAcademy.ts` | 8 strategies, each with all 10 requested detail fields. |
| `lib/metricExplainer.ts` | Contextual Explain Mode — resolves a metric's real current value, plain-English meaning, source calculation, and why it matters. |
| `lib/interactiveSimulations.ts` | 5 deterministic simulation types (Delta, Theta, Expected Move, 3 Payoff diagrams, Concentration). |
| `lib/quizProgress.ts` | Shared streak/best-by-topic/improvement aggregation, extracted from `routes/coach.ts`, reused by both quiz systems. |
| `lib/learningProgress.ts` | Learning Progress tracking — the only new user-state mutation. |

None of these modules introduce a new pricing, risk, or portfolio
calculation — every number they surface is either a plain content
literal or a direct read/reuse of an already-computed figure from an
existing, unmodified module (`lib/portfolioDashboard.ts`,
`lib/intelligenceEngine.ts`, `lib/optionsMath.ts`'s `bs()`,
`lib/execution.ts`'s `canonicalQuote()`, `lib/coach.ts`'s
`positionGreeks()`).

---

## 3. Learning Paths (`lib/learningPaths.ts`)

7 paths, 47 topics, exactly the structure requested:

1. **Foundations** (8 topics) — Stocks, Options, Calls, Puts, Strike
   Price, Premium, Expiration, Assignment.
2. **Options Greeks** (6 topics) — Delta, Gamma, Theta, Vega, Rho,
   Portfolio Greeks. Delta/Gamma/Theta/Vega link out to the pre-existing
   Delta Masterclass/Greeks Tutor pages rather than re-authoring that
   content; Portfolio Greeks links to `/portfolio`.
3. **Volatility** (5 topics) — IV, Historical Volatility, IV Rank,
   Expected Move, Earnings Volatility & IV Crush.
4. **Options Strategies** (8 topics) — Covered Calls, Cash Secured
   Puts, Wheel, Vertical Spreads, Iron Condors, Iron Butterflies,
   Calendar Spreads, Diagonal Spreads — each links to its own Strategy
   Academy entry (§5).
5. **Portfolio** (8 topics) — Position Sizing, Portfolio Health, Buying
   Power, Concentration, Diversification, Correlation, Stress Testing,
   Event Risk — each links to its own real, existing overlay page.
6. **Performance** (6 topics) — Win Rate, Drawdown, Theta Income,
   Premium Collected, Return on Capital, Expectancy.
7. **Institutional Thinking** (6 topics) — Portfolio Construction, Risk
   Contribution, Capital Allocation, Position Management, Decision
   Quality, Process over Prediction.

Every topic carries `relatedGlossaryKeys` cross-referenced against
`lib/glossary.ts`'s own real keys — proven never-dangling by a dedicated
test (`learningPaths.test.ts`). Content is a plain TypeScript literal,
never LLM-generated.

**Routes (frontend, `pages/learn/LearningPaths.tsx`):**
`/learn/paths` (list), `/learn/paths/:pathKey` (one path's topics),
`/learn/paths/:pathKey/:topicKey` (deep link to a single topic — the
destination Explain Mode's `relatedLessonHref` and the Institutional
Intelligence Engine's own learning links both point to). Expanding a
topic records it viewed; a "Mark Complete" button records completion —
the only 2 mutation points on this page.

---

## 4. Strategy Academy (`lib/strategyAcademy.ts`)

8 strategies, each with all 10 requested fields: Construction, Ideal
Market, Maximum Profit, Maximum Loss, Greeks Profile, Time Decay,
Volatility Behavior, Assignment Risk, Common Mistakes, Institutional
Perspective — plus an 11th, "Paper Trading Example."

**Honest live-vs-unavailable split, per direct inspection of
`execution.ts`'s own `Strategy` type** (`"iron_condor" | "iron_fly" |
"calendar_spread" | "earnings"`): only the 3 strategies this platform's
real scanner/execution engine actually builds
(`iron_condor`/`iron_fly`/`calendar_spread`) get a **real, live worked
example** — built via `execution.ts`'s own `canonicalQuote()` +
`coach.ts`'s own `positionGreeks()`, the exact same functions the real
Trade Ticket and Delta Masterclass already use. The other 5 (Covered
Call, Cash Secured Put, Wheel, Vertical Spread, Diagonal Spread) **never
fabricate a live number** — the paper example honestly discloses
`available: false` with a stated reason.

`builtByThisEngine: boolean` is surfaced on every entry so the frontend
can badge live-example strategies distinctly.

**Routes (frontend, `pages/learn/StrategyAcademy.tsx`):**
`/learn/strategy-academy` (list), `/learn/strategy-academy/:strategy`
(one strategy's full detail).

---

## 5. Glossary (`lib/glossary.ts`)

~52 terms across the 7 requested categories (Foundations, Greeks,
Volatility, Strategies, Portfolio, Performance, Institutional). Every
term carries `relatedTermKeys` (cross-links to other glossary terms) and
`relatedLessonKeys`. `searchGlossary(query?, category?)` filters
client-side friendly (the API returns the full set; filtering happens in
the browser for this small, static dataset — see §9 for why no
`?q=`/`?category=` query params were added to the OpenAPI contract).

**Routes (frontend, `pages/learn/Glossary.tsx`):** `/learn/glossary`
(searchable/filterable list), `/learn/glossary/:key` (deep link to a
single term — the destination every lesson's/Explain Mode's/Strategy
Academy's own `relatedGlossaryKeys` point to).

---

## 6. Contextual Explain Mode (`lib/metricExplainer.ts`)

13 supported metric codes, exactly the requested list: Portfolio
Health, Delta, Theta, Gamma, Vega, Buying Power, Event Risk, Stress
Test, Concentration, Probability of Profit, Maximum Profit, Maximum
Loss, Expected Move.

**Every explanation carries all 6 requested fields**: `currentValue`
(the user's own real, current figure — never a client-supplied value),
`plainEnglish`, `sourceCalculation`, `whyItMatters`,
`relatedLessonHref`, `relatedGlossaryKeys`.

**Genuine reuse of the Institutional Intelligence Engine's own
Explanation Engine**, per the sprint's own explicit instruction:
`explainMetric()` checks whether a real, currently-emitted Observation
exists for the metric (via a `METRIC_OBSERVATION_CODES` map) and, if
so, calls `intelligenceObservations.ts`'s own `explainObservation()` —
the exact same function the Institutional Intelligence Engine itself
uses, never a second, competing formatter. When no Observation is
currently emitted (the common, healthy case — nothing notable is
happening right now), Explain Mode falls back to reading the same
already-computed dashboard/health figures directly, since Explain Mode
must always answer "what is my current value," not only "what
changed."

Three metric families:

- **Portfolio-wide** (`portfolio_health`/`buying_power`/`event_risk`/
  `concentration`/`stress_test`) — reads `buildInstitutionalIntelligence()`
  / `buildPortfolioDashboard()`.
- **Portfolio Greeks** (`delta`/`theta`/`gamma`/`vega`) — reads the
  Portfolio Dashboard's own `netGreeks`, reusing `coach.ts`'s existing
  plain-English formatters (`deltaPlain`/`thetaPlain`/`gammaPlain`/
  `vegaPlain`, exported this sprint for reuse — zero behavior change).
- **Trade-scoped** (`probability_of_profit`/`max_profit`/`max_loss`/
  `expected_move`) — requires a `tradeId` (a per-position figure, not
  portfolio-wide; a 400 error, never a fabricated portfolio-wide
  substitute, when omitted). Reuses the trade's own already-computed,
  stored `pop`/`maxProfit`/`maxLoss` fields, and `lib/earnings.ts`'s
  newly-extracted `computeExpectedMove()` for expected move. Ownership
  is scoped by `userId` — a `tradeId` belonging to another user 404s.

**Never accepts a client-supplied value to "explain"** — every value is
resolved server-side from the calling user's own real data, so an
Explain Mode response can never attach a real-sounding explanation to a
fabricated number.

**Frontend: `<ExplainButton>`** (`src/components/learn/ExplainButton.tsx`)
— a reusable popover widget, wired onto:

- `pages/PortfolioDashboard.tsx` — Portfolio Health, Buying Power, Net
  Delta/Gamma/Theta/Vega, Highest Event Risk, Highest Concentration,
  Stress Test Summary.
- `pages/Portfolio.tsx` — Beta-Weighted Delta, Theta, Vega, Gamma.
- `pages/Trades.tsx` — a per-row Explain button offering all 4
  trade-scoped metrics (Probability of Profit, Maximum Profit, Maximum
  Loss, Expected Move) via a selector, scoped to that row's own
  `tradeId`.

Fetches only when opened (never on page load), via a small plain-fetch
helper (`src/lib/explain-fetch.ts`) mirroring `coach-stream.ts`'s own
established pattern for routes deliberately kept outside the OpenAPI
contract (§9).

---

## 7. Portfolio Learning Mode

`GET /learning-centre/portfolio-lesson` bundles Explain Mode over the
calling user's own real, current portfolio for 6 metrics
(`portfolio_health`/`buying_power`/`delta`/`theta`/`concentration`/
`event_risk`) — e.g. "Your portfolio Delta is +42," with what it means,
why it matters, its source calculation, and a related lesson link.
**Never recommends a trade** — it is pure composition over Explain
Mode, adding zero new logic of its own.

Surfaced as the "My Portfolio, Explained" tab on the Learning Centre hub
(§10).

---

## 8. Institutional Intelligence Engine integration

Per the sprint's own explicit "every Intelligence observation should
link to: Source module, Related lesson, Related glossary, Portfolio
explanation" requirement, `lib/intelligenceLearning.ts` was updated
(not rewritten — the same `learningLinksFor(category)` catalog
function, extended):

- **Source module** was already carried on every `Observation` itself
  (`sourceModule`) since Sprint 1 — unchanged.
- **AI Teacher** resolves from `{ href: null, comingSoon: true }` to a
  real `{ label: "AI Teacher & Learning Centre", href: "/learn",
  comingSoon: false }` entry.
- **Related lesson** — a `CATEGORY_LESSON` map ties each observation
  category to a real `lib/learningPaths.ts` topic (e.g. `concentration`
  → the Portfolio path's own `portfolio-concentration` topic), producing
  a real `/learn/paths/:pathKey/:topicKey` link — reused, never
  duplicated, via `getLearningTopic()`. The 3 platform-status categories
  (`broker_status`/`paper_trading_status`/`credentials_status`) have no
  matching topic and are honestly omitted, never fabricated.
- **Related glossary** — a `CATEGORY_GLOSSARY` map does the same against
  `lib/glossary.ts`'s own real keys via `getGlossaryTerm()`.
- **Portfolio explanation** — every category also gets a "Your
  Portfolio, Explained" link (`/learn?tab=portfolio`), deep-linking
  straight into Portfolio Learning Mode (§7).

`lib/intelligenceEngine.ts`'s own `dedupeLearningLinks()` (unmodified)
still dedupes by `href`, so the same "AI Teacher & Learning Centre" and
"Your Portfolio, Explained" links appearing across multiple categories
never produce duplicate entries in the top-level `learningLinks[]`
array.

**Disclosed test-behavior change, not a regression:** `learningLinksFor()`
no longer ever returns a `comingSoon: true` entry — every prior test
asserting the old placeholder shape was updated
(`lib/intelligenceLearning.test.ts`, `lib/intelligenceEngine.test.ts`,
`routes/intelligence.route.test.ts`) to assert the new, resolved shape
instead. No Observation/Health/Summary/Timeline logic changed.

---

## 9. Interactive Simulations (`lib/interactiveSimulations.ts`)

5 simulation types, deliberately scoped from the 9 named in the
sprint's own request:

- **Delta** and **Theta** — reuse `optionsMath.ts`'s own real `bs()`
  Black-Scholes function directly, across a price range / DTE range.
- **Expected Move** — reuses `lib/earnings.ts`'s newly-extracted
  `computeExpectedMove()` (a behavior-preserving refactor — the exact
  same formula `analyzeEarnings()` already used, confirmed byte-identical
  by existing tests).
- **Payoff Diagrams** (Covered Call, Cash Secured Put, Iron Condor) —
  the standard textbook payoff-at-expiration formula, deliberately
  distinct from `bs()`'s own before-expiration pricing.
- **Concentration** — the standard Herfindahl-Hirschman-Index formula
  over user-supplied hypothetical weights.

**Deliberately not built**: a 7th "Wheel" simulator (disclosed as the
combination of the Covered Call and Cash Secured Put diagrams already
offered) and a "Position Sizing" simulator (deliberately **not**
re-simulated with arbitrary numbers — this platform's own real Position
Sizing & Portfolio Impact Calculator already computes that against a
user's REAL portfolio; duplicating it with fabricated inputs would be a
strictly worse experience). The Learning Centre links out to the real
tool instead.

Every response carries `educationalSimulation: true`, `notMarketData:
true`, `noTradeRecommendation: true` — enforced server-side, never
omittable — and the frontend always renders these as fixed badges.
Never randomness, never an LLM.

Surfaced as the "Simulations" tab on the Learning Centre hub (§10).

---

## 10. Quiz system — reused and closed a real gap

**Reused, not rebuilt.** `lib/quizProgress.ts` extracts the exact
streak/best-by-topic/improvement aggregation `routes/coach.ts`'s own
`GET /coach/quiz/progress` handler already had inlined — a
behavior-preserving refactor, confirmed by that route's own unchanged
behavior. `routes/stockAnalyst.ts` gained a new `GET
/value-quiz/progress` route reusing the same shared aggregation against
`value_quiz_results` instead of `greeks_quiz_results` — closing the
real, pre-existing gap found in §1 (the Value quiz previously had no
progress endpoint at all).

Both quiz systems — Delta Masterclass's Greeks quiz and the Value
Investing School's own quiz — are unchanged in their own quiz-taking UI;
only the shared progress-aggregation internals moved.

---

## 11. Learning Progress (`lib/learningProgress.ts`)

**The only permitted user-state mutation this sprint introduces.** One
new table, `learning_progress` (migration `019`) — one row per
`(userId, itemType, itemKey)`, `itemType ∈ {lesson, glossary, path,
strategy}`, `viewedAt`/`completedAt`/`updatedAt` timestamps, a real
unique index on `(userId, itemType, itemKey)` enforcing an upsert
(`onConflictDoUpdate`), never a growing event log. `userId` is `ON
DELETE RESTRICT`, matching every other business table's convention.

Two write functions: `recordViewed()` (called when a lesson/topic
expands, a glossary term is deep-linked to, or a strategy detail loads)
and `recordCompleted()` (called only from an explicit "Mark Complete"
button click — never automatically). `GET /learning-centre/progress`
returns lessons viewed/completed, glossary terms viewed, strategies
viewed, per-path completion percentages, **both** quiz systems' progress
(read live from their own tables, never a second, duplicated copy — see
§10), and recent history (25 most recently updated items).

`completedLessonKeys`/`completedGlossaryKeys`/`completedStrategyKeys`
(full key arrays, never limited to the 25-row recent-history window) let
detail pages render an accurate per-item checkmark regardless of how
long ago an item was completed.

Surfaced as the "Progress" tab on the Learning Centre hub (§10) and
inline checkmarks on the Learning Paths/Strategy Academy pages.

---

## 12. The unified Learning Centre hub (`pages/learn/LearningCentre.tsx`)

Mounted at `/learn` — the destination the resolved "AI Teacher" link
(§8) now points to. 4 tabs: **Overview** (links into all 7 Learning
Paths, the Strategy Academy, the Glossary, and the pre-existing
Delta Masterclass/Greeks Tutor/Trade Lessons/Quiz/Value Investing
School pages — "continue learning" section), **Simulations** (§9),
**My Portfolio, Explained** (§7), **Progress** (§11).

Supports a `?tab=` deep link (`useSearch()` from `wouter`) so the
Institutional Intelligence Engine's own "Your Portfolio, Explained" link
(§8) opens directly on the right tab.

Always shows 2 permanent badges ("Paper Trading Mode", "Educational
Only") and a closing disclosure restating: educational content only,
never a trade recommendation, no broker writes, no order execution, no
portfolio mutation beyond the user's own learning progress.

**New nav section additions** (`components/layout/AppLayout.tsx`'s
existing "Coach & Learn" group): "AI Teacher & Learning Centre" (first),
"Learning Paths", "Strategy Academy", "Glossary" — positioned ahead of
the pre-existing Delta Masterclass/Greeks Tutor/Trading Quiz/Trade
Lessons/Value Investing School items, all of which remain unchanged.

---

## 13. API surface

New router `routes/learningCentre.ts`, mounted with no path prefix
(matching `routes/intelligence.ts`'s own precedent):

| Method | Path | Notes |
|---|---|---|
| GET | `/learning-centre/glossary` | All terms (client-side filtered). |
| GET | `/learning-centre/glossary/:key` | One term; 404 if unknown. |
| GET | `/learning-centre/paths` | All 7 paths. |
| GET | `/learning-centre/paths/:pathKey` | One path; 404 if unknown. |
| GET | `/learning-centre/strategy-academy` | All 8 entries. |
| GET | `/learning-centre/strategy-academy/:strategy` | One entry; 404 if unknown. |
| GET | `/learning-centre/explain/:metric` | Explain Mode; `?tradeId=` for trade-scoped metrics. Kept **outside** the OpenAPI/orval contract (see below). |
| GET | `/learning-centre/portfolio-lesson` | Portfolio Learning Mode. |
| GET | `/learning-centre/progress` | Learning Progress summary. |
| POST | `/learning-centre/progress/view` | Records a view — the only 2 mutation routes. |
| POST | `/learning-centre/progress/complete` | Records a completion. |
| POST | `/learning-centre/simulate` | Interactive Simulations. |

**`/learning-centre/explain/:metric` deliberately kept outside the
typed OpenAPI contract** — documenting a path parameter together with a
query parameter (`?tradeId=`) on the same operation is a known Orval
codegen collision, first disclosed at Sprint 40 of the Alpaca Paper
Trading family of sprints (`GetTradingStructureParams`). The route's own
`?tradeId=` override is fully functional server-side; the frontend calls
it via a small plain-fetch helper (`src/lib/explain-fetch.ts`) instead
of a generated hook, mirroring `coach-stream.ts`'s own established
pattern for the same situation.

Every other route is fully modeled in `openapi.yaml` (a new
`LearningGlossaryTerm`/`LearningTopic`/`LearningPath`/
`LearningStrategyAcademyEntry`/`LearningQuizProgressSummary`/
`LearningProgressSummary`/`LearningSimulationInput`/
`LearningSimulationResult`/`LearningMetricExplanation`/
`LearningPortfolioLesson` family of schemas, ~20 new schemas total),
regenerated cleanly via `api-zod`/`api-client-react` with zero naming
collisions.

No database migration beyond `learning_progress` (§11) — every other
route reads existing tables or plain content literals.

---

## 14. Testing

**Backend, pure unit (no database):**
- `lib/glossary.test.ts` — uniqueness, no-dangling-cross-reference proof, category coverage, search/filter correctness, honest-null for an unknown key.
- `lib/learningPaths.test.ts` — the 7-path/47-topic structure, unique topic keys, every `relatedGlossaryKeys` cross-referenced against real glossary keys, every `externalHref` a real, existing route.
- `lib/strategyAcademy.test.ts` — all 10 detail fields present, `builtByThisEngine` correctly split across the 3 live vs. 5 unavailable strategies, live examples carry real Greeks, unavailable examples never fabricate a symbol/detail/Greeks.
- `lib/interactiveSimulations.test.ts` — delta/theta curve shape and determinism (reusing real `bs()`), expected-move widening with time, payoff caps/max-profit/max-loss for all 3 diagrams, concentration HHI scoring and weight normalization, every input-validation error path.
- `lib/quizProgress.test.ts` — `utcDayKey`/`computeStreak` (consecutive-day counting, lapse detection, gap handling), `computeQuizProgress` (best-by-topic, average, improvement, attempts ordering, streak derived from full history not the capped attempts list).

**Backend, DB-backed (isolated, fresh users):**
- `lib/metricExplainer.test.ts` — all 13 metric codes, the Portfolio-Greeks family, the portfolio-wide family, the trade-scoped family (including the missing-tradeId 400 and cross-user 404 tenant-isolation proof), and a structural proof `explainMetric()` never accepts a client-supplied value.
- `lib/learningProgress.test.ts` — a brand-new user's all-zero honesty, `recordViewed`/`recordCompleted` upsert idempotency, independent lesson/glossary/strategy tracking, path-completion rollup, recent-history ordering, and live (never duplicated) quiz-progress reuse.

**Backend, live route (real Postgres, real app):**
- `routes/learningCentre.route.test.ts` — all 12 routes, every 400/404 path, the labeled-simulation contract, and the full view→complete→progress round trip with a collision-free random item key.
- `routes/valueQuizProgress.route.test.ts` — the new `/value-quiz/progress` route shape-matches the pre-existing `/coach/quiz/progress` route, and a real graded quiz attempt is reflected in a subsequent progress read.
- One new case in `lib/tenantIsolation.test.ts` (`learning_progress`, reusing the established `assertTenantIsolation` helper).

**Institutional Intelligence Engine regression (§8):**
- `lib/intelligenceLearning.test.ts` updated — no learning link is ever `comingSoon`, the AI Teacher entry always resolves to `/learn`, every category includes the portfolio-explanation deep link, categories with a matching topic get a real lesson link, the 3 platform-status categories honestly omit one.
- `lib/intelligenceEngine.test.ts` / `routes/intelligence.route.test.ts` updated to match — Observation/Health/Summary/Timeline logic itself is unchanged.

**Frontend:**
- `pages/learn/Glossary.test.tsx` — list rendering, search filtering, honest empty state, deep-link focus + view-recording, honest not-found.
- `pages/learn/StrategyAcademy.test.tsx` — list rendering with the Live Example badge correctly scoped, live vs. honestly-unavailable paper example rendering, honest not-found.
- `pages/learn/LearningPaths.test.tsx` — list + completion progress, collapsed-by-default topics, expand-records-viewed + Mark Complete wiring, deep-link auto-open, honest not-found.
- `pages/learn/LearningCentre.test.tsx` — the always-visible badges, all 4 tabs (Overview/Simulations/Portfolio/Progress), the `?tab=` deep link.
- `src/components/learn/ExplainButton.test.tsx` — fetch-on-open (never before), tradeId pass-through, honest error state, metric-selector re-fetch.
- `PortfolioDashboard.test.tsx`/`Portfolio.test.tsx`/`Trades.test.tsx` — all pre-existing tests pass unmodified with `<ExplainButton>` wired in (confirmed the button never triggers a fetch until clicked).

**Accessibility:** every interactive control (`ExplainButton`, topic
expand/collapse, Mark Complete, search inputs, category/simulation
selects) uses semantic, keyboard-reachable primitives from the existing
shadcn/Radix component library (`Popover`, `Select`, `Button`,
`Card`) — the same primitives every other page in this codebase already
uses; no new interaction pattern was introduced.

---

## 15. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts` — zero-line diff.
- `lib/portfolioDashboard.ts`, `lib/intelligenceObservations.ts`,
  `lib/intelligenceHealth.ts`, `lib/intelligenceSummary.ts`,
  `lib/intelligenceTimeline.ts`, `lib/intelligenceEngine.ts` — zero-line
  diff; every one is reused, not reimplemented.
- The existing Greeks quiz's own quiz-taking flow, Delta Masterclass,
  Greeks Tutor, Trade Lessons, and Value Investing School's own
  lesson/quiz UI — all unchanged.
- No broker write operations of any kind.
- No portfolio or trade mutation of any kind (Learning Progress is the
  sole, disclosed exception).
- No LLM call of any kind.
- The platform remains **Paper Trading only** throughout.

---

## 16. Cross-references

- `docs/Institutional-Intelligence-Engine.md` §9/§14 — the Learning
  Engine catalog this sprint resolved, and the Explanation Engine this
  sprint's own Explain Mode reuses.
- `docs/Operations-Handbook.md` §6.19 — day-to-day operational usage.
- `docs/Alpaca-Paper-Trading-Architecture.md` §4.17 — the higher-level
  architectural summary of this same sprint, plus the full test
  inventory table.
- CLAUDE.md rule 1/2 — `execution.ts`/`optionsMath.ts`/`risk.ts`/
  `autoExecution.ts`/`autoAdjustment.ts` are never modified without
  explicit, specific approval; this sprint touches none of them.
