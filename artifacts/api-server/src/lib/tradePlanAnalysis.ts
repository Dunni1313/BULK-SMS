// v1.5.0, Sprint 10 — Institutional Trade Planner. "Identify Missing
// Information" and the list-generation half of "Compare Similar Plans"
// are deliberately DETERMINISTIC — both are honestly, exactly computable
// from a plan's own already-saved sections/tags/asset-class/strategy
// without any LLM call, mirroring lib/strategyAnalysis.ts's own
// established "never fabricate via an LLM what can be honestly computed"
// discipline. Neither function ever calls coachLLM.ts.

import { TRADE_PLAN_SECTION_KINDS, type TradePlanSectionKind, type TradePlan, type TradePlanSection } from "@workspace/db";

const QUALITATIVE_TRADE_PLAN_SECTION_KINDS: TradePlanSectionKind[] = TRADE_PLAN_SECTION_KINDS.filter(
  (k) => k !== "attachment" && k !== "research_reference" && k !== "notebook_reference",
);

export interface MissingTradePlanInfoResult {
  missing: TradePlanSectionKind[];
  present: TradePlanSectionKind[];
  completenessPct: number;
}

/** A section counts as "present" only if it has real, non-whitespace
 * content — an empty row is honestly reported missing, never counted. */
export function detectMissingInformation(sections: TradePlanSection[]): MissingTradePlanInfoResult {
  const presentKinds = new Set(
    sections
      .filter((s) => QUALITATIVE_TRADE_PLAN_SECTION_KINDS.includes(s.kind as TradePlanSectionKind) && (s.content ?? "").trim().length > 0)
      .map((s) => s.kind),
  );
  const present = QUALITATIVE_TRADE_PLAN_SECTION_KINDS.filter((k) => presentKinds.has(k));
  const missing = QUALITATIVE_TRADE_PLAN_SECTION_KINDS.filter((k) => !presentKinds.has(k));
  return {
    missing,
    present,
    completenessPct: Math.round((present.length / QUALITATIVE_TRADE_PLAN_SECTION_KINDS.length) * 100),
  };
}

export interface SimilarTradePlanResult {
  plan: TradePlan;
  score: number;
  matchedOn: string[];
}

/** Honest, explainable overlap scoring — never a fabricated semantic
 * "similarity" claim. Scores purely on shared plannedAsset (heaviest
 * weight — the same ticker/instrument is the strongest real signal two
 * plans are comparable), strategyId, assetClass, coachId, direction, and
 * tag overlap — all structural facts already stored on each plan. */
export function findSimilarPlans(target: TradePlan, candidates: TradePlan[], limit = 5): SimilarTradePlanResult[] {
  const results: SimilarTradePlanResult[] = [];
  for (const candidate of candidates) {
    if (candidate.id === target.id) continue;
    let score = 0;
    const matchedOn: string[] = [];
    if (target.plannedAsset && candidate.plannedAsset === target.plannedAsset) {
      score += 40;
      matchedOn.push("plannedAsset");
    }
    if (target.strategyId != null && candidate.strategyId === target.strategyId) {
      score += 25;
      matchedOn.push("strategyId");
    }
    if (target.assetClass && candidate.assetClass === target.assetClass) {
      score += 15;
      matchedOn.push("assetClass");
    }
    if (candidate.coachId === target.coachId) {
      score += 10;
      matchedOn.push("coachId");
    }
    if (target.direction && candidate.direction === target.direction) {
      score += 5;
      matchedOn.push("direction");
    }
    const sharedTags = target.tags.filter((t) => candidate.tags.includes(t));
    if (sharedTags.length > 0) {
      score += Math.min(15, sharedTags.length * 5);
      matchedOn.push(...sharedTags.map((t) => `tag:${t}`));
    }
    if (score > 0) results.push({ plan: candidate, score, matchedOn });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface ChecklistProgress {
  totalItems: number;
  completedItems: number;
  requiredItems: number;
  completedRequiredItems: number;
  progressPct: number;
  readyForEntry: boolean;
}

/** The Checklist Engine's own progress derivation — always computed
 * fresh from the current rows, never stored. `readyForEntry` is a plain,
 * honest fact (every required item is complete), never an AI judgment. */
export function computeChecklistProgress(items: Array<{ required: boolean; completed: boolean }>): ChecklistProgress {
  const totalItems = items.length;
  const completedItems = items.filter((i) => i.completed).length;
  const requiredItems = items.filter((i) => i.required).length;
  const completedRequiredItems = items.filter((i) => i.required && i.completed).length;
  return {
    totalItems,
    completedItems,
    requiredItems,
    completedRequiredItems,
    progressPct: totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100),
    readyForEntry: requiredItems > 0 && completedRequiredItems === requiredItems,
  };
}
