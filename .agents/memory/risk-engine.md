---
name: Trade risk engine (Ravish)
description: How trade risk is sized and enforced in artifacts/api-server (risk.ts + trades.ts POST) — non-obvious sizing and stop-loss rules.
---

# Max loss is computed from submitted legs, not the canonical quote

`POST /trades` sizes `maxLoss` via `maxLossFromLegs(legs, credit)`, NOT from
`canonicalQuote()` (which is 1-lot). Single-expiry structures use payoff geometry
across strike breakpoints (min P&L at a strike / 0 / far OTM); multi-expiry
structures (calendars/diagonals) fall back to net debit paid.

**Why:** Canonical quotes are always 1-lot, so a 50-lot spread was validated as if
1-lot and slipped past the 1% per-trade cap. Leg-based sizing makes risk scale with
quantity. EV/theta/maxProfit are scaled by `lots`; POP and Ravish score are still
read from the canonical snapshot as a quality reference.

**How to apply:** Any new strategy or order path must derive maxLoss from the actual
legs. Don't reintroduce canonical-quote risk numbers into trade persistence.

# Two-stage risk gate at entry

`POST /trades` rejects (422) on BOTH: (1) per-trade `validateTrade` (defined-risk +
1% cap), and (2) a cumulative portfolio check — sum of open trades' maxLoss + the
new trade must stay within `maxPortfolioRisk` (10%).

**Why:** `validateTrade` only checks one trade; without the second gate, many
individually-valid trades could blow the portfolio cap.

# Strategy-aware stop-loss

`computeStopLoss(credit, maxLoss, mult)`: credit trades stop at `-credit*mult`;
net-debit trades (calendars, credit<0) have no credit to multiply so they stop at
`-maxLoss*0.5`. Always clamped to `>= -maxLoss` so the stop is reachable.

**Why:** The old `-abs(credit)*mult` gave debit calendars a stop beyond max loss
(e.g. -2990 on a 1495 max-loss position) — i.e. it never triggered. Used in both
the close and monitor handlers.

# Execution score floor must live inside the scanner's score scale

The pre-trade execution gate (`MIN_RAVISH_SCORE` in execution.ts) must be calibrated
against the *actual* Ravish-score distribution the scanner produces, not an aspirational
number. The mock scanner tops out around the elite tier boundary (~68); a floor above
that makes EVERY trade un-executable and the whole execution feature dead in the demo.

**Why:** A 75 floor was set from the "only elite trades" framing, but the score formula
(optionsMath.ts) caps near 68 (elite >=68, high_conviction >=62, good >=55). Nothing ever
reached 75, so preview/submit always rejected on score alone. Set it to the high_conviction
boundary (62) so quality setups pass while good/ignore are blocked. The "not Elite" advisory
warning likewise uses the elite boundary (68), not an arbitrary higher number.

**How to apply:** If you change the score formula or tier thresholds in optionsMath.ts,
re-check `MIN_RAVISH_SCORE` and the Elite advisory in execution.ts in lockstep — they are
coupled to that scale.
