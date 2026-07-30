// v1.5.0, Sprint 14 — Institutional Execution & Lifecycle Manager.
//
// Orchestrates tradeLifecycle.ts's pure functions against real, already-
// fetched data — mirrors useDecisionWorkflow.ts's own established pattern
// (Sprint 13) exactly, including reusing its plain-fetch/useEffect style
// for tradePlansApi.ts/strategiesApi.ts (still not generated TanStack
// Query hooks) and the platform's real generated hooks for every
// cross-module read (trades, trading positions, journal, learning).
//
// Two hooks:
//   useTradeLifecycle(tradePlanId) — the full lifecycle record for ONE
//   trade plan, backing pages/ExecutionLifecycleManager.tsx's detail panel.
//
//   useTradeLifecyclePipeline() — every trade plan across all 3 coachIds,
//   each with its own computed TradeLifecycleRecord, for the Pipeline View
//   kanban and the Command Centre's Execution Pipeline card. A genuinely
//   disclosed cost: computing an accurate stage per plan needs that plan's
//   own full checklist/section detail, not just its list-row summary, so
//   this fetches full detail for every non-terminal-looking plan — the
//   same "costs several times the provider calls of a single view" trade-
//   off Sprint 20's Industry Comparison already disclosed for its own
//   peer-group fetch.

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getTradePlan,
  getMissingTradePlanInformation,
  listTradePlans,
  type TradePlan,
  type TradePlanDetail,
  type MissingTradePlanInfoResult,
} from "./ai-coach/tradePlansApi";
import { getStrategy, getMissingSections, type AiStrategyDetail, type MissingSectionsResult } from "./ai-coach/strategiesApi";
import type { CoachId } from "./ai-coach/capabilityRegistry";
import {
  useListJournalEntries,
  useListTrades,
  useListTradingPositions,
  useGetLearningProgress,
  type Trade,
  type TradingPosition,
  type JournalEntry,
} from "@workspace/api-client-react";
import {
  computeCoreDecisionStages,
  computeDecisionScore,
  weakestScoredStage,
  buildLearningContext,
  type ReviewContext,
  type PortfolioContext,
  type DecisionStage,
  type DecisionScore,
  type LearningContext,
} from "./decisionWorkflow";
import { computeTradeLifecycle, type TradeLifecycleRecord, type LinkedExecution } from "./tradeLifecycle";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];
const NEUTRAL_REVIEW: ReviewContext = { hasJournalEntry: null };
const NEUTRAL_PORTFOLIO: PortfolioContext = { currentlyHeldOrWatched: false, sourceLabel: "" };

// ─── LinkedExecution resolution — the real trades/trading_positions row a
// plan's own loose executedTradeRef points at. "investing" plans have no
// discrete per-trade row anywhere in this codebase, so they're always
// honestly detailUnavailable — never a fabricated open/closed reading. ────

function resolveOptionsExecution(tradePlan: TradePlan, trades: Trade[]): LinkedExecution {
  const trade = tradePlan.executedTradeRef ? trades.find((t) => String(t.id) === tradePlan.executedTradeRef) : undefined;
  if (!trade) {
    return {
      kind: "options-trade",
      status: "open",
      openedAt: tradePlan.executedAt,
      closedAt: null,
      symbol: tradePlan.plannedAsset ?? "",
      quantity: null,
      riskDollars: null,
      unrealizedPnl: null,
      realizedPnl: null,
      detailUnavailable: true,
    };
  }
  const closed = trade.status === "closed" || trade.status === "expired";
  return {
    kind: "options-trade",
    status: closed ? "closed" : "open",
    openedAt: trade.openDate,
    closedAt: trade.closeDate ?? null,
    symbol: trade.symbol,
    quantity: null,
    riskDollars: closed ? null : trade.maxLoss,
    unrealizedPnl: closed ? null : (trade.currentPnl ?? null),
    realizedPnl: closed ? (trade.currentPnl ?? null) : null,
    detailUnavailable: false,
  };
}

function resolveTradingExecution(tradePlan: TradePlan, positions: TradingPosition[]): LinkedExecution {
  const pos = tradePlan.executedTradeRef ? positions.find((p) => String(p.id) === tradePlan.executedTradeRef) : undefined;
  if (!pos) {
    return {
      kind: "trading-position",
      status: "open",
      openedAt: tradePlan.executedAt,
      closedAt: null,
      symbol: tradePlan.plannedAsset ?? "",
      quantity: null,
      riskDollars: null,
      unrealizedPnl: null,
      realizedPnl: null,
      detailUnavailable: true,
    };
  }
  const closed = pos.status === "closed";
  const riskDollars = pos.stopPrice != null ? Math.abs(pos.entryPrice - pos.stopPrice) * pos.quantity : null;
  const realizedPnl =
    closed && pos.exitPrice != null
      ? (pos.side === "short" ? pos.entryPrice - pos.exitPrice : pos.exitPrice - pos.entryPrice) * pos.quantity
      : null;
  return {
    kind: "trading-position",
    status: closed ? "closed" : "open",
    openedAt: pos.entryDate,
    closedAt: pos.exitDate ?? null,
    symbol: pos.symbol,
    quantity: pos.quantity,
    riskDollars: closed ? null : riskDollars,
    // No live price feed is reused here — an open trading position's
    // unrealized P&L would need one, which this module deliberately never
    // fabricates. Honestly null, matching this plan's own established
    // never-fabricate discipline.
    unrealizedPnl: null,
    realizedPnl,
    detailUnavailable: false,
  };
}

function resolveInvestingExecution(tradePlan: TradePlan): LinkedExecution {
  return {
    kind: "investing-holding",
    status: "open",
    openedAt: tradePlan.executedAt,
    closedAt: null,
    symbol: tradePlan.plannedAsset ?? "",
    quantity: null,
    riskDollars: null,
    unrealizedPnl: null,
    realizedPnl: null,
    detailUnavailable: true,
  };
}

function resolveLinkedExecution(
  tradePlan: TradePlan,
  trades: Trade[],
  positions: TradingPosition[],
): LinkedExecution | null {
  if (tradePlan.status !== "executed") return null;
  if (tradePlan.coachId === "options") return resolveOptionsExecution(tradePlan, trades);
  if (tradePlan.coachId === "trading") return resolveTradingExecution(tradePlan, positions);
  return resolveInvestingExecution(tradePlan);
}

function resolveJournalEntry(tradePlan: TradePlan, journalEntries: JournalEntry[]): { id: number; lessonLearned: string | null } | null {
  if (!tradePlan.executedTradeRef) return null;
  const entry = journalEntries.find((j) => j.tradeId !== null && j.tradeId !== undefined && String(j.tradeId) === tradePlan.executedTradeRef);
  return entry ? { id: entry.id, lessonLearned: entry.lessonLearned ?? null } : null;
}

// ─── The full, single-plan lifecycle ────────────────────────────────────

export interface UseTradeLifecycleResult {
  loading: boolean;
  error: string | null;
  tradePlan: TradePlanDetail | null;
  strategy: AiStrategyDetail | null;
  decisionStages: DecisionStage[];
  decisionScore: DecisionScore;
  weakestDecisionStage: DecisionStage | null;
  record: TradeLifecycleRecord | null;
  reload: () => void;
}

export function useTradeLifecycle(tradePlanId: number | null): UseTradeLifecycleResult {
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
        const [plan, missing] = await Promise.all([getTradePlan(tradePlanId as number), getMissingTradePlanInformation(tradePlanId as number)]);
        if (cancelled) return;
        let strat: AiStrategyDetail | null = null;
        let stratMissing: MissingSectionsResult | null = null;
        if (plan.strategyId !== null) {
          [strat, stratMissing] = await Promise.all([getStrategy(plan.strategyId).catch(() => null), getMissingSections(plan.strategyId).catch(() => null)]);
        }
        if (cancelled) return;
        setTradePlan(plan);
        setMissingInfo(missing);
        setStrategy(strat);
        setStrategyMissingSections(stratMissing);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load this trade's lifecycle.");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tradePlanId, reloadTick]);

  const { data: journalEntries } = useListJournalEntries();
  const { data: trades } = useListTrades({ limit: 200 });
  const { data: positions } = useListTradingPositions();
  const { data: learningProgress } = useGetLearningProgress();

  const EMPTY_LEARNING: LearningContext = { engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null };

  const { decisionStages, decisionScore, weakestDecisionStage, record } = useMemo(() => {
    if (!tradePlan || !missingInfo) {
      return { decisionStages: [] as DecisionStage[], decisionScore: computeDecisionScore([]), weakestDecisionStage: null as DecisionStage | null, record: null as TradeLifecycleRecord | null };
    }
    const stages = computeCoreDecisionStages({
      tradePlan,
      missingInfo,
      strategy,
      strategyMissingSections,
      review: NEUTRAL_REVIEW,
      portfolio: NEUTRAL_PORTFOLIO,
    });
    const score = computeDecisionScore(stages);
    const weakest = weakestScoredStage(stages);

    const linkedExecution = resolveLinkedExecution(tradePlan, trades ?? [], positions ?? []);
    const journalEntry = resolveJournalEntry(tradePlan, journalEntries ?? []);

    const recentHistory = (learningProgress?.recentHistory ?? []).map((h) => ({ itemKey: h.itemKey }));
    const learning = buildLearningContext(tradePlan.coachId, weakest?.id ?? null, [], recentHistory);

    const rec = computeTradeLifecycle({ tradePlan, decisionStages: stages, decisionScore: score, linkedExecution, journalEntry, learning });
    return { decisionStages: stages, decisionScore: score, weakestDecisionStage: weakest, record: rec };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradePlan, missingInfo, strategy, strategyMissingSections, trades, positions, journalEntries, learningProgress]);

  return { loading, error, tradePlan, strategy, decisionStages, decisionScore, weakestDecisionStage, record, reload };
}

// ─── The Pipeline View — every trade plan across all 3 coachIds, each
// with its own computed lifecycle record. ────────────────────────────────

export interface UseTradeLifecyclePipelineResult {
  loading: boolean;
  records: TradeLifecycleRecord[];
  reload: () => void;
}

export function useTradeLifecyclePipeline(): UseTradeLifecyclePipelineResult {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<TradePlan[]>([]);
  const [details, setDetails] = useState<Map<number, { plan: TradePlanDetail; missing: MissingTradePlanInfoResult; strategy: AiStrategyDetail | null; strategyMissing: MissingSectionsResult | null }>>(new Map());
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  const { data: journalEntries } = useListJournalEntries();
  const { data: trades } = useListTrades({ limit: 200 });
  const { data: positions } = useListTradingPositions();
  const { data: learningProgress } = useGetLearningProgress();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const byCoach = await Promise.all(COACH_IDS.map((c) => listTradePlans(c, { includeArchived: true }).catch((): TradePlan[] => [])));
      const allPlans = byCoach.flat();
      if (cancelled) return;
      setPlans(allPlans);

      const detailEntries = await Promise.all(
        allPlans.map(async (p) => {
          try {
            const [plan, missing] = await Promise.all([getTradePlan(p.id), getMissingTradePlanInformation(p.id)]);
            let strat: AiStrategyDetail | null = null;
            let stratMissing: MissingSectionsResult | null = null;
            if (plan.strategyId !== null) {
              [strat, stratMissing] = await Promise.all([getStrategy(plan.strategyId).catch(() => null), getMissingSections(plan.strategyId).catch(() => null)]);
            }
            return [p.id, { plan, missing, strategy: strat, strategyMissing: stratMissing }] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const map = new Map<number, { plan: TradePlanDetail; missing: MissingTradePlanInfoResult; strategy: AiStrategyDetail | null; strategyMissing: MissingSectionsResult | null }>();
      for (const entry of detailEntries) {
        if (entry) map.set(entry[0], entry[1]);
      }
      setDetails(map);
      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadTick]);

  const records = useMemo(() => {
    const recentHistory = (learningProgress?.recentHistory ?? []).map((h) => ({ itemKey: h.itemKey }));
    const out: TradeLifecycleRecord[] = [];
    for (const p of plans) {
      const d = details.get(p.id);
      if (!d) continue;
      const stages = computeCoreDecisionStages({
        tradePlan: d.plan,
        missingInfo: d.missing,
        strategy: d.strategy,
        strategyMissingSections: d.strategyMissing,
        review: NEUTRAL_REVIEW,
        portfolio: NEUTRAL_PORTFOLIO,
      });
      const score = computeDecisionScore(stages);
      const weakest = weakestScoredStage(stages);
      const linkedExecution = resolveLinkedExecution(d.plan, trades ?? [], positions ?? []);
      const journalEntry = resolveJournalEntry(d.plan, journalEntries ?? []);
      const learning = buildLearningContext(d.plan.coachId, weakest?.id ?? null, [], recentHistory);
      out.push(computeTradeLifecycle({ tradePlan: d.plan, decisionStages: stages, decisionScore: score, linkedExecution, journalEntry, learning }));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, details, trades, positions, journalEntries, learningProgress]);

  return { loading, records, reload };
}
