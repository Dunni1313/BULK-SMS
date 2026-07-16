---
name: Event Risk Filter
description: Deterministic event calendar + assessment threaded into scoring/execution/AutoPilot; the level→blockAuto calibration rule.
---

# Event Risk Filter

A deterministic, simulated economic/market event calendar (`lib/eventRisk.ts`, modeled
like `earnings.ts`) consulted by scanner scoring, the execution gate, and AutoPilot.
`assessEventRisk()` is pure; `getEventRiskForSymbol()` pulls earnings from the snapshot.

## The level → blockAuto calibration (the important rule)

`blockAuto = (level === "high")`. **"high" must require a genuinely exceptional,
high-impact event in the window — earnings (that we are NOT deliberately trading) or
an FOMC decision (impact: "high") — OR penalty hitting MAX_PENALTY. It must NOT be
reachable by routine monthly medium macro alone.**

**Why:** CPI + jobs + PCE recur every month, so a typical 30–45 DTE premium-selling
window almost always contains 2–3 of them (penalty ~14). An earlier version set
`level=high` at `penalty >= 12`, which made nearly every candidate "high" and caused
AutoPilot to skip/block almost always — defeating rule 4 ("block AutoPilot when event
risk is *too high*"). Fix: track `hasHighImpactEvent` (earnings non-play, or
`ev.impact === "high"` for FOMC) and gate "high" on `blockShortPremium ||
hasHighImpactEvent || penalty >= MAX_PENALTY`. Routine macro now reads "medium" — it
still lowers the score (rule 3) and warns, but does not auto-block.

**How to apply:** if you retune `PENALTY`, `MAX_PENALTY`, FOMC_MONTHS, or the level
thresholds, keep the invariant that pure medium macro stays ≤ "medium". Covered by the
FOMC→high and "routine macro stays medium (no auto-block)" tests in
`phase9.eventRisk.test.ts`.

## Demo-date caveat

The current simulated "now" sits near a real FOMC (3rd-Wed of FOMC months: Jan, Mar,
May, Jun, Jul, Sep, Nov, Dec) plus seeded earnings, so live scans near those dates
legitimately read mostly "high"/penalty-capped. That is correct behavior, not a bug —
verify the calibration with the deterministic unit tests, not the live scan.

## AutoPilot settings-read pattern (intentional)

In `runAutoExecutionCycle`, the event toggles (`eventRiskEnabled`,
`eventRiskAutoBlockHigh`) and other *filter* thresholds (e.g. `autoMinRavishScore`) are
read once from the cycle-start settings snapshot. Only the *spend* guardrails (caps,
master kill switch) are re-read per-execution via `freshGate()`. This split is
deliberate — don't "fix" the event toggle to re-read per candidate; it would diverge
from how every other filter threshold behaves.

## Enforcement split

- Hard server-side block: short premium (iron_condor/iron_fly) with earnings in window
  → `blockShortPremium` → violation in `validatePreTrade` (gated by
  `eventRiskBlockEarningsShortPremium`). The `earnings` strategy is exempt (trades the
  event); `calendar_spread` warns but is not blocked.
- Advisory: `warnings[]` on the ticket (expiration crosses events) — never blocks.
- AutoPilot: high → skip with reason (gated by `eventRiskAutoBlockHigh`).
