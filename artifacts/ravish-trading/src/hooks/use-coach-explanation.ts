// Phase 21 — Institutional AI Coach & Education Platform. Shared hook, reused
// across every one of the 11 integration surfaces (Research Terminal, Decision
// Engine, Portfolio Optimisation, Investment Committee Workbench, Institutional
// Workspace, Portfolio Construction, Institutional Monitoring, Institutional
// Mentor, the Institutional AI Coach page itself). Mirrors DecisionEngine.tsx's
// own established useInstitutionalDecision() pattern exactly: the generated
// useGetCoachExplanation() hook has no way to add an undocumented ?portfolioId=
// query param without re-triggering Orval's own known duplicate-GetXParams-
// export collision (first disclosed at Sprint 40) — the same trick is used
// here rather than duplicating this fetch logic in 9 different page files.

import { useQuery } from "@tanstack/react-query";
import { getCoachExplanation, getGetCoachExplanationQueryKey, type CoachExplanation, type CoachExplanationCoach } from "@workspace/api-client-react";

export type CoachType = CoachExplanationCoach;

export function useCoachExplanation(coach: CoachType, symbol: string, portfolioId?: number | null) {
  return useQuery<CoachExplanation>({
    queryKey: [...getGetCoachExplanationQueryKey(coach, symbol), portfolioId ?? null],
    queryFn: async () => {
      if (portfolioId == null) return getCoachExplanation(coach, symbol);
      const res = await fetch(`/api/stock-analyst/coach/${encodeURIComponent(coach)}/${encodeURIComponent(symbol)}?portfolioId=${portfolioId}`);
      if (!res.ok) throw new Error(`Unknown symbol: ${symbol}`);
      return res.json();
    },
    enabled: !!symbol,
    retry: false,
  });
}
