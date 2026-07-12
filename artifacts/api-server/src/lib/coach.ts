// AI Trading Coach — deterministic explanation & tutoring engine.
//
// This module is the "always-accurate" half of the hybrid coach. Every number it
// produces (strikes, Greeks, POP, EV, max loss, breakevens, Ravish breakdown) is
// computed from the same optionsMath/risk engine the rest of the platform uses, so
// the teaching layer can never drift from the real trade math. The LLM layer
// (coachLLM.ts) only narrates these facts into prose — it never invents figures.
//
// CRITICAL: this is a read-only teaching module. It resolves and explains
// candidates but NEVER previews, submits, or executes an order.

import {
  getSnapshot,
  bs,
  ravishScore,
  buildIronCondor,
  type StrategyQuote,
  type QuoteLeg,
} from "./optionsMath.js";
import { canonicalQuote } from "./execution.js";

export const COACH_DISCLAIMER =
  "Educational analysis only — not financial advice or a recommendation to place a trade. The Ravish Engine never executes orders on your behalf; any trade is a manual decision you make and confirm yourself on the Trade Ticket.";

export const STRATEGY_LABELS: Record<string, string> = {
  iron_condor: "Iron Condor",
  iron_fly: "Iron Fly",
  calendar_spread: "Calendar Spread",
  earnings: "Earnings IV-Crush",
};

export function strategyLabel(s: string): string {
  return STRATEGY_LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return 30;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

export interface PositionGreeks {
  delta: number;
  gamma: number;
  theta: number; // dollars/day
  vega: number; // dollars per 1% vol
}

// Position-level Greeks computed from the legs at the current snapshot — same
// sign convention as the portfolio dashboard (sell = short the greek).
export function positionGreeks(symbol: string, legs: QuoteLeg[]): PositionGreeks {
  const snap = getSnapshot(symbol);
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;
  if (snap) {
    for (const leg of legs) {
      const T = daysUntil(leg.expiration) / 365;
      const g = bs(snap.price, leg.strike, T, snap.iv, leg.optionType);
      const sign = leg.side === "sell" ? -1 : 1;
      delta += sign * g.delta * leg.quantity;
      gamma += sign * g.gamma * leg.quantity;
      theta += sign * g.theta * leg.quantity * 100;
      vega += sign * g.vega * leg.quantity * 100;
    }
  }
  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
  };
}

export interface ExplLeg {
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  quantity: number;
  openPrice: number;
}

export interface TradeExplanation {
  symbol: string;
  symbolName: string;
  strategy: string;
  strategyLabel: string;
  underlyingPrice: number;
  expiration: string;
  daysToExpiry: number;
  quantity: number;
  legs: ExplLeg[];
  credit: number;
  isCredit: boolean;
  maxProfit: number;
  maxLoss: number;
  pop: number;
  ev: number;
  returnOnCapital: number;
  breakevenLow: number | null;
  breakevenHigh: number | null;
  profitZone: string;
  greeks: PositionGreeks;
  greeksPlain: { delta: string; theta: string; vega: string; gamma: string };
  ravishScore: number;
  ravishTier: string;
  ravishBreakdown: {
    popScore: number;
    evScore: number;
    thetaScore: number;
    winRateScore: number;
    liquidityScore: number;
    ivRankScore: number;
  };
  ivRank: number;
  assignmentRisk: string;
  keyPoints: string[];
  rejected: boolean;
  rejectReason: string | null;
  disclaimer: string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

function deltaPlain(d: number): string {
  const abs = Math.abs(d);
  if (abs < 0.05)
    return `Position delta ${d >= 0 ? "+" : ""}${d} — effectively direction-neutral. You profit from the underlying staying in a range, not from picking up or down.`;
  return `Position delta ${d >= 0 ? "+" : ""}${d} — a mild ${d > 0 ? "bullish" : "bearish"} lean. For each $1 the underlying moves ${d > 0 ? "up" : "down"}, the position gains roughly ${money(Math.abs(d) * 100)} from direction alone.`;
}

function thetaPlain(t: number): string {
  if (t >= 0)
    return `Theta ${money(t)}/day — time decay works in your favor. As a net premium seller you collect about ${money(t)} per calendar day if everything else holds, ~${money(t * 7)}/week.`;
  return `Theta ${money(t)}/day — time decay works against you (this is a net-debit structure). You need movement or vol expansion to overcome the daily bleed.`;
}

function vegaPlain(v: number): string {
  if (v <= 0)
    return `Vega ${v} — short volatility. Falling implied vol helps you; a 1-point IV drop adds about ${money(Math.abs(v))}. A vol spike is your main risk.`;
  return `Vega ${v} — long volatility. Rising implied vol helps you; a 1-point IV rise adds about ${money(Math.abs(v))}.`;
}

function gammaPlain(g: number): string {
  if (g <= 0)
    return `Gamma ${g} — short gamma. Your delta moves against you as the underlying trends, so risk accelerates on a big, fast move. This is the trade-off for collecting theta.`;
  return `Gamma ${g} — long gamma. Your delta improves as the underlying moves, but you pay for it through theta.`;
}

function assignmentRiskText(symbol: string, q: StrategyQuote, underlying: number): string {
  const shorts = q.legs.filter((l) => l.side === "sell");
  if (shorts.length === 0) {
    return "No short legs — there is no assignment risk on this structure.";
  }
  const itm = shorts.filter((l) =>
    l.optionType === "call" ? underlying > l.strike : underlying < l.strike,
  );
  const nearest = shorts
    .map((l) => ({ l, dist: Math.abs(underlying - l.strike) / underlying }))
    .sort((a, b) => a.dist - b.dist)[0];
  const nearPct = (nearest.dist * 100).toFixed(1);
  if (itm.length > 0) {
    return `One or more short legs are currently in-the-money — assignment risk is elevated. American-style equity options can be assigned at any time, especially when deep ITM or near an ex-dividend date. If a short leg goes ITM near expiry, manage or close the position rather than risk assignment.`;
  }
  return `All short legs are out-of-the-money; the nearest short strike sits ~${nearPct}% from spot, so near-term assignment risk is low. Assignment risk rises if ${symbol} breaches a short strike near expiration — American options can be assigned early, particularly around ex-dividend dates.`;
}

function breakevens(q: StrategyQuote): { low: number | null; high: number | null; zone: string } {
  const creditPerShare = q.credit / 100;
  if (q.strategy === "calendar_spread" && q.shortCallStrike != null) {
    return {
      low: null,
      high: null,
      zone: `Maximum profit if ${q.symbol} finishes near the ${q.shortCallStrike} strike at the front expiration. The play loses if the underlying makes a large move in either direction before then.`,
    };
  }
  if (q.shortPutStrike != null && q.shortCallStrike != null) {
    const low = Math.round((q.shortPutStrike - creditPerShare) * 100) / 100;
    const high = Math.round((q.shortCallStrike + creditPerShare) * 100) / 100;
    return {
      low,
      high,
      zone: `You keep the full credit if ${q.symbol} expires between ${q.shortPutStrike} and ${q.shortCallStrike}. You break even at ${low} on the downside and ${high} on the upside; losses grow beyond the long wings.`,
    };
  }
  return {
    low: null,
    high: null,
    zone: "Profit zone is defined by the short strikes; losses are capped by the protective long legs.",
  };
}

// Resolve a candidate read-only and assemble the full deterministic explanation.
// Mirrors execution.canonicalQuote but performs NO risk gating / submission.
export function explainQuote(quote: StrategyQuote, scannerResultId?: number | null): TradeExplanation {
  const snap = getSnapshot(quote.symbol);
  const underlying = snap?.price ?? 0;
  const greeks = positionGreeks(quote.symbol, quote.legs);
  const be = breakevens(quote);
  const comp = ravishScore({
    strategy: quote.strategy,
    pop: quote.pop,
    ev: quote.ev,
    maxProfit: quote.maxProfit,
    maxLoss: quote.maxLoss,
    dailyTheta: quote.theta,
    dte: quote.daysToExpiry,
    liquidityScore: quote.liquidityScore,
    ivRank: quote.ivRank,
  });

  const keyPoints: string[] = [
    `Max loss is capped at ${money(quote.maxLoss)} — this is a defined-risk structure, so you can never lose more than that.`,
    `Probability of profit (POP) is ${quote.pop.toFixed(0)}%, computed with a volatility-risk-premium haircut on implied vol.`,
    `Expected value is ${quote.ev >= 0 ? "+" : ""}${money(quote.ev)} per spread (${quote.pop.toFixed(0)}% × ${money(quote.maxProfit)} max profit − ${(100 - quote.pop).toFixed(0)}% × ${money(quote.maxLoss)} max loss).`,
    deltaPlain(greeks.delta),
    thetaPlain(greeks.theta),
    `Return on capital is ${pct(quote.returnOnCapital)} of the ${money(quote.maxLoss)} at risk over ${quote.daysToExpiry} days.`,
    `Ravish Score ${quote.ravishScore.toFixed(1)} (${strategyLabel(quote.ravishTier)} tier) — POP, EV, theta efficiency, historical win rate, liquidity, and IV rank, weighted.`,
  ];

  return {
    symbol: quote.symbol,
    symbolName: snap?.name ?? quote.symbol,
    strategy: quote.strategy,
    strategyLabel: strategyLabel(quote.strategy),
    underlyingPrice: underlying,
    expiration: quote.expiration,
    daysToExpiry: quote.daysToExpiry,
    quantity: 1,
    legs: quote.legs.map((l) => ({
      side: l.side,
      optionType: l.optionType,
      strike: l.strike,
      expiration: l.expiration,
      quantity: l.quantity,
      openPrice: l.openPrice,
    })),
    credit: quote.credit,
    isCredit: quote.credit >= 0,
    maxProfit: quote.maxProfit,
    maxLoss: quote.maxLoss,
    pop: quote.pop,
    ev: quote.ev,
    returnOnCapital: quote.returnOnCapital,
    breakevenLow: be.low,
    breakevenHigh: be.high,
    profitZone: be.zone,
    greeks,
    greeksPlain: {
      delta: deltaPlain(greeks.delta),
      theta: thetaPlain(greeks.theta),
      vega: vegaPlain(greeks.vega),
      gamma: gammaPlain(greeks.gamma),
    },
    ravishScore: quote.ravishScore,
    ravishTier: quote.ravishTier,
    ravishBreakdown: {
      popScore: comp.popScore,
      evScore: comp.evScore,
      thetaScore: comp.thetaScore,
      winRateScore: comp.winRateScore,
      liquidityScore: comp.liquidityScore,
      ivRankScore: comp.ivRankScore,
    },
    ivRank: quote.ivRank,
    assignmentRisk: assignmentRiskText(quote.symbol, quote, underlying),
    keyPoints,
    rejected: quote.rejected,
    rejectReason: quote.rejectReason,
    disclaimer: COACH_DISCLAIMER,
  };
}

export class CoachError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function explainSymbolStrategy(symbol: string, strategy: string): TradeExplanation {
  const quote = canonicalQuote(symbol, strategy);
  if (!quote) throw new CoachError(`Unable to build a ${strategy} explanation for ${symbol}`, 400);
  return explainQuote(quote);
}

// ─── Greeks tutoring ─────────────────────────────────────────────────────────

export type GreekName = "delta" | "theta" | "gamma" | "vega";

export interface GreekLesson {
  greek: GreekName;
  title: string;
  symbol: string;
  oneLiner: string;
  definition: string;
  forPremiumSellers: string;
  example: string;
  exampleValue: number;
  keyPoints: string[];
  disclaimer: string;
}

const GREEK_DEFS: Record<GreekName, { title: string; oneLiner: string; definition: string; seller: string }> = {
  delta: {
    title: "Delta — Directional Exposure",
    oneLiner: "How much an option's price moves per $1 move in the underlying.",
    definition:
      "Delta measures the rate of change of an option's price with respect to a $1 change in the underlying. A call delta runs 0 to +1, a put delta 0 to −1. At the money, delta is roughly ±0.5. Delta also approximates the probability the option finishes in the money, which is exactly why the Ravish framework selects short strikes by delta (e.g. the 0.20-delta strike ≈ 20% chance of finishing ITM).",
    seller:
      "Premium sellers build defined-risk spreads whose net delta is small, so the position profits from time decay and range-bound price action rather than from guessing direction. A balanced iron condor sits near delta-neutral; a slight lean tells you which way you are exposed.",
  },
  theta: {
    title: "Theta — Time Decay",
    oneLiner: "How much value an option loses each day from the passage of time.",
    definition:
      "Theta is the dollar amount an option's price erodes per calendar day, all else equal. Decay accelerates as expiration approaches, and it is fastest for at-the-money options. For an option buyer theta is a cost; for a seller it is income.",
    seller:
      "Theta is the engine of premium selling. By selling rich premium and holding defined risk, you harvest theta every day the underlying behaves. Positive position theta means time itself pays you — the structural reason the Ravish scanner rewards theta efficiency relative to capital at risk.",
  },
  gamma: {
    title: "Gamma — How Fast Delta Changes",
    oneLiner: "The rate of change of delta as the underlying moves.",
    definition:
      "Gamma measures how quickly delta itself changes for a $1 move in the underlying. High gamma means delta swings rapidly — small near expiration for far-OTM options, large for at-the-money options close to expiry.",
    seller:
      "Premium sellers are typically short gamma: as the underlying trends toward a short strike, delta turns against you and losses accelerate. That is the price you pay for collecting theta. Managing short gamma — by sizing small and taking profits early — is central to surviving as a seller.",
  },
  vega: {
    title: "Vega — Volatility Sensitivity",
    oneLiner: "How much an option's price moves per 1-point change in implied volatility.",
    definition:
      "Vega is the change in an option's price for a 1 percentage-point change in implied volatility. Higher IV raises every option's premium; vega is largest for at-the-money, longer-dated options.",
    seller:
      "Selling premium is usually short vega — you benefit when implied volatility falls (and especially from the post-earnings IV crush). The flip side: a volatility spike inflates the price of your short options and hurts the position. Selling when IV rank is elevated stacks the odds in your favor.",
  },
};

export function teachGreek(greek: GreekName, symbol = "SPY"): GreekLesson {
  const snap = getSnapshot(symbol) ?? getSnapshot("SPY")!;
  const quote = buildIronCondor(snap);
  const g = positionGreeks(snap.symbol, quote.legs);
  const def = GREEK_DEFS[greek];
  let example = "";
  let exampleValue = 0;
  switch (greek) {
    case "delta":
      exampleValue = g.delta;
      example = `A live ${snap.symbol} iron condor (${quote.shortPutStrike}/${quote.shortCallStrike} short strikes) carries a position delta of ${g.delta >= 0 ? "+" : ""}${g.delta} — nearly neutral. The short strikes were chosen near 0.20 delta, ≈20% chance of finishing ITM each, which is how POP of ${quote.pop.toFixed(0)}% is engineered.`;
      break;
    case "theta":
      exampleValue = g.theta;
      example = `That same ${snap.symbol} condor generates ${money(g.theta)}/day of theta — about ${money(g.theta * 7)} a week of time-decay income while ${snap.symbol} stays between the short strikes.`;
      break;
    case "gamma":
      exampleValue = g.gamma;
      example = `The ${snap.symbol} condor is short gamma (${g.gamma}). If ${snap.symbol} rallies hard toward the ${quote.shortCallStrike} call, delta turns increasingly negative and losses speed up — the cost of being short gamma to collect theta.`;
      break;
    case "vega":
      exampleValue = g.vega;
      example = `The ${snap.symbol} condor is short vega (${g.vega}) at an IV rank of ${snap.ivRank}. A 1-point drop in implied vol adds roughly ${money(Math.abs(g.vega))}; a vol spike is the main headwind.`;
      break;
  }
  return {
    greek,
    title: def.title,
    symbol: snap.symbol,
    oneLiner: def.oneLiner,
    definition: def.definition,
    forPremiumSellers: def.seller,
    example,
    exampleValue,
    keyPoints: [
      def.oneLiner,
      def.seller,
      example,
    ],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ─── Learn content (static masterclass scaffolds, enriched with live numbers) ──

export interface LearnSection {
  heading: string;
  body: string;
}
export interface LearnQuizQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
export interface LearnContent {
  slug: string;
  title: string;
  subtitle: string;
  sections: LearnSection[];
  workedExamples?: LearnSection[];
  quiz?: LearnQuizQuestion[];
  keyPoints: string[];
  disclaimer: string;
}

export function deltaMasterclass(): LearnContent {
  const snap = getSnapshot("SPY")!;
  const q = buildIronCondor(snap);
  const g = positionGreeks(snap.symbol, q.legs);
  return {
    slug: "delta",
    title: "Delta Masterclass",
    subtitle: "From a single number to the backbone of every Ravish trade",
    sections: [
      {
        heading: "1. What delta actually is",
        body: "Delta is the first derivative of an option's price with respect to the underlying. A +0.30 call gains about $0.30 for every $1 the stock rises (×100 = $30 per contract). Calls run 0 to +1, puts 0 to −1, and at the money both sit near ±0.5.",
      },
      {
        heading: "2. Delta as a probability",
        body: "Delta is a close approximation of the risk-neutral probability an option expires in the money. A 0.20-delta short strike has roughly a 20% chance of finishing ITM — so an ~80% chance of expiring worthless, which is money in a seller's pocket. This dual meaning is why the scanner picks short strikes by delta.",
      },
      {
        heading: "3. Position delta and direction-neutrality",
        body: `Sum the deltas of every leg (shorts negative, longs positive) and you get position delta — your true directional exposure. A live ${snap.symbol} iron condor at ${q.shortPutStrike}/${q.shortCallStrike} carries position delta ${g.delta >= 0 ? "+" : ""}${g.delta}: nearly flat. The goal of premium selling is to keep this small so profit comes from theta and range, not from a directional bet.`,
      },
      {
        heading: "4. Managing delta as price moves",
        body: "As the underlying drifts toward a short strike, that strike's delta grows and your position delta tilts against you (short gamma). Disciplined sellers re-center by rolling the untested side, adding a hedge, or simply taking profit early — never by abandoning defined risk.",
      },
      {
        heading: "5. Delta and the Greeks together",
        body: "Delta never acts alone. Gamma tells you how fast delta will change, theta is the income you collect for holding the exposure, and vega is your sensitivity to IV. A premium seller is typically near-zero delta, short gamma, positive theta, and short vega — a coherent posture, not four separate bets.",
      },
      {
        heading: "6. How Ravish uses 20-delta strikes",
        body: `The Ravish framework anchors most short strikes near 0.20 delta. That single choice does three jobs at once: it places each short ~20% likely to finish ITM (≈80% POP per side), it keeps position delta small so the trade is a volatility/time bet rather than a directional one, and it sits far enough out-of-the-money that the credit collected still covers the defined-risk wings with positive expected value. Tighter (30Δ) strikes collect more credit but cut POP; wider (10Δ) strikes raise POP but collect too little to clear EV. The 20Δ band is the engine's sweet spot — and the score's 30% POP weight is what enforces it.`,
      },
    ],
    workedExamples: deltaWorkedExamples(snap.symbol, q, g),
    quiz: [
      {
        prompt: "A short strike with a 0.20 delta has roughly what chance of finishing in the money?",
        options: ["2%", "20%", "50%", "80%"],
        correctIndex: 1,
        explanation:
          "Delta ≈ the risk-neutral probability of finishing ITM, so 0.20 ≈ a 20% chance ITM — and about an 80% chance of expiring worthless, which is what the seller wants.",
      },
      {
        prompt: "Why does the Ravish engine prefer 20-delta short strikes over 30-delta?",
        options: [
          "30-delta strikes are illegal to sell",
          "20-delta gives higher POP per side while still clearing positive EV",
          "20-delta always collects more premium",
          "Delta has no effect on probability",
        ],
        correctIndex: 1,
        explanation:
          "A 20Δ short is ~80% likely to expire worthless (vs ~70% for 30Δ). It collects less credit than 30Δ but still enough to keep expected value positive — the high-probability, defined-risk sweet spot.",
      },
      {
        prompt: "An iron condor's position delta is near zero. What does that tell you?",
        options: [
          "It will lose money no matter what",
          "It is a directional bet on the stock rising",
          "It is roughly direction-neutral — profit comes from theta and staying in range",
          "It has unlimited risk",
        ],
        correctIndex: 2,
        explanation:
          "Position delta is the signed sum of leg deltas. Near zero means little directional exposure — the edge comes from time decay (theta) and the underlying staying inside the short strikes, not from picking a direction.",
      },
    ],
    keyPoints: [
      "Delta ≈ price sensitivity per $1 move AND ≈ probability of finishing ITM.",
      "Calls 0→+1, puts 0→−1, at-the-money ≈ ±0.5.",
      "Position delta = signed sum of leg deltas = your real directional exposure.",
      "Ravish selects short strikes near 0.20 delta to engineer high POP.",
      "Stay near delta-neutral; let theta and range — not direction — pay you.",
    ],
    disclaimer: COACH_DISCLAIMER,
  };
}

// Worked examples comparing how strike-delta selection shapes four structures.
// Uses live deterministic numbers where a structure can be built; the 30-delta
// strangle is described definitionally (a 30Δ strike is 30Δ by construction).
function deltaWorkedExamples(
  symbol: string,
  ic: StrategyQuote,
  icG: PositionGreeks,
): LearnSection[] {
  const examples: LearnSection[] = [
    {
      heading: `20Δ iron condor (${symbol})`,
      body: `Short strikes ${ic.shortPutStrike}/${ic.shortCallStrike} are placed near 0.20 delta — each ~20% likely ITM, so the structure runs about ${ic.pop.toFixed(0)}% POP. Position delta is ${icG.delta >= 0 ? "+" : ""}${icG.delta} (near flat) with ${icG.theta >= 0 ? "+" : ""}$${icG.theta.toFixed(2)}/day of theta: a high-probability, range-bound, defined-risk bet — the Ravish default.`,
    },
    {
      heading: "30Δ short strangle",
      body: "Sell the 0.30-delta put and the 0.30-delta call: each leg is ~30% likely ITM, so each side is only ~70% likely to expire worthless — a tighter, more aggressive posture than the 20Δ condor. The net delta is still ≈ 0 (the two 30Δ legs offset), but POP per side is lower and, without protective wings, the risk is undefined. More credit, less probability.",
    },
  ];

  const fly = canonicalQuote(symbol, "iron_fly");
  if (fly) {
    const flyG = positionGreeks(symbol, fly.legs);
    examples.push({
      heading: `ATM iron fly (${symbol})`,
      body: `The short strikes sit at-the-money (~0.50 delta), collecting the richest credit of the three but inside the narrowest profit zone, giving roughly ${fly.pop.toFixed(0)}% POP. Position delta ${flyG.delta >= 0 ? "+" : ""}${flyG.delta}, theta ${flyG.theta >= 0 ? "+" : ""}$${flyG.theta.toFixed(2)}/day. Maximum income, minimum margin for error — the opposite end of the delta spectrum from the 20Δ condor.`,
    });
  }

  const cal = canonicalQuote(symbol, "calendar_spread");
  if (cal) {
    const calG = positionGreeks(symbol, cal.legs);
    examples.push({
      heading: `Calendar spread (${symbol})`,
      body: `A calendar sells the near-dated and buys the far-dated option at the ${cal.shortCallStrike}-strike. Its position delta is ${calG.delta >= 0 ? "+" : ""}${calG.delta} and it is long vega — it profits from time decay differential and rising IV rather than from a 20Δ-style range bet, which is why its delta profile reads differently from the condor and fly.`,
    });
  }

  return examples;
}

export function greeksOverview(): LearnContent {
  return {
    slug: "greeks",
    title: "The Greeks for Premium Sellers",
    subtitle: "Delta, Theta, Gamma, Vega — and how they fit together",
    sections: (["delta", "theta", "gamma", "vega"] as GreekName[]).map((name) => {
      const def = GREEK_DEFS[name];
      return { heading: def.title, body: `${def.definition} ${def.seller}` };
    }),
    keyPoints: [
      "Delta — directional exposure; keep it near neutral.",
      "Theta — daily time-decay income; the seller's edge.",
      "Gamma — how fast delta moves; sellers are short it.",
      "Vega — IV sensitivity; sellers are short it and like high IV rank.",
      "A healthy premium-selling position: ~neutral delta, short gamma, positive theta, short vega.",
    ],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

export interface QuizQuestionBank {
  id: string;
  topic: "greeks" | "strategy" | "risk";
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ_BANK: QuizQuestionBank[] = [
  {
    id: "g1",
    topic: "greeks",
    prompt: "A short option strike has a delta of 0.20. Roughly what is the probability it expires in the money?",
    options: ["20%", "50%", "80%", "2%"],
    correctIndex: 0,
    explanation: "Delta approximates the probability of finishing ITM, so a 0.20-delta strike has ≈20% chance of expiring ITM (≈80% chance of expiring worthless).",
  },
  {
    id: "g2",
    topic: "greeks",
    prompt: "For a net premium seller, positive position theta means:",
    options: ["You lose money as time passes", "Time decay pays you each day", "You are long volatility", "You need a big move to profit"],
    correctIndex: 1,
    explanation: "Positive theta means the passage of time adds value to your position — the core income source of premium selling.",
  },
  {
    id: "g3",
    topic: "greeks",
    prompt: "Premium sellers are usually short vega. This means they benefit when:",
    options: ["Implied volatility rises", "The stock pays a dividend", "Implied volatility falls", "Interest rates rise"],
    correctIndex: 2,
    explanation: "Short vega profits from falling implied volatility — for example the IV crush after an earnings report.",
  },
  {
    id: "g4",
    topic: "greeks",
    prompt: "What does gamma measure?",
    options: ["The rate of change of delta", "Time decay per day", "Sensitivity to interest rates", "Probability of assignment"],
    correctIndex: 0,
    explanation: "Gamma is the rate of change of delta with respect to the underlying. Sellers are typically short gamma, so risk accelerates on fast moves.",
  },
  {
    id: "g5",
    topic: "greeks",
    prompt: "An at-the-money option has the highest:",
    options: ["Delta", "Gamma and Vega", "Negative theta only", "Rho"],
    correctIndex: 1,
    explanation: "At-the-money options carry the most gamma and vega, and the fastest theta decay near expiration.",
  },
  {
    id: "s1",
    topic: "strategy",
    prompt: "An iron condor is constructed from:",
    options: ["A short put spread and a short call spread", "Two long calls", "A single naked put", "A stock position plus a call"],
    correctIndex: 0,
    explanation: "An iron condor combines a short (credit) put spread below the market and a short call spread above it — defined risk on both sides.",
  },
  {
    id: "s2",
    topic: "strategy",
    prompt: "Compared to an iron condor, an iron fly typically has:",
    options: ["Lower credit, wider profit zone", "Higher credit, narrower profit zone", "No defined risk", "Only call options"],
    correctIndex: 1,
    explanation: "An iron fly sells at-the-money options, collecting more credit but with a narrower break-even range than a condor's wider short strikes.",
  },
  {
    id: "s3",
    topic: "strategy",
    prompt: "A calendar spread profits most when the underlying:",
    options: ["Makes a huge directional move", "Finishes near the strike at front expiration", "Gaps to zero", "Pays a special dividend"],
    correctIndex: 1,
    explanation: "A calendar is long the back-month and short the front-month at the same strike; it maximizes near that strike as the front leg decays faster.",
  },
  {
    id: "s4",
    topic: "strategy",
    prompt: "The earnings IV-crush play sells premium because:",
    options: ["IV is unusually low before earnings", "IV is elevated before earnings and collapses after", "Earnings never move stocks", "Options expire at earnings"],
    correctIndex: 1,
    explanation: "Implied vol is inflated heading into earnings and crushes immediately after the report — a short-premium structure harvests that collapse.",
  },
  {
    id: "r1",
    topic: "risk",
    prompt: "What makes an iron condor a 'defined-risk' trade?",
    options: ["It can never lose money", "Long wings cap the maximum loss", "It has no short options", "The broker guarantees it"],
    correctIndex: 1,
    explanation: "The protective long options (wings) cap losses, so max loss is known up front and can never exceed the width minus credit.",
  },
  {
    id: "r2",
    topic: "risk",
    prompt: "Why does the Ravish framework use a volatility-risk-premium haircut when computing POP?",
    options: ["To inflate the win rate", "Because implied vol tends to overstate realized vol", "To match the broker's number", "It is required by law"],
    correctIndex: 1,
    explanation: "Implied volatility systematically overstates realized volatility, so POP is computed with a haircut vol — the structural edge behind net premium selling.",
  },
  {
    id: "r3",
    topic: "risk",
    prompt: "A trade has 70% POP, $200 max profit, and $800 max loss. Its expected value is:",
    options: ["+$140", "−$100", "−$240", "+$200"],
    correctIndex: 1,
    explanation: "EV = 0.70 × $200 − 0.30 × $800 = $140 − $240 = −$100. High POP alone does not guarantee positive expected value.",
  },
  {
    id: "r4",
    topic: "risk",
    prompt: "Position sizing by 'max risk per trade' is important because:",
    options: ["It maximizes leverage", "It bounds the loss from any single trade as a % of the account", "It removes the need for stops", "It guarantees profit"],
    correctIndex: 1,
    explanation: "Capping each trade's max loss as a percentage of the account prevents any one position from doing outsized damage — the foundation of survival.",
  },
];

function shuffle<T>(arr: T[], seed: number): T[] {
  // Deterministic Fisher-Yates using a small LCG so a quiz is reproducible by seed.
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuizQuestionPublic {
  id: string;
  prompt: string;
  options: string[];
}

export interface GeneratedQuiz {
  quizId: string;
  topic: string;
  questions: QuizQuestionPublic[];
}

export function generateQuiz(topic: string, count: number): GeneratedQuiz {
  const seed = Date.now() >>> 0;
  const pool =
    topic === "greeks" || topic === "strategy" || topic === "risk"
      ? QUIZ_BANK.filter((q) => q.topic === topic)
      : QUIZ_BANK;
  const n = Math.max(1, Math.min(count || 5, pool.length));
  const picked = shuffle(pool, seed).slice(0, n);
  const ids = picked.map((q) => q.id);
  // quizId encodes the exact question ids so grading is server-authoritative.
  const quizId = Buffer.from(JSON.stringify({ topic, ids })).toString("base64url");
  return {
    quizId,
    topic,
    questions: picked.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
  };
}

export interface QuizGradeItem {
  id: string;
  prompt: string;
  yourAnswer: number;
  correctAnswer: number;
  correct: boolean;
  explanation: string;
}
export interface QuizGradeResult {
  topic: string;
  score: number;
  total: number;
  percent: number;
  message: string;
  results: QuizGradeItem[];
  disclaimer: string;
}

export function gradeQuiz(quizId: string, answers: number[]): QuizGradeResult {
  let decoded: { topic: string; ids: string[] };
  try {
    decoded = JSON.parse(Buffer.from(quizId, "base64url").toString("utf8"));
  } catch {
    throw new CoachError("Invalid quizId", 400);
  }
  if (!decoded || !Array.isArray(decoded.ids)) throw new CoachError("Invalid quizId", 400);
  const items: QuizGradeItem[] = decoded.ids.map((id, i) => {
    const q = QUIZ_BANK.find((b) => b.id === id);
    if (!q) throw new CoachError("Unknown quiz question", 400);
    const yourAnswer = answers[i] ?? -1;
    return {
      id: q.id,
      prompt: q.prompt,
      yourAnswer,
      correctAnswer: q.correctIndex,
      correct: yourAnswer === q.correctIndex,
      explanation: q.explanation,
    };
  });
  const score = items.filter((i) => i.correct).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
  const message =
    percent >= 80
      ? "Excellent — you have a strong grasp of the mechanics."
      : percent >= 50
        ? "Solid start. Review the explanations on the ones you missed."
        : "Keep studying — work through the Delta Masterclass and Greeks Tutor, then retry.";
  return {
    topic: decoded.topic,
    score,
    total,
    percent,
    message,
    results: items,
    disclaimer: COACH_DISCLAIMER,
  };
}
