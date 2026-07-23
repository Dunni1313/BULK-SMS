# Investment Recommendations — Output Fields

**Phase 14 — Institutional Investment Decision Engine.** This document describes every narrative output field `lib/decisionEngine.ts` produces beyond the recommendation and checklist (see `docs/Decision-Framework.md`) — and how each is derived from already-computed facts, never newly generated prose.

All of these are deterministic, rule-based selections/bucketings of existing strings and numbers. Zero LLM calls, zero new text generation, zero price forecasting.

## 1. Supporting Evidence / Contradicting Evidence
Two parallel lists of `{label, detail}` facts, built from a fixed set of already-computed signals, each bucketed onto whichever side it genuinely supports:

- **Moat** — supporting if `moat.rating !== "None"`, else contradicting.
- **Business Quality** — supporting if `Wonderful`/`Good`, contradicting if `Weak`.
- **Investment Quality** — supporting if score ≥65, contradicting if <45.
- **Competitive Advantage** — supporting if score ≥65, contradicting if <45.
- **Management Quality** — supporting if available and ≥65, contradicting if available and <45 (silently omitted when unavailable — never a fabricated evidence item for missing data).
- **Investment Committee** — supporting if verdict is Buy, contradicting if Wait.
- **Tom Nash Conviction** — supporting if ≥65, contradicting if <45.
- **Margin of Safety** — supporting if the consolidated average margin of safety is positive, contradicting if negative or unavailable.
- **Financial Strength** — every individual flag (e.g. "Elevated leverage") is its own contradicting-evidence item; a flag-free balance sheet contributes one supporting-evidence item instead.

## 2. Strengths / Weaknesses
A deduplicated, capped (top 8) concatenation of the `strengths`/`weaknesses` arrays already produced by Investment Quality and Competitive Advantage — no new selection logic beyond taking each engine's own best/worst-scoring metrics in order and removing duplicate text.

## 3. Risks
A deduplicated, capped (top 8) concatenation of Financial Strength's own `flags` array and the underlying `ValueResearchReport`'s own `risks` array (which already includes things like "Earnings in ~N days" and ETF-caveat text) — no new risk detection.

## 4. Catalysts
Reused, restated facts, never a new prediction:
- A re-rating catalyst sentence when the consolidated average margin of safety exceeds 15% (quoting the actual discount percentage).
- Tom Nash's own `sectorMacro.detail` and `rateSensitivity.detail` sentences (Phase 2, Sprint 26) — already-computed macro/rate context.
- The existing "Earnings in ~N days" risk flag, if present, restated as a near-term catalyst.
- Honest fallback: "No specific near-term catalyst identified from currently available data" when none of the above apply.

## 5. Things to Monitor
- Management Quality's own unavailable-reason text, when Management Quality couldn't be resolved.
- Competitive Advantage's own unavailable dimensions (e.g. Customer Concentration Risk), each with its own already-computed reason.
- "No portfolio was supplied" when Risk/Portfolio Fit/Diversification weren't evaluated.
- Every Financial Strength flag (the same facts already surfaced under Risks, intentionally also surfaced here as ongoing watch items).

## 6. Why Buy / Why Wait / Why Sell
Three parallel bullet lists giving the user both sides of the tension regardless of the actual recommendation — an institutional-research convention, not a hedge:

- **Why Buy** — the Supporting Evidence list, restated as `"{label}: {detail}"` strings, capped at 6.
- **Why Wait** — built from valuation richness (a non-positive consolidated margin of safety), an Investment Committee Wait verdict, and a split-agreement signal (analysts disagree) — each restated with its own concrete number; honest fallback when no such signal is present.
- **Why Sell** — the Contradicting Evidence list, restated the same way as Why Buy, capped at 6; honest fallback ("No strong bearish evidence identified from currently available data") when none exists.

## 7. Everything references existing calculations

Per the explicit requirement, no string in any of the fields above is invented independently of an already-computed number, rating, or flag — every sentence either quotes a real figure (a percentage, a score, a rating) or is a direct restatement of an existing engine's own summary/detail text. The one exception — the catalysts/why-wait fallback sentences — are honest "nothing found" statements, not fabricated content.

## Cross-references

- `docs/Institutional-Decision-Engine.md` — the full module overview, reuse audit, and integration points.
- `docs/Decision-Framework.md` — the recommendation derivation and 15-item checklist methodology.
