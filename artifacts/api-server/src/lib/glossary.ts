// AI Teacher & Learning Centre sprint — the Glossary. Deterministic,
// version-controlled term definitions (a plain TypeScript literal, not
// LLM-generated, not fetched from anywhere) covering every category the
// Learning Paths cover: Foundations, Options Greeks, Volatility, Options
// Strategies, Portfolio, Performance, and Institutional Thinking.
//
// Every term cross-links to related terms (by key) and related lessons
// (by learning-path topic key, see lib/learningPaths.ts) so the
// frontend can render "See also" / "Read the lesson" links in both
// directions without a second data source drifting out of sync.

export type GlossaryCategory =
  | "foundations"
  | "greeks"
  | "volatility"
  | "strategies"
  | "portfolio"
  | "performance"
  | "institutional"
  | "value-investing";

export interface GlossaryTerm {
  key: string;
  term: string;
  category: GlossaryCategory;
  definition: string;
  relatedTermKeys: string[];
  relatedLessonKeys: string[];
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // ─── Foundations ────────────────────────────────────────────────────
  {
    key: "stock",
    term: "Stock",
    category: "foundations",
    definition: "A share of ownership in a company. Owning a stock entitles you to a proportional claim on the company's assets and earnings, and its price moves with the market's view of the company's prospects.",
    relatedTermKeys: ["option", "underlying"],
    relatedLessonKeys: ["foundations-stocks"],
  },
  {
    key: "option",
    term: "Option",
    category: "foundations",
    definition: "A contract giving the buyer the right, but not the obligation, to buy (a call) or sell (a put) 100 shares of an underlying stock at a fixed strike price on or before a fixed expiration date, in exchange for a premium paid to the seller.",
    relatedTermKeys: ["call", "put", "strike-price", "premium", "expiration"],
    relatedLessonKeys: ["foundations-options"],
  },
  {
    key: "call",
    term: "Call Option",
    category: "foundations",
    definition: "An option giving the buyer the right to BUY 100 shares at the strike price. Call buyers profit when the underlying rises above the strike plus the premium paid; call sellers collect the premium and profit if the underlying stays below the strike.",
    relatedTermKeys: ["option", "put", "assignment"],
    relatedLessonKeys: ["foundations-calls"],
  },
  {
    key: "put",
    term: "Put Option",
    category: "foundations",
    definition: "An option giving the buyer the right to SELL 100 shares at the strike price. Put buyers profit when the underlying falls below the strike minus the premium paid; put sellers collect the premium and profit if the underlying stays above the strike.",
    relatedTermKeys: ["option", "call", "assignment"],
    relatedLessonKeys: ["foundations-puts"],
  },
  {
    key: "strike-price",
    term: "Strike Price",
    category: "foundations",
    definition: "The fixed price at which an option's underlying shares can be bought (call) or sold (put). Where the strike sits relative to the current underlying price determines whether the option is in-, at-, or out-of-the-money.",
    relatedTermKeys: ["option", "in-the-money", "out-of-the-money", "at-the-money"],
    relatedLessonKeys: ["foundations-strike-price"],
  },
  {
    key: "premium",
    term: "Premium",
    category: "foundations",
    definition: "The price of an option, paid by the buyer to the seller. Premium is made up of intrinsic value (how far in-the-money the option already is) plus extrinsic/time value (which decays toward zero as expiration approaches).",
    relatedTermKeys: ["option", "theta", "premium-collected"],
    relatedLessonKeys: ["foundations-premium"],
  },
  {
    key: "expiration",
    term: "Expiration",
    category: "foundations",
    definition: "The date an option contract stops existing. After expiration, an in-the-money option is automatically exercised/assigned (for most US equity options) and an out-of-the-money option expires worthless.",
    relatedTermKeys: ["option", "assignment", "theta"],
    relatedLessonKeys: ["foundations-expiration"],
  },
  {
    key: "assignment",
    term: "Assignment",
    category: "foundations",
    definition: "What happens to the SELLER of an option when the buyer exercises it: the seller of a call must deliver 100 shares at the strike; the seller of a put must buy 100 shares at the strike. American-style equity options can be assigned at any time before expiration, not only at expiration.",
    relatedTermKeys: ["call", "put", "exercise"],
    relatedLessonKeys: ["foundations-assignment"],
  },
  {
    key: "exercise",
    term: "Exercise",
    category: "foundations",
    definition: "What the BUYER of an option does to invoke their right to buy (call) or sell (put) the underlying at the strike price. Exercising a call is choosing to buy; exercising a put is choosing to sell.",
    relatedTermKeys: ["assignment", "call", "put"],
    relatedLessonKeys: ["foundations-assignment"],
  },
  {
    key: "in-the-money",
    term: "In-the-Money (ITM)",
    category: "foundations",
    definition: "An option with positive intrinsic value: a call whose strike is below the current underlying price, or a put whose strike is above it. ITM options carry higher assignment risk.",
    relatedTermKeys: ["strike-price", "out-of-the-money", "at-the-money", "assignment"],
    relatedLessonKeys: ["foundations-strike-price"],
  },
  {
    key: "out-of-the-money",
    term: "Out-of-the-Money (OTM)",
    category: "foundations",
    definition: "An option with zero intrinsic value: a call whose strike is above the current underlying price, or a put whose strike is below it. OTM options are pure time value and expire worthless if the underlying never crosses the strike.",
    relatedTermKeys: ["strike-price", "in-the-money", "at-the-money"],
    relatedLessonKeys: ["foundations-strike-price"],
  },
  {
    key: "at-the-money",
    term: "At-the-Money (ATM)",
    category: "foundations",
    definition: "An option whose strike price sits at (or very near) the current underlying price. ATM options carry the most extrinsic value, the fastest theta decay, and the highest gamma and vega.",
    relatedTermKeys: ["strike-price", "in-the-money", "out-of-the-money", "gamma"],
    relatedLessonKeys: ["foundations-strike-price"],
  },

  // ─── Greeks ──────────────────────────────────────────────────────────
  {
    key: "delta",
    term: "Delta",
    category: "greeks",
    definition: "How much an option's price moves per $1 move in the underlying. Calls run 0 to +1, puts 0 to −1. Delta also approximates the probability an option finishes in the money, and the signed sum of every leg's delta gives a position's overall directional exposure.",
    relatedTermKeys: ["gamma", "portfolio-greeks", "probability-of-profit"],
    relatedLessonKeys: ["greeks-delta"],
  },
  {
    key: "gamma",
    term: "Gamma",
    category: "greeks",
    definition: "The rate of change of delta as the underlying moves. High gamma means delta swings rapidly — largest for at-the-money options close to expiration. Premium sellers are typically short gamma, so risk accelerates on a fast move.",
    relatedTermKeys: ["delta", "at-the-money"],
    relatedLessonKeys: ["greeks-gamma"],
  },
  {
    key: "theta",
    term: "Theta",
    category: "greeks",
    definition: "The dollar amount an option's price decays per calendar day, all else equal. Decay accelerates near expiration and is fastest for at-the-money options. For a buyer theta is a cost; for a seller it is income.",
    relatedTermKeys: ["premium", "theta-income", "expiration"],
    relatedLessonKeys: ["greeks-theta"],
  },
  {
    key: "vega",
    term: "Vega",
    category: "greeks",
    definition: "How much an option's price moves per 1-percentage-point change in implied volatility. Vega is largest for at-the-money, longer-dated options. Premium sellers are usually short vega and benefit from falling IV.",
    relatedTermKeys: ["implied-volatility", "iv-crush"],
    relatedLessonKeys: ["greeks-vega"],
  },
  {
    key: "rho",
    term: "Rho",
    category: "greeks",
    definition: "How much an option's price moves per 1-percentage-point change in interest rates. Rho is usually the smallest, least-watched Greek for short-dated equity options, since rate moves are slow relative to an option's life.",
    relatedTermKeys: ["delta", "theta"],
    relatedLessonKeys: ["greeks-rho"],
  },
  {
    key: "portfolio-greeks",
    term: "Portfolio Greeks",
    category: "greeks",
    definition: "The sum of every open position's own Greeks, giving one net figure for the whole account (e.g. net delta, net theta). This is the number that actually describes your total directional/time/volatility exposure — not any single position's own Greeks in isolation.",
    relatedTermKeys: ["delta", "theta", "gamma", "vega"],
    relatedLessonKeys: ["greeks-portfolio-greeks"],
  },

  // ─── Volatility ──────────────────────────────────────────────────────
  {
    key: "implied-volatility",
    term: "Implied Volatility (IV)",
    category: "volatility",
    definition: "The market's forward-looking estimate of how much a stock will move, backed out of an option's own price. Higher IV means richer option premiums on both calls and puts. IV tends to rise before uncertain events (like earnings) and fall afterward.",
    relatedTermKeys: ["historical-volatility", "iv-rank", "vega", "iv-crush"],
    relatedLessonKeys: ["volatility-iv"],
  },
  {
    key: "historical-volatility",
    term: "Historical Volatility (HV)",
    category: "volatility",
    definition: "How much a stock has actually moved in the past, computed from its own historical price series (also called realized volatility). Comparing IV to HV shows whether options are pricing in more or less movement than the stock has recently delivered.",
    relatedTermKeys: ["implied-volatility", "expected-move"],
    relatedLessonKeys: ["volatility-hv"],
  },
  {
    key: "iv-rank",
    term: "IV Rank",
    category: "volatility",
    definition: "Where a stock's current implied volatility sits relative to its own 52-week IV range, expressed 0-100. A high IV rank means options are relatively expensive for THIS stock right now — the classic signal premium sellers look for before selling.",
    relatedTermKeys: ["implied-volatility", "iv-crush"],
    relatedLessonKeys: ["volatility-iv-rank"],
  },
  {
    key: "expected-move",
    term: "Expected Move",
    category: "volatility",
    definition: "The market-implied range a stock is likely to trade within by a given date, derived from implied volatility and time (IV × √(days/365)). It is a one-standard-deviation estimate, not a prediction — roughly a 68% chance the stock stays inside that range.",
    relatedTermKeys: ["implied-volatility", "historical-volatility"],
    relatedLessonKeys: ["volatility-expected-move"],
  },
  {
    key: "iv-crush",
    term: "IV Crush",
    category: "volatility",
    definition: "The sharp drop in implied volatility that typically follows a known event (most commonly earnings), once the uncertainty the market was pricing in has been resolved. Premium sellers structure earnings plays specifically to harvest this collapse.",
    relatedTermKeys: ["implied-volatility", "iv-rank", "earnings-volatility"],
    relatedLessonKeys: ["volatility-earnings"],
  },
  {
    key: "earnings-volatility",
    term: "Earnings Volatility",
    category: "volatility",
    definition: "The elevated implied volatility priced into an option ahead of a company's earnings report, reflecting genuine uncertainty about the result. It typically collapses (see IV Crush) the trading day after the report.",
    relatedTermKeys: ["iv-crush", "expected-move", "iv-rank"],
    relatedLessonKeys: ["volatility-earnings"],
  },

  // ─── Strategies ──────────────────────────────────────────────────────
  {
    key: "covered-call",
    term: "Covered Call",
    category: "strategies",
    definition: "Owning 100 shares of stock and selling a call option against them. Collects premium income and caps upside at the strike; the stock itself remains the primary risk (a falling stock still loses value, only partly offset by the premium collected).",
    relatedTermKeys: ["call", "cash-secured-put", "wheel"],
    relatedLessonKeys: ["strategies-covered-calls"],
  },
  {
    key: "cash-secured-put",
    term: "Cash Secured Put (CSP)",
    category: "strategies",
    definition: "Selling a put option while holding enough cash to buy 100 shares at the strike if assigned. Collects premium income; if the stock falls below the strike, you're assigned and own the shares at an effective cost basis reduced by the premium collected.",
    relatedTermKeys: ["put", "covered-call", "wheel", "assignment"],
    relatedLessonKeys: ["strategies-csp"],
  },
  {
    key: "wheel",
    term: "The Wheel",
    category: "strategies",
    definition: "A cyclical income strategy: sell cash-secured puts on a stock you're willing to own; if assigned, sell covered calls on the resulting shares until they're called away; then return to selling puts. Designed to collect premium at every stage of the cycle.",
    relatedTermKeys: ["cash-secured-put", "covered-call"],
    relatedLessonKeys: ["strategies-wheel"],
  },
  {
    key: "vertical-spread",
    term: "Vertical Spread",
    category: "strategies",
    definition: "Buying and selling two options of the same type (both calls or both puts) and expiration, at different strikes. Defines both maximum profit and maximum loss up front — the basic building block of an iron condor's own put and call spreads.",
    relatedTermKeys: ["iron-condor", "strike-price"],
    relatedLessonKeys: ["strategies-verticals"],
  },
  {
    key: "iron-condor",
    term: "Iron Condor",
    category: "strategies",
    definition: "A defined-risk, credit-collecting strategy combining a short put spread below the market and a short call spread above it. Profits when the underlying stays between the two short strikes through expiration; this platform's own scanner and execution engine build and price real iron condors.",
    relatedTermKeys: ["vertical-spread", "iron-butterfly", "delta"],
    relatedLessonKeys: ["strategies-iron-condor"],
  },
  {
    key: "iron-butterfly",
    term: "Iron Butterfly",
    category: "strategies",
    definition: "Like an iron condor, but both short strikes sit at the same at-the-money price. Collects the richest credit of the family but has the narrowest profit zone — maximum income, minimum margin for error.",
    relatedTermKeys: ["iron-condor", "at-the-money", "vertical-spread"],
    relatedLessonKeys: ["strategies-iron-butterfly"],
  },
  {
    key: "calendar-spread",
    term: "Calendar Spread",
    category: "strategies",
    definition: "Selling a near-dated option and buying a longer-dated option at the same strike. Profits from the front-month option decaying faster than the back-month option, and from rising implied volatility on the longer-dated leg; this platform's own engine builds and prices real calendar spreads.",
    relatedTermKeys: ["diagonal-spread", "theta"],
    relatedLessonKeys: ["strategies-calendar"],
  },
  {
    key: "diagonal-spread",
    term: "Diagonal Spread",
    category: "strategies",
    definition: "Like a calendar spread, but the near- and far-dated legs use different strikes rather than the same one — combining a calendar's time-decay edge with a directional lean from the strike offset.",
    relatedTermKeys: ["calendar-spread", "vertical-spread"],
    relatedLessonKeys: ["strategies-diagonal"],
  },

  // ─── Portfolio ───────────────────────────────────────────────────────
  {
    key: "position-sizing",
    term: "Position Sizing",
    category: "portfolio",
    definition: "Deciding how much capital to risk on a single trade, typically bounded as a percentage of total account value. Disciplined position sizing is what prevents any one trade — however well-analyzed — from doing outsized damage to the portfolio.",
    relatedTermKeys: ["concentration", "buying-power"],
    relatedLessonKeys: ["portfolio-position-sizing"],
  },
  {
    key: "portfolio-health",
    term: "Portfolio Health",
    category: "portfolio",
    definition: "A single, blended 0-100 score this platform computes from Concentration, Diversification, Event Risk, Net Greeks Exposure, Directional Exposure, Position Sizing Quality, Position Count, and Expiration Distribution — a deterministic aggregation of already-computed risk factors, never a new statistical model.",
    relatedTermKeys: ["concentration", "diversification", "event-risk"],
    relatedLessonKeys: ["portfolio-health"],
  },
  {
    key: "buying-power",
    term: "Buying Power",
    category: "portfolio",
    definition: "The capital available in an account to open new positions, after accounting for the margin/risk already committed to open trades. Selling defined-risk spreads (like an iron condor) ties up buying power equal to the maximum loss.",
    relatedTermKeys: ["position-sizing", "max-loss"],
    relatedLessonKeys: ["portfolio-buying-power"],
  },
  {
    key: "concentration",
    term: "Concentration",
    category: "portfolio",
    definition: "How much of a portfolio's risk sits in a single symbol, sector, strategy, or expiration date. High concentration means one adverse move can affect a large share of the account at once — the opposite of diversification.",
    relatedTermKeys: ["diversification", "correlation", "position-sizing"],
    relatedLessonKeys: ["portfolio-concentration"],
  },
  {
    key: "diversification",
    term: "Diversification",
    category: "portfolio",
    definition: "Spreading risk across multiple symbols, sectors, strategies, and expirations so no single adverse event can materially damage the whole portfolio. The inverse measure of concentration.",
    relatedTermKeys: ["concentration", "correlation"],
    relatedLessonKeys: ["portfolio-diversification"],
  },
  {
    key: "correlation",
    term: "Correlation",
    category: "portfolio",
    definition: "How closely two positions' values tend to move together. Highly correlated positions (e.g. several tech-sector iron condors) don't provide real diversification even if the symbols differ, since they tend to gain or lose together.",
    relatedTermKeys: ["diversification", "concentration"],
    relatedLessonKeys: ["portfolio-correlation"],
  },
  {
    key: "stress-testing",
    term: "Stress Testing",
    category: "portfolio",
    definition: "Repricing every open position under a hypothetical shock (a price move, an IV spike, or time passing) to see how the portfolio's value and risk score would change — a what-if simulation over real, already-computed positions, not a forecast.",
    relatedTermKeys: ["event-risk", "portfolio-health"],
    relatedLessonKeys: ["portfolio-stress-testing"],
  },
  {
    key: "event-risk",
    term: "Event Risk",
    category: "portfolio",
    definition: "The risk that a scheduled event (earnings, an economic release, a dividend date) causes an outsized, sudden move in a position before you can react. This platform classifies each open position's own event-risk level from known upcoming event dates.",
    relatedTermKeys: ["earnings-volatility", "stress-testing"],
    relatedLessonKeys: ["portfolio-event-risk"],
  },

  // ─── Performance ─────────────────────────────────────────────────────
  {
    key: "win-rate",
    term: "Win Rate",
    category: "performance",
    definition: "The percentage of closed trades that were profitable. A useful but incomplete metric on its own — a high win rate with rare, large losses can still be a losing strategy overall (see Expectancy).",
    relatedTermKeys: ["expectancy", "probability-of-profit"],
    relatedLessonKeys: ["performance-win-rate"],
  },
  {
    key: "drawdown",
    term: "Drawdown",
    category: "performance",
    definition: "The decline from a portfolio's highest recorded value to a subsequent low, before a new high is made. Maximum drawdown is a key measure of how much pain a strategy can inflict along the way to its long-run return.",
    relatedTermKeys: ["win-rate", "expectancy"],
    relatedLessonKeys: ["performance-drawdown"],
  },
  {
    key: "theta-income",
    term: "Theta Income",
    category: "performance",
    definition: "The projected dollar income from time decay across every open position, summed into a daily/weekly/monthly figure — the practical, forward-looking counterpart to Premium Collected's own backward-looking, realized total.",
    relatedTermKeys: ["theta", "premium-collected"],
    relatedLessonKeys: ["performance-theta-income"],
  },
  {
    key: "premium-collected",
    term: "Premium Collected",
    category: "performance",
    definition: "The total credit actually received from selling options across closed (or currently open) trades — a realized, backward-looking figure, distinct from Theta Income's own forward-looking daily/weekly/monthly projection.",
    relatedTermKeys: ["premium", "theta-income"],
    relatedLessonKeys: ["performance-premium-collected"],
  },
  {
    key: "return-on-capital",
    term: "Return on Capital",
    category: "performance",
    definition: "Profit expressed as a percentage of the capital actually put at risk (typically max loss for a defined-risk spread), rather than as a raw dollar figure — the number that lets you compare trades of very different sizes on equal footing.",
    relatedTermKeys: ["max-loss", "expectancy"],
    relatedLessonKeys: ["performance-return-on-capital"],
  },
  {
    key: "expectancy",
    term: "Expectancy",
    category: "performance",
    definition: "The average dollar result you'd expect per trade over a large sample, combining win rate with average win and average loss size: (win rate × avg win) − (loss rate × avg loss). Positive expectancy is what makes a strategy sustainable over time, regardless of any single trade's outcome.",
    relatedTermKeys: ["win-rate", "expected-value"],
    relatedLessonKeys: ["performance-expectancy"],
  },

  // ─── Institutional Thinking ──────────────────────────────────────────
  {
    key: "portfolio-construction",
    term: "Portfolio Construction",
    category: "institutional",
    definition: "The deliberate process of deciding which positions to hold and in what size, guided by an explicit risk budget — the opposite of accumulating positions one trade idea at a time with no view of the whole.",
    relatedTermKeys: ["risk-contribution", "capital-allocation"],
    relatedLessonKeys: ["institutional-portfolio-construction"],
  },
  {
    key: "risk-contribution",
    term: "Risk Contribution",
    category: "institutional",
    definition: "How much of a portfolio's TOTAL risk a single position actually accounts for — not its dollar size alone, but its share of aggregate delta/theta/vega exposure and concentration. A small position in a volatile, correlated symbol can contribute disproportionate risk.",
    relatedTermKeys: ["concentration", "portfolio-construction"],
    relatedLessonKeys: ["institutional-risk-contribution"],
  },
  {
    key: "capital-allocation",
    term: "Capital Allocation",
    category: "institutional",
    definition: "Deciding how much of total available capital to deploy at all, and how to divide it across opportunities — a decision made before, and independent of, any single trade's own attractiveness.",
    relatedTermKeys: ["position-sizing", "buying-power"],
    relatedLessonKeys: ["institutional-capital-allocation"],
  },
  {
    key: "position-management",
    term: "Position Management",
    category: "institutional",
    definition: "The ongoing discipline of monitoring, adjusting, rolling, or closing an open position as conditions change — treating a trade as a managed process from entry to exit, not a decision made once and forgotten.",
    relatedTermKeys: ["risk-contribution", "decision-quality"],
    relatedLessonKeys: ["institutional-position-management"],
  },
  {
    key: "decision-quality",
    term: "Decision Quality",
    category: "institutional",
    definition: "Judging a decision by the soundness of the process and the information available at the time it was made — not by the outcome alone. A well-reasoned trade can still lose; a poorly-reasoned trade can still win. Institutional discipline separates the two.",
    relatedTermKeys: ["process-over-prediction", "position-management"],
    relatedLessonKeys: ["institutional-decision-quality"],
  },
  {
    key: "process-over-prediction",
    term: "Process over Prediction",
    category: "institutional",
    definition: "The core institutional mindset: build a repeatable, disciplined process (position sizing rules, defined risk, diversification, systematic entries/exits) rather than trying to correctly predict any single outcome — since no one can predict outcomes reliably, but a good process compounds over many trials.",
    relatedTermKeys: ["decision-quality", "expectancy"],
    relatedLessonKeys: ["institutional-process-over-prediction"],
  },

  // ─── Cross-cutting terms referenced above but not yet defined ─────────
  {
    key: "underlying",
    term: "Underlying",
    category: "foundations",
    definition: "The stock (or other asset) an option contract is written on. An option's value is derived from — and moves with — its underlying's price.",
    relatedTermKeys: ["stock", "option"],
    relatedLessonKeys: ["foundations-stocks"],
  },
  {
    key: "max-profit",
    term: "Maximum Profit",
    category: "performance",
    definition: "The most a defined-risk position can possibly make, known and fixed at entry — for a credit spread, typically the net credit received.",
    relatedTermKeys: ["max-loss", "return-on-capital"],
    relatedLessonKeys: ["performance-return-on-capital"],
  },
  {
    key: "max-loss",
    term: "Maximum Loss",
    category: "performance",
    definition: "The most a defined-risk position can possibly lose, known and fixed at entry — for a credit spread, typically the width between strikes minus the credit received.",
    relatedTermKeys: ["max-profit", "buying-power"],
    relatedLessonKeys: ["performance-return-on-capital"],
  },
  {
    key: "probability-of-profit",
    term: "Probability of Profit (POP)",
    category: "performance",
    definition: "The estimated chance a position finishes profitable by expiration, derived from delta with a volatility-risk-premium haircut applied (since implied volatility tends to overstate realized volatility). A high POP alone doesn't guarantee positive expected value — see Expectancy.",
    relatedTermKeys: ["delta", "expectancy", "expected-value"],
    relatedLessonKeys: ["performance-win-rate"],
  },
  {
    key: "expected-value",
    term: "Expected Value (EV)",
    category: "performance",
    definition: "The probability-weighted average dollar outcome of a single trade: (POP × max profit) − ((1 − POP) × max loss). A trade can have a high win rate and still have negative expected value if the loss on the rare miss is large enough.",
    relatedTermKeys: ["probability-of-profit", "expectancy", "max-profit", "max-loss"],
    relatedLessonKeys: ["performance-expectancy"],
  },

  // ─── Value Investing (Phase 12 — Institutional Investing Engine
  // Consolidation & Integration). Every definition here describes an
  // already-existing, already-tested Engine 1 concept
  // (grahamValuation.ts/dcfValuation.ts/buffettValuation.ts/
  // investmentQuality.ts/competitiveAdvantage.ts/tomNashEngine.ts/
  // investmentCommittee.ts) — no new methodology is invented here, only
  // its definition. relatedLessonKeys is intentionally empty for these:
  // Value Investing School's own lessons (lib/valueSchool.ts) live in a
  // separate id-space from lib/learningPaths.ts' topic keys. ─────────────
  {
    key: "margin-of-safety",
    term: "Margin of Safety",
    category: "value-investing",
    definition: "The discount between a company's estimated fair (intrinsic) value and its current market price, expressed as a percentage. A larger margin of safety cushions an investor against errors in the valuation estimate or unforeseen bad news — Benjamin Graham's central risk-management idea.",
    relatedTermKeys: ["intrinsic-value", "graham-number"],
    relatedLessonKeys: [],
  },
  {
    key: "intrinsic-value",
    term: "Intrinsic Value",
    category: "value-investing",
    definition: "An estimate of what a business is actually worth, based on its underlying financials (earnings, assets, cash flow), independent of its current, possibly emotional, market price. Engine 1 computes several independent intrinsic-value estimates (Graham, DCF, Buffett, and a blended model) rather than a single number.",
    relatedTermKeys: ["margin-of-safety", "discounted-cash-flow", "graham-number"],
    relatedLessonKeys: [],
  },
  {
    key: "economic-moat",
    term: "Economic Moat",
    category: "value-investing",
    definition: "A durable competitive advantage that protects a company's profits from competitors over time — brand strength, network effects, switching costs, economies of scale, or regulatory protection. Rated Wide, Medium, Narrow, or None.",
    relatedTermKeys: ["competitive-advantage-dimensions", "capital-allocation-value"],
    relatedLessonKeys: [],
  },
  {
    key: "competitive-advantage-dimensions",
    term: "Competitive Advantage (11 Dimensions)",
    category: "value-investing",
    definition: "A broader, 11-dimension scoring framework beyond the classic economic moat — brand strength, network effects, switching costs, economies of scale, intangible assets, regulatory advantages, distribution, recurring revenue, cost advantages, competitive durability, and customer concentration risk.",
    relatedTermKeys: ["economic-moat"],
    relatedLessonKeys: [],
  },
  {
    key: "return-on-invested-capital",
    term: "Return on Invested Capital (ROIC)",
    category: "value-investing",
    definition: "How much operating profit a company generates for every dollar of capital (debt + equity) invested in the business. A consistently high ROIC, well above the company's cost of capital, is a hallmark of a durable competitive advantage.",
    relatedTermKeys: ["return-on-equity", "capital-allocation-value"],
    relatedLessonKeys: [],
  },
  {
    key: "return-on-equity",
    term: "Return on Equity (ROE)",
    category: "value-investing",
    definition: "Net income divided by shareholders' equity — how efficiently a company turns shareholders' own capital into profit. Unlike ROIC, ROE can be inflated by leverage (debt), so it is best read alongside debt levels and ROIC.",
    relatedTermKeys: ["return-on-invested-capital"],
    relatedLessonKeys: [],
  },
  {
    key: "owner-earnings",
    term: "Owner Earnings",
    category: "value-investing",
    definition: "Warren Buffett's preferred measure of a business's true cash-generating power, approximated here as free cash flow per share — the cash left over after the business reinvests what it needs to maintain its competitive position, available to be paid out to owners.",
    relatedTermKeys: ["free-cash-flow", "discounted-cash-flow"],
    relatedLessonKeys: [],
  },
  {
    key: "graham-number",
    term: "Graham Number",
    category: "value-investing",
    definition: "Benjamin Graham's conservative fair-value formula: the square root of (22.5 × trailing EPS × book value per share). Deliberately uses only trailing (already-reported) earnings, never a forward estimate, to avoid overpaying based on optimistic projections.",
    relatedTermKeys: ["margin-of-safety", "intrinsic-value"],
    relatedLessonKeys: [],
  },
  {
    key: "discounted-cash-flow",
    term: "Discounted Cash Flow (DCF)",
    category: "value-investing",
    definition: "A valuation method that projects a company's future free cash flows and discounts them back to a present value using a required rate of return, plus a terminal value for cash flows beyond the projection window. A historical, deterministic calculation applied to already-reported financials — not a prediction of a future stock price.",
    relatedTermKeys: ["free-cash-flow", "owner-earnings", "intrinsic-value"],
    relatedLessonKeys: [],
  },
  {
    key: "free-cash-flow",
    term: "Free Cash Flow (FCF)",
    category: "value-investing",
    definition: "Cash generated by operations minus capital expenditures — the cash a business actually has left over after keeping its operations running and its productive assets maintained, before any decision about dividends, buybacks, or debt paydown.",
    relatedTermKeys: ["owner-earnings", "discounted-cash-flow"],
    relatedLessonKeys: [],
  },
  {
    key: "book-value",
    term: "Book Value",
    category: "value-investing",
    definition: "A company's total assets minus its total liabilities, as reported on its balance sheet — a conservative, accounting-based measure of net worth used directly in the Graham Number formula.",
    relatedTermKeys: ["graham-number"],
    relatedLessonKeys: [],
  },
  {
    key: "price-earnings-ratio",
    term: "Price/Earnings (P/E) Ratio",
    category: "value-investing",
    definition: "Share price divided by earnings per share — the most common valuation shorthand, showing how many years of current earnings an investor is paying for. Best interpreted relative to a company's own trailing history and its industry peers, not in isolation.",
    relatedTermKeys: ["ev-ebitda"],
    relatedLessonKeys: [],
  },
  {
    key: "ev-ebitda",
    term: "EV/EBITDA",
    category: "value-investing",
    definition: "Enterprise Value divided by earnings before interest, taxes, depreciation, and amortization — a capital-structure-neutral valuation multiple that, unlike the P/E ratio, is unaffected by differences in debt levels or tax rates between companies.",
    relatedTermKeys: ["price-earnings-ratio"],
    relatedLessonKeys: [],
  },
  {
    key: "circle-of-competence",
    term: "Circle of Competence",
    category: "value-investing",
    definition: "Charlie Munger and Warren Buffett's discipline of only investing in businesses whose economics you can genuinely understand — how the business makes money, why it will likely keep making money, and what could destroy it. The boundary of the circle matters more than its size.",
    relatedTermKeys: ["business-quality-score"],
    relatedLessonKeys: [],
  },
  {
    key: "business-quality-score",
    term: "Business Quality Score",
    category: "value-investing",
    definition: "A 12-metric, 0-100 composite covering growth, margins, returns on capital, debt, cash position, and share dilution/buybacks — a structural read of how good the underlying business is, independent of whether its stock is currently cheap or expensive.",
    relatedTermKeys: ["capital-allocation-value", "return-on-invested-capital"],
    relatedLessonKeys: [],
  },
  {
    key: "capital-allocation-value",
    term: "Capital Allocation",
    category: "value-investing",
    definition: "How well a company's management deploys the cash it generates — reinvesting in the business, paying down debt, buying back shares, or paying dividends. Good capital allocation compounds shareholder value over time; poor allocation (e.g. diluting shareholders or overpaying for acquisitions) destroys it.",
    relatedTermKeys: ["business-quality-score", "return-on-invested-capital"],
    relatedLessonKeys: [],
  },
  {
    key: "conviction-score",
    term: "Conviction Score",
    category: "value-investing",
    definition: "A single 0-100 score blending Business Quality, Growth, Capital Allocation, Financial Strength, and Valuation into one composite read (the Tom Nash Conviction Engine), paired with a Buy/Hold/Wait classification — a summary of already-computed analysis, never a new prediction.",
    relatedTermKeys: ["business-quality-score", "margin-of-safety"],
    relatedLessonKeys: [],
  },
];

export function searchGlossary(query?: string, category?: GlossaryCategory): GlossaryTerm[] {
  let results = GLOSSARY_TERMS;
  if (category) {
    results = results.filter((t) => t.category === category);
  }
  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase();
    results = results.filter(
      (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q) || t.key.includes(q),
    );
  }
  return [...results].sort((a, b) => a.term.localeCompare(b.term));
}

export function getGlossaryTerm(key: string): GlossaryTerm | null {
  return GLOSSARY_TERMS.find((t) => t.key === key) ?? null;
}

export function glossaryCategories(): GlossaryCategory[] {
  return ["foundations", "greeks", "volatility", "strategies", "portfolio", "performance", "institutional", "value-investing"];
}
