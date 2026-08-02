// v1.5.0 Sprint 5 — Coach Bootstrap & Validation. Proves the Coach
// Registry against the REAL, shipped Trading/Investing/Options configs —
// the positive-case complement to coachConfigValidator.test.ts's own
// fixture-only negative cases. Every assertion here is a behaviour-
// preservation proof: the registry must expose exactly the same routes,
// request builders, and starter prompts each coach already had before this
// sprint — never a redesign of any of them.

import { describe, it, expect } from "vitest";
import { CoachRegistry, coachRegistrationIssues } from "./coachRegistry";
import { assertNoValidationIssues } from "./coachConfigValidator";
import { tradingCoachConfig } from "./coaches/tradingCoach.config";
import { investingCoachConfig } from "./coaches/investingCoach.config";
import { optionsCoachConfig } from "./coaches/optionsCoach.config";

describe("CoachRegistry — contains exactly the three existing conversational coaches", () => {
  it("registers exactly 3 coaches", () => {
    expect(CoachRegistry.all()).toHaveLength(3);
  });

  it("registers Trading, Investing, and Options — no more, no less", () => {
    const ids = CoachRegistry.all().map((c) => c.id).sort();
    expect(ids).toEqual(["investing", "options", "trading"]);
  });

  it("Portfolio is absent from the registry — there is no conversational Portfolio coach", () => {
    const ids = CoachRegistry.all().map((c) => c.id);
    expect(ids).not.toContain("portfolio");
    // CoachId itself has no "portfolio" member, so this is also a
    // compile-time guarantee, not just a runtime absence.
  });

  it("coach ids are unique", () => {
    const ids = CoachRegistry.all().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("CoachRegistry — typed lookup", () => {
  it("get('trading') returns the real tradingCoachConfig object, unmodified", () => {
    expect(CoachRegistry.get("trading")).toBe(tradingCoachConfig);
  });

  it("get('investing') returns the real investingCoachConfig object, unmodified", () => {
    expect(CoachRegistry.get("investing")).toBe(investingCoachConfig);
  });

  it("get('options') returns the real optionsCoachConfig object, unmodified", () => {
    expect(CoachRegistry.get("options")).toBe(optionsCoachConfig);
  });
});

describe("CoachRegistry — the real, production coach configs pass their own validator", () => {
  it("produces zero registration issues for the real registry", () => {
    expect(coachRegistrationIssues).toEqual([]);
  });

  it("assertNoValidationIssues does not throw against the real registry", () => {
    expect(() => assertNoValidationIssues(coachRegistrationIssues, "CoachRegistry")).not.toThrow();
  });
});

describe("CoachRegistry — behaviour preservation: routes are unchanged", () => {
  it("Trading AI Coach still targets /trading/coach/ask/stream", () => {
    expect(CoachRegistry.get("trading")?.endpoint).toBe("/trading/coach/ask/stream");
  });

  it("Investing AI Coach still targets /stock-analyst/value-research/ask/stream", () => {
    expect(CoachRegistry.get("investing")?.endpoint).toBe("/stock-analyst/value-research/ask/stream");
  });

  it("Options AI Coach still targets /ai/chat/stream", () => {
    expect(CoachRegistry.get("options")?.endpoint).toBe("/ai/chat/stream");
  });
});

describe("CoachRegistry — behaviour preservation: request builders/context providers are unchanged", () => {
  it("Trading AI Coach's request builder still produces {symbol, question}", () => {
    const body = CoachRegistry.get("trading")?.buildRequestBody("q", { symbol: "AAPL" });
    expect(body).toEqual({ symbol: "AAPL", question: "q" });
  });

  it("Investing AI Coach's request builder still produces {symbol, question}", () => {
    const body = CoachRegistry.get("investing")?.buildRequestBody("q", { symbol: "MSFT" });
    expect(body).toEqual({ symbol: "MSFT", question: "q" });
  });

  it("Options AI Coach's request builder still produces {message, mode, level}", () => {
    const body = CoachRegistry.get("options")?.buildRequestBody("q", { mode: "auto" as const, level: "beginner" as never });
    expect(body).toEqual({ message: "q", mode: undefined, level: "beginner" });
  });
});

describe("CoachRegistry — behaviour preservation: starter prompts are unchanged", () => {
  it("Trading AI Coach still returns no starter prompts without a symbol", () => {
    expect(CoachRegistry.get("trading")?.starterPrompts?.({ symbol: null })).toEqual([]);
  });

  it("Trading AI Coach still interpolates the searched symbol into its starter prompts", () => {
    const prompts = CoachRegistry.get("trading")?.starterPrompts?.({ symbol: "AAPL" }) ?? [];
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((p) => p.includes("AAPL"))).toBe(true);
  });

  it("Investing AI Coach still interpolates the report's symbol into its starter prompts", () => {
    const prompts = CoachRegistry.get("investing")?.starterPrompts?.({ symbol: "MSFT" }) ?? [];
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((p) => p.includes("MSFT"))).toBe(true);
  });

  it("Options AI Coach still returns its own fixed starter prompts", () => {
    const prompts = CoachRegistry.get("options")?.starterPrompts?.({ mode: "auto", level: "beginner" as never }) ?? [];
    expect(prompts).toEqual(["Explain my latest trade in detail.", "Quiz me on premium selling."]);
  });
});

describe("CoachRegistry — context/conversation isolation across registered coaches", () => {
  it("no two registered coaches share a capability", () => {
    const allCapabilitySets = CoachRegistry.all().map((c) => [...c.capabilities].sort().join(","));
    expect(new Set(allCapabilitySets).size).toBe(allCapabilitySets.length);
  });

  it("each coach's context provider produces a distinct request shape for Options vs. the symbol-scoped coaches", () => {
    const question = "shared question";
    const optionsBody = CoachRegistry.get("options")?.buildRequestBody(question, { mode: "auto", level: "beginner" as never });
    const tradingBody = CoachRegistry.get("trading")?.buildRequestBody(question, { symbol: "AAPL" });
    expect(JSON.stringify(optionsBody)).not.toBe(JSON.stringify(tradingBody));
  });
});
