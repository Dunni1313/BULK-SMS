// AI Teacher & Learning Centre sprint — Strategy Academy. Deterministic,
// version-controlled content per strategy (a plain TypeScript literal
// for the static fields, never LLM-generated).
//
// This platform's real scanner/execution engine (execution.ts's own
// Strategy type) only builds and prices 4 structures:
// "iron_condor" | "iron_fly" | "calendar_spread" | "earnings". For the
// 3 of those the Strategy Academy covers (iron_condor, iron_fly,
// calendar_spread — "earnings" is a play recommending one of the other
// three, not a distinct construction), the "Paper Trading example"
// field is a REAL, live worked example built via
// execution.ts's own canonicalQuote() + coach.ts's own positionGreeks()
// — the exact same functions the platform's real Trade Ticket and
// Delta Masterclass already use, never a fabricated number.
//
// For the 5 requested strategies execution.ts does NOT build (Covered
// Call, Cash Secured Put, Wheel, Vertical Spread, Diagonal Spread), the
// "Paper Trading example" is honestly disclosed as unavailable — the
// same "Not tracked in this engine" precedent the Institutional Command
// Center sprint already established for Wheel Positions/Covered
// Calls/Cash Secured Puts — never a fabricated live number for a
// strategy this engine doesn't actually trade.

import { canonicalQuote } from "./execution.js";
import { positionGreeks, strategyLabel, type PositionGreeks } from "./coach.js";

export type StrategyAcademyKey =
  | "covered_call"
  | "cash_secured_put"
  | "wheel"
  | "vertical_spread"
  | "iron_condor"
  | "iron_fly"
  | "calendar_spread"
  | "diagonal_spread";

export interface StrategyPaperExample {
  available: boolean;
  unavailableReason: string | null;
  symbol: string | null;
  detail: string | null;
  greeks: PositionGreeks | null;
}

export interface StrategyAcademyEntry {
  key: StrategyAcademyKey;
  label: string;
  builtByThisEngine: boolean;
  construction: string;
  idealMarket: string;
  maxProfit: string;
  maxLoss: string;
  greeksProfile: string;
  timeDecay: string;
  volatilityBehavior: string;
  assignmentRisk: string;
  commonMistakes: string[];
  institutionalPerspective: string;
}

const STATIC: Record<StrategyAcademyKey, StrategyAcademyEntry> = {
  covered_call: {
    key: "covered_call",
    label: "Covered Call",
    builtByThisEngine: false,
    construction: "Own 100 shares of the underlying and sell 1 call option against them, collecting the premium as income.",
    idealMarket: "Flat to moderately bullish — you want the stock to hold or grind up slowly, without a sharp rally through the strike.",
    maxProfit: "(Strike − stock cost basis) + premium collected, realized if the stock finishes at or above the strike and shares are called away.",
    maxLoss: "Substantial — capped only by the stock falling to zero, offset partially by the premium collected. This is NOT a defined-risk structure the way a credit spread is.",
    greeksProfile: "Long delta from the shares (roughly +100 per 100 shares) minus a modest short delta from the call — net long, but less than owning shares outright.",
    timeDecay: "Theta-positive: the short call decays in your favor every day, adding to the position's overall return.",
    volatilityBehavior: "Short vega on the call leg — falling IV helps the call decay faster, though the shares themselves have no vega.",
    assignmentRisk: "The short call can be assigned any time it's in-the-money (American-style), most commonly near expiration or ahead of an ex-dividend date — assignment means selling your shares at the strike.",
    commonMistakes: [
      "Selling calls on shares you aren't actually willing to have called away at that price.",
      "Treating the small premium collected as meaningful downside protection against a real stock decline.",
      "Selling a strike too close to the current price and capping upside on a stock you actually expected to rally.",
    ],
    institutionalPerspective: "Institutional desks view covered calls primarily as a yield-enhancement overlay on a core equity position, not a standalone income strategy — the underlying stock's own risk still dominates the position's total risk.",
  },
  cash_secured_put: {
    key: "cash_secured_put",
    label: "Cash Secured Put",
    builtByThisEngine: false,
    construction: "Sell 1 put option while holding enough cash to buy 100 shares at the strike if assigned.",
    idealMarket: "Neutral to bullish — you're comfortable owning the stock at the strike price, and ideally it stays above the strike so the put expires worthless.",
    maxProfit: "The premium collected, realized in full if the stock finishes above the strike and the put expires worthless.",
    maxLoss: "Substantial — (strike × 100) minus premium collected, if the stock falls to zero. Not a defined-risk structure.",
    greeksProfile: "Short delta (roughly the put's own delta, e.g. a 0.30-delta short put carries about +0.30 position delta before assignment, since a short put behaves like being long the stock below the strike).",
    timeDecay: "Theta-positive: the short put decays in your favor every day it stays out-of-the-money.",
    volatilityBehavior: "Short vega — falling IV helps; a volatility spike inflates the put's cost to close and can deepen unrealized losses if the stock is also falling.",
    assignmentRisk: "Can be assigned any time the put is in-the-money — assignment means buying 100 shares at the strike, funded by the cash already set aside.",
    commonMistakes: [
      "Selling a put on a stock you would NOT actually be comfortable owning at that price.",
      "Under-collateralizing the position (not truly holding the cash), turning a defined obligation into unplanned margin risk.",
      "Chasing high premium on a stock with genuinely elevated risk (e.g. into a binary event) without accounting for that added risk.",
    ],
    institutionalPerspective: "Institutional desks treat a cash-secured put as a disciplined, price-limited way to acquire a position — the premium collected effectively lowers the entry price versus a plain limit order, in exchange for taking on the obligation to buy.",
  },
  wheel: {
    key: "wheel",
    label: "The Wheel",
    builtByThisEngine: false,
    construction: "A cycle: sell cash-secured puts on a stock you're willing to own; if assigned, sell covered calls on the resulting shares until called away; then return to selling puts.",
    idealMarket: "Range-bound to moderately trending — the wheel collects premium at every stage regardless of direction, but works best when the stock doesn't make a large, sustained directional move.",
    maxProfit: "Unbounded across the full cycle in principle (repeated premium collection), though each individual leg (CSP or covered call) has the same profit cap as its own strategy.",
    maxLoss: "Inherits the covered call/CSP legs' own substantial (undefined-risk) downside exposure to the underlying stock.",
    greeksProfile: "Alternates between the cash-secured put's short-put delta profile and the covered call's long-stock-minus-short-call delta profile, depending on which stage of the cycle you're in.",
    timeDecay: "Theta-positive throughout — both stages of the cycle are short-premium, time-decay-positive positions.",
    volatilityBehavior: "Short vega throughout both stages — the wheel is a consistently short-volatility strategy across its full cycle.",
    assignmentRisk: "The entire strategy is built AROUND assignment — being assigned shares from the put, and having those shares called away by the call, are both expected, planned parts of the cycle, not failures.",
    commonMistakes: [
      "Running the wheel on a stock that later has a fundamental deterioration, turning 'assigned shares' into a stuck, underwater position.",
      "Selling calls too close to your cost basis after assignment, locking in a loss if called away below where you were assigned.",
      "Losing track of the cycle's own total capital commitment across both stages.",
    ],
    institutionalPerspective: "Institutional desks recognize the wheel as a structured way to be paid to wait — either for a good entry (via the put) or a good exit (via the call) — but never treat it as risk-free, since the underlying stock's own downside is never actually hedged.",
  },
  vertical_spread: {
    key: "vertical_spread",
    label: "Vertical Spread",
    builtByThisEngine: false,
    construction: "Buy and sell two options of the same type (both calls or both puts) and the same expiration, at two different strikes.",
    idealMarket: "Depends on direction — a short put spread wants the stock to stay above the short strike (bullish/neutral); a short call spread wants it to stay below (bearish/neutral).",
    maxProfit: "The net credit received (for a credit spread), realized if the underlying finishes beyond the short strike in the favorable direction.",
    maxLoss: "The width between strikes minus the credit received — fully defined and capped at entry, unlike a covered call or CSP.",
    greeksProfile: "A single vertical carries a real net delta lean in the direction of its short strike; combining a put vertical and a call vertical (an iron condor) largely cancels that lean.",
    timeDecay: "Theta-positive for a credit spread (the position sold for a net credit) — decay works in the seller's favor as the underlying stays away from the short strike.",
    volatilityBehavior: "Short vega for a credit vertical — falling IV helps the position, consistent with every other credit-based structure on this platform.",
    assignmentRisk: "The short leg carries the same assignment risk as any short option; the long leg's own protection only fully offsets that risk once both legs are considered together.",
    commonMistakes: [
      "Selling a spread too close to the money for the credit received, accepting a poor probability-of-profit-to-credit trade-off.",
      "Ignoring the long leg's own liquidity — a hard-to-close long option can strand you unable to exit the spread as a unit.",
      "Forgetting that both legs must be managed together, not closed independently without a plan.",
    ],
    institutionalPerspective: "The vertical spread is the fundamental defined-risk building block of institutional options risk management — this platform's own iron condor is literally two verticals (a put spread and a call spread) combined.",
  },
  iron_condor: {
    key: "iron_condor",
    label: "Iron Condor",
    builtByThisEngine: true,
    construction: "A short put spread below the market combined with a short call spread above it — 4 legs total, collecting a net credit with fully defined risk on both sides.",
    idealMarket: "Range-bound — profits when the underlying stays between the two short strikes through expiration.",
    maxProfit: "The net credit received, realized if the underlying finishes between the two short strikes.",
    maxLoss: "The width of whichever side's spread is wider, minus the credit received — fully defined and capped at entry.",
    greeksProfile: "Position delta near zero by construction (the two short strikes' deltas roughly offset); short gamma; positive theta; short vega — the canonical premium-selling Greeks posture.",
    timeDecay: "Strongly theta-positive — this is the primary income mechanism of the structure, harvested every day the underlying stays inside the short strikes.",
    volatilityBehavior: "Short vega on both sides — falling IV (and especially post-earnings IV crush, when applicable) benefits the position; a volatility spike is the main risk.",
    assignmentRisk: "Assignment risk rises on whichever short strike the underlying approaches or breaches — American-style options can be assigned early, particularly around ex-dividend dates on the call side.",
    commonMistakes: [
      "Selling strikes too close to the money (too aggressive a delta) for the extra credit, sacrificing probability of profit.",
      "Ignoring liquidity on the wings — wide bid/ask spreads on the long legs can quietly erode the position's real edge.",
      "Failing to manage a threatened side (e.g. rolling or closing) once the underlying trends toward one short strike, letting a manageable loss become a maximum loss.",
    ],
    institutionalPerspective: "The iron condor is the workhorse of institutional systematic premium selling precisely because every one of its risk parameters — max profit, max loss, breakevens, POP — is known and fixed at entry, making its expected value computable and its risk fully budgetable across a portfolio.",
  },
  iron_fly: {
    key: "iron_fly",
    label: "Iron Butterfly",
    builtByThisEngine: true,
    construction: "Like an iron condor, but both short strikes sit at-the-money — the richest possible credit for this 4-leg family, with the narrowest profit zone.",
    idealMarket: "Range-bound with LOW expected movement — the underlying needs to finish very close to where it started for maximum profit.",
    maxProfit: "The net credit received, maximized (and only fully realized) if the underlying finishes exactly at the short strikes.",
    maxLoss: "The width of the wings minus the credit received — fully defined, though typically a larger dollar figure than an equivalent-width iron condor since the credit collected is larger.",
    greeksProfile: "Position delta near zero at entry (symmetric ATM strikes); the largest gamma and vega exposure of the whole family, since ATM options carry the most of both.",
    timeDecay: "The fastest theta decay of the family near expiration — ATM options decay the quickest as time runs out.",
    volatilityBehavior: "The most vega-sensitive structure in the Strategy Academy — a volatility spike hurts an iron fly more than an equivalent iron condor, precisely because it's built from the most vega-rich strikes available.",
    assignmentRisk: "Elevated on both sides simultaneously at entry, since both short strikes start at-the-money — assignment risk shifts to whichever side the underlying drifts toward.",
    commonMistakes: [
      "Underestimating how narrow the actual profit zone is relative to the larger credit collected.",
      "Holding through a large, fast move without managing the position, given the structure's own elevated gamma.",
      "Comparing its credit directly to an iron condor's without adjusting for the correspondingly lower probability of profit.",
    ],
    institutionalPerspective: "Institutional desks use the iron fly selectively — when a genuinely low-volatility, pinned-range view is warranted (e.g. immediately post-earnings, once IV has already crushed) — rather than as a default structure, given its narrower margin for error.",
  },
  calendar_spread: {
    key: "calendar_spread",
    label: "Calendar Spread",
    builtByThisEngine: true,
    construction: "Sell a near-dated option and buy a longer-dated option at the same strike — a 2-leg structure profiting from the front leg's faster time decay.",
    idealMarket: "Range-bound near the strike through the front-month expiration, ideally with implied volatility on the back-month leg holding or rising.",
    maxProfit: "Maximized if the underlying finishes exactly at the strike at the front-month expiration, when the near-dated leg has decayed the most relative to the far-dated leg still held.",
    maxLoss: "Limited to the net debit paid to establish the spread (this is a net-debit, not a net-credit, structure) — losses accrue if the underlying moves far from the strike or if IV collapses on the back-month leg.",
    greeksProfile: "Position delta depends on strike placement relative to the underlying; genuinely long vega overall (the back-month leg's larger vega dominates the front-month leg's smaller vega) — the opposite vega posture from an iron condor or fly.",
    timeDecay: "Net theta-positive from the differential — the short front-month leg decays faster than the long back-month leg loses value, generating a net time-decay edge.",
    volatilityBehavior: "Long vega — a calendar spread benefits from RISING implied volatility on the longer-dated leg, distinct from every credit structure in this Academy, which is short vega.",
    assignmentRisk: "Only the short, near-dated leg carries assignment risk, and only once it moves in-the-money — the long, far-dated leg is never at risk of assignment.",
    commonMistakes: [
      "Treating a calendar as theta-only, ignoring its genuinely different (long) vega exposure.",
      "Holding too long after the front-month expiration without a clear plan for the remaining long leg.",
      "Placing the strike based on a directional guess rather than where the underlying is expected to sit at front-month expiration.",
    ],
    institutionalPerspective: "The calendar spread is the structure institutional desks reach for specifically when they want time-decay income WITHOUT taking a short-volatility bet — a genuinely different risk profile from every credit spread in this Academy, useful for diversifying a book's own net vega exposure.",
  },
  diagonal_spread: {
    key: "diagonal_spread",
    label: "Diagonal Spread",
    builtByThisEngine: false,
    construction: "Like a calendar spread, but the near- and far-dated legs use different strikes rather than the same one, adding a directional lean to the time-decay/volatility edge.",
    idealMarket: "A moderate directional view (toward the long leg's strike) combined with a preference for time decay and/or rising back-month volatility.",
    maxProfit: "Depends on the specific strike offset chosen; generally maximized if the underlying drifts toward the long leg's strike by front-month expiration.",
    maxLoss: "Limited to the net debit paid (for a debit diagonal), similar in kind to a calendar spread's own defined downside.",
    greeksProfile: "A genuine blend of the calendar's long-vega/positive-theta profile with a real directional delta lean from the strike offset — more complex to reason about than a same-strike calendar.",
    timeDecay: "Positive from the same front-leg-decays-faster mechanic as a calendar spread, though the exact rate depends on how far apart the two strikes sit.",
    volatilityBehavior: "Generally long vega overall (inherited from the longer-dated leg), moderated by the directional strike offset.",
    assignmentRisk: "Only the short, near-dated leg carries assignment risk, exactly as with a calendar spread.",
    commonMistakes: [
      "Underestimating how much the added strike offset complicates the position's own risk profile versus a plain calendar.",
      "Choosing the offset based on a strong directional conviction while still expecting calendar-like defined risk — the two goals can conflict.",
      "Not clearly separating 'I have a directional view' from 'I want time-decay income' when sizing the position.",
    ],
    institutionalPerspective: "A diagonal is best understood as a calendar spread with an intentional directional tilt — useful when a desk has both a genuine (if moderate) directional view AND wants to retain some of the calendar's own time-decay/vega characteristics, rather than choosing one or the other.",
  },
};

const LIVE_EXAMPLE_SYMBOL = "SPY";

function buildLiveExample(strategyKey: "iron_condor" | "iron_fly" | "calendar_spread"): StrategyPaperExample {
  const quote = canonicalQuote(LIVE_EXAMPLE_SYMBOL, strategyKey);
  if (!quote) {
    return {
      available: false,
      unavailableReason: `Unable to build a live ${strategyLabel(strategyKey)} example for ${LIVE_EXAMPLE_SYMBOL} right now.`,
      symbol: null,
      detail: null,
      greeks: null,
    };
  }
  const greeks = positionGreeks(LIVE_EXAMPLE_SYMBOL, quote.legs);
  const strikeDetail =
    quote.shortPutStrike != null && quote.shortCallStrike != null
      ? `short strikes ${quote.shortPutStrike}/${quote.shortCallStrike}`
      : quote.shortCallStrike != null
        ? `short strike ${quote.shortCallStrike}`
        : "";
  const detail = `A live ${LIVE_EXAMPLE_SYMBOL} ${strategyLabel(strategyKey)} (${strikeDetail}) expiring in ${quote.daysToExpiry} days: credit ${quote.credit >= 0 ? "+" : ""}$${quote.credit.toFixed(2)}, max profit $${quote.maxProfit.toFixed(2)}, max loss $${quote.maxLoss.toFixed(2)}, POP ${quote.pop.toFixed(0)}%, EV ${quote.ev >= 0 ? "+" : ""}$${quote.ev.toFixed(2)}.`;
  return {
    available: true,
    unavailableReason: null,
    symbol: LIVE_EXAMPLE_SYMBOL,
    detail,
    greeks,
  };
}

function buildUnavailableExample(label: string): StrategyPaperExample {
  return {
    available: false,
    unavailableReason: `${label} is not a strategy this platform's own scanner or execution engine builds or trades — this is conceptual education only, so no live worked example is generated (never a fabricated one).`,
    symbol: null,
    detail: null,
    greeks: null,
  };
}

export function getStrategyAcademyEntry(key: string): (StrategyAcademyEntry & { paperExample: StrategyPaperExample }) | null {
  const entry = STATIC[key as StrategyAcademyKey];
  if (!entry) return null;
  const paperExample =
    entry.key === "iron_condor" || entry.key === "iron_fly" || entry.key === "calendar_spread"
      ? buildLiveExample(entry.key)
      : buildUnavailableExample(entry.label);
  return { ...entry, paperExample };
}

export function allStrategyAcademyEntries(): (StrategyAcademyEntry & { paperExample: StrategyPaperExample })[] {
  return (Object.keys(STATIC) as StrategyAcademyKey[]).map((k) => getStrategyAcademyEntry(k)!);
}

export function strategyAcademyKeys(): StrategyAcademyKey[] {
  return Object.keys(STATIC) as StrategyAcademyKey[];
}
