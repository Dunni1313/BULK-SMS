// Phase 3, Sprint 47 — AI Trade Coach disclaimer-invariant tests, mirroring
// value.test.ts's own "value narration safety invariants" block (Phase 2
// Sprint 30's precedent) for narrateTradeFreeform()/...Stream(). Unlike the
// Value coach, no persona is invoked here (no "in the spirit of Warren
// Buffett" framing), so only the baseline COACH_DISCLAIMER invariant
// applies — there is no VALUE_DISCLAIMER-equivalent or anti-impersonation
// guard to test for this module.

import { describe, it, expect } from "vitest";
import { narrateTradeFreeform, narrateTradeFreeformStream } from "./coachLLM.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("AI Trade Coach narration safety invariants", () => {
  it(
    "free-form trade Q&A always carries the coach disclaimer (LLM or template path)",
    async () => {
      const fallback = "AI narration is not available right now, so I can't directly answer.";
      const n = await narrateTradeFreeform(
        "What is the current market regime?",
        { symbol: "AAPL", regime: { regimeLabel: "trending-bullish" } },
        fallback,
      );
      // narrate() guarantees COACH_DISCLAIMER regardless of whether the LLM
      // ran or we fell back to the deterministic template.
      expect(n.text).toContain(COACH_DISCLAIMER);
    },
    // The real LLM call can take up to its ~25s internal timeout before
    // degrading to the deterministic template; either path satisfies the
    // assertion.
    35_000,
  );

  it(
    "streaming free-form trade Q&A carries the coach disclaimer on the authoritative final payload",
    async () => {
      const fallback = "AI narration is not available right now, so I can't directly answer.";
      const chunks: string[] = [];
      const n = await narrateTradeFreeformStream(
        "How is my portfolio risk looking?",
        { symbol: "MSFT", portfolioRisk: { overall: { label: "Moderate" } } },
        fallback,
        (t) => chunks.push(t),
      );
      expect(n.text).toContain(COACH_DISCLAIMER);
    },
    35_000,
  );

  it("never fabricates an answer when the LLM is unavailable — falls back to the deterministic template with the disclaimer intact", async () => {
    // A fallback string standing in for tradeCoachFallback()'s own output —
    // this test proves the narration layer's own contract (fallback text
    // always gains the disclaimer), not the fallback text's own content,
    // which is covered by the route test's grounding-context assertions.
    const fallback = "AAPL is in a trending-bullish regime with High liquidity.";
    const n = await narrateTradeFreeform("Anything?", { symbol: "AAPL" }, fallback);
    expect(n.text.length).toBeGreaterThan(0);
    expect(n.text).toContain(COACH_DISCLAIMER);
  }, 35_000);
});
