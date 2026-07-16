// Phase 2, Sprint 16 — Tom Nash Investment Engine, Core (approved Phase 2 plan,
// Sprint 16 after the roadmap's post-Sprint-15 renumbering).
//
// A COMPOSITION layer, not a replacement for any existing valuation engine — every
// pillar either directly reuses an already-computed analyzer output or re-aggregates
// already-scored sub-metrics. Nothing here recomputes a fundamental ratio, refetches
// data, or duplicates a scoring formula that already exists elsewhere:
//
//  - Business Quality  -> the Investment Quality Engine's own overall score (Sprint 15),
//                          reused whole, not partitioned.
//  - Growth             -> renormalized average of the Investment Quality Engine's own
//                          Revenue/EPS/FCF Growth metric scores (same scored objects,
//                          just re-aggregated over a subset).
//  - Capital Allocation  -> renormalized average of Cash Position / Debt Levels /
//                          Return on Invested Capital (relabeled "Capital efficiency"
//                          for this engine's own display) / Share Dilution-Buybacks /
//                          Insider Ownership, all from the same Investment Quality
//                          metrics — whichever are available are averaged in, exactly
//                          like Investment Quality's own internal renormalization
//                          discipline. Phase 2, Sprint 24 extended this list to include
//                          the last two once Investment Quality could score them; the
//                          pillar's score is unchanged wherever those two remain
//                          unavailable (e.g. Alpha Vantage, or FMP's insider-ownership
//                          percentage specifically). A company's own aggregate net
//                          insider-activity direction ("buying"/"selling"/"neutral"),
//                          when known, is surfaced as descriptive text only — never
//                          scored on its own, never a per-transaction or named-
//                          individual claim.
//  - Financial Strength  -> analyzeFinancialStrength()'s own score, called through.
//  - Valuation           -> the ONE genuinely new piece of logic: no existing code
//                          exposes a 0-100 valuation score (only categorical ratings +
//                          raw margin-of-safety fractions), so a small rating->score
//                          bucket table is applied to whichever of Blended/Graham/DCF/
//                          Buffett are available, reusing their already-computed
//                          `rating` field (itself produced by the shared
//                          classifyMarginOfSafety()). Deliberately isolated inside this
//                          module so it can be refined later without touching Graham/
//                          DCF/Buffett/Investment Quality.
//
// Explicitly, deliberately NOT in Sprint 16 (see the approved Phase 2 plan's Tom Nash
// Enhancement I/II sprints): macro/interest-rate/sector-rotation/AI-cycle analysis,
// filing ingestion. (Insider-ownership scoring was added in Sprint 24, once
// Investment Quality could honestly compute it — see the Capital Allocation note
// above.)
//
// Phase 2, Sprint 26 (Tom Nash Enhancement II) added the remaining three
// capabilities — Sector & Macro, Interest Rate Sensitivity, AI/Tech-Cycle —
// per three approved decisions: (1) all three are INFORMATIONAL, surfaced in
// the output and this analyst's rationale/report section but never entered
// into PILLAR_WEIGHTS/the conviction-score average, so convictionScore/verdict
// are byte-identical to the pre-Sprint-26 formula for every existing symbol;
// (2) AI/Tech-Cycle stays deterministic-only (a structural composite of
// already-known qualitative/financial signals) — no real LLM-generated
// commentary this sprint; (3) the macro/rate-regime signal is a new,
// self-contained SIMULATED proxy (investingMacro.ts), not a read of the
// Options Engine's marketBriefing.ts/optionsMath.ts. A new `dataCompleteness`
// field (fraction of all 8 dimensions — the original 5 core pillars plus
// these 3 — that had real data) is a genuinely new signal this sprint feeds
// to the Investment Committee (Sprint 17) for its own confidence-weighting
// refinement; see investmentCommittee.ts's own Sprint 26 note.
//
// Output shape ({verdict, convictionScore, rationale, summary}) deliberately mirrors
// the {verdict, conviction, rationale, summary} contract every other analyst in this
// engine already produces, so a future AI Investment Committee (Sprint 17) can treat
// Tom Nash as one more voting member via the same structural pattern.

import type { Fundamentals } from "./fundamentals.js";
import type { FinancialStrength, Valuation } from "./valueInvesting.js";
import type { InvestmentQualityAnalysis, QualityMetricScore } from "./investmentQuality.js";
import type { GrahamValuation } from "./grahamValuation.js";
import type { DcfValuation } from "./dcfValuation.js";
import type { BuffettValuation } from "./buffettValuation.js";
import { buildMacroContext, type MacroContext } from "./investingMacro.js";

function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

export type TomNashVerdict = "Buy" | "Hold" | "Wait";

export interface TomNashPillarScore {
  label: string;
  score: number | null; // 0-100, null only when nothing behind the pillar is available
  detail: string;
}

// Phase 2, Sprint 26 — informational only (see the module doc comment's
// Sprint 26 note): never enters PILLAR_WEIGHTS/convictionScore.
export interface SectorMacroContext {
  sector: string | null; // null when the provider doesn't classify the symbol (e.g. some ETFs)
  industry: string | null;
  macroRegime: MacroContext["regime"];
  macroRegimeLabel: string;
  detail: string;
}

// A structural "duration" proxy from already-known Fundamentals fields (growth,
// forward P/E, dividend yield, leverage) — never a real fixed-income-style
// duration calculation, just an illustrative composite.
export interface RateSensitivityAnalysis {
  durationScore: number; // 0-100, 100 = most long-duration/growth-sensitive
  classification: "Long-Duration Growth" | "Value / Short-Duration" | "Blend";
  sensitivityLabel: string;
  detail: string;
}

// Deterministic structural proxy only (approved Sprint 26 decision) — never a
// real LLM-generated claim about the company's actual AI/technology strategy.
export interface AiTechCycleAnalysis {
  score: number; // 0-100
  label: "High" | "Moderate" | "Low";
  detail: string;
}

export interface TomNashAnalysis {
  businessQuality: TomNashPillarScore;
  growth: TomNashPillarScore;
  capitalAllocation: TomNashPillarScore;
  financialStrength: TomNashPillarScore;
  valuation: TomNashPillarScore;
  sectorMacro: SectorMacroContext;
  rateSensitivity: RateSensitivityAnalysis;
  aiTechCycle: AiTechCycleAnalysis;
  dataCompleteness: number; // 0-1, fraction of all 8 dimensions above with real data (Sprint 26)
  convictionScore: number; // 0-100
  verdict: TomNashVerdict;
  rationale: string[];
  summary: string;
}

// Approved Sprint 16 default: equal weighting across all 5 pillars. Kept as its own
// named constant (rather than inlined) so a later Tom Nash enhancement sprint can
// recalibrate weighting without touching the aggregation logic itself.
const PILLAR_WEIGHTS = {
  businessQuality: 0.2,
  growth: 0.2,
  capitalAllocation: 0.2,
  financialStrength: 0.2,
  valuation: 0.2,
} as const;

// Approved Sprint 16 thresholds — recalibratable later using real-world performance
// data without changing the conviction-score math itself.
const BUY_THRESHOLD = 70;
const HOLD_THRESHOLD = 45;

// Isolated inside this module per the approved Sprint 16 decision: no existing code
// exposes a 0-100 valuation score, only categorical ratings. Refining this mapping
// later never touches Graham/DCF/Buffett/the blended model's own computation.
// Exported (Phase 2, Sprint 17) so the AI Investment Committee reuses the exact same
// rating->score table for Graham's/Buffett's own Committee vote confidence, instead
// of a second, duplicated mapping.
export const VALUATION_RATING_SCORE: Record<string, number> = {
  Cheap: 100,
  Fair: 65,
  Expensive: 35,
  "Very Expensive": 0,
};

function findMetric(metrics: QualityMetricScore[], name: string): QualityMetricScore {
  const m = metrics.find((x) => x.metric === name);
  if (!m) throw new Error(`Investment Quality metric not found: ${name}`);
  return m;
}

// Renormalized average over whichever of the named metrics have usable data —
// mirrors Investment Quality's own "exclude, don't penalize" discipline for
// unavailable metrics. Returns null only when none of the named metrics are available.
function averageMetrics(metrics: QualityMetricScore[], names: string[]): number | null {
  const selected = names.map((n) => findMetric(metrics, n)).filter((m) => m.availability === "available" && m.score != null);
  if (selected.length === 0) return null;
  const totalWeight = selected.reduce((a, m) => a + m.weight, 0);
  return round(selected.reduce((a, m) => a + (m.score as number) * m.weight, 0) / totalWeight);
}

function growthPillar(iq: InvestmentQualityAnalysis): TomNashPillarScore {
  const score = averageMetrics(iq.metrics, ["Revenue Growth", "EPS Growth", "Free Cash Flow Growth"]);
  const rg = findMetric(iq.metrics, "Revenue Growth");
  const eg = findMetric(iq.metrics, "EPS Growth");
  const fg = findMetric(iq.metrics, "Free Cash Flow Growth");
  const parts = [rg, eg, fg].map((m) => (m.availability === "available" ? `${m.metric} ${m.score}/100` : `${m.metric} unavailable`));
  return {
    label: "Growth",
    score,
    detail: parts.join("; "),
  };
}

function capitalAllocationPillar(f: Fundamentals, iq: InvestmentQualityAnalysis): TomNashPillarScore {
  // Phase 2, Sprint 24 — extended from the Sprint 16 3-metric average to include
  // Share Dilution/Buybacks and Insider Ownership now that Investment Quality can
  // score them for providers that supply the data; still a plain renormalized
  // average over whichever are available, so the score is unchanged for a company
  // whose provider leaves the new fields null.
  const score = averageMetrics(iq.metrics, [
    "Cash Position",
    "Debt Levels",
    "Return on Invested Capital",
    "Share Dilution / Buybacks",
    "Insider Ownership",
  ]);
  const cash = findMetric(iq.metrics, "Cash Position");
  const debt = findMetric(iq.metrics, "Debt Levels");
  const roic = findMetric(iq.metrics, "Return on Invested Capital");
  const dilution = findMetric(iq.metrics, "Share Dilution / Buybacks");
  const insider = findMetric(iq.metrics, "Insider Ownership");
  const parts = [
    `Cash Position ${cash.score}/100`,
    `Debt Levels ${debt.score}/100`,
    `Capital efficiency (ROIC) ${roic.score}/100`,
    dilution.availability === "available" ? `Share Dilution/Buybacks ${dilution.score}/100` : "Share Dilution/Buybacks unavailable",
    insider.availability === "available" ? `Insider Ownership ${insider.score}/100` : "Insider Ownership unavailable",
  ];
  // Descriptive only — never scored, never a per-transaction or named-individual claim.
  if (f.netInsiderActivity != null) {
    parts.push(`recent aggregate insider activity: ${f.netInsiderActivity}`);
  }
  return {
    label: "Capital Allocation",
    score,
    detail: parts.join("; "),
  };
}

function financialStrengthPillar(fin: FinancialStrength): TomNashPillarScore {
  return {
    label: "Financial Strength",
    score: fin.score,
    detail: `${fin.rating} (${fin.score}/100)`,
  };
}

// Deterministic, hand-curated notes on how each sector typically responds to
// a rate cycle — categorical commentary, not a fabricated financial figure,
// the same discipline industryPeers.ts's KNOWN_SECTOR_PROFILES already uses
// for real sector/industry classification.
const SECTOR_RATE_NOTES: Partial<Record<string, string>> = {
  Technology:
    "growth-oriented sectors like Technology often see valuation compression when rates rise, since more of their value comes from distant future cash flows.",
  "Communication Services":
    "Communication Services spans both growth (media/streaming) and defensive (telecom) sub-industries with mixed rate sensitivity.",
  "Consumer Discretionary":
    "Consumer Discretionary can be sensitive to rates both through valuation duration and consumer-credit costs.",
  "Consumer Staples":
    "defensive sectors like Consumer Staples tend to be less sensitive to rate cycles than growth-oriented sectors.",
  "Financial Services":
    "Financial Services can benefit from rising rates via wider net interest margins, though this varies by business mix.",
  "Health Care":
    "Health Care's rate sensitivity varies widely by sub-industry (biotech vs. established pharma).",
  Industrials:
    "Industrials' rate sensitivity is typically moderate, tied more to capex/credit cycles than valuation duration.",
  Energy: "Energy is typically driven more by commodity cycles than by interest-rate cycles.",
  Utilities:
    "income-oriented sectors like Utilities are typically rate-sensitive: their dividend yields compete directly with rising bond yields.",
  "Real Estate":
    "Real Estate (especially REITs) is typically among the most rate-sensitive sectors, both through financing costs and yield-competition with bonds.",
  Diversified: "a diversified sector classification carries no single rate-sensitivity profile.",
};

function sectorMacroPillar(f: Fundamentals, macro: MacroContext): SectorMacroContext {
  const sectorNote = f.sector
    ? (SECTOR_RATE_NOTES[f.sector] ?? `no specific rate-sensitivity note is available for the ${f.sector} sector.`)
    : "sector is unknown for this symbol, so no sector-specific macro note is available.";
  const detail = `${f.sector ?? "Unknown sector"}${f.industry ? ` / ${f.industry}` : ""} in a ${macro.regimeLabel.toLowerCase()}: ${sectorNote}`;
  return {
    sector: f.sector,
    industry: f.industry,
    macroRegime: macro.regime,
    macroRegimeLabel: macro.regimeLabel,
    detail,
  };
}

// Structural "duration" proxy — never a real fixed-income-style duration
// calculation. Higher growth, higher forward P/E, lower dividend yield, and
// more leverage all push the score toward "long-duration growth" (more of the
// company's value sits in distant cash flows, so it's illustratively more
// sensitive to discount-rate/rate-cycle changes).
function rateSensitivityPillar(f: Fundamentals, macro: MacroContext): RateSensitivityAnalysis {
  const growthComponent = clamp((f.revenueGrowth5y / 0.25) * 100);
  const peComponent = f.forwardPe != null && f.forwardPe > 0 ? clamp((f.forwardPe / 40) * 100) : 50;
  const yieldComponent = clamp(100 - (f.dividendYield / 0.04) * 100);
  const leverageComponent = clamp((f.debtToEquity / 1.5) * 100);
  const durationScore = round(
    growthComponent * 0.4 + peComponent * 0.3 + yieldComponent * 0.2 + leverageComponent * 0.1,
  );

  const classification: RateSensitivityAnalysis["classification"] =
    durationScore >= 65 ? "Long-Duration Growth" : durationScore <= 35 ? "Value / Short-Duration" : "Blend";

  let sensitivityLabel: string;
  if (macro.regime === "rising_rates") {
    sensitivityLabel =
      classification === "Long-Duration Growth"
        ? "High sensitivity to rising rates"
        : classification === "Value / Short-Duration"
          ? "Low sensitivity to rising rates"
          : "Moderate sensitivity to rising rates";
  } else if (macro.regime === "falling_rates") {
    sensitivityLabel =
      classification === "Long-Duration Growth"
        ? "Likely beneficiary of falling rates"
        : classification === "Value / Short-Duration"
          ? "Limited benefit from falling rates"
          : "Moderate benefit from falling rates";
  } else {
    sensitivityLabel = "Rate-neutral environment — sensitivity muted regardless of classification";
  }

  const detail =
    `${classification} (duration score ${durationScore}/100) in a ${macro.regimeLabel.toLowerCase()} — ${sensitivityLabel}. ` +
    "Illustrative structural proxy from growth/valuation/yield/leverage — not a real fixed-income-style duration calculation.";

  return { durationScore, classification, sensitivityLabel, detail };
}

// Deterministic structural proxy only (approved Sprint 26 decision) — blends
// already-known qualitative/financial signals that correlate with a
// tech/IP-driven business model. Never a claim about the company's actual AI
// strategy, product roadmap, or technology adoption.
function aiTechCyclePillar(f: Fundamentals): AiTechCycleAnalysis {
  const q = f.qualitative;
  const marginComponent = clamp((f.grossMargin / 0.7) * 100);
  const growthComponent = clamp((f.revenueGrowth5y / 0.25) * 100);
  const score = round(
    q.ipStrength * 0.3 + q.pricingPower * 0.2 + q.recurringRevenue * 0.2 + marginComponent * 0.15 + growthComponent * 0.15,
  );
  const label: AiTechCycleAnalysis["label"] = score >= 65 ? "High" : score >= 40 ? "Moderate" : "Low";
  const detail =
    `${label} structural AI/technology-cycle positioning proxy (${score}/100) — derived from IP strength, pricing power, ` +
    "recurring revenue, gross margin, and growth; a quantitative composite of already-known signals, not an assessment " +
    "of the company's actual AI/technology strategy or roadmap.";
  return { score, label, detail };
}

interface RatedModel {
  name: string;
  available: boolean;
  rating?: string;
}

function valuationPillar(
  blended: Valuation,
  graham: GrahamValuation,
  dcf: DcfValuation,
  buffett: BuffettValuation,
): TomNashPillarScore {
  const models: RatedModel[] = [
    { name: "Blended", available: blended.available, rating: blended.available ? blended.rating : undefined },
    { name: "Graham", available: graham.available, rating: graham.available ? graham.rating : undefined },
    { name: "DCF", available: dcf.available, rating: dcf.available ? dcf.rating : undefined },
    { name: "Buffett", available: buffett.available, rating: buffett.available ? buffett.rating : undefined },
  ];
  const rated = models.filter((m): m is RatedModel & { rating: string } => m.available && m.rating != null);

  if (rated.length === 0) {
    return {
      label: "Valuation",
      score: null,
      detail: "Valuation score unavailable — no valuation model produced a usable estimate.",
    };
  }

  const score = round(rated.reduce((a, m) => a + VALUATION_RATING_SCORE[m.rating], 0) / rated.length);
  const detail = rated.map((m) => `${m.name}: ${m.rating}`).join("; ");
  return { label: "Valuation", score, detail };
}

export function analyzeTomNash(
  f: Fundamentals,
  iq: InvestmentQualityAnalysis,
  fin: FinancialStrength,
  blended: Valuation,
  graham: GrahamValuation,
  dcf: DcfValuation,
  buffett: BuffettValuation,
  // Phase 2, Sprint 26 — optional; defaults to a deterministic proxy seeded by
  // this Fundamentals snapshot's own `asOf` date when omitted, so every
  // existing call site keeps working unmodified and two calls against the
  // same `f` are still byte-identical (same default macro context both times).
  macro: MacroContext = buildMacroContext(f.asOf),
): TomNashAnalysis {
  const businessQuality: TomNashPillarScore = {
    label: "Business Quality",
    score: iq.score,
    detail: iq.summary,
  };
  const growth = growthPillar(iq);
  const capitalAllocation = capitalAllocationPillar(f, iq);
  const financialStrength = financialStrengthPillar(fin);
  const valuation = valuationPillar(blended, graham, dcf, buffett);
  const sectorMacro = sectorMacroPillar(f, macro);
  const rateSensitivity = rateSensitivityPillar(f, macro);
  const aiTechCycle = aiTechCyclePillar(f);

  // Sprint 26's 3 new dimensions are informational only — never entered here,
  // so convictionScore/verdict are byte-identical to the pre-Sprint-26 formula.
  const pillars = [
    { pillar: businessQuality, weight: PILLAR_WEIGHTS.businessQuality },
    { pillar: growth, weight: PILLAR_WEIGHTS.growth },
    { pillar: capitalAllocation, weight: PILLAR_WEIGHTS.capitalAllocation },
    { pillar: financialStrength, weight: PILLAR_WEIGHTS.financialStrength },
    { pillar: valuation, weight: PILLAR_WEIGHTS.valuation },
  ];
  const available = pillars.filter((p) => p.pillar.score != null);
  const totalWeight = available.reduce((a, p) => a + p.weight, 0);
  const convictionScore =
    totalWeight > 0
      ? round(available.reduce((a, p) => a + (p.pillar.score as number) * p.weight, 0) / totalWeight)
      : 0;

  let verdict: TomNashVerdict;
  if (convictionScore >= BUY_THRESHOLD) verdict = "Buy";
  else if (convictionScore >= HOLD_THRESHOLD) verdict = "Hold";
  else verdict = "Wait";

  // Phase 2, Sprint 26 — fraction of all 8 dimensions (the 5 core pillars
  // plus Sector & Macro / Rate Sensitivity / AI-Tech-Cycle) that had real
  // data. Rate Sensitivity and AI/Tech-Cycle are always computable from
  // always-present Fundamentals fields; Sector & Macro is honestly
  // unavailable only when the provider doesn't classify the symbol's sector
  // (e.g. some ETFs). Fed to the Investment Committee (Sprint 17) for its own
  // confidence-weighting refinement.
  const completenessSlots = [
    ...pillars.map((p) => p.pillar.score != null),
    sectorMacro.sector != null,
    true,
    true,
  ];
  const dataCompleteness = round(
    completenessSlots.filter(Boolean).length / completenessSlots.length,
    4,
  );

  const rationale: string[] = [
    `Business Quality: ${businessQuality.score}/100 (Investment Quality Engine).`,
    `Growth: ${growth.score != null ? `${growth.score}/100` : "unavailable"} — ${growth.detail}.`,
    `Capital Allocation: ${capitalAllocation.score != null ? `${capitalAllocation.score}/100` : "unavailable"} — ${capitalAllocation.detail}.`,
    `Financial Strength: ${financialStrength.score}/100 (${fin.rating}).`,
    `Valuation: ${valuation.score != null ? `${valuation.score}/100` : "unavailable"} — ${valuation.detail}.`,
    `Sector & Macro (informational): ${sectorMacro.detail}`,
    `Interest Rate Sensitivity (informational): ${rateSensitivity.detail}`,
    `AI & Technology-Cycle (informational, structural proxy): ${aiTechCycle.detail}`,
  ];

  const etfCaveat =
    f.kind === "etf"
      ? " As a diversified fund, these pillar scores reflect the fund's blended holdings rather than a single business."
      : "";
  const summary =
    `${f.symbol}: ${verdict} (conviction ${convictionScore}/100), composed from Business Quality, Growth, ` +
    `Capital Allocation, Financial Strength, and Valuation.${etfCaveat} Sector & Macro, Interest Rate Sensitivity, ` +
    "and AI/Tech-Cycle context are also surfaced below (informational, not scored into conviction).";

  return {
    businessQuality,
    growth,
    capitalAllocation,
    financialStrength,
    valuation,
    sectorMacro,
    rateSensitivity,
    aiTechCycle,
    dataCompleteness,
    convictionScore,
    verdict,
    rationale,
    summary,
  };
}
