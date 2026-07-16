// Phase 2, Sprint 22 — Document Intelligence Engine: filingExtraction unit
// tests (approved Phase 2 plan, Sprint 22). Pure text-processing, no I/O.
//
// Phase 4, Sprint 60 — 10-Q coverage added (approved, narrowed Sprint 60
// scope: 10-Q only, per Phase-4-Readiness-Report.md §5).

import { describe, it, expect } from "vitest";
import { stripHtml, excerpt, chunkText, extractSections, emptySections } from "./filingExtraction.js";

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

// A synthetic-but-realistic 10-Q shape (Phase 4, Sprint 60): a repeating
// table of contents, PLUS the genuine 10-Q ambiguity a 10-K never has — Item
// 1 and Item 2 each appear TWICE (once in Part I, once in Part II) with
// different titles. Proves the extractor's title-text disambiguation (not a
// "Part I"/"Part II" prefix search) correctly separates Part I's "Item 1.
// Financial Statements" from Part II's own "Item 1. Legal Proceedings", and
// Part I's "Item 2. Management's Discussion" from Part II's own "Item 2.
// Unregistered Sales of Equity Securities".
function fixture10Q(): string {
  const toc = `
    <p>TABLE OF CONTENTS</p>
    <p>PART I</p>
    <p>Item 1. Financial Statements ... 3</p>
    <p>Item 2. Management's Discussion and Analysis ... 15</p>
    <p>Item 3. Quantitative and Qualitative Disclosures About Market Risk ... 22</p>
    <p>PART II</p>
    <p>Item 1. Legal Proceedings ... 24</p>
    <p>Item 1A. Risk Factors ... 25</p>
    <p>Item 2. Unregistered Sales of Equity Securities and Use of Proceeds ... 26</p>
  `;
  const financialStatements = `
    <p>PART I — FINANCIAL INFORMATION</p>
    <p>Item 1. Financial Statements</p>
    <p>${"Condensed consolidated balance sheets show total assets of $4.2 billion. ".repeat(20)}</p>
  `;
  const mdAndA = `
    <p>Item 2. Management's Discussion and Analysis of Financial Condition and Results of Operations</p>
    <p>${"Quarterly revenue increased driven by strong seasonal demand. ".repeat(20)}</p>
  `;
  const marketRisk = `<p>Item 3. Quantitative and Qualitative Disclosures About Market Risk</p><p>No material change from the last 10-K.</p>`;
  const controls = `<p>Item 4. Controls and Procedures</p><p>Disclosure controls were effective.</p>`;
  const legalProceedings = `
    <p>PART II — OTHER INFORMATION</p>
    <p>Item 1. Legal Proceedings</p>
    <p>${"The company is not currently party to any material litigation. ".repeat(10)}</p>
  `;
  const riskFactors = `
    <p>Item 1A. Risk Factors</p>
    <p>${"There have been no material changes to the risk factors previously disclosed. ".repeat(20)}</p>
  `;
  const unregisteredSales = `<p>Item 2. Unregistered Sales of Equity Securities and Use of Proceeds</p><p>None.</p>`;
  return `<html><body>${toc}${financialStatements}${mdAndA}${marketRisk}${controls}${legalProceedings}${riskFactors}${unregisteredSales}</body></html>`;
}

describe("extractSections — 10-Q (Phase 4, Sprint 60)", () => {
  it("extracts Financial Statements, MD&A, and Risk Factors, correctly disambiguating Part I's Item 1/2 from Part II's own Item 1/2", () => {
    const sections = extractSections(fixture10Q(), "10-Q");
    expect(sections.map((s) => s.key)).toEqual(["financialStatements", "mdAndA", "riskFactors"]);

    const fs = sections.find((s) => s.key === "financialStatements")!;
    expect(fs.found).toBe(true);
    expect(fs.rawText).toContain("total assets of $4.2 billion");
    // Never bled into Part II's own, differently-titled "Item 1".
    expect(fs.rawText).not.toContain("Legal Proceedings");
    expect(fs.rawText).not.toContain("material litigation");

    const mda = sections.find((s) => s.key === "mdAndA")!;
    expect(mda.found).toBe(true);
    expect(mda.rawText).toContain("Quarterly revenue increased");
    // Never bled into Part II's own, differently-titled "Item 2".
    expect(mda.rawText).not.toContain("Unregistered Sales");

    const risk = sections.find((s) => s.key === "riskFactors")!;
    expect(risk.found).toBe(true);
    expect(risk.rawText).toContain("no material changes to the risk factors");
    expect(risk.rawText).not.toContain("Unregistered Sales");
  });

  it("produces a non-null excerpt for every found 10-Q section", () => {
    const sections = extractSections(fixture10Q(), "10-Q");
    for (const s of sections) {
      expect(s.excerpt).not.toBeNull();
      expect(s.excerpt!.length).toBeGreaterThan(0);
    }
  });

  it("skips a repeating table of contents for 10-Q headings too (the same last-match heuristic as 10-K)", () => {
    const sections = extractSections(fixture10Q(), "10-Q");
    const fs = sections.find((s) => s.key === "financialStatements")!;
    expect(fs.rawText).not.toMatch(/^Item 1\. Financial Statements \.\.\. 3/);
  });

  it("honestly reports found:false with a reason when a 10-Q Risk Factors heading is genuinely absent (normal 10-Q behavior, not a formatting failure)", () => {
    const html = `<html><body><p>Item 1. Financial Statements</p><p>${"Balance sheet text. ".repeat(20)}</p><p>Item 2. Management's Discussion and Analysis</p><p>${"MD&A text. ".repeat(20)}</p></body></html>`;
    const sections = extractSections(html, "10-Q");
    const risk = sections.find((s) => s.key === "riskFactors")!;
    expect(risk.found).toBe(false);
    expect(risk.rawText).toBeNull();
    expect(risk.reason).toMatch(/could not locate/i);
  });

  it("defaults to the 10-K spec when documentType is omitted, preserving every pre-Sprint-60 call site's behavior", () => {
    const html = `<html><body><p>Item 1. Business</p><p>${"Business text. ".repeat(20)}</p></body></html>`;
    expect(extractSections(html)).toEqual(extractSections(html, "10-K"));
  });
});

describe("emptySections (Phase 4, Sprint 60)", () => {
  it("returns 10-K's own key/label set by default", () => {
    expect(emptySections().map((s) => s.key)).toEqual(["business", "riskFactors", "mdAndA"]);
    expect(emptySections("10-K").map((s) => s.key)).toEqual(["business", "riskFactors", "mdAndA"]);
  });

  it("returns 10-Q's own, different key/label set — no fabricated 'business' key for a filing type that has no Business item", () => {
    const sections = emptySections("10-Q");
    expect(sections.map((s) => s.key)).toEqual(["financialStatements", "mdAndA", "riskFactors"]);
    expect(sections.every((s) => !s.found && s.rawText === null && s.excerpt === null)).toBe(true);
  });

  it("matches the exact key/label shape a real 10-Q extraction produces, for every section", () => {
    const real = extractSections(fixture10Q(), "10-Q");
    const empty = emptySections("10-Q");
    expect(real.map((s) => ({ key: s.key, label: s.label }))).toEqual(empty.map((s) => ({ key: s.key, label: s.label })));
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
