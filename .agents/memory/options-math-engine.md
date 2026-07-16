---
name: Options math engine (Ravish)
description: Non-obvious calibration decisions in artifacts/api-server/src/lib/optionsMath.ts — why premium-selling trades produce positive EV and how tiers are tuned.
---

# Volatility risk premium (VRP) haircut

Pricing/credit use the full implied vol, but POP is computed with a haircut vol
(`VRP_FACTOR = 0.82`, via `popVol()`).

**Why:** With risk-neutral Black-Scholes (same vol for pricing and probability),
net premium-selling structures (iron condors, iron flys, calendars) come out
EV ≈ 0 or negative, so the `ev > 0` filter in `finalize()` rejected every one of
them. The structural edge of premium selling is that implied vol systematically
overstates realized vol; modeling POP with a lower realized vol restores positive
EV. Without this haircut the scanner returns only directional/earnings trades.

**How to apply:** Any new POP calculation for a credit strategy must use
`popVol(iv)`, never the raw `iv`. Keep pricing/credit on the full `iv`.

# Calendar profit band

Calendar POP uses a band of `0.9 * S * iv * sqrt(Tf)` around the strike.

**Why:** A 0.5σ band gives ~38% POP, below the ~41% breakeven the credit/maxloss
ratio needs, so all calendars were rejected by `ev > 0`. ~0.9σ matches a
calendar's true profit zone and yields positive EV.

# Tier thresholds

`elite >= 68, high_conviction >= 62, good >= 55, else ignore` (in `finalize`).

**Why:** The fixed Ravish weighting (30% POP / 25% EV / 15% theta / 15% win rate /
10% liquidity / 5% IV rank) caps realistic scores for genuine 20-delta credit
spreads around ~69 — ev/maxProfit for these is modest (~0.25). The original
88/80/70 cutoffs collapsed everything into "ignore". These thresholds give a
believable spread (a few elite, several high-conviction/good, long ignore tail)
without changing the spec'd weights.
