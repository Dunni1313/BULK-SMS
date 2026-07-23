# Institutional Trading Engine — Roadmap

**Phase 24 status: Foundation complete.** This document tracks what's built vs. explicitly deferred, so future phases pick up from an honest baseline rather than re-discovering the same gaps.

---

## Built (Phase 24)

- Shared domain model (`lib/tradingDomainModel.ts`): re-exports of Market Data/Market Structure/Liquidity types, plus new Order Block, Fair Value Gap, Session Data, Trade Plan, and Risk Parameters types.
- 8 service-boundary facade files (`lib/trading/*.ts`): Market Data, Analysis, Strategies, Trade Plans, Journal, Alerts, Education, Reporting.
- `computeRiskParameters()` — pure arithmetic (position size, risk:reward) from human-supplied entry/stop/target/account-risk numbers.
- `createTradePlan()` / `transitionTradePlanStatus()` — in-memory Trade Plan construction and status-transition validation.
- `TradeWorkspace.tsx` — a placeholder architecture-overview page, illustrating the new domain types with static examples, linking out to the real Trading Research/Journal/Backtest pages.

## Already built (prior initiative, reused unchanged this phase)

- Market Data Foundation, Market Structure Engine, Multi-Timeframe Analysis, Liquidity Engine, Market Regime, Probability Engine, Risk Management, Trading Journal (full CRUD), Backtesting, Trading AI Coach, the at-a-glance Trading Dashboard (`InstitutionalDashboard.tsx`).

## Explicitly deferred (not started)

| Item | Why it's deferred | What unblocks it |
|---|---|---|
| Real Order Block detection | Signal generation, explicitly out of scope for a foundation phase | A future phase, over an already-resolved candle series via `analysisService.ts` |
| Real Fair Value Gap detection | Same | Same |
| Strategy Framework (real strategies) | `STRATEGY_REGISTRY` is intentionally empty — no strategy is implemented | A future phase defines real `StrategyDefinition` entries plus an evaluator |
| Trading Watchlist | Distinct from Engine 1's Value Watchlist; genuinely absent for Engine 2 | A future phase, likely a new small table + route mirroring Engine 1's Value Watchlist precedent |
| Trade Plan persistence | In-memory only this phase | Once the Trade Workspace's own planning panel is built and needs cross-request storage — a real database migration decision at that point, not before |
| Trading learning path | The Learning Centre has zero Engine 2 content today | A future phase authors real lesson content reusing the existing `LearningPath`/`LearningItemType` model |
| Trading reporting framework | Engine 1's Institutional Reporting Engine (Phase 22) has no Engine 2 counterpart | A future phase composes Engine 2's already-shipped analyzers the same way Engine 1's report builders compose `valueReport.ts` |
| Live market-data provider | Explicitly deferred since Phase 3 (Sprint 32) — `getMarketDataProvider()` always returns the SIMULATED instance today | A future budget/vendor decision, unrelated to this phase |

## Sequencing recommendation for the next phase

Given the foundation is now in place, the most natural next step is picking **one** of the deferred items above rather than several at once — consistent with how every prior phase in this repository has scoped its own work. Real Order Block/Fair Value Gap detection is the most foundational (everything else in the "Coming Next" list can build on it or proceed independently), but the actual choice is the project owner's to make.
