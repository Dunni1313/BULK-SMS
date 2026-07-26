// AI Teacher & Learning Centre sprint — structured Learning Paths.
// Deterministic, version-controlled content (a plain TypeScript
// literal, never LLM-generated). Reuses, rather than duplicates,
// existing dedicated pages where one already exists: the "delta" and
// "portfolio-greeks" topics link out to the pre-existing Delta
// Masterclass (/learn/delta) and Greeks Tutor (/learn/greeks) pages
// instead of re-authoring that content here.
//
// Every topic's relatedGlossaryKeys must be real keys in
// lib/glossary.ts — proven by a dedicated cross-reference test
// (learningPaths.test.ts) so the two content modules never silently
// drift apart.

import type { GlossaryCategory } from "./glossary.js";

// v1.4.0, Sprint L1 — Learning Centre Foundation.
export type LearningDifficulty = "beginner" | "intermediate" | "advanced" | "institutional";

export interface LearningTopicMetricExplained {
  term: string;
  explanation: string;
}

export interface LearningTopicWorkedExample {
  title: string;
  steps: string[];
  note?: string;
}

export interface LearningTopic {
  key: string;
  title: string;
  summary: string;
  body: string[];
  whyItMatters: string;
  externalHref: string | null;
  relatedGlossaryKeys: string[];
  estimatedMinutes: number;
  // v1.4.0, Sprint L1 — Learning Centre Foundation. Optional, richer
  // fields following the approved 13-part Learning Framework (Learning
  // Content Master Plan). All optional and undefined for every one of the
  // pre-existing 68 topics — this sprint populates them for exactly 3 new
  // foundation topics, establishing the template future sprints fill in
  // for everything else. The shared LessonRenderer component (see
  // components/learn/LessonRenderer.tsx) falls back to the plain
  // summary/body/whyItMatters rendering whenever these are absent.
  difficulty?: LearningDifficulty;
  whyItExists?: string;
  institutionalThinking?: string;
  workflowSteps?: string[];
  screenWalkthrough?: string[];
  metricsExplained?: LearningTopicMetricExplained[];
  workedExample?: LearningTopicWorkedExample;
  commonMistakes?: string[];
  riskWarnings?: string[];
  bestPractices?: string[];
  relatedModuleHrefs?: string[];
  aiCoachPrompts?: string[];
  nextStepKeys?: string[];
  guidedTourRequired?: boolean;
}

export interface LearningPath {
  key: string;
  title: string;
  description: string;
  glossaryCategory: GlossaryCategory;
  topics: LearningTopic[];
}

function topic(t: Omit<LearningTopic, "externalHref"> & { externalHref?: string }): LearningTopic {
  return { externalHref: t.externalHref ?? null, ...t };
}

const FOUNDATIONS_PATH: LearningPath = {
  key: "foundations",
  title: "Foundations",
  description: "The vocabulary and mechanics every options trader needs before anything else makes sense.",
  glossaryCategory: "foundations",
  topics: [
    topic({
      key: "foundations-stocks",
      title: "Stocks",
      summary: "What owning a share actually represents.",
      body: [
        "A stock is a share of ownership in a company. Its price reflects the market's collective view of the company's current and future earning power.",
        "Every option contract in this platform is written on 100 shares of some underlying stock — options have no independent existence; their value is entirely derived from the stock's own price, volatility, and time remaining.",
      ],
      whyItMatters: "Every Greek, every strategy, and every risk figure in this platform ultimately traces back to a stock's price and how it might move — options education starts here.",
      relatedGlossaryKeys: ["stock", "underlying"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "foundations-options",
      title: "Options",
      summary: "A contract, not a stock — the right, not the obligation.",
      body: [
        "An option gives its buyer the right, but not the obligation, to buy (call) or sell (put) 100 shares at a fixed strike price on or before a fixed expiration date, in exchange for a premium paid to the seller.",
        "That asymmetry — a right for the buyer, an obligation for the seller — is the foundation of every strategy this platform builds: selling options collects premium in exchange for taking on that obligation.",
      ],
      whyItMatters: "This platform is a premium-selling engine — understanding that sellers take on the obligation side of the contract is the single most important foundational idea.",
      relatedGlossaryKeys: ["option", "call", "put", "premium"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "foundations-calls",
      title: "Calls",
      summary: "The right to buy.",
      body: [
        "A call option gives its buyer the right to buy 100 shares at the strike price. Call buyers profit when the stock rises above the strike plus the premium paid.",
        "Call SELLERS collect the premium up front and profit when the stock stays below the strike — the position this platform's scanner and execution engine build when a short call leg is part of a structure.",
      ],
      whyItMatters: "Every iron condor and iron fly this platform builds has a short call spread as one of its two halves — understanding a call's own payoff is a prerequisite.",
      relatedGlossaryKeys: ["call", "put", "assignment"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "foundations-puts",
      title: "Puts",
      summary: "The right to sell.",
      body: [
        "A put option gives its buyer the right to sell 100 shares at the strike price. Put buyers profit when the stock falls below the strike minus the premium paid.",
        "Put SELLERS collect the premium up front and profit when the stock stays above the strike — the mirror image of a short call, and the other half of every iron condor this platform builds.",
      ],
      whyItMatters: "A Cash Secured Put strategy is built entirely from selling puts — understanding a put's own payoff is a prerequisite for the Strategy Academy's CSP entry.",
      relatedGlossaryKeys: ["put", "call", "assignment"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "foundations-strike-price",
      title: "Strike Price",
      summary: "The fixed price the option is written against.",
      body: [
        "The strike price is the fixed price at which the underlying can be bought (call) or sold (put). Where it sits relative to the current stock price determines whether an option is in-, at-, or out-of-the-money.",
        "This platform's scanner selects short strikes primarily by delta (commonly near 0.20), since delta approximates the probability that strike finishes in the money — see the Delta Masterclass for the full worked explanation.",
      ],
      whyItMatters: "Strike selection is the single biggest lever on a position's probability of profit, credit collected, and maximum loss — all three trade off against each other as the strike moves.",
      relatedGlossaryKeys: ["strike-price", "in-the-money", "out-of-the-money", "at-the-money"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "foundations-premium",
      title: "Premium",
      summary: "The price of the option itself.",
      body: [
        "Premium is what the option costs — paid by the buyer to the seller. It's made up of intrinsic value (how far ITM the option already is) plus extrinsic/time value, which decays toward zero as expiration approaches.",
        "Selling premium and collecting that time-value decay (theta) as it erodes is the structural income source behind every strategy in the Strategy Academy.",
      ],
      whyItMatters: "'Premium selling' is this whole platform's own name for its trading philosophy — understanding what premium actually is, and why it decays, explains the entire approach.",
      relatedGlossaryKeys: ["premium", "theta", "premium-collected"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "foundations-expiration",
      title: "Expiration",
      summary: "The date the contract stops existing.",
      body: [
        "Every option has an expiration date, after which it either settles in-the-money (via automatic exercise/assignment for most US equity options) or expires worthless out-of-the-money.",
        "Days-to-expiration (DTE) directly drives theta's decay rate, an option's remaining extrinsic value, and how far the expected move can realistically travel before settlement.",
      ],
      whyItMatters: "The DTE a position is entered at is one of the primary levers a premium seller controls — shorter DTE decays faster but leaves less room to be right; longer DTE decays slower but ties up capital longer.",
      relatedGlossaryKeys: ["expiration", "assignment", "theta"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "foundations-assignment",
      title: "Assignment",
      summary: "What happens to the seller when the buyer exercises.",
      body: [
        "Assignment is what happens to the SELLER of an option when the buyer exercises their right: a short call's seller must deliver 100 shares at the strike; a short put's seller must buy 100 shares at the strike.",
        "American-style equity options — every option this platform trades — can be assigned at any time before expiration, not only at expiration, and assignment risk rises sharply once a short strike moves in-the-money.",
      ],
      whyItMatters: "Every strategy in the Strategy Academy discloses its own assignment risk explicitly — understanding the mechanics here is what makes those disclosures meaningful rather than abstract.",
      relatedGlossaryKeys: ["assignment", "exercise", "in-the-money"],
      estimatedMinutes: 3,
    }),
  ],
};

const GREEKS_PATH: LearningPath = {
  key: "greeks",
  title: "Options Greeks",
  description: "The five sensitivities that describe exactly how an option's price will react to the world changing around it.",
  glossaryCategory: "greeks",
  topics: [
    topic({
      key: "greeks-delta",
      title: "Delta",
      summary: "Directional exposure and approximate probability, in one number.",
      body: [
        "Delta measures how much an option's price moves per $1 move in the underlying, and doubles as a close approximation of the probability that option finishes in the money.",
      ],
      whyItMatters: "This platform's own scanner selects short strikes primarily by delta — the full worked explanation, with live numbers, lives in the dedicated Delta Masterclass.",
      externalHref: "/learn/delta",
      relatedGlossaryKeys: ["delta", "gamma", "probability-of-profit"],
      estimatedMinutes: 8,
    }),
    topic({
      key: "greeks-gamma",
      title: "Gamma",
      summary: "How fast delta itself changes.",
      body: [
        "Gamma measures the rate of change of delta as the underlying moves — largest for at-the-money options close to expiration.",
        "Premium sellers are typically short gamma: as the underlying trends toward a short strike, delta turns against you and losses accelerate. Managing short gamma (sizing small, taking profits early) is central to surviving as a seller.",
      ],
      whyItMatters: "Gamma is the trade-off you accept for collecting theta — understanding it explains why a position that looked safe at entry can deteriorate quickly on a fast move.",
      externalHref: "/learn/greeks",
      relatedGlossaryKeys: ["gamma", "delta", "at-the-money"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "greeks-theta",
      title: "Theta",
      summary: "The seller's daily income from time decay.",
      body: [
        "Theta is the dollar amount an option's price erodes per calendar day, all else equal. For a buyer it's a cost; for a seller — this platform's own default posture — it's income.",
        "Decay accelerates as expiration approaches and is fastest for at-the-money options, which is why premium sellers often prefer to enter with more time remaining and exit before the final, steepest decay window.",
      ],
      whyItMatters: "Positive position theta is the structural reason premium selling can be profitable even when the underlying goes nowhere — time itself pays you.",
      externalHref: "/learn/greeks",
      relatedGlossaryKeys: ["theta", "theta-income", "premium"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "greeks-vega",
      title: "Vega",
      summary: "Sensitivity to implied volatility.",
      body: [
        "Vega measures how much an option's price moves per 1-percentage-point change in implied volatility, and is largest for at-the-money, longer-dated options.",
        "Premium sellers are usually short vega — they benefit when IV falls (especially the post-earnings IV crush), and a volatility spike is their main headwind.",
      ],
      whyItMatters: "Selling when IV rank is elevated (options are relatively 'expensive' for that stock right now) stacks the odds in a short-vega seller's favor.",
      externalHref: "/learn/greeks",
      relatedGlossaryKeys: ["vega", "implied-volatility", "iv-crush"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "greeks-rho",
      title: "Rho",
      summary: "The quiet fifth Greek.",
      body: [
        "Rho measures how much an option's price moves per 1-percentage-point change in interest rates. For the short-dated equity options this platform trades, rho's impact is usually small relative to delta, theta, gamma, and vega.",
        "It matters more for longer-dated options (LEAPS) and in higher-rate environments, but for a typical 30-60 day premium-selling structure it's rarely the deciding factor in a trade's risk profile.",
      ],
      whyItMatters: "Knowing rho exists — and knowing when it genuinely doesn't matter much — is part of understanding the full Greeks picture rather than only the four most commonly discussed.",
      relatedGlossaryKeys: ["rho", "delta", "theta"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "greeks-portfolio-greeks",
      title: "Portfolio Greeks",
      summary: "One position's Greeks tell you little; the portfolio's net Greeks tell you everything.",
      body: [
        "Portfolio Greeks are the sum of every open position's own Greeks — net delta, net theta, net gamma, net vega for the whole account, not any single trade in isolation.",
        "This platform's own Portfolio Dashboard and Greeks pages compute and display these net figures directly from your real open positions, reused unchanged by this Learning Centre's own Portfolio Learning Mode.",
      ],
      whyItMatters: "A portfolio can look balanced position-by-position and still carry a large, unintended net directional or volatility bet once every position is summed — Portfolio Greeks is the number that actually matters.",
      externalHref: "/portfolio",
      relatedGlossaryKeys: ["portfolio-greeks", "delta", "theta", "gamma", "vega"],
      estimatedMinutes: 4,
    }),
  ],
};

const VOLATILITY_PATH: LearningPath = {
  key: "volatility",
  title: "Volatility",
  description: "The single biggest input to every option's price — and the entire reason premium selling can be a systematic edge.",
  glossaryCategory: "volatility",
  topics: [
    topic({
      key: "volatility-iv",
      title: "Implied Volatility (IV)",
      summary: "The market's forward-looking estimate of movement, priced into every option.",
      body: [
        "Implied volatility is backed out of an option's own market price — it represents the market's collective forward-looking estimate of how much the underlying will move before expiration.",
        "Higher IV inflates premiums on both calls and puts equally; it tends to rise ahead of uncertain events (earnings, macro releases) and fall once the uncertainty resolves.",
      ],
      whyItMatters: "IV, not the stock price alone, is the primary driver of how much premium a seller can collect for a given strike and expiration.",
      relatedGlossaryKeys: ["implied-volatility", "vega", "iv-rank"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "volatility-hv",
      title: "Historical Volatility (HV)",
      summary: "What the stock has actually done, as opposed to what the market expects.",
      body: [
        "Historical (realized) volatility measures how much a stock has actually moved in the past, computed from its own price history — distinct from IV's forward-looking, market-implied estimate.",
        "Comparing IV to HV reveals whether options are currently pricing in more or less movement than the stock has recently delivered — a persistent gap in IV's favor (IV running above HV) is the structural edge behind systematic premium selling.",
      ],
      whyItMatters: "The volatility-risk-premium haircut this platform applies when computing Probability of Profit exists specifically because IV tends to systematically overstate realized (historical) volatility.",
      relatedGlossaryKeys: ["historical-volatility", "implied-volatility", "expected-move"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "volatility-iv-rank",
      title: "IV Rank",
      summary: "Is IV high or low for THIS stock, right now?",
      body: [
        "IV Rank places a stock's current implied volatility on a 0-100 scale relative to its own 52-week IV range — not relative to other stocks, and not relative to some fixed threshold.",
        "A high IV rank means options are relatively expensive for this particular stock right now, which is the classic setup premium sellers look for before selling — the same reason this platform's earnings-play logic requires an elevated IV rank before recommending a structure.",
      ],
      whyItMatters: "Two stocks can have identical raw IV numbers but very different IV ranks — rank, not raw IV, is the number that tells you whether NOW is a relatively rich or cheap time to sell premium on that specific name.",
      relatedGlossaryKeys: ["iv-rank", "implied-volatility", "iv-crush"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "volatility-expected-move",
      title: "Expected Move",
      summary: "The market-implied range a stock is likely to trade within.",
      body: [
        "Expected move is computed from implied volatility and time remaining (IV × √(days/365)) — a one-standard-deviation range, meaning roughly a 68% chance the stock stays inside it by that date.",
        "It is a probability-weighted range derived from real market pricing, never a directional prediction of where the stock will go.",
      ],
      whyItMatters: "Comparing a structure's own short strikes to the expected move is a quick sanity check on whether a position's breakevens sit comfortably outside the range the market itself expects, or uncomfortably close to it.",
      relatedGlossaryKeys: ["expected-move", "implied-volatility", "historical-volatility"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "volatility-earnings",
      title: "Earnings Volatility & IV Crush",
      summary: "Why options get expensive before earnings — and cheap right after.",
      body: [
        "Ahead of a known event like earnings, implied volatility rises to price in genuine uncertainty about the result — this is earnings volatility, and it inflates every option's premium on that name.",
        "Once the report is out and the uncertainty resolves, IV typically collapses sharply — the IV crush. This platform's own earnings-play logic identifies stocks with elevated IV rank inside a near-term earnings window and recommends a structure sized to harvest exactly that collapse.",
      ],
      whyItMatters: "IV crush is one of the most reliable, repeatable volatility patterns in options markets — understanding it is the foundation of any systematic earnings-premium-selling approach.",
      relatedGlossaryKeys: ["earnings-volatility", "iv-crush", "iv-rank", "expected-move"],
      estimatedMinutes: 5,
    }),
  ],
};

const STRATEGIES_PATH: LearningPath = {
  key: "strategies",
  title: "Options Strategies",
  description: "How individual option legs combine into defined, repeatable structures — full detail lives in the Strategy Academy.",
  glossaryCategory: "strategies",
  topics: [
    topic({
      key: "strategies-covered-calls",
      title: "Covered Calls",
      summary: "Own the stock, sell the upside for income.",
      body: ["Own 100 shares and sell a call against them for premium income, capping upside at the strike."],
      whyItMatters: "The classic first income strategy most traders learn — see the Strategy Academy for the full construction, Greeks profile, and common mistakes.",
      externalHref: "/learn/strategy-academy/covered_call",
      relatedGlossaryKeys: ["covered-call", "call", "wheel"],
      estimatedMinutes: 2,
    }),
    topic({
      key: "strategies-csp",
      title: "Cash Secured Puts",
      summary: "Get paid to name your own buy price.",
      body: ["Sell a put backed by cash to buy 100 shares at the strike; if assigned, you own the stock at a reduced effective cost basis."],
      whyItMatters: "The natural counterpart to a covered call, and the entry point into the Wheel strategy.",
      externalHref: "/learn/strategy-academy/cash_secured_put",
      relatedGlossaryKeys: ["cash-secured-put", "put", "wheel"],
      estimatedMinutes: 2,
    }),
    topic({
      key: "strategies-wheel",
      title: "The Wheel",
      summary: "Cycle between selling puts and selling calls on the same stock.",
      body: ["Sell CSPs until assigned shares, then sell covered calls on those shares until called away, then repeat — collecting premium at every stage."],
      whyItMatters: "A complete, repeatable income cycle combining both of the two prior topics into one systematic process.",
      externalHref: "/learn/strategy-academy/wheel",
      relatedGlossaryKeys: ["wheel", "covered-call", "cash-secured-put"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "strategies-verticals",
      title: "Vertical Spreads",
      summary: "The building block underneath every iron condor.",
      body: ["Buy and sell two options of the same type and expiration at different strikes, defining maximum profit and loss up front."],
      whyItMatters: "An iron condor is literally a put vertical plus a call vertical — understanding one half explains the whole structure.",
      externalHref: "/learn/strategy-academy/vertical_spread",
      relatedGlossaryKeys: ["vertical-spread", "iron-condor"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "strategies-iron-condor",
      title: "Iron Condors",
      summary: "This platform's own flagship structure.",
      body: ["A short put spread below the market plus a short call spread above it — defined risk, profits when the underlying stays inside the two short strikes."],
      whyItMatters: "The strategy this platform's scanner and execution engine build and price most extensively — the Strategy Academy's iron condor entry includes a real, live worked example.",
      externalHref: "/learn/strategy-academy/iron_condor",
      relatedGlossaryKeys: ["iron-condor", "vertical-spread", "delta"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "strategies-iron-butterfly",
      title: "Iron Butterflies",
      summary: "Maximum credit, minimum margin for error.",
      body: ["Like an iron condor, but both short strikes sit at-the-money — richer credit, narrower profit zone."],
      whyItMatters: "The opposite end of the delta spectrum from a 20-delta iron condor — useful for seeing how strike selection trades credit against probability.",
      externalHref: "/learn/strategy-academy/iron_fly",
      relatedGlossaryKeys: ["iron-butterfly", "iron-condor", "at-the-money"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "strategies-calendar",
      title: "Calendar Spreads",
      summary: "Profit from time decay differential, not direction.",
      body: ["Sell a near-dated option and buy a longer-dated option at the same strike, profiting as the front leg decays faster than the back leg."],
      whyItMatters: "A genuinely different risk profile from a condor or fly — long vega instead of short, and built by this platform's own engine for real.",
      externalHref: "/learn/strategy-academy/calendar_spread",
      relatedGlossaryKeys: ["calendar-spread", "theta", "diagonal-spread"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "strategies-diagonal",
      title: "Diagonal Spreads",
      summary: "A calendar spread with a directional lean.",
      body: ["Like a calendar spread, but the near- and far-dated legs use different strikes, adding a directional tilt to the time-decay edge."],
      whyItMatters: "Shows how the same core mechanic (a calendar) can be adapted for a directional view without abandoning defined risk.",
      externalHref: "/learn/strategy-academy/diagonal_spread",
      relatedGlossaryKeys: ["diagonal-spread", "calendar-spread"],
      estimatedMinutes: 3,
    }),
  ],
};

const PORTFOLIO_PATH: LearningPath = {
  key: "portfolio",
  title: "Portfolio",
  description: "Managing risk across the WHOLE account, not just one trade at a time — reuses this platform's own Portfolio Dashboard and overlays.",
  glossaryCategory: "portfolio",
  topics: [
    topic({
      key: "portfolio-position-sizing",
      title: "Position Sizing",
      summary: "How much to risk on any single trade.",
      body: ["Bound each trade's risk as a percentage of total account value so no single position — however attractive — can do outsized damage."],
      whyItMatters: "This platform's own Position Sizing & Portfolio Impact Calculator computes real current-vs-hypothetical exposure before you enter a trade — reused directly.",
      externalHref: "/position-sizing",
      relatedGlossaryKeys: ["position-sizing", "concentration", "buying-power"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "portfolio-health",
      title: "Portfolio Health",
      summary: "One blended score summarizing 8 real risk factors.",
      body: ["A deterministic 0-100 aggregation of Concentration, Diversification, Event Risk, Net Greeks, Directional Exposure, Position Sizing Quality, Position Count, and Expiration Distribution."],
      whyItMatters: "This is the exact score the Portfolio Dashboard and the Institutional Intelligence Engine both already compute — reused here, never a second, competing score.",
      externalHref: "/portfolio-dashboard",
      relatedGlossaryKeys: ["portfolio-health", "concentration", "diversification"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "portfolio-buying-power",
      title: "Buying Power",
      summary: "The capital actually available for new trades.",
      body: ["Selling defined-risk spreads ties up buying power equal to their maximum loss — the real, dynamic limit on how many new positions can be opened."],
      whyItMatters: "Running buying power to zero (or accepting excessive leverage) is one of this platform's own explicitly monitored risk-warning categories.",
      externalHref: "/portfolio-dashboard",
      relatedGlossaryKeys: ["buying-power", "position-sizing", "max-loss"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "portfolio-concentration",
      title: "Concentration",
      summary: "How much risk sits in one place.",
      body: ["Measured across symbol, sector, strategy, and expiration dimensions — high concentration means one adverse move can hit a large share of the account at once."],
      whyItMatters: "This platform's own Correlation & Concentration Risk Overlay computes a real Herfindahl-Hirschman-Index concentration score from your actual open positions.",
      externalHref: "/concentration-risk",
      relatedGlossaryKeys: ["concentration", "diversification", "correlation"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "portfolio-diversification",
      title: "Diversification",
      summary: "The inverse of concentration.",
      body: ["Spreading risk across enough distinct symbols, sectors, strategies, and expirations that no single event can materially damage the portfolio."],
      whyItMatters: "The Portfolio Health score's own 'Diversification' factor is derived directly from the same sector-level concentration figure computed by the Correlation & Concentration Overlay.",
      externalHref: "/concentration-risk",
      relatedGlossaryKeys: ["diversification", "concentration"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "portfolio-correlation",
      title: "Correlation",
      summary: "Positions that move together aren't really diversified.",
      body: ["Even different symbols can be highly correlated (e.g. several tech-sector iron condors) and provide little real diversification, since they tend to gain or lose together."],
      whyItMatters: "This platform's own Concentration overlay's clustering view illustrates categorical correlation risk directly from real sector/strategy groupings.",
      externalHref: "/concentration-risk",
      relatedGlossaryKeys: ["correlation", "diversification", "concentration"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "portfolio-stress-testing",
      title: "Stress Testing",
      summary: "What-if scenarios over your REAL positions.",
      body: ["Reprices every open position under a hypothetical price/IV/time shock to see how portfolio value and risk score would change — a simulation, never a forecast."],
      whyItMatters: "This platform's own Portfolio Stress Test & Scenario Simulator runs these shocks against your actual open trades, not a hypothetical portfolio.",
      externalHref: "/stress-test",
      relatedGlossaryKeys: ["stress-testing", "event-risk"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "portfolio-event-risk",
      title: "Event Risk",
      summary: "Known upcoming events that could move a position suddenly.",
      body: ["Earnings, economic releases, and dividend dates each carry the risk of an outsized move before you can react — this platform classifies each open position's own event-risk level."],
      whyItMatters: "This platform's own Earnings & Event Risk Portfolio Overlay computes a real risk level per position from known, upcoming event dates.",
      externalHref: "/event-risk",
      relatedGlossaryKeys: ["event-risk", "earnings-volatility"],
      estimatedMinutes: 4,
    }),
  ],
};

const PERFORMANCE_PATH: LearningPath = {
  key: "performance",
  title: "Performance",
  description: "Measuring whether a strategy actually works — beyond any single trade's own win or loss.",
  glossaryCategory: "performance",
  topics: [
    topic({
      key: "performance-win-rate",
      title: "Win Rate",
      summary: "The percentage of trades that were profitable.",
      body: ["A useful but incomplete metric on its own — a high win rate with rare, large losses can still be a net-losing strategy overall."],
      whyItMatters: "This platform's Trade Performance page computes a real win rate from your own closed-trade history — always read alongside Expectancy, never alone.",
      externalHref: "/trade-performance",
      relatedGlossaryKeys: ["win-rate", "expectancy", "probability-of-profit"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "performance-drawdown",
      title: "Drawdown",
      summary: "How far below the peak the account has fallen.",
      body: ["The decline from a portfolio's highest recorded value to a subsequent low, before a new high is made — a key measure of how much pain a strategy inflicts along the way."],
      whyItMatters: "A strategy with an attractive average return can still be unsurvivable in practice if its drawdowns are large enough to force an exit at the worst time.",
      relatedGlossaryKeys: ["drawdown", "win-rate", "expectancy"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "performance-theta-income",
      title: "Theta Income",
      summary: "Forward-looking projected time-decay income.",
      body: ["Sums the theta of every open position into a daily/weekly/monthly projection — the practical, forward-looking figure this platform's own Theta Income Engine already computes."],
      whyItMatters: "This platform's own Options Dashboard already displays this exact figure — reused directly, not recomputed here.",
      externalHref: "/options-dashboard",
      relatedGlossaryKeys: ["theta-income", "theta", "premium-collected"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "performance-premium-collected",
      title: "Premium Collected",
      summary: "Realized, backward-looking income from closed trades.",
      body: ["The total credit actually received from selling options — distinct from Theta Income's own forward-looking projection over currently open positions."],
      whyItMatters: "This platform's own Trade Performance page computes this real, realized figure from your actual closed-trade history.",
      externalHref: "/trade-performance",
      relatedGlossaryKeys: ["premium-collected", "premium", "theta-income"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "performance-return-on-capital",
      title: "Return on Capital",
      summary: "Profit relative to the capital actually at risk.",
      body: ["Expresses profit as a percentage of max loss (the capital put at risk), letting trades of very different sizes be compared on equal footing."],
      whyItMatters: "A $50 profit on $200 at risk (25% return on capital) is a very different result from a $50 profit on $2,000 at risk (2.5%) — raw dollars alone can mislead.",
      relatedGlossaryKeys: ["return-on-capital", "max-loss", "max-profit"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "performance-expectancy",
      title: "Expectancy",
      summary: "The number that actually tells you if a strategy works.",
      body: ["Expectancy = (win rate × average win) − (loss rate × average loss) — the average dollar result you'd expect per trade over a large sample.", "Positive expectancy is what makes a strategy sustainable over time, regardless of any single trade's own outcome."],
      whyItMatters: "This is the single most important performance metric — a strategy with positive expectancy is worth continuing even after a string of individual losses.",
      relatedGlossaryKeys: ["expectancy", "win-rate", "expected-value"],
      estimatedMinutes: 4,
    }),
  ],
};

const INSTITUTIONAL_PATH: LearningPath = {
  key: "institutional",
  title: "Institutional Thinking",
  description: "How professional risk managers actually think about a portfolio — process, not predictions.",
  glossaryCategory: "institutional",
  topics: [
    topic({
      key: "institutional-portfolio-construction",
      title: "Portfolio Construction",
      summary: "Deciding the whole portfolio, not one trade at a time.",
      body: [
        "Institutional risk managers build a portfolio deliberately, against an explicit risk budget, rather than accumulating positions one attractive-looking trade idea at a time with no view of the whole.",
        "That means asking not just 'is this trade good?' but 'does adding this trade make the PORTFOLIO better?' — a subtly different, and more disciplined, question.",
      ],
      whyItMatters: "A portfolio of individually-good trades can still be poorly constructed if they're all correlated, all expire the same week, or all lean the same direction.",
      relatedGlossaryKeys: ["portfolio-construction", "risk-contribution", "capital-allocation"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "institutional-risk-contribution",
      title: "Risk Contribution",
      summary: "A position's share of TOTAL portfolio risk, not just its own size.",
      body: [
        "Risk contribution asks how much of the portfolio's aggregate delta/theta/vega exposure and concentration a single position actually accounts for — which is not the same question as how much dollar capital it uses.",
        "A small position in a volatile, highly-correlated symbol can contribute disproportionate risk relative to its dollar size.",
      ],
      whyItMatters: "This is the institutional lens behind this platform's own Concentration overlay's 'largest risk contributor' figure — the position responsible for the largest share of total delta exposure, not necessarily the largest position by dollar size.",
      externalHref: "/concentration-risk",
      relatedGlossaryKeys: ["risk-contribution", "concentration", "portfolio-construction"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "institutional-capital-allocation",
      title: "Capital Allocation",
      summary: "How much capital to deploy at all — before any single trade.",
      body: [
        "Capital allocation is deciding how much of total available capital to put to work at all, and how to divide it across opportunities — a decision made independently of any single trade's own attractiveness.",
        "A trader can correctly identify a great trade and still make a mistake by allocating too much (or too little) capital to it relative to everything else in the portfolio.",
      ],
      whyItMatters: "Position Sizing answers 'how much for THIS trade'; Capital Allocation answers the broader question of how much total capital should be deployed versus held back at all.",
      relatedGlossaryKeys: ["capital-allocation", "position-sizing", "buying-power"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "institutional-position-management",
      title: "Position Management",
      summary: "A trade is a process from entry to exit, not a single decision.",
      body: [
        "Institutional discipline treats an open position as something to be actively monitored, adjusted, rolled, or closed as conditions change — not a decision made once at entry and forgotten until expiration.",
        "This platform's own Trade Adjustment & Roll/Convert Preview Simulator exists specifically to support this ongoing management discipline.",
      ],
      whyItMatters: "Most of the real risk in premium selling is managed AFTER entry, not at entry — position management is where that discipline actually happens.",
      externalHref: "/adjustment-preview",
      relatedGlossaryKeys: ["position-management", "risk-contribution", "decision-quality"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "institutional-decision-quality",
      title: "Decision Quality",
      summary: "Judge the process, not just the outcome.",
      body: [
        "A well-reasoned trade, sized correctly with a genuine edge, can still lose — a single bad outcome doesn't retroactively make the decision wrong. And a poorly-reasoned trade can still win by luck.",
        "Institutional risk managers evaluate decisions by the soundness of the process and the information available at the time, not by outcomes alone — outcomes are noisy over any single trial.",
      ],
      whyItMatters: "This is the mental discipline that prevents overreacting to a single loss (abandoning a genuinely good process) or overreacting to a single win (doubling down on a genuinely bad one).",
      relatedGlossaryKeys: ["decision-quality", "process-over-prediction", "position-management"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "institutional-process-over-prediction",
      title: "Process over Prediction",
      summary: "The core institutional mindset, stated plainly.",
      body: [
        "No one can reliably predict any single outcome — not the next earnings move, not next week's IV, not whether a specific short strike gets tested. What can be built is a repeatable, disciplined PROCESS: defined risk, sized positions, systematic entries and exits, real diversification.",
        "A good process doesn't guarantee any single trade works — it compounds favorably across many trials, which is exactly what Expectancy measures.",
      ],
      whyItMatters: "This is why this platform is built around deterministic, always-explainable calculations (POP, EV, Ravish Score, Portfolio Health) rather than predictive signals — process, applied consistently, is the actual edge.",
      relatedGlossaryKeys: ["process-over-prediction", "decision-quality", "expectancy"],
      estimatedMinutes: 4,
    }),
  ],
};

// Phase 21 — Institutional AI Coach & Education Platform. A ninth Learning
// Path, scoped to Engine 1 (the Institutional Investing Engine) — distinct
// from INSTITUTIONAL_PATH above, which is Engine 3's own options-portfolio
// thinking (risk contribution via delta/theta/vega, buying power, roll/
// convert). This path teaches the 9 named Engine-1 modules the Institutional
// AI Coach explains: Business Quality, Financial Strength, the Decision
// Engine, Portfolio Optimisation, the Research Terminal, the Investment
// Committee, Monitoring, Margin of Safety, and Opportunity Discovery. Every
// topic links to its own already-built page — no new page or calculation is
// implied by this content.
const INSTITUTIONAL_INVESTING_PATH: LearningPath = {
  key: "institutional-investing",
  title: "Institutional Investing Engine",
  description: "How to read the Institutional Investing Engine's own already-computed research, decision, and portfolio modules.",
  glossaryCategory: "value-investing",
  topics: [
    topic({
      key: "investing-business-quality",
      title: "Business Quality",
      summary: "Is this a good business, independent of price?",
      body: [
        "Business Quality scores a company on already-computed factors (growth, profitability, moat inputs) into one 0-100 score and a Wonderful/Good/Average/Weak rating — a read on the business itself, before valuation ever enters the picture.",
        "A high Business Quality score does not mean a stock is cheap — it means the underlying business is well-run. Valuation answers the separate question of whether the current price already reflects that.",
      ],
      whyItMatters: "Every other module downstream (the Decision Engine, Tom Nash's conviction score, the Investment Committee) uses Business Quality as one of its own inputs — understanding this score first makes every later module easier to read.",
      externalHref: "/research-terminal",
      relatedGlossaryKeys: ["business-quality-score", "economic-moat", "return-on-invested-capital"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "investing-financial-strength",
      title: "Financial Strength",
      summary: "Can the balance sheet survive a bad year?",
      body: [
        "Financial Strength rates leverage, interest coverage, liquidity, and free-cash-flow reliability into a Strong/Acceptable/Weak/Risky rating — a distress check, separate from growth or valuation.",
        "The Decision Engine treats a Risky or Weak Financial Strength rating as an override: a business with real balance-sheet distress can be recommended Sell/Avoid regardless of how attractive it looks on every other dimension.",
      ],
      whyItMatters: "Financial Strength is one of the few checks that can override every other positive signal — a cheap, high-quality-looking business is still a poor investment if it can't survive its own debt load.",
      externalHref: "/research-terminal",
      relatedGlossaryKeys: ["return-on-equity", "free-cash-flow", "book-value"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "investing-decision-engine",
      title: "The Decision Engine",
      summary: "One recommendation, synthesised from every already-computed signal.",
      body: [
        "The Decision Engine combines Business Quality, Valuation, the Investment Committee's verdict, and (when available) Management Quality into a single Buy/Accumulate/Hold/Reduce/Sell/Avoid recommendation with a confidence score and a full investment checklist.",
        "It never recomputes any of those underlying scores — it only synthesises and explains them, exactly like the Decision Coach does one level further.",
      ],
      whyItMatters: "The checklist and supporting/contradicting evidence exist so the recommendation is never a black box — every pass/warning/fail item traces back to a specific, already-computed number.",
      externalHref: "/decision-engine",
      relatedGlossaryKeys: ["institutional-decision-engine", "investment-checklist", "supporting-contradicting-evidence", "decision-confidence-score"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "investing-portfolio-optimisation",
      title: "Portfolio Optimisation",
      summary: "Upgrade, Trim, Exit, or Core — reading your own holdings against the Decision Engine.",
      body: [
        "Portfolio Optimisation classifies each holding in a portfolio into Upgrade/Trim/Exit/Core, built almost entirely from the Decision Engine's own recommendation for that symbol plus the portfolio's own concentration caps.",
        "Replacement Opportunities and Cash Deployment candidates are simply Buy-rated symbols not already held, already ranked by the Decision Engine's own synthesis score — never a separate ranking.",
      ],
      whyItMatters: "This module turns single-symbol research into portfolio-level action, without inventing a second scoring system on top of the Decision Engine's own recommendation.",
      externalHref: "/stock-analyst/portfolio-optimisation",
      relatedGlossaryKeys: ["portfolio-optimisation", "concentration", "portfolio-diversification-score"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "investing-research-terminal",
      title: "The Research Terminal",
      summary: "Search, Analyse, Compare, Review — all in one screen.",
      body: [
        "The Research Terminal unifies every Engine 1 module (Overview, Statements, Decision Engine, Investment Committee, Investment Memo, Portfolio Impact, Monitoring, Evidence, Notes) into one page with Analyse, Compare, and Split-screen modes.",
        "Every panel and comparison cell quotes an already-computed value — the Terminal itself computes nothing new, it only arranges existing outputs for a faster workflow.",
      ],
      whyItMatters: "A full review workflow (search → analyse → compare → review valuation → review decision → review portfolio impact → review monitoring → review committee → save notes) happens without ever leaving one page.",
      externalHref: "/research-terminal",
      relatedGlossaryKeys: ["research-terminal", "institutional-decision-engine"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "investing-investment-committee",
      title: "The Investment Committee",
      summary: "Three independent analysts, one consolidated verdict.",
      body: [
        "Graham, Buffett, and Tom Nash each cast an independent Buy/Hold/Wait vote from their own already-computed valuation model or conviction score — the Investment Committee aggregates those votes into one consolidated verdict, a confidence score, and an agreement signal (unanimous/majority/split/insufficient-data).",
        "When the committee is genuinely split, the consolidated verdict defaults to the safe, neutral Hold — never a forced coin-flip.",
      ],
      whyItMatters: "Seeing every individual vote, not just the outcome, shows exactly where the analysts agree or disagree — more informative than a single blended number.",
      externalHref: "/stock-analyst/investment-committee",
      relatedGlossaryKeys: ["investment-committee-workbench", "conviction-score", "decision-confidence-score"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "investing-monitoring",
      title: "Monitoring & Alerts",
      summary: "What already happened, not a live feed.",
      body: [
        "Monitoring alerts record a moment when an already-configured trigger (a price target, portfolio drift, or a watchlist/opportunity condition) was actually crossed — a historical fact, not a continuously-updating signal.",
        "Severity (low/medium/high) reflects how the triggering rule classified the condition at the time it fired.",
      ],
      whyItMatters: "The absence of an alert does not mean nothing is happening — it means no configured trigger has crossed its threshold yet. Monitoring complements periodic deep research, it doesn't replace it.",
      externalHref: "/monitoring-dashboard",
      relatedGlossaryKeys: ["monitoring-alert", "alert-severity", "portfolio-drift-alert"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "investing-margin-of-safety",
      title: "Margin of Safety",
      summary: "How much room for error is priced in?",
      body: [
        "Margin of safety is (fair value − price) / fair value across four independent, already-computed valuation models (Blended, Graham, DCF, Buffett) — a positive number means the model reads the stock as undervalued.",
        "The Consolidated Margin of Safety reports how many of the four models agree on direction (cheap/fair/expensive), not just an average number — model disagreement is itself useful information.",
      ],
      whyItMatters: "No single valuation model is precise — the discipline is in cross-checking several independent methods and weighing convergence, not trusting one number.",
      externalHref: "/research-terminal",
      relatedGlossaryKeys: ["margin-of-safety", "intrinsic-value", "discounted-cash-flow", "graham-number"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "investing-opportunity-discovery",
      title: "Opportunity Discovery",
      summary: "Screen, rank, and bucket the known universe — using the Decision Engine's own score.",
      body: [
        "Opportunity Discovery screens the platform's known symbol universe, ranks candidates by the Decision Engine's own already-computed synthesis score, and sorts them into named opportunity buckets — it never introduces a second, competing ranking.",
        "This is the same synthesis score Portfolio Optimisation's Replacement Opportunities and Cash Deployment candidates already reuse.",
      ],
      whyItMatters: "Screening and ranking stay consistent everywhere in the platform, because every module that ranks a symbol reuses the same Decision Engine score rather than recomputing its own.",
      externalHref: "/opportunity-discovery",
      relatedGlossaryKeys: ["opportunity-discovery-engine", "screener", "opportunity-ranking", "opportunity-buckets"],
      estimatedMinutes: 4,
    }),
  ],
};

// Phase 29 — Institutional Trading AI Coach & Education Platform. A tenth
// Learning Path, scoped to Engine 2 (the Institutional Trading Engine) —
// distinct from INSTITUTIONAL_INVESTING_PATH above (Engine 1). This path
// teaches the 8 named Engine-2 modules the Trading AI Coach explains:
// Market Structure, Liquidity, Sessions, Risk Management, Trade Planning,
// the Trading Journal, Scenario Comparison, and Psychology & Discipline.
// Every topic links to its own already-built page — no new page or
// calculation is implied by this content.
const TRADING_ENGINE_PATH: LearningPath = {
  key: "trading-engine",
  title: "Institutional Trading Engine",
  description: "How to read the Institutional Trading Engine's own already-computed structure, liquidity, session, risk, and planning modules.",
  glossaryCategory: "trading",
  topics: [
    topic({
      key: "trading-market-structure",
      title: "Market Structure",
      summary: "Trend classification from real swing highs and lows.",
      body: [
        "Market Structure detects swing highs/lows in real candle data and classifies the resulting trend as uptrend, downtrend, or range — higher highs + higher lows read uptrend, lower highs + lower lows read downtrend, anything else honestly reads range.",
        "Multi-Timeframe Confluence extends this across several timeframes (e.g. 15m, 1h, 1D) and reports what % of them agree on the same dominant trend — a split reading never guesses a winner.",
      ],
      whyItMatters: "Trend structure is the foundation every other Engine 2 module (Liquidity, Regime, Probability, Risk) is read alongside — understanding this first makes every later module easier to interpret.",
      externalHref: "/market-structure-workbench",
      relatedGlossaryKeys: ["market-structure", "support-resistance-zone", "multi-timeframe-confluence"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "trading-liquidity",
      title: "Liquidity",
      summary: "Volume profile, liquidity band, and buy/sell pressure.",
      body: [
        "The Liquidity Engine buckets real candle volume into price levels (a volume profile), scores an average-dollar-volume-based liquidity band (High/Moderate/Low), and derives a buy/sell pressure proxy directly from each candle's own already-recorded up/down close.",
        "None of these are directional signals — they describe recent trading activity, not a forecast of future price movement.",
      ],
      whyItMatters: "Liquidity context helps judge how much size a market can absorb and how reliable a given trend or level reading is likely to be.",
      externalHref: "/liquidity-workbench",
      relatedGlossaryKeys: ["liquidity-band", "volume-profile", "buy-sell-pressure"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "trading-sessions",
      title: "Sessions",
      summary: "Fixed reference windows, not a live feed.",
      body: [
        "Sessions are fixed, named UTC time windows (Sydney, Tokyo, London, New York) — reference data, not a live feed. 'Active' simply means the current time falls inside that window's own start/end UTC hours.",
        "An overlap (e.g. London + New York) is two windows both being open at once, by the calendar — not itself a signal, though it's often when the most global participants are active.",
      ],
      whyItMatters: "Session awareness helps with execution timing, distinct from and complementary to the Liquidity Coach's own volume-based read.",
      externalHref: "/liquidity-workbench",
      relatedGlossaryKeys: ["trading-session", "session-overlap"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "trading-risk-management",
      title: "Risk Management",
      summary: "Position sizing, stop/target discipline, and portfolio risk budget.",
      body: [
        "The Risk Management Engine scores three components — Position Sizing (largest single position's dollar risk vs. a named cap), Stop/Target Discipline (what fraction of open positions have both defined), and Portfolio Risk Budget (aggregate dollar risk vs. a named cap) — with a hard-cap override if either dollar-risk cap is breached.",
        "Position size and risk/reward ratio are pure arithmetic over your own entered numbers — never a judgment on whether those specific levels are good.",
      ],
      whyItMatters: "A hard-cap override means a single mis-sized position or an over-committed portfolio can never be silently masked by an otherwise-good-looking blended score.",
      externalHref: "/trade-planning-studio",
      relatedGlossaryKeys: ["trading-position-sizing", "risk-reward-ratio", "trading-capital-allocation", "portfolio-risk-budget"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "trading-trade-planning",
      title: "Trade Planning & Scenario Comparison",
      summary: "A documented plan before a trade is opened — and comparing candidates before committing.",
      body: [
        "A Trade Plan is a human's own stated pre-trade intent — direction, entry, stop, target, account risk %, and thesis — saved before a position is opened, distinct from an already-open position and never machine-generated.",
        "Scenario Comparison lets you compare 2-5 candidate entry/stop/target combinations side by side before committing to one as a real, persisted Trade Plan — 'Best R:R' and 'Tightest Risk' are honest max/min identifications, never a recommendation.",
      ],
      whyItMatters: "Documenting a plan — and comparing alternatives — before capital moves is a baseline institutional discipline, separate from any judgment about which direction is correct.",
      externalHref: "/trade-planning-studio",
      relatedGlossaryKeys: ["trade-plan", "scenario-comparison", "risk-reward-ratio"],
      estimatedMinutes: 5,
    }),
    topic({
      key: "trading-journal-review",
      title: "The Trading Journal",
      summary: "Recording your own trades — mood, lessons, and outcomes.",
      body: [
        "The Trading Journal records a user's own reflections on their trades — title, content, mood, tags, lesson learned, setup type, and (optionally) an R-multiple.",
        "The Journal Coach tallies these already-recorded fields (how many entries include a lesson learned, the most common recorded mood) — never a new interpretation of them.",
      ],
      whyItMatters: "Consistent journaling, reviewed with the same discipline for wins and losses, is what makes post-trade review actionable rather than a vague memory.",
      externalHref: "/trading-journal",
      relatedGlossaryKeys: ["trading-journal", "r-multiple"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "trading-psychology-discipline",
      title: "Psychology & Discipline",
      summary: "Discipline measured as documentation consistency — never a fabricated score.",
      body: [
        "The Psychology & Discipline Coach reports discipline purely as documentation consistency: what % of your journal entries record a lesson learned, and how many entries recorded a win (R-multiple > 0) versus a loss (R-multiple < 0) — literal tallies over your own already-recorded fields.",
        "This coach never invents a psychological diagnosis or a discipline score from anything beyond what you've already written down.",
      ],
      whyItMatters: "Measuring documentation completeness (a fixable habit) rather than attempting a subjective psychological read keeps this coach honest and evidence-based.",
      externalHref: "/trading-journal",
      relatedGlossaryKeys: ["trading-journal", "r-multiple"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "trading-ai-coach-overview",
      title: "The Trading AI Coach",
      summary: "8 deterministic coaches, one Evidence Explorer.",
      body: [
        "The Trading AI Coach explains Structure, Liquidity, Session, Risk, Trade Plan, Journal, Scenario, and Psychology & Discipline readings — every explanation quotes an already-computed engine output or an already-recorded journal fact, never a new signal, prediction, or recommendation.",
        "The Evidence Explorer shows exactly which metrics and supporting evidence produced each reading, so no explanation is ever a black box.",
      ],
      whyItMatters: "Seeing the evidence behind every explanation, not just the headline, is what separates a coach from a black-box signal generator.",
      externalHref: "/trading-ai-coach",
      relatedGlossaryKeys: ["market-structure", "trade-plan"],
      estimatedMinutes: 4,
    }),
  ],
};

// Phase 30 — Institutional Strategy Framework. Teaches the FRAMEWORK
// itself — how to register a strategy's own metadata, use the Checklist
// Engine, and cite existing evidence — never a real trading methodology's
// own rules (no ICT/SMC/ASAD/Trader Bill/Tom Nash/Dunni Framework content
// anywhere in this path).
const STRATEGY_FRAMEWORK_PATH: LearningPath = {
  key: "strategy-framework",
  title: "Institutional Strategy Framework",
  description: "How to register your own trading methodology's metadata and checklist — the platform never implements or evaluates the methodology itself.",
  glossaryCategory: "trading",
  topics: [
    topic({
      key: "strategy-framework-overview",
      title: "What Is a Strategy?",
      summary: "Metadata only — never a rule engine.",
      body: [
        "In this platform, a 'Strategy' is a METADATA record you author yourself: a name, description, category, the timeframes and markets it applies to, which existing engine outputs you consider relevant evidence, a checklist, educational notes, references, and a version number.",
        "The platform never implements, evaluates, or judges the methodology you name — it only stores the shape you give it and helps you apply it consistently.",
      ],
      whyItMatters: "Formalizing your own rules as structured, versioned metadata — rather than relying on memory — is a basic institutional discipline, independent of what those rules actually say.",
      externalHref: "/strategy-framework",
      relatedGlossaryKeys: ["trading-strategy-framework"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "strategy-framework-categories-evidence",
      title: "Categories and Evidence",
      summary: "Generic structural labels and citation sources, not judgments.",
      body: [
        "Categories (Trend, Reversal, Breakout, Range, Scalping, Swing, Position, Other) are generic, structural labels — never a named real-world methodology.",
        "Required Evidence lists which existing engine outputs (Market Structure, Liquidity, Sessions, Risk, Trade Plans, Journal, AI Coach) your own strategy's author decided are relevant — the platform never verifies that decision, only surfaces it.",
      ],
      whyItMatters: "Naming your own evidence sources up front makes it easy to check you actually reviewed them before a real trade, not after.",
      externalHref: "/strategy-framework",
      relatedGlossaryKeys: ["strategy-evidence-link"],
      estimatedMinutes: 3,
    }),
    topic({
      key: "strategy-framework-checklist-engine",
      title: "The Checklist Engine",
      summary: "Required items, optional items, notes, and evidence links.",
      body: [
        "A strategy's own checklist TEMPLATE (defined once, as part of its metadata) is instantiated fresh into a real Checklist instance every time you apply it — completion state, per-item notes, and evidence links all start empty and are filled in by you.",
        "A checklist reads 'complete' only once every REQUIRED item is marked done — optional items never block completion, and an empty checklist is never fabricated as complete.",
      ],
      whyItMatters: "A consistent, evidence-linked checklist turns a personal methodology into something reviewable after the fact, the same way a pre-flight checklist works regardless of the aircraft.",
      externalHref: "/strategy-framework",
      relatedGlossaryKeys: ["strategy-checklist"],
      estimatedMinutes: 4,
    }),
    topic({
      key: "strategy-framework-coach",
      title: "The Strategy Coach",
      summary: "Explains your own registered strategy and checklist state.",
      body: [
        "The Strategy Coach explains your own strategy's metadata and, if one exists, a checklist instance's completion state — every figure is a direct quote of what you authored or what computeChecklistCompletion() reports, never a new judgment on whether the strategy itself is sound.",
        "100% checklist completion means the checklist was filled out, not that any underlying market condition is favorable — the Coach is explicit about this distinction.",
      ],
      whyItMatters: "Keeping the Coach limited to explaining your own data, never evaluating your methodology, is what keeps the Strategy Framework a framework rather than a signal generator.",
      externalHref: "/trading-ai-coach",
      relatedGlossaryKeys: ["trading-strategy-framework", "strategy-checklist"],
      estimatedMinutes: 3,
    }),
  ],
};

// v1.4.0, Sprint L1 — Learning Centre Foundation. The first of the 5
// curriculum categories named in the approved Learning Content Master
// Plan ("Platform Basics") — how to use the software itself, never an
// investing/trading concept. Exactly the 3 foundation lessons approved
// for this sprint (Platform Basics & Navigation, Command Centre, Learning
// Centre Overview); every other module's own lesson content is deferred
// to a later, separately-approved sprint per the Master Plan's own
// phasing. These 3 topics are the first to populate the new optional,
// richer LearningTopic fields (difficulty/workflowSteps/etc.) — the
// template every future lesson follows.
const PLATFORM_BASICS_PATH: LearningPath = {
  key: "platform-basics",
  title: "Platform Basics",
  description: "How to navigate and use the software itself — sidebar, search, dashboards, and settings. No investing or trading concepts live here.",
  glossaryCategory: "platform",
  topics: [
    topic({
      key: "platform-basics-navigation",
      title: "Platform Basics & Navigation",
      summary: "The sidebar, the Command Palette, and what a session/tenant is.",
      body: [
        "The sidebar groups every page in the platform into named, collapsible sections; a small 'Frequently Used' strip at the top lets you pin any page you visit often. Pinned items and collapse state are saved per-user.",
        "The Command Palette (⌘K / Ctrl+K) is the platform's single global search — it finds pages, open positions, watchlist entries, portfolios, lessons, strategies, and glossary terms all in one place, without needing a separate search per page.",
        "Every page you visit belongs to your own session and tenant — your data is never visible to another user, and the automation engines have a master kill switch in Settings you can flip off at any time as the fastest available safety action.",
      ],
      whyItMatters: "Knowing where things live and how to search for them is the prerequisite for everything else in the curriculum — every later lesson assumes you can navigate the platform confidently.",
      difficulty: "beginner",
      whyItExists: "A platform with 80+ distinct pages across three engines needs a genuinely fast way to find anything — the sidebar and Command Palette are that answer, built once and reused everywhere rather than each page inventing its own navigation.",
      institutionalThinking: "Institutional users expect a single, fast way to reach any tool without memorizing a menu tree — this is the same expectation a Bloomberg Terminal or an internal ops console sets.",
      workflowSteps: [
        "Open the sidebar and pin one page you expect to visit often.",
        "Open the Command Palette (⌘K / Ctrl+K) and search for a symbol or page by name.",
        "Open the Notification Centre (the bell icon) to see what it aggregates.",
        "Open Settings and locate the automation kill switch — you don't need to flip it, just find it.",
      ],
      commonMistakes: [
        "Not realizing pinned items and the Command Palette are two different, complementary ways to reach the same pages.",
        "Missing the Notification Centre entirely because it isn't in the main sidebar list.",
      ],
      bestPractices: [
        "Pin the 3-5 pages you use daily rather than scrolling the full sidebar every time.",
        "Use the Command Palette for anything you don't have pinned — it's almost always faster than clicking through groups.",
      ],
      relatedModuleHrefs: ["/command-center", "/settings", "/notifications"],
      aiCoachPrompts: ["Where do I find my settings?", "What does the kill switch do?"],
      relatedGlossaryKeys: ["session", "tenant", "kill-switch", "guardrail", "command-palette"],
      nextStepKeys: ["command-centre-overview"],
      guidedTourRequired: true,
      estimatedMinutes: 5,
    }),
    topic({
      key: "command-centre-overview",
      title: "Command Centre",
      summary: "One executive screen aggregating every engine's own dashboards.",
      body: [
        "Command Centre pulls together summary cards from every major module across all three engines into one screen — it computes nothing new itself, it only re-displays whatever each source module has already computed.",
        "Every card is a jumping-off point: click through to reach that module's own full detail page rather than trying to do everything from Command Centre itself.",
      ],
      whyItMatters: "A single at-a-glance screen saves you from visiting a dozen pages just to get oriented at the start of a session.",
      difficulty: "beginner",
      whyItExists: "As the platform grew to dozens of modules across three engines, no single existing dashboard could show all of them at once — Command Centre is a pure composition layer solving exactly that, reusing every source module's own already-computed output.",
      institutionalThinking: "A trading desk's own morning read is usually one consolidated screen, not a dozen separate systems — Command Centre mirrors that expectation.",
      workflowSteps: [
        "Open Command Centre from the sidebar's Home group.",
        "Scan each section top to bottom.",
        "Click into any card whose figure you want to investigate further.",
      ],
      commonMistakes: ["Treating Command Centre as a place to take action, rather than a jumping-off point to the module that actually owns that action."],
      bestPractices: ["Use it as your first screen of the day, then drill into whichever section looks like it needs attention."],
      relatedModuleHrefs: ["/", "/executive-intelligence", "/institutional-dashboard"],
      aiCoachPrompts: ["What does this Command Centre section show me?"],
      relatedGlossaryKeys: [],
      nextStepKeys: ["learning-centre-overview"],
      guidedTourRequired: false,
      externalHref: "/command-center",
      estimatedMinutes: 4,
    }),
    topic({
      key: "learning-centre-overview",
      title: "Learning Centre Overview",
      summary: "How lessons, glossary, quizzes, progress, and bookmarks fit together.",
      body: [
        "The Learning Centre (/learn) is one hub for every piece of educational content on the platform: structured Learning Paths (like this one), a searchable Glossary, the Strategy Academy, quizzes, deterministic interactive simulations, and your own progress and bookmarks.",
        "Every lesson can be bookmarked for later and marked complete as you go — your progress is saved per-user and shows up on the Explore tab's Continue Learning and Recently Viewed sections.",
        "Nothing in the Learning Centre is an LLM-generated claim about real market conditions — every lesson is deterministic, version-controlled content, and every 'Ask AI Coach' answer is grounded in your own already-computed platform data, never a fabricated fact.",
      ],
      whyItMatters: "Understanding the Learning Centre's own shape — paths, glossary, progress, bookmarks — makes every future lesson in this curriculum easier to navigate.",
      difficulty: "beginner",
      whyItExists: "A platform this deep needs a genuine teaching layer, not just tooltips — the Learning Centre is that layer, built once and extended path-by-path rather than each module inventing its own separate help system.",
      institutionalThinking: "Institutional onboarding usually separates 'how to use the tool' from 'how to think about the domain' — Platform Basics and this lesson cover the former; every other Learning Path covers the latter.",
      workflowSteps: [
        "Open the Learning Centre from the sidebar's Learning Centre group.",
        "Open the Explore tab and look at Continue Learning and Recently Viewed.",
        "Bookmark this lesson using the bookmark button.",
        "Mark this lesson complete once you've read it.",
      ],
      commonMistakes: ["Assuming the Learning Centre only covers options trading — it now spans all three engines plus platform basics."],
      bestPractices: ["Bookmark lessons you want to revisit rather than trying to remember where they were."],
      relatedModuleHrefs: ["/learn/paths", "/learn/glossary"],
      aiCoachPrompts: ["What can I learn about here?", "How do bookmarks work?"],
      relatedGlossaryKeys: ["simulated-vs-live"],
      nextStepKeys: [],
      guidedTourRequired: false,
      externalHref: "/learn",
      estimatedMinutes: 4,
    }),
  ],
};

export const LEARNING_PATHS: LearningPath[] = [
  FOUNDATIONS_PATH,
  GREEKS_PATH,
  VOLATILITY_PATH,
  STRATEGIES_PATH,
  PORTFOLIO_PATH,
  PERFORMANCE_PATH,
  INSTITUTIONAL_PATH,
  INSTITUTIONAL_INVESTING_PATH,
  TRADING_ENGINE_PATH,
  STRATEGY_FRAMEWORK_PATH,
  PLATFORM_BASICS_PATH,
];

export function getLearningPath(key: string): LearningPath | null {
  return LEARNING_PATHS.find((p) => p.key === key) ?? null;
}

export function getLearningTopic(pathKey: string, topicKey: string): LearningTopic | null {
  const path = getLearningPath(pathKey);
  if (!path) return null;
  return path.topics.find((t) => t.key === topicKey) ?? null;
}

export function allLearningTopics(): { pathKey: string; topic: LearningTopic }[] {
  return LEARNING_PATHS.flatMap((p) => p.topics.map((topic) => ({ pathKey: p.key, topic })));
}
