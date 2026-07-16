---
name: Backend determinism (Ravish api-server)
description: The api-server must contain zero Math.random(); everything is seeded. Why and how.
---

# No Math.random() anywhere in api-server

All "simulated" market data, snapshots, and backtests use `makeRng(seedString)`
(mulberry32 over a string hash) from `optionsMath.ts`, seeded by a stable key:
snapshots by symbol(+date), backtests by `backtest-${symbol}-${strategy}-${period}`.

**Why:** The product goal is a real, deterministic engine. Scanner, options chain,
scoring, and portfolio greeks must all agree on the same underlying snapshot, and
repeated backtests must return identical numbers. A stray `Math.random()` silently
breaks that contract (the scanner and option chain would disagree on price/IV).

**How to apply:** Before finishing any api-server change, grep `Math.random` across
`artifacts/api-server/src` — it must return nothing. New randomized-looking values
go through `makeRng` with a documented seed key.
