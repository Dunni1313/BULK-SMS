// AI Teacher & Learning Centre sprint — Explain Mode fetch helper.
//
// GET /learning-centre/explain/:metric is deliberately kept outside the
// OpenAPI/orval typed contract (documenting a path parameter together with
// a query parameter on the same operation is a known Orval codegen
// collision, first disclosed at Sprint 40 of the Alpaca Paper Trading
// family of sprints). This mirrors coach-stream.ts's own established
// plain-fetch pattern for routes outside that contract.

const API_PREFIX = "/api";

export interface MetricExplanation {
  code: string;
  label: string;
  currentValue: string;
  plainEnglish: string;
  sourceCalculation: string;
  whyItMatters: string;
  relatedLessonHref: string | null;
  relatedGlossaryKeys: string[];
  reusedObservation: boolean;
}

export class ExplainFetchError extends Error {}

export async function fetchMetricExplanation(metric: string, tradeId?: number): Promise<MetricExplanation> {
  const qs = tradeId !== undefined ? `?tradeId=${tradeId}` : "";
  const res = await fetch(`${API_PREFIX}/learning-centre/explain/${metric}${qs}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ExplainFetchError(body.error ?? `Failed to explain ${metric}`);
  }
  return res.json();
}
