// v1.5.0, Sprint 9 — AI Strategy Builder. "Detect Missing Sections" and
// "Find Similar Strategies" are deliberately DETERMINISTIC — both are
// honestly, exactly computable from a strategy's own already-saved
// sections/tags/type/asset-class without any LLM call, matching this
// codebase's own established "never fabricate via an LLM what can be
// honestly computed" discipline. Neither function ever calls coachLLM.ts.

import { STRATEGY_SECTION_KINDS, type StrategySectionKind, type AiStrategy, type AiStrategySection } from "@workspace/db";

const QUALITATIVE_SECTION_KINDS: StrategySectionKind[] = STRATEGY_SECTION_KINDS.filter(
  (k) => k !== "attachment" && k !== "research_link" && k !== "notebook_reference",
);

export interface MissingSectionsResult {
  missing: StrategySectionKind[];
  present: StrategySectionKind[];
  completenessPct: number;
}

/** A section counts as "present" only if it has real, non-whitespace
 * content — an empty row is honestly reported missing, never counted. */
export function detectMissingSections(sections: AiStrategySection[]): MissingSectionsResult {
  const presentKinds = new Set(
    sections.filter((s) => QUALITATIVE_SECTION_KINDS.includes(s.kind as StrategySectionKind) && (s.content ?? "").trim().length > 0).map((s) => s.kind),
  );
  const present = QUALITATIVE_SECTION_KINDS.filter((k) => presentKinds.has(k));
  const missing = QUALITATIVE_SECTION_KINDS.filter((k) => !presentKinds.has(k));
  return {
    missing,
    present,
    completenessPct: Math.round((present.length / QUALITATIVE_SECTION_KINDS.length) * 100),
  };
}

export interface SimilarStrategyResult {
  strategy: AiStrategy;
  score: number;
  matchedOn: string[];
}

/** Honest, explainable overlap scoring — never a fabricated semantic
 * "similarity" claim. Scores purely on shared strategyType (heaviest
 * weight), assetClass, coachId, and tag overlap, all structural facts
 * already stored on each strategy. */
export function findSimilarStrategies(target: AiStrategy, candidates: AiStrategy[], limit = 5): SimilarStrategyResult[] {
  const results: SimilarStrategyResult[] = [];
  for (const candidate of candidates) {
    if (candidate.id === target.id) continue;
    let score = 0;
    const matchedOn: string[] = [];
    if (candidate.strategyType === target.strategyType) {
      score += 50;
      matchedOn.push("strategyType");
    }
    if (target.assetClass && candidate.assetClass === target.assetClass) {
      score += 20;
      matchedOn.push("assetClass");
    }
    if (candidate.coachId === target.coachId) {
      score += 10;
      matchedOn.push("coachId");
    }
    const sharedTags = target.tags.filter((t) => candidate.tags.includes(t));
    if (sharedTags.length > 0) {
      score += Math.min(20, sharedTags.length * 5);
      matchedOn.push(...sharedTags.map((t) => `tag:${t}`));
    }
    if (score > 0) results.push({ strategy: candidate, score, matchedOn });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
