// Phase 2, Sprint 22 — Document Intelligence Engine: EdgarDocumentProvider
// unit tests (approved Phase 2 plan, Sprint 22). LIVE VERIFICATION IS
// DEFERRED — this session's outbound proxy denies data.sec.gov (confirmed via
// a live connectivity probe: 403, policy denial), so these tests cover the
// parsing/error-handling logic against mocked fetch responses only, never a
// live call, matching this codebase's established FMP/Alpha Vantage
// no-key-available convention.

import { describe, it, expect, vi, afterEach } from "vitest";
import { EdgarDocumentProvider } from "./documentProviders.js";

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
}
function textResponse(text: string): Response {
  return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) } as unknown as Response;
}

const TICKER_MAP = { 0: { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." } };

const SUBMISSIONS = {
  filings: {
    recent: {
      form: ["10-Q", "10-K", "8-K"],
      filingDate: ["2025-08-01", "2025-11-01", "2025-06-01"],
      accessionNumber: ["0000320193-25-000050", "0000320193-25-000100", "0000320193-25-000030"],
      primaryDocument: ["aapl-10q.htm", "aapl-10k.htm", "aapl-8k.htm"],
    },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EdgarDocumentProvider.fetchDocument (mocked fetch — live verification deferred, data.sec.gov unreachable in this session)", () => {
  it("resolves ticker -> CIK -> latest 10-K -> primary document HTML", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("company_tickers.json")) return jsonResponse(TICKER_MAP);
      if (url.includes("data.sec.gov/submissions/")) return jsonResponse(SUBMISSIONS);
      if (url.includes("aapl-10k.htm")) return textResponse("<html><body>Item 1. Business text.</body></html>");
      throw new Error(`unexpected url ${url}`);
    });

    const provider = new EdgarDocumentProvider();
    const doc = await provider.fetchDocument("AAPL", "10-K");
    expect(doc).not.toBeNull();
    expect(doc!.symbol).toBe("AAPL");
    expect(doc!.filingDate).toBe("2025-11-01");
    expect(doc!.accessionNumber).toBe("0000320193-25-000100");
    expect(doc!.sourceUrl).toContain("aapl-10k.htm");
    expect(doc!.html).toContain("Item 1. Business text.");
  });

  it("honestly returns null when the ticker isn't in SEC's own ticker map, never guessing a CIK", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("company_tickers.json")) return jsonResponse(TICKER_MAP);
      throw new Error(`unexpected url ${url}`);
    });

    const provider = new EdgarDocumentProvider();
    const doc = await provider.fetchDocument("UNKNOWNXYZ", "10-K");
    expect(doc).toBeNull();
  });

  it("honestly returns null when the company has no 10-K in its recent filings", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("company_tickers.json")) return jsonResponse(TICKER_MAP);
      if (url.includes("data.sec.gov/submissions/"))
        return jsonResponse({ filings: { recent: { form: ["8-K"], filingDate: ["2025-06-01"], accessionNumber: ["x"], primaryDocument: ["x.htm"] } } });
      throw new Error(`unexpected url ${url}`);
    });

    const provider = new EdgarDocumentProvider();
    const doc = await provider.fetchDocument("AAPL", "10-K");
    expect(doc).toBeNull();
  });

  it("returns null for an invalid ticker shape without making any request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new EdgarDocumentProvider();
    const doc = await provider.fetchDocument("NOT A TICKER!!", "10-K");
    expect(doc).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws (never fabricates a document) for an unimplemented document type", async () => {
    const provider = new EdgarDocumentProvider();
    await expect(provider.fetchDocument("AAPL", "earnings-transcript")).rejects.toThrow(/does not yet support/i);
  });

  it("propagates a fetch failure as a rejected promise, never a silently empty document", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const provider = new EdgarDocumentProvider();
    await expect(provider.fetchDocument("AAPL", "10-K")).rejects.toThrow(/network down/);
  });
});
