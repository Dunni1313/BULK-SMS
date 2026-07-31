// v1.5.0, Sprint 13 — Institutional Decision Engine.
//
// Orchestrates decisionWorkflow.ts's pure functions against real,
// already-fetched data. Two hooks:
//
//   useDecisionWorkflow(tradePlanId) — the full 10-stage workflow +
//   Decision Score for ONE trade plan, backing pages/DecisionWorkflow.tsx.
//   Trade-plan-specific data (the plan itself, its missing-information
//   report, its linked strategy) is fetched via plain useEffect/useState,
//   mirroring useWorkflowSnapshot.ts's own established pattern (Sprint 12)
//   for the same reason: tradePlansApi.ts/strategiesApi.ts are plain-fetch
//   modules, not generated TanStack Query hooks. Cross-module context
//   (review/portfolio/learning) is read from the platform's own already-
//   existing generated hooks — never a second, duplicate data source.
//
//   useActiveDecisionSummary() — a lighter summary for the Command
//   Centre's "Decision in Progress" card: picks the user's single most
//   recently updated non-terminal (draft/ready/watching) trade plan across
//   all 3 coachIds and computes its score, so the Command Centre can show
//   "decision in progress / score / next step" without duplicating the
//   full workflow page's own UI.

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getTradePlan,
  getMissingTradePlanInformation,
  listTradePlans,
  type TradePlanDetail,
  type TradePlan,
  type MissingTradePlanInfoResult,
} from "./ai-coach/tradePlansApi";
import { getStrategy, getMissingSections, type AiStrategyDetail, type MissingSectionsResult } from "./ai-coach/strategiesApi";
import type { CoachId } from "./ai-coach/capabilityRegistry";
import {
  useListJournalEntries,
  useListTrades,
  useGetValueWatchlist,
  useListTradingPositions,
  useGetLearningProgress,
} from "@workspace/api-client-react";
import {
  computeCoreDecisionStages,
  buildLearningStage,
  buildLearningContext,
  computeDecisionScore,
  weakestScoredStage,
  type DecisionStage,
  type DecisionScore,
  type ReviewContext,
  type PortfolioContext,
  type LearningContext,
} from "./decisionWorkflow";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];
const ACTIVE_STATUSES = new Set(["draft", "ready", "watching"]);

// ─── Review context: does a journal entry already reference this plan's
// executed trade? tradePlansApi.ts's own executedTradeRef is a loose,
// string reference (mirroring journal_entries.trade_id's own established
// loose-reference precedent, Sprint 39) — matched here against journal
// entries' numeric tradeId by string comparison, never a foreign key. ────

function useReviewContext(tradePlan: TradePlanDetail | null): ReviewContext {
  const { data: journalEntries } = useListJournalEntries();
  return useMemo(() => {
    if (!tradePlan?.executedTradeRef) return { hasJournalEntry: null };
    const hasJournalEntry = (journalEntries ?? []).some(
      (j) => j.tradeId !== null && String(j.tradeId) === tradePlan.executedTradeRef,
    );
    return { hasJournalEntry };
  }, [tradePlan?.executedTradeRef, journalEntries]);
}

// ─── Portfolio context: is the planned asset already reflected somewhere
// real? Which "somewhere" depends on the plan's own coachId — the Value
// Watchlist (investing), open Trading Positions (trading), or open Options
// trades (options) — three already-existing, already-fetched sources,
// never a fabricated fourth. ─────────────────────────────────────────────

function usePortfolioContext(tradePlan: TradePlanDetail | null): PortfolioContext {
  const { data: watchlist } = useGetValueWatchlist();
  const { data: positions } = useListTradingPositions();
  const { data: openTrades } = useListTrades({ status: "open", limit: 50 });

  return useMemo(() => {
    const asset = tradePlan?.plannedAsset?.toUpperCase().trim();
    if (!asset) return { currentlyHeldOrWatched: false, sourceLabel: "" };

    if (tradePlan?.coachId === "investing") {
      const held = (watchlist ?? []).some((w) => w.symbol.toUpperCase() === asset);
      return { currentlyHeldOrWatched: held, sourceLabel: "Value Watchlist" };
    }
    if (tradePlan?.coachId === "trading") {
      const held = (positions ?? []).some((p) => p.symbol.toUpperCase() === asset && p.status === "open");
      return { currentlyHeldOrWatched: held, sourceLabel: "Trading Positions" };
    }
    const held = (openTrades ?? []).some((t) => t.symbol.toUpperCase() === asset);
    return { currentlyHeldOrWatched: held, sourceLabel: "Open Options Trades" };
  }, [tradePlan?.plannedAsset, tradePlan?.coachId, watchlist, positions, openTrades]);
}

// ─── The full, single-decision workflow ────────────────────────────────

export interface UseDecisionWorkflowResult {
  loading: boolean;
  error: string | null;
  tradePlan: TradePlanDetail | null;
  missingInfo: MissingTradePlanInfoResult | null;
  strategy: AiStrategyDetail | null;
  stages: DecisionStage[];
  score: DecisionScore;
  weakestStage: DecisionStage | null;
  learning: LearningContext;
  reload: () => void;
}

export function useDecisionWorkflow(tradePlanId: number | null): UseDecisionWorkflowResult {
  const [tradePlan, setTradePlan] = useState<TradePlanDetail | null>(null);
  const [missingInfo, setMissingInfo] = useState<MissingTradePlanInfoResult | null>(null);
  const [strategy, setStrategy] = useState<AiStrategyDetail | null>(null);
  const [strategyMissingSections, setStrategyMissingSections] = useState<MissingSectionsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    if (tradePlanId === null) {
      setTradePlan(null);
      setMissingInfo(null);
      setStrategy(null);
      setStrategyMissingSections(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [plan, missing] = await Promise.all([
          getTradePlan(tradePlanId as number),
          getMissingTradePlanInformation(tradePlanId as number),
        ]);
        if (cancelled) return;

        let strat: AiStrategyDetail | null = null;
        let stratMissing: MissingSectionsResult | null = null;
        if (plan.strategyId !== null) {
          [strat, stratMissing] = await Promise.all([
            getStrategy(plan.strategyId).catch(() => null),
            getMissingSections(plan.strategyId).catch(() => null),
          ]);
        }
        if (cancelled) return;

        setTradePlan(plan);
        setMissingInfo(missing);
        setStrategy(strat);
        setStrategyMissingSections(stratMissing);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load this decision.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tradePlanId, reloadTick]);

  const review = useReviewContext(tradePlan);
  const portfolio = usePortfolioContext(tradePlan);
  const { data: learningProgress } = useGetLearningProgress();

  const EMPTY_LEARNING: LearningContext = { engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null };

  const { stages, score, weakestStage, learning } = useMemo(() => {
    if (!tradePlan || !missingInfo) {
      return {
        stages: [] as DecisionStage[],
        score: computeDecisionScore([]),
        weakestStage: null as DecisionStage | null,
        learning: EMPTY_LEARNING,
      };
    }
    const coreStages = computeCoreDecisionStages({
      tradePlan,
      missingInfo,
      strategy,
      strategyMissingSections,
      review,
      portfolio,
    });
    const weakest = weakestScoredStage(coreStages);
    const recentHistory = (learningProgress?.recentHistory ?? []).map((h) => ({ itemKey: h.itemKey }));
    const learningContext = buildLearningContext(tradePlan.coachId, weakest?.id ?? null, [], recentHistory);
    const learningStage = buildLearningStage(learningContext);
    const allStages = [...coreStages, learningStage];
    return { stages: allStages, score: computeDecisionScore(coreStages), weakestStage: weakest, learning: learningContext };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradePlan, missingInfo, strategy, strategyMissingSections, review, portfolio, learningProgress]);

  return { loading, error, tradePlan, missingInfo, strategy, stages, score, weakestStage, learning, reload };
}

// ─── The Command Centre's lightweight "Decision in Progress" summary ───

export interface ActiveDecisionSummary {
  loading: boolean;
  tradePlan: TradePlan | null;
  score: DecisionScore | null;
  weakestStage: DecisionStage | null;
}

// v1.5.0, Sprint 19 — exported (not recomputed) so lib/useDecisionQualityEngine.ts
// can reuse the exact same "review/portfolio context not needed for this
// read" placeholders this hook already established for useActiveDecisionSummary()'s
// own lighter-weight per-plan computation.
export const NEUTRAL_REVIEW: ReviewContext = { hasJournalEntry: null };
export const NEUTRAL_PORTFOLIO: PortfolioContext = { currentlyHeldOrWatched: false, sourceLabel: "" };

export function useActiveDecisionSummary(): ActiveDecisionSummary {
  const [summary, setSummary] = useState<ActiveDecisionSummary>({ loading: true, tradePlan: null, score: null, weakestStage: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const byCoach = await Promise.all(COACH_IDS.map((c) => listTradePlans(c).catch((): TradePlan[] => [])));
        const active = byCoach
          .flat()
          .filter((p) => ACTIVE_STATUSES.has(p.status))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const winner = active[0] ?? null;

        if (!winner) {
          if (!cancelled) setSummary({ loading: false, tradePlan: null, score: null, weakestStage: null });
          return;
        }

        const [plan, missing] = await Promise.all([
          getTradePlan(winner.id),
          getMissingTradePlanInformation(winner.id),
        ]);
        if (cancelled) return;

        let strat: AiStrategyDetail | null = null;
        let stratMissing: MissingSectionsResult | null = null;
        if (plan.strategyId !== null) {
          [strat, stratMissing] = await Promise.all([
            getStrategy(plan.strategyId).catch(() => null),
            getMissingSections(plan.strategyId).catch(() => null),
          ]);
        }
        if (cancelled) return;

        const coreStages = computeCoreDecisionStages({
          tradePlan: plan,
          missingInfo: missing,
          strategy: strat,
          strategyMissingSections: stratMissing,
          review: NEUTRAL_REVIEW,
          portfolio: NEUTRAL_PORTFOLIO,
        });
        setSummary({
          loading: false,
          tradePlan: winner,
          score: computeDecisionScore(coreStages),
          weakestStage: weakestScoredStage(coreStages),
        });
      } catch {
        if (!cancelled) setSummary({ loading: false, tradePlan: null, score: null, weakestStage: null });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return summary;
}
