// Phase 2, Sprint 22 — Document Intelligence Engine: pure text-processing
// utilities (approved Phase 2 plan, Sprint 22). No I/O, no provider calls —
// takes raw HTML already fetched by documentProviders.ts and turns it into
// structured, extracted sections.
//
// Section-boundary detection is deliberately heuristic (filing formatting
// isn't perfectly standardized across filers) — this is exactly why every
// extracted section carries an honest `found` flag and why filingAnalysis.ts
// derives a confidence level from how many sections were actually located,
// rather than silently guessing when a boundary can't be found.
//
// This sprint stops at deterministic extraction (per the approved decision):
// `excerpt()` is a plain extractive heuristic (first + longest sentence), not
// an LLM summary. `chunkText()` exists for a future LLM-summarization sprint
// (Sprint 23) to consume — unused by any LLM call this sprint.
//
// Phase 4, Sprint 60 — extended to 10-Q (per the approved, narrowed Sprint 60
// scope: 10-Q only, earnings-transcript deferred, see Phase-4-Readiness-
// Report.md §5). A 10-Q's own Item numbering is genuinely different from a
// 10-K's, and — unlike a 10-K — a 10-Q has TWO Item 1s and TWO Item 2s (one
// each in Part I and Part II, with different titles), so `extractSections()`
// now takes an explicit `documentType` and selects the matching landmark set
// rather than assuming 10-K. The disambiguation is by each Item's own title
// text (the same approach the pre-existing 10-K landmarks already use, e.g.
// distinguishing Item 7 "Management's Discussion" from any other Item 7),
// not by a "Part I"/"Part II" prefix search.

import type { DocumentType } from "./documentProviders.js";

export interface ExtractedSection {
  key: string;
  label: string;
  found: boolean;
  rawText: string | null;
  excerpt: string | null;
  wordCount: number;
  reason?: string; // present only when found is false
}

// Strips script/style blocks and all remaining tags, decodes the handful of
// entities SEC filings actually use, and collapses whitespace. Not a full
// HTML parser — 10-K filings are simple enough (mostly <p>/<div>/<span> text)
// that a regex-based strip is sufficient and avoids a new heavy dependency.
export function stripHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|tr|br|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&#8220;|&ldquo;|&#8221;|&rdquo;/gi, '"');
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

interface Landmark {
  key: string;
  pattern: RegExp;
}

// Standard 10-K Item numbering (SEC Regulation S-K), plus the 10-Q-only Items
// added in Sprint 60 (Phase 4) — "item1a" (Risk Factors) is deliberately
// shared between both filing types below, since its title text and meaning
// are identical in a 10-K and a 10-Q's own Part II. Order matters — each
// section's end boundary is the next landmark found after it.
const LANDMARKS: Landmark[] = [
  { key: "item1", pattern: /item\s*1\.?\s+business/i },
  { key: "item1a", pattern: /item\s*1a\.?\s+risk\s+factors/i },
  { key: "item1b", pattern: /item\s*1b\.?\s+unresolved\s+staff\s+comments/i },
  { key: "item2", pattern: /item\s*2\.?\s+properties/i },
  { key: "item7", pattern: /item\s*7\.?\s+management.?s\s+discussion/i },
  { key: "item7a", pattern: /item\s*7a\.?\s+quantitative\s+and\s+qualitative/i },
  { key: "item8", pattern: /item\s*8\.?\s+financial\s+statements/i },
  // 10-Q Part I (Sprint 60) — disambiguated from the 10-K landmarks above and
  // from 10-Q Part II's own Item 1/Item 2 purely by title text.
  { key: "q_item1_financialStatements", pattern: /item\s*1\.?\s+financial\s+statements/i },
  { key: "q_item2_mdAndA", pattern: /item\s*2\.?\s+management.?s\s+discussion/i },
  { key: "q_item3_marketRisk", pattern: /item\s*3\.?\s+quantitative\s+and\s+qualitative/i },
  // 10-Q Part II (Sprint 60) — "item1a" above is reused as Part II's Risk
  // Factors; only the two boundary-only landmarks are new here.
  { key: "q_item1_legalProceedings", pattern: /item\s*1\.?\s+legal\s+proceedings/i },
  { key: "q_item2_unregisteredSales", pattern: /item\s*2\.?\s+unregistered\s+sales/i },
];

// Real 10-Ks open with a table of contents that repeats every Item heading —
// naively using the FIRST match would extract the TOC line, not the section.
// Taking the LAST match is a simple, effective heuristic for skipping past it.
function lastMatchIndex(text: string, pattern: RegExp): number | null {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let last: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    last = m.index;
    if (m.index === re.lastIndex) re.lastIndex++; // avoid infinite loop on zero-width matches
  }
  return last;
}

function findLandmarks(text: string): Map<string, number> {
  const found = new Map<string, number>();
  for (const lm of LANDMARKS) {
    const idx = lastMatchIndex(text, lm.pattern);
    if (idx != null) found.set(lm.key, idx);
  }
  return found;
}

// End boundary = the earliest landmark position strictly after `start`, among
// the given candidate keys (in priority order) — falls back to end-of-text.
function sectionEnd(landmarks: Map<string, number>, start: number, candidateKeys: string[], textLength: number): number {
  for (const key of candidateKeys) {
    const pos = landmarks.get(key);
    if (pos != null && pos > start) return pos;
  }
  return textLength;
}

const MAX_SECTION_CHARS = 40000; // a generous cap so one runaway section can't blow memory

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Deterministic extractive "summary": the first sentence (sets context) plus
// the longest sentence (usually the most information-dense), never an
// invented paraphrase.
export function excerpt(text: string, maxChars = 500): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  if (sentences.length === 0) return null;
  const first = sentences[0];
  const longest = sentences.reduce((a, b) => (b.length > a.length ? b : a), sentences[0]);
  const parts = longest === first ? [first] : [first, longest];
  const joined = parts.join(" ");
  return joined.length > maxChars ? `${joined.slice(0, maxChars).trim()}…` : joined;
}

// Splits already-extracted text into LLM-context-sized chunks on paragraph
// boundaries where possible. Not called by any LLM this sprint (per the
// approved decision) — provided so a future summarization sprint (23) can
// reuse it instead of re-implementing chunking.
export function chunkText(text: string, maxChars = 6000): string[] {
  if (text.length <= maxChars) return text ? [text] : [];
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChars && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

interface SectionSpec {
  key: string;
  label: string;
  startKey: string;
  endKeys: string[];
}

// 10-K's own 3 tracked sections, unchanged since Sprint 22.
const SPECS_10K: SectionSpec[] = [
  { key: "business", label: "Business Overview", startKey: "item1", endKeys: ["item1a", "item1b", "item2"] },
  { key: "riskFactors", label: "Risk Factors", startKey: "item1a", endKeys: ["item1b", "item2"] },
  { key: "mdAndA", label: "Management Discussion & Analysis", startKey: "item7", endKeys: ["item7a", "item8"] },
];

// 10-Q's own 3 tracked sections (Phase 4, Sprint 60) — deliberately a
// different `key`/`label` set from 10-K's, not a reuse of "business" (a 10-Q
// has no Business item at all): Financial Statements (Part I Item 1) and
// MD&A (Part I Item 2) are always present; Risk Factors (Part II Item 1A) is
// only required when there's a material change since the last 10-K, so it
// legitimately `found: false`s far more often for a 10-Q than a 10-K.
const SPECS_10Q: SectionSpec[] = [
  { key: "financialStatements", label: "Financial Statements", startKey: "q_item1_financialStatements", endKeys: ["q_item2_mdAndA"] },
  { key: "mdAndA", label: "Management Discussion & Analysis", startKey: "q_item2_mdAndA", endKeys: ["q_item3_marketRisk"] },
  { key: "riskFactors", label: "Risk Factors", startKey: "item1a", endKeys: ["q_item2_unregisteredSales"] },
];

// Any DocumentType other than "10-Q" defaults to the 10-K spec — honest,
// since only "10-K"/"10-Q" ever reach real extracted content in practice
// (EdgarDocumentProvider throws for every other type before a document is
// ever fetched, so emptySections()'s own default shape is all a caller
// requesting an unimplemented type will ever see).
function specsFor(documentType: DocumentType): SectionSpec[] {
  return documentType === "10-Q" ? SPECS_10Q : SPECS_10K;
}

// The honest "nothing extracted yet" shape for a given document type — the
// single source of truth for each type's own key/label set, reused by
// filingAnalysis.ts so its own degraded-path section list can never drift
// out of sync with what a successful extraction would actually produce.
export function emptySections(documentType: DocumentType = "10-K"): ExtractedSection[] {
  return specsFor(documentType).map((s) => ({
    key: s.key,
    label: s.label,
    found: false,
    rawText: null,
    excerpt: null,
    wordCount: 0,
  }));
}

export function extractSections(html: string, documentType: DocumentType = "10-K"): ExtractedSection[] {
  const text = stripHtml(html);
  const landmarks = findLandmarks(text);
  const specs = specsFor(documentType);

  return specs.map((spec) => {
    const start = landmarks.get(spec.startKey);
    if (start == null) {
      return {
        key: spec.key,
        label: spec.label,
        found: false,
        rawText: null,
        excerpt: null,
        wordCount: 0,
        reason: `Could not locate a "${spec.label}" section heading in the filing — the filer's formatting may not follow the standard SEC Item numbering this extractor looks for.`,
      };
    }
    const end = Math.min(sectionEnd(landmarks, start, spec.endKeys, text.length), start + MAX_SECTION_CHARS);
    const rawText = text.slice(start, end).trim();
    if (rawText.length < 50) {
      return {
        key: spec.key,
        label: spec.label,
        found: false,
        rawText: null,
        excerpt: null,
        wordCount: 0,
        reason: `Found a "${spec.label}" heading but the extracted content was too short to be the real section (likely a table-of-contents reference).`,
      };
    }
    return {
      key: spec.key,
      label: spec.label,
      found: true,
      rawText,
      excerpt: excerpt(rawText),
      wordCount: wordCount(rawText),
    };
  });
}
