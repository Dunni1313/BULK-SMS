# Strategy Comparison

Phase 31. The Institutional Strategy Workbench's Comparison view supports
deterministic comparison of strategy **metadata only.** It never compares
performance, and it never generates a ranking.

## Implementation

`src/lib/strategy-comparison.ts`'s `compareStrategies(strategies, viewedStrategyKeys)`
is a pure, deterministic function: given an array of already-fetched
`TradingStrategy` rows and the Learning Progress summary's own
`viewedStrategyKeys` list, it returns one `StrategyComparisonRow` per
strategy, **in the exact order the strategies were given.** It never
reorders, scores, or ranks its input.

## What is compared

| Column | Source | Notes |
|---|---|---|
| Categories | `strategy.category` | Direct field read |
| Supported Markets | `strategy.markets` | Direct field read |
| Timeframes | `strategy.timeframes` | Direct field read |
| Required Evidence | `strategy.requiredEvidence` (count + list) | Direct field read |
| Checklist Size | `strategy.checklist.length`, plus a separate required-item count | Direct field read |
| References | `strategy.references.length` | Direct field read |
| Version | `strategy.version` | Direct field read |
| Learning Coverage | Whether `strategy-framework:<id>` appears in the Learning Progress summary's `viewedStrategyKeys` | The one field that isn't a direct read of the strategy row itself — it cross-references the Learning Centre's own, already-computed progress data |

`validationValid` (the strategy's own `validation.valid` field, Phase 31's
Strategy Validation Summary) is also carried through unchanged for
completeness, but is not itself rendered as a comparison column in the
current UI — the Validation Summary panel in the Workspace covers it in
detail for the active strategy.

## What is deliberately never compared

- **Performance** — no win rate, expectancy, P&L, Sharpe ratio, or any
  other outcome metric. This platform has no concept of "how well" a
  user-authored strategy performed, since it never executes or backtests
  the strategy itself (backtesting a specific named methodology is
  explicitly out of scope for both Phase 30 and Phase 31).
- **Rankings** — no "best strategy," no sort-by-score, no color-coded
  winner. Rows are presented in registration-selection order only.
- Anything that would require judging whether one strategy's own rules
  are "better" than another's — the same structural-only discipline
  `validateStrategyMetadata()` (Phase 30) already established for a
  single strategy's own metadata.

`strategy-comparison.test.ts` includes an explicit regression test
(`"never computes or exposes a performance/ranking field"`) asserting the
comparison row's own key set never contains `winRate`, `rank`, `score`,
`performance`, `pnl`, or `expectancy` — a structural guarantee, not just a
design intention.

## Learning Coverage in more detail

Phase 30's "Mark as viewed" action on a strategy's Learning Viewer records
progress via `recordViewed()` (view-only), never `recordCompleted()`. This
means the pre-existing `completedStrategyKeys` list in
`lib/learningProgress.ts`'s `LearningProgressSummary` was always empty for
this item type. Phase 31 adds a new, additive `viewedStrategyKeys` field
(reusing an already-computed variable inside `getLearningProgress()` —
zero new database query) so Learning Coverage can honestly report
"viewed" vs. "not yet viewed" per strategy, both in the Comparison table
and in the Reporting Centre's own Strategy Framework Summary report
(see `docs/Strategy-Learning.md`).
