// Phase 2, Sprint 23 — Management Quality Analysis Engine (approved Phase 2
// plan, Sprint 23). Pure composition over already-computed outputs from the
// Document Intelligence Engine (Sprint 22) and buildValueResearchReport()'s
// existing analyzers — mirrors Competitive Advantage's "reuse, don't
// duplicate" pattern.
//
// Deterministic only, per the approved decision: this sprint introduces no
// LLM calls and never generates prose about a named executive — it scores the
// company's management-*process* discipline from numbers and structural
// filing signals, not a reading of anyone's character. 5 of the 9 requested
// dimensions have a genuinely defensible non-fabricating path; the other 4
// (Strategic Consistency, Long-Term Focus, Communication Quality, Shareholder
// Alignment) are honestly `unavailable` — each needs either an LLM reading
// the prose, multi-year filing comparison, R&D/reinvestment data, or insider/
// buyback data this codebase doesn't have yet (the same category of gap
// Investment Quality already disclosed for Share Dilution/Insider Ownership).

import { buildFilingAnalysis, type FilingAnalysis } from "./filingAnalysis.js";
import { buildValueResearchReport } from "./valueReport.js";
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

const DEFERRED_LLM_REASON =
  "requires reading and interpreting the filing's prose (tone, candor, framing) — deliberately deferred; this sprint is deterministic only, per the approved decision not to introduce LLM-generated management opinions yet";
const DEFERRED_MULTIYEAR_REASON =
  "requires comparing management's stated strategy across multiple years' filings — only the single most recent 10-K is ingested today";
const DEFERRED_REINVESTMENT_REASON =
  "requires an R&D/reinvestment-intensity breakdown that isn't published as a distinct line item by any provider today";
const DEFERRED_INSIDER_REASON =
  "requires insider ownership and share-buyback data — the same gap already disclosed for Investment Quality's Share Dilution/Buybacks and Insider Ownership metrics, planned for the Tom Nash Enhancement I sprint";

const DISCLAIMER =
  "Educational research only — not investment advice, and not a characterization of any individual executive. Every scored dimension is a deterministic composite of already-computed financial/quality signals or the presence and size of the company's own Risk Factors disclosure — never an AI-generated opinion about management's conduct or character.";

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

  dimensions.push({
    dimension: "Long-Term Focus",
    score: null,
    weight: WEIGHTS.longTermFocus,
    detail: "",
    reason: `Long-term focus is unavailable — ${DEFERRED_REINVESTMENT_REASON}.`,
  });

  dimensions.push({
    dimension: "Communication Quality",
    score: null,
    weight: WEIGHTS.communicationQuality,
    detail: "",
    reason: `Communication quality is unavailable — ${DEFERRED_LLM_REASON}.`,
  });

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

  dimensions.push({
    dimension: "Shareholder Alignment",
    score: null,
    weight: WEIGHTS.shareholderAlignment,
    detail: "",
    reason: `Shareholder alignment is unavailable — ${DEFERRED_INSIDER_REASON}.`,
  });

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
