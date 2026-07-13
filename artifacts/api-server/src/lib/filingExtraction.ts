// Phase 2, Sprint 22 — Document Intelligence Engine: pure text-processing
// utilities (approved Phase 2 plan, Sprint 22). No I/O, no provider calls —
// takes raw HTML already fetched by documentProviders.ts and turns it into
// structured, extracted sections.
//
// Section-boundary detection is deliberately heuristic (10-K formatting isn't
// perfectly standardized across filers) — this is exactly why every extracted
// section carries an honest `found` flag and why filingAnalysis.ts derives a
// confidence level from how many sections were actually located, rather than
// silently guessing when a boundary can't be found.
//
// This sprint stops at deterministic extraction (per the approved decision):
// `excerpt()` is a plain extractive heuristic (first + longest sentence), not
// an LLM summary. `chunkText()` exists for a future LLM-summarization sprint
// (Sprint 23) to consume — unused by any LLM call this sprint.

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

// Standard 10-K Item numbering (SEC Regulation S-K). Order matters — each
// section's end boundary is the next landmark found after it.
const LANDMARKS: Landmark[] = [
  { key: "item1", pattern: /item\s*1\.?\s+business/i },
  { key: "item1a", pattern: /item\s*1a\.?\s+risk\s+factors/i },
  { key: "item1b", pattern: /item\s*1b\.?\s+unresolved\s+staff\s+comments/i },
  { key: "item2", pattern: /item\s*2\.?\s+properties/i },
  { key: "item7", pattern: /item\s*7\.?\s+management.?s\s+discussion/i },
  { key: "item7a", pattern: /item\s*7a\.?\s+quantitative\s+and\s+qualitative/i },
  { key: "item8", pattern: /item\s*8\.?\s+financial\s+statements/i },
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

export function extractSections(html: string): ExtractedSection[] {
  const text = stripHtml(html);
  const landmarks = findLandmarks(text);

  const specs: { key: string; label: string; startKey: string; endKeys: string[] }[] = [
    { key: "business", label: "Business Overview", startKey: "item1", endKeys: ["item1a", "item1b", "item2"] },
    { key: "riskFactors", label: "Risk Factors", startKey: "item1a", endKeys: ["item1b", "item2"] },
    { key: "mdAndA", label: "Management Discussion & Analysis", startKey: "item7", endKeys: ["item7a", "item8"] },
  ];

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
