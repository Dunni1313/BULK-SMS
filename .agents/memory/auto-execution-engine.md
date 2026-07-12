---
name: Full-Auto execution engine
description: Safety invariants for the Phase 6 auto-execution cycle (full_auto mode) — how it must never breach caps or bypass risk
---

# Full-Auto execution engine safety

The auto-execution engine (`artifacts/api-server/src/lib/autoExecution.ts`) auto-submits
trades on a scheduler when mode=full_auto AND the master switch (`autoExecuteEnabled`) is on.

## Non-negotiable invariants (a regression here can over-trade real money later)
- **Two switches gate everything**: `executionMode === "full_auto"` AND `autoExecuteEnabled`.
  The master switch is a *kill switch* — off ⇒ nothing auto-submits even in full_auto.
- **Single-flight**: cycles must never overlap. An in-process flag blocks a second
  concurrent cycle (scheduler tick vs. the manual `/execution/auto/run` endpoint). Without
  it, two cycles read the same capacity snapshot and both submit → caps breached.
- **Re-check guardrails before EVERY execution, not once per cycle.** Caps (per-day,
  concurrent, daily-loss breaker) are counted from live DB state and re-evaluated right
  before each `executeValidatedTicket`. This makes the kill switch halt mid-cycle in real
  time and stops trades opened earlier in the same loop from drifting past the caps.
- **Never bypass Phase 5 risk.** The auto path goes buildTicket (full validation) →
  decideCandidate → executeValidatedTicket, the exact shared submit path semi-auto uses.
- **Audit logging is best-effort and must not change accounting.** Record/push the decision
  first, then try to persist; a log-write failure must NOT reclassify an executed trade as
  rejected.

**Why:** code review flagged that a once-per-cycle snapshot + no lock let overlapping cycles
and a mid-cycle kill-switch flip breach the stated safety bounds. The fix re-reads live state
per candidate and single-flights the whole cycle.

## Score floor coupling
Auto uses its own stricter floor `autoMinRavishScore` (default 68 = elite tier), enforced as
`max(autoMinRavishScore, MIN_RAVISH_SCORE)`. MIN_RAVISH_SCORE (62) remains the hard floor.
If you retune the score scale/tiers, re-check both in lockstep (see replit.md Gotchas).
