// Phase 2, Sprint 22 — Document Intelligence Engine: filingExtraction unit
// tests (approved Phase 2 plan, Sprint 22). Pure text-processing, no I/O.

import { describe, it, expect } from "vitest";
import { stripHtml, excerpt, chunkText, extractSections } from "./filingExtraction.js";

describe("stripHtml", () => {
  it("removes script/style/comment blocks and tags, decodes common entities", () => {
    const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
      <body><!-- comment --><p>Revenue &amp; profit grew.</p><p>It&rsquo;s strong.</p></body></html>`;
    const text = stripHtml(html);
    expect(text).not.toMatch(/alert|color:red|<[a-z]/i);
    expect(text).toContain("Revenue & profit grew.");
    expect(text).toContain("It's strong.");
  });
});

// A synthetic-but-realistic 10-K shape: a table of contents that repeats every
// Item heading (the real-world trap this extractor's last-match heuristic
// exists to avoid), followed by the actual section bodies.
function fixtureHtml(): string {
  const toc = `
    <p>TABLE OF CONTENTS</p>
    <p>Item 1. Business ... 3</p>
    <p>Item 1A. Risk Factors ... 10</p>
    <p>Item 1B. Unresolved Staff Comments ... 25</p>
    <p>Item 7. Management's Discussion and Analysis ... 40</p>
    <p>Item 7A. Quantitative and Qualitative Disclosures ... 55</p>
  `;
  const business = `
    <p>Item 1. Business</p>
    <p>${"Acme Corp designs and sells widgets worldwide. ".repeat(20)}</p>
    <p>${"The company was founded in 1990 and has grown steadily. ".repeat(5)}</p>
  `;
  const riskFactors = `
    <p>Item 1A. Risk Factors</p>
    <p>${"Our business is subject to significant competitive pressure. ".repeat(20)}</p>
  `;
  const unresolved = `<p>Item 1B. Unresolved Staff Comments</p><p>None.</p>`;
  const mdAndA = `
    <p>Item 7. Management's Discussion and Analysis</p>
    <p>${"Revenue increased year over year driven by strong demand. ".repeat(20)}</p>
    <p>${"Operating margin expanded due to cost discipline across the business. ".repeat(5)}</p>
  `;
  const quantDisclosures = `<p>Item 7A. Quantitative and Qualitative Disclosures</p><p>Market risk is limited.</p>`;
  return `<html><body>${toc}${business}${riskFactors}${unresolved}${mdAndA}${quantDisclosures}</body></html>`;
}

describe("extractSections", () => {
  it("extracts Business, Risk Factors, and MD&A from a filing with a repeating table-of-contents", () => {
    const sections = extractSections(fixtureHtml());
    expect(sections.map((s) => s.key)).toEqual(["business", "riskFactors", "mdAndA"]);

    const business = sections.find((s) => s.key === "business")!;
    expect(business.found).toBe(true);
    expect(business.rawText).toContain("Acme Corp designs and sells widgets");
    expect(business.rawText).not.toContain("Risk Factors"); // didn't bleed into the next section
    expect(business.rawText).not.toMatch(/^Item 1\. Business \.\.\. 3/); // didn't extract the TOC line
    expect(business.wordCount).toBeGreaterThan(50);

    const risk = sections.find((s) => s.key === "riskFactors")!;
    expect(risk.found).toBe(true);
    expect(risk.rawText).toContain("competitive pressure");
    expect(risk.rawText).not.toContain("Unresolved Staff Comments");

    const mda = sections.find((s) => s.key === "mdAndA")!;
    expect(mda.found).toBe(true);
    expect(mda.rawText).toContain("Revenue increased year over year");
    expect(mda.rawText).not.toContain("Quantitative and Qualitative");
  });

  it("produces a non-null excerpt for every found section", () => {
    const sections = extractSections(fixtureHtml());
    for (const s of sections) {
      expect(s.excerpt).not.toBeNull();
      expect(s.excerpt!.length).toBeGreaterThan(0);
    }
  });

  it("honestly reports found:false with a reason when a section heading can't be located", () => {
    const html = `<html><body><p>Item 1. Business</p><p>${"Some business text. ".repeat(20)}</p></body></html>`;
    const sections = extractSections(html);
    const risk = sections.find((s) => s.key === "riskFactors")!;
    expect(risk.found).toBe(false);
    expect(risk.rawText).toBeNull();
    expect(risk.excerpt).toBeNull();
    expect(risk.reason).toMatch(/could not locate/i);
  });

  it("never fabricates section text for a document with no recognizable Item headings at all", () => {
    const html = `<html><body><p>This is just a random press release, not a 10-K.</p></body></html>`;
    const sections = extractSections(html);
    expect(sections.every((s) => !s.found)).toBe(true);
    expect(sections.every((s) => s.rawText === null)).toBe(true);
  });
});

describe("excerpt", () => {
  it("returns the first and longest sentence, never an invented paraphrase", () => {
    const text = "Short first sentence. This is a much longer second sentence that contains more detail and information. Third one.";
    const result = excerpt(text);
    expect(result).toContain("Short first sentence.");
    expect(result).toContain("much longer second sentence");
  });

  it("does not duplicate when the first sentence is also the longest", () => {
    const text = "This is the only sentence that matters here and it is quite long indeed.";
    const result = excerpt(text);
    expect(result!.match(/only sentence that matters/g)?.length).toBe(1);
  });

  it("returns null for text with no usable sentences", () => {
    expect(excerpt("")).toBeNull();
    expect(excerpt("...")).toBeNull();
  });

  it("truncates with an ellipsis when the combined excerpt exceeds maxChars", () => {
    const longSentence = `This is sentence number one and it is reasonably informative on its own. ${"Word ".repeat(200)}filler sentence.`;
    const result = excerpt(longSentence, 100);
    expect(result!.length).toBeLessThanOrEqual(101);
    expect(result!.endsWith("…")).toBe(true);
  });
});

describe("chunkText", () => {
  it("returns the whole text as a single chunk when under the limit", () => {
    expect(chunkText("short text", 1000)).toEqual(["short text"]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkText("", 1000)).toEqual([]);
  });

  it("splits long text into multiple chunks on paragraph boundaries, none exceeding the limit by more than one paragraph", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) => `Paragraph ${i}. `.repeat(50));
    const text = paragraphs.join("\n\n");
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n").replace(/\n{2,}/g, "\n\n")).toContain("Paragraph 0");
    expect(chunks[chunks.length - 1]).toContain("Paragraph 9");
  });
});
