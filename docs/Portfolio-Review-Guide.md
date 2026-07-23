# Portfolio Review Guide

**Phase 18 — Institutional Portfolio Optimisation Engine.** A short guide to reading an optimisation review: what each classification means, what evidence backs it, and what it deliberately does not claim.

## Classifications

| Action | What it means | What triggers it |
|---|---|---|
| **Exit** | The Decision Engine already recommends closing this position entirely. | `decisionRecommendation` is `Sell` or `Avoid` — a direct reuse of the Decision Engine's own output, not a new judgment. |
| **Trim** | The position (or its sector) has grown too large, or the Decision Engine itself suggests reducing it. | `decisionRecommendation` is `Reduce`, **or** the position's own weight exceeds the 25% single-symbol concentration cap, **or** its sector exceeds the 40% sector concentration cap (both caps reused unmodified from `lib/investingRisk.ts`). |
| **Upgrade** | A mediocre holding with a real, meaningfully better alternative available in the same sector. | `decisionRecommendation` is `Hold` with a synthesis score below 65 (the Decision Engine's own pass bar), **and** a same-sector, not-already-held alternative scores at least 15 points higher. |
| **Core** | No change suggested. | Everything else — a strong Buy/Accumulate holding, or a mediocre Hold with no meaningfully better alternative found. |

## Reading the Evidence Panel

Every candidate carries:

- **Metrics** — Business Quality, Financial Strength, Valuation rating, Margin of Safety, Investment Committee verdict + confidence, Tom Nash conviction, and the Decision Engine's own synthesis score — all already-computed values, never recalculated for this review.
- **Decision Engine recommendation** and **Investment Committee recommendation** — quoted directly, never paraphrased or reinterpreted.
- **Rank explanation** — the exact sentence Opportunity Discovery's own ranking already generates for that symbol.
- **Portfolio impact** — the position's current weight, or an honest "not currently held" for a replacement.
- **Risk impact** — a plain description of how the change affects single-symbol or sector concentration relative to the existing caps.
- **Diversification impact** — whether a replacement adds exposure to a sector not currently represented in the portfolio, or is a same-sector swap.

## What this review deliberately never says

- **No price target, ever.** Nothing here estimates what a symbol will trade at.
- **No expected return.** Nothing here estimates how much a swap would gain or lose.
- **No forecast or prediction of any kind.** Every classification and every evidence sentence describes an already-computed score, rating, or weight — never a forward-looking claim.

If you disagree with a classification, the underlying reason is always stated in plain language and traces back to a single, already-shipped engine (the Decision Engine, the Investment Committee, or the concentration caps) — there is no hidden scoring behind it.

## Cross-references

- `docs/Portfolio-Optimisation.md` — what the engine is, the audit, and the reuse map.
- `docs/Optimisation-Workflow.md` — the end-to-end user workflow.
- `docs/Institutional-Decision-Engine.md` — the Decision Engine's own recommendation logic, reused directly by this module.
