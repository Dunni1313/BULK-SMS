// v1.5.0, Sprint 15 — Institutional Portfolio & Risk Intelligence Engine.
//
// Orchestrates portfolioRiskIntelligence.ts's pure functions against real,
// already-fetched data from all 3 engines. Mirrors useDecisionWorkflow.ts's
// and useTradeLifecycle.ts's own established pattern exactly.

import { useMemo } from "react";
import {
  useGetPortfolioDashboard,
  useGetPortfolioConcentration,
  useGetPortfolios,
  useGetPortfolioRisk,
  getGetPortfolioRiskQueryKey,
  useGetTradingRisk,
  useListJournalEntries,
  useListTrades,
  useGetLearningProgress,
} from "@workspace/api-client-react";
import { useActiveDecisionSummary } from "./useDecisionWorkflow";
import { useTradeLifecyclePipeline } from "./useTradeLifecycle";
import {
  computePortfolioHealthScore,
  computeRiskIntelligence,
  buildPortfolioCoachNarrative,
  weakestAvailableFactor,
  recommendedPortfolioLesson,
  type PortfolioIntelligenceInput,
  type PortfolioHealthScore,
  type RiskIntelligenceReport,
  type PortfolioCoachNarrative,
  type HealthFactor,
} from "./portfolioRiskIntelligence";

export interface UsePortfolioRiskIntelligenceResult {
  loading: boolean;
  health: PortfolioHealthScore | null;
  risk: RiskIntelligenceReport | null;
  coachNarrative: PortfolioCoachNarrative | null;
  weakestFactor: HealthFactor | null;
  recommendedLesson: { pathKey: string; topicKey: string; label: string } | null;
  input: PortfolioIntelligenceInput | null;
}

export function usePortfolioRiskIntelligence(): UsePortfolioRiskIntelligenceResult {
  const { data: optionsIncome, isLoading: optionsLoading } = useGetPortfolioDashboard();
  const { data: optionsConcentration, isLoading: concentrationLoading } = useGetPortfolioConcentration();
  const { data: investingPortfolios, isLoading: portfoliosLoading } = useGetPortfolios();

  // Reads the first (primary) Investing Engine portfolio's own real risk
  // analysis, when the user has created one — a disclosed simplification
  // rather than trying to blend multiple named portfolios into one figure.
  const primaryPortfolioId = investingPortfolios && investingPortfolios.length > 0 ? investingPortfolios[0].id : undefined;
  const { data: investingRisk, isLoading: investingRiskLoading } = useGetPortfolioRisk(primaryPortfolioId as number, {
    query: { queryKey: getGetPortfolioRiskQueryKey(primaryPortfolioId as number), enabled: primaryPortfolioId !== undefined },
  });

  const { data: tradingRisk, isLoading: tradingRiskLoading } = useGetTradingRisk();

  const decisionSummary = useActiveDecisionSummary();
  const pipeline = useTradeLifecyclePipeline();

  const { data: journalEntries } = useListJournalEntries();
  const { data: closedTrades } = useListTrades({ status: "closed", limit: 20 });
  const { data: learningProgress } = useGetLearningProgress();

  const journalOutstanding = useMemo(() => {
    if (!closedTrades || !journalEntries) return null;
    const journaledTradeIds = new Set(journalEntries.map((j) => j.tradeId).filter((id): id is number => id !== null));
    return closedTrades.filter((t) => !journaledTradeIds.has(t.id)).length;
  }, [closedTrades, journalEntries]);

  const loading = optionsLoading || concentrationLoading || portfoliosLoading || (primaryPortfolioId !== undefined && investingRiskLoading) || tradingRiskLoading || decisionSummary.loading || pipeline.loading;

  const input = useMemo<PortfolioIntelligenceInput>(
    () => ({
      optionsIncome: optionsIncome ?? null,
      optionsConcentration: optionsConcentration ?? null,
      investingRisk: investingRisk ?? null,
      tradingRisk: tradingRisk ?? null,
      decisionSummary: { tradePlan: decisionSummary.tradePlan, score: decisionSummary.score },
      lifecycleRecords: pipeline.records,
      closedTradesCount: closedTrades?.length ?? 0,
      journalOutstanding,
      learningProgress: learningProgress ?? null,
    }),
    [optionsIncome, optionsConcentration, investingRisk, tradingRisk, decisionSummary.tradePlan, decisionSummary.score, pipeline.records, closedTrades, journalOutstanding, learningProgress],
  );

  const health = useMemo(() => computePortfolioHealthScore(input), [input]);
  const risk = useMemo(() => computeRiskIntelligence(input), [input]);
  const coachNarrative = useMemo(() => buildPortfolioCoachNarrative(health, risk), [health, risk]);
  const weakestFactor = useMemo(() => weakestAvailableFactor(health), [health]);
  const recommendedLesson = useMemo(() => recommendedPortfolioLesson(weakestFactor?.code ?? null), [weakestFactor]);

  return { loading, health, risk, coachNarrative, weakestFactor, recommendedLesson, input };
}
