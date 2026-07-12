---
name: Live options-data provider pipeline
description: How the scanner sources/filters real option chains via a provider abstraction with mock fallback, and the data-quality contract that prevents malformed live data from leaking through.
---

# Live options-data provider pipeline

The scanner does not call a single hardcoded data source. It goes through a provider
abstraction (`OptionsProvider`) with implementations for mock (deterministic), Alpaca
(live), and Polygon (placeholder, always unavailable). `selectProvider(settings)` picks
one from `scannerMode` + `marketDataProvider` and **falls back to mock explicitly** when
a live provider's `isAvailable()` is false, recording a human-readable `reason` consumed
by the market-data health panel. Both mock and live modes flow through the *same*
`runScan` pipeline so the health counters (contracts scanned / rejected / positive-EV)
are meaningful regardless of source.

## The data-quality gate is the contract — providers must not pre-fill it

**Rule:** when a provider lacks a field (greeks, IV), it MUST surface it as a non-finite
value (`NaN`) or `null`/`undefined`, NEVER coerce to `0`.

**Why:** `marketData.checkData()` rejects contracts with missing/non-finite greeks or IV.
Coercing absent greeks to `0` (as the first Alpaca impl did) makes them look valid, so
malformed live contracts silently pass the gate and get scored. `0` is a legitimate-looking
number; `NaN` is what "missing" must look like to the gate. The `OptionQuote` greek/iv
fields are typed `number`, so use `?? NaN` (not `?? null`) to keep the type while still
failing `Number.isFinite`.

**How to apply:** any new provider's `getChain` mapping — keep `?? NaN` for delta/theta/
vega/gamma/iv. Liquidity fields (openInterest/volume) can default to `0` because the
liquidity gate rejects low values anyway. Add a gate test for any new provider proving a
missing-greek contract is rejected.

## Filters (marketData.ts), in order
data validity → freshness (≤15min) → liquidity (OI>100, vol>10, spread<15% of mid, no
zero-bid). `checkContract` short-circuits on first failure.

## Known imperfection (non-blocking)
`BuildResult.liquidityRejected` / health `rejectedByLiquidity` lumps data + freshness +
liquidity rejections into one bucket. If finer health diagnostics are ever needed, split
the counter by `RejectKind` end-to-end (BuildResult → ScanHealth → openapi → Dashboard).
