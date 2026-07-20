// Phase 26 — Institutional Market Structure Workbench.
//
// Pure, I/O-free display-state labeling — zero new scores, zero new
// probabilities. The Market Structure Engine itself only ever classifies 3
// trend states (uptrend/downtrend/range) plus a 3-tier confidence level; the
// Multi-Timeframe Engine only ever reports an honest agreement signal
// (unanimous/majority/split/insufficient-data) and an honest dominant trend
// (nullable). This module maps those ALREADY-COMPUTED enums onto the 5
// display labels the Workbench needs (Bullish/Bearish/Range/Transition/
// Unclear-Insufficient-Data) — it never invents a new classification
// formula, only relabels existing, real signals for presentation.
export type StructureDisplayState = "Bullish" | "Bearish" | "Range" | "Transition" | "Unclear / Insufficient Data";

// Single-timeframe display state: "Unclear / Insufficient Data" reuses the
// engine's own honest Low-confidence signal (a genuinely thin sample) —
// never a fabricated "Transition" for a single timeframe, since a lone
// timeframe has nothing to "transition" between.
export function deriveStructureDisplayState(
  trend: "uptrend" | "downtrend" | "range" | string,
  confidenceLevel: "High" | "Moderate" | "Low" | string,
): StructureDisplayState {
  if (confidenceLevel === "Low") return "Unclear / Insufficient Data";
  if (trend === "uptrend") return "Bullish";
  if (trend === "downtrend") return "Bearish";
  return "Range";
}

// Cross-timeframe display state: "Transition" reuses the Multi-Timeframe
// Engine's own honest "split" agreement signal — real structural conflict
// across timeframes, never a fabricated in-between state. "insufficient-
// data" (fewer than 2 timeframes considered) is honestly distinct from a
// genuine conflict, so it maps to "Unclear / Insufficient Data" instead.
export function deriveTrendAlignmentState(
  trendAgreement: "unanimous" | "majority" | "split" | "insufficient-data" | string,
  dominantTrend: "uptrend" | "downtrend" | "range" | null,
  confidenceLevel: "High" | "Moderate" | "Low" | string,
): StructureDisplayState {
  if (trendAgreement === "insufficient-data") return "Unclear / Insufficient Data";
  if (trendAgreement === "split") return "Transition";
  if (!dominantTrend) return "Unclear / Insufficient Data";
  return deriveStructureDisplayState(dominantTrend, confidenceLevel);
}

export function structureDisplayStateBadgeClass(state: StructureDisplayState): string {
  if (state === "Bullish") return "border-emerald-500/40 text-emerald-400";
  if (state === "Bearish") return "border-rose-500/40 text-rose-400";
  if (state === "Range") return "border-sky-500/40 text-sky-400";
  if (state === "Transition") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}
