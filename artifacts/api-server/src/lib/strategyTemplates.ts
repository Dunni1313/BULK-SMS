// v1.5.0, Sprint 9 — AI Strategy Builder. A pure, static, read-only registry
// of starter strategy templates — the approved scope's own explicit
// requirement is "the architecture must allow additional templates later
// without schema changes," satisfied here as a plain TypeScript array: a
// 18th template is a one-line addition, never a migration (strategy_type
// is free text on ai_strategies, per migration 042's own header comment).
//
// Each template's `defaultSections` is a short, honestly-labelled starting
// point for a handful of the 14 qualitative section kinds — never a
// fabricated claim that the template "works" or is validated in any way;
// every template's own description says so explicitly. Applying a template
// to a new strategy only pre-fills its own sections' initial content —
// the user is expected to refine every section for their own trading/
// investing style before relying on it.

import { STRATEGY_SECTION_KINDS, type StrategySectionKind } from "@workspace/db";

// Deliberately not importing CoachId from routes/aiCoachConversations.ts —
// lib/ stays a lower-level layer than routes/, never the reverse. The
// literal union below is kept in sync by hand with that file's own
// COACH_IDS (unchanged since Sprint 6: "trading" | "investing" | "options").
type SuggestedCoachId = "trading" | "investing" | "options";

export interface StrategyTemplate {
  id: string;
  label: string;
  /** Which coach this template is most naturally suited to — a
   * suggestion only; a user may still create a strategy from any
   * template under any coach. */
  suggestedCoachId: SuggestedCoachId;
  suggestedAssetClass: string;
  description: string;
  defaultSections: Partial<Record<StrategySectionKind, string>>;
}

const QUALITATIVE_SECTION_KINDS = STRATEGY_SECTION_KINDS.filter(
  (k) => k !== "attachment" && k !== "research_link" && k !== "notebook_reference",
);

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "trend-following",
    label: "Trend Following",
    suggestedCoachId: "trading",
    suggestedAssetClass: "equities",
    description: "A starting outline for riding an established directional move. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A liquid instrument in a clear, established directional trend (higher timeframe structure agrees with the entry timeframe).",
      setup: "Price is trending and has pulled back to a moving average or prior structure level without breaking trend.",
      entry: "Enter on the first sign of trend resumption after the pullback (e.g. a higher low forming, momentum turning back in the trend's direction).",
    },
  },
  {
    id: "mean-reversion",
    label: "Mean Reversion",
    suggestedCoachId: "trading",
    suggestedAssetClass: "equities",
    description: "A starting outline for fading a short-term extreme back toward an average. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A range-bound or non-trending instrument, ideally with historically stable volatility.",
      setup: "Price has moved a statistically unusual distance from its short-term average without a fundamental catalyst.",
      entry: "Enter once price shows a genuine reversal signal back toward the average, not simply because it is 'far' from it.",
    },
  },
  {
    id: "breakout",
    label: "Breakout",
    suggestedCoachId: "trading",
    suggestedAssetClass: "equities",
    description: "A starting outline for entering as price clears a well-defined level. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A period of contraction/consolidation building a well-defined support or resistance level.",
      setup: "Price approaches a level that has been tested multiple times with decreasing volatility.",
      entry: "Enter on a confirmed close beyond the level, ideally with above-average volume/participation.",
    },
  },
  {
    id: "pullback",
    label: "Pullback",
    suggestedCoachId: "trading",
    suggestedAssetClass: "equities",
    description: "A starting outline for entering an established trend on a shallow retracement. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "An established trend with a healthy sequence of higher highs/higher lows (or the inverse for a downtrend).",
      setup: "A shallow retracement into a prior support/resistance zone or a well-respected moving average.",
    },
  },
  {
    id: "scalping",
    label: "Scalping",
    suggestedCoachId: "trading",
    suggestedAssetClass: "equities",
    description: "A starting outline for very short-duration trades targeting small, fast moves. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A liquid instrument with tight spreads during its most active trading hours.",
      risk: "Position size must account for execution slippage — a scalping edge is highly sensitive to transaction costs.",
    },
  },
  {
    id: "swing-trading",
    label: "Swing Trading",
    suggestedCoachId: "trading",
    suggestedAssetClass: "equities",
    description: "A starting outline for multi-day directional trades. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A multi-day directional opportunity identified on a daily or 4-hour chart.",
    },
  },
  {
    id: "position-trading",
    label: "Position Trading",
    suggestedCoachId: "trading",
    suggestedAssetClass: "equities",
    description: "A starting outline for multi-week to multi-month directional trades. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A longer-term thematic or structural opportunity, typically identified on a weekly chart.",
    },
  },
  {
    id: "covered-calls",
    label: "Covered Calls",
    suggestedCoachId: "options",
    suggestedAssetClass: "options",
    description: "A starting outline for selling calls against a held long position. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "An existing long equity position the holder is willing to have called away at the strike.",
      setup: "Select a call strike above the current price with premium that compensates for the capped upside.",
    },
  },
  {
    id: "cash-secured-puts",
    label: "Cash Secured Puts",
    suggestedCoachId: "options",
    suggestedAssetClass: "options",
    description: "A starting outline for selling puts backed by cash, willing to be assigned shares. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A stock the seller is genuinely willing to own at the strike price if assigned.",
      setup: "Select a put strike below the current price at a level considered a reasonable entry.",
    },
  },
  {
    id: "iron-condor",
    label: "Iron Condor",
    suggestedCoachId: "options",
    suggestedAssetClass: "options",
    description: "A starting outline for a defined-risk, range-bound premium-selling structure. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "An instrument expected to stay within a range through expiration, ideally with elevated implied volatility.",
    },
  },
  {
    id: "iron-butterfly",
    label: "Iron Butterfly",
    suggestedCoachId: "options",
    suggestedAssetClass: "options",
    description: "A starting outline for a tighter, higher-credit range-bound structure than an iron condor. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "An instrument expected to pin close to its current price through expiration.",
    },
  },
  {
    id: "calendar-spread",
    label: "Calendar Spread",
    suggestedCoachId: "options",
    suggestedAssetClass: "options",
    description: "A starting outline for exploiting differing rates of time decay across expirations. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "An instrument where near-term implied volatility is elevated relative to a further-dated expiration.",
    },
  },
  {
    id: "vertical-spread",
    label: "Vertical Spread",
    suggestedCoachId: "options",
    suggestedAssetClass: "options",
    description: "A starting outline for a defined-risk directional options structure. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A directional view with a defined risk/reward preferred over an outright long option.",
    },
  },
  {
    id: "wheel-strategy",
    label: "Wheel Strategy",
    suggestedCoachId: "options",
    suggestedAssetClass: "options",
    description: "A starting outline for cycling cash-secured puts and covered calls on the same underlying. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A stock the trader is comfortable owning long-term, cycled between cash-secured puts and covered calls.",
    },
  },
  {
    id: "dividend-strategy",
    label: "Dividend Strategy",
    suggestedCoachId: "investing",
    suggestedAssetClass: "equities",
    description: "A starting outline for building income from dividend-paying holdings. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A company with a sustainable payout ratio and a history of stable or growing dividends.",
    },
  },
  {
    id: "value-investing",
    label: "Value Investing",
    suggestedCoachId: "investing",
    suggestedAssetClass: "equities",
    description: "A starting outline for buying businesses below an estimate of intrinsic value. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A company trading at a discount to a conservative estimate of intrinsic value, with a real margin of safety.",
    },
  },
  {
    id: "growth-investing",
    label: "Growth Investing",
    suggestedCoachId: "investing",
    suggestedAssetClass: "equities",
    description: "A starting outline for buying businesses with durable above-average growth. Refine every section for your own risk tolerance before use.",
    defaultSections: {
      market_context: "A company with durable, above-average revenue/earnings growth and a credible path to sustaining it.",
    },
  },
];

export function getStrategyTemplate(id: string): StrategyTemplate | null {
  return STRATEGY_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function templateDefaultSections(id: string): Array<{ kind: StrategySectionKind; content: string }> {
  const template = getStrategyTemplate(id);
  if (!template) return [];
  return QUALITATIVE_SECTION_KINDS.filter((k) => template.defaultSections[k] !== undefined).map((k) => ({
    kind: k,
    content: template.defaultSections[k]!,
  }));
}
