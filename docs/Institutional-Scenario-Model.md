# Institutional Scenario Model — Design & Audit Record (Phase 39)

The exact design decisions behind `lib/scenarioEngine.ts`, kept as a
permanent record for future phases, mirroring the role
`docs/Institutional-Risk-Model.md` plays for Phase 37 and
`docs/Institutional-Performance-Model.md` plays for Phase 38.

## Guiding constraint

The Phase 39 kickoff was explicit: **this phase is analytical only.**
No AI predictions, no market forecasting, no price targets, no trade
recommendations, no portfolio optimisation, no auto hedging, no auto
execution, no Monte Carlo simulation, no random scenario generation.
Every scenario is a deterministic, user-named "if this hypothetical
market move happened right now, what would happen to my portfolio?"
repricing — never a probability estimate of it actually occurring. Every
design decision below was made against that constraint first.

## Per-engine scenario sources (confirmed via direct source reads before implementation)

| Engine | Source | Reused for |
|---|---|---|
| Options | `lib/portfolioStressTest.ts`'s `buildPortfolioStressTest()` (an already-shipped, already-tested What-If Stress Test engine) | Portfolio Impact, Asset/Strategy Impact, Greeks Impact, Buying Power Impact, Capital Impact for every price/volatility scenario — reused **verbatim, unmodified** |
| Options | `lib/optionsMath.ts`'s exported `bs()` (unmodified — never touched by this phase) | Black-Scholes repricing at a shocked risk-free rate `r`, for interest-rate scenarios |
| Investing | `lib/portfolioConstruction.ts`'s `buildPortfolioAllocation()` (Phase 2 Sprint 28) | Current price, sector, shares for every Investing holding, reused unmodified |
| Trading | `lib/tradingMarketData.ts`'s `getMarketDataProvider().getQuote()` | Current price per open Trading position |
| Trading | `lib/tradingJournalEntriesTable`'s loose, unenforced `tradingPositionId` reference (the same pattern Phase 38's Performance Engine already established) | Best-effort Strategy Impact for Trading positions |

None of these five components' own logic was modified.
`lib/scenarioEngine.ts` imports and calls each unchanged.

## What is genuinely new vs. reused, at a glance

`lib/scenarioEngine.ts` introduces exactly **two** new formulas — every
other figure is direct reuse or a thin aggregation (sum/group/concat) of
already-computed results:

1. **Linear equity repricing (Investing/Trading).** Raw equity holdings
   have no convexity or Greeks, so a price-shock scenario is a single,
   deterministic formula:

   ```
   shockedPrice = currentPrice * (1 + priceShockPct / 100)
   ```

   Applied per-holding for Investing (`shockedMarketValue = shares *
   shockedPrice`) and per-position for Trading (direction-aware:
   `impactDollars = (shockedPrice - currentPrice) * quantity * (short ?
   -1 : 1)`). This is the only pricing model these two engines get in
   this phase — no attempt was made to approximate Greeks for a raw
   equity position, since none exist in this codebase for that asset
   class.

2. **Options interest-rate scenarios.** `optionsMath.ts`'s own exported
   `bs()` function already accepts an optional risk-free-rate parameter
   `r` that **no existing caller in this codebase ever supplied** —
   every prior caller let it default to `bs()`'s own internal 4.5%
   constant (`RISK_FREE`). This phase's `computeRateShockedTrade()`
   supplies a shocked rate to that already-existing, unmodified
   parameter, mirroring `lib/portfolioStressTest.ts`'s own
   `computeShockedGreeks()` shape exactly, but varying rate instead of
   price/IV/time. This is a genuine reuse of existing deterministic
   mathematics — not a new pricing model — and `optionsMath.ts` itself
   was never touched. The base rate is read from the real, already-
   existing `settings.investingRiskFreeRate` field (Sprint 11's own
   default, 0.045), not a duplicated hardcoded literal.

## Honest inapplicability — Volatility and Interest Rate scenarios for Investing/Trading

Volatility and interest-rate scenarios are options-native concepts.
A raw equity holding or Trading position has no IV/Greeks formalism
anywhere in this codebase. Rather than approximate one (e.g. deriving a
synthetic "equity volatility" from a price-only proxy, which would be a
fabrication), both scenario categories honestly report
`available: false` for Investing and Trading, with an explicit,
disclosed reason:

> "Volatility scenarios apply to options positions via implied
> volatility — a raw equity holding has no IV/Greeks formalism in this
> codebase, so this is honestly unavailable rather than approximated."

> "Interest-rate scenarios apply to options positions via the risk-free
> rate in Black-Scholes pricing — a raw equity holding has no
> deterministic rate-sensitivity formula in this codebase, so this is
> honestly unavailable rather than approximated."

This mirrors the exact "never fabricate, honestly report unavailable"
discipline every prior phase in this platform has followed (e.g.
Investment Quality's permanently-unavailable Share Dilution/Insider
Ownership metrics, Phase 2 Sprint 15; the Correlation Overview's
symbol-overlap substitute for a real correlation coefficient, Phase 37).

## The Combined (cross-engine) view

`buildCombinedScenarioView()` is the one function doing non-trivial
cross-engine work, and every field is documented here exactly:

- **`byEngine`** — every scenario's own total impact, tagged
  `investing`/`trading`/`options`. **Never summed across engines** — a
  linear equity reprice and a Black-Scholes options reprice are
  genuinely different kinds of figures, and blending them into one
  number would misrepresent both, the same discipline
  `docs/Institutional-Performance-Model.md`'s own "Return by Engine"
  section already established for Phase 38.
- **`sectorImpact`** — Investing only (Trading/Options positions carry
  no sector classification in this codebase).
- **`strategyImpact`** — Trading (best-effort Journal `setupType` join)
  and Options (`exposureByStrategy`, reused from the Stress Test
  engine's own already-computed field), tagged by engine.
- **`assetImpact`** — a concatenation across all 3 engines, tagged by
  engine and scenario.

## Market Move Simulator — the "Custom percentage move" scenario

`buildCustomScenario(input, index)` is a pure function producing one more
`ScenarioDefinition` (`category: "price"`) from a caller-supplied
percentage, clamped to `[-99, 1000]` (a position can lose at most 100%
of its value but can gain without an artificial ceiling other than a
sane guard rail). A missing/blank label falls back to a deterministic
`Custom (+N%)`/`Custom (-N%)` string — never a fabricated descriptive
name. Custom scenarios are always evaluated **alongside**, never instead
of, the 8 named defaults.

## What was deliberately NOT built

- **No AI-based scenario generation of any kind.** Every scenario —
  default or custom — is a caller-specified or fixed-list percentage
  move; nothing here samples, predicts, or forecasts a move.
- **No Monte Carlo simulation, no random scenario generation.** Every
  scenario is a single, deterministic point (one price shock / one IV
  shock / one rate shock), never a distribution.
- **No probability estimate anywhere** — the response shape has no
  field for "likelihood," "probability," or "confidence that this
  happens." A dedicated test asserts this structurally by scanning the
  live response for such language.
- **No trade, hedge, or rebalancing recommendation.** Every response
  reports repriced impact for the user's own review; nothing suggests
  an action.
- **No new database table.** This phase is entirely a read layer over
  existing Investing/Trading/Options tables, computed fresh on every
  request.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts` (only its already-exported, unmodified
`bs()` function is called with a new argument value from new code
elsewhere — the file itself has a zero-line diff), `risk.ts`,
`autoExecution.ts`, `autoAdjustment.ts`, and every broker-integration
file were not modified by any file in this phase. `lib/portfolioStressTest.ts`
was also not modified — reused verbatim.
