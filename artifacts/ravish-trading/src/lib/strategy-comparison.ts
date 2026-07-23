// Phase 31 — Institutional Strategy Workbench.
//
// Pure, deterministic comparison of strategy METADATA ONLY — never
// performance, never a ranking. Every field compared here is read directly
// off the already-persisted TradingStrategy row (or the Learning Progress
// summary's own viewedStrategyKeys list); nothing is computed, scored, or
// ordered by "better/worse." Rows are returned in the exact order the
// caller's strategy id list was given — this module never reorders them
// by any notion of quality.

import type { TradingStrategy } from "@workspace/api-client-react";

export interface StrategyComparisonRow {
  strategyId: number;
  name: string;
  category: string;
  markets: string[];
  timeframes: string[];
  requiredEvidenceCount: number;
  requiredEvidence: string[];
  checklistSize: number;
  requiredChecklistItemCount: number;
  referencesCount: number;
  version: string;
  learningCoverageViewed: boolean;
  validationValid: boolean;
}

/**
 * Builds one comparison row per strategy, in the same order the strategies
 * array was given. `viewedStrategyKeys` is the Learning Progress summary's
 * own already-computed list (lib/learningProgress.ts's viewedStrategyKeys,
 * Phase 31) — this function never recomputes what "viewed" means, only
 * looks the strategy's own key up in that list.
 */
export function compareStrategies(
  strategies: TradingStrategy[],
  viewedStrategyKeys: string[] = [],
): StrategyComparisonRow[] {
  const viewed = new Set(viewedStrategyKeys);
  return strategies.map((s) => ({
    strategyId: s.id,
    name: s.name,
    category: s.category,
    markets: s.markets,
    timeframes: s.timeframes,
    requiredEvidenceCount: s.requiredEvidence.length,
    requiredEvidence: s.requiredEvidence,
    checklistSize: s.checklist.length,
    requiredChecklistItemCount: s.checklist.filter((c) => c.required).length,
    referencesCount: s.references.length,
    version: s.version,
    learningCoverageViewed: viewed.has(`strategy-framework:${s.id}`),
    validationValid: s.validation.valid,
  }));
}
