---
name: Portfolio AI cockpit
description: Ravish AI Portfolio Manager — advisory-only cockpit; durable invariants for its scoring + briefing/report narration.
---

# Portfolio AI (Ravish AI Portfolio Manager)

Advisory-only cockpit (`/portfolio-ai`) that reuses existing engines (portfolio greeks, adjustment, scanner/scoring, coach). It NEVER auto-executes; UI carries SIMULATED + advisory-only disclaimers. Implementation details (file paths, endpoint list, type shapes) live in `replit.md` and are discoverable from code — this file holds only the non-obvious decisions.

## Invariants / decisions
- **Deterministic numbers are the source of truth.** The portfolio-health and market-briefing engines are pure/seeded-deterministic (same pattern as `earnings.ts` / `eventRisk.ts`). The LLM only writes prose.
  - **Why:** platform-wide rule — LLM prose is commentary, never the sole carrier of a number.
- **Briefing/report narration MUST route through `narrate()`** so the `COACH_DISCLAIMER` invariant is enforced. `PORTFOLIO_AI_DISCLAIMER` is a feature advisory and does NOT substitute for `COACH_DISCLAIMER`.
  - **How to apply:** any new narration path goes through `narrate()`/`narrateStream()`, never a bespoke LLM call.
- **`tradesToAvoid` is gated to `blockShortPremium` only.**
  - **Why:** a medium FOMC-style macro event recurs in nearly every 30–45 DTE window and flags all 10 symbols, making the whole universe "avoid" — the same calibration trap documented for the Event Risk Filter.

## Gotcha — orval query hooks need a queryKey when you pass query options
Calling a generated `useGetX({ query: { refetchInterval } })` fails typecheck (TS2741: `queryKey` missing) because the generated `UseQueryOptions` requires `queryKey`. Either call the hook with no args, or pass the generated `getXQueryKey(...)` alongside the custom option.
**Why:** this orval config does not auto-inject the queryKey when a `query` object is supplied.
