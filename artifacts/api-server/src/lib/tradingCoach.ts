// Phase 29 — Institutional Trading AI Coach.
//
// PURE ORCHESTRATION AND EDUCATIONAL LAYER. This module creates no new
// trading signal, no new probability, no new price prediction, and no
// buy/sell recommendation — it exists ONLY to explain and teach using
// outputs that already exist, exactly the same "compose, never compute"
// discipline lib/investingCoach.ts (Phase 21) established for Engine 1.
// Confirmed by construction: every field this module reads is already
// present on MultiTimeframeAnalysis (Sprint 34), LiquidityAnalysis (Sprint
// 35), SessionData (Phase 25's sessionService.ts), TradingRiskAnalysis
// (Sprint 38/44), a persisted trading_trade_plans row (Phase 25), a
// persisted trading_journal_entries row (Sprint 39), or a
// ScenarioComparisonResult (Phase 28) — none of it is fetched, computed,
// or re-derived here.
//
// The only genuinely new content in this file is STATIC, PER-COACH
// EDUCATIONAL COPY (commonMistakes / institutionalPerspective /
// howToInterpret) — hand-authored teaching material that never varies per
// symbol and never encodes a new judgment about any specific reading.
// Every per-symbol/per-plan/per-entry sentence in a TradingCoachExplanation
// is a direct quote (or a trivial relabeling/count) of a field an existing,
// already-tested engine already computed or a fact the user themselves
// already recorded (a journal entry's own mood/lesson/R-multiple).
//
// The Psychology & Discipline Coach in particular NEVER invents a
// psychological diagnosis or a "discipline score" — every sentence it
// produces is a literal tally over the user's own already-recorded journal
// fields (how many entries recorded a mood of a given kind, how many
// entries recorded a lesson learned, the sign of a recorded R-multiple).
// This is descriptive reporting over existing data, not a new prediction.

import type { MultiTimeframeAnalysis } from "./tradingMultiTimeframe.js";
import type { LiquidityAnalysis } from "./tradingLiquidity.js";
import type { SessionData } from "./tradingDomainModel.js";
import type { TradingRiskAnalysisWithContext } from "./tradingRisk.js";
import type { ScenarioComparisonResult } from "./tradingScenarioComparison.js";
import {
  computeChecklistCompletion,
  type StrategyMetadata,
  type StrategyChecklistInstance,
} from "./tradingStrategyFramework.js";

export type TradingCoachType =
  | "structure"
  | "liquidity"
  | "session"
  | "risk"
  | "trade-plan"
  | "journal"
  | "scenario"
  | "psychology"
  | "strategy";

export const TRADING_COACH_TYPES: TradingCoachType[] = [
  "structure",
  "liquidity",
  "session",
  "risk",
  "trade-plan",
  "journal",
  "scenario",
  "psychology",
  "strategy",
];

export const TRADING_COACH_LABELS: Record<TradingCoachType, string> = {
  structure: "Structure Coach",
  liquidity: "Liquidity Coach",
  session: "Session Coach",
  risk: "Risk Coach",
  "trade-plan": "Trade Plan Coach",
  journal: "Journal Coach",
  scenario: "Scenario Coach",
  psychology: "Psychology & Discipline Coach",
  strategy: "Strategy Coach",
};

// The subset of coach types resolved per-symbol (GET /trading/coach/:coach/:symbol).
export const SYMBOL_SCOPED_TRADING_COACHES: TradingCoachType[] = ["structure", "liquidity", "session", "risk", "trade-plan"];
// The subset resolved account-wide, no symbol (GET /trading/coach/:coach).
export const ACCOUNT_SCOPED_TRADING_COACHES: TradingCoachType[] = ["journal", "psychology"];
// The subset resolved by strategy id, per Phase 30's Strategy AI Coach
// Integration (GET /trading/coach/strategy/:strategyId).
export const STRATEGY_SCOPED_TRADING_COACHES: TradingCoachType[] = ["strategy"];

export interface TradingCoachEvidenceItem {
  label: string;
  detail: string;
  source: string; // which already-existing engine/field this quotes
}

export interface TradingCoachExplanation {
  coach: TradingCoachType;
  coachLabel: string;
  symbol: string | null; // null for account-wide coaches (journal, psychology)
  headline: string;
  whyThisExists: string;
  metricsUsed: TradingCoachEvidenceItem[];
  supportingEvidence: TradingCoachEvidenceItem[];
  risksReducingConfidence: string[];
  strengthsIncreasingConfidence: string[];
  howToInterpret: string[];
  commonMistakes: string[];
  institutionalPerspective: string;
  relatedGlossaryKeys: string[];
  calculationSources: string[];
  disclaimer: string;
}

export const TRADING_COACH_DISCLAIMER =
  "Institutional Trading AI Coach — Educational, Deterministic, Evidence Based. The Coach never creates a " +
  "trading signal, predicts a future price, recommends buying or selling, or invents a probability: every " +
  "figure above is a direct quote from an existing, already-computed engine (Market Structure, Multi-Timeframe " +
  "Trend, Liquidity, Session, Risk Management, Trade Plans, Trading Journal, Scenario Comparison, or your own " +
  "Strategy Framework metadata/checklists). This " +
  "module only explains and teaches using outputs that already exist — it creates no new trading logic, and " +
  "this is not trading advice.";

function ev(label: string, detail: string, source: string): TradingCoachEvidenceItem {
  return { label, detail, source };
}

// ---------------------------------------------------------------------------
// 1. Structure Coach — explains a symbol's Multi-Timeframe / Market
//    Structure trend classification (Sprint 33/34), unmodified.
// ---------------------------------------------------------------------------
export function explainStructureCoach(symbol: string, multiTimeframe: MultiTimeframeAnalysis): TradingCoachExplanation {
  const timeframes = multiTimeframe.timeframes;
  const metricsUsed: TradingCoachEvidenceItem[] = timeframes.map((tf) =>
    ev(`${tf.interval} trend`, `${tf.structure.trend} (${tf.structure.confidenceLevel} confidence) — ${tf.structure.trendDetail}`, "Market Structure Engine"),
  );
  const supportingEvidence: TradingCoachEvidenceItem[] = timeframes.flatMap((tf) =>
    tf.structure.zones.slice(0, 3).map((z) => ev(`${tf.interval} ${z.kind} zone`, `@ ${z.price} — ${z.strength} swing touch(es)`, "Market Structure Engine")),
  );

  const risksReducingConfidence: string[] = [];
  if (multiTimeframe.trendAgreement === "split") risksReducingConfidence.push("Timeframes genuinely disagree on direction — no single dominant trend exists.");
  timeframes.filter((tf) => tf.structure.confidenceLevel === "Low").forEach((tf) => risksReducingConfidence.push(`${tf.interval} structure read has Low confidence: ${tf.structure.confidenceExplanation}`));

  const strengthsIncreasingConfidence: string[] = [];
  if (multiTimeframe.trendAgreement === "unanimous") strengthsIncreasingConfidence.push(`All ${timeframes.length} reviewed timeframes agree on ${multiTimeframe.dominantTrend ?? "the same"} trend.`);
  if (multiTimeframe.confluenceScore != null) strengthsIncreasingConfidence.push(`${multiTimeframe.confluenceScore}% of reviewed timeframes share the dominant trend.`);

  return {
    coach: "structure",
    coachLabel: TRADING_COACH_LABELS.structure,
    symbol,
    headline: multiTimeframe.dominantTrend
      ? `${symbol} reads ${multiTimeframe.dominantTrend} with ${multiTimeframe.trendAgreement} agreement across ${timeframes.length} timeframes.`
      : `${symbol}'s timeframes do not share a single dominant trend (${multiTimeframe.trendAgreement}).`,
    whyThisExists:
      `Market Structure classifies trend from swing highs/lows detected in real candle data: higher highs + higher lows read uptrend, lower highs + lower lows read downtrend, ` +
      `anything else honestly reads range — never a forced or fabricated direction. ${multiTimeframe.summary}`,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence,
    strengthsIncreasingConfidence,
    howToInterpret: [
      "A support/resistance zone's strength is how many separate swing touches clustered near that price — more touches means a more meaningfully defended level.",
      "Confluence score is the % of reviewed timeframes sharing the dominant trend — 100% means every timeframe agrees, not a probability of future continuation.",
      "A 'range' read is not a failure of the engine — it honestly means no clear higher-highs/higher-lows or lower-highs/lower-lows sequence was detected.",
    ],
    commonMistakes: [
      "Treating a single timeframe's trend as the whole picture — always check whether shorter and longer timeframes actually agree.",
      "Assuming a strong zone guarantees a bounce or breakout — strength describes how often price has reacted there before, not what happens next.",
    ],
    institutionalPerspective:
      "Institutional desks routinely require multi-timeframe confluence before treating a trend read as durable — a single-timeframe signal with no supporting structure on adjacent horizons is treated with far less weight.",
    relatedGlossaryKeys: ["market-structure", "multi-timeframe-confluence", "support-resistance-zone"],
    calculationSources: ["Market Structure Engine (Sprint 33)", "Multi-Timeframe Trend Engine (Sprint 34)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 2. Liquidity Coach — explains a symbol's Liquidity Engine reading
//    (Sprint 35), unmodified.
// ---------------------------------------------------------------------------
export function explainLiquidityCoach(symbol: string, liquidity: LiquidityAnalysis): TradingCoachExplanation {
  const metricsUsed: TradingCoachEvidenceItem[] = [
    ev("Liquidity band", liquidity.liquidityBand, "Liquidity Engine"),
    ev("Average dollar volume", `$${liquidity.avgDollarVolume.toLocaleString()}`, "Liquidity Engine"),
    ev("Buy/sell pressure", `${liquidity.buySellPressure.direction} (${liquidity.buySellPressure.buyPct.toFixed(0)}% buy / ${liquidity.buySellPressure.sellPct.toFixed(0)}% sell)`, "Liquidity Engine"),
  ];
  const supportingEvidence: TradingCoachEvidenceItem[] = liquidity.volumeProfile
    .slice(0, 3)
    .map((v) => ev(`Volume level @ ${v.price}`, `${v.pctOfTotal.toFixed(1)}% of sampled volume`, "Liquidity Engine"));

  const risksReducingConfidence: string[] = [];
  if (liquidity.confidenceLevel === "Low") risksReducingConfidence.push(`Confidence is Low: ${liquidity.confidenceExplanation}`);
  if (liquidity.liquidityBand === "Low") risksReducingConfidence.push("Liquidity band is Low — thinner trading activity than the engine's High/Moderate thresholds.");

  const strengthsIncreasingConfidence: string[] = [];
  if (liquidity.confidenceLevel === "High") strengthsIncreasingConfidence.push("Confidence is High — a large enough candle sample was available to score this reading.");
  if (liquidity.liquidityBand === "High") strengthsIncreasingConfidence.push("Liquidity band is High — average dollar volume clears the engine's own High-liquidity threshold.");

  return {
    coach: "liquidity",
    coachLabel: TRADING_COACH_LABELS.liquidity,
    symbol,
    headline: `${symbol} reads ${liquidity.liquidityBand} liquidity with ${liquidity.buySellPressure.direction} pressure.`,
    whyThisExists:
      `The Liquidity Engine buckets real candle volume into price levels (a volume profile), scores an average-dollar-volume-based liquidity band, and derives a buy/sell pressure proxy directly ` +
      `from each candle's own already-recorded up/down close — never a separately fabricated imbalance number. ${liquidity.summary}`,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence,
    strengthsIncreasingConfidence,
    howToInterpret: [
      "The volume profile lists the price levels where the most trading activity actually occurred in the sampled window — not a prediction of where price will go next.",
      "Buy/sell pressure reads a bullish candle's volume as buying pressure and a bearish candle's as selling pressure; a doji's volume is excluded from the directional total rather than guessed either way.",
      "A Low liquidity band means thinner average dollar volume than the engine's own High/Moderate bands — it does not by itself say anything about direction.",
    ],
    commonMistakes: [
      "Confusing 'high buying pressure' with a buy signal — this is a description of which side's volume dominated recently, not a forecast.",
      "Ignoring liquidity band when position sizing — thinner liquidity can mean wider effective spreads and slippage, a cost the Risk Coach's own position sizing does not model directly.",
    ],
    institutionalPerspective:
      "Institutional order-flow desks track volume-at-price and participation imbalance as descriptive facts about recent trading, using them to size execution — not as standalone directional signals.",
    relatedGlossaryKeys: ["liquidity-band", "volume-profile", "buy-sell-pressure"],
    calculationSources: ["Liquidity Engine (Sprint 35)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 3. Session Coach — explains active trading sessions and today's session
//    high/low (Phase 25's sessionService.ts), unmodified.
// ---------------------------------------------------------------------------
export function explainSessionCoach(symbol: string, session: SessionData | null): TradingCoachExplanation {
  const activeSessions = session?.activeSessions ?? [];
  const metricsUsed: TradingCoachEvidenceItem[] = session
    ? [
        ev("Active sessions", activeSessions.length ? activeSessions.join(", ") : "none currently open", "Session Service"),
        ev("Session high", session.sessionHigh != null ? `${session.sessionHigh}` : "unavailable", "Session Service"),
        ev("Session low", session.sessionLow != null ? `${session.sessionLow}` : "unavailable", "Session Service"),
      ]
    : [];

  const strengthsIncreasingConfidence: string[] = [];
  if (activeSessions.length > 1) strengthsIncreasingConfidence.push(`${activeSessions.length} sessions are overlapping right now (${activeSessions.join(" + ")}) — overlap windows are when the most participants are active simultaneously.`);

  return {
    coach: "session",
    coachLabel: TRADING_COACH_LABELS.session,
    symbol,
    headline: session
      ? activeSessions.length
        ? `${activeSessions.length} session${activeSessions.length === 1 ? " is" : "s are"} currently open for ${symbol}: ${activeSessions.join(", ")}.`
        : `No named trading session is currently open for ${symbol}.`
      : `Session data is not available for ${symbol}.`,
    whyThisExists:
      "Sessions are fixed, named UTC time windows (Sydney/Tokyo/London/New York) — reference data, not a live feed. 'Active' simply means the current time falls inside that window's own start/end UTC hours; " +
      "session high/low are the real intraday extremes realized so far today.",
    metricsUsed,
    supportingEvidence: [],
    risksReducingConfidence: session ? [] : ["Session data could not be resolved for this symbol."],
    strengthsIncreasingConfidence,
    howToInterpret: [
      "A session window is a fixed reference schedule, not a claim about how active or liquid the market actually is right now — cross-check the Liquidity Coach for that.",
      "An overlap (e.g. London + New York) is simply two windows both being open at once, by the calendar — not itself a signal.",
    ],
    commonMistakes: [
      "Treating 'session open' as equivalent to 'high liquidity' — they are different concepts computed by different engines.",
      "Forgetting that session windows are fixed UTC hours and do not adjust for daylight saving in any particular market.",
    ],
    institutionalPerspective:
      "Institutional desks use session overlap windows mainly for execution-timing awareness (when the most global participants are likely active), not as a standalone trading signal.",
    relatedGlossaryKeys: ["trading-session", "session-overlap"],
    calculationSources: ["Session Service (Phase 25)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 4. Risk Coach — explains the user's own portfolio-wide Risk Management
//    analysis (Sprint 38/44), unmodified. Same fields the Risk Studio's
//    own panels already display (Phase 28), just explained rather than
//    only shown.
// ---------------------------------------------------------------------------
export function explainRiskCoach(symbol: string | null, risk: TradingRiskAnalysisWithContext): TradingCoachExplanation {
  const metricsUsed: TradingCoachEvidenceItem[] = [
    ev("Overall risk", risk.overall.label, "Risk Management Engine"),
    ev("Position sizing", risk.positionSizing.label, "Risk Management Engine"),
    ev("Stop/target discipline", risk.stopDiscipline.label, "Risk Management Engine"),
    ev("Portfolio risk budget", risk.portfolioBudget.label, "Risk Management Engine"),
  ];
  const supportingEvidence: TradingCoachEvidenceItem[] = risk.portfolioBudget.perPosition
    .slice(0, 5)
    .map((p) => ev(p.symbol, p.riskDollars != null ? `$${p.riskDollars.toFixed(2)} risked (${(p.riskPct ?? 0).toFixed(2)}% of account)` : "risk not computable — no stop defined", "Risk Management Engine"));

  const risksReducingConfidence: string[] = [];
  if (risk.positionSizing.capBreached) risksReducingConfidence.push(`Position sizing cap breached: ${risk.positionSizing.detail}`);
  if (risk.portfolioBudget.capBreached) risksReducingConfidence.push(`Portfolio risk budget cap breached: ${risk.portfolioBudget.detail}`);
  if (risk.stopDiscipline.missingStopSymbols.length) risksReducingConfidence.push(`No stop defined for: ${risk.stopDiscipline.missingStopSymbols.join(", ")}.`);
  if (risk.stopDiscipline.missingTargetSymbols.length) risksReducingConfidence.push(`No target defined for: ${risk.stopDiscipline.missingTargetSymbols.join(", ")}.`);

  const strengthsIncreasingConfidence: string[] = [];
  if (!risk.positionSizing.capBreached && risk.positionSizing.score != null) strengthsIncreasingConfidence.push("No single position breaches the position-sizing cap.");
  if (risk.stopDiscipline.positionsFullyPlanned === risk.openPositionsCount && risk.openPositionsCount > 0) strengthsIncreasingConfidence.push("Every open position has both a stop and a target defined.");

  return {
    coach: "risk",
    coachLabel: TRADING_COACH_LABELS.risk,
    symbol,
    headline: `Overall portfolio risk reads ${risk.overall.label}${risk.openPositionsCount > 0 ? ` across ${risk.openPositionsCount} open position(s)` : ", with no open positions"}.`,
    whyThisExists:
      "The Risk Management Engine scores three components — Position Sizing (largest single position's dollar risk vs. a named cap), Stop/Target Discipline (what fraction of open positions have both defined), " +
      "and Portfolio Risk Budget (aggregate dollar risk across all stop-defined positions vs. a named cap) — and blends them, with a hard-cap override if either dollar-risk cap is breached. " +
      `${risk.overall.detail}`,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence,
    strengthsIncreasingConfidence,
    howToInterpret: [
      "Position size is derived from your own stated account risk % and stop distance — it is not a recommendation of how large to trade, only the arithmetic result of the numbers you entered.",
      "A capped overall score (e.g. 60) means a hard dollar-risk cap was breached, regardless of how the other components scored — the cap always wins.",
      "'Risk not computable' for a position simply means no stop price was defined for it — never treated as zero risk.",
    ],
    commonMistakes: [
      "Reading a Weak/Poor overall score as a prediction of loss — it describes how much of your capital is exposed today, not what will happen to the trade.",
      "Ignoring stop/target discipline because the position sizing score looks fine — a large, well-sized position with no stop still has fully undefined risk.",
    ],
    institutionalPerspective:
      "Institutional risk desks enforce hard per-position and portfolio-level dollar caps precisely so a single mis-sized position cannot silently dominate total account risk — the same override logic used here.",
    relatedGlossaryKeys: ["trading-position-sizing", "risk-reward-ratio", "portfolio-risk-budget", "trading-capital-allocation"],
    calculationSources: ["Risk Management Engine (Sprint 38/44)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 5. Trade Plan Coach — explains the user's own most recent saved Trade
//    Plan for a symbol (Phase 25's trading_trade_plans, computeRiskParameters()
//    output already stored on the row), unmodified.
// ---------------------------------------------------------------------------
export interface TradePlanCoachInput {
  id: number;
  symbol: string;
  direction: string;
  status: string;
  thesis: string;
  risk: {
    accountRiskPct: number;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    positionSize: number | null;
    riskRewardRatio: number | null;
  };
  createdAt: string;
}

export function explainTradePlanCoach(symbol: string, plan: TradePlanCoachInput | null): TradingCoachExplanation {
  if (!plan) {
    return {
      coach: "trade-plan",
      coachLabel: TRADING_COACH_LABELS["trade-plan"],
      symbol,
      headline: `No trade plan has been saved yet for ${symbol}.`,
      whyThisExists: "The Trade Plan Coach explains your own most recently saved Trade Plan (Entry/Stop/Target Planning, Trade Planning & Risk Studio) — none exists yet for this symbol.",
      metricsUsed: [],
      supportingEvidence: [],
      risksReducingConfidence: [],
      strengthsIncreasingConfidence: [],
      howToInterpret: ["Create a Trade Plan in the Trade Planning & Risk Studio's Entry/Stop/Target Planning panels, then return here to have it explained."],
      commonMistakes: [],
      institutionalPerspective: "A documented plan — entry, stop, target, thesis — before a trade is opened is a baseline institutional discipline, distinct from any specific direction being recommended here.",
      relatedGlossaryKeys: ["trade-plan"],
      calculationSources: ["Trade Plans (Phase 25)"],
      disclaimer: TRADING_COACH_DISCLAIMER,
    };
  }

  const metricsUsed: TradingCoachEvidenceItem[] = [
    ev("Direction", plan.direction, "Trade Plan"),
    ev("Entry / Stop / Target", `${plan.risk.entryPrice} / ${plan.risk.stopPrice} / ${plan.risk.targetPrice}`, "Trade Plan"),
    ev("Account risk %", `${plan.risk.accountRiskPct}%`, "Trade Plan"),
    ev("Position size", plan.risk.positionSize != null ? `${plan.risk.positionSize} shares` : "not computable — no account value supplied", "computeRiskParameters()"),
    ev("Risk/reward ratio", plan.risk.riskRewardRatio != null ? `${plan.risk.riskRewardRatio.toFixed(2)}:1` : "not computable — zero stop distance", "computeRiskParameters()"),
  ];

  const risksReducingConfidence: string[] = [];
  if (plan.risk.positionSize == null) risksReducingConfidence.push("Position size could not be derived — no account value was supplied when this plan was saved.");
  if (plan.risk.riskRewardRatio == null) risksReducingConfidence.push("Risk/reward ratio could not be derived — entry and stop are the same price.");
  if (!plan.thesis.trim()) risksReducingConfidence.push("No thesis was recorded for this plan.");

  const strengthsIncreasingConfidence: string[] = [];
  if (plan.risk.riskRewardRatio != null && plan.risk.riskRewardRatio >= 2) strengthsIncreasingConfidence.push(`Risk/reward ratio of ${plan.risk.riskRewardRatio.toFixed(2)}:1 clears a common 2:1 discretionary-trading convention.`);
  if (plan.thesis.trim()) strengthsIncreasingConfidence.push("A thesis was recorded for this plan.");

  return {
    coach: "trade-plan",
    coachLabel: TRADING_COACH_LABELS["trade-plan"],
    symbol,
    headline: `${symbol} ${plan.direction} plan (status: ${plan.status}) — position size ${plan.risk.positionSize != null ? `${plan.risk.positionSize} shares` : "not computed"}, R:R ${plan.risk.riskRewardRatio != null ? `${plan.risk.riskRewardRatio.toFixed(2)}:1` : "not computed"}.`,
    whyThisExists:
      "Position size and risk/reward ratio are pure arithmetic over the numbers you entered — computeRiskParameters() divides your account-risk dollar amount by the per-share stop distance for position size, " +
      "and divides the reward distance by the risk distance for risk/reward — never a judgment on whether these particular levels are good.",
    metricsUsed,
    supportingEvidence: [ev("Thesis", plan.thesis || "(none recorded)", "Trade Plan"), ev("Saved", new Date(plan.createdAt).toLocaleString(), "Trade Plan")],
    risksReducingConfidence,
    strengthsIncreasingConfidence,
    howToInterpret: [
      "Position size answers 'how many shares does my stated account-risk % actually allow, given this stop distance' — it does not validate that the stop distance itself is well-placed.",
      "A risk/reward ratio below 1:1 means the planned loss distance is larger than the planned gain distance — a fact about the numbers entered, not a warning against the trade.",
    ],
    commonMistakes: [
      "Saving a plan with entry and stop at the same price, then being confused why risk/reward is not computable — the ratio needs a real, non-zero stop distance.",
      "Treating an old, unreviewed plan's numbers as still current — re-check structure/liquidity/risk before treating a stale plan as your live intent.",
    ],
    institutionalPerspective:
      "Institutional trade planning always states entry, stop, and target — and the resulting size/ratio — before capital moves, precisely so a plan can be reviewed and critiqued on its own stated terms afterward.",
    relatedGlossaryKeys: ["trade-plan", "trading-position-sizing", "risk-reward-ratio"],
    calculationSources: ["Trade Plans (Phase 25)", "computeRiskParameters() (Phase 24)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 6 & 8. Journal Coach and Psychology & Discipline Coach — both explain the
//    user's own already-recorded Trading Journal entries (Sprint 39/46),
//    unmodified. Pure, deterministic tallies over already-recorded fields —
//    never a fabricated psychological read.
// ---------------------------------------------------------------------------
export interface JournalCoachEntryInput {
  title: string;
  mood: string;
  lessonLearned: string | null;
  rMultiple: number | null;
  setupType: string | null;
  createdAt: string;
}

export function explainJournalCoach(entries: JournalCoachEntryInput[]): TradingCoachExplanation {
  if (entries.length === 0) {
    return {
      coach: "journal",
      coachLabel: TRADING_COACH_LABELS.journal,
      symbol: null,
      headline: "No Trading Journal entries have been recorded yet.",
      whyThisExists: "The Journal Coach explains your own already-recorded Trading Journal entries — none exist yet.",
      metricsUsed: [],
      supportingEvidence: [],
      risksReducingConfidence: [],
      strengthsIncreasingConfidence: [],
      howToInterpret: ["Record entries in the Trading Journal, then return here for a summary of what you've documented."],
      commonMistakes: [],
      institutionalPerspective: "Consistent journaling — even brief entries — is a baseline institutional discipline for later post-trade review.",
      relatedGlossaryKeys: ["trading-journal"],
      calculationSources: ["Trading Journal (Sprint 39)"],
      disclaimer: TRADING_COACH_DISCLAIMER,
    };
  }

  const withLesson = entries.filter((e) => e.lessonLearned && e.lessonLearned.trim());
  const withSetup = entries.filter((e) => e.setupType && e.setupType.trim());
  const moodCounts = new Map<string, number>();
  entries.forEach((e) => moodCounts.set(e.mood, (moodCounts.get(e.mood) ?? 0) + 1));
  const mostCommonMood = [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const metricsUsed: TradingCoachEvidenceItem[] = [
    ev("Entries recorded", `${entries.length}`, "Trading Journal"),
    ev("Entries with a lesson learned", `${withLesson.length} of ${entries.length}`, "Trading Journal"),
    ev("Entries with a setup type recorded", `${withSetup.length} of ${entries.length}`, "Trading Journal"),
    ev("Most common recorded mood", mostCommonMood ? `${mostCommonMood[0]} (${mostCommonMood[1]} entries)` : "n/a", "Trading Journal"),
  ];

  const supportingEvidence: TradingCoachEvidenceItem[] = entries.slice(0, 5).map((e) => ev(e.title, `mood: ${e.mood}${e.lessonLearned ? `, lesson: ${e.lessonLearned}` : ", no lesson recorded"}`, "Trading Journal"));

  return {
    coach: "journal",
    coachLabel: TRADING_COACH_LABELS.journal,
    symbol: null,
    headline: `${entries.length} journal entr${entries.length === 1 ? "y" : "ies"} recorded — ${withLesson.length} include a lesson learned.`,
    whyThisExists: "The Journal Coach tallies your own already-recorded entries — every count here is a direct read of fields you filled in yourself, never a new interpretation of them.",
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: withLesson.length < entries.length ? [`${entries.length - withLesson.length} of ${entries.length} entries have no lesson learned recorded.`] : [],
    strengthsIncreasingConfidence: withLesson.length === entries.length ? ["Every recorded entry includes a lesson learned."] : [],
    howToInterpret: [
      "'Improving your documentation' here means literally recording more of the optional fields (lesson learned, setup type) on future entries — not a claim about your trading performance.",
      "Mood counts reflect whichever mood tag you selected when writing the entry — a record of self-reported state, not a diagnosis.",
    ],
    commonMistakes: [
      "Writing an entry immediately after a trade closes but skipping the lesson-learned field — that field is exactly where the most reusable insight tends to live.",
      "Only journaling losing trades — reviewing winners with the same discipline shows whether the plan or the outcome was actually good.",
    ],
    institutionalPerspective:
      "Institutional post-trade review processes specifically require a documented lesson for every reviewed trade, win or loss, precisely so future decisions can cite a specific prior instance rather than a vague memory.",
    relatedGlossaryKeys: ["trading-journal", "r-multiple"],
    calculationSources: ["Trading Journal (Sprint 39)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

export function explainPsychologyCoach(entries: JournalCoachEntryInput[]): TradingCoachExplanation {
  if (entries.length === 0) {
    return {
      coach: "psychology",
      coachLabel: TRADING_COACH_LABELS.psychology,
      symbol: null,
      headline: "No Trading Journal entries have been recorded yet.",
      whyThisExists: "The Psychology & Discipline Coach tallies your own already-recorded journal fields (mood, lessons, recorded outcomes) — none exist yet.",
      metricsUsed: [],
      supportingEvidence: [],
      risksReducingConfidence: [],
      strengthsIncreasingConfidence: [],
      howToInterpret: ["Record entries in the Trading Journal, then return here."],
      commonMistakes: [],
      institutionalPerspective: "Discipline is measured here purely by documentation consistency — how regularly and completely you record your own decisions — never by a fabricated psychological score.",
      relatedGlossaryKeys: ["trading-journal"],
      calculationSources: ["Trading Journal (Sprint 39)"],
      disclaimer: TRADING_COACH_DISCLAIMER,
    };
  }

  const withRMultiple = entries.filter((e) => e.rMultiple != null);
  const wins = withRMultiple.filter((e) => (e.rMultiple as number) > 0);
  const losses = withRMultiple.filter((e) => (e.rMultiple as number) < 0);
  const withLesson = entries.filter((e) => e.lessonLearned && e.lessonLearned.trim());
  const documentationRatio = entries.length > 0 ? (withLesson.length / entries.length) * 100 : 0;

  const metricsUsed: TradingCoachEvidenceItem[] = [
    ev("Entries with a recorded R-multiple", `${withRMultiple.length} of ${entries.length}`, "Trading Journal"),
    ev("Recorded as a win (R > 0)", `${wins.length}`, "Trading Journal"),
    ev("Recorded as a loss (R < 0)", `${losses.length}`, "Trading Journal"),
    ev("Documentation ratio (lesson learned recorded)", `${documentationRatio.toFixed(0)}%`, "Trading Journal"),
  ];

  const risksReducingConfidence: string[] = [];
  if (documentationRatio < 50) risksReducingConfidence.push(`Only ${documentationRatio.toFixed(0)}% of entries record a lesson learned — the majority of reviewed trades have no documented takeaway.`);
  if (withRMultiple.length === 0) risksReducingConfidence.push("No entry has a recorded R-multiple yet, so no win/loss tally is possible.");

  const strengthsIncreasingConfidence: string[] = [];
  if (documentationRatio >= 80) strengthsIncreasingConfidence.push(`${documentationRatio.toFixed(0)}% of entries record a lesson learned — consistent documentation.`);

  return {
    coach: "psychology",
    coachLabel: TRADING_COACH_LABELS.psychology,
    symbol: null,
    headline:
      withRMultiple.length > 0
        ? `${wins.length} recorded win(s) vs. ${losses.length} recorded loss(es) across ${withRMultiple.length} entries with an R-multiple; ${documentationRatio.toFixed(0)}% documented with a lesson.`
        : `${entries.length} entries recorded; ${documentationRatio.toFixed(0)}% documented with a lesson.`,
    whyThisExists:
      "This coach reports discipline as documentation consistency — how completely and regularly you record your own trades' mood, lesson, and outcome — computed purely from counting the fields you " +
      "already filled in. It never scores your psychology or predicts your future behavior from this data.",
    metricsUsed,
    supportingEvidence: entries.slice(0, 5).map((e) => ev(e.title, `mood: ${e.mood}${e.rMultiple != null ? `, R: ${e.rMultiple > 0 ? "+" : ""}${e.rMultiple.toFixed(2)}` : ""}`, "Trading Journal")),
    risksReducingConfidence,
    strengthsIncreasingConfidence,
    howToInterpret: [
      "Documentation ratio is a simple % of entries with a non-empty lesson-learned field — a proxy for review discipline, not for trading skill.",
      "Win/loss counts here reflect whichever R-multiple you yourself recorded on the entry — this coach never recomputes a P&L or infers an outcome you didn't record.",
    ],
    commonMistakes: [
      "Journaling only after a stretch of losses — consistent documentation regardless of outcome is what makes the tally meaningful.",
      "Treating a low documentation ratio as a character flaw rather than a fixable habit — the fix is simply filling in the field next time.",
    ],
    institutionalPerspective:
      "Institutional trading psychology programs typically measure discipline through process adherence metrics like this one (documentation completeness, plan-vs-execution consistency) rather than subjective self-assessment.",
    relatedGlossaryKeys: ["trading-journal", "r-multiple"],
    calculationSources: ["Trading Journal (Sprint 39)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 7. Scenario Coach — explains a Scenario Comparison result (Phase 28's
//    computeScenarioComparison(), unmodified). Stateless — the client
//    supplies the same scenario inputs it already used for
//    POST /trading/trade-plans/scenarios/compare, and the coach explains
//    the resulting comparison, never a persisted object.
// ---------------------------------------------------------------------------
export function explainScenarioCoach(comparison: ScenarioComparisonResult): TradingCoachExplanation {
  if (comparison.scenarios.length === 0) {
    return {
      coach: "scenario",
      coachLabel: TRADING_COACH_LABELS.scenario,
      symbol: comparison.symbol,
      headline: "No scenarios were provided to compare.",
      whyThisExists: "The Scenario Coach explains a Scenario Comparison result — none was computed.",
      metricsUsed: [],
      supportingEvidence: [],
      risksReducingConfidence: [],
      strengthsIncreasingConfidence: [],
      howToInterpret: ["Enter 2-5 named scenarios in the Scenario Comparison panel, then return here."],
      commonMistakes: [],
      institutionalPerspective: "Comparing multiple candidate entry/stop/target combinations before committing to one is standard pre-trade practice.",
      relatedGlossaryKeys: ["scenario-comparison"],
      calculationSources: ["Scenario Comparison (Phase 28)"],
      disclaimer: TRADING_COACH_DISCLAIMER,
    };
  }

  const metricsUsed: TradingCoachEvidenceItem[] = comparison.scenarios.map((s) =>
    ev(
      s.name,
      `${s.direction}, position size ${s.risk.positionSize != null ? `${s.risk.positionSize} shares` : "n/a"}, R:R ${s.risk.riskRewardRatio != null ? `${s.risk.riskRewardRatio.toFixed(2)}:1` : "n/a"}`,
      "computeRiskParameters()",
    ),
  );

  const strengthsIncreasingConfidence: string[] = [];
  if (comparison.bestRiskRewardName) strengthsIncreasingConfidence.push(`"${comparison.bestRiskRewardName}" has the highest risk/reward ratio among the compared scenarios.`);
  if (comparison.tightestRiskName) strengthsIncreasingConfidence.push(`"${comparison.tightestRiskName}" has the smallest computed position size (tightest dollar risk) among the compared scenarios.`);

  const risksReducingConfidence: string[] = [];
  if (!comparison.bestRiskRewardName) risksReducingConfidence.push("No scenario has a computable risk/reward ratio — check for a zero stop distance.");
  if (!comparison.tightestRiskName) risksReducingConfidence.push("No scenario has a computable position size — an account value may be missing.");

  return {
    coach: "scenario",
    coachLabel: TRADING_COACH_LABELS.scenario,
    symbol: comparison.symbol,
    headline: `${comparison.scenarios.length} scenario(s) compared.${comparison.bestRiskRewardName ? ` "${comparison.bestRiskRewardName}" has the best risk/reward ratio.` : ""}`,
    whyThisExists:
      "Scenario Comparison runs the same computeRiskParameters() function once per named scenario you're still deciding between. " +
      '"Best R:R" and "Tightest Risk" are honest max/min identifications over those already-computed numbers — never a new formula, and never a recommendation on which scenario to actually take. ' +
      comparison.summary,
    metricsUsed,
    supportingEvidence: [],
    risksReducingConfidence,
    strengthsIncreasingConfidence,
    howToInterpret: [
      '"Best R:R" means highest risk/reward ratio among the scenarios you entered — it says nothing about which scenario is more likely to actually reach its target.',
      '"Tightest Risk" means smallest computed position size (smallest dollar risk) — a smaller position is not inherently a better trade, only a smaller one.',
      "None of these scenarios are saved automatically — only submitting the Entry/Stop/Target Planning form creates a real, persisted Trade Plan.",
    ],
    commonMistakes: [
      'Treating "Best R:R" as "the recommended trade" — the Coach never recommends one scenario over another, it only reports which number is numerically higher or lower.',
      "Comparing scenarios with inconsistent account-risk % assumptions and then reading the resulting position sizes as directly comparable.",
    ],
    institutionalPerspective:
      "Institutional traders routinely sketch several candidate entry/stop/target combinations before committing capital, comparing the resulting size and ratio side by side — the same workflow this panel supports.",
    relatedGlossaryKeys: ["scenario-comparison", "risk-reward-ratio", "trading-position-sizing"],
    calculationSources: ["Scenario Comparison (Phase 28)", "computeRiskParameters() (Phase 24)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 9. Strategy Coach (Phase 30, Institutional Strategy Framework) — explains
//    a user's own registered Strategy Metadata and, if supplied, one of its
//    own Checklist instances. Zero new logic: category/timeframes/markets/
//    required evidence/educational notes/references are direct quotes of
//    the strategy's own persisted fields, and checklist completion is
//    computeChecklistCompletion() (tradingStrategyFramework.ts) — the exact
//    same function the Checklist Viewer UI itself calls. This coach never
//    evaluates whether the strategy ITSELF is sound — only reports what was
//    authored and how much of a checklist instance has been completed.
// ---------------------------------------------------------------------------
export function explainStrategyCoach(
  strategy: StrategyMetadata,
  checklist: StrategyChecklistInstance | null,
): TradingCoachExplanation {
  const metricsUsed: TradingCoachEvidenceItem[] = [
    ev("Category", strategy.category, "Strategy Metadata"),
    ev("Timeframes", strategy.timeframes.join(", "), "Strategy Metadata"),
    ev("Markets", strategy.markets.join(", "), "Strategy Metadata"),
    ev("Required evidence", strategy.requiredEvidence.join(", "), "Strategy Metadata"),
    ev("Checklist items", `${strategy.checklist.length} defined (${strategy.checklist.filter((c) => c.required).length} required)`, "Strategy Metadata"),
    ev("Version", strategy.version, "Strategy Metadata"),
  ];

  const supportingEvidence: TradingCoachEvidenceItem[] = [];
  if (strategy.educationalNotes.trim()) supportingEvidence.push(ev("Educational notes", strategy.educationalNotes, "Strategy Metadata"));
  if (strategy.references.length > 0) supportingEvidence.push(ev("References", strategy.references.join("; "), "Strategy Metadata"));

  const risksReducingConfidence: string[] = [];
  const strengthsIncreasingConfidence: string[] = [];
  let checklistLine = "No checklist instance has been started for this strategy yet.";

  if (checklist) {
    const summary = computeChecklistCompletion(checklist.items);
    checklistLine = `Checklist${checklist.symbol ? ` for ${checklist.symbol}` : ""}: ${summary.requiredCompleted}/${summary.requiredTotal} required item(s) complete (${summary.percentComplete}% overall), status: ${checklist.status}.`;
    metricsUsed.push(
      ev(
        "Checklist completion",
        `${summary.requiredCompleted}/${summary.requiredTotal} required, ${summary.optionalCompleted}/${summary.optionalTotal} optional`,
        "computeChecklistCompletion()",
      ),
    );
    if (summary.allRequiredComplete) strengthsIncreasingConfidence.push("Every required checklist item has been marked complete.");
    else risksReducingConfidence.push(`${summary.requiredTotal - summary.requiredCompleted} required checklist item(s) are still incomplete.`);

    const missingEvidence = checklist.items.filter((i) => i.required && i.evidenceLinks.length === 0);
    if (missingEvidence.length > 0)
      risksReducingConfidence.push(`${missingEvidence.length} required item(s) have no evidence link attached yet: ${missingEvidence.map((i) => i.label).join(", ")}.`);
  } else {
    risksReducingConfidence.push("No checklist instance exists yet for this strategy — the Checklist Engine cannot report a completion state.");
  }

  return {
    coach: "strategy",
    coachLabel: TRADING_COACH_LABELS.strategy,
    symbol: checklist?.symbol ?? null,
    headline: `"${strategy.name}" (${strategy.category}) — ${checklistLine}`,
    whyThisExists:
      "The Strategy Coach explains your own registered Strategy Framework entry — its metadata (category, timeframes, markets, required evidence) and, if one exists, a Checklist instance's own completion state, exactly as computeChecklistCompletion() reports it. It never evaluates whether the strategy's own rules are sound — that judgment belongs entirely to you.",
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence,
    strengthsIncreasingConfidence,
    howToInterpret: [
      "Required evidence lists which existing engine outputs this strategy's own author decided are relevant to check — the platform does not verify that decision, only surfaces it.",
      "Checklist completion is a literal count of items you marked done yourself, each optionally with your own evidence-link citation — never an automatic pass/fail on the trade.",
    ],
    commonMistakes: [
      "Treating 100% checklist completion as a signal to enter a trade — completion means the checklist was filled out, not that any underlying condition is favorable.",
      "Registering a strategy's required evidence sources but never actually attaching an evidence link when completing a checklist item — leaving the citation trail empty.",
    ],
    institutionalPerspective:
      "Formalizing a personal methodology as named, versioned metadata with an explicit checklist and required evidence — rather than relying on memory — is a basic institutional-discipline practice, independent of what the methodology itself says.",
    relatedGlossaryKeys: ["trading-strategy-framework", "strategy-checklist", "strategy-evidence-link"],
    calculationSources: ["Strategy Framework (Phase 30)", "computeChecklistCompletion() (Phase 30)"],
    disclaimer: TRADING_COACH_DISCLAIMER,
  };
}
