// Task #66 — 21-section value-investing research report assembler (Phase 2,
// Sprint 12 added "Graham Valuation"; Sprint 13 added "DCF Valuation";
// Sprint 14 added "Buffett Valuation" and upgraded "Margin of Safety" into a
// cross-model consolidated view; Sprint 15 added "Investment Quality"; Sprint 16
// added "Tom Nash Analysis"; Sprint 17 added "Investment Committee").
//
// Pure + deterministic: composes the SIMULATED fundamentals + the value-investing
// engines into a structured, ordered report. The LLM (coachLLM) only narrates the
// `aiCommentary` prose around these deterministic facts — every number here is the
// source of truth. Advisory / education ONLY; never executes.

import {
  getFundamentalsProvider,
  resolveFundamentals,
  type FetchOpts,
  type Fundamentals,
  type FundamentalsFallback,
  type FundamentalsProvider,
} from "./fundamentals.js";
import { getSnapshot } from "./optionsMath.js";
import {
  analyzeBusinessQuality,
  analyzeFinancialStrength,
  analyzeMoat,
  analyzeStockVsOptions,
  analyzeValuation,
  analyzeValueDecision,
  type BusinessQuality,
  type FinancialStrength,
  type MoatAnalysis,
  type StockVsOptions,
  type Valuation,
  type ValueDecision,
} from "./valueInvesting.js";
import { analyzeGrahamValuation, type GrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation, type DcfValuation } from "./dcfValuation.js";
import { analyzeBuffettValuation, type BuffettValuation } from "./buffettValuation.js";
import { consolidateMarginOfSafety, type ConsolidatedMarginOfSafety } from "./marginOfSafety.js";
import { analyzeInvestmentQuality, type InvestmentQualityAnalysis } from "./investmentQuality.js";
import { analyzeTomNash, type TomNashAnalysis } from "./tomNashEngine.js";
import { synthesizeInvestmentCommittee, type InvestmentCommitteeAnalysis } from "./investmentCommittee.js";

// The standard value-investing disclaimer. Distinct from COACH_DISCLAIMER but the
// LLM narration is still routed through narrate() so COACH_DISCLAIMER is appended.
const VALUE_DISCLAIMER_HEAD =
  "Educational value-investing research only — not investment advice or a recommendation to buy or sell any security. ";
const VALUE_DISCLAIMER_TAIL =
  " This tool does not execute trades, and it is not Warren Buffett or any real person.";

export const VALUE_DISCLAIMER =
  VALUE_DISCLAIMER_HEAD +
  "All fundamentals shown are SIMULATED, not live market data." +
  VALUE_DISCLAIMER_TAIL;

// Live variant: fundamentals are sourced from a real third-party provider.
export const LIVE_VALUE_DISCLAIMER =
  VALUE_DISCLAIMER_HEAD +
  "Fundamentals are sourced from a live third-party data provider and may be delayed, revised, or contain errors." +
  VALUE_DISCLAIMER_TAIL;

function disclaimerFor(dataSource: Fundamentals["dataSource"]): string {
  return dataSource === "SIMULATED" ? VALUE_DISCLAIMER : LIVE_VALUE_DISCLAIMER;
}

export interface ReportSection {
  id: string;
  title: string;
  body: string;
  bullets?: string[];
}

export interface KeyMetric {
  label: string;
  value: string;
}

export interface RiskFlag {
  severity: "low" | "medium" | "high";
  text: string;
}

export interface ValueResearchReport {
  symbol: string;
  name: string;
  kind: Fundamentals["kind"];
  asOf: string;
  // When the underlying fundamentals were actually fetched/computed (ISO-8601).
  // For LIVE data this is preserved across the 15-minute cache, so it reflects true
  // data age rather than the time of this request.
  fetchedAt: string;
  dataSource: Fundamentals["dataSource"];
  simulated: boolean;
  // Present only when a live fetch was attempted but failed/empty and the report
  // fell back to simulated data (drives the "live unavailable" UI banner).
  fallback?: FundamentalsFallback;
  price: number;
  // Denormalised headline ratings (also used for persistence / history rows).
  businessQuality: BusinessQuality;
  investmentQuality: InvestmentQualityAnalysis;
  moat: MoatAnalysis;
  financialStrength: FinancialStrength;
  valuation: Valuation;
  grahamValuation: GrahamValuation;
  dcfValuation: DcfValuation;
  buffettValuation: BuffettValuation;
  consolidatedMarginOfSafety: ConsolidatedMarginOfSafety;
  tomNash: TomNashAnalysis;
  investmentCommittee: InvestmentCommitteeAnalysis;
  decision: ValueDecision;
  stockVsOptions: StockVsOptions;
  keyMetrics: KeyMetric[];
  risks: RiskFlag[];
  sections: ReportSection[];
  disclaimer: string;
}

function pct(x: number, dp = 0): string {
  return `${(x * 100).toFixed(dp)}%`;
}
function money(x: number): string {
  return `$${x.toFixed(2)}`;
}

function buffettChecklist(
  f: Fundamentals,
  bq: BusinessQuality,
  moat: MoatAnalysis,
  fin: FinancialStrength,
  val: Valuation,
): string[] {
  const tick = (ok: boolean) => (ok ? "✓" : "✗");
  return [
    `${tick(f.kind === "stock")} Understandable business within a circle of competence`,
    `${tick(moat.rating !== "None")} Durable competitive advantage (moat: ${moat.rating})`,
    `${tick(f.roic >= 0.15)} High returns on capital (ROIC ${pct(f.roic)})`,
    `${tick(fin.rating === "Strong" || fin.rating === "Acceptable")} Conservative balance sheet (${fin.rating})`,
    `${tick(f.fcfPositiveYears >= 8)} Consistent owner earnings / free cash flow`,
    `${tick(val.available && val.marginOfSafety >= 0.15)} Bought with a margin of safety`,
  ];
}

// `provider` lets a caller drive the report through a specific FundamentalsProvider
// (e.g. a live FMP/AlphaVantage provider selected from Settings). When omitted, the
// default provider is resolved (simulated unless a live API key is configured).
//
// `fundamentalsOverride` is a test/future seam: it lets a caller drive the whole
// report pipeline (including the honest `available: false` valuation branch the UI
// renders as "Fair value unavailable") from a supplied snapshot, bypassing the
// provider — which today always returns profitable inputs for the 10 covered
// SIMULATED symbols. A future live provider that surfaces an unprofitable name flows
// through the same path. When both are omitted, the default provider is used.
export async function buildValueResearchReport(
  symbol: string,
  asOf?: string,
  provider?: FundamentalsProvider,
  fundamentalsOverride?: Fundamentals,
  opts?: FetchOpts,
  userId?: string,
): Promise<ValueResearchReport | null> {
  const f =
    fundamentalsOverride ??
    (await resolveFundamentals(provider ?? (await getFundamentalsProvider(userId)), symbol, asOf, opts));
  if (!f) return null;
  const sim = f.dataSource === "SIMULATED";
  const dataLabel = sim ? "SIMULATED" : "live";
  const snap = getSnapshot(f.symbol, f.asOf);

  const bq = analyzeBusinessQuality(f);
  const iq = analyzeInvestmentQuality(f);
  const moat = analyzeMoat(f);
  const fin = analyzeFinancialStrength(f);
  const val = analyzeValuation(f);
  const graham = analyzeGrahamValuation(f);
  const dcf = analyzeDcfValuation(f);
  const buffett = analyzeBuffettValuation(f, bq, moat);
  const consolidatedMoS = consolidateMarginOfSafety(f.price, [
    { model: "Blended", result: val },
    { model: "Graham", result: graham },
    { model: "DCF", result: dcf },
    { model: "Buffett", result: buffett },
  ]);
  const tomNash = analyzeTomNash(f, iq, fin, val, graham, dcf, buffett);
  const investmentCommittee = synthesizeInvestmentCommittee(graham, buffett, tomNash);
  const decision = analyzeValueDecision(f, bq, moat, fin, val);
  const svo = analyzeStockVsOptions(f, bq, moat, val, snap);

  const keyMetrics: KeyMetric[] = [
    { label: "Price", value: money(f.price) },
    { label: "P/E (fwd)", value: f.forwardPe != null ? `${f.forwardPe}` : "n/a" },
    { label: "PEG", value: f.peg != null ? `${f.peg}` : "n/a" },
    { label: "P/S", value: f.ps != null ? `${f.ps}` : "n/a" },
    { label: "P/B", value: f.pb != null ? `${f.pb}` : "n/a" },
    { label: "FCF yield", value: f.fcfYield != null ? pct(f.fcfYield, 1) : "n/a" },
    { label: "Dividend yield", value: pct(f.dividendYield, 2) },
    { label: "ROIC", value: pct(f.roic) },
    { label: "ROE", value: pct(f.roe) },
    { label: "Net margin", value: pct(f.netMargin) },
    { label: "Rev growth (5y)", value: pct(f.revenueGrowth5y) },
    { label: "EPS growth (5y)", value: pct(f.epsGrowth5y) },
    { label: "Debt/Equity", value: f.debtToEquity.toFixed(2) },
    { label: "Interest coverage", value: f.interestCoverage >= 100 ? "100×+" : `${f.interestCoverage.toFixed(0)}×` },
  ];

  const risks: RiskFlag[] = [];
  for (const flag of fin.flags) risks.push({ severity: "high", text: flag });
  if (val.available && val.marginOfSafety <= -0.1)
    risks.push({ severity: "medium", text: `Trades above fair value (${pct(val.marginOfSafety)} margin of safety).` });
  if (!val.available)
    risks.push({ severity: "medium", text: "Intrinsic value cannot be reliably estimated from current inputs." });
  if (f.kind === "etf")
    risks.push({ severity: "low", text: "Diversified fund — single-stock moat analysis does not apply." });
  if (snap?.earningsInDays != null && snap.earningsInDays <= 21)
    risks.push({ severity: "low", text: `Earnings in ~${snap.earningsInDays} days may add near-term volatility (not a long-term concern).` });
  if (risks.length === 0) risks.push({ severity: "low", text: `No major red flags detected in the ${dataLabel} fundamentals.` });

  const sections: ReportSection[] = [
    {
      id: "snapshot",
      title: "1. Snapshot",
      body: `${f.name} (${f.symbol}) — ${f.kind === "etf" ? "diversified fund" : "operating company"}. Trading at ${money(f.price)} as of ${f.asOf}. Data source: ${f.dataSource}.`,
      bullets: [`Headline verdict: ${decision.verdict}`, `Valuation: ${val.available ? val.rating : "unavailable"}`, `Moat: ${moat.rating}`],
    },
    {
      id: "business",
      title: "2. Business Overview",
      body:
        f.kind === "etf"
          ? `${f.name} is a passive basket providing diversified exposure. Value analysis treats it as a blended portfolio rather than a single enterprise.`
          : `${f.name} generates ${pct(f.netMargin)} net margins on ${pct(f.revenueGrowth5y)} five-year revenue growth, converting roughly ${pct(f.fcfMargin)} of sales into free cash flow.`,
    },
    {
      id: "quality",
      title: "3. Business Quality",
      body: bq.summary,
      bullets: bq.factors.map((x) => `${x.label}: ${x.score}/100 — ${x.detail}`),
    },
    {
      id: "investment-quality",
      title: "4. Investment Quality",
      body: iq.summary,
      bullets: iq.metrics.map((m) =>
        m.availability === "available"
          ? `${m.metric}: ${m.score}/100 — ${m.detail}`
          : `${m.metric}: unavailable — ${m.reason}`,
      ),
    },
    {
      id: "moat",
      title: "5. Economic Moat",
      body: moat.summary,
      bullets: moat.sources.length ? moat.sources.map((s) => `${s.source}: ${s.strength}/100`) : ["No qualifying moat sources above threshold."],
    },
    {
      id: "financial",
      title: "6. Financial Strength",
      body: fin.summary,
      bullets: fin.metrics.map((m) => `${m.label}: ${m.score}/100 — ${m.detail}`),
    },
    {
      id: "profitability",
      title: "7. Profitability & Returns on Capital",
      body: `Returns on capital are the clearest quality signal. ${f.symbol} earns ${pct(f.roic)} ROIC and ${pct(f.roe)} ROE on ${pct(f.grossMargin)} gross / ${pct(f.operatingMargin)} operating margins.`,
    },
    {
      id: "growth",
      title: "8. Growth",
      body: `Five-year revenue CAGR ${pct(f.revenueGrowth5y)}, EPS CAGR ${pct(f.epsGrowth5y)}; forward revenue growth estimated at ${pct(f.revenueGrowthFwd)}.`,
    },
    {
      id: "valuation",
      title: "9. Valuation & Fair Value",
      body: val.summary,
      bullets: val.available ? val.methods.map((m) => `${m.method}: ${money(m.fairValue)} — ${m.detail}`) : [val.reason],
    },
    {
      id: "graham-valuation",
      title: "10. Graham Valuation",
      body: graham.summary,
      bullets: graham.available ? graham.methods.map((m) => `${m.method}: ${money(m.fairValue)} — ${m.detail}`) : [graham.reason],
    },
    {
      id: "dcf-valuation",
      title: "11. DCF Valuation",
      body: dcf.summary,
      bullets: dcf.available
        ? [...dcf.methods.map((m) => `${m.method}: ${money(m.fairValue)} — ${m.detail}`), dcf.confidenceExplanation]
        : [dcf.reason],
    },
    {
      id: "buffett-valuation",
      title: "12. Buffett Valuation",
      body: buffett.summary,
      bullets: buffett.available ? buffett.methods.map((m) => `${m.method}: ${money(m.fairValue)} — ${m.detail}`) : [buffett.reason],
    },
    {
      id: "margin-of-safety",
      title: "13. Margin of Safety",
      body: consolidatedMoS.summary,
      bullets: consolidatedMoS.fairValues.map((mv) => `${mv.model}: ${money(mv.fairValue)}`),
    },
    {
      id: "tom-nash",
      title: "14. Tom Nash Analysis",
      body: tomNash.summary,
      bullets: tomNash.rationale,
    },
    {
      id: "investment-committee",
      title: "15. Investment Committee",
      body: investmentCommittee.summary,
      bullets: investmentCommittee.reasoning,
    },
    {
      id: "risks",
      title: "16. Risks & Red Flags",
      body: `Key risks identified in the ${dataLabel} fundamentals:`,
      bullets: risks.map((r) => `[${r.severity.toUpperCase()}] ${r.text}`),
    },
    {
      id: "decision",
      title: "17. Value-Investor Decision",
      body: decision.summary,
      bullets: decision.rationale,
    },
    {
      id: "stock-vs-options",
      title: "18. Stock vs. Options",
      body: svo.summary,
      bullets: [svo.stockCase, svo.optionsCase],
    },
    {
      id: "checklist",
      title: "19. Buffett Checklist",
      body: "A wonderful business at a fair price, bought with a margin of safety:",
      bullets: buffettChecklist(f, bq, moat, fin, val),
    },
    {
      id: "metrics",
      title: "20. Key Metrics",
      body: `Headline ${dataLabel} metrics (see full table in the UI).`,
      bullets: keyMetrics.map((m) => `${m.label}: ${m.value}`),
    },
    {
      id: "disclaimer",
      title: "21. Disclaimers & Data Source",
      body: disclaimerFor(f.dataSource),
      bullets: [`Data source: ${f.dataSource}`, `As of: ${f.asOf}`],
    },
  ];

  return {
    symbol: f.symbol,
    name: f.name,
    kind: f.kind,
    asOf: f.asOf,
    fetchedAt: f.fetchedAt,
    dataSource: f.dataSource,
    simulated: sim,
    ...(f.fallback ? { fallback: f.fallback } : {}),
    price: f.price,
    businessQuality: bq,
    investmentQuality: iq,
    moat,
    financialStrength: fin,
    valuation: val,
    grahamValuation: graham,
    dcfValuation: dcf,
    buffettValuation: buffett,
    consolidatedMarginOfSafety: consolidatedMoS,
    tomNash,
    investmentCommittee,
    decision,
    stockVsOptions: svo,
    keyMetrics,
    risks,
    sections,
    disclaimer: disclaimerFor(f.dataSource),
  };
}
