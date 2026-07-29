// v1.5.0, Sprint 6 — AI Coach Memory. Pure unit coverage for
// deriveTitleFromMessage() — the "Automatic title generation from first
// prompt" logic — kept separate from the live end-to-end HTTP suite
// (aiCoachConversations.route.test.ts) so this math doesn't need a real
// database connection to verify.

import { describe, it, expect } from "vitest";
import { deriveTitleFromMessage, COACH_IDS } from "./aiCoachConversations";

describe("deriveTitleFromMessage", () => {
  it("returns a short message unchanged", () => {
    expect(deriveTitleFromMessage("What is my portfolio risk?")).toBe("What is my portfolio risk?");
  });

  it("collapses internal whitespace and newlines into single spaces", () => {
    expect(deriveTitleFromMessage("What   is\nmy\t\tportfolio risk?")).toBe("What is my portfolio risk?");
  });

  it("trims leading/trailing whitespace", () => {
    expect(deriveTitleFromMessage("   hello there   ")).toBe("hello there");
  });

  it("truncates a long message with an ellipsis, never fabricating content beyond what was typed", () => {
    const longMessage =
      "Can you walk me through every single consideration for this iron condor including the greeks, the probability of profit, the expected move, and how it compares to my other open positions in detail?";
    const title = deriveTitleFromMessage(longMessage);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
    expect(longMessage.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("falls back to the default sentinel for a whitespace-only message", () => {
    expect(deriveTitleFromMessage("   \n\t  ")).toBe("New conversation");
  });
});

describe("COACH_IDS", () => {
  it("is exactly the three in-scope conversational coaches — Portfolio is absent", () => {
    expect([...COACH_IDS].sort()).toEqual(["investing", "options", "trading"]);
  });
});
