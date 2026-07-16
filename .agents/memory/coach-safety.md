---
name: AI Trading Coach safety invariants
description: The non-negotiable safety rules for the read-only coach/teaching layer.
---

# Coach safety invariants

The AI Trading Coach is a **read-only teaching layer**. It explains trades, tutors
Greeks, generates/grades quizzes, and reviews closed trades. It must NEVER execute,
submit, or place orders.

**Rules:**
- The coach disclaimer is enforced centrally in the LLM `narrate()` helper (appended
  unless already present), NOT in each caller. Any new narration path must route through
  `narrate()` or it loses the disclaimer guarantee.
- Deterministic structured fields (max loss, Greeks, assignment risk, POP) are the source
  of truth and are always rendered. LLM prose is commentary only — it must never be the
  sole carrier of a number.
- Quiz grading is server-authoritative: the quizId base64url-encodes the correct-answer
  indices; the question bank is never exposed to clients.
- `journal-review` is closed-trades-only (rejects non-closed with 400).

**Why:** the product contract guarantees every coach response carries max loss + Greeks +
assignment risk + disclaimer, and that the assistant can never be tricked into trading.
Centralizing the disclaimer + keeping math deterministic is what makes those guarantees
hold even when the LLM hallucinates or fails.

**How to apply:** when extending the coach, add deterministic computation first, treat the
LLM as an optional prose wrapper, and keep all execution/order code paths out of `coach.ts`
and `routes/coach.ts`.

## Feature-specific narration disclaimers (value-investing module)

`narrate()`/`narrateStream()` only guarantee `COACH_DISCLAIMER`. A feature whose
contract requires a STRONGER disclaimer (e.g. the value module's `VALUE_DISCLAIMER`,
which carries SIMULATED + "not Warren Buffett or any real person" + "does not execute
trades") must enforce it deterministically too — the prompt alone is not a guarantee.

**Rule:** wrap the feature's narrate call with a post-processor (e.g.
`enforceValueSafety()` in coachLLM.ts) that runs AFTER `narrate()`/`narrateStream()`:
it (1) appends the feature disclaimer if absent, and (2) if the LLM impersonates a
real person (first-person "I am Buffett" etc.), discards the LLM prose and falls back
to the deterministic template. For streaming, apply it to the authoritative final
payload (the `done` event the frontend uses to replace streamed tokens).

**Why:** the never-impersonate / always-show-strong-disclaimer invariants are safety
claims; the LLM is commentary only and must never be their sole carrier. Keep the
anti-impersonation regex conservative (first-person framings only) so legitimate
"as Buffett would say" / "in the spirit of Buffett's principles" prose is not discarded.

## UI testing gotcha

The coach UI flows (Teach Me, Explain This Trade sheet) hit LLM-backed endpoints
(`/coach/teach-greek`, `/coach/explain-trade`) that take ~10-20s each. Running multiple
coach `runTest` flows in **parallel** saturates them and the proxy returns 502 / empty
renders — these are gateway timeouts, NOT safety regressions. Verify endpoints work via
curl, then re-run coach UI tests **sequentially** (or one flow per run) with generous waits.
Quiz/journal-review are lighter and tolerate parallelism better.
