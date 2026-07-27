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

// v1.4.0, Sprint L2B — Knowledge Checks. Deliberately the same shape as
// coach.ts's own LearnQuizQuestion (prompt/options/correctIndex/
// explanation) — no new quiz engine, this reuses the exact rendering
// pattern the pre-existing DeltaMasterclass lesson already established
// (extracted this sprint into the shared components/learn/QuizCard.tsx) —
// but declared as its own type in this file's own domain, matching the
// precedent LearningTopicWorkedExample/LearningTopicMetricExplained
// already set of never cross-importing a type between the two,
// deliberately independent content systems (coach.ts's LearnContent
// lessons vs. this file's LearningPath/LearningTopic lessons).
export interface LearningTopicQuizQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LearningTopicWorkedExample {
  title: string;
  steps: string[];
  note?: string;
  // v1.4.0, Sprint L2A — Interactive Module Guides. An optional tier label
  // (e.g. "Good Opportunity" / "Average Opportunity" / "Poor Opportunity")
  // for the plural `workedExamples` field below, letting one lesson show
  // several worked examples along a quality spectrum instead of just one.
  // Never set on the older, singular `workedExample` field's own existing
  // usages — this is purely additive.
  label?: string;
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
  // v1.4.0, Sprint L2A — Interactive Module Guides. A plural companion to
  // the singular `workedExample` above (left untouched, still supported),
  // for lessons that show several worked examples along a quality
  // spectrum (e.g. Good/Average/Poor Opportunity) rather than just one.
  workedExamples?: LearningTopicWorkedExample[];
  commonMistakes?: string[];
  riskWarnings?: string[];
  bestPractices?: string[];
  relatedModuleHrefs?: string[];
  aiCoachPrompts?: string[];
  nextStepKeys?: string[];
  guidedTourRequired?: boolean;
  // v1.4.0, Sprint L2B — Interactive Module Guides (Cross-Engine &
  // Portfolio Hubs). A lightweight, lesson-level Knowledge Check —
  // 5-10 multiple-choice questions rendered via the shared, extracted
  // QuizCard component (instant feedback + explanation per question).
  // Optional and additive; every pre-Sprint-L2B topic simply omits it.
  knowledgeCheck?: LearningTopicQuizQuestion[];
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
      summary: "Search, Analyse, Compare, Review — the Institutional Investing Engine's own module guide, upgraded to full depth in Sprint L2A.",
      body: [
        "The Research Terminal (/research-terminal) unifies every Engine 1 module — Overview, Statements, Decision Engine, Investment Committee, Investment Memo, Portfolio Impact, Monitoring, Evidence, and Notes — into one page with three modes: Analyse (one symbol), Compare (2+ symbols side by side), and Split-screen (two independent panels at once).",
        "Every panel and comparison cell quotes an already-computed value — the Terminal itself creates ZERO new valuation models and duplicates NO existing scoring logic; it only arranges existing outputs for a faster review workflow.",
        "Who should use it, and when: any time you need to seriously evaluate a company, decide between two candidates, or review holdings you already own — it's the single screen a professional analyst would open first, rather than jumping between nine separate pages.",
      ],
      whyItMatters: "A full review workflow — search → analyse → compare → review valuation → review decision → review committee → review portfolio impact → save notes — happens without ever leaving one page, and every figure you see always matches its own source module exactly.",
      difficulty: "beginner",
      whyItExists: "Nine already-built Engine 1 modules each answered one question well but required nine separate page visits to review a single company end-to-end — the Research Terminal is a pure integration layer solving exactly that, reusing every existing hook/component byte-for-byte rather than re-implementing any of them.",
      institutionalThinking: "A professional analyst never trusts a single headline number — they cross-check whether Graham, Buffett, and Tom Nash actually agree (the Investment Committee's own agreement signal), read the Evidence tab's supporting AND contradicting facts, and only then form a view. A common retail mistake is reading only the Decision Engine's headline recommendation and skipping Evidence entirely — or treating a 'majority' committee agreement as equivalent to a genuinely 'unanimous' one, when the two mean very different things.",
      screenWalkthrough: [
        "Company Search — type a ticker and press Enter or Add; press \"/\" anywhere on the page to jump straight to the search box.",
        "Mode toggle (keyboard shortcuts 1/2/3) — Analyse for one symbol's full deep-dive, Compare for a side-by-side table across every open symbol, Split for two fully independent panels rendered at once.",
        "Portfolio context dropdown — optionally select one of your own portfolios to unlock the Portfolio Impact tab's real current-weight and sector-exposure figures for that portfolio.",
        "Overview tab — the full research report: Business Quality, Competitive Advantage, Historical Trends, and every named valuation model.",
        "Statements tab — a compact Revenue / Gross Profit / Operating Income / Net Income table across the same already-fetched years — no new math, just a tighter view.",
        "Decision Engine tab — the single synthesized Buy / Accumulate / Hold / Reduce / Sell / Avoid recommendation, with its own confidence score.",
        "Investment Committee tab — Graham, Buffett, and Tom Nash's consolidated verdict, confidence score, and agreement signal (unanimous / majority / split / insufficient-data).",
        "Investment Memo tab — a full written memo: recommendation, confidence, an overview paragraph, and section-by-section supporting reasoning.",
        "Portfolio Impact tab — whether you already hold the symbol, at what current weight, and its sector exposure — only populated once a portfolio is selected in the toolbar above.",
        "Monitoring tab — any already-fired monitoring alerts for this specific symbol, or an honest 'No monitoring alerts' message.",
        "Evidence tab — Supporting Evidence and Contradicting Evidence side by side, plus the full pass/warning/fail investment checklist behind the Decision Engine's own recommendation. Never take the headline verdict at face value without reading this tab.",
        "Notes tab — your own saved research notes for this symbol, so a review is written down rather than left to memory.",
        "Compare mode's table — 12 ranked dimensions (Decision Engine Synthesis Score, Decision, Business Quality, Investment Quality, Margin of Safety, Investment Committee, Tom Nash Conviction, Revenue Growth 5y, ROIC, ROE, Debt/Equity, Dividend Yield), with a ★ marking whichever symbol reads best on each individual row.",
      ],
      workflowSteps: [
        "Search a company symbol (or press \"/\" to jump to the box).",
        "Select a portfolio in the context dropdown if you want real Portfolio Impact figures.",
        "Read the Overview tab first for business quality and valuation.",
        "Open the Decision Engine tab for the synthesized recommendation.",
        "Open the Investment Committee tab to see whether Graham, Buffett, and Tom Nash actually agree — not just what the consolidated verdict says.",
        "Open Evidence and read both Supporting and Contradicting Evidence, plus the checklist, before trusting the headline recommendation.",
        "Add a second symbol and switch to Compare mode to see how they stack up on the same 12 dimensions.",
        "Switch to Split mode to review two symbols' full detail side by side instead of one at a time.",
        "Save a layout (symbols + mode + portfolio) if you expect to return to this exact review later — Saved Layouts live only in your own browser (localStorage), not the database.",
        "Record a note in the Notes tab before moving on — a review that isn't written down is easy to forget by the next session.",
      ],
      metricsExplained: [
        { term: "Decision Engine Synthesis Score", explanation: "The single ranking score every other module that ranks a symbol (Opportunity Discovery, Portfolio Optimisation's Replacement Opportunities) also reuses — never a second, competing score." },
        { term: "Margin of Safety", explanation: "(fair value − price) / fair value across four independent valuation models (Blended, Graham, DCF, Buffett) — a positive number reads the stock as undervalued by that model." },
        { term: "Investment Committee Agreement", explanation: "unanimous / majority / split / insufficient-data — how many of the three independent analysts (Graham, Buffett, Tom Nash) actually agree on their own Buy/Hold/Wait vote. A split committee defaults to a safe, neutral Hold, never a forced coin-flip." },
        { term: "Tom Nash Conviction Score", explanation: "A single 0-100 conviction reading blending business quality, growth, capital allocation, financial strength, and valuation — one of the three votes the Investment Committee consolidates." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Strong, well-agreed conviction",
          steps: [
            "Investment Committee tab shows a 'Buy' consolidated verdict, confidence around 82/100, and 'unanimous' agreement — all three analysts independently reached the same conclusion.",
            "Margin of Safety reads meaningfully positive (the stock trades well below its computed fair value across most of the four models).",
            "Evidence tab shows mostly Supporting Evidence, with few or no Contradicting items, and the checklist is mostly 'pass.'",
          ],
          note: "This is the profile worth a closer Investment Memo read and a genuine portfolio-impact check — not a guarantee of a good outcome, only a well-evidenced, well-agreed one.",
        },
        {
          label: "Average Opportunity",
          title: "Mixed signals, genuinely uncertain",
          steps: [
            "Investment Committee tab shows a 'Hold' verdict, confidence around 55/100, and 'majority' agreement — two of the three analysts agree, one doesn't.",
            "Margin of Safety reads close to zero across the models — roughly fair value, not clearly cheap or expensive.",
            "Evidence tab shows a roughly even mix of Supporting and Contradicting items.",
          ],
          note: "'Majority' is a genuinely weaker signal than 'unanimous' — reading which specific analyst dissents (and why, via Evidence) matters more here than the headline verdict alone.",
        },
        {
          label: "Poor Opportunity",
          title: "Split committee, negative margin of safety",
          steps: [
            "Investment Committee tab shows a 'Wait' or 'Sell' verdict, confidence around 40/100, and 'split' agreement — the three analysts genuinely disagree.",
            "Margin of Safety reads negative across most models (the stock trades above its computed fair value).",
            "Evidence tab shows more Contradicting Evidence than Supporting, and Financial Strength (visible on the Overview tab) may be flagged 'Risky' — a rating that can override every other positive signal on its own.",
          ],
          note: "A split committee combined with a negative margin of safety is exactly the profile the Decision Engine's own checklist is designed to catch before it ever reaches a Buy recommendation.",
        },
      ],
      commonMistakes: [
        "Reading only the headline Decision Engine score and skipping the Evidence tab entirely.",
        "Treating a 'majority' committee agreement as equivalent to a 'unanimous' one — they represent genuinely different levels of consensus.",
        "Forgetting to select a portfolio in the toolbar, so the Portfolio Impact tab silently shows nothing to compare against.",
        "Using Compare mode's ★ star as a buy signal — it only means 'ranks highest among the symbols you added, on that one dimension.'",
      ],
      riskWarnings: [
        "Every score here is deterministic and reused, not a live market prediction — the Research Terminal never tells you what a stock will do next, only what its own already-computed research says today.",
        "A Buy verdict with low confidence or split agreement is a genuinely different situation from a Buy verdict with unanimous, high-confidence agreement — never treat the two the same just because the headline word is identical.",
      ],
      bestPractices: [
        "Always open Evidence before acting on a headline recommendation.",
        "Use Compare mode before choosing between two similar-looking candidates, rather than analysing them one at a time from memory.",
        "Save a layout for any symbol set you review on a recurring cadence.",
      ],
      relatedModuleHrefs: ["/research-terminal", "/opportunity-discovery", "/stock-analyst/investment-committee", "/learn/paths/platform-basics", "/learn/paths/trading-engine"],
      aiCoachPrompts: [
        "Explain this Decision Engine recommendation.",
        "Why did the Investment Committee split on this symbol?",
        "What does a Margin of Safety of 15% actually mean?",
        "What mistakes should I avoid when comparing two companies?",
      ],
      relatedGlossaryKeys: ["research-terminal", "institutional-decision-engine", "margin-of-safety", "investment-committee-workbench", "conviction-score"],
      nextStepKeys: ["investing-research-workflow"],
      guidedTourRequired: false,
      externalHref: "/research-terminal",
      estimatedMinutes: 9,
    }),
    topic({
      key: "investing-research-workflow",
      title: "Research Workflow: Calendar, AI Summaries & Daily Preparation",
      summary: "What's real beyond the Terminal's own 9 tabs — an honest look, including what doesn't exist.",
      body: [
        "This lesson picks up where the Research Terminal lesson leaves off — it does NOT re-explain the Terminal's own 9 tabs (Overview, Statements, Decision Engine, Investment Committee, Investment Memo, Portfolio Impact, Monitoring, Evidence, Notes); see that lesson first if you haven't. Instead, this covers what's genuinely real OUTSIDE the Terminal that a research workflow actually uses, plus one honest disclosure about something that isn't real at all.",
        "Honest disclosure: there is no news feed anywhere in this platform — not a tab, not a page, not even a simulated one. A single unused label exists in one internal type definition, but no code anywhere ever produces a news item, and no screen ever displays one. If you're looking for headlines or article summaries, that feature simply does not exist here.",
        "There IS a real Economic Calendar — but it lives on its own separate page (/events, labeled 'Economic Calendar' in its own heading and 'Event Calendar' in the sidebar), not as a tab inside the Research Terminal. It is a deterministic, SIMULATED calendar (formula-generated dates, not a live economic-data feed) covering Fed/FOMC decisions, CPI, jobs reports, PCE/retail sales, plus per-symbol earnings and ex-dividend dates.",
        "There ARE real AI-narrated summaries in this platform, but the Research Terminal's own Overview tab deliberately suppresses the AI Research Thesis narration in favor of a static disclaimer directing you to the full Stock Research page instead — the Terminal does still inherit a live 'Ask the AI Investment Analyst' question box from the same shared report component, so a genuine AI answer to your own typed question does work inside the Terminal, even though the auto-generated thesis narration doesn't.",
      ],
      whyItMatters: "Knowing precisely which real features exist, and where, prevents two opposite mistakes: assuming a feature is missing when it's actually one page over, and assuming a feature exists (like a news feed) when it was never built at all.",
      difficulty: "beginner",
      whyItExists: "The Economic Calendar, the AI narration entry points, and the Cross-Engine Daily Report were all built independently, in separate sprints, for separate reasons — this lesson exists purely to connect them into one honest picture of 'how do I actually prepare for a research or trading day,' introducing zero new calculations of its own.",
      institutionalThinking: "A professional's daily preparation routine draws from several purpose-built tools rather than expecting one page to do everything — checking the Economic Calendar for scheduled catalysts, reading a deterministic daily summary, and only then opening the Terminal for a deep, symbol-specific review. A common mistake is assuming a platform must have a single unified 'morning briefing' screen; here, the routine is assembled from several genuinely separate, purpose-built pages.",
      screenWalkthrough: [
        "Economic Calendar (/events) — a forward-looking, SIMULATED calendar of Fed/FOMC decisions, CPI, jobs reports, PCE/retail sales, and per-symbol earnings/ex-dividend dates across the platform's known universe; each event carries an event-risk score/penalty that already flows into the Decision Engine and Investment Committee's own read for affected symbols.",
        "AI Research Thesis (on /stock-analyst, NOT inside the Terminal) — a streamed AI narration of a single company's already-computed report (business quality, moat, valuation, decision verdict); this is the feature the Terminal's Overview tab deliberately replaces with a static disclaimer.",
        "Ask the AI Investment Analyst (inside the Terminal's own Overview tab, via the shared report component) — a genuine, live free-form Q&A box grounded only in that symbol's already-computed report data — the one AI feature that DOES work inside the Terminal.",
        "Cross-Engine Daily Report (/daily-report) — an on-demand (never scheduled, emailed, or pushed) composition of Engine 1 (macro context + watchlist target crossings), Engine 2 (open trading-position risk), and Engine 3 (portfolio health, unrealized P&L, top scanner opportunity) into one page, with a deterministic rule-based summary sentence always shown, plus an optional 'Narrate My Day' AI narration layered on top — never replacing the deterministic summary.",
        "Market Briefing (on /portfolio-ai) — a deterministic, options-IV-derived synthetic market-regime read (risk_on/neutral/risk_off) plus the next several upcoming high/medium-impact catalysts pulled from the same Economic Calendar data, with an optional streamed AI narration of that same deterministic content.",
      ],
      workflowSteps: [
        "Start with the Economic Calendar to see what's scheduled today or this week — a Fed decision, a CPI release, or an earnings date for something you hold or watch.",
        "Open the Cross-Engine Daily Report for a fast, deterministic cross-engine summary — watchlist crossings, open-position risk, and options-income portfolio health, all on one page.",
        "Optionally press 'Narrate My Day' for an AI-narrated version of that same summary — it never replaces the deterministic figures above it, only adds prose.",
        "For any symbol that needs a genuine deep dive, move to the Research Terminal — use its Overview tab's Ask-the-Analyst box for specific questions, and its other 8 tabs for the full research review.",
        "If you specifically want the AI's own auto-generated thesis (not just answers to your questions), open that symbol directly on Stock Research (/stock-analyst) rather than the Terminal.",
      ],
      metricsExplained: [
        { term: "Event Risk Score", explanation: "A deterministic penalty/score computed per upcoming calendar event (earnings, FOMC, CPI, etc.) — feeds directly into the Decision Engine and Investment Committee's own read for an affected symbol, never a live market-moving prediction." },
        { term: "Market Regime (risk_on/neutral/risk_off)", explanation: "A deterministic, options-IV-derived synthetic reading used by the Market Briefing — not a live VIX feed or an external data source." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A complete, honest daily preparation routine",
          steps: [
            "Check the Economic Calendar and notice a CPI release is scheduled for tomorrow.",
            "Open the Cross-Engine Daily Report and see a watchlist symbol crossed its margin-of-safety target overnight.",
            "Open the Research Terminal for that symbol, review all 9 tabs, and ask the AI Investment Analyst a specific follow-up question about the Investment Committee's own reasoning.",
          ],
          note: "This routine uses 3 genuinely separate, purpose-built pages — none of it required a single unified 'morning briefing' screen that doesn't exist.",
        },
        {
          label: "Average Opportunity",
          title: "Relying on the Market Briefing alone",
          steps: [
            "A user only checks the Market Briefing card on Portfolio AI each morning and skips the Economic Calendar entirely.",
            "The Market Briefing does surface upcoming catalysts, but a full symbol-specific earnings date is more precisely tracked on the dedicated Economic Calendar page.",
          ],
          note: "The Market Briefing is a genuinely useful summary, but it's not a substitute for checking the dedicated Economic Calendar when a specific date matters.",
        },
        {
          label: "Poor Opportunity",
          title: "Expecting a News tab inside the Research Terminal",
          steps: [
            "A user opens the Research Terminal looking for a News tab to read headlines about a company before making a decision.",
            "No such tab, page, or feature exists anywhere in this platform — not even in simulated form.",
          ],
          note: "This is the honest gap this lesson exists to disclose plainly, rather than let a user search indefinitely for something that was never built.",
        },
      ],
      commonMistakes: [
        "Searching the Research Terminal for a News tab — it does not exist anywhere in this platform.",
        "Assuming the Economic Calendar is part of the Research Terminal — it's a separate page (/events).",
        "Expecting the Terminal's Overview tab to auto-generate an AI thesis — that specific feature is deliberately replaced with a static disclaimer there; the full AI Research Thesis lives on Stock Research instead.",
        "Treating the Economic Calendar's dates as a live economic-data feed rather than what they actually are — a deterministic, SIMULATED calendar.",
      ],
      riskWarnings: [
        "Every event date on the Economic Calendar is formula-generated, not sourced from a live economic-data provider — never treat a specific date as guaranteed accurate for a real-world decision.",
        "The Cross-Engine Daily Report and Market Briefing are both on-demand only — nothing here is scheduled, emailed, or pushed to you; you must open the page yourself to see current data.",
      ],
      bestPractices: [
        "Check the Economic Calendar before opening a deep Terminal review, so you know whether a scheduled event might be influencing what you're about to read.",
        "Use the Cross-Engine Daily Report as your fast morning summary, and the Research Terminal for anything that needs a genuine deep dive.",
        "Remember the AI Research Thesis and the Ask-the-Analyst Q&A box are two different features — one auto-generates, one answers your specific question — and only the second one lives inside the Terminal.",
      ],
      relatedModuleHrefs: ["/research-terminal", "/events", "/daily-report", "/portfolio-ai", "/stock-analyst", "/learn/paths/institutional-investing"],
      aiCoachPrompts: [
        "What's scheduled on the Economic Calendar this week for my watchlist symbols?",
        "Summarize today's Cross-Engine Daily Report.",
        "Why doesn't the Research Terminal auto-generate an AI thesis?",
        "Is this Market Briefing's regime reading from a live data feed?",
      ],
      relatedGlossaryKeys: ["research-terminal", "event-risk"],
      nextStepKeys: ["investing-investment-committee"],
      guidedTourRequired: false,
      externalHref: "/events",
      estimatedMinutes: 8,
      knowledgeCheck: [
        {
          prompt: "Does a news feed (headlines/articles) exist anywhere in this platform?",
          options: ["Yes, on the Research Terminal's own News tab", "No — not as a tab, a page, or even a simulated feature; it does not exist anywhere", "Yes, but only on the Economic Calendar page", "Yes, as part of the AI Research Thesis"],
          correctIndex: 1,
          explanation: "No news feed exists anywhere in this codebase, not even in simulated form — only a single unused label in an internal type definition, never rendered anywhere.",
        },
        {
          prompt: "Where does the real Economic Calendar actually live?",
          options: ["As a tab inside the Research Terminal", "On its own separate page, /events", "Inside the Cross-Engine Daily Report only", "It doesn't exist — only market-hours data exists"],
          correctIndex: 1,
          explanation: "The Economic Calendar is a genuinely separate page (/events, 'Economic Calendar'/'Event Calendar') — not a tab inside the Research Terminal, and distinct from the market-hours-only lib/marketCalendar.ts.",
        },
        {
          prompt: "Is the Economic Calendar's data sourced from a live economic-data provider?",
          options: ["Yes, a real-time Fed/BLS data feed", "No — it's a deterministic, SIMULATED calendar (formula-generated dates)", "Only for earnings dates, not FOMC/CPI", "Yes, but only when a live fundamentals provider is configured"],
          correctIndex: 1,
          explanation: "The entire Economic Calendar is deterministic and SIMULATED — formula-generated event dates, not a live economic-data feed.",
        },
        {
          prompt: "Why doesn't the Research Terminal's Overview tab show the AI Research Thesis?",
          options: ["The Terminal has no AI features at all", "It's deliberately replaced with a static disclaimer directing you to the full Stock Research page; the Terminal still inherits a live Ask-the-Analyst Q&A box from the same shared component", "The feature was removed platform-wide", "It only shows for symbols outside the default universe"],
          correctIndex: 1,
          explanation: "The auto-generated AI Research Thesis is deliberately suppressed inside the Terminal in favor of a static disclaimer — but the same shared report component still includes a live, working Ask-the-Analyst free-form Q&A box.",
        },
        {
          prompt: "Is the Cross-Engine Daily Report ever scheduled or emailed automatically?",
          options: ["Yes, every morning at market open", "No — it's on-demand only; nothing is scheduled, emailed, or pushed", "Yes, but only if alerts are enabled", "Yes, once per week"],
          correctIndex: 1,
          explanation: "The Cross-Engine Daily Report is explicitly on-demand only — you must open the page yourself; nothing runs on a schedule or is pushed to you.",
        },
      ],
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
      summary: "What already happened, not a live feed — and honestly, not a place to define your own alert rule either.",
      body: [
        "Every alert in this platform records a moment when an already-built, hardcoded, deterministic check found something true — a price or margin-of-safety target crossed, a Decision Engine/valuation/quality/committee/Tom Nash rating changed, financial strength deteriorated, a dividend was cut or changed materially, an earnings date approached, a portfolio drifted in quality or diversification, a concentration cap was breached, or a new symbol entered a saved screen's top results. This is a historical fact recorded after the fact, never a continuously-updating live feed.",
        "Severity is a real three-level classification — info, warning, or critical — set by a fixed rule per alert type (for example, a downgrade to Sell/Avoid or a dividend cut to zero is critical; a hard-cap risk breach is a warning), never a subjective judgment call.",
        "Two subsystems feed the same in-app notification list you see everywhere in this platform: the always-on Notification Center (the bell icon in the header, present on every page) and the Institutional Monitoring dashboard (/monitoring-dashboard) — both read and write the same underlying alert list, so an alert you dismiss or mark read in one place is the same alert in the other, not a duplicate.",
        "Honest disclosure: there is no screen anywhere in this platform where a user can type in a custom alert condition (e.g. \"alert me when X crosses Y\"). Every one of the 14 real alert types is a hardcoded, deterministic check — not something you configure. The one genuinely user-defined limit feature in the platform is called a Policy, not an alert, and lives on a separate page (Monitoring & Compliance, /monitoring-compliance-engine) — covered below so you know exactly where to go if you actually want to set your own threshold.",
      ],
      whyItMatters: "The absence of an alert does not mean nothing is happening — it means none of the fixed, built-in checks has crossed its own threshold yet. Monitoring complements periodic deep research, it doesn't replace it, and knowing that alert types are fixed (not user-configurable) sets the right expectation before you go looking for a 'create alert' button that doesn't exist.",
      difficulty: "beginner",
      whyItExists: "Every one of the 14 alert checks reuses an already-computed engine figure (Decision Engine, valuation, Investment Committee, Tom Nash, financial strength, dividends, portfolio drift/concentration from Risk & Exposure, and saved-screen matches from Opportunity Discovery) — this module introduces zero new scoring, only the diffing logic that decides when an already-known figure changed since it was last checked.",
      institutionalThinking: "A professional treats monitoring as a complement to scheduled review, not a replacement for it — silence from the alert system is not evidence of safety, only evidence that none of the specific, fixed conditions this system checks for has fired. A common mistake is assuming a 'warning' alert and a 'critical' alert deserve the same urgency; they don't — critical is reserved for the more severe rule outcomes (like a downgrade to Sell/Avoid), warning for the rest.",
      screenWalkthrough: [
        "Notification bell (every page, top of the app) — an unread-count badge, a 'Check now' button that re-runs the deterministic checks on demand, and a scrollable list showing title, a data-source badge (SIMULATED/LIVE), message, relative time, and Mark read per item.",
        "Monitoring dashboard (/monitoring-dashboard) — 4 permanent badges (Institutional Monitoring, Educational, Deterministic, Evidence Based), a Filters card (Severity select, Alert Type select across all 14 real types, a free-text Symbol box), and a 'Run Full Check' button that re-runs every check including the on-demand-only Opportunity Match check the automatic 5-minute background pass skips.",
        "Active Alerts / Alert History / Timeline tabs — all three read the exact same underlying alert list, just filtered and sorted differently (unread, read, or chronological) — there is no separate data source per tab.",
        "Each alert card — title, severity badge, type badge, data-source badge, message, timestamp, a previous-value → current-value line when applicable, an evidence bullet list, a recommended-action line, Mark read/unread, a Notes button, and (when a symbol is attached) links to Review in Committee, Open in Terminal, and Ask the AI Coach.",
        "Notes dialog — a free-text note field per alert, explicitly labeled 'your own notes on this alert — never shared, never used by any detection logic.' This is a comment feature only — it cannot change what triggers an alert.",
        "Settings → Alerts & Notifications card — a single Enable alerts switch; when off, the notification center never generates a new alert for that account. This is a global on/off kill switch, not a rule-configuration screen.",
        "Monitoring & Compliance (/monitoring-compliance-engine) — the genuinely separate Policy Configuration tab: a New Policy form (policy type, target key, limit value, Create Policy button) and a policy list with an enable/disable switch and Delete per policy. This is the one real 'define your own limit' feature in the platform — it produces Policy Violations on its own Compliance Dashboard tab, never a bell notification or a Monitoring dashboard alert card.",
      ],
      workflowSteps: [
        "Check the bell icon periodically, or press 'Check now' for an on-demand re-run of the deterministic checks.",
        "Open the Monitoring dashboard for a fuller view — filter by severity or alert type if the list is long.",
        "Read each alert's evidence and previous→current value line before acting, not just the headline title.",
        "For a symbol-linked alert, use Open in Terminal or Review in Committee to see the full current picture before deciding anything.",
        "Add a Note if you want to record your own reasoning for future reference — it's saved with the alert but never changes detection logic.",
        "If what you actually want is a custom threshold you define yourself, go to Monitoring & Compliance's Policy Configuration tab instead — that's a different feature from everything above.",
      ],
      metricsExplained: [
        { term: "Alert Severity", explanation: "A three-level classification (info/warning/critical) attached to every alert by a fixed rule per alert type — never a subjective read." },
        { term: "Alert Type", explanation: "One of 14 fixed, hardcoded checks — decision/valuation/quality/committee/Tom Nash change, financial deterioration, dividend change, earnings alert, portfolio drift, sector concentration breach, position sizing breach, or opportunity match — never a user-defined condition." },
        { term: "Policy Violation", explanation: "A genuinely different, separate output from the Monitoring & Compliance Policy Configuration tab — the result of comparing your own user-defined limit value against its target, never shown as a bell notification or a Monitoring dashboard alert card." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Using an alert as a prompt for deeper review, not a verdict",
          steps: [
            "A critical alert fires: a held symbol's Decision Engine recommendation moved from Hold to Sell.",
            "You open Review in Committee and Open in Terminal for that symbol rather than acting on the headline alone.",
            "You confirm the change is genuine (not a data glitch) via the Terminal's own Evidence tab, then decide your next step from the full picture, not the alert text alone.",
          ],
          note: "The alert did its job — it told you WHEN something changed. It never told you WHAT to do about it; that judgment still requires the full research surface.",
        },
        {
          label: "Average Opportunity",
          title: "A warning-level risk-cap breach",
          steps: [
            "A warning alert fires: your portfolio's position sizing cap was breached on one symbol.",
            "You add a Note recording that you're aware and intentionally holding a larger position for a specific reason.",
            "You leave the alert unresolved rather than dismissing it, since the underlying condition (the breach) hasn't actually changed.",
          ],
          note: "Marking an alert 'read' only changes its own read state — it never fixes or dismisses the underlying condition it's describing.",
        },
        {
          label: "Poor Opportunity",
          title: "Looking for a 'create custom alert' button that doesn't exist",
          steps: [
            "A user wants to be alerted the moment a specific symbol's price crosses an arbitrary number they choose.",
            "They search the Monitoring dashboard and the notification bell for a 'new alert' or 'create alert' control — there isn't one anywhere in either system.",
            "The closest real feature is a Watchlist price/margin-of-safety target (set on the Value Watchlist itself, checked via the explicit 'Check Targets' button) — or, for a genuinely custom numeric limit, a Policy on the separate Monitoring & Compliance page.",
          ],
          note: "This is the honest gap this lesson exists to disclose plainly — inventing a 'create alert' feature here would be teaching something that doesn't exist.",
        },
      ],
      commonMistakes: [
        "Looking for a 'create a new alert' button anywhere in the Notification Center or Monitoring dashboard — neither has one; every alert type is fixed and automatic.",
        "Treating an unread-alert count of zero as proof nothing is wrong — it only means none of the fixed checks has fired since the last evaluation.",
        "Confusing a Monitoring alert with a Compliance Policy Violation — they're two separate outputs from two separate systems, never shown in the same place.",
        "Assuming adding a Note to an alert changes what triggers future alerts — notes are pure annotation, never wired into detection logic.",
      ],
      riskWarnings: [
        "Alerts are 100% deterministic, template-based text — there is no AI-generated alert content anywhere in either subsystem; treat every alert as a fact-check trigger, not an opinion.",
        "The 'Enable alerts' switch in Settings is a full kill switch — when off, no new alert of any kind is generated for that account, silently, until turned back on.",
      ],
      bestPractices: [
        "Use 'Run Full Check' on the Monitoring dashboard when you specifically want the on-demand Opportunity Match check included — the automatic 5-minute background pass skips it.",
        "Read the evidence and previous→current value on every alert before acting, not just its title.",
        "If you need a genuinely custom numeric threshold, use a Policy on Monitoring & Compliance rather than searching the alert system for a configuration option it doesn't have.",
      ],
      relatedModuleHrefs: ["/monitoring-dashboard", "/monitoring-compliance-engine", "/research-terminal", "/stock-analyst", "/learn/paths/institutional-investing"],
      aiCoachPrompts: [
        "Explain this alert's evidence and recommended action.",
        "What's the difference between an alert and a Policy Violation?",
        "Why did this alert's severity read 'warning' instead of 'critical'?",
        "How do I set a custom price threshold if the alert system doesn't let me define one?",
      ],
      relatedGlossaryKeys: ["monitoring-alert", "alert-severity", "portfolio-drift-alert", "watchlist-and-opportunity-triggers"],
      nextStepKeys: ["investing-margin-of-safety"],
      guidedTourRequired: false,
      externalHref: "/monitoring-dashboard",
      estimatedMinutes: 8,
      knowledgeCheck: [
        {
          prompt: "What does an alert's severity level (info/warning/critical) reflect?",
          options: ["A subjective judgment made by an AI model", "A fixed, deterministic rule per alert type — never a subjective read", "How many times the same alert has fired", "The user's own priority setting"],
          correctIndex: 1,
          explanation: "Severity is a real three-level classification set by a fixed rule per alert type — for example a downgrade to Sell/Avoid is critical, a hard-cap risk breach is a warning — never a subjective judgment.",
        },
        {
          prompt: "Can a user define a custom alert condition (e.g. 'alert me when X crosses Y') anywhere in the Notification Center or Monitoring dashboard?",
          options: ["Yes, via a 'New Alert' form on the Monitoring dashboard", "No — every one of the 14 alert types is a fixed, hardcoded, deterministic check", "Yes, but only for critical-severity alerts", "Yes, through the notification bell's settings menu"],
          correctIndex: 1,
          explanation: "Neither system has a create/edit-alert UI anywhere. All alert types are fixed and automatic — the closest real user-defined-limit feature is a Policy on the separate Monitoring & Compliance page.",
        },
        {
          prompt: "Is there any AI-generated alert content in this platform?",
          options: ["Yes, every alert message is written by an LLM", "No — every alert is deterministic, template-based text; the 'Ask the AI Coach' link is a separate, deterministic explanation feature", "Only critical-severity alerts use AI narration", "Only alerts tied to a symbol use AI narration"],
          correctIndex: 1,
          explanation: "All alert content is deterministic template text built from already-computed values. The AI Coach link on an alert card opens a separate, also-deterministic explanation module — not an LLM-generated alert.",
        },
        {
          prompt: "What is a Policy Violation, and where does it appear?",
          options: ["The same thing as a Monitoring alert, shown in the same list", "The output of a genuinely separate, user-defined-limit feature on Monitoring & Compliance — never shown as a bell notification or Monitoring dashboard alert card", "A type of critical-severity alert", "A watchlist target crossing"],
          correctIndex: 1,
          explanation: "Policy Violations come from the Compliance Policy Engine — the one place a user can actually define their own numeric limit — and are shown only on that page's own Compliance Dashboard tab, never mixed into the alert bell or Monitoring dashboard.",
        },
        {
          prompt: "What happens when the 'Enable alerts' switch in Settings is turned off?",
          options: ["Only critical alerts stop generating", "No new alert of any kind is generated for that account until it's turned back on", "Existing alerts are deleted", "It only affects the Monitoring dashboard, not the notification bell"],
          correctIndex: 1,
          explanation: "This is a full kill switch shared by both subsystems — when off, the notification center never generates a new alert for that account, silently, across both the bell and the Monitoring dashboard.",
        },
      ],
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
    topic({
      key: "investing-institutional-mentor",
      title: "Institutional Mentor",
      summary: "A deterministic professional portfolio review — explicitly NOT an LLM, chatbot, or predictive engine.",
      body: [
        "Institutional Mentor (/institutional-mentor) is a deterministic review of your own real portfolio, built entirely from already-computed figures across the platform's own engines — its own header comment states plainly: this is NOT an LLM, a chatbot, predictive AI, financial advice, portfolio optimisation, or a trade recommendation engine.",
        "Its centerpiece is a Portfolio Scorecard across 9 categories (capital allocation, risk management, diversification, discipline, income generation, position sizing, greeks management, event preparation, portfolio health) — each scored 0-100 with a grade badge, a 'why' explanation, and a named source module it was computed from, never a fabricated number.",
        "Below the scorecard sit threshold-gated reviews across a dozen areas (Professional Review, Decision Review, Capital Allocation Review, Risk Review, Income Review, Behaviour Review, Watchlist Review, Portfolio Review, Decision Engine Review, Opportunity Discovery Review, Monitoring Alerts Review) — each one only fires an observation when a real, named condition is actually met, and each links to the Learning Centre lesson/glossary/strategy/coach content most relevant to what it flagged.",
      ],
      whyItMatters: "A genuinely deterministic, source-attributed review is safer to lean on than a free-form AI opinion — every score traces to a specific module, and the 5 permanent badges at the top (Institutional Mentor, Professional Portfolio Review, Deterministic Analysis, Paper Trading, Educational Only) exist precisely to prevent this page from ever being mistaken for investment advice.",
      difficulty: "intermediate",
      whyItExists: "Every scoring input already existed somewhere else in the platform (Portfolio Optimisation, Decision Engine, Portfolio Risk Dashboard, the Trade Journal's own behaviour analysis) — Institutional Mentor's only new contribution is the scorecard's own weighting and threshold logic that decides WHEN each review fires, never a new fact about any position.",
      institutionalThinking: "A professional review process is repeatable and source-attributed — you can trace exactly why a score is what it is, and re-run the same review next month to see if it improved. A common mistake is treating a scorecard's low grade as a command to act immediately, rather than as one structured input among several to weigh.",
      screenWalkthrough: [
        "Portfolio Scorecard — 9 categories, each with a 0-100 score, a grade badge, a 'why' sentence, and the specific source module it was computed from.",
        "Professional Review — a synthesis of the scorecard into plain-language observations.",
        "Decision Review, Capital Allocation Review, Risk Review, Income Review — each threshold-gated, reusing the Decision Engine, capital-allocation figures, the Portfolio Risk Dashboard, and theta income figures respectively.",
        "Behaviour Review — reuses the AI Trade Journal's own behaviour analysis, never a second, separate behavioural model.",
        "Watchlist Review, Portfolio Review, Decision Engine Review, Opportunity Discovery Review — each reusing Engine 1's own already-built modules of the same name.",
        "Monitoring Alerts Review — reuses the same monitoring-alert list Monitoring & Alerts itself shows.",
        "Institutional Lessons — cross-links from each review section to the Learning Centre lesson, glossary term, strategy, or coach explanation most relevant to what it flagged.",
        "5 permanent badges at the top of the page: Institutional Mentor, Professional Portfolio Review, Deterministic Analysis, Paper Trading, Educational Only — always visible, never conditionally hidden.",
      ],
      workflowSteps: [
        "Open Institutional Mentor from the sidebar.",
        "Review the Portfolio Scorecard's 9 categories first, noting which score lowest and why.",
        "Read Professional Review for the plain-language synthesis of the scorecard.",
        "Open whichever threshold-gated review section fired an observation, and follow its source-module attribution back to the original page if you want more detail.",
        "Follow an Institutional Lessons cross-link if a flagged area is unfamiliar.",
        "Re-run this review on a recurring cadence to see whether flagged areas actually improve over time.",
      ],
      metricsExplained: [
        { term: "Portfolio Scorecard category score", explanation: "A 0-100 score for one of 9 named categories, each with an explicit source module attribution — never a black-box number." },
        { term: "Threshold-gated review", explanation: "A review section (e.g. Risk Review) only produces an observation when a real, named condition is met — an absent section means the condition simply wasn't met, not that nothing was checked." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "High scores across most categories",
          steps: [
            "The Portfolio Scorecard shows Diversification, Risk Management, and Portfolio Health all scoring above 75.",
            "Professional Review reports no significant concerns.",
            "Only Income Generation scores moderately, with a 'why' noting theta income is modest relative to account size.",
          ],
          note: "Even a strong overall scorecard can have one lower-scoring category worth reading the 'why' on — the scorecard rewards reading every category, not just the average.",
        },
        {
          label: "Average Opportunity",
          title: "Position Sizing scores low, one threshold-gated review fires",
          steps: [
            "Position Sizing scores 48/100, with a 'why' noting one position sized meaningfully larger than the others.",
            "Risk Review fires an observation naming the same position and linking to the Position Sizing lesson.",
          ],
          note: "A single flagged category with a clear source-module attribution and a relevant lesson link is exactly the kind of structured, traceable finding this page is designed to surface.",
        },
        {
          label: "Poor Opportunity",
          title: "Multiple categories score low and several reviews fire together",
          steps: [
            "Capital Allocation, Diversification, and Risk Management all score below 40.",
            "Both Capital Allocation Review and Risk Review fire observations naming overlapping concentrated positions.",
            "Professional Review's synthesis explicitly connects the two findings.",
          ],
          note: "When multiple independent scorecard categories AND their corresponding threshold-gated reviews agree on the same underlying issue, that convergence is a stronger signal than any single low score alone.",
        },
      ],
      commonMistakes: [
        "Mistaking this page for an LLM chatbot or a source of trade recommendations — its own header comment and permanent badges explicitly rule that out.",
        "Acting on a low scorecard score without reading its 'why' explanation and source-module attribution first.",
        "Assuming an absent threshold-gated review section means nothing was checked, rather than that its condition simply wasn't met.",
      ],
      riskWarnings: [
        "Institutional Mentor is explicitly not financial advice, portfolio optimisation, or a trade recommendation engine — it is a deterministic, source-attributed review only.",
        "Every figure reflects your own current paper-trading portfolio, never a live prediction of future performance.",
      ],
      bestPractices: [
        "Read each category's 'why' explanation, not just its numeric score.",
        "Follow source-module attributions back to the original page for the fullest detail behind any given score.",
        "Re-run this review on a consistent cadence to track whether flagged categories genuinely improve.",
      ],
      relatedModuleHrefs: ["/institutional-mentor", "/institutional-dashboard", "/decision-engine", "/portfolio-dashboard", "/trading-journal"],
      aiCoachPrompts: [
        "Why did my Risk Management category score low?",
        "Explain my Portfolio Scorecard.",
        "Is Institutional Mentor giving me financial advice?",
      ],
      relatedGlossaryKeys: ["portfolio-health", "capital-allocation", "position-sizing", "process-over-prediction", "concentration"],
      nextStepKeys: [],
      guidedTourRequired: false,
      externalHref: "/institutional-mentor",
      estimatedMinutes: 8,
      knowledgeCheck: [
        {
          prompt: "According to its own header comment, what is Institutional Mentor explicitly NOT?",
          options: ["A deterministic review tool", "An LLM, a chatbot, predictive AI, financial advice, portfolio optimisation, or a trade recommendation engine", "A page that scores portfolios", "A page linked from Institutional Dashboard"],
          correctIndex: 1,
          explanation: "Its own header comment states plainly that it is none of those things — every score is deterministic and source-attributed, never an AI-generated opinion.",
        },
        {
          prompt: "How many categories does the Portfolio Scorecard score?",
          options: ["3", "5", "9", "12"],
          correctIndex: 2,
          explanation: "The scorecard covers 9 named categories: capital allocation, risk management, diversification, discipline, income generation, position sizing, greeks management, event preparation, and portfolio health.",
        },
        {
          prompt: "What does a threshold-gated review section's absence from the page mean?",
          options: ["The review crashed", "Its condition simply wasn't met — not that nothing was checked", "You need to refresh the page", "The section is hidden behind a paywall"],
          correctIndex: 1,
          explanation: "Each review section only fires an observation when a real, named condition is actually met — an absent section is an honest 'condition not met,' never a sign nothing was evaluated.",
        },
        {
          prompt: "Where does the Behaviour Review section get its analysis from?",
          options: ["A brand-new behavioural model built just for this page", "The existing AI Trade Journal's own behaviour analysis, reused", "Live broker order data", "The Scanner's opportunity grid"],
          correctIndex: 1,
          explanation: "Behaviour Review reuses the Trade Journal's own already-built behaviour analysis rather than introducing a second, separate model.",
        },
        {
          prompt: "What are the 5 permanent badges shown at the top of Institutional Mentor?",
          options: ["Buy, Hold, Sell, Wait, Accumulate", "Institutional Mentor, Professional Portfolio Review, Deterministic Analysis, Paper Trading, Educational Only", "Delta, Theta, Gamma, Vega, POP", "Healthy, Watch, Critical, Elevated, Normal"],
          correctIndex: 1,
          explanation: "These 5 badges are always visible, never conditionally hidden, and exist specifically to prevent the page from being mistaken for investment advice.",
        },
        {
          prompt: "What should you do with a low-scoring category on the Portfolio Scorecard?",
          options: ["Act on it immediately without further review", "Read its 'why' explanation and source-module attribution before deciding what, if anything, to do", "Ignore it since the page isn't financial advice anyway", "Delete the flagged position immediately"],
          correctIndex: 1,
          explanation: "The scorecard is one structured input to weigh, with full source attribution — not a command to act, and the lesson explicitly warns against treating a low score as an immediate directive.",
        },
      ],
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
    // v1.4.0, Sprint L2A — Interactive Module Guides. A new flagship
    // overview topic covering the whole Trading Research page
    // (/trading-research) end to end — the Institutional Trading Engine's
    // own module guide, positioned first in this path so the deep-dive
    // topics that already follow it (Market Structure, Liquidity, etc.)
    // read as a natural continuation rather than a cold start.
    topic({
      key: "trading-engine-overview",
      title: "The Trading Research Page",
      summary: "Structure → Confluence → Regime → Probability → Risk, all on one page — the Institutional Trading Engine's own module guide.",
      body: [
        "Trading Research (/trading-research) is the Institutional Trading Engine's own single page: search a symbol, and four cards resolve (Market Structure, Multi-Timeframe Confluence, Market Regime, Probability), plus an on-demand Liquidity tab and an always-visible Portfolio Risk section that reads your own open positions rather than any one symbol.",
        "Every reading here is SIMULATED market analysis, advisory only — this page never previews, schedules, or submits an order, and never touches a real brokerage account.",
        "Who should use it, and when: any time before sizing or opening a position, to check trend context, timeframe agreement, the combined regime, a plausible price range, and — critically — whether your own portfolio-level risk caps have room for it.",
      ],
      whyItMatters: "Reading Structure, Confluence, Regime, and Probability together, in that order, before ever touching Portfolio Risk's own position-sizing caps, is the difference between a considered entry and an impulsive one.",
      difficulty: "intermediate",
      whyItExists: "Five genuinely separate engines (Market Structure, Multi-Timeframe, Liquidity, Regime, Probability, Risk) were each built and tested independently — this page composes their already-computed outputs into one coherent read for a single symbol, adding zero new candle analysis or scoring logic of its own.",
      institutionalThinking: "Professional traders read structure, then confluence, then regime, then probability, then portfolio-level risk before acting — never sizing or opening a position from a single card in isolation. A common retail mistake is checking only 'is it going up' on one timeframe and skipping both the volatility regime and the portfolio-level risk budget entirely.",
      screenWalkthrough: [
        "Symbol search box — type a ticker and click Search (or press Enter) to load every eager card below for that symbol.",
        "\"Ask AI Trading Coach\" button — appears once a symbol is loaded; opens the dockable AI Trading Coach panel grounded in this symbol's own already-computed data.",
        "Market Structure card — trend classification (uptrend / downtrend / range) from real swing highs and lows, a confidence badge, and any detected support/resistance zones.",
        "Multi-Timeframe Confluence card — runs Market Structure across several timeframes (e.g. 15m / 1h / 1D) and reports whether they agree on the same trend; a genuine split honestly shows 'No dominant trend' rather than guessing a winner.",
        "Market Regime card — combines trend, liquidity, and realized volatility into one label (e.g. trending-bullish, range-bound, volatile-choppy).",
        "Probability card — a driftless lognormal ±1σ/±2σ price range per day-ahead horizon, built from the same realized volatility Market Regime already computed — never a directional prediction of where price is headed.",
        "Liquidity tab (on-demand — fetched only when you open it, unlike the four eager cards above) — volume profile, liquidity band, and buy/sell pressure for the same symbol.",
        "Portfolio Risk section — always visible regardless of which symbol you've searched, since it reads your own open trading positions, not one symbol: set your account value, add a position with a stop and target, and see Position Sizing, Stop/Target Discipline, and Portfolio Risk Budget scoring, each against a named, hard-capped threshold.",
      ],
      workflowSteps: [
        "Enter a symbol and search it.",
        "Read Market Structure first — trend context frames everything else on the page.",
        "Check Multi-Timeframe Confluence to see whether shorter and longer horizons agree with that trend.",
        "Read Market Regime for the combined trend/liquidity/volatility picture.",
        "Check the Probability cone to see the plausible price range, not a prediction of direction.",
        "Open the Liquidity tab if you need volume and pressure context before sizing an order.",
        "Scroll to Portfolio Risk and confirm your account value is set.",
        "Add or review your open positions there, each with a real stop and target.",
        "Read the Position Sizing / Stop-Target Discipline / Portfolio Risk Budget scores before treating any single position as \"fine.\"",
        "Use \"Ask AI Trading Coach\" for a free-form question grounded in everything above, rather than guessing at what a reading means.",
      ],
      metricsExplained: [
        { term: "Trend Agreement", explanation: "unanimous / majority / split / insufficient-data — how many of the checked timeframes actually agree on the same dominant trend. A split reading never fabricates a winner." },
        { term: "Confidence Level", explanation: "High / Moderate / Low — reflects how much of the underlying sample (candle count, timeframe coverage) actually supports the reading, never a claim about how the market will move." },
        { term: "Regime Label", explanation: "One of 5 labels (trending-bullish, trending-bearish, range-bound, volatile-choppy, quiet-consolidation) combining the trend, liquidity, and realized-volatility axes into a single read." },
        { term: "Portfolio Risk Budget", explanation: "Aggregate dollar risk across every stop-defined open position, banded against a named cap (6% of account value by default) — breaching it caps the overall Portfolio Risk score at 60 regardless of how good everything else looks." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Aligned structure, room in the risk budget",
          steps: [
            "Market Structure reads 'uptrend' with High confidence.",
            "Multi-Timeframe Confluence reads 'unanimous' agreement across 15m / 1h / 1D.",
            "Market Regime reads 'trending-bullish,' and the Probability cone is confidently computed (volatility was resolvable).",
            "Portfolio Risk shows both Position Sizing and Portfolio Risk Budget comfortably within their own caps.",
          ],
          note: "This is the profile where every signal points the same direction and there's genuine room left in the portfolio's own risk budget — still not a guarantee, only a well-aligned read.",
        },
        {
          label: "Average Opportunity",
          title: "No clear trend, one soft risk warning",
          steps: [
            "Market Structure reads 'range' with Moderate confidence.",
            "Multi-Timeframe Confluence reads 'majority' — 2 of 3 timeframes agree, one doesn't.",
            "Market Regime reads 'range-bound.'",
            "Portfolio Risk shows Position Sizing close to its own cap but not yet breached — a soft warning, not a hard block.",
          ],
          note: "A majority (not unanimous) reading combined with a position sizing warning is exactly the situation to size smaller, not the same as a clean 'good opportunity' setup.",
        },
        {
          label: "Poor Opportunity",
          title: "Split trend, unreadable volatility, a breached risk cap",
          steps: [
            "Multi-Timeframe Confluence reads 'split' — no dominant trend across the checked timeframes.",
            "Market Regime reads 'volatile-choppy' with Low confidence.",
            "The Probability cone is honestly unavailable (volatility couldn't be computed from the available sample).",
            "Portfolio Risk shows a genuine hard-cap breach on either Position Sizing or the Portfolio Risk Budget — the overall score is capped at 60 regardless of the blend.",
          ],
          note: "A hard-cap breach overrides everything else on this screen by design — no combination of good Structure or Regime readings changes that a real risk limit was actually crossed.",
        },
      ],
      commonMistakes: [
        "Sizing a position before checking Portfolio Risk's own caps.",
        "Treating a 'majority' trend agreement the same as 'unanimous.'",
        "Skipping the Liquidity tab because it's on-demand and easy to forget it even exists.",
        "Reading the Probability cone as a prediction of direction rather than a plausible dispersion range.",
      ],
      riskWarnings: [
        "Every reading here is SIMULATED market analysis for education — this page never previews, schedules, or submits an order, and never touches a real brokerage account.",
        "A hard-cap breach in Portfolio Risk caps the overall score at 60 regardless of how good everything else looks — never let a good Structure or Regime read distract from a genuinely breached risk cap.",
      ],
      bestPractices: [
        "Read Structure → Confluence → Regime → Probability → Risk in that order, every time.",
        "Always set a stop and target when adding a position, so Stop/Target Discipline can actually score it.",
      ],
      relatedModuleHrefs: ["/trading-research", "/market-structure-workbench", "/liquidity-workbench", "/learn/paths/institutional-investing", "/learn/paths/options-income-engine"],
      aiCoachPrompts: [
        "Explain this Market Regime reading.",
        "Why did my timeframes disagree on trend?",
        "What does this probability cone actually mean?",
        "What mistakes should I avoid before sizing this position?",
      ],
      relatedGlossaryKeys: ["market-structure", "multi-timeframe-confluence", "liquidity-band", "trading-position-sizing", "portfolio-risk-budget"],
      nextStepKeys: ["trading-market-structure"],
      guidedTourRequired: false,
      externalHref: "/trading-research",
      estimatedMinutes: 9,
    }),
    topic({
      key: "trading-market-structure",
      title: "Market Structure Workbench",
      summary: "The dedicated deep-dive page — swing analysis, multi-timeframe comparison, liquidity mapping, and trade-plan linking, all in one resizable 3-panel workspace.",
      body: [
        "Market Structure Workbench (/market-structure-workbench) is the full, dedicated page behind Trading Research's own condensed Market Structure card — a resizable 3-panel workspace (mirroring Trade Workspace's own layout mechanics) built entirely on already-shipped Engine 2 modules: the Market Structure Engine, the Multi-Timeframe Engine, the Liquidity Engine, and the Session Service.",
        "Trend detection reuses the Market Structure Engine's own swing-based classification exactly: higher highs + higher lows read uptrend, lower highs + lower lows read downtrend, anything else honestly reads range — this page adds zero new trend-scoring logic of its own. Its only genuinely new pieces are the Structure Shift Timeline (a pure replay of the same scorer over an expanding candle window, never a new score), a client-side display-state relabeling of already-computed enums, and two real timeframe-override query parameters this page is the first to expose.",
        "Who should use it, and when: any time you want to genuinely inspect a symbol's structure before planning a trade — comparing timeframes side by side, walking the actual swing sequence, and reviewing every support/resistance zone — rather than the one-glance summary Trading Research's own card provides.",
      ],
      whyItMatters: "A trend badge alone can't tell you WHY it's classified that way — this Workbench shows the actual swing sequence, the multi-timeframe agreement, and the liquidity context behind every trend read, so you're evaluating evidence, not trusting a label.",
      difficulty: "intermediate",
      whyItExists: "The Market Structure, Multi-Timeframe, Liquidity, and Session engines already existed independently — this Workbench is an integration and analysis-workflow page, not a rebuild of Engine 2, composing their already-computed outputs into one deep-dive workspace with genuine cross-navigation into Trade Plans and the Trading Journal.",
      institutionalThinking: "A professional reviews the actual swing sequence and cross-checks multiple timeframes before trusting a single trend label — a lone 'uptrend' badge on one timeframe, with no multi-timeframe agreement checked, is exactly the kind of shortcut that leads to fighting a higher-timeframe trend. A common mistake is trusting the trend badge alone and skipping the Multi-Timeframe Structure Matrix entirely.",
      screenWalkthrough: [
        "Symbol search (top bar) — type a ticker and press Select, or press \"/\" anywhere to jump to the search box; \"[\" and \"]\" toggle the left/right panels collapsed for more workspace room.",
        "Structure Overview (left panel) — current price, trend badge, a plain-English display-state badge, and the trend detail sentence; a timeframe selector (1m/5m/15m/1h/1D) rebuilds this panel for any of the 5 real timeframes the Market Data Provider actually supports.",
        "Range & Consolidation (left panel) — when structure reads 'range,' shows which support/resistance levels it's consolidating between plus the engine's own confidence explanation; otherwise honestly states the symbol isn't currently consolidating.",
        "Trend Alignment (left panel) — the Multi-Timeframe Engine's own trend-agreement badge (unanimous/majority/split/insufficient-data) plus a plain-English alignment display state and summary.",
        "Session Structure (left panel) — which named sessions are currently active and today's session high/low range, from the Session Service (Phase 25), reused unmodified.",
        "Liquidity Context (left panel) — liquidity band and buy/sell pressure badges plus a summary, with a direct link to the full Liquidity & Session Workbench for deeper volume-profile detail.",
        "Multi-Timeframe Structure Matrix (center panel) — checkboxes for each of the 5 real timeframes (honestly, no Monthly/Weekly/4H exists in this codebase yet); a table of Trend/Latest Swing/Key Support/Key Resistance/Freshness per selected timeframe, plus the same trend-agreement badge and an honest 'Structural conflict — no dominant trend' label when nothing dominates.",
        "Swing High / Swing Low Explorer (center panel) — every individual detected swing point, timestamped, with its kind and price.",
        "Higher High / Higher Low / Lower High / Lower Low Sequence (center panel) — the actual sequence of swing-classification events driving the trend read, not just the final label.",
        "Support & Resistance Zone Explorer (center panel) — every detected zone with its kind (support/resistance), price, and touch count (its own strength score).",
        "Structure Shift Timeline (center panel) — a chronological log of trend changes, range entries/exits, and support/resistance tests across the sample, with the timeline's own summary sentence.",
        "Evidence (right panel) — the concrete supporting detail strings from Structure Overview, the Multi-Timeframe Matrix, the Structure Shift Timeline, and Liquidity Context, quoted verbatim so no reading here is a black box.",
        "Structure Notes (right panel) — free-text notes saved per symbol, addable and deletable, reusing the existing Trade Workspace notes system unmodified.",
        "Trade Plan Integration (right panel) — a form pre-filled with the Structure Overview's own summary as a starting thesis; set direction, risk %, entry, stop, and target, then link it into a real, persisted Trade Plan — with links out to the full Trade Workspace and Trade Planning & Risk Studio for deeper risk review.",
        "AI Trading Coach (right panel) — a chat panel explaining existing structure outputs only, reusing the same streaming coach endpoint the full Institutional Trading AI Coach page uses, with a link to open that fuller page directly scoped to this symbol's structure explanation.",
      ],
      workflowSteps: [
        "Select an instrument in the top search bar.",
        "Review the Structure Overview panel's trend badge and detail, switching timeframes if you need a different horizon.",
        "Inspect the Swing High/Swing Low Explorer and the HH/HL/LH/LL Sequence to see the actual evidence behind the trend classification.",
        "Compare timeframes in the Multi-Timeframe Structure Matrix — check whether shorter and longer horizons genuinely agree before trusting the single-timeframe read.",
        "Review the Support & Resistance Zone Explorer for levels worth planning around.",
        "Check the Session Structure and Liquidity Context panels for execution-timing and volume context.",
        "Record a Structure Note capturing your own read, for later review.",
        "Link your findings into a real Trade Plan via the Trade Plan Integration panel, with a real entry, stop, and target.",
        "Open the full Trade Workspace or Trade Planning & Risk Studio for deeper risk review before acting on the plan.",
      ],
      metricsExplained: [
        { term: "Trend (uptrend / downtrend / range)", explanation: "Classified purely from the sequence of detected swing highs and lows — higher highs + higher lows read uptrend, lower highs + lower lows read downtrend, anything else honestly reads range, never a forced directional call." },
        { term: "Trend Agreement", explanation: "unanimous / majority / split / insufficient-data — how many of the checked timeframes actually agree on the same dominant trend, from the Multi-Timeframe Engine, reused unmodified." },
        { term: "Zone Strength", explanation: "A support/resistance zone's own touch count — how many times price has actually tested that level in the sample, not a fabricated importance score." },
        { term: "Structure Shift", explanation: "A real, detected trend change, range entry/exit, or support/resistance test recorded in the Structure Shift Timeline — a pure replay of the same trend scorer over an expanding window, never a new scoring formula." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Aligned structure across timeframes, clean evidence",
          steps: [
            "Structure Overview reads 'uptrend' on 1D with a clear trend detail sentence.",
            "The Multi-Timeframe Structure Matrix shows 'unanimous' agreement across 15m/1h/1D, all reading uptrend.",
            "The Swing Explorer and HH/HL sequence show a clean run of higher highs and higher lows, matching the label.",
            "The Support & Resistance Zone Explorer shows a well-touched support zone just below current price.",
          ],
          note: "This is the profile where the trend label, the swing evidence, and the multi-timeframe agreement all genuinely point the same direction — still not a guarantee, only a well-corroborated read worth building a Trade Plan around.",
        },
        {
          label: "Average Opportunity",
          title: "Range on the daily, but a real support zone nearby",
          steps: [
            "Structure Overview reads 'range,' and Range & Consolidation shows the symbol consolidating above a specific support zone with a stated confidence explanation.",
            "The Multi-Timeframe Structure Matrix shows 'majority,' not unanimous, agreement — one timeframe disagrees.",
            "The Structure Shift Timeline shows a recent 'range entry' event, consistent with the current read.",
          ],
          note: "A range read with a genuinely nearby, well-touched support zone is a real, different situation from a directionless range with no nearby structure at all — the Zone Explorer's own touch counts are what distinguish the two.",
        },
        {
          label: "Poor Opportunity",
          title: "Structural conflict, thin liquidity, no linked plan",
          steps: [
            "The Multi-Timeframe Structure Matrix shows 'split' agreement — an honest 'Structural conflict — no dominant trend' label, no fabricated winner.",
            "Liquidity Context reads 'Low' liquidity band.",
            "No Structure Notes or Trade Plan have been recorded for this symbol yet.",
          ],
          note: "A genuine structural conflict combined with low liquidity is the profile institutionally worth documenting and waiting on, not forcing a Trade Plan out of a read that hasn't actually resolved.",
        },
      ],
      commonMistakes: [
        "Trusting a single-timeframe trend badge and skipping the Multi-Timeframe Structure Matrix's own agreement check entirely.",
        "Expecting Order Block detection, Fair Value Gap detection, or any named ICT/SMC/ASAD/Trader Bill methodology — none of that exists on this page, by deliberate, disclosed scope; only swing-based trend/zone detection.",
        "Treating the AI Trading Coach's structure explanations as a trading signal — it explains existing outputs only, and its own prompt refuses to invent an entry, stop, target, or directional call.",
        "Forgetting the Structure Overview's own timeframe selector — reviewing only the default 1D read when a shorter horizon is actually relevant to your plan.",
      ],
      riskWarnings: [
        "Every reading on this page is SIMULATED market analysis, advisory only — this Workbench never previews, schedules, or submits an order, and never touches a real brokerage account.",
        "No automated signal or execution capability exists here, by design — every finding must be manually carried into a Trade Plan and reviewed in the Trade Workspace or Trade Planning & Risk Studio before it means anything actionable.",
      ],
      bestPractices: [
        "Read the Swing Explorer and HH/HL/LH/LL Sequence before trusting the headline trend badge alone.",
        "Always check the Multi-Timeframe Structure Matrix's agreement level, not just the single active timeframe.",
        "Record a Structure Note at the time you review a symbol — a finding that isn't written down is easy to forget by your next review.",
      ],
      relatedModuleHrefs: ["/market-structure-workbench", "/trading-research", "/liquidity-workbench", "/trade-workspace", "/trade-planning-studio", "/trading-ai-coach"],
      aiCoachPrompts: [
        "Why is this symbol classified as a range right now?",
        "Explain the difference between unanimous and majority trend agreement.",
        "What does this support zone's touch count actually mean?",
      ],
      relatedGlossaryKeys: ["market-structure", "support-resistance-zone", "multi-timeframe-confluence", "liquidity-band", "trade-plan"],
      nextStepKeys: ["trading-liquidity"],
      guidedTourRequired: false,
      externalHref: "/market-structure-workbench",
      estimatedMinutes: 9,
      knowledgeCheck: [
        {
          prompt: "How does Market Structure Workbench classify a trend as 'uptrend'?",
          options: ["An LLM judges the chart visually", "Higher highs plus higher lows in the detected swing sequence", "The user manually sets it", "A moving-average crossover"],
          correctIndex: 1,
          explanation: "Trend classification is purely swing-based: higher highs + higher lows read uptrend, lower highs + lower lows read downtrend, anything else honestly reads range.",
        },
        {
          prompt: "What does a 'split' Trend Agreement reading in the Multi-Timeframe Structure Matrix mean?",
          options: ["The engine picks whichever timeframe looks best", "No dominant trend is fabricated — the checked timeframes genuinely disagree", "It's a bug and should be ignored", "It automatically defaults to range"],
          correctIndex: 1,
          explanation: "The Multi-Timeframe Engine never guesses a winner — a genuine disagreement across timeframes shows an honest 'Structural conflict — no dominant trend' label instead.",
        },
        {
          prompt: "What genuinely new scoring logic did the Market Structure Workbench introduce?",
          options: ["A new trend-detection algorithm", "None — it's an integration/analysis-workflow page over already-shipped engines, plus a pure replay-based timeline and display-state relabeling", "Order Block and Fair Value Gap detection", "An automated execution signal"],
          correctIndex: 1,
          explanation: "The page's own header comment states it's an integration phase, not a rebuild — trend/zone scoring is entirely reused; the Structure Shift Timeline is a pure replay and the display states are a pure relabeling of already-computed enums.",
        },
        {
          prompt: "What does a support/resistance zone's 'strength' actually represent?",
          options: ["A fabricated importance rating", "How many times price has actually touched that level in the sample", "The zone's distance from current price", "An AI-assigned confidence score"],
          correctIndex: 1,
          explanation: "Zone strength is a literal touch count — a real, counted fact from the candle data, never a fabricated importance score.",
        },
        {
          prompt: "Which of these does the Market Structure Workbench deliberately NOT include, by disclosed scope?",
          options: ["Swing high/low detection", "Multi-timeframe comparison", "ICT/SMC/ASAD/Trader Bill methodology or automated signals", "A Trade Plan integration panel"],
          correctIndex: 2,
          explanation: "The page's own header comment explicitly discloses that Order Block detection, Fair Value Gap detection, any named methodology, and automated signals/execution are all deliberately deferred.",
        },
        {
          prompt: "What happens when you link your structure findings to a Trade Plan from this page?",
          options: ["An order is automatically submitted", "A real, persisted Trade Plan is created with your entered direction/risk/entry/stop/target, pre-filled with the structure's own summary as a starting thesis", "Nothing is saved — it's a preview only", "It opens a live broker order form"],
          correctIndex: 1,
          explanation: "The Trade Plan Integration panel creates a real, persisted Trade Plan reusing the existing Trade Plans system, pre-seeding the thesis field from the Structure Engine's own already-computed summary — never submitting any order.",
        },
      ],
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
      summary: "Recording your own trades, then reviewing them with the AI Coach's own real statistics — never a fabricated performance dashboard.",
      body: [
        "The Trading Journal (/trading-journal) is Engine 2's own reflection log — distinct from Engine 3's options-side journal — for recording your own reflections on trading positions. Its own page header states it plainly: 'reflections on your own trading positions. Never places an order.'",
        "The page itself is pure CRUD (create, edit, delete) with no built-in statistics dashboard of its own — Win/Loss analysis and documentation statistics live in the Institutional Trading AI Coach's own Journal and Psychology & Discipline coaches, which read your entries and report real tallies, never a new interpretation of them.",
        "Recording an entry close to when a trade closes, then periodically reviewing it with those coaches, is the platform's actual 'daily review' workflow — built from these two already-shipped pieces working together, not a single dedicated 'Daily Review' feature.",
      ],
      whyItMatters: "Consistent journaling, reviewed with the same discipline for wins and losses, is what makes post-trade review actionable rather than a vague memory — and reviewing real tallies from the AI Coach, rather than trusting your own recollection, is what keeps that review honest.",
      difficulty: "intermediate",
      whyItExists: "A place to record trade reflections already existed on the options side (Journal.tsx) — this Trading Journal adapts that established list/detail/mood-tag pattern for Engine 2's own field set (setup type, entry/exit price, R-multiple, an optional related position) rather than rewriting the pattern from scratch, and is the one page in this section that exposes full CRUD (edit and delete), not just create.",
      institutionalThinking: "A professional reviews wins and losses with the exact same discipline — the Psychology & Discipline Coach enforces this literally, by tallying entries with a positive R-multiple against entries with a negative one using the same counting method for both. A common mistake is journaling losses in detail while barely logging wins, which silently skews any later review toward only the negative lessons.",
      screenWalkthrough: [
        "Page header — states plainly this is Engine 2's own journal and never places an order; 4 outbound links to the Market Structure Workbench, the Liquidity & Session Workbench, the Trade Planning & Risk Studio, and the Institutional Trading AI Coach (scoped to the Journal coach) for reviewing documentation habits.",
        "New Entry form (right, sticky) — Title (required), Mood (Confident/Neutral/Cautious/Frustrated/Excited), Notes (required, free text on what happened and why you entered/exited), Lesson Learned (optional), Related Position (optional — a loose reference to one of your own open Trading Positions by symbol, never enforced), Setup, Entry Price, Exit Price, and an optional R-Multiple.",
        "Entries list (left, main column) — each entry as its own card: title, a color-coded mood badge, a timestamp, Edit and Delete icon buttons.",
        "Entry detail badges — Setup type, Entry $ and Exit $ (when recorded), and an R-multiple badge color-coded green for a positive value and red for a negative one, with an explicit '+' prefix on a non-negative R-multiple so a reader never has to guess the sign.",
        "The Lesson Learned callout — a distinctly bordered, italicized box shown only when a lesson was actually recorded, never a fabricated placeholder when one wasn't.",
        "Editing an entry — replaces the card in place with the same field set pre-filled, with Save Changes / Cancel actions; deleting an entry is immediate.",
        "Honest empty/error states — a genuine load failure shows 'Could not load journal entries — try again later,' and zero entries shows 'No journal entries yet — write your first log using the form,' never a fabricated example entry.",
        "Statistics, Win/Loss analysis, and the AI review workflow — not on this page itself; they live in the Institutional Trading AI Coach's Journal Coach (which entries include a lesson learned, the single most common recorded mood) and Psychology & Discipline Coach (documentation-consistency % and win-count vs. loss-count by R-multiple sign) — both explained in this same Learning Path's own dedicated topics.",
      ],
      workflowSteps: [
        "Open the Trading Journal after closing (or while reviewing) a position.",
        "Write a new entry: a clear title, an honest mood, and full notes on what happened and why.",
        "Record a Lesson Learned whenever one is genuinely worth capturing — for both wins and losses, not only losses.",
        "Fill in Setup, Entry/Exit Price, and R-Multiple when they're known, so later statistics can actually use them.",
        "Optionally link the entry to its Related Position.",
        "Edit an entry later if new information changes your own read of the trade.",
        "Periodically open the Institutional Trading AI Coach's Journal and Psychology & Discipline coaches to review your own real documentation statistics and win/loss tallies — this is the platform's actual daily/periodic review process.",
      ],
      metricsExplained: [
        { term: "R-Multiple", explanation: "An optional, user-entered number expressing a trade's outcome relative to its own initial risk — recorded here as plain data; the Psychology & Discipline Coach later tallies entries by whether this value is positive or negative, never re-deriving it independently." },
        { term: "Mood", explanation: "One of 5 self-reported states (Confident/Neutral/Cautious/Frustrated/Excited) — a plain, user-entered field; the Journal Coach's own 'most common recorded mood' statistic is a literal count over this field, never an inferred sentiment." },
        { term: "Documentation consistency", explanation: "The Psychology & Discipline Coach's own headline statistic: what % of your journal entries record a Lesson Learned — measuring documentation completeness, never a psychological diagnosis." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Consistent journaling across wins and losses, a real periodic review",
          steps: [
            "Entries exist for both winning and losing trades, most with a Lesson Learned filled in.",
            "The Psychology & Discipline Coach reports a high documentation-consistency percentage.",
            "The Journal Coach's most-common-mood tally is reviewed periodically alongside new entries, not just once.",
          ],
          note: "This is the profile that makes post-trade review genuinely actionable — real, honest tallies over consistently-recorded entries, not a memory-dependent guess.",
        },
        {
          label: "Average Opportunity",
          title: "Journaling is consistent, but lessons are mostly skipped",
          steps: [
            "Every closed trade has a title/notes entry, but few include a Lesson Learned.",
            "The Psychology & Discipline Coach honestly reports a low documentation-consistency percentage despite the entries themselves existing.",
          ],
          note: "Recording the trade itself is only half the habit — the Lesson Learned field is what the Psychology & Discipline Coach actually measures, and skipping it consistently shows up honestly in that statistic.",
        },
        {
          label: "Poor Opportunity",
          title: "Only losses get journaled",
          steps: [
            "Entries exist for every losing trade in detail, but winning trades are rarely logged at all.",
            "The Psychology & Discipline Coach's win-count vs. loss-count tally reads a skewed sample, since it can only count what was actually recorded.",
          ],
          note: "A coach can only tally what's actually written down — journaling wins with the same discipline as losses is what keeps that tally an honest reflection of your real trading, not an artifact of selective logging.",
        },
      ],
      commonMistakes: [
        "Expecting a built-in statistics dashboard on the Trading Journal page itself — Win/Loss analysis and documentation stats live in the AI Coach's Journal and Psychology & Discipline panels instead.",
        "Journaling losses in detail while barely recording wins, which skews any later review toward only the negative lessons.",
        "Leaving Lesson Learned blank out of habit — it's the single field the Psychology & Discipline Coach's documentation-consistency statistic actually measures.",
        "Treating the R-Multiple field as automatically calculated — it's a plain, user-entered number, never derived from a broker fill.",
      ],
      riskWarnings: [
        "The Trading Journal never places, modifies, or closes an order — it is a reflection and record-keeping tool only.",
        "The Related Position link is a loose, unenforced reference — deleting the referenced position does not delete or alter the journal entry.",
      ],
      bestPractices: [
        "Journal close to when a trade actually closes, while the reasoning is still fresh.",
        "Record a Lesson Learned for wins as consistently as for losses.",
        "Review the Journal Coach and Psychology & Discipline Coach on a regular cadence, not only after a bad trade.",
      ],
      relatedModuleHrefs: ["/trading-journal", "/trading-ai-coach", "/market-structure-workbench", "/liquidity-workbench", "/trade-planning-studio"],
      aiCoachPrompts: [
        "What % of my journal entries record a lesson learned?",
        "What's my most common recorded mood?",
        "How many of my journaled trades were wins versus losses?",
      ],
      relatedGlossaryKeys: ["trading-journal", "r-multiple"],
      nextStepKeys: ["trading-psychology-discipline"],
      guidedTourRequired: false,
      externalHref: "/trading-journal",
      estimatedMinutes: 7,
      knowledgeCheck: [
        {
          prompt: "Where do Statistics and Win/Loss analysis for the Trading Journal actually live?",
          options: ["A built-in dashboard on the Trading Journal page itself", "The Institutional Trading AI Coach's Journal and Psychology & Discipline coaches", "A separate Statistics page", "They don't exist anywhere on the platform"],
          correctIndex: 1,
          explanation: "The Trading Journal page itself is pure CRUD — real tallies and win/loss analysis are computed by the AI Coach's Journal and Psychology & Discipline panels, reading the same recorded entries.",
        },
        {
          prompt: "What does the Psychology & Discipline Coach's 'documentation consistency' statistic actually measure?",
          options: ["A psychological diagnosis of the trader", "What % of journal entries record a Lesson Learned", "The trader's win rate", "An AI-assigned discipline score"],
          correctIndex: 1,
          explanation: "It's a literal tally of how many entries include a Lesson Learned — measuring documentation completeness, never a subjective psychological read.",
        },
        {
          prompt: "Is the R-Multiple field automatically calculated from a broker fill?",
          options: ["Yes, it's pulled from the broker automatically", "No — it's a plain, optional number the user enters themselves", "Yes, but only for closed positions", "It's calculated from the Mood field"],
          correctIndex: 1,
          explanation: "R-Multiple is a user-entered field, recorded as plain data — the Psychology & Discipline Coach later tallies by its sign, never re-deriving it.",
        },
        {
          prompt: "What is the platform's actual 'daily review process' for the Trading Journal?",
          options: ["A dedicated 'Daily Review' button that doesn't exist", "Writing entries close to when trades close, then periodically consulting the Journal and Psychology & Discipline coaches", "An automatic daily email summary", "Reviewing only losing trades each morning"],
          correctIndex: 1,
          explanation: "There's no single dedicated daily-review feature — the real workflow combines consistent entry-writing with periodic coach consultation, built from already-shipped pieces.",
        },
        {
          prompt: "What is the Related Position field's relationship to the referenced Trading Position?",
          options: ["A strict foreign key that blocks deletion", "A loose, unenforced reference — deleting the position doesn't affect the journal entry", "It automatically syncs the entry's prices", "It's required for every entry"],
          correctIndex: 1,
          explanation: "It's explicitly a loose reference, optional and unenforced — the journal entry is unaffected if the referenced position is later deleted.",
        },
      ],
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

// v1.4.0, Sprint L2A — Interactive Module Guides. A new, twelfth Learning
// Path, scoped to Engine 3 (the Options Income Engine) — the same
// "engine tour" role INSTITUTIONAL_INVESTING_PATH plays for Engine 1 and
// TRADING_ENGINE_PATH plays for Engine 2, filling a genuine gap: Engine 3
// is this platform's original, mature foundation, but until this sprint it
// had no equivalent single "how professional users work this whole
// engine" module guide of its own (FOUNDATIONS/GREEKS/VOLATILITY/
// STRATEGIES/PORTFOLIO/PERFORMANCE/INSTITUTIONAL above are all options
// CONCEPT vocabulary, not a tour of Engine 3's own screens). This path's
// one topic teaches the Trade Execution Center (/trade-execution-center),
// the guided Scanner → AI Score → Strategy → Order Preview → Risk Review →
// Confirm & Submit → Order Status → Monitor & Manage workflow — every
// figure quotes an already-computed, already-tested value from
// execution.ts/optionsMath.ts/risk.ts; this lesson never recomputes or
// modifies any of that protected logic.
const OPTIONS_INCOME_ENGINE_PATH: LearningPath = {
  key: "options-income-engine",
  title: "Options Income Engine",
  description: "How to work the Options Income Engine's own guided Trade Execution Center, from Scanner through Monitor & Manage.",
  glossaryCategory: "strategies",
  topics: [
    topic({
      key: "options-income-engine-overview",
      title: "The Trade Execution Center",
      summary: "Scanner → AI Score → Strategy → Order Preview → Risk Review → Confirm & Submit → Order Status → Monitor & Manage — one guided, 8-step workflow.",
      body: [
        "The Trade Execution Center (/trade-execution-center) is a guided, single-page workflow over the EXISTING Options Income Engine pipeline: 8 steps, a live progress Stepper across the top, and a Paper Trading only badge that never changes — live execution is disabled platform-wide.",
        "Every calculation is reused verbatim from already-shipped, already-tested modules: the Scanner grid, the AI Opportunity Score, the real Order Preview ticket (built on the protected execution engine), Pre-Trade Risk Validation (the same response's own already-computed validation field), and paper order submission through the same broker integration Settings' own Broker Connection card uses. The workflow orchestration itself — which step is active, the risk-acknowledgement gate, stale-preview detection, and a session Activity Timeline — is the only genuinely new logic this page adds; not one dollar figure or risk check is recomputed here.",
        "Who should use it, and when: any time you're moving from 'the Scanner found something interesting' to 'I want to actually place a paper order' — it's the one page that walks that entire decision through every required check in order.",
      ],
      whyItMatters: "Institutions never skip risk validation to chase a good score — walking through every step in order, including the ones that feel like formalities, is what keeps a good-looking opportunity from becoming a badly-sized mistake.",
      difficulty: "intermediate",
      whyItExists: "The Scanner, AI Opportunity Score, Order Preview, Risk Validation, and paper order submission already existed as separate, independently-tested modules — this page adds zero new business logic beyond the step orchestration itself, composing them into one guided flow instead of requiring several separate page visits per trade.",
      institutionalThinking: "Institutions treat a BLOCKED Pre-Trade Risk Validation as a hard 'no,' full stop — a high AI Opportunity Score never overrides a genuinely breached risk cap, since the cap exists precisely to catch the case where a good-looking trade is still a bad idea for THIS portfolio right now. A common retail mistake is jumping straight from 'the score looks great' to submitting, without reading the risk checklist item by item.",
      screenWalkthrough: [
        "Scanner (Opportunity Grid) — Run Scan to refresh candidates; each row shows Symbol, Tier, Strategy, POP (probability of profit), EV (expected value), Ravish Score, and Event Risk; Select moves you to that candidate's own AI Score step.",
        "AI Score — Ravish Score, Tier, POP, and Expected Value as four metric tiles; \"View AI Explanation\" opens a full narrative breakdown of why the candidate scored the way it did.",
        "Strategy — a review step only: the Scanner already assigned one strategy to this candidate, and no strategy re-assignment picker exists, so this step exists to confirm you understand which structure you're about to trade, not to change it.",
        "Order Preview — the real ticket: Net Credit or Debit, Max Profit, Max Loss, Buying Power required, and every individual leg (buy/sell, strike, option type, price); a quantity stepper lets you resize from 1 to 20 contracts, rebuilding the preview each time.",
        "Risk Review (Pre-Trade Risk Validation) — a PASSED/BLOCKED badge, a full checklist of individual pass/fail checks, any warnings, and (if blocked) the specific blocking violations; also shows this trade's own risk % and the portfolio's risk % before and after adding it.",
        "Confirm & Submit — a stale-preview warning if the ticket is more than 60 seconds old (a forced refresh before you can continue), a required risk-acknowledgement checkbox, and the actual \"Submit Paper Order\" action, gated behind a confirmation dialog.",
        "Order Status — the submitted order's ID, broker, and confirmation message.",
        "Monitor & Manage — Position Monitor (live Unrealized P&L, P&L %, days-to-expiry, Delta), Adjust/Close (Roll/Convert, full Position Management, View in Trades), and an Activity Timeline logging every step you actually took this session.",
      ],
      workflowSteps: [
        "Open the Trade Execution Center and run a scan.",
        "Review the Opportunity Grid and pick one candidate to Select.",
        "Review its AI Opportunity Score — Ravish Score, POP, and EV — before trusting the ranking blindly.",
        "Confirm the Scanner's own assigned Strategy.",
        "Review the Order Preview — the real credit/debit, max profit, and max loss for this exact structure.",
        "Review Pre-Trade Risk Validation — a BLOCKED result means don't continue, no matter how good the AI Score looked.",
        "Check broker connectivity before confirming.",
        "Acknowledge the risk disclosure and submit the Paper Trading order.",
        "Confirm the Order Status message and order ID.",
        "Monitor the open position's Unrealized P&L and DTE, and use Position Management or Roll/Convert as conditions change — a trade is a process from entry to exit, not a single decision.",
      ],
      metricsExplained: [
        { term: "Ravish Score", explanation: "This platform's own composite opportunity ranking for a scanned candidate — the same score every other module that ranks a scanner result reuses, never recomputed differently in two places." },
        { term: "POP (Probability of Profit)", explanation: "The modeled probability this specific structure finishes profitable by expiration, computed by the protected options-pricing engine." },
        { term: "EV (Expected Value)", explanation: "The probability-weighted average dollar result for the trade — a positive EV with a high POP is a stronger combination than either figure read alone." },
        { term: "Pre-Trade Risk Validation", explanation: "A PASSED/BLOCKED gate over the same trade-risk-%, portfolio-risk-before/after-%, and buying-power checks the protected risk engine already runs — BLOCKED disables the Continue button entirely, by design." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "High score, clean risk validation",
          steps: [
            "AI Score shows a Ravish Score of 88, POP 78%, and a healthy positive EV.",
            "Risk Review reads PASSED with zero warnings — Trade risk 2% of account, Portfolio risk 22% → 24% after entry, comfortably inside every cap.",
            "The Continue to Confirmation button is enabled with no stale-preview warning.",
          ],
          note: "This is the profile where every step in the workflow clears cleanly — still a Paper Trading order, and still not a guarantee of a profitable outcome, only a well-scored, well-validated one.",
        },
        {
          label: "Average Opportunity",
          title: "Decent score, one real warning to weigh",
          steps: [
            "AI Score shows a Ravish Score of 61, POP 65%, and a modestly positive EV.",
            "Risk Review reads PASSED but with a warning attached (for example, elevated event risk on the underlying) — Trade risk 4%, Portfolio risk 30% → 34% after entry.",
          ],
          note: "PASSED-with-a-warning is a genuinely different situation from PASSED-with-zero-warnings — the warning is real information, not decoration, and is worth reading in full before continuing.",
        },
        {
          label: "Poor Opportunity",
          title: "Low score, BLOCKED risk validation",
          steps: [
            "AI Score shows a Ravish Score of 34, POP 48%, and a negative EV.",
            "Risk Review reads BLOCKED with a listed blocking violation (for example, the portfolio risk budget would be breached by adding this position).",
            "The Continue to Confirmation button is disabled — the workflow itself will not let you proceed past this step.",
          ],
          note: "A BLOCKED result is a hard stop by design, not a suggestion — the workflow enforces this regardless of how the candidate scored on the Scanner or AI Score steps.",
        },
      ],
      commonMistakes: [
        "Submitting because the AI Score looks good, without reading the Risk Review's own checklist item by item.",
        "Ignoring warnings because the badge still reads PASSED — warnings are real information, not decoration.",
        "Letting a preview go stale (older than 60 seconds) and trying to submit anyway without refreshing.",
        "Confusing the Strategy step with a place to change the structure — no such control exists; a different structure means selecting a different Scanner candidate entirely.",
      ],
      riskWarnings: [
        "Every order this workflow can submit is a Paper Trading order — live execution is disabled platform-wide, and no button here ever routes a real order.",
        "A BLOCKED Risk Review is a hard stop — the workflow will not let you continue to Confirm & Submit until it clears, by design.",
        "Max Loss is the worst-case, defined-risk outcome for the structure shown, not a probability-weighted expectation — read it alongside EV and POP, never alone.",
      ],
      bestPractices: [
        "Always read every check in Pre-Trade Risk Validation individually, not just the summary badge.",
        "Re-run the scan periodically rather than acting on an old Opportunity Grid.",
        "Use Monitor & Manage's own Activity Timeline to review exactly what you did this session before repeating it next time.",
      ],
      relatedModuleHrefs: ["/trade-execution-center", "/scanner", "/adjustments", "/learn/paths/institutional-investing", "/learn/paths/trading-engine"],
      aiCoachPrompts: [
        "Explain this Ravish Score.",
        "Why was this trade blocked by risk validation?",
        "Teach me what POP and EV actually mean together.",
        "What mistakes should I avoid before submitting a paper order?",
      ],
      relatedGlossaryKeys: ["probability-of-profit", "expected-value", "iron-condor", "premium", "position-sizing"],
      nextStepKeys: ["portfolio-ai-overview"],
      guidedTourRequired: false,
      externalHref: "/trade-execution-center",
      estimatedMinutes: 9,
    }),
    topic({
      key: "portfolio-ai-overview",
      title: "Portfolio AI (Options Income Cockpit)",
      summary: "Account snapshot, Greeks, 3 health gauges, position threat radar, an AI-streamed market briefing, and Daily Reports you can compare.",
      body: [
        "Portfolio AI (/portfolio-ai) is the options-income cockpit: an Account Snapshot (Account Value, Buying Power, Day P&L, Total P&L, Open Positions, Risk Used), Portfolio Greeks and Theta Income panels, and three 0-100 gauge scores — Portfolio Health, Market Exposure, Risk Concentration — each color-coded by severity.",
        "Below the gauges, a Position Threat Radar lists every open position with a live threat classification (Healthy/Watch/Critical) you can click straight into for adjustment; a Health Trend Panel charts the same health score and threat counts across your saved Daily Reports over 2 weeks, 1 month, 3 months, or all time.",
        "A Market Briefing card streams AI-narrated prose (regime, VIX, IV rank, breadth, catalysts) grounded in already-computed market data, and a Report History panel lets you generate, save, compare (side-by-side deltas between two reports), and restore Daily Reports — every generated report is a snapshot you can look back on later, not a live-updating feed.",
      ],
      whyItMatters: "This is the single screen an options-income trader would open to answer 'is my current book of open positions healthy right now, and what changed since my last review?' — the gauges, the threat radar, and Report Comparison together answer both halves of that question.",
      difficulty: "intermediate",
      whyItExists: "The Options Income Engine already computed Greeks, theta income, and portfolio-level risk elsewhere — Portfolio AI consolidates those into one cockpit with gauge scores and historical comparison, rather than requiring a trader to mentally track health trends across separate page visits.",
      institutionalThinking: "Professional risk desks track health trend over time, not just a single point-in-time snapshot — a Health Score of 70 that's been declining for three reports tells a very different story than a 70 that's been climbing. A common retail mistake is checking only today's gauge and never looking at the Health Trend Panel at all.",
      screenWalkthrough: [
        "Account Snapshot — Account Value, Buying Power, Day P&L, Total P&L, Open Positions, and Risk Used, the top-line figures every other panel builds context around.",
        "Portfolio Greeks and Theta Income panels — net Delta/Gamma/Theta/Vega across every open position, and expected monthly theta income.",
        "Three GaugeCard scores — Portfolio Health, Market Exposure, Risk Concentration, each a 0-100 radial gauge colored by severity (never a plain number with no visual context).",
        "Threat summary pills — Healthy/Watch/Critical position counts, plus net Delta/Theta and the single largest-name exposure, at a glance above the full radar.",
        "Position Threat Radar — every open position, live and clickable, navigating straight to that position's own adjustment ticket.",
        "Health Trend Panel — a windowed (2W/1M/3M/All) chart of health score and red/yellow position counts across your own saved report history.",
        "Market Briefing card — AI-streamed prose plus chips for regime, VIX, IV rank, and breadth, with a catalysts list below.",
        "Report History panel — list, Compare mode (select up to 2 reports for a side-by-side delta view), delete/clear-all with an undo option, and a 'Generate Daily Report' button.",
        "Report Comparison — Key Deltas grid, AI-streamed comparison narration, and a diff list of position/avoid changes between the two selected reports.",
        "Report Detail — Position Snapshot, Top Opportunities, and Trades to Avoid for whichever single report you're viewing.",
      ],
      workflowSteps: [
        "Open Portfolio AI from the sidebar.",
        "Review the Account Snapshot and the three gauge scores first.",
        "Check the Position Threat Radar for anything reading Watch or Critical.",
        "Open the Health Trend Panel and check whether the health score is trending up or down over your chosen window, not just today's value.",
        "Read the Market Briefing card for broader context before deciding whether to act on anything flagged above.",
        "Generate a Daily Report to save today's snapshot for future comparison.",
        "Use Report History's Compare mode against an earlier report to see exactly what changed.",
      ],
      metricsExplained: [
        { term: "Portfolio Health Score", explanation: "A 0-100 gauge score — the same underlying health computation Command Centre's own Portfolio Health section and the Portfolio Risk Dashboard reuse, never a second, competing formula." },
        { term: "Market Exposure / Risk Concentration", explanation: "The two companion gauges alongside Portfolio Health — directional exposure and how concentrated risk is across symbols/sectors, each its own 0-100 score." },
        { term: "Threat classification (Healthy/Watch/Critical)", explanation: "A per-position live severity read, driving both the Position Threat Radar's row coloring and the summary pills' counts above it." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Health improving, no critical threats",
          steps: [
            "Portfolio Health gauge reads 84/100, colored green.",
            "The Health Trend Panel over the last month shows the score climbing, not just holding steady.",
            "The Position Threat Radar shows every position Healthy, zero Watch or Critical.",
          ],
          note: "This is the state where reviewing the Market Briefing and moving on to the Scanner for new opportunities is reasonable, without addressing anything on this page first.",
        },
        {
          label: "Average Opportunity",
          title: "One position moved to Watch",
          steps: [
            "Portfolio Health gauge reads 61/100, colored amber.",
            "The Position Threat Radar shows one position newly flagged Watch (not yet Critical).",
            "The Health Trend Panel shows a slight recent decline from the prior report.",
          ],
          note: "A single Watch-level flag combined with a declining trend is worth reviewing via that position's own adjustment ticket before it potentially becomes Critical.",
        },
        {
          label: "Poor Opportunity",
          title: "Multiple Critical positions and a declining trend",
          steps: [
            "Portfolio Health gauge reads 29/100, colored red.",
            "The Position Threat Radar shows two or more positions flagged Critical.",
            "The Health Trend Panel shows a sustained decline across the last several saved reports, not a one-off dip.",
          ],
          note: "A sustained decline across multiple saved reports, not just one bad day, is the signal that distinguishes a genuine deteriorating trend from ordinary day-to-day noise — this is the profile where reviewing Critical positions comes before anything else.",
        },
      ],
      commonMistakes: [
        "Checking only today's gauge scores and never opening the Health Trend Panel to see the actual trajectory.",
        "Treating the Market Briefing's AI-streamed prose as a market prediction rather than a narrated summary of already-computed conditions.",
        "Forgetting to generate a Daily Report before making changes, losing the ability to compare 'before' against 'after' later.",
      ],
      riskWarnings: [
        "Every gauge and figure here reflects your own current, paper-trading portfolio — never a live prediction of what any position will do next.",
        "A Report Comparison shows what changed between two saved snapshots, not a continuously-updating live feed — refresh by generating a new report, don't assume the last one is still current.",
      ],
      bestPractices: [
        "Generate a Daily Report on a consistent cadence so Report Comparison has meaningful 'before/after' pairs to work with.",
        "Check the Health Trend Panel's trajectory, not just today's single gauge reading, before deciding whether something needs attention.",
        "Click straight from the Position Threat Radar into a flagged position's own adjustment ticket rather than navigating there separately.",
      ],
      relatedModuleHrefs: ["/portfolio-ai", "/institutional-dashboard", "/trade-execution-center", "/adjustments"],
      aiCoachPrompts: [
        "Explain my Portfolio Health Score.",
        "What changed between my last two Daily Reports?",
        "Why is this position flagged Critical?",
      ],
      relatedGlossaryKeys: ["portfolio-health", "concentration", "diversification", "theta-income", "delta", "theta"],
      nextStepKeys: ["trade-execution-order-management"],
      guidedTourRequired: false,
      externalHref: "/portfolio-ai",
      estimatedMinutes: 8,
      knowledgeCheck: [
        {
          prompt: "What are the three gauge scores on Portfolio AI's cockpit?",
          options: ["Delta, Theta, Vega", "Portfolio Health, Market Exposure, Risk Concentration", "POP, EV, Ravish Score", "Account Value, Buying Power, Risk Used"],
          correctIndex: 1,
          explanation: "The three 0-100 radial gauges are Portfolio Health, Market Exposure, and Risk Concentration, each color-coded by severity.",
        },
        {
          prompt: "What does the Health Trend Panel actually show?",
          options: ["A live-updating real-time feed", "The health score and threat counts charted across your own saved Daily Reports over a chosen time window", "A prediction of tomorrow's health score", "A list of broker orders"],
          correctIndex: 1,
          explanation: "It's a windowed (2W/1M/3M/All) chart built from your own saved report history — a trend view, not a live feed or a prediction.",
        },
        {
          prompt: "What happens when you click a position in the Position Threat Radar?",
          options: ["It closes the position immediately", "It navigates you to that position's own adjustment ticket", "It deletes the position from your portfolio", "Nothing — the radar is read-only"],
          correctIndex: 1,
          explanation: "The radar is live and clickable, taking you straight into that specific position's adjustment ticket rather than requiring separate navigation.",
        },
        {
          prompt: "What does Report Comparison's Compare mode let you do?",
          options: ["Compare your portfolio to another user's", "Select up to two saved Daily Reports and see the deltas between them", "Compare your account to a live market index", "Auto-generate a new strategy"],
          correctIndex: 1,
          explanation: "Compare mode lets you pick up to 2 reports from your own history and shows Key Deltas plus an AI-streamed comparison narration between them.",
        },
        {
          prompt: "Is the Market Briefing card's AI-streamed prose a prediction of future market movement?",
          options: ["Yes, it forecasts tomorrow's prices", "No — it's a narrated summary of already-computed market conditions", "Yes, but only for the VIX", "It only applies to live accounts"],
          correctIndex: 1,
          explanation: "The Market Briefing narrates already-computed regime/VIX/IV rank/breadth data — it never predicts future price movement.",
        },
      ],
    }),
    // v1.4.0, Sprint L2C — Trading Workflow Academy. A deliberate, deeper
    // companion to options-income-engine-overview above — that topic
    // already tours all 8 steps of the Trade Execution Center at a
    // summary level; this one deep-dives specifically into the order
    // ticket's own mechanics, position sizing, risk math, and closing a
    // position, rather than restating the 8-step tour.
    topic({
      key: "trade-execution-order-management",
      title: "Order Tickets, Position Sizing & Closing a Position",
      summary: "A deeper look at the Order Preview ticket, the quantity stepper, Pre-Trade Risk Validation's own math, and how a position actually gets closed.",
      body: [
        "This lesson goes deeper than The Trade Execution Center's own overview lesson into 4 specific mechanics: reading the real order ticket leg by leg, resizing a position with the quantity stepper, understanding exactly what Pre-Trade Risk Validation computes, and how a position is actually closed once it's open.",
        "This platform's defined-risk options structures (iron condors, credit/debit spreads) do not use a separate broker-side stop-loss or take-profit order the way a single-share stock trade would — the structure's own selected strikes already define its Max Profit and Max Loss boundaries at entry. Closing early, before expiration, happens through Roll/Convert or manual Position Management, not through an automatically-triggered stop or target order.",
        "Every figure described here is read directly from the same already-computed ticket and validation response the Order Preview and Risk Review steps already show — this lesson adds no new calculation of its own, only a closer reading of what's already on screen.",
      ],
      whyItMatters: "Knowing exactly what each ticket line and risk check represents — rather than skimming past them — is what turns 'the numbers looked fine' into an actual, defensible pre-trade review.",
      difficulty: "intermediate",
      whyItExists: "The Order Preview ticket and Pre-Trade Risk Validation checklist already existed as dense, information-rich panels within the guided workflow — this lesson exists to slow down and explain what each individual field and check actually means, since a first-time user skimming past a wall of numbers is a real, common failure mode this platform's own risk discipline depends on avoiding.",
      institutionalThinking: "A professional never treats Max Loss as an abstract number on a tile — they read it alongside the risk-acknowledgement checkbox's own exact wording (the real dollar amount and the real % of account) before ever clicking Submit. A common mistake is glancing at Net Credit alone, since it's the greenest, most inviting number on the ticket, while skipping Max Loss entirely.",
      screenWalkthrough: [
        "Order ticket header — symbol, strategy badge, and the quantity stepper (− / count / +), bounded between 1 and 20 contracts; every click rebuilds the entire ticket fresh from the real pricing engine, never a client-side multiplication of the original numbers.",
        "The 4 metric tiles — Net Credit or Net Debit (color-coded green for credit, amber for debit), Max Profit, Max Loss, and Buying Power Required — each a genuinely recomputed figure for the current quantity, not a static estimate.",
        "The leg-by-leg breakdown — every individual option leg shown as BUY or SELL (color-coded), its ratio quantity, strike, option type, and price — the literal structure you're about to trade, not a summary.",
        "Pre-Trade Risk Validation's checklist — each individual check shown pass/fail with its own label and detail sentence, never just a single pass/fail summary.",
        "Warnings (amber box) — real, non-blocking cautions attached to an otherwise-PASSED validation; a warning is genuine information, not decoration, and reading it is part of the review, not optional.",
        "Blocking violations (red box) — shown only when validation reads BLOCKED, listing the specific reason(s) the Continue button is disabled.",
        "Trade risk % and portfolio risk before → after % — the exact dollar-risk-as-percentage-of-account figures the risk engine computed for this specific trade and for the whole portfolio if it's added.",
        "Broker connectivity check — a manual 'Check Connection' button reading Connected (Paper) or Not connected from the last check you ran, never auto-polled.",
        "The stale-preview guard — a preview older than 60 seconds is flagged and must be refreshed before you can continue, since options quotes move and an old ticket shouldn't be used to place a new order.",
        "The risk-acknowledgement checkbox — its own exact wording states the real Max Loss dollar amount and the real % of account risked, and must be checked before Submit becomes available.",
        "Submit is disabled whenever any of: the ticket itself says it can't be submitted, the risk box isn't checked, the preview is stale, the broker isn't connected, a submission is already in flight, or one was already sent this session — a real, multi-condition gate, not a single check.",
        "Position Monitor (Monitor & Manage step) — live Unrealized P&L (color-coded), P&L %, days-to-expiry, and Delta for the position this session opened.",
        "Adjust/Close actions — Roll/Convert (opens the position's own adjustment ticket), Position Management (the full adjustments page), and View in Trades — three distinct paths, none of them an automatic stop/target trigger.",
        "Activity Timeline — every action actually taken this session, timestamped, so a review afterward doesn't rely on memory.",
      ],
      workflowSteps: [
        "Once a candidate is selected, build or refresh the Order Preview.",
        "Read every leg in the leg-by-leg breakdown, not just the summary tiles.",
        "Use the quantity stepper to size the position, watching how Max Profit/Max Loss/Buying Power all rescale with it.",
        "Review Pre-Trade Risk Validation's checklist item by item, including any warnings, before treating a PASSED badge as sufficient on its own.",
        "Note the trade risk % and portfolio risk before→after % — this is the real, current-portfolio-specific risk, not a generic estimate.",
        "Check broker connectivity before attempting to submit.",
        "If the preview has gone stale, refresh it — don't submit against old numbers.",
        "Read the risk-acknowledgement checkbox's own wording in full before checking it.",
        "After submission, use Position Monitor to track the open position's live P&L and days-to-expiry.",
        "Choose the correct closing path deliberately — Roll/Convert for an adjustment, Position Management for broader position handling, or View in Trades for the trade record itself.",
      ],
      metricsExplained: [
        { term: "Max Loss / Max Profit", explanation: "The defined-risk boundaries baked into the structure's own selected strikes at entry — this platform's functional equivalent of a stop/target for a credit or debit spread, since the risk is capped by construction rather than by a separate order." },
        { term: "Trade risk % / Portfolio risk before→after %", explanation: "The dollar risk of this one trade, and the whole portfolio's aggregate risk before and after adding it, both expressed as a % of account — read from the same Pre-Trade Risk Validation response, never recomputed independently on this page." },
        { term: "Stale preview", explanation: "A ticket built more than 60 seconds ago — options quotes move, so a stale ticket is forced to refresh before it can be used to submit, a real data-freshness guard, not decoration." },
        { term: "Buying Power Required", explanation: "The capital this specific structure and quantity would tie up if submitted — rescales with the quantity stepper exactly like Max Profit and Max Loss." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Clean ticket, PASSED with zero warnings, timely submission",
          steps: [
            "The leg-by-leg breakdown shows a standard 4-leg iron condor, quantity 2.",
            "Pre-Trade Risk Validation reads PASSED with zero warnings; trade risk 2%, portfolio risk 22% → 24%.",
            "The preview is fresh (under 60 seconds old), broker reads Connected (Paper), and the risk-acknowledgement box is checked after reading its full wording.",
          ],
          note: "This is the profile where every gate in the workflow clears cleanly and on time — still a Paper Trading order, and still not a guarantee of profit, only a well-reviewed submission.",
        },
        {
          label: "Average Opportunity",
          title: "PASSED with a real warning, quantity resized mid-review",
          steps: [
            "The user resizes from 1 to 3 contracts using the stepper; Max Loss and Buying Power both scale up accordingly.",
            "Pre-Trade Risk Validation reads PASSED but with a warning attached (e.g. elevated event risk on the underlying).",
            "Portfolio risk moves from 28% → 33% after entry — inside caps, but a real, larger jump than a 1-contract order would have caused.",
          ],
          note: "Resizing the position changes the real risk picture, not just the tiles' cosmetic numbers — reviewing the risk section again after resizing, not just before, is the disciplined move here.",
        },
        {
          label: "Poor Opportunity",
          title: "Stale preview, broker not connected, BLOCKED validation",
          steps: [
            "The preview is flagged stale (built more than 60 seconds ago) and hasn't been refreshed.",
            "The broker connectivity check hasn't been run this session — status reads 'Not checked.'",
            "Pre-Trade Risk Validation reads BLOCKED with a listed blocking violation (e.g. the portfolio risk budget would be breached).",
          ],
          note: "Submit is disabled by all three of these conditions independently — a BLOCKED validation alone is a hard stop, and it's compounded here by a stale preview and an unverified broker connection.",
        },
      ],
      commonMistakes: [
        "Reading only the Net Credit/Debit tile and skipping Max Loss, since it's the least visually inviting number on the ticket.",
        "Expecting a separate stop-loss/take-profit order type — this platform's defined-risk structures encode Max Profit/Max Loss into the structure itself; closing early happens via Roll/Convert or Position Management, never an automatic trigger.",
        "Resizing the quantity stepper without re-reading the risk section afterward, since the risk figures genuinely change with size.",
        "Trying to submit against a stale preview instead of refreshing it first.",
      ],
      riskWarnings: [
        "Every order this workflow can submit is a Paper Trading order — live execution is disabled platform-wide, and no button here ever routes a real order.",
        "A BLOCKED Pre-Trade Risk Validation is a hard stop by design — the workflow will not let you continue past it regardless of how attractive the ticket otherwise looks.",
      ],
      bestPractices: [
        "Read every leg in the ticket individually, not just the summary tiles.",
        "Re-check the risk section any time you resize the quantity — the figures genuinely change.",
        "Never submit against a stale preview — refresh first, every time.",
        "Choose the correct Adjust/Close path deliberately (Roll/Convert vs. Position Management vs. View in Trades) rather than defaulting to whichever is most familiar.",
      ],
      relatedModuleHrefs: ["/trade-execution-center", "/adjustments", "/trades", "/learn/paths/options-income-engine"],
      aiCoachPrompts: [
        "Explain every line in this order ticket.",
        "Why did my portfolio risk jump when I resized the position?",
        "What's the difference between Roll/Convert and Position Management?",
      ],
      relatedGlossaryKeys: ["probability-of-profit", "expected-value", "position-sizing", "buying-power"],
      nextStepKeys: ["options-scanner-watchlists"],
      guidedTourRequired: false,
      externalHref: "/trade-execution-center",
      estimatedMinutes: 9,
      knowledgeCheck: [
        {
          prompt: "How does this platform's options structures implement the equivalent of a stop-loss/take-profit?",
          options: ["A separate broker-side stop and limit order", "Max Loss/Max Profit boundaries baked into the structure's own selected strikes at entry", "An automated AI-triggered close", "There is no risk boundary at all"],
          correctIndex: 1,
          explanation: "Defined-risk structures like iron condors cap risk by construction — the strikes themselves set Max Loss/Max Profit, not a separate stop/limit order.",
        },
        {
          prompt: "What happens when you use the quantity stepper to resize a position?",
          options: ["Only the displayed number changes, the risk stays the same", "The entire ticket is rebuilt fresh from the pricing engine, rescaling Max Profit/Max Loss/Buying Power", "It requires a full page reload", "It's disabled after the first preview"],
          correctIndex: 1,
          explanation: "Each stepper click rebuilds the real ticket, never a client-side multiplication — Max Profit, Max Loss, and Buying Power all genuinely rescale.",
        },
        {
          prompt: "What does a 'stale preview' warning mean?",
          options: ["The internet connection dropped", "The ticket was built more than 60 seconds ago and should be refreshed before submitting", "The broker rejected the order", "The strategy is no longer available"],
          correctIndex: 1,
          explanation: "Options quotes move — a preview older than 60 seconds is flagged and must be refreshed before you're allowed to continue to submission.",
        },
        {
          prompt: "What are the closing/management options once a position is open?",
          options: ["Only a single 'Close' button", "Roll/Convert, Position Management, or View in Trades — three distinct paths, no automatic trigger", "An automatic stop-loss that fires on its own", "The position closes itself at expiration only"],
          correctIndex: 1,
          explanation: "Adjust/Close offers Roll/Convert (the position's own adjustment ticket), Position Management (the full adjustments page), and View in Trades — all manual, deliberate actions.",
        },
        {
          prompt: "What must be true for the Submit button to be enabled?",
          options: ["Just a positive Ravish Score", "The ticket allows submission, risk is acknowledged, the preview isn't stale, the broker is connected, and no submission is already in flight", "Only that the risk box is checked", "Nothing — it's always enabled once a ticket exists"],
          correctIndex: 1,
          explanation: "Submit is gated by a real multi-condition check: canSubmit, risk acknowledgement, freshness, broker connectivity, and no duplicate/in-flight submission.",
        },
      ],
    }),
    topic({
      key: "options-scanner-watchlists",
      title: "Market Scanner & Watchlists",
      summary: "Scan the universe, star what matters, and manage named watchlists across every engine you use.",
      body: [
        "The Market Scanner (/scanner) runs the options-income scanning engine against the platform's known symbol universe on demand — pick a Strategy filter (All Strategies, Iron Condor, Iron Fly, Calendar Spread, or Earnings) and press Run Scan; there is no second filter control (no DTE/delta/credit/POP/IV/sector box) — Strategy is the only scan parameter this page exposes.",
        "Results are a persisted, ranked table (Symbol, Tier, Strategy, DTE, Credit, POP, EV, Score, Event Risk) sorted by the same Ravish Score every other opportunity-ranking surface in this platform reuses — never a second, competing ranking. Each row has three actions: Explain with AI Coach, open the AI Trading Coach focused on that candidate, or Review (which opens the Trade Ticket for that candidate).",
        "Watchlists exist as two genuinely separate systems in this platform, and this lesson covers both honestly rather than treating them as one thing: a single flat Value Watchlist (one implicit list per user, no naming), and the Institutional Watchlists & Opportunity Dashboard (/watchlists-engine) — real, named, multiple watchlists per user, each independently manageable.",
      ],
      whyItMatters: "A scanner surfaces candidates; a watchlist is where you track ones you're not ready to act on yet. Knowing which watchlist system you're actually in (the one flat list, or a named list on the Watchlists Engine) prevents the confusing experience of starring a symbol from one screen and not finding it where you expected.",
      difficulty: "beginner",
      whyItExists: "The Scanner reuses the existing options-income scanning/ranking engine unchanged — this lesson introduces zero new scoring logic, only the workflow of running it and acting on its output. The Watchlists Engine likewise reuses the Risk & Exposure, Performance, Scenario, Decision Support, and Compliance engines' own already-computed figures for its Dashboard and Opportunity Overview tabs — it computes nothing new of its own beyond CRUD for named lists.",
      institutionalThinking: "A professional keeps a working list separate from an active search — the Scanner answers 'what looks interesting right now,' a watchlist answers 'what am I tracking over time.' A common mistake is treating the Scanner's own ranked table as a persistent watchlist — it isn't; running a new scan replaces your prior results for that user, it doesn't add to a saved list.",
      screenWalkthrough: [
        "Market Scanner (/scanner) — a single Strategy `<Select>` (All Strategies / Iron Condor / Iron Fly / Calendar Spread / Earnings) and a Run Scan button; the Ranked Opportunities table below shows Symbol, Tier badge, Strategy, DTE, Credit, POP, EV, Score, and Event Risk, with Explain/Coach/Review actions per row.",
        "Stock Scanner (/stock-analyst/scanner) — a related but separate screen: 7 single-select filter chips (All, Best long-term stocks, Undervalued, Wonderful business — wait for pullback, Good for options income, Good for both, Avoid / too risky) applied client-side to an already-fetched universe, plus 3 sort buttons (Stock score, Options score, Margin of safety), row checkboxes, a bulk 'Add to Watchlist (N)' button, and a 'Compare (N)' button that opens a side-by-side comparison dialog.",
        "Value Watchlist tab (inside Stock Research, /stock-analyst) — the flat, one-list-per-user system: a 'Check Targets' button (an explicit, opt-in action — target checking is never automatic), a list of your watchlisted symbols, and a Remove button per row. Symbols land here from the Star button on Stock Research's own report, from Stock Scanner's Add to Watchlist, and from Opportunity Discovery's per-row Watchlist button — all three write to this same one list.",
        "Watchlists & Opportunity Dashboard tab (/watchlists-engine) — Dashboard Summary (watchlist count, watched symbols, held-somewhere count, policy breaches), a Highest Risk/Exposure/Allocation card, an Outstanding Issues card, a Watchlist Health card (per-watchlist held/item/breach counts and market value), and a Cross-Engine Summary card — every figure here is a direct reuse of an already-computed engine score, never a new calculation.",
        "Manage Watchlists tab — a New Watchlist form (Name, Kind: Personal or Institutional, Create button — the page's own copy states plainly 'nothing is ever auto-created'), a Personal Watchlists panel and an Institutional Watchlists panel side by side (each row: name, item count, Archive/Unarchive, Delete), and a detail panel per selected watchlist with an Add Symbol form (Symbol, Category, Tags, Notes) and a per-item list with an editable Notes field and a Remove button.",
        "Opportunity Overview tab — per distinct watched symbol across every one of your watchlists: whether it's held in Investing, Trading, or Options, its market value/weight, open position counts, worst-case scenario impact, and a compliance status badge — explicitly documented as monitoring only, 'never a ranked or scored opportunity signal.'",
        "Coach & Learning tab and Reporting tab — deterministic topic explanations plus links out to existing Learning Centre lessons ('no duplicated content,' the page's own words), and report links into the Reporting Centre — no new AI narration or reporting logic lives on this page.",
        "Opportunity Discovery (/opportunity-discovery) — the ONE screen in the platform that actually supports saving a scan: fill in the Screener panel's real filters (Symbols, Sector, Min ROIC %, Min Rev Growth %, Min Dividend Yield %, Min Margin of Safety %, Min Business Quality), optionally check 'Watchlist-aware,' then type a name into 'Save this screen as…' and press Save Screen — it appears afterward in the Saved Screens tab with Apply (re-populate the filters) and Delete actions.",
      ],
      workflowSteps: [
        "Open the Market Scanner and pick a Strategy filter (or leave it at All Strategies).",
        "Press Run Scan — this replaces your prior results for that strategy filter with a fresh, ranked batch.",
        "Review the table; ask the AI Coach to explain any row you don't immediately understand, or press Review to open its Trade Ticket.",
        "If a candidate isn't ready to act on yet, don't try to save it from this page — instead open Stock Research or Stock Scanner for that symbol and use its Star / Add-to-Watchlist action, which writes to the one flat Value Watchlist.",
        "Separately, if you want a NAMED, organized set of watchlists (e.g. one for core holdings, one for speculative ideas), use Watchlists & Opportunity Dashboard's Manage Watchlists tab to create one, then add symbols to it directly.",
        "Periodically open the Value Watchlist tab and press Check Targets to see if any desired buy price or margin-of-safety target has actually crossed — never assume it's checked automatically.",
        "If you have a recurring, multi-filter screening routine, build it once on Opportunity Discovery and Save it as a named screen so you can Apply it again next time instead of re-entering every filter.",
      ],
      metricsExplained: [
        { term: "Ravish Score", explanation: "The single ranking score the Market Scanner's own table sorts by — the same score every other opportunity-ranking surface in the options-income engine reuses, never a second competing score." },
        { term: "Tier", explanation: "A categorical read of a scanner result's own quality (e.g. elite, high_conviction, good) — a classification of the same underlying score, not a separate metric." },
        { term: "Price Target Crossed / Margin-of-Safety Target Crossed", explanation: "Two honest, opt-in checks on the Value Watchlist — both are null (never fabricated) unless the corresponding target was actually set and a fresh price genuinely crossed it." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A clean scan-to-watchlist-to-review workflow",
          steps: [
            "Run the Scanner with Strategy set to Iron Condor; a high-Tier row appears with a strong Ravish Score.",
            "Not ready to enter today — open Stock Research for that symbol and Star it onto the Value Watchlist.",
            "A week later, press Check Targets and see the price has moved toward your desired buy price.",
            "Return to the Scanner, re-run it, and if the candidate still ranks well, press Review to open its Trade Ticket.",
          ],
          note: "The Scanner and the Watchlist are used for two different jobs here — surfacing and tracking — exactly as designed.",
        },
        {
          label: "Average Opportunity",
          title: "Using Stock Scanner's filter chips before committing to a watchlist",
          steps: [
            "Open Stock Scanner and select the 'Good for both' filter chip to narrow the already-fetched universe.",
            "Check 3-4 rows, then press Compare (3) to see them side by side on the same dimensions.",
            "Bulk-add the 2 strongest to the Value Watchlist via 'Add to Watchlist (2)' rather than adding them one at a time.",
          ],
          note: "Stock Scanner's filters are entirely client-side over an already-fetched universe — there is no server-side query being built, so this is fast but only as current as the last universe fetch.",
        },
        {
          label: "Poor Opportunity",
          title: "Expecting the Scanner itself to remember a saved search",
          steps: [
            "A user picks the Iron Condor filter, runs a scan, and expects to come back tomorrow and find the exact same filtered view waiting.",
            "Instead, running the scan again with the same filter simply produces a fresh batch of current results — nothing about a prior run is 'saved' as a named search on this page.",
          ],
          note: "This is exactly the honest gap this lesson calls out: only Opportunity Discovery has a real Save Screen feature. The Market Scanner and Stock Scanner have no saved-search concept at all.",
        },
      ],
      commonMistakes: [
        "Expecting the Market Scanner or Stock Scanner to have a 'save this scan' button — neither does; only Opportunity Discovery's Saved Screens feature exists for that.",
        "Confusing the one flat Value Watchlist with the Watchlists & Opportunity Dashboard's named, multiple watchlists — they are two separate systems backed by different tables, and a symbol added to one does not appear in the other.",
        "Assuming Check Targets runs automatically — it's an explicit, opt-in button; the Value Watchlist never silently checks prices in the background.",
        "Treating Compare mode's or a Tier badge's ranking as investment advice rather than a relative reading among the symbols currently on screen.",
      ],
      riskWarnings: [
        "The Market Scanner is for education and research only — it never executes, sizes, or recommends placing a trade on its own; every action still routes through the real Trade Ticket's own risk checks.",
        "A watchlist symbol with no target set will never show a crossed-target alert — the absence of an alert does not mean the price hasn't moved, only that no target was configured to catch it.",
      ],
      bestPractices: [
        "Use the flat Value Watchlist for quick, single-symbol tracking; use the Watchlists & Opportunity Dashboard's named lists when you want organized, multi-symbol groups with notes and tags.",
        "Build recurring, multi-filter screens on Opportunity Discovery and Save them rather than re-entering the same filters by memory each time.",
        "Re-run the Scanner rather than trusting yesterday's results — every run replaces your prior batch with a fresh, current one.",
      ],
      relatedModuleHrefs: ["/scanner", "/stock-analyst/scanner", "/watchlists-engine", "/opportunity-discovery", "/stock-analyst", "/learn/paths/institutional-investing"],
      aiCoachPrompts: [
        "Explain this scanner result.",
        "What's the difference between the flat Value Watchlist and a named watchlist on the Watchlists Engine?",
        "Why doesn't the Market Scanner let me save a search?",
        "What does a crossed margin-of-safety target actually mean?",
      ],
      relatedGlossaryKeys: ["screener", "watchlist-and-opportunity-triggers", "opportunity-buckets", "opportunity-ranking"],
      nextStepKeys: [],
      guidedTourRequired: false,
      externalHref: "/scanner",
      estimatedMinutes: 10,
      knowledgeCheck: [
        {
          prompt: "What is the only real filter control on the Market Scanner (/scanner) page itself?",
          options: ["DTE and delta range sliders", "A single Strategy dropdown (All Strategies / Iron Condor / Iron Fly / Calendar Spread / Earnings)", "A free-text symbol search box", "A minimum credit input"],
          correctIndex: 1,
          explanation: "The Market Scanner exposes exactly one filter — Strategy — and a Run Scan button. There is no DTE, delta, credit, POP, IV, or sector control on this page.",
        },
        {
          prompt: "Which page actually supports saving a named, reusable scan/screen?",
          options: ["The Market Scanner (/scanner)", "The Stock Scanner (/stock-analyst/scanner)", "Opportunity Discovery (/opportunity-discovery)", "The Watchlists & Opportunity Dashboard"],
          correctIndex: 2,
          explanation: "Only Opportunity Discovery has a real Save Screen / Saved Screens feature with Apply and Delete actions. Neither scanner page, nor the Watchlists Engine, has anything like it.",
        },
        {
          prompt: "How many named watchlists can a user create on the Watchlists & Opportunity Dashboard (/watchlists-engine)?",
          options: ["Exactly one, matching the flat Value Watchlist", "Zero — it's read-only", "As many as they want, each independently named, managed, and archivable", "A fixed maximum of 3"],
          correctIndex: 2,
          explanation: "This is genuinely multiple, named watchlists per user (Personal or Institutional kind), each with its own items, notes, and archive/delete actions — distinct from the flat, single Value Watchlist.",
        },
        {
          prompt: "Does the Value Watchlist automatically check whether a price target has been crossed?",
          options: ["Yes, every 5 minutes in the background", "No — Check Targets is an explicit, opt-in button the user must press", "Yes, but only during market hours", "Only if the symbol also appears on a scanner result"],
          correctIndex: 1,
          explanation: "Target checking is deliberately opt-in — pressing Check Targets is the only way this data resolves; it is never computed silently in the background.",
        },
        {
          prompt: "Does adding a symbol to the flat Value Watchlist also add it to a named watchlist on the Watchlists & Opportunity Dashboard?",
          options: ["Yes, they're the same underlying list", "No — they are two separate systems backed by different tables; a symbol in one does not automatically appear in the other", "Only for Institutional-kind watchlists", "Only if Watchlist-aware is checked on Opportunity Discovery"],
          correctIndex: 1,
          explanation: "These are genuinely separate systems. The flat Value Watchlist (one implicit list) and the Watchlists Engine's named, multiple lists do not share data.",
        },
      ],
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
      title: "Strategy Builder: Create, Manage & Apply Your Own Strategies",
      summary: "Register your own methodology's metadata, apply it through the Checklist Engine, compare strategies, and consult the deterministic Strategy Coach — never a rule engine, backtester, or signal generator.",
      body: [
        "In this platform, a 'Strategy' is a METADATA record you author yourself across two pages: the Strategy Framework (/strategy-framework, where you create and register a strategy) and the Strategy Workbench (/strategy-workbench, where you browse, apply, compare, and manage the ones you've already registered).",
        "The platform never implements, evaluates, or judges the methodology you name — no named real-world methodology (ICT, SMC, ASAD, Trader Bill, Tom Nash, or any 'Dunni Framework') is ever authored by this codebase, and it never generates a trading signal, predicts a price, or recommends buying or selling. It only stores the shape you give your own strategy and helps you apply it consistently.",
        "Two things this Strategy Builder deliberately does NOT do, honestly disclosed rather than glossed over: it has no 'Run Strategy' automation or backtesting engine — a strategy is 'applied' by manually working through its own checklist against real evidence, not by an automated process — and it has no AI parameter-optimisation feature; the closest real capability is the deterministic Strategy Coach, which explains your own already-authored data, never tunes it.",
      ],
      whyItMatters: "Formalizing your own rules as structured, versioned metadata — rather than relying on memory — is a basic institutional discipline, independent of what those rules actually say; and being honest about what this tool doesn't do (auto-run, backtest, optimise) is what keeps it a discipline framework rather than a false promise of automation.",
      difficulty: "intermediate",
      whyItExists: "A structured way to register your own methodology, apply it consistently via a real checklist, and compare strategies side by side didn't exist before — this feature composes new metadata storage (Phase 30) with an orchestration workbench (Phase 31) built on top of it, reusing the same Evidence/Checklist/Learning/Coach panels in both places rather than duplicating them.",
      institutionalThinking: "A professional treats their own trading rules as a versioned, checklist-backed discipline — not a memorized feeling — and is honest with themselves about which parts of their process are genuinely systematic versus which are simply not automated yet. A common mistake is expecting this tool to 'run' a strategy or optimise it the way a backtesting platform would; it deliberately doesn't, since it's a discipline and documentation framework, not a signal generator.",
      screenWalkthrough: [
        "Creating a strategy (Strategy Framework, 'New Strategy') — Name, Description, Category (a generic structural label: Trend/Reversal/Breakout/Range/Scalping/Swing/Position/Other, never a named real-world methodology), Timeframes and Markets (free text), Required Evidence (toggle buttons over Structure/Liquidity/Sessions/Risk/Trade Plans/Journal/AI Coach — which existing engine outputs YOU decide are relevant), a Checklist (one item per line, marked required or optional), Educational Notes, and References.",
        "Saving a strategy — the 'Register Strategy' button (disabled until Name and Description are filled in); once registered, it appears in the Strategy Registry as a real, persisted record with its own version number.",
        "Applying (\"running\") a strategy — there is no automated execution; a strategy's own checklist template is instantiated into a real Checklist instance every time you use it, and you manually mark REQUIRED items complete against your own evidence review via the Checklist Review Panel. A checklist only reads 'complete' once every required item is checked — optional items never block it, and an empty checklist is never fabricated as complete.",
        "Strategy management (Strategy Framework's Registry, and the Strategy Workbench's Browser) — a list of your own registered strategies; select one to view its full detail (validation summary, evidence requirements, checklist, learning panel, and Strategy Coach), or delete it.",
        "The Strategy Workbench (/strategy-workbench) — the orchestration layer over the Framework: a Strategy Browser (select to open in the Workspace; check to add to Comparison), a Workspace showing the active strategy's full detail plus its own Strategy Notes (free-text, reusing the existing Trade Workspace notes system), a Strategy Comparison table (2+ strategies compared on metadata only — category, markets, timeframes, required-evidence count, checklist size, references, version, and Learning Coverage — never performance, never a ranking), a Strategy Report Viewer (reuses the Reporting Centre's own Strategy Framework Summary report), and Save Workspace (a named layout of your active strategy + comparison set, saved only in your own browser's localStorage, no server persistence).",
        "The Strategy Coach — the closest thing to 'AI optimisation' this feature has, and it deliberately isn't one: it explains your own strategy's metadata and your checklist's own completion state, quoting the real completion calculation directly. It explicitly states that 100% checklist completion means the checklist was filled out, not that any market condition is favorable, and it never evaluates whether your methodology itself is sound.",
        "Guided Learning Mode and Progress Tracker (bottom of the Strategy Framework page) — links into this very Learning Path's own remaining topics (Categories & Evidence, the Checklist Engine, and the Strategy Coach, each covering its own area in full depth) with completion checkmarks and your path-completion percentage.",
      ],
      workflowSteps: [
        "Register a new strategy in the Strategy Framework: name, description, category, timeframes, markets, required evidence, and a checklist.",
        "Save it via 'Register Strategy.'",
        "Open the Strategy Workbench and select your strategy in the Strategy Browser.",
        "Review its metadata, required evidence, and checklist in the Workspace.",
        "Work through the checklist, marking required items done as you genuinely review the relevant evidence.",
        "Record a Strategy Note capturing your own reasoning for this review session.",
        "Select a second strategy's checkbox to add it to Comparison, and review the metadata table side by side.",
        "Consult the Strategy Coach for an explanation of your strategy's metadata and checklist state.",
        "Save your active strategy + comparison selection as a named Workspace layout for next time.",
      ],
      metricsExplained: [
        { term: "Checklist Completion", explanation: "True only once every REQUIRED item on a strategy's own checklist instance is marked done — optional items never count against it, and it's never fabricated as complete for an empty or partially-filled checklist." },
        { term: "Required Evidence", explanation: "The existing engine outputs (Structure, Liquidity, Sessions, Risk, Trade Plans, Journal, AI Coach) your own strategy's author decided are relevant — the platform surfaces this decision, it never verifies or second-guesses it." },
        { term: "Learning Coverage (Comparison table)", explanation: "Whether you've already viewed this strategy's own Learning Panel content — 'viewed' or 'not yet viewed,' a simple honest flag, never a proficiency score." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A fully-registered strategy, checklist complete, notes recorded",
          steps: [
            "A strategy is registered with a clear name, description, 3 required-evidence sources, and a 4-item checklist.",
            "The Checklist Review Panel shows all required items checked, reading 'complete.'",
            "A Strategy Note documents which evidence was actually reviewed this session.",
          ],
          note: "This is the profile of genuine, documented discipline — a real record of what was checked and why, not a memory-dependent habit.",
        },
        {
          label: "Average Opportunity",
          title: "Registered, but the checklist is only partially worked through",
          steps: [
            "A strategy is registered with a 5-item checklist, 3 required.",
            "Only 2 of the 3 required items are checked — the Checklist Review Panel honestly reads incomplete, never rounding up.",
            "The Strategy Coach, asked to explain readiness, states plainly that the checklist isn't yet complete.",
          ],
          note: "An honestly-incomplete checklist is a real, useful signal to slow down — the platform never inflates a partial review into a false 'ready' state.",
        },
        {
          label: "Poor Opportunity",
          title: "Expecting automated execution or optimisation that doesn't exist",
          steps: [
            "A user registers a strategy and looks for a 'Run' or 'Backtest' button — none exists, by design.",
            "The user asks the Strategy Coach to 'optimise my checklist for better performance' — the Coach can only explain what's already there, never tune parameters or evaluate the methodology's own soundness.",
          ],
          note: "This is the exact expectation gap worth understanding up front: this feature is a discipline and documentation framework, never a signal generator, backtester, or optimiser — knowing that avoids a genuinely confusing first session.",
        },
      ],
      commonMistakes: [
        "Expecting a 'Run Strategy' button or automated backtesting — neither exists; a strategy is applied by manually working through its own checklist.",
        "Expecting the Strategy Coach to optimise parameters or evaluate whether the methodology itself is sound — it only explains your own already-authored metadata and checklist state.",
        "Treating 100% checklist completion as a market signal — it means the checklist was filled out, nothing about current market conditions.",
        "Using Strategy Comparison's table to rank strategies by 'performance' — it compares metadata only (category, evidence, checklist size, version), never a performance figure, since none is tracked.",
      ],
      riskWarnings: [
        "No strategy registered here ever generates a trading signal, predicts a price, or recommends a trade — it is a metadata and discipline framework only.",
        "Save Workspace persists only in your own browser's localStorage — clearing site data or switching browsers loses any unsaved layout.",
      ],
      bestPractices: [
        "Name your own strategy and its checklist items specifically enough that a future you (or a future review) understands exactly what was checked.",
        "Record a Strategy Note at the time you work through a checklist, not from memory afterward.",
        "Use Comparison's metadata table to see structural differences between strategies, never as a performance ranking.",
      ],
      relatedModuleHrefs: ["/strategy-framework", "/strategy-workbench", "/reporting-centre", "/trading-ai-coach", "/learn/paths/strategy-framework"],
      aiCoachPrompts: [
        "Explain my strategy's checklist completion state.",
        "What required evidence did I set for this strategy, and why does that matter?",
        "Why doesn't Strategy Builder auto-run or optimise my strategy?",
      ],
      relatedGlossaryKeys: ["trading-strategy-framework", "strategy-checklist", "strategy-evidence-link"],
      nextStepKeys: ["strategy-framework-categories-evidence"],
      guidedTourRequired: false,
      externalHref: "/strategy-framework",
      estimatedMinutes: 9,
      knowledgeCheck: [
        {
          prompt: "Does Strategy Builder ever generate a trading signal or recommend a trade?",
          options: ["Yes, once a checklist is complete", "No — it never implements or evaluates a methodology, only stores metadata and helps apply it consistently", "Only for 'Trend' category strategies", "Yes, via the Strategy Coach"],
          correctIndex: 1,
          explanation: "The platform never implements, evaluates, or judges the methodology you name — it's a metadata and discipline framework, never a signal generator.",
        },
        {
          prompt: "What does 'running' or 'applying' a strategy actually mean on this platform?",
          options: ["An automated backtest against historical data", "Manually working through the strategy's own checklist against your own evidence review", "The AI executes trades automatically", "Nothing — strategies can't be applied at all"],
          correctIndex: 1,
          explanation: "There's no automated execution — a checklist template is instantiated and you manually mark required items complete against your own real evidence review.",
        },
        {
          prompt: "Does the Strategy Coach optimise a strategy's parameters?",
          options: ["Yes, it tunes checklist weights automatically", "No — it only explains your own already-authored metadata and checklist completion state", "Yes, but only for registered strategies", "It runs a backtest first, then optimises"],
          correctIndex: 1,
          explanation: "The Strategy Coach is deterministic and explanatory only — it quotes your own data and checklist state, never tunes parameters or evaluates whether the methodology itself is sound.",
        },
        {
          prompt: "What does the Strategy Comparison table in the Strategy Workbench actually compare?",
          options: ["Historical performance and win rate", "Metadata only — category, markets, timeframes, required evidence, checklist size, references, version, and Learning Coverage", "AI-assigned quality scores", "Live P&L across strategies"],
          correctIndex: 1,
          explanation: "The comparison is explicitly metadata-only, per its own on-page description — never performance, never a ranking.",
        },
        {
          prompt: "When does a checklist read 'complete'?",
          options: ["Once any item is checked", "Only once every REQUIRED item is marked done; optional items never block it", "Automatically after 24 hours", "When the Strategy Coach says so"],
          correctIndex: 1,
          explanation: "Completion requires every required item checked — optional items are never counted toward it, and an unfilled checklist is never fabricated as complete.",
        },
        {
          prompt: "Where does Save Workspace persist your active strategy and comparison selection?",
          options: ["A server-side database table", "Only in your own browser's localStorage — no server persistence", "The Strategy Registry itself", "It emails you a summary"],
          correctIndex: 1,
          explanation: "Save Workspace reuses the client-side Saved Layouts pattern — it's a browser-local convenience, not server-persisted.",
        },
      ],
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
      summary: "One executive screen aggregating every engine's own dashboards — the platform's institutional module guide, upgraded to full depth in Sprint L2A.",
      body: [
        "Command Centre (/command-center) is a single, comprehensive executive workspace consolidating every existing dashboard this platform already has into 8 sections: Executive Overview, Portfolio Health, Options Income Engine, Greeks Summary, Risk Alerts, Portfolio Allocation, Broker, and AI Insights.",
        "It adds zero new calculations of any kind — every figure on the page is a direct, unmodified reuse of a request another page already makes (the Portfolio Risk Dashboard, the Greeks engine, Theta Income, Performance Analytics, and the Scanner's own top opportunity). Two badges make its role explicit at all times: Paper Trading Mode and Read-Only Command Center — nothing here ever places, closes, or modifies a real order.",
        "Who should use it, and when: open it first, at the start of any session, before diving into a specific engine — it exists to answer 'what needs my attention today?' in one screen, so you never have to visit a dozen pages just to get oriented.",
      ],
      whyItMatters: "A single at-a-glance screen saves you from visiting a dozen pages just to get oriented at the start of a session — and because it's a pure composition layer, every number you see here always matches its own source page exactly.",
      difficulty: "beginner",
      whyItExists: "As the platform grew to dozens of modules across three engines, no single existing dashboard could show all of them at once — Command Centre is a pure composition layer solving exactly that, reusing every source module's own already-computed output rather than recomputing anything.",
      institutionalThinking: "A trading desk's own morning read is usually one consolidated screen, not a dozen separate systems — Command Centre mirrors that expectation. Professional risk managers scan Risk Alerts and the worst stress-test scenario BEFORE looking at new opportunities; a common retail mistake is to open the Scanner first and only check portfolio-level risk afterward, if at all.",
      screenWalkthrough: [
        "Executive Overview — Portfolio Value, Buying Power, Portfolio Health Score with an Overall Risk Rating badge (Healthy / Moderate Risk / Elevated Risk / High Risk), Daily P/L, Total Theta Income (Monthly), Broker Status, Paper Trading Status, and when the portfolio was last updated. This strip sets the context for every section below it.",
        "Portfolio Health — a row of clickable widget cards, one per health factor computed elsewhere in the platform (e.g. Concentration, Diversification). Each card is a link: clicking it jumps straight to the page that actually owns that calculation, rather than trying to explain or fix it here.",
        "Options Income Engine — Total Premium Collected (Realized), Expected Monthly Income, and open position counts for Iron Condors and Calendar Spreads. Wheel Positions, Covered Calls, and Cash Secured Puts are honestly labeled 'Not tracked in this engine' — never shown as a fabricated zero, which would look identical to 'tracked but currently none open.'",
        "Greeks Summary — Net Delta, Gamma, Theta, and Vega summed across every open position. Beta reads 'Unavailable' whenever no beta figure exists anywhere in this engine's own data model — an honest gap, never a guessed number.",
        "Risk Alerts — only the highest-priority, genuinely elevated guidance codes, plus the single worst modeled stress-test scenario (the largest negative portfolio-value impact across every scenario already computed by the Stress Test module). 'No elevated risk alerts at this time' means no alert cleared the elevated threshold — it does not mean nothing was checked.",
        "Portfolio Allocation — four horizontal bar charts breaking deployed risk down by Symbol, Sector, Strategy, and Expiration. Each chart honestly shows 'No open positions' instead of an empty-looking chart when there's genuinely nothing to allocate.",
        "Broker — Connected/Not connected, the last check timestamp, and whether credentials are configured — all read from the LAST REAL CHECK you ran in Settings. This section deliberately never auto-checks the broker on page load, matching the platform's own 'no automatic polling' discipline for broker connectivity everywhere else.",
        "AI Insights — five deterministic, plain-English sentences (Largest Risk, Largest Opportunity, Concentration, Diversification, Income Status), each a client-side synthesis of figures already shown in the sections above. Never an LLM call, and never an execution recommendation.",
      ],
      workflowSteps: [
        "Open Command Centre from the sidebar's Home group.",
        "Review the Executive Overview strip first — Portfolio Value, Health Score, and Daily P/L set the context for everything else on the page.",
        "Check AI Insights for the two things most likely to need attention today: Largest Risk and Largest Opportunity.",
        "Review Portfolio Health's widget row and click into any factor that looks weak.",
        "Review Risk Alerts and the worst stress-test scenario — if either is showing something elevated, that's your next stop, not the Scanner.",
        "Open the Scanner (via the Largest Opportunity insight, or the sidebar) to see what new opportunities exist.",
        "Analyse the top-ranked opportunity's AI Opportunity Score before acting on it.",
        "Open the Trade Execution Center to review the strategy the Scanner already assigned to that candidate.",
        "Create a paper trade only after its Order Preview and Pre-Trade Risk Validation both look acceptable.",
        "Return to Command Centre afterward to confirm the new position shows up correctly in Portfolio Health and Greeks Summary.",
      ],
      metricsExplained: [
        { term: "Portfolio Health Score", explanation: "A single 0-100 score blending Concentration, Diversification, Event Risk, Net Greeks, Directional Exposure, Position Sizing Quality, Position Count, and Expiration Distribution — the exact same score the Portfolio Dashboard itself computes, reused here without recomputation." },
        { term: "Overall Risk Rating", explanation: "A four-tier label (Healthy / Moderate Risk / Elevated Risk / High Risk) derived from the same Health Score — the badge color you see is the fastest possible read on whether anything below deserves a closer look." },
        { term: "Net Delta / Net Theta", explanation: "The sum of every open position's own Delta/Theta — a single position's Greeks tell you little; these portfolio-level totals tell you your actual net directional lean and daily time-decay income." },
        { term: "Buying Power", explanation: "The capital genuinely still available for new trades — selling defined-risk spreads ties this up equal to their own maximum loss." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A healthy session start",
          steps: [
            "Executive Overview shows a Portfolio Health Score of 82/100 with a 'Healthy' Overall Risk Rating badge.",
            "Risk Alerts shows 'No elevated risk alerts at this time' — no guidance code crossed the elevated threshold, and the worst stress-test scenario is a modest, acceptable impact.",
            "AI Insights' Income Status line reports a healthy, positive monthly theta projection, and Largest Risk names a single symbol at a moderate, non-elevated concentration.",
          ],
          note: "This is exactly the state where it's reasonable to move on to the Scanner and look for new opportunities without addressing anything on this screen first.",
        },
        {
          label: "Average Opportunity",
          title: "One factor needs attention, nothing urgent",
          steps: [
            "Executive Overview shows a Portfolio Health Score of 58/100 with a 'Moderate Risk' badge.",
            "Portfolio Health's widget row shows Concentration reading noticeably lower than the other factors.",
            "AI Insights' Concentration line points at the same symbol/sector — worth reviewing on the Correlation & Concentration Risk page before adding another position in that same area.",
          ],
          note: "Nothing here is blocking — but a disciplined session would check Concentration before, not after, adding a fourth position in the same sector.",
        },
        {
          label: "Poor Opportunity",
          title: "Multiple elevated alerts — address this before scanning for anything new",
          steps: [
            "Executive Overview shows a Portfolio Health Score of 27/100 with an 'Elevated Risk' or 'High Risk' badge.",
            "Risk Alerts lists more than one elevated guidance code (e.g. elevated concentration AND elevated event risk), plus a worst stress-test scenario showing a large negative portfolio-value impact.",
            "AI Insights' Largest Risk line names the same concentrated position driving both alerts.",
          ],
          note: "The institutionally correct move here is Portfolio Health and Risk Alerts first — reviewing or trimming the flagged position — never opening the Scanner to add size on top of an already-elevated risk state.",
        },
      ],
      commonMistakes: [
        "Treating Command Centre as a place to take action, rather than a jumping-off point to the module that actually owns that action.",
        "Ignoring the Risk Alerts section because nothing feels 'broken' yet — an elevated alert is meant to be read before it becomes a problem, not after.",
        "Not distinguishing Institutional Home (your own personalized, at-a-glance dashboard) from Command Centre (the fuller, comprehensive executive view) — the two are deliberately separate, related pages.",
        "Assuming the Broker section reflects a live connection when it's actually a cached read from your last manual check in Settings.",
      ],
      riskWarnings: [
        "Every figure here is read from cached/already-computed data — the Broker section in particular never auto-refreshes; a stale credential or connection state is possible until you run a fresh check in Settings.",
        "AI Insights are deterministic summaries of already-computed figures, never predictions of what the market will do next — treat them as a starting point for investigation, not a conclusion.",
      ],
      bestPractices: [
        "Use Command Centre as your literal first screen of a session, before opening any specific engine.",
        "Treat an all-clear Risk Alerts section as 'no elevated alert fired,' not certainty that nothing needs attention.",
        "When Portfolio Health flags a specific factor, click through to that factor's own page rather than guessing at the fix from the widget alone.",
      ],
      relatedModuleHrefs: ["/command-center", "/", "/learn/paths/institutional-investing", "/learn/paths/trading-engine", "/learn/paths/options-income-engine"],
      aiCoachPrompts: [
        "Explain my Portfolio Health Score.",
        "Why is my Overall Risk Rating elevated?",
        "What does my Options Income Engine section show?",
        "What mistakes should I avoid when reading this dashboard?",
      ],
      relatedGlossaryKeys: ["portfolio-health", "concentration", "diversification", "buying-power", "theta-income"],
      nextStepKeys: ["institutional-dashboard-overview"],
      guidedTourRequired: false,
      externalHref: "/command-center",
      estimatedMinutes: 9,
    }),
    topic({
      key: "institutional-dashboard-overview",
      title: "Institutional Dashboard (Cross-Engine Command Centre)",
      summary: "One symbol lookup, all three engines side by side — never blended into a single number.",
      body: [
        "Institutional Dashboard (/institutional-dashboard) is a second, distinct executive screen from Command Centre: instead of aggregating dashboards, it lets you search ONE symbol and see Engine 1 (Institutional Investing) and Engine 2 (Institutional Trading) verdicts for that exact symbol side by side, plus an always-visible Portfolio Overview and Risk/Journal/Backtest summary row that needs no symbol at all.",
        "Every card is a direct, unmodified reuse of an existing route response — the Investment Committee card reuses the same value report the Research Terminal reads, the Technical Read card reuses the same Market Regime route Trading Research reads, and the Portfolio Overview section deliberately shows Engine 1's Portfolio Construction and Engine 3's Options Income account NEXT TO each other, never combined into one blended net-worth figure, since a target-weight stock model and a live options P&L ledger are structurally different things.",
        "Who should use it, and when: any time you want a single symbol's cross-engine read (does the Investment Committee's fundamental verdict agree with the Trading Engine's technical regime?) without opening two separate pages, or when you want an at-a-glance portfolio-wide status across all three engines without searching anything.",
      ],
      whyItMatters: "Fundamental and technical views can genuinely disagree — a company the Investment Committee rates Buy might sit in a downtrend regime, or vice versa. Seeing both side by side, sourced from the same underlying routes every dedicated page already uses, is more informative than trusting either view alone.",
      difficulty: "beginner",
      whyItExists: "Command Centre answers 'what needs my attention across everything I already own?' — Institutional Dashboard answers a different question: 'for this ONE symbol, what does every engine independently say?' Building it required zero new engine calculations; it's a pure composition layer over already-shipped routes.",
      institutionalThinking: "A professional desk cross-checks a fundamental view against a technical one before acting — agreement between the two is a stronger signal than either alone, and disagreement is itself useful information worth investigating rather than ignoring. A common retail mistake is trusting only whichever view happens to be open on screen at the moment.",
      screenWalkthrough: [
        "Symbol search box — type a ticker to populate every per-symbol card below; the always-visible Portfolio Overview and Risk/Journal/Backtest row need no search at all.",
        "Cross-Engine Verdict grid — Engine 1's Investment Committee card (consolidated verdict, agreement signal, confidence) next to Engine 2's Technical Read card (Market Regime label, confidence), fetched independently and concurrently — one engine's failure never blocks the other's card from rendering.",
        "Macro/Regime Side-by-Side — three cards for the same searched symbol's day: Engine 3's Market Briefing (regime, VIX, headline), Engine 1's Macro Context (rate regime), and Engine 2's Market Regime — each labeled by its own originating engine, never merged into one consolidated macro read.",
        "Signal cards grid — condensed Market Structure, Multi-Timeframe, Market Regime, Probability, and Liquidity cards, each linking out to the full Trading Research page for its own deeper detail.",
        "Portfolio Overview — Engine 1's Portfolio Construction summary (portfolio count, total holdings) and Engine 3's Options Income account summary (account value, total P&L, open positions) shown side by side, always visible whether or not a symbol is searched.",
        "Portfolio Risk / Recent Journal / Recent Backtests row — each a condensed summary linking out to its own full page for management actions, never re-implementing that page's own CRUD or state logic here.",
      ],
      workflowSteps: [
        "Open Institutional Dashboard from the sidebar.",
        "Review the always-visible Portfolio Overview and Risk/Journal/Backtest row first — this needs no symbol search.",
        "Search a symbol you're evaluating.",
        "Compare the Investment Committee's verdict against the Technical Read's regime label — note whether they agree or diverge.",
        "Check the Macro/Regime Side-by-Side cards for broader context before acting on either engine's verdict alone.",
        "Follow a signal card's link to Trading Research if you need the full, uncondensed detail behind it.",
      ],
      metricsExplained: [
        { term: "Investment Committee Agreement", explanation: "unanimous / majority / split / insufficient-data — reused directly from Engine 1's own Investment Committee, never recomputed here." },
        { term: "Market Regime Label", explanation: "Engine 2's own trending-bullish / trending-bearish / range-bound / volatile-choppy / quiet-consolidation classification, reused directly from the Technical Read card's own source route." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Fundamental and technical views agree",
          steps: [
            "Investment Committee card shows a 'Buy' consolidated verdict with unanimous agreement.",
            "Technical Read card shows a 'trending-bullish' regime with high confidence.",
            "Both signal cards below (Structure, Multi-Timeframe) also read uptrend/aligned.",
          ],
          note: "Agreement between the fundamental and technical view is a stronger combined signal than either read alone — still not a guarantee, only a better-corroborated one.",
        },
        {
          label: "Average Opportunity",
          title: "The two views genuinely diverge",
          steps: [
            "Investment Committee card shows a 'Buy' verdict with majority agreement.",
            "Technical Read card shows a 'range-bound' regime — no clear directional edge right now.",
          ],
          note: "This is exactly the kind of disagreement worth investigating rather than picking whichever view is more convenient — a good long-term fundamental case can still sit through a directionless technical stretch.",
        },
        {
          label: "Poor Opportunity",
          title: "Both views read poorly, and Portfolio Risk already shows elevated exposure",
          steps: [
            "Investment Committee card shows a 'Wait' verdict with split agreement.",
            "Technical Read card shows a 'volatile-choppy' regime.",
            "The always-visible Portfolio Risk summary row already reads elevated before this symbol is even added.",
          ],
          note: "Reviewing the always-visible Portfolio Risk row before searching a new candidate — not after — is the disciplined order of operations this page is built to support.",
        },
      ],
      commonMistakes: [
        "Treating a single engine's card as the whole answer when the other engine's card is sitting right next to it, showing something different.",
        "Assuming the Portfolio Overview section blends Engine 1 and Engine 3 into one number — it deliberately never does.",
        "Searching a new symbol before reviewing the always-visible Portfolio Overview and Risk row that need no search at all.",
      ],
      riskWarnings: [
        "Every card here is a read of already-computed, deterministic data — never a live market prediction, and never an execution recommendation.",
        "Engine 1's and Engine 2's cards can genuinely disagree; neither is authoritative over the other, and the page never resolves the disagreement for you.",
      ],
      bestPractices: [
        "Check the always-visible Portfolio Overview and Risk/Journal/Backtest row at the start of a session, before searching anything.",
        "When the two engines' verdicts diverge, investigate why via each engine's own full page rather than picking whichever view you prefer.",
      ],
      relatedModuleHrefs: ["/institutional-dashboard", "/command-center", "/research-terminal", "/trading-research", "/portfolio-ai"],
      aiCoachPrompts: [
        "Why do the Investment Committee and Technical Read disagree on this symbol?",
        "Explain my Portfolio Overview section.",
        "What does the Macro/Regime Side-by-Side section actually compare?",
      ],
      relatedGlossaryKeys: ["portfolio-health", "concentration", "portfolio-construction", "capital-allocation"],
      nextStepKeys: ["ai-coach-overview"],
      guidedTourRequired: false,
      externalHref: "/institutional-dashboard",
      estimatedMinutes: 7,
      knowledgeCheck: [
        {
          prompt: "Does Institutional Dashboard's Portfolio Overview section blend Engine 1 and Engine 3 into one net-worth number?",
          options: ["Yes, always", "No — they're shown side by side, never combined", "Only when both have open positions", "Only for paper accounts"],
          correctIndex: 1,
          explanation: "A target-weight stock model (Engine 1) and a live options P&L ledger (Engine 3) are structurally different things, so they're deliberately never blended into one figure.",
        },
        {
          prompt: "What happens if Engine 1's Investment Committee card fails to resolve for a searched symbol?",
          options: ["The whole page fails to load", "Engine 2's Technical Read card still renders independently", "Engine 2's card is also blocked", "The page falls back to Command Centre"],
          correctIndex: 1,
          explanation: "The two cards are fetched independently and concurrently — one engine's failure never blocks the other's card from rendering.",
        },
        {
          prompt: "Which section of Institutional Dashboard requires no symbol search at all?",
          options: ["The Cross-Engine Verdict grid", "The Macro/Regime Side-by-Side cards", "Portfolio Overview and the Risk/Journal/Backtest row", "The Signal cards grid"],
          correctIndex: 2,
          explanation: "Portfolio Overview and the Risk/Journal/Backtest summary row are always visible, whether or not a symbol has been searched.",
        },
        {
          prompt: "What does an 'unanimous' Investment Committee agreement signal mean?",
          options: ["The AI is very confident", "All three underlying analysts (Graham, Buffett, Tom Nash) independently reached the same conclusion", "The stock price hasn't moved recently", "The trade was auto-executed"],
          correctIndex: 1,
          explanation: "Agreement is reused directly from Engine 1's own Investment Committee module — it reflects how many of the three independent analysts actually agree, never a fabricated confidence score.",
        },
        {
          prompt: "If the Investment Committee reads 'Buy' but the Technical Read shows 'range-bound,' what is the institutionally disciplined response?",
          options: ["Ignore the Technical Read since fundamentals matter more", "Investigate the disagreement rather than picking whichever view is convenient", "Automatically trust the more recent card", "Close the page and try a different symbol"],
          correctIndex: 1,
          explanation: "Divergence between the two engines is itself useful information — the lesson explicitly frames this as worth investigating, not resolving by picking a favorite.",
        },
        {
          prompt: "Where does each Signal card (Structure, Multi-Timeframe, Regime, Probability, Liquidity) link out to for deeper detail?",
          options: ["Command Centre", "Trading Research", "Portfolio AI", "The Learning Centre"],
          correctIndex: 1,
          explanation: "Each condensed Signal card on Institutional Dashboard links to the full Trading Research page rather than re-implementing that page's own deeper detail here.",
        },
      ],
    }),
    topic({
      key: "ai-coach-overview",
      title: "AI Coach",
      summary: "A grounded chat assistant that explains YOUR own data — never a live market prediction or an execution recommendation.",
      body: [
        "AI Coach (/assistant) is a chat interface with mode selection (Auto-detect, Explain Trade, Teach Greeks, Risk Coach, Strategy Coach, Value Research, Quiz Me) and a Beginner/Advanced depth toggle — every answer is grounded in your own already-computed platform data, plus a persisted chat history so you can pick up where you left off.",
        "Two quick-action buttons ('Explain latest trade', 'Quiz me') and a Reference Cards strip (plain-English definitions for Delta, Theta, Gamma, Vega, POP, and EV) sit above the chat itself, alongside a Recent Lessons row surfacing Learning Centre content relevant to what you've been asking about.",
        "The chat can be interrupted mid-answer with a Stop button, and if a request genuinely fails, an honest error message appears in the transcript rather than a fabricated answer — this coach never invents a fact it can't ground in your own data.",
      ],
      whyItMatters: "A coach that only answers from your own already-computed data — never a live prediction, never a fabricated fact — is safe to lean on for explanation without it ever becoming an execution recommendation.",
      difficulty: "beginner",
      whyItExists: "Every page in this platform shows numbers, but not every user wants to look up what each number means separately — AI Coach exists so you can just ask, in plain language, and get an answer grounded in the same data the page itself already computed.",
      institutionalThinking: "A disciplined trader treats an AI explanation the same way they'd treat a junior analyst's explanation of a report: useful for understanding WHY a number looks the way it does, never a substitute for your own judgment about what to DO next. A common mistake is treating a coach's explanation as an implicit trade recommendation, when it's explicitly never that.",
      screenWalkthrough: [
        "Mode selector — Auto-detect (the coach infers what you're asking about), or pick a specific mode: Explain Trade, Teach Greeks, Risk Coach, Strategy Coach, Value Research, Quiz Me.",
        "Depth toggle — Beginner or Advanced, adjusting how much background the coach assumes you already know.",
        "Quick-action buttons — 'Explain latest trade' and 'Quiz me,' one click each, no typing required.",
        "Reference Cards strip — Δ (Delta), Θ (Theta), Γ (Gamma), V (Vega), POP, and EV, each a short plain-English definition, always visible above the chat.",
        "Recent Lessons row — Learning Centre lessons relevant to your recent questions, so you can go deeper than a chat answer alone provides.",
        "The chat itself — your message, a streamed reply, a Stop button while a reply is in progress, and an honest error turn if a request genuinely fails.",
      ],
      workflowSteps: [
        "Open AI Coach from the sidebar.",
        "Pick a mode if you know what you're asking about, or leave it on Auto-detect.",
        "Set the depth toggle to match your own familiarity with the topic.",
        "Ask a question, or use one of the quick-action buttons.",
        "Use Stop if you want to interrupt a reply that's already answered your real question.",
        "Follow a Recent Lessons link if you want the full depth behind a chat answer.",
      ],
      metricsExplained: [
        { term: "Delta / Theta / Gamma / Vega", explanation: "The four Greeks explained in the Reference Cards strip — the same terms Greeks Tutor and Delta Masterclass teach in full depth; AI Coach's cards are a quick-reference summary, not a replacement for those dedicated lessons." },
        { term: "POP / EV", explanation: "Probability of Profit and Expected Value — the same figures the Trade Execution Center's own AI Score step shows, summarized here for quick reference." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A grounded, well-scoped question",
          steps: [
            "You ask 'Explain my latest trade' using the quick-action button.",
            "The coach's reply references your actual most recent trade's own already-computed figures (credit, max profit, max loss).",
          ],
          note: "This is the ideal use: a specific question the coach can genuinely ground in your own data, answered without inventing anything.",
        },
        {
          label: "Average Opportunity",
          title: "A broader conceptual question",
          steps: [
            "You switch to Teach Greeks mode and ask 'Why does Theta decay accelerate near expiration?'",
            "The coach answers from general options mechanics rather than your own specific position data.",
          ],
          note: "A conceptual question is answered from established option mechanics, not your live portfolio — still grounded, just in a different kind of already-known fact.",
        },
        {
          label: "Poor Opportunity",
          title: "Asking for something the coach genuinely cannot know",
          steps: [
            "You ask 'What will this stock do tomorrow?'",
            "The coach explains it cannot predict future price movement and redirects you to what it CAN ground an answer in — your own already-computed data.",
          ],
          note: "A coach that admits what it doesn't know, rather than fabricating an answer, is the entire point of grounding every reply in already-computed data.",
        },
      ],
      commonMistakes: [
        "Treating a coach explanation as an implicit trade recommendation — it's explicitly never that.",
        "Not adjusting the depth toggle, then getting either an overly basic or overly technical answer for your own level.",
        "Ignoring the Recent Lessons row when a chat answer leaves you wanting the fuller lesson behind it.",
      ],
      riskWarnings: [
        "AI Coach never predicts future price movement, and never issues an execution recommendation — every answer is grounded in your own already-computed data or established educational mechanics.",
        "If a request fails, the chat shows an honest error turn rather than a fabricated answer — treat a missing reply as 'try again,' never as 'nothing to explain here.'",
      ],
      bestPractices: [
        "Use the quick-action buttons for the two most common questions before typing a custom one.",
        "Switch modes deliberately when you know what you're asking about, rather than always leaving it on Auto-detect.",
        "Follow up a useful chat answer with its related Recent Lessons entry for the full depth.",
      ],
      relatedModuleHrefs: ["/assistant", "/learn/greeks", "/learn/quiz", "/lessons"],
      aiCoachPrompts: ["What modes does AI Coach support?", "How is a coach answer different from a live prediction?"],
      relatedGlossaryKeys: ["delta", "theta", "gamma", "vega", "simulated-vs-live"],
      nextStepKeys: ["platform-settings-personalisation"],
      guidedTourRequired: false,
      externalHref: "/assistant",
      estimatedMinutes: 6,
      knowledgeCheck: [
        {
          prompt: "What is AI Coach's Auto-detect mode?",
          options: ["A mode that only works for Greeks questions", "A mode where the coach infers what you're asking about instead of you picking a specific mode", "A mode that auto-executes trades", "A setting that disables the chat entirely"],
          correctIndex: 1,
          explanation: "Auto-detect lets the coach infer your intent rather than requiring you to manually select Explain Trade, Teach Greeks, Risk Coach, Strategy Coach, Value Research, or Quiz Me first.",
        },
        {
          prompt: "What happens when you ask AI Coach a question it genuinely cannot answer, like a future price prediction?",
          options: ["It fabricates a plausible-sounding answer", "It honestly explains it cannot predict that and redirects to what it can ground an answer in", "It silently returns nothing", "It automatically switches to Risk Coach mode"],
          correctIndex: 1,
          explanation: "Every AI Coach answer is grounded in your own already-computed data or established mechanics — never a live market prediction, and it says so plainly rather than inventing an answer.",
        },
        {
          prompt: "What does the Stop button in the chat do?",
          options: ["Deletes your chat history", "Interrupts a reply that's already in progress", "Logs you out", "Switches the coach to a different mode"],
          correctIndex: 1,
          explanation: "The Stop button lets you interrupt a streaming reply mid-answer once it's already answered your real question.",
        },
        {
          prompt: "What appears in the transcript if a chat request genuinely fails?",
          options: ["A fabricated best-guess answer", "An honest error turn", "The chat silently retries forever", "The page reloads automatically"],
          correctIndex: 1,
          explanation: "AI Coach never invents a fact it can't ground in your own data — a genuine failure shows an honest error message in the transcript instead.",
        },
        {
          prompt: "What does the Reference Cards strip show?",
          options: ["Your open trades", "Plain-English definitions for Delta, Theta, Gamma, Vega, POP, and EV", "A list of recent broker orders", "Your saved Learning Centre bookmarks"],
          correctIndex: 1,
          explanation: "The Reference Cards strip is a quick-reference summary of six commonly-referenced terms, always visible above the chat itself.",
        },
      ],
    }),
    topic({
      key: "platform-settings-personalisation",
      title: "Settings & Personalisation",
      summary: "System Settings, real personalisation features across several pages, and honest gaps — no theme toggle, no AI preferences, no backup/restore.",
      body: [
        "System Settings (/settings) is one page with exactly 7 cards, in order: Execution Engine, Market Data, Broker Connection, Fundamentals Data, Live Provider Status, Event Risk Filter, and Alerts & Notifications — followed by a single Save Settings button. There is no theme section and no AI-preference section on this page.",
        "Honest disclosure: there is no light/dark theme toggle anywhere in this platform. The interface is permanently dark-themed, fixed in the app's own CSS — not a user-selectable preference.",
        "Real dashboard/workspace personalisation does exist, but across three genuinely separate mechanisms, not one: the sidebar's own collapsible/pinnable/compact-mode preferences (client-side only, your browser), the Research Terminal's page-scoped Saved Layouts (client-side only, that page only), and the Home page's real, server-side, multi-workspace system — create, name, duplicate, rename, switch between, and delete saved widget layouts, the platform's true 'workspace management' feature.",
        "Honest disclosure: there is no persisted AI-preference setting anywhere. The only AI-related control found is a Beginner/Advanced depth toggle on the AI Coach page itself — but it resets to Beginner every time that page reloads; it's a per-message choice, not a saved preference.",
        "Honest disclosure: there is no backup-and-restore feature, and no general account/settings data export or import feature, anywhere a user can access. The only real export capability is a narrow CSV download of your currently-open trade positions (via the Command Palette's 'Export Portfolio' action or a Home page Quick Action) — it exports positions only, has no corresponding import, and cannot restore anything. If you were looking for a way to back up your account, it doesn't exist yet.",
      ],
      whyItMatters: "Knowing exactly which personalisation features are real, and which of three different mechanisms actually applies (sidebar prefs vs. Saved Layouts vs. the Home page Workspace System) prevents wasted time hunting for a setting that lives somewhere else — or doesn't exist at all.",
      difficulty: "beginner",
      whyItExists: "Settings.tsx accumulated its 7 cards across many separate past features (broker connection, fundamentals provider, event risk, alerts) each adding its own section — this lesson exists to give you the complete, accurate current picture in one place, since no single page documents all of it together.",
      institutionalThinking: "A professional platform user learns the boundaries of a system honestly — assuming a feature exists because it 'should' (like backup/restore, or an AI model preference) leads to wasted searching; this lesson's job is to save you that search by stating plainly what's real and what isn't.",
      screenWalkthrough: [
        "Execution Engine card — Execution Mode (manual/semi_auto/full_auto — note the actual kill switch and guardrails live on the AutoPilot page, not here), Max Risk Per Trade %, Max Portfolio Risk %, Profit Target %, Stop Loss Multiplier, Default DTE, Short Delta Target.",
        "Market Data card — Scanner Mode (mock/live) and Data Provider (mock/alpaca/polygon) selects.",
        "Broker Connection card — a 'Paper Trading Only' badge, connection status, an API Key input, a 'Check Connection' button, and (once checked) a results panel showing Authentication, Account Status, Buying Power, Cash Balance, Portfolio Value, Open Positions, Open Orders.",
        "Fundamentals Data card — a Live/Simulated badge, Fundamentals Provider select, Live Data Staleness Threshold (hours) input, a read-only Live Fundamentals Connection indicator, and an Auto-refresh stale data switch.",
        "Live Provider Status card — only shown when there's data to show; lists each fundamentals provider's own health (Operational/Rate-limited/Unreachable/No data/Not configured/Idle).",
        "Event Risk Filter card — a master Enable Event Risk Filter switch, plus two dependent switches (Block short premium before earnings, Block AutoPilot on high event risk) that are only editable when the master switch is on.",
        "Alerts & Notifications card — a single Enable alerts switch; see the Monitoring & Alerts lesson for the full alerts system this switch controls.",
        "Sidebar preferences (every page, the left navigation) — collapse/expand groups, a compact icon-only mode, and pinning up to 6 routes to a 'Frequently Used' section — all client-side, stored only in your own browser.",
        "Command Palette (⌘K / Ctrl+K, every page) — global search and navigation, quick actions, and an 'Export Portfolio' action that downloads a CSV of your currently-open positions.",
        "Home page Workspace System (/, the landing page) — a workspace selector plus Rename/Duplicate/New/Delete Workspace controls; each workspace is a named, server-saved set of widgets (visible/hidden, Normal/Compact size, order) chosen from 14 available widgets (portfolio health, market status, open positions, today's P&L, theta income, buying power, risk, upcoming events, AI briefing, mentor summary, recent activity, notifications, quick actions, watchlist summary).",
      ],
      workflowSteps: [
        "Open Settings and work through each card top to bottom — Execution Engine and Market Data first, since they affect scanning and order preview behaviour platform-wide.",
        "Use Check Connection in the Broker Connection card any time you need to confirm your paper-trading account is actually reachable before relying on Buying Power figures elsewhere.",
        "Toggle Alerts & Notifications off if you want a quiet period with no new alerts, then back on when you're ready to resume.",
        "Separately from Settings, use the sidebar's pin/collapse controls to shape your own daily navigation — this never touches the server, so it's safe to experiment with.",
        "If you want a genuinely different dashboard layout for a different purpose (e.g. a compact 'quick check' view vs. a full 'deep review' view), create a second Workspace on the Home page rather than repeatedly re-arranging one.",
      ],
      metricsExplained: [
        { term: "Live Data Staleness Threshold", explanation: "The number of hours after which fundamentals data is considered stale — an editable Settings field, defaulting to 24 hours." },
        { term: "Execution Mode", explanation: "manual / semi_auto / full_auto — controls how much automation is applied to trade execution; the actual kill switch and guardrails are managed on the separate AutoPilot page, not here." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Using the right personalisation tool for the job",
          steps: [
            "You pin your 4 most-used pages to the sidebar's Frequently Used section for fast daily access.",
            "You create a second Home page Workspace named 'Quick Check' with only 4 compact widgets, separate from your full default workspace.",
            "You leave Research Terminal's own Saved Layouts for symbol-specific research sessions only, since that feature is scoped to that one page.",
          ],
          note: "Each of the three real personalisation mechanisms is used for what it's actually built for — none of them is stretched to do another's job.",
        },
        {
          label: "Average Opportunity",
          title: "Confusing Saved Layouts with the Workspace System",
          steps: [
            "A user saves a Research Terminal layout expecting it to also change their Home page's widget arrangement.",
            "It doesn't — Saved Layouts are deliberately scoped only to that page's own symbols/mode/tab selection, never the Home page's widgets.",
          ],
          note: "These are two separate, non-overlapping features — the fix is simply knowing which one actually controls what.",
        },
        {
          label: "Poor Opportunity",
          title: "Looking for a theme toggle or a backup/restore button",
          steps: [
            "A user searches Settings for a light-mode toggle and an 'Export My Data' or 'Backup Account' button.",
            "Neither exists anywhere in this platform today — the app is permanently dark-themed, and the only real export is a narrow CSV of open positions with no corresponding import or restore.",
          ],
          note: "This is exactly the honest gap this lesson exists to disclose — searching further for either feature would be searching for something that was never built.",
        },
      ],
      commonMistakes: [
        "Looking for a light/dark theme toggle — none exists; the interface is permanently dark-themed.",
        "Assuming the AI Coach's Beginner/Advanced toggle is a saved preference — it resets to Beginner on every page reload.",
        "Confusing Research Terminal's page-scoped Saved Layouts with the Home page's real, server-side, multi-workspace system — they don't share data.",
        "Expecting a backup/restore or full data export feature — the only real export is a narrow CSV of open positions only, with no import and no restore capability.",
      ],
      riskWarnings: [
        "The Broker Connection card's API Key input never accepts the actual API secret — that's read only from a server environment variable, never entered in the UI.",
        "Sidebar preferences and Research Terminal Saved Layouts are both stored only in your own browser (localStorage) — clearing browser data or switching devices loses them; only the Home page Workspace System is saved server-side per your account.",
      ],
      bestPractices: [
        "Use the Home page Workspace System, not Saved Layouts, for anything you want to survive a browser change or persist reliably per your account.",
        "Check the Event Risk Filter card's master switch state before assuming its two dependent switches are actually doing anything — they're inert while the master switch is off.",
        "Periodically use the Command Palette's Export Portfolio action if you want a point-in-time CSV record of your open positions — remembering it's a narrow, positions-only export, not a full account backup.",
      ],
      relatedModuleHrefs: ["/settings", "/", "/research-terminal", "/assistant", "/learn/paths/institutional-investing"],
      aiCoachPrompts: [
        "What does the Execution Mode setting actually control?",
        "What's the difference between Saved Layouts and the Home page Workspace System?",
        "Is there a way to back up my account data?",
        "Why does the AI Coach depth toggle reset every time I reload the page?",
      ],
      relatedGlossaryKeys: ["command-palette", "simulated-vs-live"],
      nextStepKeys: ["learning-centre-overview"],
      guidedTourRequired: false,
      externalHref: "/settings",
      estimatedMinutes: 9,
      knowledgeCheck: [
        {
          prompt: "How many cards does the System Settings page (/settings) actually have?",
          options: ["3", "Exactly 7 (Execution Engine, Market Data, Broker Connection, Fundamentals Data, Live Provider Status, Event Risk Filter, Alerts & Notifications)", "10, including a Theme card", "5, including an AI Preferences card"],
          correctIndex: 1,
          explanation: "Settings.tsx has exactly 7 cards in this order, followed by a single Save Settings button — no theme card and no AI-preferences card exist.",
        },
        {
          prompt: "Does this platform have a light/dark theme toggle?",
          options: ["Yes, in Settings", "Yes, in the sidebar", "No — the interface is permanently dark-themed, fixed in the app's CSS", "Yes, but only for the Research Terminal"],
          correctIndex: 2,
          explanation: "No theme toggle exists anywhere. The app is unconditionally dark-themed at the CSS level, not a user-selectable preference.",
        },
        {
          prompt: "Which feature is the platform's real, server-side, multi-workspace 'dashboard customisation' system?",
          options: ["Research Terminal's Saved Layouts", "The sidebar's pin/collapse preferences", "The Home page's Workspace System (create/name/duplicate/switch/delete saved widget layouts)", "The Command Palette"],
          correctIndex: 2,
          explanation: "Only the Home page's Workspace System is server-side and genuinely multi-workspace. Saved Layouts is page-scoped and localStorage-only; sidebar prefs are also localStorage-only and don't involve widgets.",
        },
        {
          prompt: "Is the AI Coach's Beginner/Advanced depth toggle a saved user preference?",
          options: ["Yes, saved in Settings", "Yes, saved to your browser's localStorage", "No — it's pure in-memory component state that resets to Beginner on every page reload", "Yes, saved to your account server-side"],
          correctIndex: 2,
          explanation: "It's a per-message choice with no persistence anywhere — not localStorage, not the server. It resets to Beginner every time the Assistant page reloads.",
        },
        {
          prompt: "Does this platform have a backup-and-restore or full account data export feature?",
          options: ["Yes, in Settings under a Backup card", "No — the only real export is a narrow CSV of currently-open trade positions, with no import and no restore capability", "Yes, via the Command Palette's 'Backup Account' action", "Yes, but only for Institutional-tier accounts"],
          correctIndex: 1,
          explanation: "No backup/restore or general data export/import feature exists anywhere. The only real export is a positions-only CSV download — not an account backup, and it has no corresponding import.",
        },
      ],
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
  OPTIONS_INCOME_ENGINE_PATH,
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
