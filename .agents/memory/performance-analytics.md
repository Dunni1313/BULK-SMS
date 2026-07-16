---
name: Performance Analytics engine
description: Why the analytics dashboard runs off a synthetic seeded population instead of the trades table, and the metric conventions that keep it realistic.
---

# Performance Analytics engine

`lib/performanceAnalytics.ts` powers the `/performance` dashboard from a **deterministic seeded synthetic closed-trade population**, not the live `trades` table.

**Why synthetic:** the real `trades` table only ever holds a handful of closed trades — far too sparse for 17 metrics + 5-dimension breakdowns. Several breakdown dimensions (`strangle` strategy, short-delta used, IV-rank bucket, commission, slippage) don't even exist in the DB schema. Generating a realistic population in-memory is consistent with the app's stated "all market data is simulated with realistic math" philosophy, and avoids a schema migration or polluting the live table. The engine **never writes** to `trades`.

**Metric conventions (must stay consistent with the UI, which formats rate fields as %):**
- Rate fields — `winRate`, `maxDrawdown`, `returnOnCapital`, `actualPop`, `expectedPop` — are 0–1 fractions.
- `profitFactor = grossWin / grossLoss`; `expectancy = winRate·avgWin − (1−winRate)·avgLoss`.
- Equity-curve drawdown is a ≤0 fraction (underwater plot).

**CRITICAL P&L realism knob:** losses are modeled as a *multiple of the credit collected* (managed-stop behavior), capped at max loss (capital) — NOT as a fraction of capital. Modeling losses as a fraction of capital tanks the profit factor to something unrealistic; the credit-multiple model is what produces a believable PF (~1.9) at winRate ~0.77.

**Determinism caveat:** the population is seeded and stable per process, BUT trade close dates are anchored to `Date.now()` so the period windows (3M/6M/1Y/All) roll forward over time. So it is *deterministic per runtime*, NOT *reproducible across days/restarts*. Don't describe it as "fully reproducible."

**User-trust:** the page carries a "SIMULATED" badge + "connect a broker for live history" subtitle so the modeled analytics are never mistaken for real broker P&L. Any future page that surfaces synthetic trade history should do the same.
