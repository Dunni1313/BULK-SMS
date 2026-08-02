// v1.5.0 Sprint 10 — Institutional Trade Planner. A small, standalone
// hook for listing the coach-specific checklist templates — deliberately
// separate from useTradePlans.ts since template listing has no dependency
// on an active plan selection (mirrors the templates-are-a-static-list
// precedent every other AI-object hook family in this codebase treats as
// a plain fetch-once list, not part of the plan's own memory state).

import { useEffect, useState } from "react";
import type { CoachId } from "./capabilityRegistry";
import { listTradePlanChecklistTemplates, type TradePlanChecklistTemplate } from "./tradePlansApi";

export interface UseTradePlanChecklistTemplatesResult {
  templates: TradePlanChecklistTemplate[];
  isLoading: boolean;
  error: string | null;
}

export function useTradePlanChecklistTemplates(coachId?: CoachId): UseTradePlanChecklistTemplatesResult {
  const [templates, setTemplates] = useState<TradePlanChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listTradePlanChecklistTemplates(coachId)
      .then((list) => {
        if (!cancelled) {
          setTemplates(list);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load checklist templates");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  return { templates, isLoading, error };
}
