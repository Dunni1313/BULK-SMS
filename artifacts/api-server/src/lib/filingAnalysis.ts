// Phase 2, Sprint 22 — Document Intelligence Engine: composition layer
// (approved Phase 2 plan, Sprint 22). Orchestrates the document-ingestion
// branch (documentProviders.ts + filingExtraction.ts) and a completely
// independent financial-highlights branch that reuses the existing, already-
// tested buildValueResearchReport() composition — zero new scoring logic, and
// a failure in one branch never blanks the other (an unreachable EDGAR still
// yields a report full of reused financial highlights; an unknown symbol
// still 404s the same way every other stock-analyst route does).
//
// Deterministic only, per the approved decision: the executive summary is a
// template stitching together already-computed facts, never an LLM call. Real
// LLM-narrated qualitative synthesis of the extracted section text is Sprint
// 23's job (Management Quality Analysis), which the roadmap explicitly builds
// "on top of" this sprint's structured output.

import { db, investingFilingAnalysisTable } from "@workspace/db";
import type { DocumentProvider, DocumentType, RawDocument, FetchDocumentOpts } from "./documentProviders.js";
import { extractSections, type ExtractedSection } from "./filingExtraction.js";
import { buildValueResearchReport } from "./valueReport.js";
import type { FundamentalsProvider } from "./fundamentals.js";
import { logger } from "./logger.js";

export interface FilingFinancialHighlight {
  label: string;
  value: string;
  detail?: string;
}

export type FilingConfidenceLevel = "High" | "Moderate" | "Low";

export interface FilingAnalysis {
  symbol: string;
  name: string;
  documentType: DocumentType;
  filingDate: string | null;
  sourceUrl: string | null;
  accessionNumber: string | null;
  fetchedAt: string;
  documentAvailable: boolean;
  documentUnavailableReason?: string;
  sections: ExtractedSection[];
  executiveSummary: string;
  keyFinancialHighlights: FilingFinancialHighlight[];
  confidenceLevel: FilingConfidenceLevel;
  confidenceExplanation: string;
  disclaimer: string;
}

const DISCLAIMER =
  "Educational research only — not investment advice. Section text is extracted directly from the company's own SEC filing; excerpts are a deterministic extractive preview (first + longest sentence), never an AI-generated summary or paraphrase. Always verify against the full source filing linked above.";

const EMPTY_SECTION_SET: ExtractedSection[] = [
  { key: "business", label: "Business Overview", found: false, rawText: null, excerpt: null, wordCount: 0 },
  { key: "riskFactors", label: "Risk Factors", found: false, rawText: null, excerpt: null, wordCount: 0 },
  { key: "mdAndA", label: "Management Discussion & Analysis", found: false, rawText: null, excerpt: null, wordCount: 0 },
];

function withReason(reason: string): ExtractedSection[] {
  return EMPTY_SECTION_SET.map((s) => ({ ...s, reason }));
}

function buildHighlights(report: NonNullable<Awaited<ReturnType<typeof buildValueResearchReport>>>): FilingFinancialHighlight[] {
  const highlights: FilingFinancialHighlight[] = [];
  highlights.push({ label: "Investment Quality Score", value: report.investmentQuality.score != null ? `${report.investmentQuality.score}/100` : "unavailable" });
  highlights.push({
    label: "Competitive Advantage",
    value: report.competitiveAdvantage.score != null ? `${report.competitiveAdvantage.score}/100 (${report.competitiveAdvantage.classification})` : "unavailable",
  });
  highlights.push({
    label: "Graham Valuation",
    value: report.grahamValuation.available ? report.grahamValuation.rating : "unavailable",
    detail: report.grahamValuation.available ? `${(report.grahamValuation.marginOfSafety * 100).toFixed(0)}% margin of safety` : undefined,
  });
  highlights.push({
    label: "DCF Valuation",
    value: report.dcfValuation.available ? report.dcfValuation.rating : "unavailable",
    detail: report.dcfValuation.available ? `${(report.dcfValuation.marginOfSafety * 100).toFixed(0)}% margin of safety` : undefined,
  });
  highlights.push({
    label: "Buffett Valuation",
    value: report.buffettValuation.available ? report.buffettValuation.rating : "unavailable",
    detail: report.buffettValuation.available ? `${(report.buffettValuation.marginOfSafety * 100).toFixed(0)}% margin of safety` : undefined,
  });
  highlights.push({
    label: "Tom Nash Conviction",
    value: `${report.tomNash.convictionScore}/100 (${report.tomNash.verdict})`,
  });
  highlights.push({
    label: "Investment Committee",
    value: `${report.investmentCommittee.consolidatedVerdict} (${report.investmentCommittee.agreement})`,
  });
  return highlights;
}

function buildExecutiveSummary(
  symbol: string,
  doc: RawDocument | null,
  report: NonNullable<Awaited<ReturnType<typeof buildValueResearchReport>>>,
  sections: ExtractedSection[],
): string {
  const parts: string[] = [];
  if (doc) {
    const foundCount = sections.filter((s) => s.found).length;
    parts.push(
      `${symbol}'s most recent 10-K was filed ${doc.filingDate ?? "on an unknown date"}; ${foundCount} of ${sections.length} tracked sections were located.`,
    );
  } else {
    parts.push(`No 10-K filing could be located for ${symbol} in SEC EDGAR.`);
  }
  parts.push(`Investment Committee: ${report.investmentCommittee.consolidatedVerdict} (${report.investmentCommittee.agreement} agreement).`);
  parts.push(`Tom Nash conviction: ${report.tomNash.convictionScore}/100 (${report.tomNash.verdict}).`);
  return parts.join(" ");
}

function confidenceFor(doc: RawDocument | null, sections: ExtractedSection[]): { level: FilingConfidenceLevel; explanation: string } {
  if (!doc) {
    return { level: "Low", explanation: "No filing was located, so this analysis is based only on the reused financial-analysis modules." };
  }
  const foundCount = sections.filter((s) => s.found).length;
  if (foundCount === sections.length) {
    return { level: "High", explanation: `A 10-K was located and all ${sections.length} tracked sections were successfully extracted.` };
  }
  if (foundCount > 0) {
    return {
      level: "Moderate",
      explanation: `A 10-K was located but only ${foundCount} of ${sections.length} tracked sections could be reliably extracted (the filer's formatting may deviate from standard SEC Item numbering).`,
    };
  }
  return {
    level: "Low",
    explanation: "A 10-K was located but no tracked section could be reliably extracted from its formatting.",
  };
}

// Short-lived in-process cache so repeated views of the same symbol's filing
// don't re-fetch from EDGAR (filings are annual documents, not date-scoped
// quotes — a much longer TTL than the price/statement caches is appropriate).
const FILING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const filingCache = new Map<string, { at: number; doc: RawDocument | null }>();

async function fetchDocumentCached(
  provider: DocumentProvider,
  symbol: string,
  documentType: DocumentType,
  opts?: FetchDocumentOpts,
): Promise<RawDocument | null> {
  const key = `${provider.id}:${symbol}:${documentType}`;
  if (!opts?.forceRefresh) {
    const cached = filingCache.get(key);
    if (cached && Date.now() - cached.at < FILING_CACHE_TTL_MS) return cached.doc;
  }
  const doc = await provider.fetchDocument(symbol, documentType, opts);
  filingCache.set(key, { at: Date.now(), doc });
  return doc;
}

export async function buildFilingAnalysis(
  symbol: string,
  documentProvider: DocumentProvider,
  fundamentalsProvider: FundamentalsProvider,
  documentType: DocumentType = "10-K",
  opts?: FetchDocumentOpts,
  userId?: string,
): Promise<FilingAnalysis | null> {
  const report = await buildValueResearchReport(symbol, undefined, fundamentalsProvider, undefined, undefined, userId);
  if (!report) return null;

  let doc: RawDocument | null = null;
  let documentUnavailableReason: string | undefined;
  try {
    doc = await fetchDocumentCached(documentProvider, report.symbol, documentType, opts);
    if (!doc) documentUnavailableReason = `No ${documentType} filing was found for ${report.symbol} in SEC EDGAR.`;
  } catch (err) {
    logger.warn({ err, symbol: report.symbol }, "document fetch failed");
    documentUnavailableReason = "The live document provider is currently unavailable.";
  }

  const sections = doc ? extractSections(doc.html) : withReason(documentUnavailableReason ?? "Document unavailable.");
  const keyFinancialHighlights = buildHighlights(report);
  const executiveSummary = buildExecutiveSummary(report.symbol, doc, report, sections);
  const { level: confidenceLevel, explanation: confidenceExplanation } = confidenceFor(doc, sections);

  const analysis: FilingAnalysis = {
    symbol: report.symbol,
    name: report.name,
    documentType,
    filingDate: doc?.filingDate ?? null,
    sourceUrl: doc?.sourceUrl ?? null,
    accessionNumber: doc?.accessionNumber ?? null,
    fetchedAt: new Date().toISOString(),
    documentAvailable: !!doc,
    ...(documentUnavailableReason ? { documentUnavailableReason } : {}),
    sections,
    executiveSummary,
    keyFinancialHighlights,
    confidenceLevel,
    confidenceExplanation,
    disclaimer: DISCLAIMER,
  };

  if (userId) {
    try {
      await db.insert(investingFilingAnalysisTable).values({
        userId,
        symbol: analysis.symbol,
        filingType: documentType,
        filingDate: analysis.filingDate,
        sourceUrl: analysis.sourceUrl,
        sectionsJson: analysis.sections,
        summaryJson: {
          executiveSummary: analysis.executiveSummary,
          keyFinancialHighlights: analysis.keyFinancialHighlights,
          confidenceLevel: analysis.confidenceLevel,
          confidenceExplanation: analysis.confidenceExplanation,
        },
      });
    } catch (err) {
      // Best-effort, mirrors recordAuditEvent's philosophy: a persistence
      // failure must never break the user-facing analysis response.
      logger.error({ err, symbol: analysis.symbol }, "failed to persist filing analysis");
    }
  }

  return analysis;
}
