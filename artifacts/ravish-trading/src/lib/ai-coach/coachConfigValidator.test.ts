// v1.5.0 Sprint 5 — Coach Bootstrap & Validation. Proves every rule
// coachConfigValidator.ts claims to enforce, using deliberately-broken
// FIXTURE configs only — never the real, shipped Trading/Investing/Options
// configs (those are proven valid separately, and only ever as a positive
// case, in coachRegistry.test.ts). This keeps 100% of this file's negative
// assertions impossible to accidentally trip against production coaches.

import { describe, it, expect } from "vitest";
import {
  validateCoachConfig,
  validateCoachRegistry,
  assertNoValidationIssues,
  type AnyCoachConfig,
} from "./coachConfigValidator";

function validFixture(overrides: Partial<AnyCoachConfig> = {}): AnyCoachConfig {
  return {
    id: "trading",
    displayName: "Test Coach",
    description: "A test coach used only by this test file.",
    capabilities: ["market-structure"],
    endpoint: "/test/coach/ask/stream",
    buildRequestBody: (question: string) => ({ question }),
    ...overrides,
  };
}

describe("validateCoachConfig — a well-formed config produces zero issues", () => {
  it("a minimal valid fixture passes cleanly", () => {
    expect(validateCoachConfig(validFixture())).toEqual([]);
  });
});

describe("validateCoachConfig — required fields", () => {
  it.each([
    ["displayName", ""],
    ["description", ""],
    ["endpoint", ""],
  ] as const)("rejects an empty required field: %s", (field, value) => {
    const issues = validateCoachConfig(validFixture({ [field]: value } as Partial<AnyCoachConfig>));
    expect(issues.some((i) => i.field === field)).toBe(true);
  });

  it("rejects a whitespace-only displayName", () => {
    const issues = validateCoachConfig(validFixture({ displayName: "   " }));
    expect(issues.some((i) => i.field === "displayName")).toBe(true);
  });
});

describe("validateCoachConfig — route mapping", () => {
  it("rejects an endpoint that doesn't start with '/'", () => {
    const issues = validateCoachConfig(validFixture({ endpoint: "trading/coach/ask/stream" }));
    expect(issues.some((i) => i.field === "endpoint")).toBe(true);
  });

  it("accepts a well-formed absolute route", () => {
    const issues = validateCoachConfig(validFixture({ endpoint: "/a/b/c" }));
    expect(issues.some((i) => i.field === "endpoint")).toBe(false);
  });
});

describe("validateCoachConfig — capability invariants", () => {
  it("rejects a coach with zero declared capabilities", () => {
    const issues = validateCoachConfig(validFixture({ capabilities: [] }));
    expect(issues.some((i) => i.field === "capabilities")).toBe(true);
  });

  it("rejects a duplicate capability within the same coach", () => {
    const issues = validateCoachConfig(validFixture({ capabilities: ["market-structure", "market-structure"] }));
    expect(issues.some((i) => i.field === "capabilities" && i.message.includes("more than once"))).toBe(true);
  });

  it("rejects a capability that belongs to a DIFFERENT coach — tool access must not cross coach boundaries", () => {
    // "greeks" is registered as owned by "options", not "trading".
    const issues = validateCoachConfig(validFixture({ id: "trading", capabilities: ["greeks"] }));
    expect(issues.some((i) => i.field === "capabilities" && i.message.includes("not registered as owned by"))).toBe(
      true,
    );
  });

  it("rejects a completely unregistered/typo'd capability string", () => {
    const issues = validateCoachConfig(
      validFixture({ capabilities: ["market-structure-typo" as unknown as AnyCoachConfig["capabilities"][number]] }),
    );
    expect(issues.some((i) => i.field === "capabilities")).toBe(true);
  });

  it("accepts every capability that genuinely belongs to the declared coach", () => {
    const issues = validateCoachConfig(
      validFixture({ id: "options", capabilities: ["greeks", "probability-of-profit", "quiz"] }),
    );
    expect(issues).toEqual([]);
  });
});

describe("validateCoachRegistry — cross-coach invariants", () => {
  it("rejects two coaches sharing the same id", () => {
    const a = validFixture({ id: "trading", endpoint: "/a" });
    const b = validFixture({ id: "trading", endpoint: "/b" });
    const issues = validateCoachRegistry([a, b]);
    expect(issues.some((i) => i.coachId === "<registry>" && i.field === "id")).toBe(true);
  });

  it("rejects two DIFFERENT coaches sharing the same route", () => {
    const a = validFixture({ id: "trading", endpoint: "/shared/route" });
    const b = validFixture({ id: "investing", capabilities: ["company-research"], endpoint: "/shared/route" });
    const issues = validateCoachRegistry([a, b]);
    expect(issues.some((i) => i.coachId === "<registry>" && i.field === "endpoint")).toBe(true);
  });

  it("a registry of genuinely distinct, valid coaches produces zero issues", () => {
    const a = validFixture({ id: "trading", endpoint: "/a" });
    const b = validFixture({ id: "investing", capabilities: ["company-research"], endpoint: "/b" });
    const c = validFixture({ id: "options", capabilities: ["greeks"], endpoint: "/c" });
    expect(validateCoachRegistry([a, b, c])).toEqual([]);
  });
});

describe("assertNoValidationIssues — safe failure behaviour", () => {
  it("does not throw when there are zero issues", () => {
    expect(() => assertNoValidationIssues([], "test context")).not.toThrow();
  });

  it("throws a clear, structural error identifying the coach and field when issues exist", () => {
    const issues = validateCoachConfig(validFixture({ displayName: "" }));
    expect(() => assertNoValidationIssues(issues, "test context")).toThrow(/displayName/);
    expect(() => assertNoValidationIssues(issues, "test context")).toThrow(/trading/);
  });

  it("never includes prompt text, secrets, or arbitrary config field VALUES in the thrown message — only structural field/coach/capability names", () => {
    const secretLookingValue = "sk-live-FAKE_SECRET_VALUE_1234567890";
    const promptLookingValue =
      "You are a patient value-investing tutor... SYSTEM PROMPT CONTENT that must never leak.";
    // Neither of these strings is ever read by the validator (it only
    // inspects displayName/description/endpoint PRESENCE, and
    // capabilities), so injecting them into fields the validator does
    // check proves they never surface in an issue message.
    const broken = validFixture({
      displayName: "", // triggers an issue
      description: promptLookingValue, // present, so never flagged, and never echoed either way
      endpoint: secretLookingValue, // present but doesn't start with "/", so IS flagged — but only the field name should appear, not this literal value
    });
    const issues = validateCoachConfig(broken);
    let thrown = "";
    try {
      assertNoValidationIssues(issues, "test context");
    } catch (err) {
      thrown = (err as Error).message;
    }
    expect(thrown.length).toBeGreaterThan(0);
    expect(thrown).not.toContain(secretLookingValue);
    expect(thrown).not.toContain(promptLookingValue);
  });
});
