// Phase 2, Sprint 23 — Management Quality Analysis Engine (approved Phase 2
// plan, Sprint 23). Pure composition over already-computed outputs from the
// Document Intelligence Engine (Sprint 22) and buildValueResearchReport()'s
// existing analyzers — mirrors Competitive Advantage's "reuse, don't
// duplicate" pattern.
//
// Sprint 23 shipped deterministic only, with 5 of 9 requested dimensions
// scored and the other 4 (Strategic Consistency, Long-Term Focus,
// Communication Quality, Shareholder Alignment) honestly `unavailable`.
//
// Phase 4, Sprint 63 — fills 3 of those 4, per the project owner's explicit
// scope decision at this sprint's own kickoff (re-confirming, not assuming,
// Sprint 23's own never-characterize-a-named-individual guarantee, since
// CLAUDE.md names this module "the highest reputational/compliance risk in
// Engine 1"):
//   - Shareholder Alignment — filled DETERMINISTICALLY, zero LLM. Sprint 23's
//     own cited blocker ("insider ownership and share-buyback data... planned
//     for the Tom Nash Enhancement I sprint") was actually resolved by Sprint
//     24, which added insiderOwnershipPct/sharesOutstandingChange5y to
//     Fundamentals and wired them into Investment Quality's own "Insider
//     Ownership"/"Share Dilution / Buybacks" metrics — this module simply
//     never consumed that already-available data until now. Reused directly,
//     the same "reuse, don't duplicate" pattern every other dimension here
//     already follows.
//   - Communication Quality and Long-Term Focus — filled via new, tightly
//     guarded LLM narration (coachLLM.ts's narrateManagementCommunication
//     Quality()/narrateManagementLongTermFocus()) reading the company's OWN
//     already-extracted filing prose (Document Intelligence, Sprint 22/60).
//     There is NO fallback score for either — when the LLM is unavailable,
//     the completion fails, or the individual-characterization guard trips,
//     the dimension is honestly `unavailable`, exactly like every other
//     structurally-blocked dimension, never a fabricated middle score.
//   - Strategic Consistency stays honestly `unavailable` — its blocker is
//     structural, not an LLM-reading gap: it requires comparing strategy
//     across MULTIPLE YEARS of filings, but Document Intelligence only ever
//     fetches the single most recent filing. No amount of LLM reading fixes
//     a data gap that doesn't exist yet; fetching multiple years of filings
//     is a genuinely different, larger capability, explicitly out of this
//     sprint's scope.

import { buildFilingAnalysis, type FilingAnalysis } from "./filingAnalysis.js";
import { buildValueResearchReport } from "./valueReport.js";
import { narrateManagementCommunicationQuality, narrateManagementLongTermFocus } from "./coachLLM.js";
import type { DocumentProvider, DocumentType, FetchDocumentOpts } from "./documentProviders.js";
import type { FundamentalsProvider } from "./fundamentals.js";

export type ManagementQualityConfidenceLevel = "High" | "Moderate" | "Low";

export interface ManagementSourceSection {
  key: string;
  label: string;
  excerpt: string | null;
  sourceUrl: string | null;
}

export interface ManagementQualityDimension {
  dimension: string;
  score: number | null; // 0-100, null when unavailable
  weight: number;
  detail: string;
  reason?: string; // present only when unavailable
  sourceSection?: ManagementSourceSection; // only for dimensions genuinely derived from filing text
}

export interface ManagementQualityAnalysis {
  symbol: string;
  score: number | null;
  dimensions: ManagementQualityDimension[]; // all 9, in the requested order
  strengths: string[];
  weaknesses: string[];
  confidenceLevel: ManagementQualityConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
  disclaimer: string;
}

const DEFERRED_MULTIYEAR_REASON =
  "requires comparing management's stated strategy across multiple years' filings — only the single most recent filing is ingested today, a structural data gap no amount of LLM reading can close";
// Honest fallback reasons for the two LLM-narrated dimensions (Phase 4,
// Sprint 63) — reached whenever there's no filing text to read, the LLM is
// unavailable, the completion fails, or the individual-characterization
// guard trips. There is deliberately no fabricated fallback score for either.
const NO_FILING_TEXT_REASON =
  "requires the company's own filing text (Business/MD&A section), which could not be located or extracted";
const LLM_UNAVAILABLE_REASON =
  "AI narration is not available right now, and this dimension has no deterministic fallback — never a fabricated score";
const NO_INSIDER_DATA_REASON =
  "requires insider ownership and share-buyback data — currently only the SIMULATED provider supplies this; live FMP/Alpha Vantage do not yet";

// Phase 4, Sprint 63 — updated to stay accurate now that Communication
// Quality and Long-Term Focus are genuinely AI-narrated (they were not at
// Sprint 23). The "never a characterization of any individual" guarantee is
// unchanged and re-stated explicitly — the AI narration scores the FILING'S
// OWN disclosure text as an artifact, never a person's competence, honesty,
// or character.
const DISCLAIMER =
  "Educational research only — not investment advice, and not a characterization of any individual executive. Most dimensions are a deterministic composite of already-computed financial/quality signals or the presence and size of the company's own Risk Factors disclosure. Two dimensions (Communication Quality, Long-Term Focus) are AI-narrated from the company's own filing text when available — the AI scores the FILING'S disclosure characteristics only (clarity, specificity, candor, forward-looking detail), never any individual's conduct or character, and is honestly reported unavailable rather than guessed when it cannot be produced safely.";

// Fixed design weights across all 9 dimensions (sum to 1.0, matching
// Investment Quality's/Competitive Advantage's own WEIGHTS convention).
// Applied only to AVAILABLE dimensions and renormalized over their combined
// weight — the 4 always-unavailable dimensions are excluded from the average,
// never penalized twice.
const WEIGHTS = {
  capitalAllocationDiscipline: 1 / 9,
  strategicConsistency: 1 / 9,
  longTermFocus: 1 / 9,
  communicationQuality: 1 / 9,
  riskAcknowledgement: 1 / 9,
  executionDiscipline: 1 / 9,
  shareholderAlignment: 1 / 9,
  transparency: 1 / 9,
  financialStewardship: 1 / 9,
};

function round(x: number): number {
  return Math.round(x);
}
function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

// A company with a substantial, present Risk Factors section has structurally
// disclosed more than one with a missing or token section — measures
// presence/magnitude of disclosure, never a sentiment judgment about candor.
// 500 words ~ a minimal but real Risk Factors section; 3000+ words scores the
// max, consistent with the length real 10-Ks' Risk Factors sections run.
function riskAcknowledgementScore(wordCount: number): number {
  return round(clamp((wordCount / 3000) * 100));
}

const CONFIDENCE_SCORE: Record<ManagementQualityConfidenceLevel, number> = { High: 100, Moderate: 65, Low: 30 };

// Phase 4, Sprint 63 — bounded raw text from an already-extracted filing
// section, for the two LLM-narrated dimensions below. Reuses
// ExtractedSection.rawText (filingExtraction.ts, Sprint 22) directly — no new
// extraction logic. Capped well under the section's own 40,000-char storage
// limit to keep each LLM call's token cost bounded; `null` when the section
// itself wasn't found, never a fabricated excerpt.
const FILING_PROSE_MAX_CHARS = 3000;
function filingProseFor(filing: FilingAnalysis | null, sectionKey: string): string | null {
  const section = filing?.sections.find((s) => s.key === sectionKey);
  if (!section?.found || !section.rawText) return null;
  return section.rawText.slice(0, FILING_PROSE_MAX_CHARS);
}

export async function buildManagementQualityAnalysis(
  symbol: string,
  documentProvider: DocumentProvider,
  fundamentalsProvider: FundamentalsProvider,
  documentType: DocumentType = "10-K",
  opts?: FetchDocumentOpts,
  userId?: string,
): Promise<ManagementQualityAnalysis | null> {
  const report = await buildValueResearchReport(symbol, undefined, fundamentalsProvider, undefined, undefined, userId);
  if (!report) return null;

  const filing: FilingAnalysis | null = await buildFilingAnalysis(
    symbol,
    documentProvider,
    fundamentalsProvider,
    documentType,
    opts,
    userId,
    false, // never a second, duplicate investing_filing_analysis row
  );

  const riskSection = filing?.sections.find((s) => s.key === "riskFactors");
  const dimensions: ManagementQualityDimension[] = [];

  dimensions.push({
    dimension: "Capital Allocation Discipline",
    score: report.tomNash.capitalAllocation.score,
    weight: WEIGHTS.capitalAllocationDiscipline,
    detail: report.tomNash.capitalAllocation.detail,
  });

  dimensions.push({
    dimension: "Strategic Consistency",
    score: null,
    weight: WEIGHTS.strategicConsistency,
    detail: "",
    reason: `Strategic consistency is unavailable — ${DEFERRED_MULTIYEAR_REASON}.`,
  });

  // Phase 4, Sprint 63 — LLM-narrated, reading the filing's own MD&A prose
  // (present for both 10-K and 10-Q). Honestly unavailable — never a
  // fabricated score — when there's no MD&A text to read, the LLM is
  // unavailable, or the narration otherwise couldn't be produced safely.
  const mdAndASection = filing?.sections.find((s) => s.key === "mdAndA");
  const mdAndAProse = filingProseFor(filing, "mdAndA");
  const longTermFocus = mdAndAProse ? await narrateManagementLongTermFocus(mdAndAProse, report.symbol) : null;
  if (longTermFocus) {
    dimensions.push({
      dimension: "Long-Term Focus",
      score: longTermFocus.score,
      weight: WEIGHTS.longTermFocus,
      detail: longTermFocus.detail,
      sourceSection: {
        key: "mdAndA",
        label: "Management Discussion & Analysis",
        excerpt: mdAndASection?.excerpt ?? null,
        sourceUrl: filing?.sourceUrl ?? null,
      },
    });
  } else {
    dimensions.push({
      dimension: "Long-Term Focus",
      score: null,
      weight: WEIGHTS.longTermFocus,
      detail: "",
      reason: `Long-term focus is unavailable — ${mdAndAProse ? LLM_UNAVAILABLE_REASON : NO_FILING_TEXT_REASON}.`,
    });
  }

  // Phase 4, Sprint 63 — LLM-narrated, reading the same MD&A prose. Sprint
  // 23's own text explicitly named this dimension "deliberately deferred
  // pending LLM reading comprehension" — this is that fill.
  const communicationQuality = mdAndAProse
    ? await narrateManagementCommunicationQuality(mdAndAProse, report.symbol)
    : null;
  if (communicationQuality) {
    dimensions.push({
      dimension: "Communication Quality",
      score: communicationQuality.score,
      weight: WEIGHTS.communicationQuality,
      detail: communicationQuality.detail,
      sourceSection: {
        key: "mdAndA",
        label: "Management Discussion & Analysis",
        excerpt: mdAndASection?.excerpt ?? null,
        sourceUrl: filing?.sourceUrl ?? null,
      },
    });
  } else {
    dimensions.push({
      dimension: "Communication Quality",
      score: null,
      weight: WEIGHTS.communicationQuality,
      detail: "",
      reason: `Communication quality is unavailable — ${mdAndAProse ? LLM_UNAVAILABLE_REASON : NO_FILING_TEXT_REASON}.`,
    });
  }

  if (riskSection?.found) {
    const score = riskAcknowledgementScore(riskSection.wordCount);
    dimensions.push({
      dimension: "Risk Acknowledgement",
      score,
      weight: WEIGHTS.riskAcknowledgement,
      detail: `Risk Factors section found (${riskSection.wordCount.toLocaleString()} words extracted).`,
      sourceSection: {
        key: riskSection.key,
        label: riskSection.label,
        excerpt: riskSection.excerpt,
        sourceUrl: filing?.sourceUrl ?? null,
      },
    });
  } else {
    dimensions.push({
      dimension: "Risk Acknowledgement",
      score: null,
      weight: WEIGHTS.riskAcknowledgement,
      detail: "",
      reason: riskSection?.reason ?? "No Risk Factors section could be located in the company's filing.",
    });
  }

  const durability = report.competitiveAdvantage.dimensions.find((d) => d.dimension === "Competitive Durability");
  dimensions.push({
    dimension: "Execution Discipline",
    score: durability?.score ?? null,
    weight: WEIGHTS.executionDiscipline,
    detail: durability?.score != null ? durability.detail : "",
    ...(durability?.score == null ? { reason: durability?.reason ?? "No underlying execution signal was computable." } : {}),
  });

  // Phase 4, Sprint 63 — filled DETERMINISTICALLY (zero LLM), reusing
  // Investment Quality's own already-scored "Insider Ownership"/"Share
  // Dilution / Buybacks" metrics (Sprint 24's insiderOwnershipPct/
  // sharesOutstandingChange5y fields) — never recomputed here. Averaged over
  // whichever of the two are genuinely available, matching every other
  // renormalize-over-availability pattern in this codebase; honestly
  // unavailable when neither metric has real data (e.g. a live FMP/Alpha
  // Vantage provider today, which doesn't supply insiderOwnershipPct).
  const insiderOwnership = report.investmentQuality.metrics.find((m) => m.metric === "Insider Ownership");
  const dilutionBuybacks = report.investmentQuality.metrics.find((m) => m.metric === "Share Dilution / Buybacks");
  const alignmentScores = [insiderOwnership, dilutionBuybacks].filter(
    (m): m is NonNullable<typeof m> & { score: number } => m != null && m.availability === "available" && m.score != null,
  );
  if (alignmentScores.length > 0) {
    const score = round(alignmentScores.reduce((a, m) => a + m.score, 0) / alignmentScores.length);
    const parts = [
      insiderOwnership?.availability === "available"
        ? `Insider Ownership ${insiderOwnership.score}/100 (${insiderOwnership.detail})`
        : "Insider Ownership unavailable",
      dilutionBuybacks?.availability === "available"
        ? `Share Dilution/Buybacks ${dilutionBuybacks.score}/100 (${dilutionBuybacks.detail})`
        : "Share Dilution/Buybacks unavailable",
    ];
    dimensions.push({
      dimension: "Shareholder Alignment",
      score,
      weight: WEIGHTS.shareholderAlignment,
      detail: parts.join("; "),
    });
  } else {
    dimensions.push({
      dimension: "Shareholder Alignment",
      score: null,
      weight: WEIGHTS.shareholderAlignment,
      detail: "",
      reason: `Shareholder alignment is unavailable — ${NO_INSIDER_DATA_REASON}.`,
    });
  }

  // Composite of already-computed confidence/completeness signals — reused,
  // not a new opinion: how much of Investment Quality's and Competitive
  // Advantage's own data was computable, plus how many of the 3 tracked
  // filing sections were successfully extracted.
  const sectionCompleteness = filing ? round((filing.sections.filter((s) => s.found).length / filing.sections.length) * 100) : 0;
  const transparencyInputs = [
    CONFIDENCE_SCORE[report.investmentQuality.confidenceLevel],
    CONFIDENCE_SCORE[report.competitiveAdvantage.confidenceLevel],
    sectionCompleteness,
  ];
  const transparencyScore = round(clamp(transparencyInputs.reduce((a, b) => a + b, 0) / transparencyInputs.length));
  dimensions.push({
    dimension: "Transparency",
    score: transparencyScore,
    weight: WEIGHTS.transparency,
    detail: `Blend of Investment Quality confidence (${report.investmentQuality.confidenceLevel}), Competitive Advantage confidence (${report.competitiveAdvantage.confidenceLevel}), and filing-section completeness (${sectionCompleteness}%).`,
  });

  dimensions.push({
    dimension: "Financial Stewardship",
    score: report.financialStrength.score,
    weight: WEIGHTS.financialStewardship,
    detail: report.financialStrength.summary,
  });

  const available = dimensions.filter(
    (d): d is ManagementQualityDimension & { score: number } => d.score != null,
  );
  const totalWeight = available.reduce((a, d) => a + d.weight, 0);
  const score = totalWeight > 0 ? round(clamp(available.reduce((a, d) => a + d.score * d.weight, 0) / totalWeight)) : null;

  const byScoreDesc = [...available].sort((a, b) => b.score - a.score);
  const byScoreAsc = [...available].sort((a, b) => a.score - b.score);
  const strengths = byScoreDesc
    .filter((d) => d.score >= 70)
    .slice(0, 4)
    .map((d) => `${d.dimension}: ${d.score}/100 — ${d.detail}`);
  const weaknesses = byScoreAsc
    .filter((d) => d.score < 40)
    .slice(0, 4)
    .map((d) => `${d.dimension}: ${d.score}/100 — ${d.detail}`);

  const unavailable = dimensions.filter((d) => d.score == null);
  const availabilityRatio = dimensions.length > 0 ? available.length / dimensions.length : 0;
  let confidenceLevel: ManagementQualityConfidenceLevel = "Low";
  if (availabilityRatio >= 0.95) confidenceLevel = "High";
  else if (availabilityRatio >= 0.8) confidenceLevel = "Moderate";

  const confidenceExplanation =
    unavailable.length === 0
      ? `All ${dimensions.length} management-quality dimensions have usable data for ${report.symbol}.`
      : `${available.length} of ${dimensions.length} dimensions have usable data for ${report.symbol}; ${unavailable.length} (${unavailable.map((d) => d.dimension).join(", ")}) await future data sources.`;

  const summary =
    score != null
      ? `${report.symbol} scores ${score}/100 on management quality across ${available.length} scored dimensions (${confidenceLevel} confidence).`
      : `${report.symbol}: management quality could not be scored — no dimension had usable data.`;

  return {
    symbol: report.symbol,
    score,
    dimensions,
    strengths,
    weaknesses,
    confidenceLevel,
    confidenceExplanation,
    summary,
    disclaimer: DISCLAIMER,
  };
}
