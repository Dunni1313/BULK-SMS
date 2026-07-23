# Institutional Trading Engine — Architecture (Phase 24 Foundation)

**Phase 24 — Institutional Trading Engine Foundation.** Establishes the core Engine 2 architecture only: a shared domain model, clean service boundaries, and an empty placeholder UI. No signal generation, no strategy logic.

**Critical scoping note, confirmed before any code was written:** Engine 2 (the Institutional Trading Engine) already exists, fully built and shipped, from an earlier initiative in this same repository (merged via PR #1). This phase does **not** start Engine 2 from zero — it extends the existing, tested foundation with the pieces that were genuinely missing, and changes nothing about what already works.

---

## 1. Audit — what already exists (reused unmodified)

| Requested area | Already exists as | Status |
|---|---|---|
| Authentication | Better-Auth, `getScopedUserId(req)` | Reused, unmodified |
| User preferences | Per-user `settings` table | Reused, unmodified |
| Navigation | `src/lib/nav-items.ts`, `AppLayout.tsx` | Reused — one new entry added |
| Command Palette | `components/command/CommandPalette.tsx`, indexed from `ALL_NAV_ITEMS` | Reused automatically — no separate registration needed |
| Notification system | `platform_notifications`, `NotificationBell.tsx` | Reused, unmodified |
| AI Coach framework | `lib/ai-core` → `coachLLM.ts` → `narrateTradeFreeform()` | Already wired to Engine 2 (`routes/tradingCoach.ts`) |
| Shared UI components | shadcn `components/ui/*`, `Card`/`Badge`/`Skeleton` | Reused, unmodified |
| Shared hooks | `src/hooks/*` | Reused where applicable |
| API conventions | Express + Orval-generated typed client, ownership-scoped queries | Followed for any future Engine 2 route |
| DB conventions | Drizzle + manual migrations, nullable→backfill→enforce | Followed if/when a future Engine 2 migration is needed |
| **Market Data Foundation** | `lib/tradingMarketData.ts` (Sprint 32) — `Candle`, `Timeframe`, `MarketDataProvider`, `TRADING_MARKET_UNIVERSE` | Reused, unmodified |
| **Market Structure Engine** | `lib/tradingMarketStructure.ts` (Sprint 33) — swing points, support/resistance zones, trend | Reused, unmodified |
| **Multi-Timeframe Analysis** | `lib/tradingMultiTimeframe.ts` (Sprint 34) | Reused, unmodified |
| **Liquidity Engine** | `lib/tradingLiquidity.ts` (Sprint 35) | Reused, unmodified |
| **Market Regime** | `lib/tradingRegime.ts` (Sprint 36) | Reused, unmodified |
| **Probability Engine** | `lib/tradingProbability.ts` (Sprint 37) | Reused, unmodified |
| **Risk Management** | `lib/tradingRisk.ts` (Sprint 38/44), `trading_positions` table | Reused, unmodified |
| **Trading Journal** | `routes/tradingJournal.ts` (Sprint 39/46) full CRUD, `trading_journal_entries` table, `TradingJournal.tsx` | Reused, unmodified |
| **Backtesting** | `lib/tradingBacktest.ts` (Sprint 49), `TradingBacktest.tsx` | Reused, unmodified |
| **Trading AI Coach UI** | Chat panel embedded in `TradingResearch.tsx` (Sprint 47/48) | Reused, unmodified |
| **Trading Dashboard** (at-a-glance) | `InstitutionalDashboard.tsx` (Sprint 50) — combines Structure/Multi-Timeframe/Regime/Probability/Liquidity + Portfolio Risk for one symbol | Reused, unmodified — no duplicate dashboard built this phase |
| **Executive Dashboard design language** | `ExecutiveDashboard.tsx` (Phase 23) — header/card/badge conventions | Reused for the new Trade Workspace page |

## 2. Audit — what was genuinely missing (built this phase)

Confirmed absent by direct repository inspection before writing any code:

| Concept | Why it's genuinely new |
|---|---|
| Order Blocks | No ICT/SMC-style order-block concept exists anywhere in the codebase |
| Fair Value Gaps | Same — no 3-candle imbalance concept exists |
| Session Data | No trading-session (Sydney/Tokyo/London/New York) concept exists |
| Trade Plan / Risk Parameters | No pre-trade planning concept exists, distinct from `TradingPositionInput` (an already-open position) |
| Trade Workspace | `TradingResearch.tsx` is a tabbed single page, not a dedicated planning/architecture-overview surface |
| Strategy Framework | No formal `Strategy` concept exists — only 3 hardcoded rule-sets inside `lib/tradingBacktest.ts` |
| Trading Watchlist | No Engine-2-specific technical watchlist exists (only Engine 1's fundamentals-based Value Watchlist) |
| Trading learning path | The Learning Centre has no Engine 2 content |
| Trading reporting framework | Engine 1's Institutional Reporting Engine (Phase 22) has no Engine 2 equivalent |

## 3. Service boundaries (`artifacts/api-server/src/lib/trading/`)

A clean facade layer so every future Engine 2 module composes these 8 concerns without reaching into individual lib files directly, and so each can evolve independently:

| File | Boundary | This phase's content |
|---|---|---|
| `marketDataService.ts` | Market Data | Re-export of `tradingMarketData.ts` — zero new logic |
| `analysisService.ts` | Analysis | Re-export of Market Structure/Multi-Timeframe/Liquidity/Regime/Probability — zero new logic |
| `strategyService.ts` | Strategies | New `StrategyDefinition` type + an intentionally empty `STRATEGY_REGISTRY` |
| `tradePlanService.ts` | Trade Plans | New `createTradePlan()`/`transitionTradePlanStatus()` — in-memory only, pure arithmetic, no persistence yet |
| `journalService.ts` | Journal | Re-export of the `trading_journal_entries` table/row type from `@workspace/db` |
| `alertService.ts` | Alerts | Re-export of `lib/notifications.ts` — already fully wired to `trading_positions` |
| `educationService.ts` | Education | A status stub naming the gap (no Trading learning path exists) |
| `reportingService.ts` | Reporting | A status stub naming the gap (no Trading reporting framework exists) |

Every file that re-exports existing logic contains zero new computation. The only genuinely new logic in the entire phase is `computeRiskParameters()` (pure arithmetic over human-supplied numbers) and `createTradePlan()`/`transitionTradePlanStatus()` (in-memory object construction and status-transition validation) — neither predicts a price, a direction, or a trade outcome.

## 4. What was deliberately not built

- No Order Block / Fair Value Gap detection algorithm — types only.
- No Strategy implementation — the registry starts empty.
- No Trade Plan database table — in-memory only until a real UI consumer needs cross-request persistence.
- No second "Trading Dashboard" — `InstitutionalDashboard.tsx` already serves that role; duplicating it would violate the explicit anti-duplication instruction for this phase.
- No changes of any kind to `TradingResearch.tsx`, `TradingJournal.tsx`, `TradingBacktest.tsx`, or any existing Engine 2 lib file — confirmed via `git diff --stat` showing zero lines changed in any of them.
- No changes of any kind to any Institutional Investing Engine (Engine 1) file.

## 5. See also

- `docs/Trading-Domain-Model.md` — the full type reference
- `docs/Trading-Roadmap.md` — what's built now vs. explicitly deferred
