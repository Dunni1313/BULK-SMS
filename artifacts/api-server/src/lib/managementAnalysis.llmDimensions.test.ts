// Phase 4, Sprint 63 — Management Quality Analysis's two LLM-narrated
// dimensions (Communication Quality, Long-Term Focus), exercising the real
// "LLM succeeds" path end-to-end. This session has no real LLM key, so
// managementAnalysis.test.ts only ever exercises the honest-unavailable
// path — this file mocks the OpenAI SDK the same way coach-level.test.ts
// already established (vi.hoisted() sets OPENAI_API_KEY before coachLLM.ts
// is ever imported, so llmAvailable() genuinely selects the OpenAI path).
//
// This is the highest compliance/reputational-risk LLM integration in the
// codebase (see CLAUDE.md's own framing), so the safety guard
// (violatesIndividualCharacterization) is proven here to actually discard a
// violating response — not just unit-tested in isolation — end-to-end
// through buildManagementQualityAnalysis() itself.

import { describe, it, expect, beforeEach, vi } from "vitest";

const llmMock = vi.hoisted(() => {
  process.env.OPENAI_API_KEY = "sk-test-openai-key";
  const state = {
    callCount: 0,
    lastUserContent: "",
    nextResponse: null as string | null,
    reset(): void {
      state.callCount = 0;
      state.lastUserContent = "";
      state.nextResponse = null;
    },
  };
  return state;
});

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = {
      completions: {
        create: (params: { messages: { role: string; content: string }[] }) => {
          llmMock.callCount += 1;
          llmMock.lastUserContent = params.messages.find((m) => m.role === "user")?.content ?? "";
          return Promise.resolve({ choices: [{ message: { content: llmMock.nextResponse } }] });
        },
      },
    };
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = {
      create: () => Promise.reject(new Error("anthropic path not used in these tests")),
      stream: () => {
        throw new Error("anthropic path not used in these tests");
      },
    };
  },
}));

import { buildManagementQualityAnalysis } from "./managementAnalysis.js";
import { narrateManagementCommunicationQuality, narrateManagementLongTermFocus, violatesIndividualCharacterization } from "./coachLLM.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { DocumentProvider, DocumentType, RawDocument, FetchDocumentOpts } from "./documentProviders.js";

const SAMPLE_HTML = `<html><body>
  <p>Item 1. Business</p>
  <p>${"Acme Corp designs and sells widgets worldwide. ".repeat(20)}</p>
  <p>Item 1A. Risk Factors</p>
  <p>${"Our business faces significant competitive pressure. ".repeat(20)}</p>
  <p>Item 7. Management's Discussion and Analysis</p>
  <p>${"The company continues to invest heavily in multi-year research and development programs, targeting sustained long-term growth in cloud infrastructure. ".repeat(20)}</p>
  <p>Item 8. Financial Statements</p>
</body></html>`;

class FakeDocumentProvider implements DocumentProvider {
  readonly id = "fake";
  async fetchDocument(symbol: string, documentType: DocumentType, _opts?: FetchDocumentOpts): Promise<RawDocument | null> {
    return {
      symbol,
      documentType,
      filingDate: "2025-11-01",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${symbol}-10k.htm`,
      accessionNumber: "0000320193-25-000100",
      fetchedAt: new Date().toISOString(),
      html: SAMPLE_HTML,
    };
  }
}

beforeEach(() => {
  llmMock.reset();
});

describe("violatesIndividualCharacterization (unit)", () => {
  it("flags a title paired with an evaluative claim", () => {
    expect(violatesIndividualCharacterization("The CEO's integrity is questionable.")).toBe(true);
    expect(violatesIndividualCharacterization("The CFO seems evasive about the numbers.")).toBe(true);
  });

  it("flags a personal pronoun paired with character vocabulary", () => {
    expect(violatesIndividualCharacterization("Her leadership style is decisive.")).toBe(true);
    expect(violatesIndividualCharacterization("His candor during the call was notable.")).toBe(true);
  });

  it("flags an honorific-plus-name shape", () => {
    expect(violatesIndividualCharacterization("Mr. Smith is competent.")).toBe(true);
  });

  it("does NOT flag legitimate company-level disclosure assessment", () => {
    expect(violatesIndividualCharacterization("The filing uses specific, concrete language throughout.")).toBe(false);
    expect(violatesIndividualCharacterization("Management's overall capital discipline is solid.")).toBe(false);
    expect(violatesIndividualCharacterization("The MD&A section discloses risks candidly.")).toBe(false);
  });
});

describe("narrateManagementCommunicationQuality / narrateManagementLongTermFocus (mocked LLM)", () => {
  it("returns a valid score/detail when the LLM produces well-formed JSON", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 78, detail: "The filing uses specific figures and discloses challenges candidly." });
    const result = await narrateManagementCommunicationQuality("Some filing prose about revenue.", "AAPL");
    expect(result).not.toBeNull();
    expect(result!.score).toBe(78);
    expect(result!.detail).toContain("specific figures");
    expect(llmMock.callCount).toBe(1);
  });

  it("clamps an out-of-range score into 0-100", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 140, detail: "Very clear and specific disclosure." });
    const result = await narrateManagementLongTermFocus("Some filing prose.", "MSFT");
    expect(result!.score).toBe(100);
  });

  it("returns null (never a fabricated score) when the JSON is malformed", async () => {
    llmMock.nextResponse = "not valid json at all";
    const result = await narrateManagementCommunicationQuality("Some filing prose.", "GOOGL");
    expect(result).toBeNull();
  });

  it("returns null when the response is missing required fields", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 60 }); // no detail
    const result = await narrateManagementCommunicationQuality("Some filing prose.", "NVDA");
    expect(result).toBeNull();
  });

  it("returns null when the score field is not a number", async () => {
    llmMock.nextResponse = JSON.stringify({ score: "high", detail: "Clear disclosure." });
    const result = await narrateManagementLongTermFocus("Some filing prose.", "META");
    expect(result).toBeNull();
  });

  // The compliance-critical case: the LLM drifts into evaluating a named
  // individual — the response must be discarded entirely, never returned
  // with the individual-characterization text intact.
  it("discards the response and returns null when it violates the individual-characterization guard", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 90, detail: "The CEO's integrity shines through in this filing." });
    const result = await narrateManagementCommunicationQuality("Some filing prose.", "TSLA");
    expect(result).toBeNull();
  });

  it("the prompt sent to the LLM includes the filing text and the company symbol, never fabricating grounding", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 55, detail: "Adequate disclosure." });
    await narrateManagementLongTermFocus("UNIQUE_FILING_MARKER_TEXT_12345", "IBM");
    expect(llmMock.lastUserContent).toContain("UNIQUE_FILING_MARKER_TEXT_12345");
    expect(llmMock.lastUserContent).toContain("IBM");
  });
});

describe("buildManagementQualityAnalysis — LLM-narrated dimensions end-to-end (mocked LLM)", () => {
  it("Communication Quality and Long-Term Focus get real scores when the LLM succeeds", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 82, detail: "Specific, concrete disclosure with candid risk framing." });
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider();
    const result = await buildManagementQualityAnalysis("AAPL", docs, fundamentals);

    const commQuality = result!.dimensions.find((d) => d.dimension === "Communication Quality")!;
    const longTerm = result!.dimensions.find((d) => d.dimension === "Long-Term Focus")!;
    expect(commQuality.score).toBe(82);
    expect(commQuality.sourceSection).toBeTruthy();
    expect(commQuality.sourceSection!.key).toBe("mdAndA");
    expect(longTerm.score).toBe(82);
    expect(longTerm.sourceSection).toBeTruthy();
  });

  it("Communication Quality/Long-Term Focus honestly stay unavailable — never a fabricated score — when the LLM's response violates the individual-characterization guard", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 95, detail: "His leadership style is exceptionally candid." });
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider();
    const result = await buildManagementQualityAnalysis("MSFT", docs, fundamentals);

    for (const name of ["Communication Quality", "Long-Term Focus"]) {
      const dim = result!.dimensions.find((d) => d.dimension === name)!;
      expect(dim.score).toBeNull();
      expect(dim.reason).toMatch(/ai narration is not available/i);
    }
  });

  it("the overall management-quality score reflects the two real LLM-narrated dimensions, and confidence improves", async () => {
    llmMock.nextResponse = JSON.stringify({ score: 70, detail: "Reasonably clear disclosure." });
    const fundamentals = new SimulatedFundamentalsProvider();
    const docs = new FakeDocumentProvider();
    const result = await buildManagementQualityAnalysis("GOOGL", docs, fundamentals);
    // 8 of 9 dimensions available now (only Strategic Consistency stays
    // structurally unavailable) — proves the confidence-level machinery
    // itself needed no change, only real data flowing into it.
    expect(result!.confidenceExplanation).toMatch(/8 of 9 dimensions/i);
    expect(result!.confidenceLevel).toBe("Moderate");
  });
});
