---
name: Kill-Switch & Guardrail Security Review (Sprint 67)
description: Findings from the first bounded slice of the Blueprint Phase 6 Testing & Security Audit checkpoint — a dedicated, read-only review of the auto-execution/auto-adjustment kill-switch and guardrail logic.
---

# Kill-Switch & Guardrail Security Review (Sprint 67)

Phase 5, Sprint 67 — the first bounded slice of the Blueprint's own Phase 6 "Testing &
Security Audit checkpoint," scoped to exactly the highest-stakes subsystem CLAUDE.md
names: the auto-execution/auto-adjustment kill-switch and guardrail logic
(`execution.ts`, `autoExecution.ts`, `autoAdjustment.ts`, `risk.ts`). **Read-only** — no
change was made to any of those files, per CLAUDE.md rule 2's own maximum-scrutiny
requirement. Where the review found genuine test-coverage gaps, new tests were added
(purely additive verification, never modifying the code under review). No bug or
security gap was found in the protected logic itself — see §4.

## 1. Invariants Checked Against the Actual Code (Not Assumed From the Memory Notes Alone)

Every invariant already documented in `auto-execution-engine.md`/`trade-adjustment-engine.md`
was re-verified by direct inspection of the current source, not taken on faith:

- **Two switches gate opening automation** (`executionMode === "full_auto"` AND
  `autoExecuteEnabled`) — confirmed in `evaluateAutoGuardrails()`.
- **Three switches gate adjustment automation**, master checked before subordinate
  (`full_auto` AND `autoExecuteEnabled` AND `autoAdjustEnabled`) — confirmed in
  `autoAdjustAllowed()`.
- **Single-flight per user** — confirmed via `cycleInFlightUserIds`/
  `adjustCycleInFlightUserIds` `Set<string>` guards in both engines.
- **Guardrails re-checked before EVERY execution, not once per cycle** — confirmed:
  `autoExecution.ts` calls `freshGate(userId)` both at cycle start and again
  immediately before each `executeValidatedTicket()` call; `autoAdjustment.ts` re-reads
  live settings and re-evaluates `autoAdjustAllowed()` before every single close.
- **Auto never bypasses the shared risk path** — confirmed: the auto-execution path is
  `buildTicket()` (full Phase 5 validation) → `decideCandidate()` →
  `executeValidatedTicket()`, the exact same terminal call the manual/semi-auto
  `POST /execution/submit` route uses.
- **Auto-act subset is genuinely restricted** — confirmed: `AUTO_ACTIONABLE` only
  contains `close_for_profit`/`close_for_loss`/`reduce_risk`; roll/convert are never
  auto-actionable, checked via `AUTO_ACTIONABLE.has(adj.action)` before any close.
- **Audit logging never changes accounting** — confirmed in both engines: the decision
  record is pushed to the in-memory result array first, then persisted in a `try/catch`
  that only logs a write failure — a log-write failure can never reclassify an executed
  trade as rejected/skipped.
- **Per-user isolation is real, not just intended** — every DB query in both engines'
  cycle bodies (`countTradesToday`, `countConcurrentPositions`, `dailyRealizedPnl`, the
  candidate/open-trade scan) is filtered by `eq(*.userId, userId)`.

## 2. One Additional Safety Property Found, Not Previously Documented in Either Memory Note

`autoAdjustment.ts`'s `runAdjustLocked()` re-fetches the specific trade row
(`eq(tradesTable.id, t.id), eq(tradesTable.userId, userId)`) and confirms
`status === "open"` **immediately before closing it** — not just before evaluating the
adjustment, but a second, independent check right before the actual close call. This
guards against a trade being closed manually (or by the opening engine) between the
cycle's initial open-trades snapshot and this specific trade's turn in the loop, which
would otherwise risk a double-close attempt. Worth calling out explicitly since it
wasn't named in the original `trade-adjustment-engine.md` note — added here rather than
edited into that file, since this review is additive documentation, not a correction.

## 3. Manual Trigger Routes Confirmed Not to Be a Bypass Path

`POST /execution/auto/run` and `POST /execution/auto/adjust/run`
(`routes/autoExecution.ts`) call `runAutoExecutionCycle(userId)` /
`runAutoAdjustmentCycle(userId)` directly — **the exact same functions the scheduler
calls**, which internally re-run the full gate check before doing anything. A user (or
an attacker with a valid session) cannot use these endpoints to execute a trade while
disarmed; calling them while disarmed returns `blocked: true` with the kill-switch
reason, identical to what the scheduler would report. This was previously unverified at
the HTTP layer — see §5.

`POST /execution/submit` (manual/semi-auto human-initiated submission) is a genuinely
separate, intentional path — it is not gated by `autoExecuteEnabled` because that switch
only governs the *automated* opening path, not a human explicitly clicking submit. This
is confirmed-intentional design, not a bypass.

## 4. Findings

**No bug, gap, or security concern was found in the protected logic itself.** Every
invariant documented in the two existing memory notes was independently re-verified
against the current code and holds. The items below are test-coverage gaps only — real
behavior was already correct; it was simply unverified by any automated test before this
sprint.

## 5. Genuine Test-Coverage Gaps Found and Closed This Sprint

1. **No integration-level regression test existed for a kill-switch flip occurring
   mid-cycle** — the exact historical bug `auto-execution-engine.md` itself documents as
   the reason `freshGate()`/the live per-close re-check exist ("a mid-cycle kill-switch
   flip breach the stated safety bounds"). Only the pure `evaluateAutoGuardrails()`
   unit tests exercised "switch off" as a static input; nothing proved the live,
   multi-candidate cycle actually halts *mid-loop* when the switch flips between two
   candidates. Closed by new `lib/autoExecutionSecurityReview.test.ts`.
2. **`routes/autoExecution.ts` had zero dedicated route-level tests** — none of its 5
   routes (`/execution/auto/status`, `/execution/auto/log`,
   `/execution/auto/adjust/log`, `/execution/auto/run`, `/execution/auto/adjust/run`)
   had ever been exercised through the real Express route + `getScopedUserId` +
   response-schema-parsing chain, only through direct calls to the underlying `lib`
   functions. For the only user-facing surface that can manually trigger real automated
   trading, this was a real gap. Closed by new `routes/autoExecution.route.test.ts`.
3. **No test proved the kill-switch fields themselves are audit-logged** — `auditLog.test.ts`
   proved the general `settings.updated` mechanism with an unrelated field
   (`alpacaApiKey`), never with `autoExecuteEnabled`/`autoAdjustEnabled` specifically.
   Closed by one new case appended to `auditLog.test.ts`.

None of these additions touch `execution.ts`, `optionsMath.ts`, `risk.ts`,
`autoExecution.ts`, or `autoAdjustment.ts` — purely additive test coverage over
already-correct, unmodified behavior.

## 6. Explicitly Out of Scope This Sprint

Per the approved "first bounded slice" scope: full end-to-end/load/chaos testing across
all three engines, a frontend test-coverage gap sweep, and a broader integration-suite
build-out remain part of the Blueprint's own larger Phase 6 vision and are **not**
attempted here. This review covers exactly the kill-switch/guardrail subsystem named as
the highest-priority target.
