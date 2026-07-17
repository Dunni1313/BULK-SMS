# AI Trade Journal

This document covers the AI Trade Journal as it exists after the **AI
Trade Journal** sprint (Phase 8, Sprint 4). It is a companion to
`docs/Alpaca-Paper-Trading-Architecture.md` §4.19, which covers the same
sprint at a higher level alongside the rest of the Alpaca integration —
read that document for the broader architectural context.

---

## 1. What this is — and what it is not

The AI Trade Journal is a **deterministic behavioural analysis and
trade review system** analysing every completed Paper Trading trade
using this platform's own existing analytics, generating structured
educational feedback: a per-trade Trade Review, cross-trade Behaviour
Analysis, Decision Quality scoring, Learning Recommendations, and a
chronological Journal Timeline.

**This is NOT a chatbot. This is NOT an AI trading signal engine. This
is NOT financial advice. This is NOT portfolio management.** No
language model is ever called. No probability or statistical forecast
is ever generated. No trade recommendation is ever produced. Every
score and pattern is deterministic and fully traceable to an existing
calculation or a real, stored trade field — every observation is 100%
reproducible by re-running the same rule against the same inputs.

---

## 2. Architecture — pure composition, with a small, disclosed set of trivial generalizations

`lib/tradeJournal.ts`'s `buildTradeJournal(userId)` is the single entry
point. It introduces **zero new pricing or risk calculations** —
instead, it composes already-existing modules, plus three small,
disclosed helpers, each a trivial generalization of an existing formula
(never a new pricing/risk model):

| Helper | What it generalizes | Why it was needed |
|---|---|---|
| `computeGreeksAsOf()` | The exact `bs()`/leg-sign/multiplier formula `serverState.ts`'s own `computeTradeGreeks()` already uses | `computeTradeGreeks()` hardcodes `Date.now()` — this sprint's own explicit "Greeks at Entry"/"Greeks at Exit" requirement cannot be satisfied without evaluating at a historical date. Reuses `bs()`/`getSnapshot()` unmodified — `getSnapshot(symbol, dateStr)` already supports an arbitrary historical date, deterministically reproducing the SIMULATED price/IV as of that day. |
| `deriveLotQuantity()` | The same `max()`-of-leg-quantities formula `portfolioEventRisk.ts`'s own private `deriveLotQuantity()` already uses | That function is not exported, and `portfolioEventRisk.ts` is explicitly out of scope for modification this sprint ("Do NOT modify portfolio analytics") — a one-line, disclosed local re-implementation was the lower-risk choice over exporting a private helper from a protected-adjacent file. |
| `tradeHoldingPeriodDays()` | The exact `(closeDate-openDate)/86400000` formula `artifacts/ravish-trading/src/lib/tradeAnalytics.ts`'s own `holdingPeriodDays()` already uses on the frontend | This codebase has no frontend/backend shared-logic layer (the same disclosed constraint the Trade History sprint already established) — a backend composition needs its own copy of this one-line date arithmetic. |

Genuine, real reuse (all unmodified): `getEventRiskForSymbol()`
(`eventRisk.ts` — already accepts a `now` override, the exact same
function `execution.ts`/`autoExecution.ts`/`portfolioEventRisk.ts`
already call), `computeStopLoss()` (`risk.ts`), `getAccountValue()`/
`getSettingsRow()` (`serverState.ts`), `computeTrend()`
(`intelligenceTrend.ts`), `getLearningTopic()` (`learningPaths.ts`),
`getGlossaryTerm()` (`glossary.ts`), `getStrategyAcademyEntry()`
(`strategyAcademy.ts`), `learningLinksFor()` (`intelligenceLearning.ts`),
`getLearningProgress()` (`learningProgress.ts`).

---

## 3. Trade Review — supporting analytics only

For every completed Paper Trading trade, `buildTradeReviewFor()`
assembles: Strategy, Holding Period, Profit/Loss (the trade's own real,
stored `currentPnl`/`currentPnlPercent`, set exactly once by
`tradeClose.ts`'s existing `closeTradePosition()` — never recomputed),
Risk Taken/Reward Achieved (`maxLoss`/`maxProfit`, already stored),
Greeks at Entry/Exit (`computeGreeksAsOf()`, §2), Event Risk at Entry
(§4), and Position Size (`positionSizeContracts` via
`deriveLotQuantity()`, plus `positionSizePctOfAccount` — `maxLoss` as a
% of the account's current value).

**A genuine, disclosed data-availability gap, honestly handled rather
than silently narrowed:** "Maximum Drawdown" per individual trade is
**not** included as a Trade Review field — no intraday or daily P&L
history is persisted per trade anywhere in this codebase (only the
single, final `currentPnl` at close), so a genuine per-trade drawdown
curve cannot be honestly reconstructed. Fabricating one from the two
known points (entry, exit) would not be a real drawdown — this sprint
declined to do so rather than present an invented curve as real
history.

Every Trade Review links to the calling user's own already-existing
`journal_entries` row for that trade when one exists (`linkedJournalEntry`)
— reusing, never duplicating, the auto-generated journal entry
`tradeClose.ts`'s own `closeTradePosition()` already writes on every
real close. No new journal write occurs anywhere in this sprint.

---

## 4. Event Risk at Entry — a genuine historical reconstruction

`getEventRiskForSymbol(symbol, strategy, expiration, now)` already
accepts a `now` override (it always has — `execution.ts`/
`autoExecution.ts`/`portfolioEventRisk.ts` all call it this way for
live gating). Passing `now = trade.openDate.getTime()` deterministically
reconstructs exactly what the same event-risk gate would have reported
**at entry**, since the underlying `earningsEvent()` derivation is
itself a pure function of `(symbol, date)` via `getSnapshot()`'s own
seeded formula. This is not an approximation — it is the literal same
function, evaluated at a different, real, stored timestamp.
`heldThroughEarnings()` then checks whether any real `"earnings"`-typed
event date falls within `[openDate, closeDate]` — a plain string-range
comparison over real, deterministic event dates, feeding the "Held
Through Earnings" Decision Quality tag (§5) and the "Repeated Earnings
Exposure" Behaviour pattern (§6).

---

## 5. Decision Quality — every score references an existing rule

`scoreDecisionQuality()` never scores subjectively — every
`DecisionQualityTag` carries an explicit `ruleReference` naming the real
threshold or stored field it came from:

| Code | Fires when | Rule reference |
|---|---|---|
| `sizing_respected` / `sizing_exceeded` | `trade.maxLoss` vs. `accountValue × (settings.maxRiskPerTrade / 100)` | `settings.maxRiskPerTrade` |
| `exit_stop_loss_rule` | `exitReason === "Stop loss hit"` (the real, stored value `tradeClose.ts` set at close) | `risk.ts — computeStopLoss()` |
| `exit_profit_target_rule` | `exitReason === "Profit target reached (75%)"` | `settings.profitTarget75` |
| `exit_manual` | `exitReason === "Manual exit"` | `trades.exitReason` |
| `winner_let_run` | `realizedPnl > 0` and `realizedPnlPercent >= settings.profitTarget75` | `settings.profitTarget75` |
| `winner_closed_early` | a manually-exited winner that never reached the profit-target rule | `settings.profitTarget75` |
| `loss_capped_appropriately` / `loss_ran_beyond_plan` | `realizedPnl` vs. `computeStopLoss(credit, maxLoss, 2.0)` | `risk.ts — computeStopLoss()` |
| `held_through_earnings` | §4 | `eventRisk.ts — getEventRiskForSymbol()` |

**Position sizing is evaluated against the account's CURRENT value —
disclosed, not fabricated.** Account value at the exact moment of entry
is not persisted anywhere in this codebase (only realized P&L
accumulates via `getAccountValue()`'s own existing formula); every
`sizing_respected`/`sizing_exceeded` tag's own `detail` text states
this explicitly ("evaluated against current account value").

---

## 6. Behaviour Analysis — repeatable patterns, traceable to real history

`analyzeBehaviour()` runs entirely over the real, historical closed-trade
set (`MIN_TRADES_FOR_PATTERN = 3` before any pattern is even considered
— never a fabricated pattern from too little data): Over-Sizing,
Stable Position Sizing, Consistent Discipline, Excessive Concentration,
Strong Diversification, Frequent Early Exits, Holding Losing Trades Too
Long, and Repeated Earnings Exposure. Every pattern's own `detail` text
states its exact ratio and trade count (e.g. "NVDA accounts for 100% of
closed trades (4/4)") — never a vague or unsupported claim. All
threshold constants (`OVERSIZING_PATTERN_THRESHOLD_PCT`,
`DISCIPLINE_PATTERN_THRESHOLD_PCT`, `CONCENTRATION_PATTERN_THRESHOLD_PCT`,
`EARLY_EXIT_PATTERN_THRESHOLD_PCT`, `DIVERSIFICATION_PATTERN_THRESHOLD_PCT`)
are named, exported, and disclosed — the same "state a reasonable
default, disclose it" precedent this project has followed since e.g.
Sprint 29's 25%/40% concentration caps.

**Behaviour Trend** (`computeBehaviorTrend()`) reuses the shared
`computeTrend()` primitive (`intelligenceTrend.ts`) exactly as every
other engine in this codebase already does — comparing the rule-based
exit rate over the most recent `BEHAVIOR_TREND_WINDOW = 5` closed trades
against the rate over all earlier trades, honestly returning `null`
(never `insufficient_history` presented as a real trend) whenever fewer
than 10 total closed trades exist.

---

## 7. Learning Recommendations — education only

Every "area to improve" pattern maps to a real
`JournalLearningCrossLink` — a lesson (`getLearningTopic()`, preferring
`institutional-decision-quality` as the natural anchor for this whole
sprint's own theme), a glossary term (`getGlossaryTerm()` — this
codebase's glossary already includes `decision-quality`,
`position-sizing`, `process-over-prediction` entries, built with exactly
this future need in mind), and, for specific Decision Quality codes, a
real Strategy Academy entry (`getStrategyAcademyEntry()`). **Never a
trade recommendation** — confirmed by a dedicated test asserting no
"buy now"/"sell now"/"place order" text ever appears anywhere in the
recommendations.

---

## 8. Journal Timeline — real timestamps only, never a fabricated event

`buildJournalTimeline()` is a new, purpose-built chronological event
log. It reuses the Institutional Intelligence Engine's own Timeline
Engine (Phase 8, Sprint 1) as a **structural pattern** (an event-shaped
list with a status/type vocabulary) rather than importing
`intelligenceTimeline.ts`'s own `buildTimeline()` function directly —
that function solves a genuinely different problem (day-over-day
PORTFOLIO OBSERVATION diffing against `intelligence_snapshots`), not a
chronological log of already-timestamped trade-lifecycle events.

Four event types, every one carrying a REAL, stored timestamp:

- `trade_opened` / `trade_closed` — `trades.openDate`/`closeDate`.
- `learning_completed` — `learning_progress.completedAt`, via the
  already-existing `getLearningProgress()` (Phase 8, Sprint 2).
- `behaviour_change` — the one real `BehaviorTrend` (§6), anchored at
  the real close date of the most recent trade in its own comparison
  window.

**"Review generated" is deliberately not a separate, fabricated event.**
A Trade Review is computed fresh on every request, never persisted —
there is no real "generation timestamp" to attach to a standalone
event. It is represented as part of the same `trade_closed` entry
instead (label: "review generated"), since a review becomes available
the instant a trade closes — never a second, invented timestamp.

---

## 9. API surface

Two new, read-only endpoints:

- **`GET /trade-journal`** (`routes/tradeJournal.ts`) — the full
  `AITradeJournalResult`.
- **`GET /trade-journal/{tradeId}`** — a single Trade Review, the same
  shape found inside the first endpoint's own `recentTrades` array.
  404s for a trade that doesn't exist, isn't the caller's own, or isn't
  yet closed (a review only exists for a completed trade).

Neither route can ever trigger a write of any kind. `openapi.yaml`
gained both paths plus 10 new `Journal`-prefixed schemas — the
`Journal` prefix avoids any collision with the pre-existing,
unrelated `JournalEntry`/`JournalEntryInput`/`JournalEntryUpdate`
schemas (the free-text, user-authored journal, §10) and Engine 2's own
`Trading`-prefixed journal schemas. `JournalEventRiskAtEntry.events`
directly `$ref`s the already-existing `EventRiskEvent` schema rather
than redefining it. `api-zod`/`api-client-react` regenerated cleanly,
no naming collisions.

---

## 10. "Existing journal functionality" reuse

This sprint deliberately does **not** modify or replace the pre-existing,
free-text `journal_entries` table/`routes/journal.ts` (the user-authored
journal with title/content/mood/lessonLearned/tags, and the automatic
entry `tradeClose.ts` already writes on every real close). Instead, it
reads that same table read-only, surfacing each trade's own linked entry
inside its Trade Review (§3) — the two systems coexist: the pre-existing
journal is where a user writes their own reflections, the AI Trade
Journal is a deterministic, structured analysis layer over the same
underlying trade history.

---

## 11. Frontend

A new page, `pages/TradeJournal.tsx`, mounted at `/trade-journal-ai`
(new nav item, `BookMarked` icon, positioned directly after "AI
Portfolio Analyst"). Displays: a Progress Dashboard (Closed Trades,
Discipline Score, Sizing Respected rate, Rule-Based Exit rate, and the
Behaviour Trend badge when computed), Strengths, Areas to Improve,
Learning Recommendations, Recent Trades & Trade Reviews (with
per-trade Decision Quality tag badges and the linked journal entry when
one exists), and the Journal Timeline. **Five permanent indicator
badges** — "AI Trade Journal", "Behaviour Analysis", "Deterministic
Review", "Paper Trading", "Educational Only" — are always visible, per
the sprint's own explicit requirement. This page never submits, closes,
or modifies anything, and never renders a trade recommendation or
execution suggestion anywhere — confirmed by a dedicated frontend test
asserting no such text ever appears.

---

## 12. Testing

- `lib/tradeJournal.test.ts` — the full orchestrator and the single-trade
  lookup against isolated, fresh test users covering every scenario the
  sprint's own Testing section requested: no trade history, winning
  trades, losing trades (both stop-loss-capped and beyond-plan), small
  positions, large/oversized positions, diversified portfolios,
  concentrated portfolios, high Greeks, high event risk, large trade
  history (15 trades), timeline generation (real, sorted timestamps),
  learning integration (real completed-lesson events + never-a-trade-
  recommendation proof), linked-journal-entry reuse (proving zero new
  journal writes), persistence discipline (never mutates trades,
  deterministic), and tenant isolation for the single-trade lookup.
- `routes/tradeJournal.route.test.ts` — live end-to-end HTTP tests
  against the real app, proving both routes' response shapes, the
  404/400 error paths, the never-a-broker-write-surface/never-a-
  recommendation-field proof, and determinism across repeated calls.
- `pages/TradeJournal.test.tsx` — frontend smoke tests covering all 5
  permanent badges, loading/error states, the Progress Dashboard's real
  figures, Strengths/Areas-to-Improve (including their own honest empty
  states), Learning Recommendations (including its own honest empty
  state), a Recent Trades review's full rendering (including its linked
  journal entry), the honest empty-trades message, the Journal
  Timeline, a real Behaviour Trend badge, and the never-a-recommendation
  proof.

---

## 13. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts`, `portfolioDashboard.ts`, `portfolioStressTest.ts`
  — zero-line diff (the 7 files explicitly named as protected for this
  sprint).
- `portfolioEventRisk.ts`, `positionSizing.ts`, `thetaIncome.ts`,
  `serverState.ts`, `eventRisk.ts`, `intelligenceTrend.ts`,
  `intelligenceLearning.ts`, `learningPaths.ts`, `glossary.ts`,
  `strategyAcademy.ts`, `learningProgress.ts`, `routes/journal.ts`,
  `lib/tradeClose.ts`, `lib/portfolioAnalyst.ts` — zero-line diff; every
  one of their own exported functions is reused, not reimplemented.
- No broker write operations of any kind.
- No portfolio mutation of any kind.
- No new journal write of any kind (the linked-entry reuse in §3/§10 is
  strictly read-only).
- No LLM call of any kind.
- The platform remains **Paper Trading only** throughout.

---

## 14. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.19 — the higher-level
  architectural summary of this same sprint.
- `docs/Institutional-Intelligence-Engine.md` — the Institutional
  Intelligence Engine this sprint's Journal Timeline reuses as a
  structural pattern.
- `docs/AI-Portfolio-Analyst.md` — the sibling AI module (Phase 8,
  Sprint 3) this sprint's own crossLinkFor-style Learning
  Recommendations technique parallels (a small, disclosed, local
  re-implementation in each file, not a shared import).
- `docs/AI-Teacher-Learning-Centre.md` — the source of the lesson/
  glossary/strategy links reused by this sprint's own Learning
  Recommendations.
- `docs/Trading-Journal.md` — the pre-existing, free-text journal system
  this sprint reads from (read-only) but never modifies.
- `docs/Operations-Handbook.md` §6.21 — day-to-day operational usage.
- CLAUDE.md rule 1/2 — `execution.ts`/`autoExecution.ts`/
  `autoAdjustment.ts` are never modified without explicit, specific
  approval; this sprint touches none of them.
