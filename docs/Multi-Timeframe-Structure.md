# Multi-Timeframe Structure (Phase 26 — Market Structure Workbench)

The Multi-Timeframe Structure Matrix is the Workbench's primary cross-timeframe comparison surface. It composes Sprint 34's already-shipped `buildMultiTimeframeAnalysis()` unmodified — this document describes how the Matrix presents that engine's output, and the one genuinely new plumbing this phase added to let a user actually choose which timeframes to compare.

## 1. Only real timeframes — never a fabricated one

The Market Data Provider (`lib/tradingMarketData.ts`, Sprint 32) supports exactly 5 timeframes:

```
1m   5m   15m   1h   1D
```

**No Monthly, Weekly, or 4H timeframe exists anywhere in this codebase.** The Matrix's timeframe checkboxes only ever offer these 5 real values — confirmed by direct inspection of `Timeframe` (`lib/tradingMarketData.ts`'s own exported union type) before writing any UI. Requesting a value outside this set is rejected with a `400`, never silently substituted or ignored.

The default selection (`15m`, `1h`, `1D`) matches Sprint 34's own `DEFAULT_MULTI_TIMEFRAMES` constant — a short/medium/long-horizon spread. A user may check/uncheck any of the 5 real timeframes; the Matrix always requests exactly the checked subset, in the platform's own canonical `1m → 5m → 15m → 1h → 1D` order.

## 2. The one genuinely new piece of plumbing: `?timeframes=`

Before this phase, `GET /trading/multi-timeframe/:symbol` always ran the fixed default 3-timeframe set — `buildMultiTimeframeAnalysis(symbol, provider, timeframes = DEFAULT_MULTI_TIMEFRAMES)` already accepted a caller-supplied `timeframes` array, but no route ever exposed a way to pass one in. This phase added a backward-compatible, comma-separated `?timeframes=` query override:

```
GET /trading/multi-timeframe/AAPL?timeframes=5m,1h
GET /trading/multi-timeframe/AAPL?timeframes=1m,5m,15m,1h,1D
```

Omitting the parameter is byte-identical to every pre-Phase-26 caller (still the default 3-timeframe set). An invalid timeframe in the list 400s the whole request rather than silently dropping it. Per the established Orval path+query codegen-collision precedent (documenting a path parameter and a query parameter together on the same OpenAPI operation triggers a known duplicate-export bug, first disclosed at Sprint 40), this override is deliberately kept out of the strict OpenAPI-documented surface — it is fully functional, just server-side-only, exactly like `GET /trading/structure/:symbol`'s own `?interval=`/`?lookback=` overrides.

## 3. What each Matrix row shows

For every timeframe the user selects, the Matrix's row surfaces exactly what the brief requests, and nothing invented:

| Column | Source | Notes |
|---|---|---|
| Timeframe | The requested interval itself | `1m`/`5m`/`15m`/`1h`/`1D` |
| Trend | That timeframe's own `MarketStructureAnalysis.trend` | uptrend / downtrend / range — Sprint 33's engine, unmodified |
| Latest Swing | The last entry in that timeframe's own `swingPoints` array | Honestly "none" when the sample has no detected swing yet |
| Key Support | The highest-strength `support`-kind zone in that timeframe's own `zones` array | Honestly "none" when no repeated support zone was detected |
| Key Resistance | The highest-strength `resistance`-kind zone | Same honesty rule |
| Freshness | That timeframe's own `candleCount` + `confidenceLevel` | A direct, unmodified read of the engine's own sample-size/confidence signal — not a new freshness score |

## 4. Structural alignment vs. structural conflict — never a fabricated winner

The Matrix surfaces the Multi-Timeframe Engine's own already-computed cross-timeframe signals, unmodified:

- **`trendAgreement`** — `unanimous` / `majority` / `split` / `insufficient-data`, Sprint 34's own honest bucket-counting classification (`classifyAgreementSignal<T>()`, reused from the Investment Committee's own Phase 2 precedent).
- **`dominantTrend`** — the strictly-highest-count trend across the selected timeframes, or `null` on any genuine tie (including a full split). The Workbench never guesses a winner when `dominantTrend` is `null` — the Matrix explicitly displays "Structural conflict — no dominant trend" in that case, rather than picking one arbitrarily or hiding the disagreement.
- **`confluenceScore`** — the % of considered timeframes sharing the dominant trend, honestly `null` (not a fabricated number) whenever there's no single dominant trend or fewer than 2 timeframes were supplied.

The Workbench's own **Trend Alignment Summary** panel (left column) maps this same `trendAgreement`/`dominantTrend` pair through `deriveTrendAlignmentState()` (`src/lib/structure-display-state.ts`) onto one of the 5 approved display states — `split` becomes **Transition**, `insufficient-data` becomes **Unclear / Insufficient Data**, and a genuine dominant trend passes through to Bullish/Bearish/Range exactly as the single-timeframe mapping does. This is a pure relabeling, not a second, competing scoring system.

## 5. Data freshness

Every row's own `candleCount`/`confidenceLevel` pair is the platform's existing, unmodified freshness signal — a timeframe with too few candles honestly reports a lower confidence level rather than a fabricated high-confidence read on a thin sample. No new "staleness" clock or timestamp comparison was introduced this phase.
