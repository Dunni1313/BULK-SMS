---
name: Coach LLM concurrency hardening
description: Why/how the coach narration layer survives several simultaneous users without 502s.
---

# Coach LLM concurrency

The coach LLM-backed surfaces (Greeks "Teach Me", "Explain This Trade") call
slow (~10-20s) narration endpoints. Under concurrent load they used to pile up
and surface as 502 gateway timeouts / blank cards. Three guards in
`coachLLM.ts` + one in `sse.ts` prevent this; keep all four when touching that
layer:

- **Per-call timeout** (`COACH_LLM_TIMEOUT_MS`, default 25s) via an
  `AbortController` signal passed to both SDKs. A hung call aborts and degrades
  to the deterministic template instead of hanging forever.
- **Shared cache** (`narrationCache`, TTL ~10min, LRU-capped) keyed by
  `trade:<symbol>:<strategy>` and `greek:<greek>:<symbol>`. Both the streaming
  and non-streaming paths share it (a streamed result serves a later JSON ask).
- **Single-flight** (`inflight` map keyed the same way): N concurrent identical
  asks share ONE LLM call. The leader streams tokens live to its own client and
  resolves a shared promise; followers await it and emit the finished text as a
  single chunk. This is the real win for "several people at once" — they usually
  hit the same few greeks/candidates.
- **SSE heartbeat** (`sse.ts`, 15s `: keep-alive` comment): keeps the reverse
  proxy from idle-timing-out (502) during the LLM wait, e.g. between the `meta`
  event and the first `delta`, or while a single-flight follower waits. `send()`
  is a single atomic write so a heartbeat can never interleave mid-event.

**Why:** observed 502s/blank cards during concurrent e2e verification (recovered
when run one at a time). **Verified:** 10 concurrent identical asks all 200 and
share one ~7s call; a warm cache key returns in ~0.02s; disclaimer preserved.

**How to apply:** any new narration path should route through `narrate()` /
`narrateStream()` with a stable `cacheKey` to inherit all four guards. The cache
key must be deterministic for identical output (symbol/strategy/greek), since the
underlying explanation/lesson is canonical, not request-specific.
