// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
//
// Transparent trend analysis across multiple already-computed
// DecisionReview objects (lib/decisionReview.ts) — zero new business
// logic, purely an aggregate read of fields already scored per decision.
// Every trend honestly requires a minimum sample size before claiming a
// direction, and every trend cites the exact decisions behind it — never
// a fabricated pattern from too little evidence.

import type { DecisionReview, DecisionReviewFieldId } from "./decisionReview";

export type TrendDirection = "improving" | "declining" | "stable" | "insufficient-data";

export interface DecisionQualityTrendEvidence {
  tradePlanId: number;
  title: string;
}

export interface DecisionQualityTrend {
  id: string;
  label: string;
  direction: TrendDirection;
  earlierAverage: number | null;
  laterAverage: number | null;
  evidence: DecisionQualityTrendEvidence[];
}

// A trend needs enough decisions to form a genuine "earlier half vs. later
// half" comparison — 2 decisions would let one single reading masquerade
// as a trend. 4 is the smallest split that gives each half more than one
// data point.
const MIN_REVIEWS_FOR_TREND = 4;

// A move of 10 points is treated as the threshold for "genuinely improving/
// declining" rather than noise — anything smaller is honestly reported
// "stable," never inflated into a claimed trend.
const STABLE_BAND = 10;

interface TrendDefinition {
  id: string;
  label: string;
  fieldIds: DecisionReviewFieldId[];
}

const TREND_DEFINITIONS: TrendDefinition[] = [
  { id: "research-discipline", label: "Research Discipline", fieldIds: ["research-quality", "evidence-completeness", "alternative-scenarios"] },
  { id: "risk-management", label: "Risk Management", fieldIds: ["risk-planning", "position-sizing", "execution-discipline"] },
  { id: "journal-completion", label: "Journal Completion", fieldIds: ["journal-completeness", "post-trade-reflection"] },
  { id: "strategy-alignment", label: "Strategy Alignment", fieldIds: ["strategy-alignment", "decision-rationale"] },
];

function fieldAverage(review: DecisionReview, fieldIds: DecisionReviewFieldId[]): number | null {
  const scored = review.fields.filter((f) => fieldIds.includes(f.id) && f.confidence !== null);
  if (scored.length === 0) return null;
  return scored.reduce((sum, f) => sum + (f.confidence ?? 0), 0) / scored.length;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * `reviews` must already be sorted oldest -> newest by the caller (matching
 * executedAt/updatedAt, the same ordering convention Sprint 17's own
 * Intelligence Timeline established).
 */
export function computeDecisionQualityTrends(reviews: DecisionReview[]): DecisionQualityTrend[] {
  return TREND_DEFINITIONS.map((def) => {
    if (reviews.length < MIN_REVIEWS_FOR_TREND) {
      return { id: def.id, label: def.label, direction: "insufficient-data", earlierAverage: null, laterAverage: null, evidence: reviews.map((r) => ({ tradePlanId: r.tradePlanId, title: r.tradePlanTitle })) };
    }
    const mid = Math.floor(reviews.length / 2);
    const earlierHalf = reviews.slice(0, mid);
    const laterHalf = reviews.slice(mid);

    const earlierAverage = avg(earlierHalf.map((r) => fieldAverage(r, def.fieldIds)).filter((v): v is number => v !== null));
    const laterAverage = avg(laterHalf.map((r) => fieldAverage(r, def.fieldIds)).filter((v): v is number => v !== null));

    let direction: TrendDirection = "insufficient-data";
    if (earlierAverage !== null && laterAverage !== null) {
      const delta = laterAverage - earlierAverage;
      direction = delta > STABLE_BAND ? "improving" : delta < -STABLE_BAND ? "declining" : "stable";
    }

    return {
      id: def.id,
      label: def.label,
      direction,
      earlierAverage,
      laterAverage,
      evidence: reviews.map((r) => ({ tradePlanId: r.tradePlanId, title: r.tradePlanTitle })),
    };
  });
}

export interface RecurringPlaybookDeviation {
  playbookId: string;
  playbookName: string;
  stageTitle: string;
  occurrenceCount: number;
  tradePlanIds: number[];
}

// A single decision skipping a stage is a one-off; the SAME stage skipped
// across 2+ reviewed decisions is a genuine recurring deviation worth
// surfacing — never inflated from a single occurrence.
const MIN_OCCURRENCES_FOR_RECURRING = 2;

export function computeRecurringPlaybookDeviations(reviews: DecisionReview[]): RecurringPlaybookDeviation[] {
  const buckets = new Map<string, RecurringPlaybookDeviation>();
  for (const review of reviews) {
    for (const p of review.playbookAdherence) {
      for (const stageTitle of p.incompleteStageTitles) {
        const key = `${p.playbookId}:${stageTitle}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.occurrenceCount += 1;
          existing.tradePlanIds.push(review.tradePlanId);
        } else {
          buckets.set(key, { playbookId: p.playbookId, playbookName: p.playbookName, stageTitle, occurrenceCount: 1, tradePlanIds: [review.tradePlanId] });
        }
      }
    }
  }
  return Array.from(buckets.values())
    .filter((d) => d.occurrenceCount >= MIN_OCCURRENCES_FOR_RECURRING)
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
}
