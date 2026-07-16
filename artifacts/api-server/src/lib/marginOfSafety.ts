// Phase 2, Sprint 14 — Consolidated Margin of Safety (approved Phase 2 plan,
// Sprint 14 §1.6). Once 3+ separate fair-value models exist (blended,
// Graham, DCF, Buffett — the blended model is deliberately kept, not
// retired, per this sprint's approved decision 1), this module produces the
// cross-model view none of them individually can: a fair-value range, an
// average, and an honest agreement signal that surfaces disagreement between
// models rather than papering over it with a single blended number.
//
// Pure aggregation over already-computed results — no new data, no new
// provider calls, no fabrication: a model that reports `available: false` is
// simply excluded from the range/average, never assigned an invented value.

import type { ValuationRating } from "./valueInvesting.js";

// The four valuation models this sprint can consolidate over. Each is a
// discriminated union sharing the same `available` + (when true) `fairValue`
// / `marginOfSafety` / `rating` field names — deliberately, so a caller can
// hand any of them in without this module needing to import their specific
// types (keeping this module independent, per the approved Sprint 14 scope
// that Tom Nash/the AI Investment Committee will later consolidate over too).
export interface ConsolidatableResult {
  available: boolean;
  fairValue?: number;
  marginOfSafety?: number;
  rating?: ValuationRating;
}

export interface ModelEntry {
  model: string;
  result: ConsolidatableResult;
}

export type AgreementSignal = "unanimous" | "majority" | "split" | "insufficient-data";

export interface ModelFairValue {
  model: string;
  fairValue: number;
}

export interface ConsolidatedMarginOfSafety {
  price: number;
  modelsConsidered: number;
  modelsAvailable: number;
  fairValues: ModelFairValue[];
  minFairValue: number | null;
  maxFairValue: number | null;
  averageFairValue: number | null;
  averageMarginOfSafety: number | null;
  agreement: AgreementSignal;
  summary: string;
}

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// Collapse the 4-value rating scale into a simple cheap/fair/expensive
// bucket so "3 models say Cheap, 1 says Very Expensive" reads as a real
// disagreement rather than 4 different-looking labels.
function bucket(rating: ValuationRating): "cheap" | "fair" | "expensive" {
  if (rating === "Cheap") return "cheap";
  if (rating === "Fair") return "fair";
  return "expensive"; // Expensive or Very Expensive
}

// Generic bucket-counting agreement classifier (Phase 2, Sprint 17 extraction —
// behavior-preserving; this module's own consolidateMarginOfSafety() output is
// unchanged, confirmed by its existing tests). Exported so the AI Investment
// Committee reuses the exact same unanimous/majority/split/insufficient-data
// algorithm for its 3 Buy/Hold/Wait votes instead of a second, duplicated one.
export function classifyAgreementSignal<T>(labels: T[]): AgreementSignal {
  if (labels.length < 2) return "insufficient-data";
  const counts = new Map<T, number>();
  for (const l of labels) {
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  if (maxCount === labels.length) return "unanimous";
  if (maxCount > labels.length / 2) return "majority";
  return "split";
}

function classifyAgreement(ratings: ValuationRating[]): AgreementSignal {
  return classifyAgreementSignal(ratings.map(bucket));
}

export function consolidateMarginOfSafety(price: number, entries: ModelEntry[]): ConsolidatedMarginOfSafety {
  const available = entries.filter(
    (e): e is ModelEntry & { result: ConsolidatableResult & { fairValue: number } } =>
      e.result.available && e.result.fairValue != null,
  );

  const fairValues: ModelFairValue[] = available.map((e) => ({ model: e.model, fairValue: e.result.fairValue }));
  const ratings = available.map((e) => e.result.rating).filter((r): r is ValuationRating => r != null);
  const marginsOfSafety = available
    .map((e) => e.result.marginOfSafety)
    .filter((m): m is number => m != null);

  if (fairValues.length === 0) {
    return {
      price,
      modelsConsidered: entries.length,
      modelsAvailable: 0,
      fairValues: [],
      minFairValue: null,
      maxFairValue: null,
      averageFairValue: null,
      averageMarginOfSafety: null,
      agreement: "insufficient-data",
      summary: "Margin of safety is unavailable — no valuation model produced a usable fair-value estimate, so it cannot be consolidated without fabricating a number.",
    };
  }

  const values = fairValues.map((f) => f.fairValue);
  const minFairValue = round(Math.min(...values), 2);
  const maxFairValue = round(Math.max(...values), 2);
  const averageFairValue = round(values.reduce((a, b) => a + b, 0) / values.length, 2);
  const averageMarginOfSafety =
    marginsOfSafety.length > 0
      ? round(marginsOfSafety.reduce((a, b) => a + b, 0) / marginsOfSafety.length, 4)
      : null;
  const agreement = classifyAgreement(ratings);

  const modelNames = fairValues.map((f) => f.model).join(", ");
  const rangeText =
    minFairValue === maxFairValue
      ? `$${minFairValue.toFixed(2)}`
      : `$${minFairValue.toFixed(2)}–$${maxFairValue.toFixed(2)}`;
  const agreementText =
    agreement === "unanimous"
      ? "all available models agree on the same cheap/fair/expensive bucket"
      : agreement === "majority"
        ? "most available models agree, though not all"
        : agreement === "split"
          ? "available models are genuinely split — no majority view"
          : "too few models are available to assess agreement";
  const summary =
    `${fairValues.length} of ${entries.length} valuation models (${modelNames}) produced a usable fair-value estimate, ` +
    `ranging ${rangeText} (average $${averageFairValue.toFixed(2)}) against a $${price.toFixed(2)} price; ${agreementText}.`;

  return {
    price,
    modelsConsidered: entries.length,
    modelsAvailable: fairValues.length,
    fairValues,
    minFairValue,
    maxFairValue,
    averageFairValue,
    averageMarginOfSafety,
    agreement,
    summary,
  };
}
