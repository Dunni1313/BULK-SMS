// Phase 23 — Executive Dashboard & Production Readiness (consolidation).
// Extracted, unmodified in behavior (per DecisionEngine.tsx's/
// InvestmentCommitteeWorkbench.tsx's own byte-identical implementation),
// from DecisionEngine.tsx/InvestmentCommitteeWorkbench.tsx/
// ResearchTerminal.tsx, each of which had independently defined this exact
// hook. Mirrors src/hooks/use-coach-explanation.ts's own established
// pattern: the generated useGetInstitutionalDecision() hook has no way to
// add an undocumented ?portfolioId= query param without re-triggering
// Orval's own known duplicate-GetXParams-export collision (first disclosed
// at Sprint 40) — this composes a plain useQuery around the generated
// fetch function instead.
//
// ResearchTerminal.tsx's own prior copy of this hook always made a raw
// fetch() call, even for the no-portfolioId case, instead of reusing the
// generated getInstitutionalDecision()/getInvestmentMemo() functions the
// way DecisionEngine.tsx/InvestmentCommitteeWorkbench.tsx already did —
// standardizing on the latter here is a genuine, disclosed, behavior-
// preserving simplification (identical final data, one fewer duplicate
// fetch path) for ResearchTerminal.tsx specifically.

import { useQuery } from "@tanstack/react-query";
import {
  getInstitutionalDecision,
  getGetInstitutionalDecisionQueryKey,
  getInvestmentMemo,
  getGetInvestmentMemoQueryKey,
  type InstitutionalDecisionAnalysis,
  type InvestmentMemo,
} from "@workspace/api-client-react";

export function useInstitutionalDecision(symbol: string, portfolioId: number | null) {
  return useQuery<InstitutionalDecisionAnalysis>({
    queryKey: [...getGetInstitutionalDecisionQueryKey(symbol), portfolioId ?? null],
    queryFn: async () => {
      if (portfolioId == null) return getInstitutionalDecision(symbol);
      const res = await fetch(`/api/stock-analyst/decision/${encodeURIComponent(symbol)}?portfolioId=${portfolioId}`);
      if (!res.ok) throw new Error(`Unknown symbol: ${symbol}`);
      return res.json();
    },
    enabled: !!symbol,
    retry: false,
  });
}

export function useInvestmentMemo(symbol: string, portfolioId: number | null) {
  return useQuery<InvestmentMemo>({
    queryKey: [...getGetInvestmentMemoQueryKey(symbol), portfolioId ?? null],
    queryFn: async () => {
      if (portfolioId == null) return getInvestmentMemo(symbol);
      const res = await fetch(`/api/stock-analyst/investment-memo/${encodeURIComponent(symbol)}?portfolioId=${portfolioId}`);
      if (!res.ok) throw new Error(`Unknown symbol: ${symbol}`);
      return res.json();
    },
    enabled: !!symbol,
    retry: false,
  });
}
