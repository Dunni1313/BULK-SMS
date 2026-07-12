---
name: Trade Adjustment Engine
description: Trade adjustment engine — deterministic signals, ONE-action precedence ladder, auto-act safety, and the short-strike threat-detection gotcha.
---

# Trade Adjustment Engine (advisory + auto de-risk)

Mirrors the Full-Auto OPENING engine but for managing OPEN positions. Deterministic
core in `lib/adjustment.ts` (`selectAdjustment` + `evaluateTradeAdjustment`), auto loop
in `lib/autoAdjustment.ts`, shared close via `lib/tradeClose.ts`.

## Short-strike threat detection MUST be directional, not absolute distance
**Rule:** Threat/proximity to a short strike is a SIGNED gap (positive=OTM/safe,
negative=ITM/breached), never `Math.abs(price - strike)`.
**Why:** Absolute distance makes a deeply breached short read as "far away" → fails the
`<= proximityPct` trigger → engine recommends hold/roll_untested instead of de-risking the
breached side, and assignment risk falsely reads "low". A breach is the MOST threatened
state, not the least.
**How to apply:** `callGap=(shortCall-price)/price`, `putGap=(price-shortPut)/price`; pick
the smaller gap as the threatened side; `shortBreached = gap < 0`; proximity triggers on
`shortBreached || distancePct <= band`. `buildAssignmentRisk` takes `breached` and escalates
regardless of distance. Covered by breached-call/breached-put tests in
`phase8.adjustment.test.ts`.

## Auto-act subset only
`AUTO_ACTIONABLE = {close_for_profit, close_for_loss, reduce_risk}` — never roll/convert
(structural, human-only). Same safety as autoExecution: single-flight `adjustCycleInFlight`
+ live arm-gate re-read before EVERY close.

## Arm gate needs the MASTER kill switch, not just the feature switch
**Rule:** Auto-adjust requires THREE conditions — `full_auto` mode AND
`autoExecuteEnabled` (the AutoPilot MASTER kill switch) AND `autoAdjustEnabled` (the
feature-specific switch). Check the master before the subordinate.
**Why:** The master kill switch is the operator's single "disarm all automation" control.
Gating auto-adjust only on its own feature switch lets it keep closing positions while the
operator believes automation is globally off — a serious control-plane safety violation.
Any NEW automation subsystem must also hang beneath `autoExecuteEnabled`.
**How to apply:** `autoAdjustAllowed(mode, autoExecuteEnabled, autoAdjustEnabled)` gates both
the cycle entry and the per-action live re-check.

## entryIv baseline
`trades.entryIv` is snapshotted at creation (both POST /trades and executeValidatedTicket)
so IV-expansion is measured vs entry; null tolerated → falls back to IV-rank proxy
(threshold 70 vs the adj IV-expansion % trigger).
