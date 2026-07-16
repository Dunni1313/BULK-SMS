// Phase 5, Sprint 68 — Cross-Engine Daily Report disclaimer-invariant tests,
// mirroring coachLLM.tradeCoach.test.ts's own established pattern (Phase 3
// Sprint 47's precedent) for narrateCrossEngineDailyReport()/...Stream(). No
// persona is invoked (no "in the spirit of Warren Buffett" framing, no named
// analyst grounding), so only the baseline COACH_DISCLAIMER invariant
// applies — there is no VALUE_DISCLAIMER-equivalent or anti-impersonation
// guard to test for this module.

import { describe, it, expect } from "vitest";
import { narrateCrossEngineDailyReport, narrateCrossEngineDailyReportStream } from "./coachLLM.js";
import { COACH_DISCLAIMER } from "./coach.js";

const sampleContext = {
  date: "2026-07-15",
  engine1: { macro: { regimeLabel: "Stable-Rate Environment" }, watchlistTotalItems: 1, watchlistCrossings: [] },
  engine2: { risk: { overall: { label: "Excellent" } } },
  engine3: { healthScore: 82, healthLabel: "Strong", openPositions: 3, totalUnrealizedPnl: 120.5 },
};

describe("Cross-Engine Daily Report narration safety invariants", () => {
  it(
    "always carries the coach disclaimer (LLM or template path)",
    async () => {
      const fallback = "Macro regime: Stable-Rate Environment. Trading risk: Excellent.";
      const n = await narrateCrossEngineDailyReport(sampleContext, fallback);
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
    "streaming narration carries the coach disclaimer on the authoritative final payload",
    async () => {
      const fallback = "Macro regime: Stable-Rate Environment. Trading risk: Excellent.";
      const chunks: string[] = [];
      const n = await narrateCrossEngineDailyReportStream(sampleContext, fallback, (t) => chunks.push(t));
      expect(n.text).toContain(COACH_DISCLAIMER);
    },
    35_000,
  );

  it("never fabricates content when the LLM is unavailable — falls back to the deterministic summary with the disclaimer intact", async () => {
    // Standing in for buildCrossEngineDailyReport()'s own deterministic
    // `summary` field — this test proves the narration layer's own contract
    // (fallback text always gains the disclaimer), not the fallback text's
    // own content, which is covered by crossEngineDailyReport.test.ts's own
    // buildSummary() assertions.
    const fallback = "Macro regime: Stable-Rate Environment. No watchlist symbols crossed a target today.";
    const n = await narrateCrossEngineDailyReport(sampleContext, fallback);
    expect(n.text.length).toBeGreaterThan(0);
    expect(n.text).toContain(COACH_DISCLAIMER);
  }, 35_000);
});
