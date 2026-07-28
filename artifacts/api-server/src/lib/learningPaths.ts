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
      title: "Options Fundamentals: Contracts, Moneyness, and Inspecting One Before You Trade",
      summary: "The full vocabulary of an option contract, connected to exactly how this platform displays and prices one — and an honest account of what it doesn't automate.",
      body: [
        "An option gives its buyer the right, but not the obligation, to buy (call) or sell (put) 100 shares at a fixed strike price on or before a fixed expiration date, in exchange for a premium paid to the seller. That asymmetry — a right for the buyer, an obligation for the seller — is the foundation of every strategy this platform builds: selling options collects premium in exchange for taking on that obligation.",
        "A contract's premium is made of two parts. Intrinsic value is the real, already-realized in-the-money amount: for a call, max(0, underlying price − strike); for a put, max(0, strike − underlying price). Extrinsic value (time value) is everything else — compensation for the time remaining and the uncertainty of where the price might go, and it decays toward zero as expiration approaches. An out-of-the-money option's entire premium is extrinsic value; it has zero intrinsic value.",
        "Where the strike sits relative to the current underlying price determines moneyness: in-the-money (ITM, positive intrinsic value), at-the-money (ATM, strike at or very near the price), or out-of-the-money (OTM, zero intrinsic value). This platform's own risk engine computes real intrinsic value at the exact price points it uses to size a position's worst-case loss — this isn't just teaching prose, it's a genuine, load-bearing calculation.",
        "Every equity option on this platform controls 100 shares of the underlying — the contract multiplier. It isn't a rounding convention: every dollar figure this platform computes (credit, max profit, max loss, theta, vega, notional exposure) multiplies the per-share number by 100, consistently, in every calculation, not just in examples.",
        "The buyer/seller distinction is a real, structural field in this platform's own data model, not just a teaching concept: every leg of every position is tagged buy or sell, and the platform translates that into standard order-ticket language you'll see directly on a trade ticket — 'sell to open,' 'buy to open.'",
        "Exercise is what a BUYER does to invoke their right; assignment is what happens to the SELLER when that right is invoked. Honest disclosure: this platform does not simulate or automate an actual exercise/assignment event anywhere — no shares are ever transferred, no position is ever auto-closed, no P&L event is generated from an assignment. What it does compute is a real, rule-based assignment RISK LEVEL (driven by days-to-expiration and how far in-the-money a short strike has moved) to warn you before it could happen — a risk indicator, not a settlement engine.",
      ],
      whyItMatters: "This platform is a premium-selling engine — understanding that sellers take on the obligation side of the contract, and knowing exactly which parts of 'inspecting an option' this platform actually automates versus which remain your own judgment call, is the single most important foundational skill.",
      difficulty: "beginner",
      whyItExists: "Every Options Academy module that follows — Greeks, pricing/volatility, chain navigation, risk management — assumes this vocabulary. This lesson exists to ground it in exactly what this platform's own contract data model, risk engine, and trade ticket actually do, rather than generic textbook definitions divorced from the real screens you'll use.",
      institutionalThinking: "A professional never assumes a platform automates a mechanic just because it's a standard part of options trading — this platform's own risk math genuinely uses intrinsic value and the 100x multiplier, but genuinely does NOT automate exercise/assignment. Knowing precisely which is which, for every concept, is itself a professional discipline.",
      screenWalkthrough: [
        "Option Chain page (`/options/:symbol`) — the platform's real, working contract-display screen: calls on the left, strikes down the center, puts on the right. Each side shows Delta, Theta, IV, Bid, Mid, and Ask per strike.",
        "Moneyness is shown as an unlabeled background-color tint on in-the-money cells — there is no 'ITM'/'ATM'/'OTM' text badge anywhere in the live trading UI; the platform computes moneyness internally (for risk math and adjustment logic) without ever printing the label on screen.",
        "Trade Ticket page — every leg shows a colored side badge (a red 'SELL' or emerald 'BUY' badge) plus the real OCC-format contract symbol (e.g. AMZN241220C00200000) and the per-share price the platform is quoting.",
        "The header strip above the chain shows the underlying's own last price and IV Rank — your first, fastest read on whether this symbol is 'cheap' or 'expensive' for options right now.",
      ],
      workflowSteps: [
        "Open the Option Chain page and pick a symbol using the searchable combobox.",
        "Scan the strike column relative to the header's underlying price — cells tinted with a background color are in-the-money; everything else is at- or out-of-the-money, even though no text label says so.",
        "Compare Bid/Mid/Ask for a candidate strike — a wide gap between bid and ask (relative to the mid) is your own first-pass liquidity read, even before any trade ticket runs the platform's own formal liquidity check.",
        "Open a candidate on the Trade Ticket screen and read its side badges (buy/sell), OCC symbol, and per-share price — this is the platform's real, final confirmation of exactly what you're about to trade before any Pre-Trade Risk Validation runs.",
        "If considering a short (sold) contract, deliberately check its DTE and how far in/out-of-the-money it sits — this platform will compute a real assignment-risk level for you later, but understanding moneyness yourself is what makes that number meaningful rather than an opaque badge.",
      ],
      metricsExplained: [
        { term: "Intrinsic Value", explanation: "max(0, underlying − strike) for a call, max(0, strike − underlying) for a put — a real number this platform's risk engine actually computes to size worst-case loss." },
        { term: "Extrinsic Value", explanation: "Premium minus intrinsic value — time and uncertainty priced in. This platform never returns a standalone extrinsic-value field; only the total premium and, separately, intrinsic value." },
        { term: "Contract Multiplier", explanation: "100 shares per contract, applied consistently in every dollar figure this platform computes — credit, max profit, max loss, theta, vega, and notional exposure." },
        { term: "Moneyness (ITM/ATM/OTM)", explanation: "Where the strike sits relative to the underlying price. Shown only as a background-color tint on the Option Chain page, never as a text label anywhere in the live trading UI." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Inspecting a short OTM put before considering a trade",
          steps: [
            "Open the symbol's Option Chain and locate a put strike sitting meaningfully below the header's underlying price — an untinted (OTM) cell, meaning zero intrinsic value and a premium made entirely of extrinsic (time) value.",
            "Check its Bid/Ask on the chain — a tight spread relative to the mid is a good early liquidity signal, before any formal server-side check runs.",
            "Open it on the Trade Ticket screen — confirm the leg shows a 'SELL' badge (you're the seller, collecting premium and taking on the obligation), and note the DTE shown in the ticket's own summary tiles.",
          ],
          note: "Being OTM at entry doesn't mean the position stays that way — moneyness can shift as the underlying moves, which is exactly why this platform recomputes assignment risk live rather than only at entry.",
        },
        {
          label: "Average Opportunity",
          title: "A strike close to the underlying price (near-ATM)",
          steps: [
            "An ATM-region strike carries the highest extrinsic value of any strike at that expiration — more time premium collected if selling, but also the fastest-decaying, most gamma-sensitive position.",
            "The tradeoff: richer credit for a seller, but a much narrower margin before the position genuinely moves in-the-money.",
          ],
        },
        {
          label: "Poor Opportunity",
          title: "Treating an ITM-tinted cell as automatically 'bad' without checking why",
          steps: [
            "A background tint alone doesn't tell you HOW deep in-the-money a strike is, or whether that's actually the intended structure (e.g. a deep-ITM long call used for a directional, stock-replacement-style trade is a deliberate, legitimate choice, not a mistake).",
            "Reading the tint without checking the actual strike-vs-price distance, or the specific strategy's own intent, is a shallow read of a real signal.",
          ],
        },
      ],
      commonMistakes: [
        "Assuming an unlabeled ITM tint on the Option Chain page is itself a 'do not trade' warning — it's a moneyness indicator, not a quality judgment.",
        "Expecting the platform to automatically settle or handle an assignment event — it never does; assignment risk is a computed warning, not an automated action.",
        "Forgetting the 100x multiplier when mentally estimating a position's real dollar exposure from a per-share premium quote.",
        "Confusing 'buyer' and 'seller' obligations — a seller (not a buyer) is the one who can be assigned.",
      ],
      riskWarnings: [
        "This is educational content, not financial advice, and does not recommend any specific trade.",
        "Options can result in rapid and substantial losses, including the full premium paid (for a buyer) or, for an undefined-risk short position, losses well beyond the premium collected — see the Options Risk Management lesson for the defined-risk vs. undefined-risk distinction.",
        "Every figure shown on this platform's Option Chain and Trade Ticket pages is modeled or simulated pricing, not a live, executable broker quote — it can change before any real order would be placed, and this platform never places a real trade on your behalf without your own explicit submission.",
      ],
      bestPractices: [
        "Always check moneyness (via the tint or by comparing strike to price yourself) before assuming what 'ITM'/'OTM' means for the specific leg you're looking at.",
        "Treat the Trade Ticket's own side badges and OCC symbol as your final, authoritative confirmation of what you're about to trade — not the scanner row that led you there.",
        "Never assume assignment is automated or handled for you — the risk-level warning is informational, and managing an in-the-money short position is your own decision.",
      ],
      relatedModuleHrefs: ["/options/SPY", "/portfolio"],
      aiCoachPrompts: [
        "Explain the difference between intrinsic and extrinsic value for this specific contract.",
        "Why is this strike shaded as in-the-money, and what does that mean for assignment risk?",
        "Walk me through what 'sell to open' actually obligates me to do.",
        "What does this platform NOT automate about exercise and assignment that I need to track myself?",
      ],
      nextStepKeys: ["foundations-calls"],
      knowledgeCheck: [
        {
          prompt: "An option's premium is made up of intrinsic value plus what other component?",
          options: ["Contract multiplier", "Extrinsic (time) value", "Open interest", "Assignment risk"],
          correctIndex: 1,
          explanation: "Premium = intrinsic value (real, already-realized ITM value) + extrinsic value (time/uncertainty premium, which decays toward zero as expiration approaches).",
        },
        {
          prompt: "How does this platform display moneyness (ITM/ATM/OTM) on the Option Chain page?",
          options: ["A text badge reading 'ITM'/'ATM'/'OTM' on each row", "An unlabeled background-color tint on in-the-money cells only", "A separate 'Moneyness' column", "It is not shown anywhere on the chain page"],
          correctIndex: 1,
          explanation: "Confirmed by direct inspection: the platform shades ITM cells with a background tint but never prints a text label for ITM, ATM, or OTM anywhere in the live trading UI.",
        },
        {
          prompt: "What does this platform actually do when a short option's assignment risk becomes elevated?",
          options: ["It automatically closes the position", "It automatically exercises the offsetting long leg", "It computes and shows a rule-based risk level as a warning, with no automated action", "It transfers 100 shares to your account"],
          correctIndex: 2,
          explanation: "No exercise/assignment simulation or automation exists anywhere in this platform — it only computes a DTE- and moneyness-driven risk LEVEL to warn you; the position itself is never touched automatically.",
        },
        {
          prompt: "Every equity option on this platform controls how many shares of the underlying?",
          options: ["10", "50", "100", "It varies by symbol"],
          correctIndex: 2,
          explanation: "The 100-share contract multiplier is applied consistently across every dollar calculation this platform makes — credit, max profit/loss, theta, vega, and notional exposure.",
        },
        {
          prompt: "A short call position obligates the SELLER to do what if assigned?",
          options: ["Buy 100 shares at the strike", "Deliver (sell) 100 shares at the strike", "Pay the buyer the current premium", "Nothing — only buyers have obligations"],
          correctIndex: 1,
          explanation: "A short call's seller must deliver 100 shares at the strike if assigned; a short put's seller must buy 100 shares at the strike instead.",
        },
      ],
      relatedGlossaryKeys: ["option", "call", "put", "premium", "option-intrinsic-value", "extrinsic-value", "contract-multiplier", "assignment", "exercise", "in-the-money", "out-of-the-money", "at-the-money"],
      estimatedMinutes: 11,
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
      title: "Understanding the Greeks in Practice: Single-Position, Portfolio, and a Real Review Workflow",
      summary: "Delta, Gamma, Theta, and Vega aren't fixed numbers — a practical workflow for reading them at both the position and portfolio level, before and while you're in a trade.",
      body: [
        "The four Greeks this platform actually computes — Delta, Gamma, Theta, Vega — are all standard Black-Scholes sensitivities. Delta approximates directional exposure and probability of finishing in-the-money; Gamma is how fast Delta itself changes; Theta is the daily dollar decay (income for a seller); Vega is sensitivity to a 1-point move in implied volatility. Honest disclosure: Rho — sensitivity to interest rates — exists only as a glossary/teaching concept on this platform. It is not in the Greeks calculation anywhere in the codebase, and no interactive tool (including the Greeks Tutor) lets you select it. For the short-dated structures this platform builds, that's a reasonable simplification, not an oversight to work around.",
        "Single-position Greeks are computed live, on every request, directly from this platform's own pricing model — never read from a stale, entry-time database value. A position's Greeks at entry are not the same as its Greeks today; the platform deliberately recomputes rather than reusing an old number.",
        "Portfolio Greeks are a plain sum of every open position's own Greeks — net delta, net theta, net gamma, net vega for the whole account. One important, disclosed nuance: this platform's own Portfolio page currently labels its net-delta figure 'Beta-Weighted Delta,' but the underlying number is a straight, un-weighted sum, not an actual beta-adjustment — worth knowing so you don't over-read precision the label implies but the math doesn't deliver.",
        "How Greeks change as price, volatility, and time change is a real, live feature here, not just theory: the Portfolio Stress Test genuinely reprices every open position's Greeks under a hypothetical price shock, IV shock, or forward time-decay — using the exact same Black-Scholes math as the live Greeks display, not an approximation. Position Sizing and Trade Adjustment Preview both show a before/after Greeks comparison for a hypothetical new or adjusted position.",
        "Avoiding the trap of treating Greeks as fixed values means remembering two separate things: (1) this platform always recomputes them live rather than caching a stale figure, and (2) the underlying market data itself is simulated and stable within a single day (deterministically seeded per symbol, per calendar day) — so repeated checks on the same day return the same numbers unless you explicitly run a stress-test shock or the DTE itself changes. That stability is a property of the simulation, not of real markets, where Greeks genuinely move tick-by-tick.",
      ],
      whyItMatters: "A portfolio can look balanced position-by-position and still carry a large, unintended net directional or volatility bet once every position is summed — Portfolio Greeks is the number that actually matters, and knowing how to review it (and how it would move under a shock) before and during a trade is a genuine professional skill, not a one-time check at entry.",
      difficulty: "intermediate",
      whyItExists: "Delta, Gamma, Theta, and Vega already have their own dedicated, richer teaching pages (the Delta Masterclass and the interactive Greeks Tutor, both AI-narrated with live numbers) — this lesson deliberately doesn't re-derive each Greek from scratch. It exists to fill the real gap those pages don't cover: tying single-position and portfolio-level Greeks together, showing how they move under hypothetical shocks, and building an actual pre-trade and position-management review habit.",
      institutionalThinking: "A professional never reviews a Greek in isolation from the rest of the portfolio, and never assumes today's Greeks reading will still be true tomorrow. The discipline of re-checking portfolio Greeks — and running a shock scenario before a position is under real stress — is what separates reactive position management from a repeatable process.",
      screenWalkthrough: [
        "Portfolio page (`/portfolio`) — shows net Delta (labeled 'Beta-Weighted Delta,' though the underlying figure is a plain sum), Theta, Vega, Gamma for the whole account.",
        "Portfolio AI cockpit (`/portfolio-ai`) — a 'Portfolio Greeks' panel showing the same net totals plus a delta-status read (neutral/bullish/bearish) and a monthly theta-income projection.",
        "Position Sizing & Portfolio Impact Calculator (`/position-sizing`) — shows current-vs-hypothetical Greeks for a candidate new position, with explicit Δ/Γ/Θ/V impact figures.",
        "Trade Adjustment & Roll/Convert Preview (`/trade-adjustment-preview`) — a Before/After card showing the existing position's Greeks against the proposed adjustment's own Greeks, side by side.",
        "Portfolio Stress Test (`/stress-test`) — the base case shows today's real, unshocked Greeks; each scenario card then shows the change (ΔΔ/ΔΓ/ΔΘ/ΔV) under a genuine Black-Scholes repricing at the shocked inputs.",
      ],
      workflowSteps: [
        "Before entering a new position: check the Position Sizing page's own Greeks-impact panel to see exactly how the candidate would move your net portfolio Delta/Theta/Vega/Gamma, not just the position's own standalone numbers.",
        "After entering: periodically revisit the Portfolio or Portfolio AI page's net Greeks — remember the 'Beta-Weighted Delta' label is really a plain sum, so read it as directional exposure in dollar/delta terms, not a true market-relative beta figure.",
        "Before a known event (earnings, a scheduled macro release) or when volatility feels elevated: run the Portfolio Stress Test's High/Low Volatility presets to see how much your net Vega exposure would actually cost or benefit you.",
        "When considering rolling or converting an existing position: use the Trade Adjustment & Roll/Convert Preview's own Before/After Greeks comparison rather than mentally estimating the change.",
        "Remember Rho is real theory but isn't computed here — don't look for it in any of this platform's own Greeks displays.",
      ],
      metricsExplained: [
        { term: "Net Delta", explanation: "The signed sum of every open position's own delta — directional exposure for the whole account. This platform's own UI label ('Beta-Weighted Delta') implies a beta adjustment that the underlying math does not actually apply." },
        { term: "Net Theta", explanation: "Daily dollar decay income summed across every open position — also projected forward to a monthly figure on the Portfolio AI cockpit." },
        { term: "Δ/Γ/Θ/V Impact", explanation: "The Position Sizing and Trade Adjustment Preview pages' own before-vs-hypothetical-after Greeks comparison for a candidate trade." },
        { term: "Shocked Greeks", explanation: "The Portfolio Stress Test's real Black-Scholes repricing of every open position under a hypothetical price %, IV %, and/or forward time-decay-day shock — genuine math, not an approximation." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Checking portfolio impact before adding a new short-vega position",
          steps: [
            "Open Position Sizing, enter the candidate trade, and read the Δ/Θ/Γ/V impact panel — confirm the position moves net Theta in the intended (positive) direction without pushing net Vega to an uncomfortable level.",
            "Cross-check against the Portfolio page's own current Greeks to see the resulting 'after' total in context of the whole account, not just the one new trade.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "Reviewing Greeks only at entry, never again",
          steps: [
            "Checking Greeks once when a trade is opened and never revisiting the Portfolio page's net figures again means missing how the portfolio's aggregate exposure has shifted as other positions decayed, rolled, or were added.",
          ],
          note: "This platform recomputes Greeks live on every visit specifically so a periodic re-check is meaningful — not doing so wastes that design.",
        },
        {
          label: "Poor Opportunity",
          title: "Reading 'Beta-Weighted Delta' as if it were a true market-relative figure",
          steps: [
            "Treating the labeled figure as if it accounts for how volatile each underlying is relative to the broader market (a genuine beta-weighting) leads to over-trusting the precision of a number that is, honestly, a plain unweighted sum.",
          ],
        },
      ],
      commonMistakes: [
        "Looking for Rho anywhere in this platform's own displays — it doesn't exist here except as a glossary/teaching concept.",
        "Trusting the 'Beta-Weighted Delta' label at face value instead of recognizing it's an un-weighted sum.",
        "Checking Greeks only once, at trade entry, rather than treating portfolio-level Greeks as something to revisit as conditions change.",
        "Forgetting that within a single simulated day, repeated checks return identical numbers — a stable reading here doesn't mean real markets would behave the same way tick-by-tick.",
      ],
      riskWarnings: [
        "This is educational content, not financial advice, and does not recommend any specific position or adjustment.",
        "Greeks are model outputs (Black-Scholes) against simulated or, when a live provider is configured, real per-contract data — never a guarantee of how a position will actually behave.",
        "A defined-risk structure's Greeks can move meaningfully even though its own maximum loss stays capped — Greeks describe sensitivity, not risk limits.",
      ],
      bestPractices: [
        "Read portfolio-level Greeks alongside single-position Greeks — neither tells the whole story alone.",
        "Use the Stress Test's real shock repricing before a known volatility event, not just a static snapshot.",
        "Treat every Greeks figure as a live, recomputed-on-demand estimate, not a fixed property of a position.",
      ],
      externalHref: "/portfolio",
      relatedModuleHrefs: ["/portfolio", "/portfolio-ai", "/position-sizing", "/stress-test", "/learn/delta", "/learn/greeks"],
      aiCoachPrompts: [
        "What is my current net portfolio delta, and does it read bullish or bearish?",
        "How would my portfolio's Greeks change under a +20% IV shock?",
        "Explain why this platform doesn't compute Rho.",
        "Walk me through the Greeks impact of adding this new position to my existing portfolio.",
      ],
      nextStepKeys: [],
      knowledgeCheck: [
        {
          prompt: "Which Greek does this platform's own pricing engine NOT compute anywhere?",
          options: ["Delta", "Theta", "Vega", "Rho"],
          correctIndex: 3,
          explanation: "Rho is absent from the Greeks calculation entirely — confirmed by direct inspection of the pricing engine's own type definitions and every downstream display.",
        },
        {
          prompt: "What does the Portfolio page's 'Beta-Weighted Delta' label actually represent?",
          options: ["A true market-relative, beta-adjusted delta figure", "A plain, un-weighted sum of every position's own delta, despite the label", "The single largest position's own delta", "A theoretical maximum delta"],
          correctIndex: 1,
          explanation: "A real, disclosed label/implementation mismatch: the UI text says 'Beta-Weighted Delta,' but the value bound to it is a plain sum with no beta adjustment applied anywhere in the computation.",
        },
        {
          prompt: "How does the Portfolio Stress Test show 'how Greeks change as price/volatility/time change'?",
          options: ["It interpolates between two cached snapshots", "It genuinely re-runs the same Black-Scholes pricing model at shocked price/IV/time inputs", "It only estimates a rough percentage change", "It doesn't cover Greeks, only account value"],
          correctIndex: 1,
          explanation: "The stress test reuses the exact same pricing function as the live Greeks display, just fed shocked inputs — a genuine reprice, not an approximation.",
        },
        {
          prompt: "Why might checking portfolio Greeks only once, at trade entry, be a mistake?",
          options: ["Because Greeks never actually change", "Because this platform recomputes Greeks live and aggregate exposure shifts as other positions decay, roll, or are added", "Because Greeks are only meaningful at entry", "Because portfolio Greeks are unrelated to single-position Greeks"],
          correctIndex: 1,
          explanation: "Portfolio-level exposure is a moving target as the rest of the book changes — a one-time check at entry misses how the whole account's exposure evolves.",
        },
        {
          prompt: "Within a single simulated trading day, why do repeated Greeks checks on this platform return identical numbers?",
          options: ["Because the platform caches and reuses a stale value", "Because the underlying market data is deterministically seeded per symbol per calendar day, not a live tick-by-tick feed", "Because Greeks are mathematically constant", "This never happens — every check returns a different number"],
          correctIndex: 1,
          explanation: "The platform always recomputes live (never a cached/stale figure), but the underlying simulated price/IV data is itself stable within a given day by design — a property of the simulation, not of real markets.",
        },
      ],
      relatedGlossaryKeys: ["portfolio-greeks", "delta", "theta", "gamma", "vega", "rho"],
      estimatedMinutes: 10,
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
      summary: "What the stock has actually done, as opposed to what the market expects — a real concept this platform does not compute.",
      body: [
        "Historical (realized) volatility measures how much a stock has actually moved in the past, computed from its own price history — distinct from IV's forward-looking, market-implied estimate. Comparing IV to HV is a real, standard professional technique: a persistent gap in IV's favor (IV running above HV) is the structural edge behind systematic premium selling.",
        "Honest disclosure: this platform does not compute or display HV anywhere. No historical/realized-volatility calculation exists in the codebase — only IV (and IV Rank) are computed. If you want to compare this platform's own IV figure against a stock's real historical volatility, you would need a separate tool for the HV side of that comparison.",
      ],
      whyItMatters: "The volatility-risk-premium haircut this platform applies when computing Probability of Profit exists specifically because IV tends to systematically overstate realized (historical) volatility — even though this platform itself never shows you the HV figure directly to verify that gap yourself.",
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
    topic({
      key: "volatility-pricing-probability",
      title: "Options Pricing, Volatility and Probability: Liquidity, POP, Breakeven, and EV in Practice",
      summary: "How this platform actually reads a contract's price and odds before a trade — bid/ask, liquidity, POP, breakeven, max profit/loss, expected value, and return on capital, each honestly labeled as real math or a model estimate.",
      body: [
        "Every contract on the Option Chain page shows real Bid, Mid, and Ask — the gap between bid and ask (the spread) is a direct liquidity signal: a wide spread relative to the mid means you'd give up real money crossing it to trade immediately. This platform enforces its own liquidity gates server-side (a minimum open interest and a maximum spread percentage) before a contract can ever reach a scanner result or trade ticket — a contract that fails either check is silently filtered out, never shown to you with a labeled rejection reason on the chain or scanner screens themselves; only aggregate 'Rejected (Liquidity)' counts surface, on the Dashboard.",
        "Probability of Profit (POP) is a real, computed figure — the model-estimated chance a position finishes profitable by expiration, derived from delta with a disclosed volatility-risk-premium haircut applied (since implied volatility tends to systematically overstate how much a stock actually moves). This is a genuine, honest disclosure worth internalizing: POP is not a guarantee, and a high POP does not mean success is assured — an 80% POP still means roughly 1 in 5 similar trades lose.",
        "Breakeven price(s), Maximum Profit, and Maximum Loss are real, exact math on the structure's own strikes and credit — for an iron condor or iron fly, the platform computes precise breakevens; for a calendar spread or an earnings play, it honestly reports these as unavailable with a stated reason rather than showing a misleading number for a structure its math doesn't cleanly support.",
        "Expected Value (EV) is the probability-weighted dollar outcome: (POP × max profit) − ((1 − POP) × max loss). Since EV inherits the same POP calculation, it carries the same volatility-risk-premium caveat. This platform uses EV as a hard gate — a structure with EV at or below zero is rejected before it ever reaches a scanner result, the same silent-filtering pattern as the liquidity gate above.",
        "Return on Capital (ROC) expresses profit as a percentage of the capital actually at risk (typically max loss for a defined-risk spread) — a real, exact ratio once max profit and max loss are known, letting you compare trades of very different sizes on equal footing.",
      ],
      whyItMatters: "Every one of these figures is either exact structural math (breakeven, max profit/loss, ROC) or a disclosed model estimate (POP, EV) — knowing which is which, and knowing that a rejected-for-liquidity contract simply disappears rather than showing you why, changes how much weight you put on a number before trusting it.",
      difficulty: "intermediate",
      whyItExists: "The existing Volatility path's own topics (IV, IV Rank, Expected Move, Earnings/IV Crush) already teach volatility itself thoroughly. This lesson exists to cover the genuinely separate ground the module asked for — how the platform prices and evaluates a specific trade's odds and payoff — without re-deriving what those sibling topics already teach well.",
      institutionalThinking: "A professional never treats a model-derived probability (POP, EV) with the same confidence as an exact structural calculation (breakeven, max loss) — both are useful, but only one is guaranteed by the position's own math regardless of what the market actually does.",
      screenWalkthrough: [
        "Option Chain page — real Bid/Mid/Ask per contract; no volume or open-interest column is shown here even though the underlying data exists.",
        "Scanner page — POP and EV columns per scanned opportunity; a candidate that failed the platform's own liquidity or EV gate never appears in this list at all.",
        "Trade Ticket page — an 8-tile metric grid showing Net Credit/Debit, Max Profit, Max Loss, Buying Power, POP, Expected Value, Return on Capital, and DTE together for the specific contract you're reviewing.",
        "Dashboard page — 'Rejected (Liquidity)' and 'Rejected (Risk)' tiles show only aggregate counts of how many candidates were filtered out this scan, never an inspectable list of which contracts or why.",
      ],
      workflowSteps: [
        "On the Option Chain, compare Bid/Ask spread across a few candidate strikes before picking one — a tight spread relative to mid is a good early liquidity sign.",
        "On the Scanner, read POP and EV together, not POP alone — a high POP with a small EV (or an EV close to zero) is a very different opportunity than a high POP with a healthy EV.",
        "On the Trade Ticket, check whether Max Profit/Max Loss/Breakeven are shown as real numbers or an honest 'unavailable' — for calendar spreads and earnings plays, expect the latter.",
        "Use Return on Capital to compare two differently-sized candidates on equal footing, rather than comparing their raw dollar credit alone.",
        "If a symbol you expected to see on the Scanner doesn't appear, remember it may have been silently filtered by the liquidity or EV gate — check the Dashboard's aggregate rejection counts rather than assuming the platform missed it.",
      ],
      metricsExplained: [
        { term: "Bid/Ask Spread", explanation: "The gap between the highest buy offer and lowest sell offer for a contract — a direct, real liquidity signal, gated server-side against a maximum percentage threshold." },
        { term: "Probability of Profit (POP)", explanation: "A model-estimated chance of finishing profitable, derived from delta with a disclosed volatility-risk-premium haircut — an estimate, never a guarantee." },
        { term: "Breakeven", explanation: "The exact underlying price at which a position neither gains nor loses at expiration — real math for the strategies this platform's structure-builders support, honestly unavailable (with a reason) otherwise." },
        { term: "Expected Value (EV)", explanation: "POP-weighted average dollar outcome — inherits POP's own volatility-risk-premium caveat, and used as a hard reject gate below zero." },
        { term: "Return on Capital (ROC)", explanation: "Profit as a percentage of capital at risk (max loss) — a real, exact ratio for comparing trades of different sizes." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A tight-spread, positive-EV candidate with a real breakeven",
          steps: [
            "On the Scanner, a candidate shows a healthy POP alongside a meaningfully positive EV — both figures pointing the same direction, not just one.",
            "Opening it on the Trade Ticket confirms real (non-null) Max Profit, Max Loss, and Breakeven figures, and a bid/ask spread on the chain that was tight relative to the mid.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "High POP, thin EV",
          steps: [
            "A structure shows a very high POP but a comparatively small EV — the high win-rate framing can be misleading on its own; the position's edge, once sized for the (smaller) loss scenario, is modest.",
          ],
          note: "POP and EV answer different questions — how often you win, versus how much you'd expect to make per trade on average, including the losses.",
        },
        {
          label: "Poor Opportunity",
          title: "A contract rejected for poor liquidity",
          steps: [
            "A candidate strike never appears on the Scanner at all — not because it was a bad trade idea, but because it failed the platform's own minimum open-interest or maximum-spread liquidity gate before ever reaching you.",
            "The only visible trace is an incremented 'Rejected (Liquidity)' count on the Dashboard — the platform does not show you the specific contract or its exact spread/OI figures that triggered the rejection.",
          ],
          note: "This is a real, disclosed platform limitation, not a mistake on your part — there is currently no per-contract rejection-review screen.",
        },
      ],
      commonMistakes: [
        "Treating POP as a guarantee of success rather than a disclosed, haircut-adjusted model estimate.",
        "Reading POP alone without also checking EV — a high win rate can still carry a thin or negative expected edge.",
        "Assuming a candidate that doesn't appear on the Scanner was simply 'not found' rather than silently filtered by a liquidity or EV gate.",
        "Expecting a Breakeven figure for every strategy — calendar spreads and earnings plays honestly report it unavailable rather than showing an approximation.",
      ],
      riskWarnings: [
        "This is educational content, not financial advice, and does not recommend any specific trade.",
        "A high probability of profit does not guarantee a profitable outcome on any individual trade — it describes a long-run tendency across many similar trades, not a certainty.",
        "Every pricing/probability figure here is model-derived (from simulated or, when a live provider is configured, real market data) and can change before any real order is placed.",
      ],
      bestPractices: [
        "Always read POP and EV together, never POP in isolation.",
        "Check whether Breakeven/Max Profit/Max Loss are real numbers or an honest 'unavailable' for the specific strategy you're viewing.",
        "Remember a missing candidate on the Scanner may simply have been filtered, not overlooked.",
      ],
      relatedModuleHrefs: ["/options/SPY", "/scanner", "/options-dashboard"],
      aiCoachPrompts: [
        "Explain the volatility-risk-premium haircut this platform applies to Probability of Profit.",
        "Why might this candidate have a high POP but a low expected value?",
        "What does an 'unavailable' breakeven mean for this specific strategy?",
        "Why doesn't this symbol appear on my scan results?",
      ],
      nextStepKeys: [],
      knowledgeCheck: [
        {
          prompt: "What does this platform do with a contract that fails its own liquidity gate (too wide a spread or too little open interest)?",
          options: ["Shows it on the Scanner with a warning label", "Silently filters it out before it reaches any scanner result or trade ticket", "Automatically widens the acceptable spread threshold", "Blocks the entire symbol from being scanned again"],
          correctIndex: 1,
          explanation: "Confirmed: rejected candidates are filtered server-side and never individually surfaced — only an aggregate 'Rejected (Liquidity)' count appears on the Dashboard.",
        },
        {
          prompt: "Does a high Probability of Profit (POP) guarantee that a trade will be profitable?",
          options: ["Yes, POP is a certainty once computed", "No — it's a model estimate with a disclosed volatility-risk-premium haircut, describing a long-run tendency, not a guarantee", "Only for defined-risk structures", "Only when EV is also positive"],
          correctIndex: 1,
          explanation: "POP is explicitly disclosed as a model estimate — an 80% POP still means roughly 1 in 5 similar trades lose. It is never a guarantee of any individual outcome.",
        },
        {
          prompt: "What happens when this platform can't cleanly compute a breakeven for a given strategy (e.g. a calendar spread)?",
          options: ["It shows an approximate, rounded figure", "It honestly reports the figure unavailable with a stated reason", "It reuses the breakeven from a similar strategy", "It hides the entire trade ticket"],
          correctIndex: 1,
          explanation: "Per the platform's own honesty discipline, breakeven is only computed for strategies its math cleanly supports (iron condors/flies) — calendars and earnings plays get an honest unavailable-with-reason instead of a misleading number.",
        },
        {
          prompt: "Expected Value (EV) is computed how?",
          options: ["A flat percentage of premium collected", "(POP × max profit) − ((1 − POP) × max loss)", "Max profit divided by max loss", "The average of max profit and max loss"],
          correctIndex: 1,
          explanation: "EV is the probability-weighted average dollar outcome, and because it uses POP as an input, it inherits POP's own volatility-risk-premium haircut disclosure.",
        },
        {
          prompt: "Why is Return on Capital (ROC) useful for comparing two different trades?",
          options: ["It ignores risk entirely", "It expresses profit as a percentage of capital actually at risk, letting differently-sized trades be compared on equal footing", "It's identical to raw dollar profit", "It only applies to undefined-risk positions"],
          correctIndex: 1,
          explanation: "A $50 profit on $200 at risk (25% ROC) is a very different result from a $50 profit on $2,000 at risk (2.5% ROC) — raw dollars alone can mislead.",
        },
      ],
      relatedGlossaryKeys: ["bid-ask-spread", "open-interest", "probability-of-profit", "breakeven", "max-profit", "max-loss", "expected-value", "return-on-capital"],
      estimatedMinutes: 12,
    }),
  ],
};

const STRATEGIES_PATH: LearningPath = {
  key: "strategies",
  title: "Options Strategies",
  description: "How individual option legs combine into defined, repeatable structures — full detail lives in the Strategy Academy.",
  glossaryCategory: "strategies",
  topics: [
    // v1.4.0, Sprint L2G — Options Strategies Academy. NEW topic. Long Call
    // is genuinely not built, priced, scanned, or order-routable anywhere
    // in this platform — execution.ts's Strategy union is exhaustively
    // "iron_condor" | "iron_fly" | "calendar_spread" | "earnings"
    // (execution.ts:51), and Scanner.tsx's own filter offers exactly those
    // four values. This lesson teaches the real, standard options-theory
    // mechanics of buying a call while being explicit that the only real
    // platform grounding available is viewing a specific contract's live
    // Delta/Theta/IV/Bid/Mid/Ask on the Option Chain page — never a
    // fabricated "how to trade a long call on this platform" workflow.
    topic({
      key: "strategies-long-call",
      title: "Long Call: Buying Upside Directly",
      summary: "Pay a premium for the right to buy stock at a fixed price — defined risk, open-ended upside, and a real look at why this platform doesn't build or price it as a standalone trade.",
      body: [
        "A long call is the simplest directional options strategy: you pay a premium to buy the right (not the obligation) to purchase 100 shares at the strike price, any time before expiration. Market outlook: bullish — you profit as the stock rises above your breakeven. Maximum loss is defined and known in advance: the entire premium you paid, and nothing more (no margin call, no unlimited downside) — if the stock never reaches your strike, the call simply expires worthless. Maximum profit is theoretically open-ended, since a stock's price has no upper cap, though in practice every real trade is closed well before that theoretical ceiling matters.",
        "Breakeven at expiration is strike price plus premium paid, per share. A $100-strike call bought for $3.00 needs the stock above $103 at expiration just to break even — everything above that is profit, everything below is a partial or total loss of the premium. This is why 'being right on direction' is necessary but not sufficient: the stock also has to move far enough, and fast enough, to clear both the strike and the premium you paid.",
        "The Greeks behave in a very specific way for a long call, and this platform's own live Option Chain (see Platform Implementation below) shows them for real, per strike: Delta is positive and grows as the stock rises and the option moves further in-the-money — a deep ITM call can behave almost like owning 100 shares outright (a 'stock-replacement' trade), while a far out-of-the-money call has low delta and needs a large move just to start responding meaningfully. Theta is negative — every long option loses value to time decay, and that decay accelerates as expiration approaches, working against you even if your directional view is eventually correct. Vega is positive — a long call gains value from rising implied volatility and loses value if IV collapses, which is exactly what tends to happen right after an anticipated catalyst (like earnings) resolves, even when the stock moves in your favor.",
        "Risk profile: this is a defined-risk position by construction — the most you can ever lose is the premium paid, full stop. There is no assignment risk on the buyer's side (you hold the right, you're never obligated), and no naked/uncovered exposure of the kind this platform's own execution engine structurally blocks for every trade it does build. That said, defined risk does not mean low risk: losing 100% of the premium on a single trade is a common, real outcome for an OTM call that expires worthless, and doing that repeatedly is a fast way to erode an account even though no single trade technically has 'unlimited' downside.",
        "Platform implementation, stated plainly: this platform's own scanner and execution engine do not build, price, scan for, or route an order for a standalone long call — it is not one of the four strategies execution.ts's own Strategy type supports (iron_condor, iron_fly, calendar_spread, earnings). There is no 'buy a call' button anywhere in this platform. What is real: the Option Chain page shows live, per-strike Delta, Theta, IV, and Bid/Mid/Ask pricing for every call at every strike in the current expiration — you can use it to see exactly what a specific long call would actually cost and how its Greeks look before ever placing a trade elsewhere. And the Options Fundamentals lesson's own worked examples already include a real, worked illustration of a deep-ITM long call used as a stock-replacement trade — cross-reference it below rather than duplicating it here.",
      ],
      whyItMatters: "Every multi-leg strategy this platform actually builds is assembled from single legs like this one — understanding a long call in isolation (its Greeks, its decay, its breakeven math) is the prerequisite for understanding why a spread trades the way it does, even though you'll never place this exact trade through this platform's own scanner.",
      externalHref: "/options/SPY",
      relatedGlossaryKeys: ["long-call", "call", "delta", "theta", "vega", "breakeven", "defined-risk"],
      estimatedMinutes: 9,
      difficulty: "beginner",
      whyItExists: "Every options education path has to start with the single-leg case before combinations make sense — but this platform's own engine skips straight to defined-risk multi-leg structures, so this lesson exists specifically to bridge that gap honestly, without pretending a single-leg workflow exists here.",
      institutionalThinking: "Professional options desks rarely trade naked long calls as a primary income strategy — they're a directional, often volatility-expensive way to express a view, which is exactly why this platform's own engine focuses on defined-risk, credit-collecting, probability-weighted structures instead. Understanding why desks prefer the latter starts with understanding the former's real cost structure.",
      screenWalkthrough: [
        "Navigate to the Option Chain page (Options Chain and Contract Selection lesson covers the full navigation) and pick any symbol — the URL is /options/SYMBOL, e.g. /options/AAPL.",
        "The CALLS half of the table (left side) shows every available strike with its live Delta, Theta, IV, and Bid/Mid/Ask columns.",
        "Pick a strike above the current price (out-of-the-money, lower delta, cheaper premium) and one below it (in-the-money, higher delta, more expensive) to compare side by side.",
        "Notice how Delta rises and Theta's magnitude changes as you move from OTM through ATM to ITM strikes — this is the live version of the theory in the body text above, not a simulation.",
      ],
      workflowSteps: [
        "Form a directional thesis: why do you expect the stock to rise, and over what time horizon?",
        "On the Option Chain, compare strikes at different deltas to see how cost and sensitivity trade off against each other.",
        "Calculate your own breakeven (strike + premium) before considering any trade — do this by hand, since no page on this platform computes it for a standalone long call.",
        "Recognize that this platform's own execution engine cannot place this order — any actual long-call trade would happen outside this platform entirely.",
        "Instead, consider whether this platform's own Iron Condor or Calendar Spread — both real, tradeable, defined-risk structures — better expresses a similar view with a probability-weighted edge instead of a pure directional bet.",
      ],
      metricsExplained: [
        { term: "Delta (long call)", explanation: "Positive, 0 to 1. Approximates both the option's directional sensitivity and, loosely, its probability of expiring in-the-money — a 0.70 delta call behaves much more like owning stock than a 0.15 delta call does." },
        { term: "Theta (long call)", explanation: "Negative. The dollar amount the option loses per day, all else equal, purely from the passage of time — this cost is paid whether or not you're eventually right about direction." },
        { term: "Breakeven", explanation: "Strike price + premium paid, per share. The stock must close above this level at expiration for the position to show any profit at all." },
        { term: "Premium at risk", explanation: "The total dollar amount paid to open the position — this is also, exactly, the maximum possible loss on a long call, never more." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A deep-ITM call bought for a clear, time-appropriate thesis",
          steps: [
            "A stock at $150 has a well-defined near-term catalyst roughly 30 days out.",
            "A 90-delta, 45-DTE call is chosen deliberately — deep enough ITM that it behaves close to owning the stock, with a smaller relative theta cost than a cheaper OTM call.",
            "The trader calculates breakeven by hand (strike + premium) before entering, and sizes the position knowing the entire premium is the maximum loss.",
          ],
          note: "This is the same deep-ITM, stock-replacement pattern the Options Fundamentals lesson's own worked example illustrates — see Related Lessons below rather than a second, duplicated example here.",
        },
        {
          label: "Average Opportunity",
          title: "An at-the-money call with a reasonable but not ideal horizon",
          steps: [
            "A 50-delta, 30-DTE call is bought on a general bullish lean with no specific catalyst date.",
            "The position has meaningfully higher theta decay relative to its cost than the deep-ITM example, and needs a real move to become profitable, not just 'being right eventually.'",
          ],
          note: "Directionally reasonable, but the shorter, cheaper structure trades a lower entry cost for a materially higher decay burden — a real trade-off, not free money.",
        },
        {
          label: "Poor Opportunity",
          title: "A far-OTM, short-dated 'lottery ticket' call",
          steps: [
            "A stock at $150 is expected to make a large move 'soon,' with no specific timeline.",
            "A cheap, 10-delta, 7-DTE call is bought purely because it's inexpensive.",
            "Theta decay is severe on such a short-dated contract, and the low delta means even a real move often isn't enough, fast enough, before expiration.",
          ],
          note: "This is the single most common long-call mistake: mistaking a cheap premium for a good trade. A 10-delta option has roughly a 1-in-10 rough approximation of finishing ITM — most of these expire worthless.",
        },
      ],
      commonMistakes: [
        "Treating premium cost as the only variable that matters, ignoring delta (probability) and theta (decay speed) entirely.",
        "Buying far out-of-the-money, short-dated calls as cheap 'lottery tickets' — the single most common way to lose 100% of the premium repeatedly.",
        "Not accounting for implied volatility crush after an anticipated event (like earnings) resolves — the stock can move in your favor and the option can still lose value if IV collapses hard enough.",
        "Assuming this platform can execute this trade — it cannot; only Iron Condor, Iron Fly, Calendar Spread, and Earnings orders route through this platform's execution engine.",
      ],
      riskWarnings: [
        "Maximum loss is 100% of the premium paid, and that outcome is common, not rare, for options that expire out-of-the-money.",
        "Theta decay works against this position every single day it's held, regardless of whether the directional thesis is correct.",
        "This lesson is educational only — nothing here is a recommendation to buy any specific option, and no example above should be read as a promise of profit.",
      ],
      bestPractices: [
        "Match the option's expiration to your actual thesis horizon, not to whatever is cheapest.",
        "Consider deeper ITM strikes for a stock-replacement approach — higher delta and comparatively lower theta/vega exposure than a cheap OTM contract.",
        "Check the real bid/ask spread on the Option Chain before assuming you could actually get filled anywhere near the displayed mid price.",
      ],
      relatedModuleHrefs: ["/options/SPY", "/learn/greeks", "/scanner"],
      aiCoachPrompts: [
        "Explain why a long call's theta works against me even if I turn out to be right about direction.",
        "Show me how delta changes as a long call moves from out-of-the-money to deep in-the-money.",
        "What's the practical difference between buying a call outright and using this platform's Iron Condor if I have a bullish view?",
        "Why does implied volatility crush hurt a long call even when the stock moves the right way?",
      ],
      nextStepKeys: ["strategies-long-put"],
      knowledgeCheck: [
        {
          prompt: "What is the maximum possible loss on a long call position?",
          options: ["Unlimited", "The premium paid, and nothing more", "The strike price times 100", "There is no defined maximum"],
          correctIndex: 1,
          explanation: "A long call's risk is fully defined at entry: the most you can ever lose is the premium you paid, since you simply let the option expire worthless if it's not profitable.",
        },
        {
          prompt: "What is the breakeven price at expiration for a long call?",
          options: ["The strike price alone", "The current stock price", "Strike price plus premium paid per share", "Strike price minus premium paid per share"],
          correctIndex: 2,
          explanation: "The stock must rise above the strike by at least the amount of premium paid, per share, before the position shows any net profit.",
        },
        {
          prompt: "Can this platform's scanner or execution engine build and route an order for a standalone long call?",
          options: ["Yes, via the Scanner's strategy filter", "Yes, but only through the Trade Ticket page directly", "No — only Iron Condor, Iron Fly, Calendar Spread, and Earnings are supported", "Yes, automatically through full-auto mode"],
          correctIndex: 2,
          explanation: "execution.ts's Strategy type is exhaustively iron_condor, iron_fly, calendar_spread, and earnings — a standalone long call is not one of the strategies this platform builds, prices, or trades.",
        },
        {
          prompt: "Why does a long call lose value purely from the passage of time, even if the stock price doesn't move?",
          options: ["Because of negative theta (time decay)", "Because of negative delta", "Because of positive vega", "It doesn't — long calls are unaffected by time"],
          correctIndex: 0,
          explanation: "Every long option position has negative theta — it decays in value each day purely from time passing, independent of any price movement.",
        },
        {
          prompt: "A trader buys a cheap, far out-of-the-money call expiring in 7 days as a 'lottery ticket.' What is the most likely outcome?",
          options: ["Guaranteed large profit if the market is bullish", "The option most likely expires worthless, losing the full premium", "The trade is risk-free since the premium is small", "The stock is guaranteed to reach the strike"],
          correctIndex: 1,
          explanation: "Low-delta, short-dated options have a low probability of finishing in-the-money and severe theta decay — this is the classic pattern behind most long-call losses.",
        },
      ],
    }),
    // v1.4.0, Sprint L2G — Options Strategies Academy. NEW topic. Mirrors
    // strategies-long-call's structure exactly for the put side — same
    // honest "not implemented" disclosure, same real Option Chain grounding.
    topic({
      key: "strategies-long-put",
      title: "Long Put: Buying Downside Directly",
      summary: "Pay a premium for the right to sell stock at a fixed price — defined risk, a bearish view, and the same honest platform-implementation gap as the long call.",
      body: [
        "A long put is the mirror image of a long call: you pay a premium for the right (not the obligation) to sell 100 shares at the strike price, any time before expiration. Market outlook: bearish — you profit as the stock falls below your breakeven. Maximum loss is defined at entry: the entire premium paid, and nothing more. Maximum profit is large but not literally unlimited — a stock's price is bounded at zero, so the theoretical ceiling on profit is the strike price minus the premium paid, realized only if the stock goes all the way to $0.",
        "Breakeven at expiration is strike price minus premium paid, per share. A $100-strike put bought for $3.00 needs the stock below $97 at expiration just to break even. As with the long call, being directionally correct is necessary but not sufficient — the move has to clear both the strike and the premium within the option's remaining life.",
        "Position construction is simple by design: one leg, one order, no combination of strikes. Greeks mirror the long call with signs flipped for direction: Delta is negative (the position gains as the stock falls), Theta is still negative (time decay works against every long option regardless of direction), and Vega is still positive (a long put gains value from rising implied volatility, which is why puts are often bought specifically as insurance ahead of anticipated volatility spikes, not just as a bearish direction bet).",
        "Risk management for a long put is genuinely straightforward compared to short or multi-leg structures: the position is defined-risk by construction, there's no assignment risk for the buyer, and no naked exposure of the kind this platform's own execution engine structurally rejects for anything it does build. The real risk is the same as the long call's — losing the full premium is a common outcome, not a rare one, when the move doesn't happen in time.",
        "Platform implementation, stated plainly, and this is the same honest gap as the long call: this platform's scanner and execution engine do not build, price, scan for, or route an order for a standalone long put. It is not one of execution.ts's four supported Strategy values. Trade review on this platform, in the sense of an actual position ledger, applies to the Iron Condor / Iron Fly / Calendar Spread positions the platform does open and track — a standalone long put would need to be reviewed entirely outside this platform. What is real and useful: the Option Chain's PUTS half (the right-hand side of the table) shows the exact same live Delta/Theta/IV/Bid/Mid/Ask detail for every put strike that the CALLS side shows for calls.",
      ],
      whyItMatters: "A long put is also the exact hedge instrument behind Protective Puts (the next lesson) — understanding it as a standalone directional bet first makes the hedging use case make sense afterward.",
      externalHref: "/options/SPY",
      relatedGlossaryKeys: ["long-put", "put", "delta", "theta", "vega", "breakeven", "defined-risk"],
      estimatedMinutes: 8,
      difficulty: "beginner",
      whyItExists: "Puts are frequently taught as an afterthought to calls, but a genuinely complete strategies curriculum needs the mirror case on its own — especially since the Protective Put lesson immediately after this one depends on understanding a standalone long put first.",
      institutionalThinking: "Institutional desks buy puts far more often for hedging (protecting an existing position) than as a pure directional bearish bet — the Protective Put lesson picks up exactly that use case next.",
      screenWalkthrough: [
        "Navigate to the Option Chain page for any symbol (/options/SYMBOL).",
        "The PUTS half of the table (right side) mirrors the CALLS layout: Bid/Mid/Ask, IV, Theta, and Delta per strike.",
        "Put deltas display as negative numbers on this platform's chain, matching standard options convention — a -0.50 delta put is the analogue of a 0.50 delta call.",
        "Compare an in-the-money put (strike above current price) against an out-of-the-money put (strike below current price) to see the same delta/theta trade-off the long call lesson covered, mirrored.",
      ],
      workflowSteps: [
        "Form a bearish thesis with a specific time horizon in mind.",
        "Compare strikes at different deltas on the Option Chain's PUTS side.",
        "Calculate breakeven by hand (strike − premium) — no page on this platform computes this for a standalone long put.",
        "Recognize this platform's execution engine cannot route this order.",
        "Consider whether an existing bearish-leaning structure this platform does build (e.g., an Iron Fly positioned for a range-bound-to-lower view) better fits, or whether the actual goal is hedging an existing position — in which case, see Protective Put next.",
      ],
      metricsExplained: [
        { term: "Delta (long put)", explanation: "Negative, -1 to 0. The position gains value as the stock falls; a -0.70 delta put behaves closer to a short-stock position than a -0.15 delta put does." },
        { term: "Theta (long put)", explanation: "Negative, same as a long call — every long option position decays with time, regardless of direction." },
        { term: "Breakeven", explanation: "Strike price − premium paid, per share. The stock must close below this level at expiration for any net profit." },
        { term: "Maximum theoretical profit", explanation: "Strike price minus premium paid, per share — realized only in the extreme case of the stock falling to $0, unlike a long call's genuinely open-ended upside." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A moderately ITM put sized to a specific bearish thesis and horizon",
          steps: [
            "A stock shows deteriorating fundamentals with a specific, dated catalyst roughly a month out.",
            "A put with enough time value (DTE comfortably beyond the catalyst) and a strike close to or slightly above the current price is chosen deliberately.",
            "Breakeven is calculated by hand before entry, and the full premium is treated as the position's maximum loss.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "A general bearish-lean put with no specific catalyst",
          steps: [
            "A 30-DTE, near-the-money put is bought on a broad 'this looks toppy' view with no dated event.",
            "The position carries real theta decay with no specific timeline forcing the move — a reasonable but unfocused thesis.",
          ],
        },
        {
          label: "Poor Opportunity",
          title: "A deep-OTM, short-dated put bought after a stock has already dropped sharply",
          steps: [
            "A stock has already fallen 15% in a week; a trader buys a cheap, far-OTM put expecting 'more downside,' chasing the move rather than anticipating it.",
            "Implied volatility is often already elevated after a sharp move, making the put comparatively expensive for the probability it's actually pricing in.",
          ],
          note: "Buying protection or direction after a large move has already happened, when IV has already repriced, is a well-documented way to overpay for a position with a lower real edge than it appears to have.",
        },
      ],
      commonMistakes: [
        "Chasing a move that's already happened, buying puts only after a stock has already dropped sharply and IV has already repriced higher.",
        "Ignoring that theta decay applies to puts exactly as it does to calls — a long put is not exempt from time decay.",
        "Confusing 'bearish direction bet' with 'portfolio hedge' — they use the same instrument but have different sizing and time-horizon logic (see Protective Put).",
        "Assuming this platform can execute a standalone put order — it cannot; only Iron Condor, Iron Fly, Calendar Spread, and Earnings route through execution.ts.",
      ],
      riskWarnings: [
        "Maximum loss is 100% of the premium paid — a common, not rare, outcome for an option that expires out-of-the-money.",
        "Puts are frequently more expensive, for a given delta, during periods of elevated implied volatility — check IV rank/percentile context before assuming a put is fairly priced.",
        "This lesson is educational only, and no worked example above is a recommendation or a profit guarantee.",
      ],
      bestPractices: [
        "Distinguish a directional bearish bet from a hedge before sizing the position — the two have different objectives and different acceptable costs.",
        "Check where implied volatility sits (IV rank/percentile) before buying — a put bought when IV is already elevated is comparatively expensive.",
        "Match expiration to your actual thesis horizon rather than defaulting to the cheapest available date.",
      ],
      relatedModuleHrefs: ["/options/SPY", "/learn/greeks", "/scanner"],
      aiCoachPrompts: [
        "Explain the difference between buying a put as a directional bet versus buying it as portfolio insurance.",
        "Why is a put's delta expressed as a negative number, and what does -0.40 delta actually mean?",
        "How does implied volatility affect what a put costs, independent of the stock's direction?",
        "What's the maximum theoretical profit on a long put, and why is it different from a long call's?",
      ],
      nextStepKeys: ["strategies-protective-put"],
      knowledgeCheck: [
        {
          prompt: "What is the breakeven price at expiration for a long put?",
          options: ["Strike price plus premium paid", "Strike price minus premium paid, per share", "The current stock price", "There is no breakeven for a put"],
          correctIndex: 1,
          explanation: "The stock must fall below the strike by at least the premium paid, per share, before the position shows a net profit.",
        },
        {
          prompt: "Why is a long put's maximum theoretical profit not literally unlimited, unlike a long call's?",
          options: ["Puts have no maximum profit either", "A stock's price is bounded at zero, capping the put's maximum gain at strike minus premium", "Puts always expire worthless", "Maximum profit on a put equals the premium paid"],
          correctIndex: 1,
          explanation: "A stock can rise indefinitely (uncapped call profit) but can only fall to $0 (capped put profit at strike price minus premium paid).",
        },
        {
          prompt: "What sign is Delta for a long put position?",
          options: ["Always positive", "Always negative", "Always zero", "It depends only on the strike, never the position type"],
          correctIndex: 1,
          explanation: "A long put has negative delta by convention — the position gains value as the underlying stock price falls.",
        },
        {
          prompt: "Does this platform's scanner or execution engine support placing a standalone long put order?",
          options: ["Yes, through the Scanner's strategy filter", "Yes, but only in full-auto mode", "No — only Iron Condor, Iron Fly, Calendar Spread, and Earnings are supported", "Yes, through the Option Chain page directly"],
          correctIndex: 2,
          explanation: "execution.ts's Strategy type does not include a standalone put-buying strategy — the Option Chain only displays live pricing/Greeks, it does not route orders.",
        },
        {
          prompt: "A trader buys a far out-of-the-money put right after a stock has already fallen sharply. What's the key risk being described?",
          options: ["There is no added risk — the thesis is confirmed by the recent drop", "Implied volatility has likely already repriced higher, making the put comparatively expensive for its real edge", "Puts cannot be bought after a stock has fallen", "The premium is guaranteed to be refunded if the thesis is late"],
          correctIndex: 1,
          explanation: "Chasing a move after it's already happened, when IV has already repriced upward, is a well-documented way to overpay relative to the position's actual statistical edge.",
        },
      ],
    }),
    // v1.4.0, Sprint L2G — Options Strategies Academy. Upgraded in place
    // (key preserved). Covered Call is genuinely not built or priced by
    // this platform's execution engine (strategyAcademy.ts's own
    // builtByThisEngine: false, confirmed by direct inspection of
    // execution.ts's exhaustive Strategy type) — but real platform
    // grounding does exist: the pre-existing Strategy Academy detail page
    // and a real, routed Payoff Diagram Simulator. This lesson leans on
    // both rather than inventing a scanner/execution workflow that
    // doesn't exist, per the brief's own "document this clearly rather
    // than inventing functionality" instruction.
    topic({
      key: "strategies-covered-calls",
      title: "Covered Call: Selling Income Against Shares You Own",
      summary: "Own 100 shares, sell a call against them for premium income — real assignment mechanics, real management choices, and an honest look at why this platform doesn't scan for or price this trade.",
      body: [
        "A covered call means owning 100 shares of stock and selling one call option against them. You collect the option's premium immediately as income, in exchange for capping your upside at the strike price for the life of the option — if the stock rises above the strike, your shares are likely to be called away (sold) at that strike, and any further upside beyond it belongs to the option buyer, not you. Income generation is the entire point: the premium collected is yours to keep regardless of what happens afterward, and it partially offsets any decline in the stock's own price, though it does not eliminate that risk — the stock itself remains the primary source of loss if it falls significantly.",
        "Assignment risk is real and mechanical, not hypothetical: if the stock closes above the strike at expiration (or, for an American-style option, is exercised early — most commonly right before an ex-dividend date, when the dividend can make early exercise economically rational for the call holder), your shares are sold at the strike price. You keep the premium either way, but you give up the shares — this is not a malfunction, it's the strategy working as designed. A trader who doesn't actually want to sell the stock needs to manage the position (roll the call to a later date/higher strike, or close it) before that becomes likely, not be surprised by it after the fact.",
        "Managing an open covered call typically means one of three choices as expiration approaches and the stock sits near or above the strike: let assignment happen and accept the sale, buy back the short call to close the position and keep the shares, or roll the call out to a later expiration (and often a higher strike) to collect additional premium while keeping the position open longer. Each choice has a real trade-off between locking in the current gain, paying to close, or extending the trade's own risk and time exposure.",
        "Platform implementation, stated plainly: this platform's own scanner and execution engine do not build, price, scan for, or route an order for a covered call — it is not one of the four strategies execution.ts's Strategy type supports. What is real: the pre-existing Strategy Academy page for Covered Call gives the full construction, ideal-market conditions, Greeks profile, time-decay and volatility behavior, assignment risk, and common mistakes in dedicated reference form. Separately, this platform's Payoff Diagram Simulator (in the Learning Centre's Simulations tab) lets you enter a hypothetical strike, cost basis, and premium and see a real, computed expiration payoff diagram for a covered call — genuinely useful for building intuition, but explicitly labeled 'Educational Simulation — Not Market Data — No Trade Recommendation,' since it takes hypothetical inputs you provide, not live market prices, and does not represent a tradeable order on this platform.",
      ],
      whyItMatters: "Covered calls are one of the most widely used real-world income strategies, and understanding assignment mechanics here also explains the assignment-risk warnings that appear throughout this platform's own Options Risk Management lesson for the structures it does trade.",
      externalHref: "/learn/strategy-academy/covered_call",
      relatedGlossaryKeys: ["covered-call", "call", "wheel", "assignment", "breakeven"],
      estimatedMinutes: 9,
      difficulty: "beginner",
      whyItExists: "Covered calls are the strategy most retail options traders learn first in the real world, so a strategies curriculum that skipped it entirely — even though this platform's own engine doesn't trade it — would leave a real gap in a learner's foundation.",
      institutionalThinking: "Institutional 'buy-write' desks run covered calls at scale as a systematic income overlay on long equity holdings — the retail version taught here is the same mechanic, just at a 100-share-lot scale instead of a portfolio-wide overlay.",
      screenWalkthrough: [
        "Navigate to the Strategy Academy (Learning Centre → Strategy Academy) and open the Covered Call entry for the full reference detail.",
        "Review the Construction, Ideal Market, Max Profit, Max Loss, Greeks Profile, Time Decay, Volatility Behavior, and Assignment Risk sections.",
        "Open the Learning Centre's Simulations tab, select 'Payoff Diagram,' choose Covered Call from the strategy dropdown, and enter a hypothetical strike/price/cost basis to see a real, computed payoff chart for those inputs.",
        "Note the honest 'Not tracked in this engine' label the platform's own Command Centre shows for covered call positions — this platform has no live position-tracking for this strategy, matching its absence from the execution engine.",
      ],
      workflowSteps: [
        "Confirm you already own (or are willing to buy) 100 shares of the underlying — this strategy requires the shares as collateral, not cash.",
        "Choose a strike above the current price that reflects the ceiling you're willing to accept in exchange for the premium.",
        "Read the Strategy Academy's Covered Call entry for the full construction and Greeks profile before proceeding conceptually.",
        "Use the Payoff Diagram Simulator with your own hypothetical numbers to see the expiration outcome shape.",
        "Recognize that any actual trade must be placed and managed entirely outside this platform, since it has no execution path for this strategy.",
      ],
      metricsExplained: [
        { term: "Premium collected", explanation: "The income received for selling the call — yours to keep regardless of the stock's later performance." },
        { term: "Strike price (the cap)", explanation: "The price at which shares are sold if the call is exercised — this defines the maximum price you'll realize on the stock while the position is open." },
        { term: "Assignment", explanation: "The mechanical process of your shares being sold at the strike when the short call is exercised — a normal, expected outcome, not an error." },
        { term: "Effective cost basis", explanation: "Your original stock purchase price minus the premium collected — the actual break-even level once the option income is accounted for." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A strike chosen with a real view on an upside ceiling you're comfortable with",
          steps: [
            "A trader owns 100 shares bought at $95 and expects the stock to trade sideways-to-modestly-up over the next month.",
            "A call is sold at a strike above the current price, at a level the trader would genuinely be satisfied selling at if assigned.",
            "The premium collected is treated as real income, and the trader has already decided in advance what they'll do if the stock approaches the strike (let it be assigned).",
          ],
        },
        {
          label: "Average Opportunity",
          title: "A strike sold with a vague plan for what happens near expiration",
          steps: [
            "Shares are held, and a call is sold at a round-number strike mostly because it 'looked reasonable,' without a clear plan for managing the position if the stock rallies hard toward it.",
          ],
          note: "The premium is real income either way, but the lack of a pre-decided management plan (roll, close, or accept assignment) often leads to reactive, worse decisions under time pressure near expiration.",
        },
        {
          label: "Poor Opportunity",
          title: "Selling a call on a stock the trader isn't actually willing to part with",
          steps: [
            "A trader with strong long-term conviction in a stock sells a call anyway purely for the premium income, at a strike close to the current price.",
            "The stock rallies sharply and the shares are assigned away at the strike, well below where the stock ends up trading later.",
          ],
          note: "This is the classic covered-call regret pattern: the premium collected is often small relative to the upside given away when the stock makes a large, fast move past the strike.",
        },
      ],
      commonMistakes: [
        "Selling a call at a strike you wouldn't actually be comfortable selling the stock at, then being unhappy when assignment happens exactly as designed.",
        "Forgetting that assignment can happen early — most commonly right before an ex-dividend date — not only at expiration.",
        "Assuming the premium collected fully protects against a large decline in the stock — it only partially offsets losses, it doesn't eliminate them.",
        "Treating the Payoff Diagram Simulator's hypothetical output as a live, tradeable quote — it is educational only, computed from inputs you supply.",
      ],
      riskWarnings: [
        "The underlying stock itself remains the primary risk — a large decline in the stock's price is only partially offset by the premium collected, never fully hedged.",
        "Assignment gives up further upside beyond the strike, which can be a meaningful opportunity cost during a sharp rally.",
        "This lesson and the Payoff Diagram Simulator are both educational only — nothing here is a trade recommendation, and this platform cannot place this trade for you.",
      ],
      bestPractices: [
        "Only sell a call at a strike you would genuinely be satisfied selling your shares at — never purely for the premium.",
        "Decide your management plan (accept assignment, roll, or close) before expiration approaches, not reactively at the last moment.",
        "Use the Payoff Diagram Simulator to build real intuition for the expiration outcome shape before considering any actual trade elsewhere.",
      ],
      relatedModuleHrefs: ["/learn/strategy-academy/covered_call", "/learn"],
      aiCoachPrompts: [
        "Explain why assignment can happen before expiration, not just on the expiration date itself.",
        "Walk me through the trade-offs between letting a covered call get assigned versus rolling it to a later date.",
        "Why does this platform's execution engine not build or price covered calls the way it does iron condors?",
        "What does 'effective cost basis' mean once premium income is factored into a covered call position?",
      ],
      nextStepKeys: ["strategies-protective-put"],
      knowledgeCheck: [
        {
          prompt: "What must you already own, or be willing to buy, to open a covered call?",
          options: ["Nothing — it requires only cash", "100 shares of the underlying stock per contract sold", "A margin account with unlimited buying power", "Another option position"],
          correctIndex: 1,
          explanation: "A covered call requires owning the underlying shares (100 per contract) as the 'cover' — this is what distinguishes it from an uncovered, naked call.",
        },
        {
          prompt: "What happens if the stock is above the strike price at expiration?",
          options: ["Nothing happens automatically", "The shares are typically called away (sold) at the strike price", "The premium is returned to the option buyer", "The position automatically rolls to the next expiration"],
          correctIndex: 1,
          explanation: "If the call finishes in-the-money, the shares are typically assigned (sold) at the strike price — this is the mechanical outcome of the strategy working as designed.",
        },
        {
          prompt: "Does this platform's execution engine build, price, or route an order for a covered call?",
          options: ["Yes, through the Scanner", "Yes, but only in full-auto mode", "No — it is not one of the strategies execution.ts supports", "Yes, through the Trade Ticket page directly"],
          correctIndex: 2,
          explanation: "Covered Call is explicitly marked builtByThisEngine: false in this platform's own Strategy Academy data — it is education-only, with no live scanning or order routing.",
        },
        {
          prompt: "What is the Payoff Diagram Simulator's own explicit labeling?",
          options: ["Live Market Data — Trade Recommendation", "Educational Simulation — Not Market Data — No Trade Recommendation", "Real-Time Broker Quote", "Automated Execution Preview"],
          correctIndex: 1,
          explanation: "The simulator computes a payoff diagram from hypothetical inputs you supply — it is explicitly and honestly labeled as educational, never a live quote or trade recommendation.",
        },
        {
          prompt: "Why might a covered call assignment feel like a 'regret' outcome even though it worked as designed?",
          options: ["Because the premium is always refunded", "Because a large, fast rally past the strike gives up upside beyond what the premium compensated for", "Because assignment is a system error", "Because covered calls always lose money on assignment"],
          correctIndex: 1,
          explanation: "A sharp rally past the strike means the shares are sold at a price below where the stock ends up — the premium collected is often small relative to the upside given away in that scenario.",
        },
      ],
    }),
    // v1.4.0, Sprint L2G — Options Strategies Academy. NEW topic. Zero
    // prior treatment anywhere in this codebase — no execution builder, no
    // Strategy Academy entry, no glossary key, no payoff simulator support.
    // Pure conceptual/hedging-theory education, explicitly and repeatedly
    // disclosed as such, per the brief's "if not implemented, document
    // this clearly rather than inventing functionality" instruction.
    topic({
      key: "strategies-protective-put",
      title: "Protective Put: Insuring Shares You Already Own",
      summary: "Buy a put against stock you own to put a floor under your downside — genuine hedging theory, with zero platform implementation of any kind.",
      body: [
        "A protective put means owning shares of a stock and buying a put option against them as insurance. If the stock falls, the put gains value, offsetting the loss on the shares below the put's strike — effectively putting a floor under how much you can lose on the position, for as long as the put remains open. This is fundamentally a hedging strategy, not an income strategy: you pay a premium (the 'insurance cost') in exchange for limiting your downside, the same trade-off as buying insurance on anything else you own.",
        "Portfolio protection is the entire purpose: a protective put doesn't try to generate income or improve your odds of profit — it exists purely to cap the damage from a decline you're worried about but don't want to sell the underlying position to avoid. This makes it conceptually the mirror image of a covered call: a covered call gives up upside in exchange for income, while a protective put pays a cost in exchange for a downside floor.",
        "Risk profile: while you hold the shares and the put, your maximum loss on the combined position is capped at (share purchase price − put strike + premium paid), no matter how far the stock falls beyond the strike — genuinely defined risk on the downside, in exchange for the ongoing cost of the put premium, which acts like a recurring insurance expense if you keep replacing expiring puts with new ones. Your upside on the shares themselves remains completely open, unlike a covered call — you're only paying for downside protection, not giving up any gains.",
        "Platform implementation: there is none, at any level. This platform's execution engine does not build or price a protective put. Unlike Covered Call, there is no dedicated Strategy Academy reference page for it, no entry in the Payoff Diagram Simulator's strategy list, and no glossary precedent prior to this lesson. This is genuinely, entirely conceptual education — a real, standard, widely-used risk-management technique worth understanding on its own terms, but with absolutely no platform workflow, screen, calculator, or example behind it. If you want to see the raw mechanics of the put leg itself, the Long Put lesson and the Option Chain's live PUTS pricing are the closest real platform grounding available — but neither computes a combined stock-plus-put payoff for you.",
      ],
      whyItMatters: "Hedging an existing position is a fundamentally different objective from generating income or placing a directional bet — recognizing that distinction is as important as any specific mechanic, especially since this platform's own defined-risk multi-leg strategies (Iron Condor, Iron Fly) already achieve a related 'known maximum loss' outcome through a completely different construction.",
      // v1.4.0, Sprint L2G. No externalHref field set at all (defaults to
      // null via the topic() helper) — this is the one lesson in this
      // Academy with genuinely zero platform implementation of any kind
      // to link to, not even a reference page.
      relatedGlossaryKeys: ["protective-put", "put", "long-put", "defined-risk"],
      estimatedMinutes: 6,
      difficulty: "beginner",
      whyItExists: "The brief for this sprint explicitly called for Protective Put coverage; per this platform's own honesty discipline, a genuine implementation gap does not mean the concept goes untaught — it means the gap itself is disclosed clearly, exactly as this lesson does throughout.",
      institutionalThinking: "Portfolio managers use protective puts (and the related, more capital-efficient 'collar,' which sells a call to help pay for the put) constantly as a hedging overlay on core long positions they don't want to sell outright — the underlying logic of 'pay a known cost to cap an unknown loss' recurs throughout institutional risk management, well beyond options specifically.",
      screenWalkthrough: [
        "There is no dedicated screen for this strategy anywhere on this platform.",
        "The closest real grounding is the Option Chain's live PUTS pricing (Delta/Theta/IV/Bid/Mid/Ask per strike) for viewing what a specific put would cost.",
        "The Long Put lesson's own worked examples cover the put leg's mechanics in isolation — reference it rather than expecting a combined stock-plus-put view here.",
      ],
      workflowSteps: [
        "Identify an existing stock position you want to protect without selling.",
        "Decide how much downside you're willing to tolerate before the floor should kick in — this determines the strike you'd choose conceptually.",
        "Understand that the put premium is a real, recurring cost if you keep replacing expiring puts — this is not a free hedge.",
        "Recognize that no page on this platform builds, prices, or tracks this combined position — any real protective put would be constructed and monitored entirely outside this platform.",
      ],
      metricsExplained: [
        { term: "Insurance cost (premium)", explanation: "The price paid for the put — the ongoing cost of maintaining downside protection, directly analogous to an insurance premium." },
        { term: "Floor level", explanation: "Put strike price − premium paid — approximately the minimum value per share the combined position can fall to before expiration, ignoring the stock's own cost basis." },
        { term: "Upside", explanation: "Completely uncapped — unlike a covered call, a protective put doesn't give up any gains on the stock; it only costs money on the downside protection." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A deliberate hedge sized to a specific, known risk window",
          steps: [
            "An investor holds a large, long-term position and faces a specific known risk event (e.g. a regulatory decision) in the near term.",
            "A put is conceptually chosen at a strike reflecting the maximum decline the investor is willing to tolerate through that event, for a defined period.",
          ],
          note: "This is a textbook, deliberate use of the strategy for its actual purpose — protecting a specific position through a specific risk window, not as a permanent or reflexive habit.",
        },
        {
          label: "Average Opportunity",
          title: "An open-ended hedge with no specific end date in mind",
          steps: [
            "An investor buys protection 'just in case,' with no particular catalyst or time horizon, and no plan for when to stop paying for it.",
          ],
          note: "Reasonable caution, but the ongoing premium cost of a hedge with no defined end point can meaningfully erode returns over a long enough period.",
        },
        {
          label: "Poor Opportunity",
          title: "Buying protection after a stock has already fallen sharply",
          steps: [
            "A stock has already dropped 20% in a short period; an investor buys a put afterward, when implied volatility (and therefore the put's cost) has likely already repriced higher.",
          ],
          note: "The same 'chasing a move that already happened' problem the Long Put lesson describes applies here too — hedges are generally most cost-effective when put on before volatility spikes, not after.",
        },
      ],
      commonMistakes: [
        "Treating a hedge as a permanent, costless feature rather than a recurring expense that erodes returns over time if maintained indefinitely.",
        "Buying protection reactively, after a decline has already happened and implied volatility has already repriced higher.",
        "Confusing a protective put's 'defined maximum loss' with a covered call's 'capped upside' — they solve different problems and are not interchangeable.",
        "Expecting this platform to have a screen, calculator, or workflow for this strategy — none exists, and this lesson exists specifically to make that gap explicit rather than silently absent.",
      ],
      riskWarnings: [
        "The put premium is a real, ongoing cost — a hedge that's never needed still costs money the whole time it's held.",
        "This concept has zero implementation on this platform at any level — there is no live example, calculator, or trade path to reference.",
        "This lesson is purely educational — it does not constitute a recommendation to hedge any specific position.",
      ],
      bestPractices: [
        "Size and time a hedge to a specific risk you're trying to manage, not as an open-ended, reflexive habit.",
        "Compare the ongoing cost of repeated put purchases against the actual downside risk being protected against.",
        "Consider that a collar (selling a call to help fund the put) is a related, more capital-efficient variant worth knowing about, even though it is likewise not implemented on this platform.",
      ],
      relatedModuleHrefs: ["/options/SPY"],
      aiCoachPrompts: [
        "Explain the difference between a protective put and a covered call in terms of what each one is trying to accomplish.",
        "Why is a protective put's ongoing premium cost often compared to an insurance premium?",
        "What is a 'collar' and how does it relate to a protective put?",
        "Why does this platform have zero implementation for this strategy when it has a full page for covered calls?",
      ],
      nextStepKeys: [],
      knowledgeCheck: [
        {
          prompt: "What is the primary purpose of a protective put?",
          options: ["To generate income from stock you own", "To hedge downside risk on stock you already own, without selling it", "To speculate on a stock falling that you don't own", "To increase leverage on an existing position"],
          correctIndex: 1,
          explanation: "A protective put is fundamentally a hedging strategy — it exists to cap downside risk on an existing stock position, not to generate income or add leverage.",
        },
        {
          prompt: "How does a protective put affect the stock's own upside potential?",
          options: ["It caps the upside at the put's strike price", "It has no effect — upside remains completely uncapped", "It doubles the upside", "It eliminates upside entirely"],
          correctIndex: 1,
          explanation: "Unlike a covered call, a protective put only costs money for downside protection — it does not cap or reduce the stock's own upside in any way.",
        },
        {
          prompt: "Is a protective put implemented anywhere on this platform (scanner, execution engine, Strategy Academy, or simulator)?",
          options: ["Yes, fully, in the Strategy Academy", "Yes, in the Payoff Diagram Simulator only", "No — it has zero implementation anywhere on this platform", "Yes, through the execution engine's full-auto mode"],
          correctIndex: 2,
          explanation: "Unlike Covered Call, Protective Put has no Strategy Academy entry, no simulator support, and no execution-engine builder — it is purely conceptual education on this platform.",
        },
        {
          prompt: "What does the put premium represent in a protective put strategy?",
          options: ["A refundable deposit", "An ongoing insurance-like cost for maintaining downside protection", "Guaranteed profit", "A brokerage fee"],
          correctIndex: 1,
          explanation: "The premium paid for the put is directly analogous to an insurance premium — a real, ongoing cost paid in exchange for capped downside risk.",
        },
        {
          prompt: "Why might buying a protective put after a stock has already fallen sharply be less cost-effective?",
          options: ["Puts cannot be bought after a decline", "Implied volatility has often already repriced higher, making the put more expensive for the protection it provides", "The stock automatically recovers after a protective put is bought", "There is no disadvantage to buying after a decline"],
          correctIndex: 1,
          explanation: "The same principle from the Long Put lesson applies: chasing a move that has already happened, after IV has already repriced upward, tends to mean overpaying relative to the real protection obtained.",
        },
      ],
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
    // v1.4.0, Sprint L2G — Options Strategies Academy. Upgraded in place
    // (key preserved). Covers all 4 named vertical-spread variants the
    // brief requested. None are independently order-routable on this
    // platform (confirmed: optionsStrategyLibrary.ts maps vertical_credit/
    // vertical_debit to executionStrategyKey: null) — but the two CREDIT
    // variants (bull put, bear call) have a genuine, honest platform
    // connection: they are literally the two halves of every real Iron
    // Condor this platform builds. The two DEBIT variants (bull call, bear
    // put) have no such connection and are disclosed as pure theory.
    topic({
      key: "strategies-verticals",
      title: "Vertical Spreads: Bull Call, Bear Put, Bull Put, Bear Call",
      summary: "Buy one option, sell another at a different strike, same expiration — four directional/credit combinations, and a real, honest connection to this platform's own Iron Condor.",
      body: [
        "A vertical spread means buying and selling two options of the same type (both calls, or both puts) and the same expiration, at two different strikes. Combining a long and a short leg this way defines both maximum profit and maximum loss up front, unlike a standalone long call or put — the trade-off is a lower cost (or, for a credit spread, a smaller credit) in exchange for a capped, known outcome on both sides. There are exactly four named variants, split along two axes: debit vs. credit, and bullish vs. bearish.",
        "Bull Call Spread (debit, bullish): buy a lower-strike call, sell a higher-strike call, same expiration. You pay a net debit up front. Maximum profit is the difference between strikes minus the debit paid, realized if the stock finishes at or above the higher (short) strike. Maximum loss is the debit paid, if the stock finishes at or below the lower (long) strike. This is a cheaper, capped-upside alternative to an outright long call.",
        "Bear Put Spread (debit, bearish): buy a higher-strike put, sell a lower-strike put, same expiration. You pay a net debit. Maximum profit is the difference between strikes minus the debit paid, if the stock finishes at or below the lower (short) strike. Maximum loss is the debit paid, if the stock finishes at or above the higher (long) strike. The bearish mirror image of the bull call spread.",
        "Bull Put Spread (credit, bullish/neutral): sell a higher-strike put, buy a lower-strike put, same expiration. You collect a net credit up front. Maximum profit is the credit received, if the stock stays above the higher (short) strike. Maximum loss is the difference between strikes minus the credit received, if the stock falls below the lower (long) strike. Probability of profit is generally higher than a debit spread's, since the position profits from the stock staying above a level rather than needing to reach one — the same probability-first, credit-collecting logic this platform's own Iron Condor and Iron Fly are built around. Greeks: short (net) theta-positive, short vega — time decay and falling IV both help this position, the opposite of a debit spread.",
        "Bear Call Spread (credit, bearish/neutral): sell a lower-strike call, buy a higher-strike call, same expiration. You collect a net credit. Maximum profit is the credit received, if the stock stays below the lower (short) strike. Maximum loss is the difference between strikes minus the credit received, if the stock rises above the higher (long) strike. Same theta-positive, vega-negative Greeks profile as the bull put spread, mirrored for the opposite direction.",
        "Platform implementation, and this is the genuinely useful part: no vertical spread is independently order-routable on this platform — none of the four variants is one of execution.ts's own Strategy values, and this platform's internal strategy catalog explicitly maps every vertical-spread variant to no execution builder. But you have already been trading bull put spreads and bear call spreads on this platform without necessarily calling them that: every real Iron Condor this platform's own scanner and execution engine build is constructed from exactly a bull put spread below the market plus a bear call spread above it, combined into one four-leg order. The two debit variants (bull call, bear put) have no such connection — they remain pure theory here, with the Option Chain as the only real platform grounding for viewing the underlying legs' live pricing.",
      ],
      whyItMatters: "This is the single most important structural fact connecting theory to what you actually trade on this platform: understanding a bull put spread and a bear call spread individually is the direct, honest path to understanding exactly how and why an Iron Condor is built the way it is, in the very next lesson.",
      externalHref: "/learn/strategy-academy/vertical_spread",
      relatedGlossaryKeys: ["vertical-spread", "bull-call-spread", "bear-put-spread", "bull-put-spread", "bear-call-spread", "iron-condor"],
      estimatedMinutes: 11,
      difficulty: "intermediate",
      whyItExists: "Every credit-collecting structure this platform actually builds is assembled from vertical spreads under the hood — this lesson exists specifically to make that construction visible and explicit, rather than leaving Iron Condor as a black box of four strikes.",
      institutionalThinking: "Professional options desks think in terms of spreads, not individual legs, almost universally — position risk, margin requirements, and probability of profit are all naturally expressed per-spread, which is exactly the framing this platform's own Iron Condor and Iron Fly quotes use internally.",
      screenWalkthrough: [
        "Navigate to the Option Chain (/options/SYMBOL) and pick two strikes of the same type (both calls, or both puts) to see their individual live pricing.",
        "Navigate to the Strategy Academy's Vertical Spread entry for the full reference construction and Greeks profile.",
        "Open any real Iron Condor quote on this platform (via the Scanner) and look at its four legs: the short put + long put pair is a bull put spread; the short call + long call pair is a bear call spread — the exact same two structures this lesson describes, already combined into one order.",
      ],
      workflowSteps: [
        "Decide your directional view (bullish, bearish, or 'stay above/below a level') and whether you want to pay a debit or collect a credit.",
        "Match that view to one of the four variants: bull call or bear put (debit, directional) vs. bull put or bear call (credit, probability-first).",
        "Recognize that no single vertical spread is independently tradeable through this platform's scanner or execution engine.",
        "If your view is genuinely credit-collecting and probability-first, proceed to the Iron Condor lesson — the real, tradeable structure built from exactly two of these four verticals at once.",
      ],
      metricsExplained: [
        { term: "Net debit (bull call / bear put)", explanation: "The cost paid to open the spread — also the maximum possible loss on a debit spread." },
        { term: "Net credit (bull put / bear call)", explanation: "The premium collected to open the spread — also the maximum possible profit on a credit spread." },
        { term: "Strike width", explanation: "The distance between the two strikes — this defines the maximum possible profit-or-loss range for any vertical spread, before subtracting the debit paid or credit received." },
        { term: "Probability of profit (credit spreads)", explanation: "Generally favors the seller for a reasonably-selected short strike, since the position only needs the stock to stay on the right side of a level rather than travel to reach one — the same logic this platform's own POP calculation applies to Iron Condor and Iron Fly." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A bull put spread sold with the same probability-first logic this platform's own Iron Condor uses",
          steps: [
            "A stock is range-bound to modestly bullish; a put is sold at a strike below the current price with a reasonable delta, and a further-out-of-the-money put is bought as protection, defining the maximum loss.",
            "The credit collected reflects genuine compensation for the probability of the stock staying above the short strike — the same logic, applied to one side only, as an Iron Condor applies to both sides.",
          ],
          note: "This is literally half of a real Iron Condor's own construction — see the Iron Condor lesson for the full four-leg version.",
        },
        {
          label: "Average Opportunity",
          title: "A bull call spread bought as a cheaper alternative to an outright long call",
          steps: [
            "A trader with a bullish thesis buys a lower-strike call and sells a higher-strike call to reduce the net cost versus buying the call alone, accepting a capped upside in exchange.",
          ],
          note: "A reasonable, standard trade-off, but the capped upside means a very large move benefits an outright long call more than this spread.",
        },
        {
          label: "Poor Opportunity",
          title: "A bear call spread sold too close to the current price with no real margin for error",
          steps: [
            "A trader sells a call spread with the short strike very close to the current stock price, collecting a large credit but leaving almost no room for the stock to move against the position before max loss is at risk.",
          ],
          note: "A classic risk/reward mistake: a larger credit for a closer-to-the-money short strike also means a meaningfully higher probability of the trade going against you — the credit collected and the probability of loss move together, not independently.",
        },
      ],
      commonMistakes: [
        "Selling a credit spread's short strike too close to the current price purely to collect a larger premium, without weighing the correspondingly higher probability of loss.",
        "Confusing a debit spread's directional logic with a credit spread's probability-first logic — they solve different problems even though both are 'vertical spreads.'",
        "Assuming any of these four variants can be ordered as a standalone trade on this platform — none can; only the combined four-leg Iron Condor and Iron Fly structures are order-routable.",
        "Forgetting that a credit spread's maximum loss is (strike width − credit received), not the strike width alone.",
      ],
      riskWarnings: [
        "A credit spread's maximum loss can be significantly larger than the credit collected — never assume the small credit received represents the total risk.",
        "A debit spread's maximum loss is the full amount paid, if the stock finishes on the wrong side of both strikes.",
        "This lesson is educational only — no example above is a trade recommendation.",
      ],
      bestPractices: [
        "Match the variant to your actual view: debit spreads for a directional bet with reduced cost, credit spreads for a probability-first, range-based view.",
        "Weigh a credit spread's premium against its own implied probability of loss — a bigger credit for a closer strike is not automatically a better trade.",
        "Once the credit-spread logic makes sense on one side, study the Iron Condor lesson to see both sides combined into this platform's own real, tradeable structure.",
      ],
      relatedModuleHrefs: ["/learn/strategy-academy/vertical_spread", "/options/SPY", "/scanner"],
      aiCoachPrompts: [
        "Explain how a bull put spread and a bear call spread combine to form an Iron Condor.",
        "What's the difference in Greeks exposure between a debit vertical spread and a credit vertical spread?",
        "Why does a credit spread's maximum loss exceed the credit collected?",
        "Show me how strike width relates to maximum profit and maximum loss on a vertical spread.",
      ],
      nextStepKeys: ["strategies-iron-condor"],
      knowledgeCheck: [
        {
          prompt: "Which two vertical spread variants are credit spreads (you collect a premium up front)?",
          options: ["Bull call spread and bear put spread", "Bull put spread and bear call spread", "Bull call spread and bull put spread", "Bear put spread and bear call spread"],
          correctIndex: 1,
          explanation: "Bull put spread and bear call spread both involve selling the closer-to-the-money leg, collecting a net credit — the other two variants (bull call, bear put) are debit spreads.",
        },
        {
          prompt: "How is a real Iron Condor on this platform actually constructed, in terms of vertical spreads?",
          options: ["Two bull call spreads combined", "A bull put spread below the market plus a bear call spread above it", "A single bear put spread", "Four independent, unrelated option legs with no spread relationship"],
          correctIndex: 1,
          explanation: "An Iron Condor's put side is a bull put spread (short put + long put below it) and its call side is a bear call spread (short call + long call above it) — combined into one four-leg order.",
        },
        {
          prompt: "What is the maximum loss on a credit vertical spread?",
          options: ["The credit received", "Strike width minus the credit received", "Unlimited", "Strike width plus the credit received"],
          correctIndex: 1,
          explanation: "A credit spread's maximum loss is the distance between the two strikes, minus the premium already collected — never the credit alone, and never unlimited since the long leg caps it.",
        },
        {
          prompt: "Can any single vertical spread (e.g. just a bull put spread on its own) be ordered directly through this platform's execution engine?",
          options: ["Yes, through the Scanner's strategy filter", "Yes, but only in full-auto mode", "No — only the combined four-leg Iron Condor and Iron Fly structures are order-routable", "Yes, through the Trade Ticket page directly"],
          correctIndex: 2,
          explanation: "None of the four vertical-spread variants is independently order-routable — this platform's Strategy type only supports iron_condor, iron_fly, calendar_spread, and earnings.",
        },
        {
          prompt: "Which vertical spread variant is the bearish, debit-paying structure?",
          options: ["Bull call spread", "Bull put spread", "Bear call spread", "Bear put spread"],
          correctIndex: 3,
          explanation: "A bear put spread (buy a higher-strike put, sell a lower-strike put) is bearish and requires paying a net debit — the bearish mirror of the bull call spread.",
        },
      ],
    }),
    // v1.4.0, Sprint L2G — Options Strategies Academy. Upgraded in place
    // (key preserved). This is a REAL, implemented, order-routable
    // strategy — buildIronCondor() in optionsMath.ts:475-525. Every
    // number below (shortDelta default 0.2, dte default 45, wing formula
    // max(step, round(price*0.025, step))) is quoted directly from that
    // function, not estimated.
    topic({
      key: "strategies-iron-condor",
      title: "Iron Condor: This Platform's Own Flagship Structure",
      summary: "A short put spread below the market plus a short call spread above it — real, live-priced, order-routable, and built by this platform's execution engine exactly the way this lesson describes.",
      body: [
        "An Iron Condor combines a bull put spread (sold below the market) with a bear call spread (sold above the market) into one four-leg, defined-risk, credit-collecting position. It profits when the underlying stays between the two short strikes through expiration — you're betting on a range, not a direction. This is genuinely the strategy this platform's scanner and execution engine build and price most extensively, and unlike every strategy covered so far in this Academy, the numbers below come directly from this platform's own real code, not textbook theory.",
        "Setup and delta selection: this platform's Iron Condor builder selects both short strikes by target delta, defaulting to a 20-delta (0.20) short put and a 20-delta short call — a lower delta means a strike further from the current price (lower premium, higher probability of staying out-of-the-money); a higher delta means a strike closer to the money (larger premium, lower probability of profit). The days-to-expiration defaults to 45. Both of these — shortDelta and dte — are the only two parameters this platform's engine actually exposes for this construction; wing width is not a separate user-adjustable input.",
        "Wing selection and width: the long (protective) put and call strikes are placed at wing = max(one strike increment, ~2.5% of the underlying's price), rounded to the nearest valid strike. This is computed automatically by the engine's own formula, not chosen manually per trade — a $100 stock gets roughly a $2.50 wing, a $400 stock roughly a $10 wing, both rounded to valid strike increments. This matters directly for risk: a wider wing means a larger maximum loss but also a larger credit collected, and vice versa.",
        "Maximum profit, maximum loss, and breakevens: maximum profit is the net credit collected when the position is opened — the most you can make is locked in the moment you enter, unlike an outright long option. Maximum loss is (wing width − credit collected), realized if the stock finishes beyond either long strike at expiration. The lower breakeven is (short put strike − credit received); the upper breakeven is (short call strike + credit received) — the position is profitable anywhere between those two levels at expiration, not just exactly at the short strikes.",
        "Probability of Profit and Return on Capital: this platform computes POP as the probability of the stock finishing between the two breakevens, using a volatility figure with a built-in haircut versus the raw implied volatility (a deliberate, disclosed conservatism, not a fabricated edge) — POP is a modeled estimate, not a guarantee, and this platform states that plainly wherever POP is shown. Return on Capital is maximum profit divided by maximum loss, expressed as a percentage — a way of comparing how much return a given trade offers relative to the capital it puts at risk, independent of the dollar size of the trade.",
        "Risk management and platform workflow: every Iron Condor this platform builds passes through the same defined-risk validation every other trade does before it can be placed — no naked legs, a liquidity floor, a positive expected-value requirement, and a minimum quality score, covered in full in the Options Risk Management lesson. Setup runs through the Scanner (filter to Iron Condor, or leave 'All Strategies' selected), which surfaces real, live-priced, already-validated candidates; opening one carries it to the Trade Ticket for a full pre-trade review before any order — manual or, if explicitly armed, fully automated — is placed.",
      ],
      whyItMatters: "This is the strategy every other lesson in this Academy has been building toward: it's the real, live, tradeable synthesis of the vertical-spread mechanics from the prior lesson, and understanding its wing/delta/width parameters here is the foundation for the Iron Fly lesson right after it.",
      externalHref: "/learn/strategy-academy/iron_condor",
      relatedGlossaryKeys: ["iron-condor", "vertical-spread", "bull-put-spread", "bear-call-spread", "delta", "wing-width", "probability-of-profit", "expected-value", "return-on-capital"],
      estimatedMinutes: 14,
      difficulty: "intermediate",
      whyItExists: "This is the platform's own flagship, most-built strategy — a learner who understands every prior lesson in this Academy but not this one hasn't yet connected the theory to what this platform actually trades day to day.",
      institutionalThinking: "Selling premium at a target delta rather than a fixed dollar distance from the stock price is standard institutional practice — it automatically adapts strike selection to each underlying's own implied volatility, which is exactly why this platform's own builder parameterizes by delta (shortDelta) rather than a flat dollar width.",
      screenWalkthrough: [
        "Open the Scanner and filter to Iron Condor (or leave All Strategies selected) — every row shown is a real, live-priced, already-validated candidate built by this exact formula.",
        "Review a candidate's credit, max loss, POP, EV, and Return on Capital columns — every one of these numbers traces directly to the math in this lesson's body text.",
        "Open a candidate to the Trade Ticket for the full pre-trade review, including the Pre-Trade Risk Validation checklist.",
        "Compare the same underlying's Iron Condor quote against its Iron Fly quote (next lesson) to see how moving the short strikes to at-the-money changes credit, width, and probability.",
      ],
      workflowSteps: [
        "Filter the Scanner to Iron Condor or leave All Strategies selected to see it alongside Iron Fly, Calendar Spread, and Earnings candidates.",
        "Review each candidate's short strikes (their implied delta), credit, max loss, and computed POP/EV/Ravish Score.",
        "Confirm the position clears this platform's own liquidity and quality gates before proceeding — a rejected quote is never silently hidden.",
        "Open the Trade Ticket to review the full four-leg structure, breakevens, and Greeks before placing any order.",
        "Decide manual confirmation vs. relying on full-auto mode (only if explicitly armed with both the master and per-strategy kill switches on) — covered fully in the Options Risk Management lesson.",
      ],
      metricsExplained: [
        { term: "Short strike delta", explanation: "Defaults to 0.20 on this platform — the target probability-adjacent distance from the current price used to select both short strikes." },
        { term: "Wing width", explanation: "Computed automatically as roughly 2.5% of the underlying's price (rounded to a valid strike increment) — not a manually chosen input on this platform." },
        { term: "Credit / Maximum profit", explanation: "The premium collected when the position opens — this is both the income received and the maximum possible profit, locked in at entry." },
        { term: "Maximum loss", explanation: "Wing width minus credit collected — the most the position can lose if the stock finishes beyond either long strike." },
        { term: "Probability of Profit (POP)", explanation: "A modeled estimate of the probability the stock finishes between the two breakevens, using a deliberately conservative volatility haircut — never a guarantee of outcome." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A well-scored candidate clearing every gate with a healthy margin",
          steps: [
            "A 20-delta Iron Condor on a liquid underlying shows a positive EV, a reasonable Return on Capital, tight bid/ask spreads, and open interest comfortably above this platform's own liquidity floor.",
            "The Scanner surfaces it as a real, non-rejected candidate, and the Trade Ticket's Pre-Trade Risk Validation shows every check passing.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "A candidate that passes validation but with a thinner margin of safety",
          steps: [
            "A similar structure clears every required gate, but with a lower Ravish Score, a smaller EV cushion, and open interest closer to the platform's own minimum threshold.",
          ],
          note: "Passing validation is a floor, not an endorsement of quality — the Scanner's own scoring exists precisely to help distinguish a marginal pass from a genuinely strong setup.",
        },
        {
          label: "Poor Opportunity",
          title: "A candidate this platform's own engine correctly rejects",
          steps: [
            "A structure on an illiquid or wide-spread underlying computes to a negative expected value, or shows open interest below 200 contracts or a bid/ask spread wider than 8% of the option's price.",
            "This platform's finalize() logic rejects it outright — the Scanner shows it as rejected with an explicit reason, never silently building a trade around it.",
          ],
          note: "This is the platform's own liquidity and EV gates working as designed — a rejected candidate is exactly this platform declining to fabricate a tradeable-looking quote out of unreliable pricing.",
        },
      ],
      commonMistakes: [
        "Treating a passing Pre-Trade Risk Validation as a guarantee of profit rather than a floor of acceptable structural quality.",
        "Confusing Return on Capital with an annualized or guaranteed return — it's a single trade's max-profit-to-max-loss ratio, nothing more.",
        "Not understanding that wing width is auto-computed on this platform, then being surprised the interface has no manual wing-width input to adjust.",
        "Forgetting that POP is a modeled estimate built on a deliberately conservative volatility assumption, not a guarantee — see the Options Pricing, Volatility and Probability lesson for the full disclosure.",
      ],
      riskWarnings: [
        "Maximum loss can be substantially larger than the credit collected — always know your wing width before entering.",
        "A defined-risk structure is not a low-risk structure — losing the full max loss on a single trade is a real, disclosed possibility, not a remote edge case.",
        "Probability of Profit is a model-based estimate, not a promise — no strategy on this platform, including this one, is presented as consistently profitable.",
      ],
      bestPractices: [
        "Compare Return on Capital across multiple candidates rather than chasing the single largest credit.",
        "Review the full Pre-Trade Risk Validation checklist on the Trade Ticket before every trade, even a candidate the Scanner already scored highly.",
        "Understand your position's real breakevens (short strike ± credit), not just the short strikes themselves.",
      ],
      relatedModuleHrefs: ["/learn/strategy-academy/iron_condor", "/scanner", "/trade-execution-center", "/options-dashboard"],
      aiCoachPrompts: [
        "Walk me through exactly how this platform selects the short strikes for an Iron Condor by delta.",
        "Why is wing width computed automatically instead of being a setting I can adjust?",
        "Explain the relationship between Return on Capital and Probability of Profit on a real Iron Condor candidate.",
        "What does it mean for the Scanner to reject a candidate, and why does that happen?",
      ],
      nextStepKeys: ["strategies-iron-butterfly"],
      knowledgeCheck: [
        {
          prompt: "What is this platform's default short-strike delta for an Iron Condor?",
          options: ["0.05", "0.20", "0.50", "0.80"],
          correctIndex: 1,
          explanation: "buildIronCondor()'s own default is shortDelta = 0.2 — a 20-delta short put and a 20-delta short call, unless overridden.",
        },
        {
          prompt: "How is wing width determined for an Iron Condor on this platform?",
          options: ["The user manually enters a dollar amount", "Automatically computed as roughly 2.5% of the underlying's price, rounded to a valid strike", "It is always exactly $5", "It matches the option's implied volatility exactly"],
          correctIndex: 1,
          explanation: "The engine computes wing = max(one strike increment, ~2.5% of price) — this is not a manually adjustable input in this platform's interface.",
        },
        {
          prompt: "What is an Iron Condor's maximum profit?",
          options: ["Unlimited", "The net credit collected when the position opens", "The wing width", "The strike width minus the wing width"],
          correctIndex: 1,
          explanation: "Maximum profit is locked in at entry — it's exactly the credit received, and cannot increase beyond that regardless of how favorably the stock moves.",
        },
        {
          prompt: "What happens when a candidate's open interest is below this platform's liquidity floor?",
          options: ["It's built anyway with a warning", "It's automatically resized to reduce risk", "It's rejected outright, with the rejection reason shown", "The system substitutes a different expiration automatically"],
          correctIndex: 2,
          explanation: "finalize()'s own liquidity gate rejects a candidate outright when open interest is below 200 contracts (or the bid/ask spread exceeds 8%) — never silently building a trade around unreliable pricing.",
        },
        {
          prompt: "Is Probability of Profit (POP) on this platform a guarantee of outcome?",
          options: ["Yes, POP guarantees the stated success rate", "No — it's a modeled estimate using a deliberately conservative volatility assumption, never a guarantee", "POP only applies to Iron Fly, not Iron Condor", "POP is guaranteed only for full-auto trades"],
          correctIndex: 1,
          explanation: "POP is computed from a modeled, deliberately haircut volatility figure — it is an estimate of probability, never a promise, and this platform states that honestly throughout.",
        },
      ],
    }),
    // v1.4.0, Sprint L2G — Options Strategies Academy. Upgraded in place
    // (key preserved). Also REAL — buildIronFly() in
    // optionsMath.ts:527-576. Wing formula (max(2*step, round(price*0.05,
    // step))) is double the Iron Condor's own relative wing, quoted
    // directly from source.
    topic({
      key: "strategies-iron-butterfly",
      title: "Iron Fly: Maximum Credit, Minimum Margin for Error",
      summary: "Like an Iron Condor, but both short strikes sit at-the-money — richer credit, a narrower profit zone, and a real, order-routable structure this platform builds and prices.",
      body: [
        "An Iron Fly (Iron Butterfly) is constructed almost identically to an Iron Condor, with one key difference: both short strikes — the short put and the short call — sit at the exact same at-the-money strike, rather than at two separate delta-selected strikes. This platform's own builder rounds the current price to the nearest valid strike increment and sells both the put and the call there. The result is a much richer credit collected up front, in exchange for a genuinely narrower range in which the position stays profitable.",
        "Construction: sell an at-the-money put and an at-the-money call at the same strike, then buy a further-out put and call as protection, defining the wings. This platform's default expiration is again 45 days-to-expiration, matching the Iron Condor's own default. Unlike the Iron Condor, there's no delta parameter to select here — the short strike is always the current price itself, rounded to a valid increment.",
        "Wing width, and this is a real, disclosed difference from the Iron Condor: this platform computes the Iron Fly's wing as roughly 5% of the underlying's price (double the Iron Condor's own ~2.5% formula), with a minimum of two full strike increments. A wider wing here reflects the reality that an at-the-money short strike needs more room on both sides for the position to have any meaningful probability of staying profitable.",
        "Risk profile and Greeks: maximum profit is again the net credit collected, realized only if the stock finishes exactly at the short strike at expiration — a materially narrower target than an Iron Condor's own range between two separated short strikes. Maximum loss is (wing width − credit collected), the same formula shape as the Iron Condor. Because both short legs sit at-the-money, an Iron Fly typically has higher theta (faster time decay income, in your favor as the seller) and higher gamma risk (the position's own delta changes faster as the stock moves) than a comparably-dated Iron Condor.",
        "Expected move and platform workflow: the width of an Iron Fly's own wings is a direct, real comparison point against the underlying's expected move over the same period (covered in the Volatility lesson) — a wing that's narrower than the expected move implies the position is betting on a tighter range than the market's own implied volatility suggests is likely, a genuinely useful sanity check before entering. Setup runs through the same Scanner (filter to Iron Fly) and Trade Ticket workflow as the Iron Condor, with the same liquidity, EV, and quality gates applied identically.",
      ],
      whyItMatters: "Comparing an Iron Fly's own richer-credit, narrower-zone construction directly against the Iron Condor's wider, delta-selected zone is the clearest possible way to internalize how strike selection trades credit against probability — the same trade-off underlies every credit strategy this platform builds.",
      externalHref: "/learn/strategy-academy/iron_fly",
      relatedGlossaryKeys: ["iron-butterfly", "iron-condor", "at-the-money", "wing-width", "expected-move"],
      estimatedMinutes: 11,
      difficulty: "intermediate",
      whyItExists: "Seeing the same core builder logic (short strikes, protective wings, credit, defined risk) applied to two genuinely different configurations — delta-selected vs. at-the-money — is the fastest way to understand what's actually adjustable in this platform's strategy construction and what isn't.",
      institutionalThinking: "Selling at-the-money premium for maximum credit is a classic, deliberate trade-off toward richer income at the cost of a tighter tolerance for being wrong — professional desks choose between condor-style and fly-style structures based explicitly on how much conviction they have in a range holding, not by default.",
      screenWalkthrough: [
        "Open the Scanner and filter to Iron Fly to see real, live-priced candidates built by this exact formula.",
        "Compare a symbol's Iron Fly quote against its Iron Condor quote (same underlying, similar DTE) side by side — notice the larger credit and the narrower distance between breakevens.",
        "Review the Strategy Academy's Iron Fly entry for the full reference detail alongside this lesson.",
        "Open a candidate's Trade Ticket to see the at-the-money short strike explicitly, and how close it sits to the current price.",
      ],
      workflowSteps: [
        "Filter the Scanner to Iron Fly, or compare it directly against an Iron Condor candidate for the same underlying.",
        "Note the short strike sits exactly at the current price, rounded to a valid increment — there is no delta to choose here.",
        "Compare the wing width and resulting credit against a comparable Iron Condor to see the richer-credit, narrower-zone trade-off directly.",
        "Check the underlying's expected move (Volatility lesson) against the Iron Fly's own wing width as a sanity check on how tight the implied range really is.",
        "Proceed through the same Trade Ticket and risk-validation workflow as any other strategy on this platform.",
      ],
      metricsExplained: [
        { term: "At-the-money short strike", explanation: "Both the short put and short call sit at the same strike — the current underlying price, rounded to the nearest valid strike increment." },
        { term: "Wing width (Iron Fly)", explanation: "Computed as roughly 5% of the underlying's price (double the Iron Condor's own relative wing), with a minimum of two strike increments." },
        { term: "Credit (Iron Fly vs. Iron Condor)", explanation: "Typically larger than a comparable Iron Condor's, since both short legs sit at-the-money where option premiums are richest." },
        { term: "Expected move", explanation: "A separate, independently computed estimate of how far the underlying is likely to move over a given period — useful as a real sanity check against the Iron Fly's own wing width." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "An Iron Fly whose wing width is genuinely wider than the underlying's own expected move",
          steps: [
            "The underlying's expected move over the position's DTE is comfortably narrower than the wing width, meaning the structure has real room before max loss becomes likely.",
            "Liquidity and EV gates clear cleanly, matching the same quality bar every strategy on this platform is held to.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "An Iron Fly where the wing width and the expected move are roughly the same size",
          steps: [
            "The position clears all required gates, but the wing width offers little cushion beyond what the market's own implied volatility already suggests is a likely range.",
          ],
          note: "Passing every mechanical gate doesn't by itself mean the wing width offers a comfortable margin — comparing it against the expected move is a real, independent check worth doing every time.",
        },
        {
          label: "Poor Opportunity",
          title: "An Iron Fly whose wing width is narrower than the underlying's own expected move",
          steps: [
            "The structure's own protective wings sit closer to the current price than the market's own implied volatility suggests the stock is likely to travel.",
          ],
          note: "This doesn't mean the trade is automatically rejected by this platform's own gates (which check EV and liquidity, not expected-move comparisons) — it means the trader needs to make this specific comparison themselves before relying on it.",
        },
      ],
      commonMistakes: [
        "Assuming an Iron Fly's larger credit automatically makes it a 'better' trade than an Iron Condor without weighing the narrower profit zone.",
        "Not comparing wing width against the underlying's own expected move before entering — this platform computes both, but doesn't force the comparison for you.",
        "Confusing this platform's own 5% wing formula for the Iron Fly with the Iron Condor's ~2.5% formula — the two strategies genuinely use different wing math.",
        "Expecting a delta parameter for the short strikes the way the Iron Condor has one — the Iron Fly's short strike is always at-the-money, not delta-selected.",
      ],
      riskWarnings: [
        "Maximum loss can still be substantial, and the narrower profit zone means it can be reached more easily than an Iron Condor's own wider range.",
        "Higher gamma risk means the position's own sensitivity to price moves changes faster than a comparable Iron Condor's — worth monitoring more closely, not less.",
        "This lesson is educational — no example above is a recommendation, and no strategy on this platform is presented as consistently profitable.",
      ],
      bestPractices: [
        "Always compare an Iron Fly's wing width against the underlying's own expected move before entering, as an independent sanity check beyond this platform's own EV/liquidity gates.",
        "Compare a candidate Iron Fly directly against a same-underlying Iron Condor to make the credit-vs-probability trade-off explicit before choosing.",
        "Monitor an open Iron Fly more closely than a comparable Iron Condor, given its narrower zone and higher gamma exposure.",
      ],
      relatedModuleHrefs: ["/learn/strategy-academy/iron_fly", "/scanner", "/trade-execution-center"],
      aiCoachPrompts: [
        "Compare this platform's Iron Fly and Iron Condor wing-width formulas directly — why are they different?",
        "Why does an at-the-money short strike produce a larger credit than a delta-selected one?",
        "Explain how expected move relates to whether an Iron Fly's wing width offers real protection.",
        "What does higher gamma risk actually mean for how I'd monitor an open Iron Fly position?",
      ],
      nextStepKeys: ["strategies-calendar"],
      knowledgeCheck: [
        {
          prompt: "Where does this platform place the short strikes for an Iron Fly?",
          options: ["At a 20-delta strike, same as the Iron Condor", "Both at the same at-the-money strike (current price, rounded to a valid increment)", "At two different delta-selected strikes", "There are no short strikes in an Iron Fly"],
          correctIndex: 1,
          explanation: "Both the short put and short call sit at the exact same at-the-money strike — this is the defining difference from an Iron Condor's two separate delta-selected short strikes.",
        },
        {
          prompt: "Roughly how does this platform compute an Iron Fly's wing width, compared to an Iron Condor's?",
          options: ["Identical formula, ~2.5% of price for both", "Roughly double — ~5% of price for the Iron Fly versus ~2.5% for the Iron Condor", "The Iron Fly has no wings at all", "The Iron Fly's wing is always exactly $1"],
          correctIndex: 1,
          explanation: "buildIronFly() computes wing = max(2×step, ~5% of price) — roughly double the Iron Condor's own ~2.5% relative wing formula.",
        },
        {
          prompt: "Why does an Iron Fly typically collect a larger credit than a comparable Iron Condor?",
          options: ["Because it has wider wings only", "Because both short legs sit at-the-money, where option premiums are richest", "Because it uses a different underlying", "Because it always has a longer expiration"],
          correctIndex: 1,
          explanation: "At-the-money options carry the richest extrinsic value, so selling both legs there (rather than at lower-delta, further-out strikes) produces a larger net credit.",
        },
        {
          prompt: "What is a genuinely useful independent sanity check for an Iron Fly's wing width, beyond this platform's own EV/liquidity gates?",
          options: ["Comparing the wing width against the underlying's own expected move", "Checking only the credit amount", "There is no additional check needed beyond the automatic gates", "Comparing the wing width against a different, unrelated symbol"],
          correctIndex: 0,
          explanation: "Comparing wing width against the underlying's independently-computed expected move (covered in the Volatility lesson) shows whether the structure's own protective range is wide or narrow relative to the market's own implied volatility.",
        },
        {
          prompt: "Is Return on Capital or the underlying construction logic (delta selection, protective wings, defined risk) different between an Iron Condor and Iron Fly?",
          options: ["Both formulas and construction logic are entirely different systems", "The same finalize() logic and defined-risk construction apply to both — only the short-strike selection method and wing-width formula differ", "Iron Fly has no maximum loss", "Iron Condor has no credit collection"],
          correctIndex: 1,
          explanation: "Both strategies share the same finalize() validation, credit/max-loss/breakeven math shape, and defined-risk construction — the genuine differences are in how the short strikes are chosen and how wide the wings are computed.",
        },
      ],
    }),
    // v1.4.0, Sprint L2G — Options Strategies Academy. Upgraded in place
    // (key preserved). REAL — buildCalendar() in optionsMath.ts:578-623.
    // Deliberately discloses the calls-only construction (no put calendar
    // variant exists in this engine), a genuine, honest limitation.
    topic({
      key: "strategies-calendar",
      title: "Calendar Spread: Profiting from Time, Not Direction",
      summary: "Sell a near-dated call and buy a longer-dated call at the same strike — a genuinely different, long-vega risk profile from the two Iron structures, and a real, order-routable strategy this platform builds.",
      body: [
        "A calendar spread sells a near-month option and buys a longer-month option at the same strike, profiting from the front leg's faster time decay relative to the back leg's slower decay — this is fundamentally a time-decay-differential trade, not a directional one, and it's a genuinely different risk profile from either Iron structure covered so far in this Academy. This platform's own builder constructs this using calls only, at a single shared strike — there is no put-calendar variant in this engine, a real, disclosed limitation worth knowing rather than assuming exists.",
        "Near-month vs. far-month: this platform's default front (sold) leg expires at 30 days-to-expiration, and the back (bought) leg expires at 60 days-to-expiration — a 30-day gap between the two. The strike itself is selected by delta on the longer-dated leg, defaulting to 0.27 (27-delta), placing it moderately out-of-the-money rather than exactly at-the-money.",
        "Time decay: the entire edge in a calendar spread comes from theta decaying faster on the shorter-dated option than the longer-dated one — this is a real, well-established options-pricing property (time value decays non-linearly, accelerating as expiration approaches), not something specific to this platform. As the front leg approaches its own expiration, it loses value faster than the back leg does, and the spread between the two (the position's own value) tends to widen in the position holder's favor, all else equal.",
        "Volatility and Greeks: unlike the two Iron structures (which are net short vega — they benefit from falling implied volatility), a calendar spread is net long vega — it benefits from rising implied volatility, particularly on the longer-dated back leg. This is a genuine, structurally different exposure, and it's exactly why this lesson's whyItMatters calls it out as long vega instead of short: a calendar spread and an Iron Condor can hold opposite views on where volatility is headed, even on the same underlying at the same time.",
        "Maximum profit and loss: maximum loss is the net debit paid to open the position (this is a debit strategy, unlike either Iron structure), never more than that. Maximum profit is estimated from the back leg's own theoretical value at the moment the front leg expires at-the-money, minus the debit paid — this is a genuine model-based estimate (since the back leg's actual future price depends on volatility conditions that haven't happened yet), and this platform computes it honestly as an estimate rather than a guaranteed number. Platform workflow runs through the same Scanner (filter to Calendar Spread) and Trade Ticket review as every other strategy here, with the same liquidity, EV, and quality gates applied identically.",
      ],
      whyItMatters: "A calendar spread is the one strategy in this Academy that profits primarily from rising implied volatility rather than falling volatility or a stable range — genuinely understanding it means understanding that this platform's own engine builds strategies with opposite volatility exposures, not just one house view.",
      externalHref: "/learn/strategy-academy/calendar_spread",
      relatedGlossaryKeys: ["calendar-spread", "theta", "diagonal-spread", "vega", "iv-rank"],
      estimatedMinutes: 10,
      difficulty: "intermediate",
      whyItExists: "Every strategy covered before this one in the Academy is short vega — a learner who stopped there would walk away thinking this platform only trades one kind of volatility view, which isn't true.",
      institutionalThinking: "Volatility desks routinely hold calendar-style, long-vega positions specifically as a counterweight to short-vega, premium-selling books elsewhere in a portfolio — the same 'own both sides of volatility, not just one' logic this platform's own Iron Condor/Calendar Spread combination reflects at the strategy level.",
      screenWalkthrough: [
        "Open the Scanner and filter to Calendar Spread to see real, live-priced candidates.",
        "Note the two distinct expiration dates shown on a Calendar Spread candidate — this platform's own 30/60-day default front/back split.",
        "Review the Strategy Academy's Calendar Spread entry for the full reference construction.",
        "Compare a Calendar Spread candidate's IV exposure against an Iron Condor candidate for the same underlying — one is net long vega, the other net short.",
      ],
      workflowSteps: [
        "Filter the Scanner to Calendar Spread to see live candidates using this platform's own 30/60-day, 27-delta default construction.",
        "Confirm you understand this is a debit strategy — maximum loss is the debit paid, not a credit collected up front.",
        "Review the estimated maximum profit figure as exactly that: a model-based estimate of the back leg's value at front-leg expiration, not a locked-in number.",
        "Check the underlying's IV rank/percentile (Volatility lesson) — since this position benefits from rising IV, entering when IV is already unusually elevated works against the position's own edge.",
        "Proceed through the same Trade Ticket and risk-validation workflow as any other strategy on this platform.",
      ],
      metricsExplained: [
        { term: "Front-month DTE", explanation: "Defaults to 30 days-to-expiration on this platform — the shorter-dated leg that is sold." },
        { term: "Back-month DTE", explanation: "Defaults to 60 days-to-expiration — the longer-dated leg that is bought, expiring 30 days after the front leg." },
        { term: "Strike selection delta", explanation: "Defaults to 0.27 (27-delta) on the back leg, placing the shared strike moderately out-of-the-money rather than exactly at the current price." },
        { term: "Net debit / maximum loss", explanation: "The cost paid to open the position — a calendar spread is a debit strategy, and the debit paid is the maximum possible loss." },
        { term: "Estimated maximum profit", explanation: "A modeled estimate of the back leg's value when the front leg expires at-the-money, minus the debit paid — genuinely an estimate, since it depends on future volatility conditions, never a guaranteed number." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A calendar spread entered when implied volatility is relatively low, with room to rise",
          steps: [
            "The underlying's IV rank sits on the lower end of its recent range, meaning there's real room for IV to expand in the position's favor.",
            "The position clears this platform's liquidity and EV gates, and the 30-day gap between front and back legs gives the time-decay differential room to work.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "A calendar spread entered with IV at a middling, unremarkable level",
          steps: [
            "The underlying's IV rank sits near the middle of its historical range — not an obviously favorable entry point for a long-vega position, but not obviously unfavorable either.",
          ],
          note: "The position can still clear every mechanical gate this platform checks while offering a less compelling volatility-entry point than one chosen with a clearer IV rationale.",
        },
        {
          label: "Poor Opportunity",
          title: "A calendar spread entered when implied volatility is already unusually elevated",
          steps: [
            "The underlying's IV rank sits near the top of its recent range — often right before an anticipated event — and the position is entered anyway.",
            "If IV subsequently falls (a common pattern after an anticipated event resolves), the position's own long-vega exposure works against it even if the time-decay differential still functions normally.",
          ],
          note: "Entering a long-vega position when IV is already elevated is a well-known, avoidable mistake — the position is fighting its own primary source of edge from the start.",
        },
      ],
      commonMistakes: [
        "Entering a calendar spread when implied volatility is already elevated, working directly against the position's own long-vega exposure.",
        "Treating the estimated maximum profit figure as a guaranteed number rather than the model-based estimate it genuinely is.",
        "Assuming a put-based calendar spread variant exists on this platform — it doesn't; this engine's calendar construction is calls-only.",
        "Confusing a calendar spread's debit-paid maximum loss with a credit strategy's max-loss formula — they're structurally different.",
      ],
      riskWarnings: [
        "Maximum loss is the full debit paid if the trade doesn't work out — a real, defined risk, but a cost paid up front rather than a credit collected.",
        "Estimated maximum profit is a model-based estimate dependent on future volatility conditions — it can be meaningfully different from the actual realized outcome.",
        "This lesson is educational only — no example above is a recommendation, and no strategy on this platform is presented as consistently profitable.",
      ],
      bestPractices: [
        "Check IV rank/percentile before entering — a calendar spread's edge is strongest when volatility has room to rise, not when it's already elevated.",
        "Remember this is a debit strategy — size the position based on the debit paid as your real maximum loss.",
        "Compare a calendar spread's long-vega exposure directly against an Iron Condor or Iron Fly's short-vega exposure on the same underlying before deciding which view you actually hold.",
      ],
      relatedModuleHrefs: ["/learn/strategy-academy/calendar_spread", "/scanner", "/trade-execution-center"],
      aiCoachPrompts: [
        "Explain why a calendar spread is long vega while an Iron Condor is short vega.",
        "Walk me through this platform's default front-month and back-month DTE for a Calendar Spread.",
        "Why is a calendar spread's maximum profit only an estimate, not a locked-in number the way Iron Condor's maximum profit is?",
        "Does this platform support a put-based calendar spread, and if not, why?",
      ],
      nextStepKeys: [],
      knowledgeCheck: [
        {
          prompt: "Is a calendar spread on this platform a credit strategy or a debit strategy?",
          options: ["Credit — you collect a premium up front", "Debit — you pay a net premium to open the position", "Neither — it has no cash flow at entry", "It depends on the underlying"],
          correctIndex: 1,
          explanation: "A calendar spread's back (longer-dated) leg costs more than the front (shorter-dated) leg's premium collected, resulting in a net debit paid to open the position.",
        },
        {
          prompt: "What is this platform's default gap between the front-month and back-month expirations for a Calendar Spread?",
          options: ["7 days", "15 days", "30 days (30 DTE front, 60 DTE back)", "90 days"],
          correctIndex: 2,
          explanation: "buildCalendar()'s own defaults are frontDte = 30 and backDte = 60 — a 30-day gap between the two legs, unless overridden.",
        },
        {
          prompt: "Is a Calendar Spread net long or net short implied volatility (vega), compared to an Iron Condor?",
          options: ["Net long vega, the opposite of an Iron Condor's net short vega", "Net short vega, same as an Iron Condor", "Vega-neutral, unlike an Iron Condor", "Vega exposure does not apply to Calendar Spreads"],
          correctIndex: 0,
          explanation: "A Calendar Spread benefits from rising implied volatility (net long vega) — the opposite exposure from an Iron Condor or Iron Fly, which benefit from falling IV (net short vega).",
        },
        {
          prompt: "Does this platform's engine support a put-based calendar spread variant?",
          options: ["Yes, calls and puts are both supported", "No — this engine's calendar construction is calls-only", "Only in full-auto mode", "Only for symbols with earnings events"],
          correctIndex: 1,
          explanation: "buildCalendar() constructs the position using calls only — there is no put-calendar variant implemented in this engine, a real, disclosed limitation.",
        },
        {
          prompt: "Why is a Calendar Spread's estimated maximum profit described as a model-based estimate rather than a guaranteed number?",
          options: ["Because it depends on the back leg's future value under future, currently-unknown volatility conditions", "Because Calendar Spreads have no maximum profit at all", "Because this platform never estimates maximum profit for any strategy", "Because the front leg's value is unpredictable"],
          correctIndex: 0,
          explanation: "The maximum profit estimate depends on the back leg's own theoretical value at a future point in time, under volatility conditions that haven't happened yet — genuinely an estimate, honestly labeled as such.",
        },
      ],
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
    // v1.4.0, Sprint L2H — Institutional Options Portfolio Management
    // Academy. NEW topic (Module 1: Portfolio Overview). Deliberately built
    // around what this platform's real screens actually show: /portfolio
    // is Greeks-only (positions + unrealized P/L, no value/buying
    // power/cash), the Account Snapshot (value/buying power/day P&L/total
    // P&L) lives on /portfolio-ai instead, Realized P/L's only real
    // portfolio-wide figure is /trade-performance's own Total P&L KPI
    // (derived from actually-closed trades, per tradeAnalytics.ts's own
    // documented derivation), and Cash Balance is a real, computed API
    // field (routes/portfolio.ts's /summary) that is honestly disclosed as
    // not currently rendered on any screen — never fabricated as a UI panel.
    topic({
      key: "portfolio-overview",
      title: "Portfolio Overview: Value, Buying Power, Cash, and Daily Workflow",
      summary: "Where your account's real numbers actually live — across three different screens, not one unified dashboard.",
      body: [
        "This platform does not have one single 'portfolio dashboard' screen showing every account-level number at once — the real figures are genuinely spread across three different pages, and knowing which page has which number is the first practical skill in managing a portfolio here. Open positions and per-position unrealized P/L live on the Portfolio Greeks page (/portfolio) alongside net Greeks. Portfolio value, buying power, day P/L, and total P/L live in the Account Snapshot on the Portfolio AI cockpit (/portfolio-ai). A rolled-up 0-100 Health Score and a broader risk breakdown live on the Portfolio Risk Dashboard (/portfolio-dashboard).",
        "Portfolio value and buying power, computed for real: portfolio value is your account's baseline plus unrealized P/L; buying power is the capital still available for new positions after subtracting what's already committed to open trades — this platform computes it as (account value − risk already committed) × a flat 2x leverage assumption, not a broker-reported margin figure. Both numbers are real, computed from your actual open trades, and shown together on the Account Snapshot.",
        "Cash — an honest disclosure rather than an invented screen: the backend does compute a real Cash Balance figure (account value minus risk dollars committed to open trades) as part of the same endpoint the Account Snapshot already calls, but no current screen renders it as its own labeled field. If you want the number, it exists in the underlying data the platform already computes — it simply isn't surfaced as a dedicated panel yet.",
        "Unrealized vs. Realized P/L are genuinely different figures from genuinely different screens. Unrealized P/L is the live, still-open mark-to-market gain or loss on positions you haven't closed yet — shown per-position on the Portfolio Greeks page, and rolled into 'Day P/L' on the Account Snapshot (this platform's day P/L is literally set equal to the account's unrealized P/L for the day, not a separate intraday-realized figure). Realized P/L — profit or loss that's actually locked in because a trade has closed — has no dedicated 'Realized P/L' field on the portfolio pages; the platform's real, portfolio-wide realized-performance figure is the Total P/L KPI on the Performance Analytics page, computed honestly from trades that have actually closed, not an estimate.",
        "Daily workflow, honestly: there is no single dedicated 'Daily Review' feature on this platform. The platform's actual daily workflow is a combination of already-shipped pieces working together — checking the Account Snapshot and Position Greeks, reviewing the Attention Queue on Adjustments for anything needing action, and (for a written, longer-term record) logging entries in the Trading Journal and revisiting them later with the AI Coach. This mirrors the exact same honest framing this platform's own Trading Journal lesson already uses for its engine — there is no magic 'one button' daily review; it's these real screens used together, deliberately.",
      ],
      whyItMatters: "Before any Greeks/risk/AI-review lesson makes sense, you need to know which screen actually has which number — a surprising number of real support questions in a platform like this come down to 'why doesn't the Portfolio page show my buying power,' and the honest answer is simply that a different page does.",
      externalHref: "/portfolio-ai",
      relatedGlossaryKeys: ["account-value", "buying-power", "cash-balance", "unrealized-pnl", "realized-pnl"],
      estimatedMinutes: 10,
      difficulty: "beginner",
      whyItExists: "Every other lesson in this Academy assumes you already know where the basic account numbers live — this lesson exists to make that map explicit up front, since the platform's own screens split this information in a way that isn't obvious on first use.",
      institutionalThinking: "Institutional desks track account value, buying power, and realized-vs-unrealized P/L as genuinely distinct concepts with different operational implications (buying power gates what you can do next; realized P/L is what actually happened) — treating them as interchangeable is a common beginner mistake this lesson is designed to prevent.",
      screenWalkthrough: [
        "Navigate to /portfolio-ai — the Account Snapshot panel shows Account Value, Buying Power, Day P&L, Total P&L, Open Positions, and Risk Used.",
        "Navigate to /portfolio — the Active Positions table shows each open position's own unrealized P/L in dollars and percent, alongside its Greeks.",
        "Navigate to /trade-performance — the Total P&L KPI is the platform's real, portfolio-wide realized-performance figure, computed from closed trades only.",
        "Navigate to /portfolio-dashboard — the Executive Summary repeats portfolio value and buying power alongside the 0-100 Health Score and a full risk breakdown.",
      ],
      workflowSteps: [
        "Start each session on /portfolio-ai to see account value, buying power, and today's P/L in one place.",
        "Check /portfolio for the per-position unrealized P/L and Greeks detail the Account Snapshot doesn't break out individually.",
        "Periodically check /trade-performance for your actual, closed-trade realized performance — never estimate this from unrealized figures alone.",
        "Log anything noteworthy in the Trading Journal, and use the AI Coach later to review entries — this platform's real substitute for a single 'daily review' button.",
        "Use /portfolio-dashboard's Health Score as a periodic, rolled-up sanity check, not a replacement for the detail on the other three pages.",
      ],
      metricsExplained: [
        { term: "Account Value", explanation: "Account baseline plus unrealized P/L — the platform's real, live estimate of what the account is worth right now, including open positions' marks." },
        { term: "Buying Power", explanation: "(Account value − risk dollars committed to open trades) × 2 — a flat, disclosed leverage assumption, not a broker-reported margin figure." },
        { term: "Day P/L", explanation: "Set equal to the account's current unrealized P/L in this platform's implementation — not a separate, independently-tracked intraday-realized number." },
        { term: "Total P/L (Performance Analytics)", explanation: "The platform's real, portfolio-wide realized-performance figure, computed only from trades that have actually closed." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Checking the right screen for the right number before making a decision",
          steps: [
            "Before deciding whether to open a new position, the trader checks Buying Power on the Account Snapshot (/portfolio-ai), not the Portfolio Greeks page, which doesn't show it at all.",
            "Before assessing how the account has actually performed, the trader checks the Total P&L KPI on /trade-performance — the real, closed-trade figure — rather than reading the still-open, still-moving unrealized P/L as if it were final.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "Using the Health Score alone without the underlying detail",
          steps: [
            "A trader checks only the /portfolio-dashboard Health Score each day, treating a single 0-100 number as sufficient without ever opening the per-position detail on /portfolio or the Attention Queue on /adjustments.",
          ],
          note: "The Health Score is a real, useful rollup, but it's explicitly designed as a summary of 8 underlying factors — treating it as the whole picture misses exactly the detail those 8 factors were computed from.",
        },
        {
          label: "Poor Opportunity",
          title: "Confusing unrealized P/L with realized, locked-in performance",
          steps: [
            "A trader sees a large positive unrealized P/L on an open position and treats it as already-banked profit, without recognizing it can still move (and reverse) before the position is actually closed.",
          ],
          note: "This is one of the most common and costly mental-accounting mistakes in options trading — unrealized P/L is a live mark, not a locked-in result, until the position is actually closed.",
        },
      ],
      commonMistakes: [
        "Looking for portfolio value, buying power, or cash on the Portfolio Greeks page — that page genuinely does not show them; they live on the Portfolio AI cockpit instead.",
        "Treating a large unrealized gain as already-realized profit before the position is actually closed.",
        "Assuming 'Day P/L' is a separately-tracked intraday-realized figure — in this platform's implementation it's literally the same number as unrealized P/L.",
        "Expecting a single 'Daily Review' button — the platform's real daily workflow is several existing screens used together, not one dedicated feature.",
      ],
      riskWarnings: [
        "Buying power is computed from a flat, disclosed 2x leverage assumption — treat it as a planning estimate, not a broker-verified margin figure.",
        "Unrealized P/L can move against you at any time before a position closes — never treat it as a guaranteed outcome.",
        "This lesson is educational only — nothing here is a recommendation to open, hold, or close any specific position.",
      ],
      bestPractices: [
        "Build a short mental (or written) habit of checking all three screens — Account Snapshot, Portfolio Greeks, Performance Analytics — rather than relying on just one.",
        "Distinguish 'how the account looks right now' (unrealized, still moving) from 'how the account has actually performed' (realized, from closed trades) every time you review it.",
        "Use the Trading Journal to record context around decisions — it's the platform's own real substitute for a dedicated daily-review feature.",
      ],
      relatedModuleHrefs: ["/portfolio-ai", "/portfolio", "/trade-performance", "/portfolio-dashboard"],
      aiCoachPrompts: [
        "Explain the difference between my account's unrealized P/L and its realized P/L, and where each one is shown.",
        "Why doesn't the Portfolio Greeks page show my buying power or cash balance?",
        "Walk me through what buying power actually represents and how it's computed.",
        "What is this platform's actual daily review workflow, given there's no single dedicated screen for it?",
      ],
      nextStepKeys: ["portfolio-concentration"],
      knowledgeCheck: [
        {
          prompt: "Which screen shows the Account Snapshot with portfolio value, buying power, and day P/L?",
          options: ["The Portfolio Greeks page (/portfolio)", "The Portfolio AI cockpit (/portfolio-ai)", "The Concentration Risk page", "The Trading Journal"],
          correctIndex: 1,
          explanation: "The Account Snapshot panel lives on the Portfolio AI cockpit (/portfolio-ai) — the Portfolio Greeks page (/portfolio) shows only positions, Greeks, and unrealized P/L, not account-level value or buying power.",
        },
        {
          prompt: "Where does this platform's real, portfolio-wide Realized P/L figure actually come from?",
          options: ["A dedicated 'Realized P/L' field on the Portfolio Greeks page", "The Total P&L KPI on the Performance Analytics page, computed from closed trades", "An estimate derived from unrealized P/L", "The Portfolio Health Score"],
          correctIndex: 1,
          explanation: "There is no dedicated realized-P/L field on the portfolio pages — the real, honest realized-performance figure is the Performance Analytics page's Total P&L KPI, computed only from trades that have actually closed.",
        },
        {
          prompt: "Is Cash Balance shown as its own labeled panel anywhere on this platform today?",
          options: ["Yes, on the Portfolio Greeks page", "Yes, on the Account Snapshot", "No — it's a real, computed backend field but not currently rendered on any screen", "No — it isn't computed anywhere"],
          correctIndex: 2,
          explanation: "Cash Balance is genuinely computed by the backend (account value minus risk dollars) as part of the same data the Account Snapshot already reads, but it is not currently displayed as its own labeled field anywhere.",
        },
        {
          prompt: "How is 'Day P/L' computed in this platform's implementation?",
          options: ["As a separate, independently-tracked intraday-realized figure", "It is set equal to the account's current unrealized P/L", "As the sum of all realized trades that day", "It is not computed at all"],
          correctIndex: 1,
          explanation: "In this platform's implementation, day P/L is literally the same number as the account's current unrealized P/L — not a separately-tracked intraday-realized figure.",
        },
        {
          prompt: "What is this platform's actual 'daily workflow' for reviewing a portfolio?",
          options: ["A single dedicated Daily Review button", "Checking the Account Snapshot, Portfolio Greeks, and Attention Queue together, plus the Trading Journal and AI Coach", "An automated daily email report", "There is no daily workflow at all"],
          correctIndex: 1,
          explanation: "This platform has no single dedicated 'Daily Review' feature — the real workflow combines several existing screens (Account Snapshot, Portfolio Greeks, Adjustments' Attention Queue) with the Trading Journal and AI Coach.",
        },
      ],
    }),
    // v1.4.0, Sprint L2H — Institutional Options Portfolio Management
    // Academy. Upgraded in place (key preserved; Module 3: Portfolio Risk
    // Management). Deliberately draws the hard-enforced-vs-advisory-only
    // distinction confirmed this sprint: settings.maxRiskPerTrade /
    // maxPortfolioRisk are real, trade-BLOCKING caps enforced by
    // execution.ts's validatePreTrade() before any order can be submitted
    // (manual or full-auto); positionSizing.ts's own recommendedQuantity
    // is a real but purely advisory suggestion that cannot block anything.
    topic({
      key: "portfolio-position-sizing",
      title: "Portfolio Risk Management: Position Sizing, Exposure Caps, and Monitoring Multiple Positions",
      summary: "How much to risk on any single trade, how much the whole account can risk at once, and what actually stops you before it's too much.",
      body: [
        "Position sizing means bounding each trade's risk as a percentage of total account value, so no single position — however attractive — can do outsized damage. This platform's own Position Sizing & Portfolio Impact Calculator (/position-sizing) computes a real recommended quantity from your account value and your own maxRiskPerTrade setting, plus a full before-and-after Portfolio Impact comparison (risk dollars, Greeks, exposure by symbol) showing exactly how a hypothetical trade would change your account if you opened it.",
        "Portfolio exposure is tracked the same way, at the whole-account level: total risk dollars committed across every open position, split into long/short exposure and exposure-by-symbol — the same figures the Position Sizing calculator's own 'Current' snapshot already reads from your real open trades.",
        "Sector concentration and correlation are covered in depth in this Academy's own Portfolio Greeks lesson (a real Herfindahl-Hirschman-Index concentration score, and a disclosed, categorical — not statistical — correlation-clustering view) — cross-referenced here rather than re-derived, since managing risk and understanding concentration are two angles on the same underlying computation.",
        "Maximum portfolio risk is where this lesson's content stops being merely descriptive and becomes genuinely, mechanically enforced: settings.maxRiskPerTrade (a percentage of account value per trade) and settings.maxPortfolioRisk (a percentage of account value across every open trade combined) are real hard gates checked by this platform's execution engine before any order — manual, semi-auto, or full-auto — can actually be submitted. A trade that would push either figure over its cap is rejected outright, not just flagged. This is a genuinely different, harder-edged mechanic than the Position Sizing Calculator's own recommendedQuantity figure, which is purely advisory: it suggests a sensible size using the same maxRiskPerTrade setting, but it cannot block a trade — it never calls into the order-submission path at all.",
        "Risk monitoring and managing multiple positions at once means periodically checking the same real signals this Academy's other lessons already cover — the Portfolio Health Score's rolled-up view (/portfolio-dashboard), the concentration/correlation overlay (/concentration-risk), and, for positions that actually need attention, the Attention Queue on the Adjustments page (/adjustments), which surfaces every open position whose deterministic recommendation isn't simply 'hold,' sorted by severity — the platform's real answer to 'how do I keep track of several open positions at once' without a dedicated multi-position dashboard beyond the ones already covered.",
      ],
      whyItMatters: "Confusing this platform's real, hard-enforced risk caps with the Position Sizing Calculator's own advisory-only suggestion is a genuine, common misunderstanding — this lesson exists specifically to draw that line clearly, since one of them can block your trade and the other cannot.",
      externalHref: "/position-sizing",
      relatedGlossaryKeys: ["position-sizing", "concentration", "buying-power", "max-portfolio-risk"],
      estimatedMinutes: 12,
      difficulty: "intermediate",
      whyItExists: "Risk management on this platform genuinely spans two different mechanisms — a hard-enforced gate and an advisory calculator — and a learner who only sees one of them will either overestimate how much protection the advisory tool provides, or underestimate how directly the hard caps constrain their trading.",
      institutionalThinking: "Institutional risk desks distinguish hard limits (which block an action outright) from advisory guidance (which informs a decision but doesn't prevent it) as a matter of course — this platform's own architecture happens to mirror that exact distinction, which makes it a genuinely useful real-world parallel to teach directly from source, not from analogy.",
      screenWalkthrough: [
        "Navigate to /position-sizing, enter a hypothetical trade's details, and review the recommended quantity plus the before/after Portfolio Impact comparison.",
        "Navigate to Settings and note the real maxRiskPerTrade and maxPortfolioRisk values — these are the actual hard caps the execution engine checks, not just informational settings.",
        "Navigate to /adjustments and review the Attention Queue's Severity/POP/DTE columns for any open position needing action.",
        "Navigate to /concentration-risk for the full concentration/correlation detail (covered fully in the Portfolio Greeks lesson).",
      ],
      workflowSteps: [
        "Before opening any new position, run it through the Position Sizing Calculator to see its real before/after portfolio impact.",
        "Know your own account's maxRiskPerTrade and maxPortfolioRisk settings — these are the real numbers that can reject a trade outright.",
        "Recognize that a trade the calculator merely 'suggests' resizing is still your own decision — it will not stop you the way the hard caps will.",
        "Periodically review the Attention Queue on Adjustments for any open position that isn't simply 'hold.'",
        "Use the Concentration overlay's HHI score and clustering view for a portfolio-wide sanity check across all open positions at once.",
      ],
      metricsExplained: [
        { term: "maxRiskPerTrade", explanation: "A hard, per-trade cap (percent of account value) enforced by the execution engine before any order — manual or automated — can be submitted." },
        { term: "maxPortfolioRisk", explanation: "A hard, whole-account cap (percent of account value across every open trade combined) enforced the same way — a trade that would push the account over this line is rejected." },
        { term: "recommendedQuantity", explanation: "The Position Sizing Calculator's own advisory suggestion, derived from the same maxRiskPerTrade setting — informational only, and unable to block a trade on its own." },
        { term: "Total risk dollars / exposure by symbol", explanation: "The real, whole-account risk-dollar total across every open position, split by symbol — the same figures both the Position Sizing Calculator's snapshot and the Concentration overlay read from." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Sizing a trade to the calculator's suggestion, comfortably inside both hard caps",
          steps: [
            "A trader runs a candidate trade through the Position Sizing Calculator, sees a recommended quantity well within their own maxRiskPerTrade, and confirms the before/after Portfolio Impact keeps the account's aggregate risk comfortably under maxPortfolioRisk too.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "A trade near the caps that the calculator flags as elevated but doesn't outright reject",
          steps: [
            "A candidate trade's recommended quantity is smaller than the trader's initial instinct, and the Portfolio Impact comparison shows the account's aggregate risk would land close to, but still under, maxPortfolioRisk.",
          ],
          note: "'Under the cap' is not the same as 'comfortable' — a trade that barely clears the hard limit leaves little room for the next opportunity.",
        },
        {
          label: "Poor Opportunity",
          title: "Attempting a trade that the execution engine actually rejects",
          steps: [
            "A trader ignores the Position Sizing Calculator's own advisory suggestion, attempts to submit a larger size anyway, and the trade is rejected outright by the execution engine's hard maxPortfolioRisk check — not merely flagged, genuinely blocked.",
          ],
          note: "This is the real, mechanical difference this lesson is built around: the advisory tool can be overridden by the user's own judgment, the hard cap cannot.",
        },
      ],
      commonMistakes: [
        "Assuming the Position Sizing Calculator's recommended quantity is a hard limit — it is advisory only and cannot block a trade.",
        "Not knowing your own account's maxRiskPerTrade/maxPortfolioRisk settings before attempting to size a large trade, then being surprised when it's rejected.",
        "Treating 'passed the hard caps' as equivalent to 'a good trade' — clearing a risk limit is a floor, not an endorsement.",
        "Ignoring the Attention Queue on Adjustments until a position has already moved significantly against you.",
      ],
      riskWarnings: [
        "Clearing the hard portfolio-risk caps does not mean a trade is a good idea — it only means it doesn't breach a structural limit.",
        "The Position Sizing Calculator's suggestion is informational — you can still oversize a trade up to the hard cap if you choose to.",
        "This lesson is educational only — nothing here is a recommendation to size or place any specific trade.",
      ],
      bestPractices: [
        "Always run a candidate trade through the Position Sizing Calculator before entering it, even when you're confident about the size.",
        "Know the real difference between an advisory suggestion and a hard, trade-blocking cap before assuming either one protects you.",
        "Check the Attention Queue regularly rather than only when a position has already become a problem.",
      ],
      relatedModuleHrefs: ["/position-sizing", "/concentration-risk", "/adjustments", "/portfolio-dashboard"],
      aiCoachPrompts: [
        "Explain the difference between this platform's hard risk caps and the Position Sizing Calculator's own advisory suggestion.",
        "Walk me through what actually happens if I try to submit a trade that would breach maxPortfolioRisk.",
        "How does the Attention Queue on Adjustments help me manage several open positions at once?",
        "What's the relationship between position sizing and the Concentration overlay's own risk score?",
      ],
      nextStepKeys: ["portfolio-managing-positions"],
      knowledgeCheck: [
        {
          prompt: "Can the Position Sizing Calculator's recommended quantity block a trade from being submitted?",
          options: ["Yes, it enforces a hard cap", "No — it is advisory only and never calls into the order-submission path", "Yes, but only in full-auto mode", "No, because the calculator doesn't exist"],
          correctIndex: 1,
          explanation: "positionSizing.ts's recommendedQuantity is explicitly advisory-only by its own design — it never contacts the execution/order-submission path and cannot block anything.",
        },
        {
          prompt: "What happens if a trade would push the account's aggregate risk over settings.maxPortfolioRisk?",
          options: ["The trade is flagged but still allowed", "The trade is rejected outright by the execution engine, before submission", "The Position Sizing Calculator automatically resizes it", "Nothing — this cap only applies to full-auto trades"],
          correctIndex: 1,
          explanation: "maxPortfolioRisk is a hard, trade-blocking cap enforced by execution.ts's validatePreTrade() for every order path — manual, semi-auto, and full-auto — not just an advisory flag.",
        },
        {
          prompt: "Where does the Attention Queue live, and what does it show?",
          options: ["On the Position Sizing page, showing recommended quantities", "On the Adjustments page, showing open positions whose recommendation isn't 'hold,' sorted by severity, with POP and DTE columns", "On the Concentration overlay, showing sector clusters", "It doesn't exist on this platform"],
          correctIndex: 1,
          explanation: "The Attention Queue is a real feature of the Adjustments page (/adjustments), surfacing exactly the open positions needing a decision, with real Severity/POP/DTE detail per row.",
        },
        {
          prompt: "Is clearing this platform's hard portfolio-risk caps the same as a trade being 'a good trade'?",
          options: ["Yes, clearing the caps guarantees profitability", "No — clearing a hard cap only means a structural limit wasn't breached, not that the trade is a good idea", "Yes, but only for defined-risk strategies", "The caps don't apply to any real trade"],
          correctIndex: 1,
          explanation: "The hard risk caps are a floor, not an endorsement — a trade can clear every structural limit and still be a poor decision on its own merits.",
        },
        {
          prompt: "What is the real, mechanical difference between maxRiskPerTrade/maxPortfolioRisk and the Position Sizing Calculator's own recommendedQuantity?",
          options: ["There is no difference — both are equally enforced", "The former are hard, order-blocking caps; the latter is a purely informational suggestion that cannot block a trade", "The former are advisory; the latter is a hard cap", "Both only apply to automated trading"],
          correctIndex: 1,
          explanation: "settings.maxRiskPerTrade/maxPortfolioRisk are enforced by execution.ts's validatePreTrade() and can reject a trade outright; the Position Sizing Calculator's recommendedQuantity is advisory-only and has no ability to block anything.",
        },
      ],
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
    // v1.4.0, Sprint L2H — Institutional Options Portfolio Management
    // Academy. Upgraded in place (key preserved; Module 2: Portfolio
    // Greeks). Deliberately does NOT re-derive the Greeks math the
    // pre-existing greeks-portfolio-greeks lesson (GREEKS_PATH, Sprint
    // L2F) already covers in depth — this lesson's own, genuinely
    // distinct angle is USING net Greeks to reason about diversification
    // and concentration, plus the one real Greeks chart on this exact
    // page, none of which greeks-portfolio-greeks's own content covers.
    topic({
      key: "portfolio-concentration",
      title: "Portfolio Greeks: Net Exposure, Diversification, and Concentration Risk",
      summary: "Delta, Gamma, Theta, and Vega aren't just single-position numbers — used at the portfolio level, they're a genuine risk-management tool, and this platform visualizes exactly one of them.",
      body: [
        "This lesson builds on the Greeks curriculum's own 'Understanding the Greeks in Practice' lesson, which already covers exactly how this platform computes net portfolio Delta, Gamma, Theta, and Vega (a plain, un-weighted sum of every open position's own Black-Scholes Greeks — cross-reference that lesson for the full math and the confirmed 'Beta-Weighted Delta' label mismatch). This lesson's own focus is different and additive: using those same net Greek figures to reason about how concentrated or diversified a portfolio actually is.",
        "Net Greek exposure as a diversification signal: this platform's own Portfolio Health Score computes a real factor — 100 minus the largest single position's share of the account's total absolute delta — meaning a portfolio where one position accounts for most of the net delta scores worse on this factor than one where delta is spread across several positions, even at the same total net-delta figure. A large net delta concentrated in one name is a genuinely different risk than the same net delta spread across five.",
        "Concentration risk, computed for real: this platform's Correlation & Concentration Risk Overlay (/concentration-risk) computes a genuine Herfindahl-Hirschman Index — the sum of each position's squared weight (by risk dollars, not account value), scaled to 0-100 — across symbol, sector, strategy, expiration, and directional-bias dimensions. This is a standard, well-established concentration statistic, not a fabricated proprietary formula. Sector classification, honestly disclosed, comes from a small, static, hand-curated table covering this platform's own known universe — not a live market-data feed — and an unrecognized symbol is honestly labeled 'Unclassified' rather than guessed.",
        "Diversification is the same score, read the other way — the Portfolio Health Score's own 'Diversification' factor is 100 minus the sector-level HHI, computed from the exact same overlay. 'Correlation,' on this platform, is explicitly disclosed as a categorical grouping (positions sharing a symbol, sector, strategy, expiration, or directional bias, when at least two positions share the trait) rather than a genuine statistical correlation coefficient — there is no price-return covariance matrix computed anywhere in this engine, and the platform states that honestly rather than implying a level of statistical rigor it doesn't have.",
        "How the platform actually visualizes this: there is exactly one Greeks-related chart anywhere in this platform's frontend — the 'Greeks Contribution' bar chart on the Concentration overlay page, plotting each open position's own delta contribution to the portfolio's net delta, colored by sign. No other page charts gamma, theta, or vega — those remain plain numeric figures on the Account Snapshot and Portfolio Greeks pages. A separate Concentration Heat Map on the same page visualizes weight-by-position via color intensity, not Greeks specifically.",
      ],
      whyItMatters: "Net Greeks and concentration risk are two views of the same underlying question — 'how much of my account's outcome depends on one thing going right' — and seeing them computed from the exact same position data, side by side, is what makes portfolio-level risk management click in a way single-position Greeks alone don't.",
      externalHref: "/concentration-risk",
      relatedGlossaryKeys: ["concentration", "diversification", "correlation", "delta", "portfolio-health"],
      estimatedMinutes: 11,
      difficulty: "intermediate",
      whyItExists: "Understanding Greeks as single-position definitions (covered elsewhere in this platform's curriculum) is a prerequisite, not a substitute, for understanding how those same numbers are actually used to manage a whole portfolio's concentration risk — this lesson exists to make that operational use explicit without re-teaching the definitions.",
      institutionalThinking: "Institutional risk desks routinely decompose a portfolio's own net Greek exposure by position, sector, or strategy to find hidden concentration — a large net delta that looks fine in aggregate can be a serious problem if it's really just one oversized bet wearing five different tickers.",
      screenWalkthrough: [
        "Navigate to /portfolio and note the net Delta/Theta/Vega/Gamma figures — this is the same plain-sum computation the Understanding the Greeks lesson already covers in depth.",
        "Navigate to /concentration-risk and review the Greeks Contribution bar chart — the one real Greeks visualization on this platform, showing each position's own delta contribution.",
        "On the same page, review the Concentration Analysis section's dimension selector (symbol/sector/strategy/expiration/directional bias) and the Concentration Heat Map.",
        "Review the Correlation Clusters section, explicitly labeled as categorical grouping rather than a statistical model.",
      ],
      workflowSteps: [
        "Check net Delta/Theta/Vega/Gamma on the Portfolio Greeks page as a starting point.",
        "Open the Concentration overlay and review the Greeks Contribution chart to see whether net delta is spread across positions or concentrated in one.",
        "Review the concentration score across each available dimension (symbol/sector/strategy/expiration) — a high score in any one dimension is worth investigating even if the overall score looks moderate.",
        "Read the Correlation Clusters as categorical groupings — a useful signal, not a substitute for a genuine statistical correlation model, which this platform does not compute.",
        "Cross-reference the Portfolio Health Score's own Concentration and Diversification factors, since both are derived from this exact same overlay.",
      ],
      metricsExplained: [
        { term: "Net delta share (top position)", explanation: "The largest single position's share of the portfolio's total absolute delta — used directly in the Portfolio Health Score's own net-Greeks-exposure factor." },
        { term: "Concentration score (HHI)", explanation: "A genuine Herfindahl-Hirschman Index, 0-100, computed from each position's squared share of total risk dollars — a standard concentration statistic, not a fabricated formula." },
        { term: "Sector classification", explanation: "A small, static, hand-curated table covering this platform's own known universe — never live market data, and an unrecognized symbol is honestly labeled 'Unclassified.'" },
        { term: "Correlation clusters", explanation: "Categorical groupings of positions sharing a symbol/sector/strategy/expiration/directional bias — explicitly disclosed as not a statistical correlation model." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Net delta spread across several positions, low concentration score",
          steps: [
            "A portfolio's net delta is moderate, and the Greeks Contribution chart shows it's spread fairly evenly across five different positions.",
            "The Concentration overlay's symbol/sector scores are both in the 'well diversified' range.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "A moderate concentration score driven by one sector, not one symbol",
          steps: [
            "The overall concentration score reads as 'moderate,' but the sector-dimension score is notably higher than the symbol-dimension score — several different tickers, all in the same sector.",
          ],
          note: "Checking only the overall or symbol-level score can miss a genuine sector-level concentration that a different dimension reveals.",
        },
        {
          label: "Poor Opportunity",
          title: "One position driving most of the portfolio's net delta",
          steps: [
            "The Greeks Contribution chart shows one position accounting for the large majority of the portfolio's net delta, and the Portfolio Health Score's net-Greeks-exposure factor scores poorly as a direct result.",
          ],
          note: "A moderate-looking total net delta can hide a concentrated bet in a single name — the per-position chart is what actually reveals this, not the aggregate number alone.",
        },
      ],
      commonMistakes: [
        "Reading only the aggregate net delta figure without checking the Greeks Contribution chart for how concentrated that delta actually is.",
        "Treating 'Correlation Clusters' as a genuine statistical correlation model — this platform explicitly discloses it's categorical grouping, not a covariance calculation.",
        "Checking only the symbol-level concentration score and missing a real sector-level concentration a different dimension would reveal.",
        "Assuming gamma, theta, and vega are charted somewhere — only delta has a dedicated chart on this platform today.",
      ],
      riskWarnings: [
        "A moderate aggregate net delta can still hide a concentrated single-position bet — always check the per-position breakdown, not just the total.",
        "Sector classification is static, hand-curated metadata, not a live feed — treat it as directionally useful, not authoritative for every symbol.",
        "This lesson is educational only — nothing here is a recommendation to adjust any specific position or allocation.",
      ],
      bestPractices: [
        "Check the Greeks Contribution chart alongside the aggregate net-Greeks figures, not instead of them.",
        "Review concentration across every available dimension (symbol/sector/strategy/expiration), not just the overall score.",
        "Treat Correlation Clusters as a useful categorical signal, and remember it isn't a substitute for genuine statistical diversification analysis.",
      ],
      relatedModuleHrefs: ["/concentration-risk", "/portfolio", "/portfolio-dashboard"],
      aiCoachPrompts: [
        "Explain how the Portfolio Health Score's net-Greeks-exposure factor is derived from position-level delta contributions.",
        "Why does this platform disclose that 'Correlation Clusters' aren't a real statistical correlation model?",
        "Walk me through how the Concentration overlay's HHI score is actually computed.",
        "Which Greek does this platform actually chart, and why not the others?",
      ],
      nextStepKeys: ["portfolio-position-sizing"],
      knowledgeCheck: [
        {
          prompt: "How does this platform's Portfolio Health Score treat a large net delta that's concentrated in one position, versus the same net delta spread across five?",
          options: ["Both score identically, since only the aggregate net delta matters", "The concentrated version scores worse on the net-Greeks-exposure factor, based on the largest position's share of total absolute delta", "Concentration only affects the sector dimension, never Greeks", "The platform doesn't distinguish between the two cases at all"],
          correctIndex: 1,
          explanation: "The net-Greeks-exposure health factor is 100 minus the largest single position's share of total absolute delta — a concentrated bet scores worse than the same aggregate delta spread across multiple positions.",
        },
        {
          prompt: "What kind of calculation is this platform's Concentration Score?",
          options: ["A fabricated proprietary formula unique to this platform", "A genuine Herfindahl-Hirschman Index (HHI), a standard, well-established concentration statistic", "A simple average of position sizes", "A live statistical correlation coefficient"],
          correctIndex: 1,
          explanation: "The Concentration Score is explicitly a real HHI — the sum of each position's squared weight — a standard statistic used across many fields, not something invented for this platform.",
        },
        {
          prompt: "Is this platform's sector classification sourced from a live market-data feed?",
          options: ["Yes, refreshed in real time", "No — it's a small, static, hand-curated table covering the platform's own known universe", "Yes, but only for large-cap symbols", "Sector classification doesn't exist on this platform"],
          correctIndex: 1,
          explanation: "Sector classification comes from a disclosed, static, hand-curated mapping — never live data — and an unrecognized symbol is honestly labeled 'Unclassified' rather than guessed.",
        },
        {
          prompt: "Is this platform's 'Correlation Clusters' feature a genuine statistical correlation model?",
          options: ["Yes, it computes a real price-return covariance matrix", "No — it's explicitly disclosed as categorical grouping (shared symbol/sector/strategy/expiration/directional bias), not statistics", "Yes, but only for options positions, not stocks", "Correlation clusters don't exist on this platform"],
          correctIndex: 1,
          explanation: "The platform's own documentation is explicit: Correlation Clusters group positions sharing a categorical trait — there is no statistical correlation coefficient computed anywhere in this engine.",
        },
        {
          prompt: "Which Greek does this platform actually chart on a dedicated visualization?",
          options: ["All four (Delta, Gamma, Theta, Vega) on separate charts", "Only Delta, via the Greeks Contribution bar chart on the Concentration overlay", "Only Theta, via a theta-income chart", "None — all Greeks are shown only as plain numbers"],
          correctIndex: 1,
          explanation: "The Greeks Contribution bar chart on /concentration-risk plots each position's own delta contribution — it is the only Greeks-related chart anywhere in this platform's frontend; gamma/theta/vega remain plain numeric figures elsewhere.",
        },
      ],
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
    // v1.4.0, Sprint L2H — Institutional Options Portfolio Management
    // Academy. NEW topic (Module 4: Managing Existing Positions). Rolling
    // is confirmed genuinely implemented (roll_threatened/roll_untested/
    // convert are all real, detected action types in adjustment.ts) — NOT
    // treated as "educational only," since it is implemented, with the one
    // honest caveat that submitting a roll/convert is always human-gated,
    // never auto-run (adjustment.ts's own header comment states this
    // explicitly for structural changes).
    topic({
      key: "portfolio-managing-positions",
      title: "Managing Existing Positions: Monitoring, Reviewing, and Exit Planning",
      summary: "What to actually check on an open position, and how this platform's own deterministic engine flags the ones that need a decision.",
      body: [
        "Monitoring open positions on this platform centers on the Attention Queue on the Adjustments page (/adjustments) — a real, deterministic list of every open trade whose recommendation isn't simply 'hold,' sorted by severity, with Severity, POP, and DTE shown per row. This is genuinely different from a plain positions list: it's already filtered down to the positions that need a look, using the same adjustment-recommendation logic across every open trade.",
        "Reviewing P/L and Greeks per position means the same real, per-position figures covered elsewhere in this Academy — unrealized P/L and net Greeks on the Portfolio Greeks page — but read here through the lens of 'has this position's situation changed enough to warrant a decision,' not just 'what is it worth right now.'",
        "Evaluating time decay and probability metrics are both real, per-position figures shown directly in the Attention Queue: DTE (days to expiration) and POP (probability of profit, the same modeled — not guaranteed — estimate covered in this platform's own Options Pricing lesson). A position's DTE approaching a configured trigger, or its POP having eroded meaningfully since entry, are exactly the signals this platform's deterministic engine actually watches for.",
        "Exit planning and rolling are both real, implemented decisions this engine actually recommends — not purely conceptual ideas bolted onto a screen that can't act on them. The recommendation engine's own action set includes close_for_profit, close_for_loss, roll_threatened, roll_untested, convert, and reduce_risk, alongside hold/do_nothing. Rolling (extending a position to a later expiration) and converting (restructuring a threatened position into a different structure) are both genuinely detected conditions, not hypothetical — but submitting either one is always a human-gated decision on the Trade Ticket; this platform's own engine never auto-executes a structural change like a roll or a convert, even in full-auto mode, by explicit design.",
        "Daily review workflow for open positions, honestly: there is no separate 'position review' feature beyond the Attention Queue itself — checking it, along with the Portfolio Greeks page for the broader Greeks picture, is the platform's actual real workflow for staying on top of several open positions at once, matching the same honest 'existing screens used together, not one dedicated feature' framing this Academy's Portfolio Overview lesson already establishes for the account level.",
      ],
      whyItMatters: "An open position isn't 'set and forget' — this platform's own deterministic engine already does the work of flagging which of your positions actually need attention, and knowing how to read that signal (rather than manually re-checking every position from scratch each day) is the practical skill this lesson teaches.",
      externalHref: "/adjustments",
      relatedGlossaryKeys: ["probability-of-profit", "theta", "concentration"],
      estimatedMinutes: 11,
      difficulty: "intermediate",
      whyItExists: "Position sizing and portfolio-wide risk (covered elsewhere in this Academy) tell you how much you're risking in aggregate, but they don't tell you which specific open position needs a decision today — that's the genuinely distinct, per-position monitoring job this lesson covers.",
      institutionalThinking: "Professional options desks manage dozens of open positions by exception — reviewing a short, pre-filtered list of positions that have genuinely changed status, rather than re-underwriting every position from scratch every day — which is exactly the design the Attention Queue mirrors.",
      screenWalkthrough: [
        "Navigate to /adjustments and review the Attention Queue table — Severity, POP, and DTE columns per flagged position.",
        "Click a row for the full detail behind that specific recommendation.",
        "Navigate to /portfolio for the same position's own unrealized P/L and Greeks in more detail.",
        "For a candidate roll or convert, use the Trade Adjustment Preview Simulator (/adjustment-preview) to see the real before/after comparison before ever submitting anything.",
      ],
      workflowSteps: [
        "Check the Attention Queue first — it's already filtered to positions needing a decision, not a full re-review of every open trade.",
        "For each flagged position, note its Severity, POP, and DTE before deciding on an action.",
        "Cross-reference the Portfolio Greeks page for that position's own Greeks detail if the recommendation involves a directional or volatility concern.",
        "For a recommended roll or convert, preview it fully on the Trade Adjustment Preview Simulator before submitting anything on the Trade Ticket — remember, this step is always a human decision, never automated.",
        "Recognize that 'hold'/'do_nothing' positions aren't necessarily risk-free — they simply haven't crossed this engine's own thresholds yet.",
      ],
      metricsExplained: [
        { term: "Severity", explanation: "The Attention Queue's own ranked urgency label (e.g. critical/warning/info) for a flagged position's recommendation." },
        { term: "POP (in the Attention Queue)", explanation: "The same modeled probability-of-profit estimate covered elsewhere in this platform's curriculum, shown per position so its erosion since entry is visible at a glance." },
        { term: "DTE", explanation: "Days to expiration remaining on the position — a key input to whether a roll is being considered." },
        { term: "roll_threatened / roll_untested / convert", explanation: "Real, distinct recommended actions this platform's deterministic engine can flag — always requiring human submission on the Trade Ticket, never auto-executed." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Reviewing a flagged roll candidate fully before deciding",
          steps: [
            "A position appears in the Attention Queue with a roll_threatened recommendation, elevated severity, and DTE approaching the configured trigger.",
            "The trader previews the roll fully on the Trade Adjustment Preview Simulator, reviewing the before/after Greeks and breakevens, before deciding whether to submit it on the Trade Ticket.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "Checking the Attention Queue but skipping the Portfolio Greeks cross-reference",
          steps: [
            "A trader reviews the Attention Queue's own Severity/POP/DTE columns for a flagged position, but doesn't cross-check that position's own Greeks detail on the Portfolio Greeks page before deciding.",
          ],
          note: "The Attention Queue's own columns are a real, useful starting point, but they're a summary — the fuller Greeks picture lives on a different page.",
        },
        {
          label: "Poor Opportunity",
          title: "Ignoring 'hold' positions as risk-free",
          steps: [
            "A trader assumes every position marked 'hold' or 'do_nothing' needs no attention at all, and stops monitoring them entirely until they eventually cross a threshold and appear flagged.",
          ],
          note: "'Hold' means this engine's own thresholds haven't been crossed yet — it isn't a statement that the position carries no risk at all.",
        },
      ],
      commonMistakes: [
        "Treating the full open-positions list and the Attention Queue as the same thing — the Attention Queue is already filtered to positions needing a decision.",
        "Submitting a roll or convert directly from the Attention Queue without previewing it on the Trade Adjustment Preview Simulator first.",
        "Assuming any recommended action (roll, convert, close) executes automatically — every structural change requires a human decision on the Trade Ticket.",
        "Ignoring 'hold' positions entirely, rather than recognizing they simply haven't crossed a threshold yet.",
      ],
      riskWarnings: [
        "POP is a modeled estimate, not a guarantee — a position's eroding POP is a signal to review, not a certainty of loss.",
        "This platform never automatically executes a roll or convert, in any mode — always confirm the specific terms on the Trade Ticket yourself.",
        "This lesson is educational only — nothing here is a recommendation to close, roll, or convert any specific position.",
      ],
      bestPractices: [
        "Use the Attention Queue as your first stop, not a full manual review of every open position from scratch.",
        "Always preview a roll or convert on the Trade Adjustment Preview Simulator before submitting it.",
        "Periodically revisit 'hold' positions anyway, since thresholds can be crossed between reviews.",
      ],
      relatedModuleHrefs: ["/adjustments", "/adjustment-preview", "/portfolio"],
      aiCoachPrompts: [
        "Explain what 'roll_threatened' actually means and what triggers it.",
        "Walk me through the difference between a rolled position and a converted position.",
        "Why does this platform never auto-execute a roll or convert, even in full-auto mode?",
        "What does it mean for a position to still be flagged 'hold' — is that the same as risk-free?",
      ],
      nextStepKeys: ["portfolio-ai-review-workflow"],
      knowledgeCheck: [
        {
          prompt: "What is the Attention Queue on the Adjustments page?",
          options: ["A complete, unfiltered list of every open position", "A list of open positions whose recommendation isn't simply 'hold,' sorted by severity, with POP and DTE shown per row", "A list of only profitable positions", "A feature that doesn't exist on this platform"],
          correctIndex: 1,
          explanation: "The Attention Queue is deliberately pre-filtered — it surfaces only positions whose deterministic recommendation is something other than hold/do_nothing, sorted by severity.",
        },
        {
          prompt: "Is rolling a position genuinely implemented on this platform, or purely conceptual?",
          options: ["Purely conceptual — there is no real detection or preview for it", "Genuinely implemented — roll_threatened/roll_untested are real, detected recommendations, with a full preview simulator, though submission is always human-gated", "Fully automated — the platform rolls positions on its own", "Only available in full-auto mode"],
          correctIndex: 1,
          explanation: "Rolling is a real, detected recommendation with a genuine before/after preview simulator — the one honest caveat is that actually submitting a roll always requires a human decision on the Trade Ticket, never automated.",
        },
        {
          prompt: "Does this platform ever automatically execute a roll or convert, even in full-auto mode?",
          options: ["Yes, always in full-auto mode", "No — structural changes like rolls and converts are always human-gated, by explicit design", "Only for positions with critical severity", "Only for iron condors, never iron flies"],
          correctIndex: 1,
          explanation: "The adjustment engine's own design explicitly states rolling and converting are multi-leg structural changes that are never auto-run, regardless of execution mode.",
        },
        {
          prompt: "What does DTE mean in the context of the Attention Queue?",
          options: ["Daily Trade Estimate", "Days to expiration remaining on the position", "Delta-Theta Efficiency", "Days The Engine has monitored the position"],
          correctIndex: 1,
          explanation: "DTE is days to expiration — a key input into whether a position is approaching the point where a roll decision becomes relevant.",
        },
        {
          prompt: "What should you do before submitting a recommended roll or convert?",
          options: ["Submit it immediately, since the recommendation is already validated", "Preview it fully on the Trade Adjustment Preview Simulator first", "Nothing — the platform submits it automatically", "Wait for the position to reach 0 DTE"],
          correctIndex: 1,
          explanation: "The Trade Adjustment Preview Simulator shows a full before/after comparison — reviewing it before submitting anything on the Trade Ticket is the platform's own established, honest workflow for any structural change.",
        },
      ],
    }),
    // v1.4.0, Sprint L2H — Institutional Options Portfolio Management
    // Academy. NEW topic (Module 5: AI Portfolio Review). Deliberately
    // narrow and honest about what "AI" actually means at the portfolio
    // level on this platform: only Market Briefing prose and Report
    // Comparison prose are genuinely LLM-narrated; Portfolio Analyst and
    // Institutional Mentor are explicitly, repeatedly self-disclaimed in
    // their own source as NOT an LLM/chatbot — this lesson never
    // describes their deterministic scoring as "AI reasoning," and never
    // invents a free-form chat-with-the-AI-about-your-portfolio feature,
    // since none of the three real portfolio-review pages has one.
    topic({
      key: "portfolio-ai-review-workflow",
      title: "AI Portfolio Review: What's Genuinely AI-Narrated, and What Isn't",
      summary: "Using this platform's real AI-narrated portfolio prose alongside its deterministic scoring tools — without mistaking one for the other.",
      body: [
        "This platform's genuinely LLM-narrated portfolio-level content is narrower than it might first appear, and knowing exactly where the line sits matters: the AI Market Briefing on the Portfolio AI cockpit (/portfolio-ai) is real, streamed LLM prose over deterministic regime/VIX/IV-rank/breadth/catalyst inputs, and the Report Comparison narration (when comparing two saved Daily Reports) is likewise real LLM prose describing what changed between them. Both carry this platform's standard coach disclaimer, enforced on every response, template-fallback included: this is educational analysis only, never a trade recommendation, and the platform never executes an order on its own.",
        "Using the AI Coach to review a portfolio, in practice, means: open the Portfolio AI cockpit, read the Account Snapshot and Portfolio Health/Market Exposure/Risk Concentration gauges, then use the Market Briefing's streamed narration for context on the broader market backdrop those numbers sit within. There is no free-form question box anywhere on this platform's real portfolio-review pages — you cannot type an open-ended question about your specific portfolio and get an LLM-generated answer back; the AI narration that does exist is scoped to the Market Briefing and Report Comparison specifically.",
        "Example prompts, honestly scoped to what's real: since there's no chat box, 'prompts' here mean the deterministic AI Coach prompts already surfaced on this platform's own Portfolio AI lesson content — questions like 'Explain my Portfolio Health Score' or 'What changed between my last two Daily Reports?' — both of which map directly onto the Market Briefing/Report Comparison narration this lesson describes, not a separate capability.",
        "Risk review and decision support on this platform are, for the most part, genuinely deterministic, not AI-narrated — and this platform's own source code is explicit and repeated about it: both the AI Portfolio Analyst and the Institutional Mentor state directly, in their own header comments and frontend badges, that they are 'not an LLM, not a chatbot, not predictive AI.' The Portfolio Analyst composes an Executive Briefing and Health/Risk/Income/Greeks/Event summaries; the Institutional Mentor produces a 9-category Portfolio Scorecard plus threshold-gated Professional/Decision/Risk Reviews — both are template-and-threshold-based compositions of already-computed figures, genuinely useful for structured review, but never AI reasoning about your specific situation.",
        "Weekly review process, honestly: there is no single dedicated 'weekly review' feature. The closest real analog is the Portfolio Health Trend chart on the Portfolio AI cockpit, which plots your own saved Daily Reports' Health Score over a 2-week/1-month/3-month/all-time window — genuinely useful for spotting a trend, but it's a chart over already-saved reports, not a separate weekly-cadence feature. As with this Academy's own Portfolio Overview lesson, the honest answer is that a 'weekly review' here means periodically revisiting the Health Trend chart, the Report History, and your own Trading Journal entries together — existing pieces used with a weekly cadence you set yourself, not a feature the platform enforces or automates.",
      ],
      whyItMatters: "The word 'AI' means genuinely different things across this platform's own three portfolio-review surfaces — real LLM narration in exactly two places, and explicitly-disclaimed deterministic scoring everywhere else — and conflating them is the single most likely way to either over-trust a template score as 'the AI's opinion,' or under-use the real narration that does exist.",
      externalHref: "/portfolio-ai",
      relatedGlossaryKeys: ["portfolio-health", "portfolio-diversification-score"],
      estimatedMinutes: 10,
      difficulty: "intermediate",
      whyItExists: "The sprint brief for this Academy asked for an 'AI Portfolio Review' lesson, and the honest, accurate version of that lesson has to draw a line this platform's own source code already draws clearly — between genuine LLM narration and deterministic, explicitly-not-AI scoring — rather than blur the two together.",
      institutionalThinking: "Distinguishing a genuine model-generated narrative from a deterministic, rules-based score is a basic due-diligence habit on any real desk that uses both — this platform's own explicit self-disclosure in the Portfolio Analyst's and Institutional Mentor's source code is exactly the kind of transparency that habit depends on.",
      screenWalkthrough: [
        "Navigate to /portfolio-ai and read the Account Snapshot, Portfolio Greeks, and the three score gauges (Portfolio Health, Market Exposure, Risk Concentration).",
        "Open the AI Market Briefing card and note it is genuinely streamed LLM prose — the platform's only true open-ended-feeling narration at the portfolio level, though grounded entirely in deterministic market inputs, not your specific positions.",
        "Select two saved reports in Compare mode to see the Report Comparison's own streamed narration of what changed.",
        "Separately, visit /portfolio-analyst and /institutional-mentor and note both pages' own explicit 'not an LLM/chatbot' badges and disclosures.",
      ],
      workflowSteps: [
        "Start with the Account Snapshot and score gauges on the Portfolio AI cockpit for the deterministic headline numbers.",
        "Read the AI Market Briefing for genuine narrated context on the broader market backdrop.",
        "Periodically use the Report Comparison narration to see what's changed between two saved Daily Reports.",
        "Separately, use the Portfolio Analyst and Institutional Mentor for their own deterministic, template-based scoring and review sections — recognizing them as structured composition, not AI narration.",
        "Revisit the Health Trend chart and your own Trading Journal entries on a cadence you set yourself — the platform's real substitute for a dedicated weekly review feature.",
      ],
      metricsExplained: [
        { term: "AI Market Briefing", explanation: "Genuine, streamed LLM prose over deterministic regime/VIX/IV-rank/breadth/catalyst inputs — carries the standard coach disclaimer on every response." },
        { term: "Report Comparison narration", explanation: "Genuine, streamed LLM prose describing the deltas between two saved Daily Reports — health/exposure/risk scores, position changes, net Greeks and P/L moves." },
        { term: "Portfolio Analyst / Institutional Mentor", explanation: "Both explicitly self-disclaimed in their own source as 'not an LLM, not a chatbot, not predictive AI' — deterministic, template-and-threshold-based compositions of already-computed figures." },
        { term: "Portfolio Health Trend", explanation: "A chart of your own saved Daily Reports' Health Score over 2W/1M/3M/all-time windows — the closest real analog to a 'weekly review' feature, though it's a chart, not a separate scheduled process." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Using the Market Briefing and score gauges together, correctly, for what each actually is",
          steps: [
            "A trader reads the deterministic Portfolio Health/Market Exposure/Risk Concentration gauges for the headline numbers, then reads the genuinely AI-narrated Market Briefing for broader market context, treating each for what it actually is.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "Using the Institutional Mentor's Scorecard without checking its own disclosure",
          steps: [
            "A trader relies on the Institutional Mentor's 9-category Scorecard for a review, without having read its own explicit 'not an LLM, not a chatbot' disclosure — the scoring itself is real and useful, but the trader's mental model of what produced it is inaccurate.",
          ],
          note: "The Scorecard's numbers are genuinely computed and useful; the risk here is purely in misunderstanding what kind of tool produced them.",
        },
        {
          label: "Poor Opportunity",
          title: "Looking for a chat box to ask the AI a free-form question about a specific portfolio",
          steps: [
            "A trader expects to type an open-ended question about their own positions into an AI chat interface on the Portfolio AI, Portfolio Analyst, or Institutional Mentor pages, and finds no such box exists on any of them.",
          ],
          note: "No free-form portfolio-question chat interface exists on this platform today — the real AI narration is scoped specifically to the Market Briefing and Report Comparison.",
        },
      ],
      commonMistakes: [
        "Assuming the Institutional Mentor or Portfolio Analyst's scoring is AI-generated reasoning — both are explicitly, repeatedly disclaimed as deterministic, not LLM-based.",
        "Looking for a free-form chat box to ask the AI about a specific portfolio — none exists on any of the three real portfolio-review pages.",
        "Treating the Market Briefing's narration as being about your specific positions — it narrates deterministic market-wide inputs (regime, VIX, IV rank, breadth), not your own portfolio's holdings.",
        "Expecting a single dedicated 'weekly review' feature — the real workflow combines the Health Trend chart, Report History, and Trading Journal on a cadence you set yourself.",
      ],
      riskWarnings: [
        "Every AI-narrated response on this platform carries the same disclaimer: educational analysis only, never a trade recommendation, and the platform never executes on its own.",
        "The Market Briefing narrates market-wide conditions, not a personalized read of your own specific positions — don't conflate the two.",
        "This lesson is educational only — nothing here is a recommendation to act on any narration, score, or review output.",
      ],
      bestPractices: [
        "Know which of the three real portfolio-review surfaces is genuinely AI-narrated (Market Briefing, Report Comparison) versus deterministic (Portfolio Analyst, Institutional Mentor) before relying on either.",
        "Use the Health Trend chart and Report History together for the closest real analog to a weekly review, on a cadence you set yourself.",
        "Read a platform feature's own disclosure text (badges, header comments where visible) rather than assuming a feature is 'AI' just because it appears alongside genuinely AI-narrated content.",
      ],
      relatedModuleHrefs: ["/portfolio-ai", "/portfolio-analyst", "/institutional-mentor"],
      aiCoachPrompts: [
        "Explain my Portfolio Health Score.",
        "What changed between my last two Daily Reports?",
        "Which parts of this platform's portfolio review tools are genuinely AI-narrated, and which are deterministic?",
        "Why doesn't the Institutional Mentor's Scorecard count as an AI-generated recommendation?",
      ],
      nextStepKeys: [],
      knowledgeCheck: [
        {
          prompt: "Which of this platform's portfolio-level features is genuinely, streamed LLM-narrated?",
          options: ["The Institutional Mentor's Scorecard", "The AI Market Briefing and Report Comparison narration", "The Portfolio Analyst's Executive Briefing", "All portfolio features are equally AI-narrated"],
          correctIndex: 1,
          explanation: "Only the Market Briefing and Report Comparison are genuinely, streamed LLM-narrated at the portfolio level — the Portfolio Analyst and Institutional Mentor are both explicitly self-disclaimed as deterministic, not AI.",
        },
        {
          prompt: "Does this platform have a free-form chat box for asking the AI open-ended questions about a specific portfolio?",
          options: ["Yes, on the Portfolio AI cockpit", "No — none exists on any of the three real portfolio-review pages", "Yes, but only on the Institutional Mentor page", "Yes, through the Trade Ticket"],
          correctIndex: 1,
          explanation: "No free-form question box exists on the Portfolio AI, Portfolio Analyst, or Institutional Mentor pages — the real AI narration is scoped specifically to the Market Briefing and Report Comparison.",
        },
        {
          prompt: "How does the Institutional Mentor describe its own Scorecard, in its own source and frontend badges?",
          options: ["As an AI-generated recommendation engine", "As explicitly NOT an LLM, chatbot, or predictive AI — a deterministic, template-based review", "As a live broker feed", "It makes no claim either way"],
          correctIndex: 1,
          explanation: "Both the Institutional Mentor and the Portfolio Analyst state directly, in their own header comments and frontend badges, that they are not an LLM, chatbot, or predictive AI.",
        },
        {
          prompt: "What does the AI Market Briefing actually narrate?",
          options: ["A personalized read of your own specific open positions", "Deterministic market-wide inputs — regime, VIX, IV rank, breadth, catalysts", "Your account's exact P&L history", "Nothing — it's a static template"],
          correctIndex: 1,
          explanation: "The Market Briefing narrates deterministic, market-wide conditions (regime/VIX/IV-rank/breadth/catalysts) — it is not a personalized narration of your own specific portfolio holdings.",
        },
        {
          prompt: "What is the closest real feature to a 'weekly review' on this platform?",
          options: ["A dedicated Weekly Review button that runs automatically", "The Portfolio Health Trend chart plus Report History and Trading Journal, used together on a cadence you set", "The Institutional Mentor's Scorecard alone", "There is no analog at all"],
          correctIndex: 1,
          explanation: "No single dedicated weekly-review feature exists — the honest, real analog is combining the Health Trend chart, Report History, and Trading Journal on whatever cadence you choose to set yourself.",
        },
      ],
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
      nextStepKeys: ["market-structure-fundamentals"],
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
      key: "market-structure-fundamentals",
      title: "Market Structure Fundamentals: HH/HL, LH/LL, and Trend",
      summary: "The professional concepts behind trend reading — and an honest look at what the platform does and does not detect.",
      body: [
        "This is a Trading Academy lesson, not a repeat of the Market Structure Workbench's own module guide (see that lesson first if you haven't — it covers every panel/button on the page). Here the goal is different: understand the underlying professional concepts, then see exactly how the platform's real Market Structure Engine does and does not implement them.",
        "Market structure reading starts with swing points — a swing high is a local peak, a swing low a local trough. A sequence of rising swing highs AND rising swing lows is what professionals call an uptrend (Higher Highs, Higher Lows — HH/HL). A sequence of falling highs AND falling lows is a downtrend (Lower Highs, Lower Lows — LH/LL). Anything that doesn't cleanly fit either pattern is typically read as a range or consolidation.",
        "Two further professional concepts worth knowing: Break of Structure (BoS) — a swing point being decisively broken in a way that continues the prevailing trend — and Change of Character (CHoCH) — the first swing break that signals a trend may be reversing, distinct from one that merely continues it. Both are real, standard trading vocabulary.",
        "Honest disclosure, stated plainly and up front: this platform deliberately does NOT use the terms Break of Structure or Change of Character anywhere, and does not compute either as a distinct, labeled event. Its own Structure Shift Timeline test suite explicitly asserts that no event label ever matches BOS/CHOCH/MSS. This is a real, intentional design decision in the codebase, not an oversight — the platform reports its own honestly-named events instead (see below), and a trader must do the BoS/CHoCH interpretation themselves.",
      ],
      whyItMatters: "Understanding HH/HL vs LH/LL — and knowing precisely which parts of that professional framework the platform does and doesn't automate — lets you use the Market Structure Workbench's real output correctly, without assuming it's silently doing ICT/SMC-style event labeling behind the scenes.",
      difficulty: "intermediate",
      whyItExists: "The Trading Academy's own quality standard requires teaching concepts through the real platform, never generic theory alone, and requires clearly distinguishing educational concepts from implemented features — this lesson exists specifically to satisfy both at once for market structure, since a naive treatment could easily overclaim what the engine detects.",
      institutionalThinking: "A professional never assumes a tool implements every concept they know — they check what a specific tool actually measures before relying on it. Here, that means reading the Market Structure Workbench's own trend label and Structure Shift Timeline literally (what it says), then applying BoS/CHoCH reasoning yourself on top of that real data, rather than assuming the page has already done that reasoning for you.",
      screenWalkthrough: [
        "Swing High / Swing Low Explorer (Market Structure Workbench, center panel) — the platform's real, disclosed detection: a candle counts as a swing high/low only if its high/low is at least as extreme as the 2 candles immediately before AND after it (a fixed 5-candle window, never a configurable fractal size).",
        "Trend label (left panel, Structure Overview) — a flat, 3-way classification: uptrend, downtrend, or range — derived from only the most recent 3 swing highs and 3 swing lows. Uptrend requires those 3 highs AND those 3 lows to be strictly, monotonically rising; downtrend requires both strictly falling; anything else, including a partial or mixed sequence, honestly reads range.",
        "HH/HL/LH/LL Sequence (center panel) — the actual sequence of swing-classification events driving the trend read, so you can see the individual swings behind the single trend label rather than trusting it blindly.",
        "Structure Shift Timeline (center panel) — a real, 9-event log: New Higher High, New Higher Low, New Lower High, New Lower Low, Trend Change, Range Entry, Range Exit, Support Test, Resistance Test. Read this literally — 'Trend Change' is the platform's own honest, generic label for ANY transition between two non-range trend states; it does not distinguish a continuation break from a reversal break the way BoS vs. CHoCH would.",
        "Support & Resistance Zone Explorer (center panel) — swing points clustered within 0.5% of each other; a zone's 'strength' is simply its touch count, a price-pivot-repetition fact, never a liquidity or order-flow measure (that distinction matters for the Liquidity & Order Flow lesson).",
      ],
      workflowSteps: [
        "Open the Market Structure Workbench for a symbol and read the Swing High/Low Explorer first — see the raw, individual swing points the rest of the page builds on.",
        "Check the trend label, then look at the HH/HL/LH/LL Sequence panel to see WHY it reads that way — never trust a flat label without checking its own evidence.",
        "Scan the Structure Shift Timeline for 'Trend Change' events — for each one, apply your own BoS/CHoCH reasoning: did this transition continue a prior directional bias (functionally a BoS-like continuation) or reverse one (functionally CHoCH-like)? The platform gives you the raw event; the classification is your own professional judgment.",
        "Cross-check a Support/Resistance zone's touch count before treating it as meaningful — a zone touched only twice is a much weaker read than one touched five times.",
        "Use the page's own Trade Plan Integration to document your structural read as a real, persisted thesis before acting on it.",
      ],
      metricsExplained: [
        { term: "Swing Window", explanation: "A fixed, non-configurable 5-candle window (2 before, 2 after) — the platform's real swing-detection method, distinct from fractal or volume-weighted swing detection some other tools use." },
        { term: "Trend Change (platform event)", explanation: "The platform's own generic label for any transition between two non-range trend states — deliberately not split into continuation (BoS-like) vs. reversal (CHoCH-like) sub-types." },
        { term: "Zone Strength", explanation: "A literal swing-touch count within a 0.5% price band — a price-pivot-repetition fact, never a volume, order-flow, or liquidity measure." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Reading a genuine HH/HL uptrend correctly",
          steps: [
            "The trend label reads 'uptrend,' and the HH/HL Sequence panel shows 3 consecutive genuinely rising highs and 3 consecutive genuinely rising lows — the label is well-supported by its own evidence.",
            "The Structure Shift Timeline shows a recent 'New Higher Low' event that held above the prior swing low without breaking it — read through a BoS lens, this is a continuation signal, your own interpretation layered on the platform's honest raw event.",
          ],
          note: "This is the platform's data used exactly as designed — a flat label checked against its own supporting evidence, plus the trader's own professional overlay for concepts (BoS) the platform itself doesn't label.",
        },
        {
          label: "Average Opportunity",
          title: "A 'range' label with mixed swings",
          steps: [
            "The trend label reads 'range' because the last 3 highs and lows don't cleanly monotonically rise or fall together — a genuinely mixed sequence.",
            "The Structure Shift Timeline shows a 'Range Entry' event marking when the platform's own classifier flipped from a directional read to range.",
          ],
          note: "A 'range' read is not a weaker or lower-confidence version of a trend — it's the platform's own honest response when the strict rising/falling test genuinely fails, never a forced direction.",
        },
        {
          label: "Poor Opportunity",
          title: "Assuming the platform labels BoS/CHoCH events itself",
          steps: [
            "A user searches the Structure Shift Timeline for an event literally called 'Break of Structure' or 'Change of Character.'",
            "Neither exists — the only related event is the generic 'Trend Change,' and the platform's own test suite explicitly guarantees no ICT/SMC terminology ever appears in any event label.",
          ],
          note: "This is exactly the honest gap this lesson exists to disclose — the concepts are real and worth knowing, but the platform's own labeling stops at 'Trend Change,' and BoS/CHoCH classification is a trader's own overlay, never a platform feature.",
        },
      ],
      commonMistakes: [
        "Searching the Structure Shift Timeline for a literal 'BOS' or 'CHOCH' event — neither exists under any name.",
        "Treating the flat uptrend/downtrend/range label as if it distinguishes a continuation break from a reversal break — it doesn't; both read as the same generic 'Trend Change.'",
        "Confusing a Support/Resistance zone's touch-count 'strength' with a liquidity or order-flow measure — it's purely a price-pivot repetition count.",
        "Ignoring the HH/HL/LH/LL Sequence panel and trusting the single trend-label word alone.",
      ],
      riskWarnings: [
        "A 3-swing lookback window can flip a trend label relatively quickly on a fast-moving or choppy symbol — always check the underlying swing sequence, not just the current word.",
        "None of this is a forecast — every label describes swing structure that has already happened, never a prediction of what comes next.",
      ],
      bestPractices: [
        "Always read the HH/HL/LH/LL Sequence panel alongside the trend label, never the label alone.",
        "Apply your own BoS/CHoCH reasoning consciously and explicitly, since the platform will never do this labeling for you.",
        "Use a zone's touch count, not its mere existence, to judge how seriously to weigh a Support/Resistance level.",
      ],
      relatedModuleHrefs: ["/market-structure-workbench", "/trading-research", "/liquidity-workbench", "/trade-planning-studio", "/learn/paths/trading-engine"],
      aiCoachPrompts: [
        "Explain the difference between this platform's 'Trend Change' event and a Break of Structure.",
        "Why doesn't this platform use ICT/SMC terminology?",
        "What does a support zone's touch count actually tell me?",
        "Walk me through today's HH/HL sequence for this symbol.",
      ],
      relatedGlossaryKeys: ["market-structure", "swing-high-low", "break-of-structure", "change-of-character", "support-resistance-zone"],
      nextStepKeys: ["trading-liquidity"],
      guidedTourRequired: false,
      externalHref: "/market-structure-workbench",
      estimatedMinutes: 10,
      knowledgeCheck: [
        {
          prompt: "What does an uptrend (HH/HL) require, per the platform's own real trend classifier?",
          options: ["Just one higher high", "The last 3 swing highs AND the last 3 swing lows both strictly, monotonically rising", "Any general upward price movement", "A single Trend Change event"],
          correctIndex: 1,
          explanation: "The classifier requires both the last 3 highs and the last 3 lows to be strictly rising — a partial or mixed sequence honestly reads 'range' instead.",
        },
        {
          prompt: "Does the platform compute or label a 'Break of Structure' or 'Change of Character' event anywhere?",
          options: ["Yes, both are shown on the Structure Shift Timeline", "No — its own test suite explicitly guarantees no event label ever matches BOS/CHOCH/MSS; the closest real event is the generic 'Trend Change'", "Only BoS is implemented, not CHoCH", "Only for symbols in the default universe"],
          correctIndex: 1,
          explanation: "Confirmed by direct inspection of the codebase, including a dedicated test asserting this absence — the platform deliberately never uses ICT/SMC terminology in any event label.",
        },
        {
          prompt: "What does a Support/Resistance zone's 'strength' represent?",
          options: ["A liquidity or order-flow measure", "A literal count of how many swing points clustered within 0.5% of that price", "An AI-assigned confidence score", "The zone's distance from current price"],
          correctIndex: 1,
          explanation: "Zone strength is purely a swing-touch-count fact — a price-pivot-repetition measure, never a liquidity or volume-based measure.",
        },
        {
          prompt: "How many candles does the platform's real swing-detection window use?",
          options: ["A user-configurable fractal window", "A fixed 5-candle window (2 before, 2 after the candidate)", "10 candles", "It varies by timeframe"],
          correctIndex: 1,
          explanation: "The window is fixed at 2 candles before and 2 after — a real, non-configurable design choice, not a fractal or adjustable method.",
        },
        {
          prompt: "If you want to classify a 'Trend Change' event as BoS-like (continuation) or CHoCH-like (reversal), who does that classification?",
          options: ["The platform does it automatically and labels the event accordingly", "The trader does it themselves, applying their own professional judgment on top of the platform's honest, generic event", "It's impossible to determine from the platform's data", "The AI Coach automatically re-labels it"],
          correctIndex: 1,
          explanation: "The platform reports only the generic, honest 'Trend Change' label — any BoS-vs-CHoCH interpretation is the trader's own overlay, never computed or asserted by the platform itself.",
        },
      ],
    }),
    topic({
      key: "trading-liquidity",
      title: "Liquidity & Order Flow",
      summary: "Buy-side/sell-side liquidity, sweeps, and stop hunts as professional concepts — and an honest look at what the platform actually detects.",
      body: [
        "In professional/ICT-style trading vocabulary, 'buy-side liquidity' means resting buy orders (and stop-losses on short positions) clustered above a swing high; 'sell-side liquidity' means the mirror below a swing low. A 'liquidity sweep' or 'stop hunt' is when price briefly pushes through one of those levels — triggering the resting orders — before reversing, on the theory that institutions deliberately engineer this to fill large orders.",
        "Honest disclosure, stated plainly and up front: this platform does not detect any of this. A repository-wide search finds zero matches for buy-side liquidity, sell-side liquidity, liquidity sweep, stop hunt, equal highs/lows, or liquidity pool under any name — no code, comment, or UI label anywhere implements this concept. This lesson teaches the real professional vocabulary, but you will not find a 'Sweep Detected' badge anywhere in this platform.",
        "What the platform DOES compute, for real: a Liquidity Engine that buckets real candle volume into 10 price levels (a volume profile), scores an average-dollar-volume-based liquidity band (High/Moderate/Low), and derives a buy/sell pressure proxy directly from each candle's own already-recorded up/down close. These are genuinely useful, real signals — just conceptually different from ICT-style resting-order liquidity.",
        "One further honest distinction worth knowing: the Market Structure Engine's own Support/Resistance zones (covered in the Market Structure Fundamentals lesson) have a 'strength' field that is purely a swing-touch count — it says nothing about volume, resting orders, or liquidity. Calling a zone's touch count a liquidity measure would be a stretch this platform's own code never makes, and this lesson won't make it either.",
      ],
      whyItMatters: "Buy-side/sell-side liquidity and sweeps are real, widely-used professional concepts worth understanding — but conflating them with this platform's own real volume profile/liquidity band/buy-sell pressure signals would lead you to expect a feature (sweep detection) that genuinely isn't there.",
      difficulty: "intermediate",
      whyItExists: "The Liquidity Engine's volume profile, liquidity score, and buy/sell pressure are all real, already-shipped, deterministic computations — this lesson introduces zero new scoring logic, only the honest framing needed to teach ICT-style order-flow concepts without overclaiming what the engine does.",
      institutionalThinking: "A professional distinguishes between 'traded volume by price' (a fact about what already happened, which this platform genuinely computes) and 'resting orders by price' (a theory about what hasn't been filled yet, which no tool can directly observe without real order-book/Level 2 data this platform doesn't have). Conflating the two is a common retail mistake — treating a volume profile bar as if it proves where stop-losses are clustered.",
      screenWalkthrough: [
        "Volume Profile Summary (Liquidity & Session Workbench) — a real, unlabeled list of price levels and their % of total volume, sorted strongest-first, capped at 8 rows. Read this as 'where trading actually happened,' never as 'where resting orders are waiting.'",
        "Liquidity Band Explorer — a High/Moderate/Low classification from average dollar volume against a real $25M-ceiling threshold — describes how much size a market has recently absorbed, not a forecast.",
        "Buy/Sell Pressure — a real proxy: each candle's volume counts toward 'buying' or 'selling' by whether that candle closed up or down (a doji counts toward neither); a 55% threshold decides the overall 'buying'/'selling'/'neutral' read.",
        "Liquidity Timeline / Relative Liquidity — a rolling comparison of current liquidity against a recent average, banded Above/Below/Average within a ±10% tolerance — a real, honest read of whether today's activity is typical for this symbol.",
        "What you will NOT find anywhere on this page: a labeled 'buy-side liquidity' or 'sell-side liquidity' zone, a 'Sweep Detected' badge, or a 'Stop Hunt' alert — none of these exist.",
      ],
      workflowSteps: [
        "Open the Liquidity & Session Workbench for a symbol and check the Liquidity Band first — a 'Low' band is a real signal that size may move price more than usual.",
        "Review the Volume Profile Summary to see which price levels have genuinely traded the most volume recently — useful context, not a resting-order map.",
        "Check Buy/Sell Pressure for a directional read of recent candle closes — remember this is a proxy from closes, not real order-flow/tape data.",
        "If you want to reason about buy-side/sell-side liquidity or a potential sweep, you must do that analysis yourself, visually, using the Market Structure Workbench's own swing highs/lows as your reference points — the platform provides the raw swing data but never performs this specific analysis for you.",
        "Cross-reference a low-liquidity band with a recent Market Structure trend change before weighing either signal heavily on its own.",
      ],
      metricsExplained: [
        { term: "Liquidity Band", explanation: "A High (≥75)/Moderate (≥40)/Low classification of a symbol's average dollar volume against a real $25M ceiling threshold." },
        { term: "Volume Profile", explanation: "A 10-bucket histogram of real candle volume by price level, sorted by volume, capped at the top 8 — a fact about where trading occurred, not a resting-order map." },
        { term: "Buy/Sell Pressure", explanation: "The % of sampled volume from up-closing vs. down-closing candles; a 55% threshold decides the overall direction, doji candles counted toward neither side." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Using the real liquidity signals for what they actually measure",
          steps: [
            "The Liquidity Band reads 'High' and Buy/Sell Pressure reads 'buying' at 68% — a real, well-supported signal that recent activity has genuinely favored buyers on genuine volume.",
            "You note this alongside the Market Structure Engine's own trend read, treating both as descriptive context for a decision you'll still make deliberately.",
          ],
          note: "Both signals are used exactly for what they measure — recent trading activity — never stretched into an order-flow claim the platform doesn't make.",
        },
        {
          label: "Average Opportunity",
          title: "A Low liquidity band on an unfamiliar symbol",
          steps: [
            "The Liquidity Band reads 'Low' — a real signal that this symbol's average dollar volume sits well under the $25M ceiling.",
            "You treat this as a caution about how much size the market can absorb, not as a directional signal of any kind.",
          ],
          note: "'Low' liquidity is not itself bullish or bearish — it's a market-quality fact that affects how reliable other readings are likely to be.",
        },
        {
          label: "Poor Opportunity",
          title: "Assuming a volume-profile bar reveals resting stop-losses",
          steps: [
            "A user sees the largest Volume Profile bar sitting just above a recent swing high and concludes this must be where institutional stop-losses/buy-side liquidity is resting, expecting the platform to have flagged this as a sweep target.",
            "The platform never made this claim — it's a fact about historically traded volume, not a projection about unfilled resting orders, and no sweep/stop-hunt detection exists anywhere to confirm or deny the theory.",
          ],
          note: "This is exactly the honest gap this lesson exists to disclose — the underlying professional concept is real, but attributing it to this specific volume-profile bar would be the user's own unverified inference, not a platform-computed fact.",
        },
      ],
      commonMistakes: [
        "Treating a Volume Profile bar as proof of where resting stop-losses/buy-side or sell-side liquidity sits — it's traded volume, not projected resting orders.",
        "Searching for a 'Sweep Detected' or 'Stop Hunt' alert anywhere in this platform — neither exists under any name.",
        "Confusing a Support/Resistance zone's touch-count 'strength' (from the Market Structure Engine) with a liquidity measure — they're computed by two deliberately independent engines.",
        "Treating Buy/Sell Pressure as real tape/order-flow data rather than what it actually is — a proxy derived purely from candle open/close direction.",
      ],
      riskWarnings: [
        "None of the Liquidity Engine's outputs are directional forecasts — they describe recent trading activity, never a prediction of future price movement.",
        "Real Level 2/order-book data, which would be needed to genuinely confirm buy-side/sell-side liquidity or a sweep, is explicitly deferred in this platform pending a live tick-data vendor relationship — do not assume it exists.",
      ],
      bestPractices: [
        "Use the Liquidity Band to judge how much size a market can absorb, never as a standalone trade trigger.",
        "Perform any buy-side/sell-side liquidity or sweep analysis yourself, visually, using real swing-high/low data from the Market Structure Workbench — never assume the platform has already done it.",
        "Cross-reference Buy/Sell Pressure with the Market Structure trend read rather than trusting either signal alone.",
      ],
      relatedModuleHrefs: ["/liquidity-workbench", "/market-structure-workbench", "/trading-research", "/learn/paths/trading-engine"],
      aiCoachPrompts: [
        "Explain the difference between this platform's Volume Profile and 'buy-side liquidity.'",
        "Does this platform detect liquidity sweeps or stop hunts?",
        "What does a Liquidity Band of 'Low' actually tell me?",
        "How is Buy/Sell Pressure actually calculated?",
      ],
      relatedGlossaryKeys: ["liquidity-band", "volume-profile", "buy-sell-pressure", "support-resistance-zone"],
      nextStepKeys: ["volume-profile-vwap"],
      guidedTourRequired: false,
      externalHref: "/liquidity-workbench",
      estimatedMinutes: 10,
      knowledgeCheck: [
        {
          prompt: "Does this platform detect liquidity sweeps or stop hunts?",
          options: ["Yes, shown as a badge on the Liquidity Workbench", "No — a repository-wide search finds zero matches for these concepts under any name; no such detection exists anywhere", "Only for symbols with High liquidity", "Yes, but only in the Market Structure Engine"],
          correctIndex: 1,
          explanation: "Confirmed by direct code inspection — buy-side/sell-side liquidity, sweeps, stop hunts, and liquidity pools do not exist anywhere in this codebase under any name.",
        },
        {
          prompt: "What does the platform's real Volume Profile actually measure?",
          options: ["Projected resting stop-loss orders", "Real, already-traded volume bucketed by price level — a historical fact, never a resting-order map", "Live order-book depth", "Future price targets"],
          correctIndex: 1,
          explanation: "The Volume Profile is a 10-bucket histogram of real candle volume by price — descriptive of what already traded, not a projection of unfilled orders.",
        },
        {
          prompt: "Is a Support/Resistance zone's touch-count 'strength' a liquidity measure?",
          options: ["Yes, it's the same thing as buy-side/sell-side liquidity", "No — it's purely a swing-touch-repetition count from the deliberately independent Market Structure Engine, never a volume or order-flow measure", "Yes, but only for resistance zones", "It's a blended liquidity-and-structure score"],
          correctIndex: 1,
          explanation: "Zone strength and the Liquidity Engine are two genuinely separate, non-integrated systems — conflating them would be a fabrication this platform's own code never makes.",
        },
        {
          prompt: "How is Buy/Sell Pressure actually derived?",
          options: ["From real Level 2 order-book data", "From each candle's own up/down close — a proxy, with a 55% threshold deciding the overall direction and dojis counted toward neither side", "From an AI sentiment model", "From resting stop-loss order estimates"],
          correctIndex: 1,
          explanation: "It's a real but simple proxy computed purely from candle close direction, never from actual order-flow or tape data, which this platform doesn't have.",
        },
        {
          prompt: "If you want to identify a potential liquidity sweep using this platform, what must you do?",
          options: ["Look for the platform's 'Sweep Detected' badge", "Perform the analysis yourself, visually, using the real swing-high/low data from the Market Structure Workbench — the platform provides the raw data but never performs this analysis", "Ask the AI Coach, which will detect it automatically", "This cannot be done with any data this platform provides"],
          correctIndex: 1,
          explanation: "The platform's real swing data (from the Market Structure Engine) is a genuine input a trader could use for this kind of analysis themselves — but no sweep-detection feature exists to do it for you.",
        },
      ],
    }),
    topic({
      key: "volume-profile-vwap",
      title: "Volume Profile & VWAP: POC, Value Area, and an Honest Gap",
      summary: "Real professional concepts — and a direct, upfront disclosure of what this platform does not implement.",
      body: [
        "Point of Control (POC) is the single price level that traded the most volume in a session or sample window. Value Area High/Low (VAH/VAL) bound the price range — typically containing roughly 70% of volume around the POC — where most trading activity concentrated. VWAP (Volume Weighted Average Price) is the average price a symbol traded at over a period, weighted by volume at each price; a Session VWAP resets that calculation at the start of each trading session. All four are real, standard, widely-used professional volume-profile/VWAP concepts.",
        "Honest disclosure, stated plainly and upfront, since this is the most important fact in this lesson: this platform computes NONE of these. A repository-wide search finds zero matches for VWAP, session VWAP, Point of Control, or Value Area anywhere in the codebase, front or back end, in any form — simulated or real. This is not a minor gap; it means none of the professional interpretation techniques this module covers can be directly demonstrated inside this platform's own UI.",
        "What DOES exist, and is the closest honest analog: the Liquidity Engine's own Volume Profile — a 10-bucket histogram of real candle volume by price, sorted strongest-first, showing the top 8 buckets. The single highest-volume bucket in that list is, mathematically, the same thing a Point of Control represents — but the platform's own code never labels it that way, never special-cases it, and never computes a Value Area band around it. Any 'this bar is like a POC' reading is the student's own interpretation, layered on top of an honestly unlabeled list.",
      ],
      whyItMatters: "Knowing precisely which of these concepts this platform implements (none, directly) versus which real data can be honestly read through that lens (the Volume Profile's top bar) is exactly the kind of distinction the Trading Academy's own quality standard requires — teaching the real theory without ever implying a feature exists that doesn't.",
      difficulty: "intermediate",
      whyItExists: "POC/VAH/VAL/VWAP are foundational professional concepts a Trading Academy cannot skip, even though this specific platform doesn't implement them — this lesson exists to teach them honestly, clearly separating theory from platform capability rather than silently omitting the module or fabricating features to cover the gap.",
      institutionalThinking: "A professional never assumes a platform computes every standard indicator just because the underlying raw data (volume, price) is present — POC/VAH/VAL/VWAP all require specific additional computation this platform's own code simply doesn't do. Recognizing a real gap like this, and knowing exactly how far you can honestly stretch the data that IS available, is itself a professional skill.",
      screenWalkthrough: [
        "Volume Profile Summary (Liquidity & Session Workbench, and also surfaced inside Trading Research) — the platform's only real, shipped artifact in this space: a raw list of {price, % of total volume} rows, already sorted strongest-first, capped at 8 rows. No row is labeled POC. No Value Area band, upper or lower bound, is shown or computable from this list alone (the underlying bucket data isn't retained at enough resolution to derive one).",
        "What you will NOT find anywhere on this page or any other page in this platform: a VWAP line on any chart, a Session VWAP reset marker, a POC label, or a VAH/VAL band — none of these exist.",
      ],
      workflowSteps: [
        "Open the Volume Profile Summary and identify the #1 row (the highest % of total volume) — this is the closest honest analog to a Point of Control this platform offers, understanding it is your own reading, not a platform-computed label.",
        "Do not expect to find a Value Area band — this platform has no code path that computes one; if you need this analysis, it must be done entirely outside this platform.",
        "Do not expect to find VWAP or Session VWAP anywhere — treat this as pure theory to carry into other tools, not something to look for here.",
        "When discussing 'the POC' or 'VWAP' for a symbol with the AI Coach, remember it can only narrate this platform's own real, computed data — it will never fabricate a POC/VAH/VAL/VWAP value that doesn't exist in the underlying data.",
      ],
      metricsExplained: [
        { term: "Volume Profile's #1 bucket", explanation: "The single highest-volume price bucket in the platform's real, unlabeled 10-bucket histogram — mathematically equivalent to a Point of Control, but never labeled or special-cased as one anywhere in the code." },
        { term: "Value Area (theory only)", explanation: "A ~70%-of-volume band around a POC — a real professional concept this platform's code does not compute in any form; there is no VAH/VAL field on any object the platform returns." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Honestly using the Volume Profile's top bar as a POC-like reference",
          steps: [
            "You open the Volume Profile Summary and note the #1 row by volume percentage.",
            "You treat this as a reasonable, self-derived point of reference — 'the price level with the most recent trading activity in this sample' — explicitly not claiming the platform computed a Point of Control.",
          ],
          note: "This is the honest way to bridge real professional theory to this platform's own real, if more basic, data.",
        },
        {
          label: "Average Opportunity",
          title: "Learning VWAP theory to apply elsewhere",
          steps: [
            "You study how VWAP is calculated and why institutional traders reference it as a fair-value benchmark during a session.",
            "You explicitly plan to check VWAP using a different tool, since you've confirmed this platform doesn't compute it.",
          ],
          note: "There's real value in learning the concept even when the specific platform you're using doesn't implement it — professional knowledge outlasts any one tool's feature set.",
        },
        {
          label: "Poor Opportunity",
          title: "Assuming a VWAP or Value Area must be hiding somewhere in the UI",
          steps: [
            "A user searches every tab of the Liquidity Workbench, Trading Research, and Market Structure Workbench looking for a VWAP line or a VAH/VAL band.",
            "None exists anywhere — confirmed by an exhaustive, repository-wide search covering every frontend and backend file.",
          ],
          note: "This is exactly the honest gap this lesson exists to disclose clearly and upfront, rather than let a user search indefinitely for a feature that was never built.",
        },
      ],
      commonMistakes: [
        "Assuming the Volume Profile's top bar is a platform-computed, labeled Point of Control — it isn't labeled as one anywhere in the code.",
        "Searching for a Value Area (VAH/VAL) band anywhere in this platform — no code computes one.",
        "Searching for a VWAP or Session VWAP line on any chart — neither exists.",
        "Assuming the AI Coach can compute a POC/VAH/VAL/VWAP value on request — it can only narrate real, already-computed platform data, and will not fabricate one.",
      ],
      riskWarnings: [
        "Do not rely on this platform for POC/VAH/VAL/VWAP-based trading decisions — none of these values are computed here, so any number you might expect to see simply does not exist in this UI.",
        "The Volume Profile's own top bucket is a genuinely useful, real signal on its own terms — but it is a coarser 10-bucket histogram, not a true tick-level Point of Control calculation.",
      ],
      bestPractices: [
        "Learn POC/VAH/VAL/VWAP theory here, but source the actual values from a different tool if your trading process genuinely needs them.",
        "Use this platform's own Volume Profile top bucket only as a rough, self-derived reference point, always naming it that way rather than calling it 'the POC.'",
        "Ask the AI Coach to explain concepts, but never expect it to compute a figure this platform's own engines don't produce.",
      ],
      relatedModuleHrefs: ["/liquidity-workbench", "/trading-research", "/market-structure-workbench", "/learn/paths/trading-engine"],
      aiCoachPrompts: [
        "Does this platform compute VWAP?",
        "What's the closest thing this platform has to a Point of Control?",
        "Explain Value Area High and Value Area Low as a concept.",
        "Why doesn't this platform show a VWAP line on its charts?",
      ],
      relatedGlossaryKeys: ["volume-profile", "point-of-control", "value-area", "vwap"],
      nextStepKeys: [],
      guidedTourRequired: false,
      externalHref: "/liquidity-workbench",
      estimatedMinutes: 9,
      knowledgeCheck: [
        {
          prompt: "Does this platform compute VWAP or Session VWAP anywhere?",
          options: ["Yes, shown on every price chart", "No — a repository-wide search finds zero matches for VWAP in any form, anywhere in the codebase", "Only for the default 10-symbol universe", "Only Session VWAP, not standard VWAP"],
          correctIndex: 1,
          explanation: "Confirmed by an exhaustive, repository-wide search — VWAP does not exist anywhere in this codebase, front or back end, in any form.",
        },
        {
          prompt: "Does this platform compute or label a Point of Control (POC)?",
          options: ["Yes, the top row of the Volume Profile is explicitly labeled POC", "No — the Volume Profile's top row is mathematically equivalent to a POC but is never labeled, special-cased, or computed as one anywhere in the code", "Yes, but only on the Market Structure Workbench", "Yes, as part of the Liquidity Band score"],
          correctIndex: 1,
          explanation: "The platform's real Volume Profile is an honestly unlabeled, volume-sorted list — its top entry happens to be the highest-volume bucket, but no code anywhere calls it a Point of Control.",
        },
        {
          prompt: "Does this platform compute a Value Area (VAH/VAL)?",
          options: ["Yes, as a band around the POC", "No — no code anywhere derives a ~70%-of-volume band or any VAH/VAL field", "Only for High-liquidity symbols", "Yes, but only shown in the AI Coach's narration"],
          correctIndex: 1,
          explanation: "Confirmed by direct code inspection — there is no Value Area computation anywhere in this codebase.",
        },
        {
          prompt: "If you ask the AI Coach for this symbol's VWAP, what should you honestly expect?",
          options: ["A fabricated but plausible-looking VWAP number", "An honest statement that this platform doesn't compute VWAP, since the Coach only narrates real, already-computed platform data", "A redirect to a live broker feed", "The Volume Profile's #1 bucket, silently relabeled as VWAP"],
          correctIndex: 1,
          explanation: "The AI Coach across this entire platform is built to narrate real, already-computed data only — it will not invent a VWAP figure that doesn't exist in the underlying engines.",
        },
        {
          prompt: "What is the honest, correct way to use the Volume Profile's top bucket in place of a true POC?",
          options: ["Call it 'the platform's POC' since it's functionally the same thing", "Treat it as your own self-derived reference point — the price with the most recent traded volume in the sample — explicitly not a platform-labeled POC", "Ignore the Volume Profile entirely since it isn't a real POC", "Ask the platform to convert it into a POC automatically"],
          correctIndex: 1,
          explanation: "The honest framing is to use the real data (highest-volume bucket) for what it is, while being explicit that the platform itself never makes the POC claim — that interpretation is the trader's own.",
        },
      ],
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
      title: "Risk Management: Position Sizing, R:R, and Portfolio Exposure",
      summary: "How the platform actually calculates and visualises risk — real formulas, real caps, no invented guidance.",
      body: [
        "Professional risk management rests on a few disciplines: size each position so no single loss can do outsized damage (position sizing / risk per trade), know your reward relative to your risk before entering (risk/reward ratio), place a stop-loss at a deliberate level, and track how much total risk sits across your whole portfolio at once (portfolio exposure). This platform's Risk Management Engine implements the first, third, and fourth of these as real, deterministic computations, and the second as a real, honest formula reused wherever risk/reward is shown.",
        "Position sizing dollar risk is computed as `|entryPrice − stopPrice| × quantity` — pure arithmetic over numbers you enter, real named caps of 2% of account value per position and 6% aggregate across the whole portfolio, and a genuine hard-cap override: if either cap is breached, the overall risk score is forced down to at most 60 (below the platform's own 'Strong' grade band), regardless of how good the blended weighted score would otherwise read.",
        "Risk/reward ratio is `rewardDistance ÷ stopDistance` (target-to-entry distance divided by entry-to-stop distance) — the exact same formula powers the Trade Planning Studio's Scenario Comparison feature, whose 'Best R:R' badge is an honest max() over already-computed ratios across your own entered scenarios, never a recommendation on which one to take.",
        "Honest disclosure: stop-loss and target prices are purely user-entered numbers on a Trading Position — the platform computes dollar risk and R:R FROM whatever you enter, but never suggests or validates WHERE a stop should be placed (e.g. relative to a Support/Resistance zone from the Market Structure Engine). Professional practice often places a stop just beyond a structural level — but that placement decision is entirely yours to make; the platform will not flag a poorly-placed stop as a mistake.",
      ],
      whyItMatters: "A hard-cap override means a single mis-sized position or an over-committed portfolio can never be silently masked by an otherwise-good-looking blended score — the real design choice behind this engine is that risk discipline should never be gameable by other, unrelated strengths.",
      difficulty: "intermediate",
      whyItExists: "Every figure in this lesson is already computed by the shipped Risk Management Engine — this lesson introduces zero new formulas, only the professional framing (risk per trade, R:R, stop placement, portfolio exposure) that connects the real, already-built computation to standard trading discipline.",
      institutionalThinking: "A professional treats the portfolio-wide risk budget, not any single trade's own attractiveness, as the binding constraint — the hard-cap override literally enforces this by refusing to let a strong Stop/Target Discipline score offset a breached dollar-risk cap. A common retail mistake is sizing each trade in isolation without ever checking the aggregate; the Portfolio Risk Budget component exists specifically to catch that.",
      screenWalkthrough: [
        "Portfolio Risk card (Trading Research page) — an account-value input, a form to add a Trading Position (symbol, side, quantity, entry, stop, target), and a live list of current positions with their entry/stop/target inline.",
        "Overall badge — the blended risk grade (Excellent/Strong/Moderate/Elevated/Poor, from a named weighted blend of the 3 components below), with the hard-cap override capping it at 'Elevated' or below whenever either dollar-risk cap is actually breached.",
        "Position Sizing detail line — the largest single position's own dollar risk and %, checked against the real 2%-of-account-value cap, verbatim from the engine's own generated sentence.",
        "Stop/Target Discipline detail line — literally 'N of M open positions have both a stop and a target defined' — a plain fraction, no partial credit for defining only one of the two.",
        "Portfolio Risk Budget detail line — aggregate open-position dollar risk as a % of account value, checked against the real 6% cap.",
        "Per-Position Touch Probability section — for each position with a stop/target, a real touch-probability read (SIMULATED regime context) showing how likely price is to reach that stop or target, reusing the platform's own Probability Engine.",
      ],
      workflowSteps: [
        "Set your real account value first — every dollar-risk % figure is computed against this number.",
        "Add each open position with its real entry, stop, and target — the Stop/Target Discipline score only credits a position that has both.",
        "Check the Position Sizing detail line against the 2% cap before adding a new, larger position.",
        "Check the Portfolio Risk Budget detail line against the 6% cap before adding a new position at all — this is the portfolio-wide check that individual position sizing alone can't catch.",
        "If the Overall badge shows a capped, sub-Strong grade despite good individual components, that's the hard-cap override doing its job — trim the offending position or reduce size rather than treating the badge as a bug.",
        "Use the Trade Planning Studio's Scenario Comparison to compare 2-5 candidate entry/stop/target combinations and see their real R:R side by side before committing to one as a persisted Trade Plan.",
      ],
      metricsExplained: [
        { term: "Position Sizing Risk", explanation: "|entryPrice − stopPrice| × quantity, expressed as a % of account value, checked against a real, named 2% single-position cap." },
        { term: "Stop/Target Discipline", explanation: "The fraction of open positions with BOTH a stop and a target defined — a plain arithmetic ratio, no partial credit." },
        { term: "Portfolio Risk Budget", explanation: "Aggregate open-position dollar risk as a % of account value, checked against a real, named 6% portfolio-wide cap, with a hard-cap override forcing the overall score to at most 60 if breached." },
        { term: "Risk/Reward Ratio", explanation: "rewardDistance ÷ stopDistance (target-to-entry distance over entry-to-stop distance) — a fact about the numbers you entered, never a judgment on whether those specific levels are well chosen." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Well-sized positions with full stop/target discipline",
          steps: [
            "Every open position has both a stop and target defined — Stop/Target Discipline reads 100%.",
            "The largest single position risks 1.4% of account value (under the 2% cap), and aggregate portfolio risk sits at 4.2% (under the 6% cap) — Overall reads 'Strong' or better, with no hard-cap override triggered.",
          ],
          note: "This is the Risk Management Engine working exactly as designed — real discipline, real numbers, a genuinely earned grade.",
        },
        {
          label: "Average Opportunity",
          title: "Good sizing, incomplete stop/target discipline",
          steps: [
            "Individual position sizing and portfolio budget are both comfortably within caps.",
            "Only 2 of 5 open positions have both a stop and target defined — Stop/Target Discipline reads 40%, dragging down the blended Overall score even though the dollar-risk figures look fine.",
          ],
          note: "A good dollar-risk profile doesn't guarantee a good Overall grade — undocumented stops/targets are a real, separately-scored gap.",
        },
        {
          label: "Poor Opportunity",
          title: "A breached portfolio cap forcing the hard-cap override",
          steps: [
            "Four positions each individually sit under the 2% single-position cap.",
            "Their combined aggregate risk is 7.6% of account value — above the 6% portfolio cap — so `capBreached` is true and the Overall score is forced to at most 60, regardless of how the other components blend.",
          ],
          note: "This is the exact scenario the hard-cap override exists to catch: no single position looks alarming on its own, but the portfolio as a whole is over-committed.",
        },
      ],
      commonMistakes: [
        "Sizing each new position only against its own 2% cap without checking the aggregate Portfolio Risk Budget — four 'safe' positions can still breach the 6% portfolio cap together.",
        "Leaving a position's stop or target blank and assuming it doesn't affect your score — Stop/Target Discipline is a real, separately-weighted component.",
        "Expecting the platform to suggest or validate where a stop should be placed — it never does; stop placement is purely a manual, user-entered decision.",
        "Treating the Trade Planning Studio's 'Best R:R' badge as a recommendation — it's an honest max() identification only, never advice on which scenario to actually take.",
      ],
      riskWarnings: [
        "The hard-cap override is deliberately unforgiving — a single breached cap forces the Overall score down regardless of how strong the other components are; this is by design, not a scoring bug.",
        "Position size and R:R are pure arithmetic over your own entered numbers — the platform never judges whether your specific entry/stop/target levels are well chosen, only whether the resulting dollar risk fits within named caps.",
      ],
      bestPractices: [
        "Check the Portfolio Risk Budget, not just individual Position Sizing, before adding any new position.",
        "Always define both a stop and a target for every open position, even if only for the Stop/Target Discipline score's own sake.",
        "Use Scenario Comparison's honest max/min identifications as one input among several, never as the sole basis for choosing a trade.",
      ],
      relatedModuleHrefs: ["/trading-research", "/trade-planning-studio", "/trading-journal", "/market-structure-workbench", "/learn/paths/trading-engine"],
      aiCoachPrompts: [
        "Explain why my Overall risk score is capped despite good individual components.",
        "What's the difference between Position Sizing risk and Portfolio Risk Budget?",
        "How is risk/reward ratio actually calculated here?",
        "Does the platform tell me where to place my stop-loss?",
      ],
      relatedGlossaryKeys: ["trading-position-sizing", "risk-reward-ratio", "trading-capital-allocation", "portfolio-risk-budget"],
      nextStepKeys: ["trading-trade-planning"],
      guidedTourRequired: false,
      externalHref: "/trading-research",
      estimatedMinutes: 10,
      knowledgeCheck: [
        {
          prompt: "How is Position Sizing dollar risk actually computed?",
          options: ["A fixed percentage regardless of stop distance", "|entryPrice − stopPrice| × quantity", "The position's full notional value", "An AI-estimated risk score"],
          correctIndex: 1,
          explanation: "It's pure arithmetic — the absolute price distance between entry and stop, multiplied by quantity — never an estimate or a judgment.",
        },
        {
          prompt: "What happens to the Overall risk score if either the 2% single-position cap or the 6% portfolio cap is breached?",
          options: ["Nothing — it's just informational", "The Overall score is forced down to at most 60, regardless of how strong the other components blend", "Only a warning icon appears, with no score impact", "The breached position is automatically closed"],
          correctIndex: 1,
          explanation: "This is the real hard-cap override — a breached cap forces the score down, so a genuinely risky portfolio can never be masked by an otherwise-good blended score.",
        },
        {
          prompt: "Does the platform suggest or validate where a stop-loss should be placed?",
          options: ["Yes, relative to Support/Resistance zones automatically", "No — stop price is purely a user-entered number; the platform computes dollar risk and R:R from it but never suggests or validates its placement", "Only when Market Structure data is available", "Yes, via the AI Coach's own recommendation"],
          correctIndex: 1,
          explanation: "Stop placement is entirely a manual decision — the platform derives real figures from whatever you enter, but never tells you where to place it.",
        },
        {
          prompt: "What does Stop/Target Discipline actually measure?",
          options: ["The average distance between stop and target across all positions", "The fraction of open positions that have BOTH a stop AND a target defined — no partial credit for only one", "Whether stops are placed at 'good' levels", "How often stops have been hit historically"],
          correctIndex: 1,
          explanation: "It's a plain completeness fraction — positions with both fields defined divided by total open positions — never a judgment on placement quality.",
        },
        {
          prompt: "What does the Trade Planning Studio's 'Best R:R' badge actually represent?",
          options: ["A recommendation on which scenario to take", "An honest max() identification over already-computed risk/reward ratios across your own entered scenarios", "The platform's own preferred trade setup", "A guarantee of that scenario's outcome"],
          correctIndex: 1,
          explanation: "It's explicitly documented as an honest max/min identification only — never a recommendation, never a judgment on which specific scenario is actually correct to take.",
        },
      ],
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
      nextStepKeys: ["options-chain-contract-selection"],
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
    topic({
      key: "options-chain-contract-selection",
      title: "Options Chain and Contract Selection",
      summary: "Navigating the real Option Chain page, reading every column, and choosing a contract before it ever reaches the Trade Ticket — with honest examples of what a good, average, and rejected candidate look like.",
      body: [
        "The Option Chain page (`/options/:symbol`) is this platform's real, working contract-browsing screen — calls on the left, strikes down the center, puts on the right, each showing Delta, Theta, IV, Bid, Mid, and Ask. Honest disclosure: it currently shows exactly one expiration (fixed 45 days out) and does not let you switch expirations, even though the platform's own data model supports multiple expiration cycles elsewhere. Volume and open interest are not shown as columns on this page either, even though the platform's own API returns them.",
        "Selecting a strike means comparing Delta (rough probability of finishing in-the-money), Theta (daily decay), IV (how 'expensive' that specific contract is), and Bid/Mid/Ask (liquidity and your real entry/exit cost) side by side for nearby strikes — the page's own strike range spans roughly ten strikes above and below the current price, at the symbol's own natural strike spacing.",
        "Comparing contracts across strikes is a real, side-by-side reading exercise on this one page — comparing across MULTIPLE expirations is not currently possible here, since only one expiration is shown at a time.",
        "Evaluating liquidity starts with what you can see (the bid/ask spread on this page) but doesn't end there — this platform runs a real, server-side liquidity gate (a minimum open-interest threshold and a maximum spread percentage) before any contract can reach a Scanner result or Trade Ticket. A contract that fails either check simply never appears; you won't see a labeled 'liquidity rejected' message anywhere on the chain or scanner screens themselves.",
        "Reviewing the complete trade before execution happens on the Trade Ticket page, not the chain page — every leg shows a colored buy/sell badge, the real OCC contract symbol, the per-share price, and a full Pre-Trade Risk Validation card checking the position's own risk math before you can submit.",
      ],
      whyItMatters: "Choosing a contract well means reading the same real signals a professional would — Delta, Theta, IV, spread — while also understanding exactly where this platform's own chain-browsing UI stops (one expiration, no volume/OI columns, no visible rejection reasons) so you don't assume a capability that isn't there.",
      difficulty: "intermediate",
      whyItExists: "Every prior Options Academy module (Fundamentals, Greeks, Pricing/Volatility) taught the vocabulary needed to read a chain — this lesson is the first to walk through the actual chain-browsing screen itself, connecting that vocabulary to the real page, its real columns, and its real, disclosed limitations.",
      institutionalThinking: "A professional never assumes a chain page shows everything relevant just because it looks complete — checking what's genuinely absent (multiple expirations, volume/OI columns, visible rejection reasons) is as important as reading what's present.",
      screenWalkthrough: [
        "Symbol picker (top of the Option Chain page) — a searchable combobox to switch the underlying.",
        "Header strip — the underlying's own last price and IV Rank, both real figures for the currently-selected symbol.",
        "The chain table itself — calls (left) / strike (center) / puts (right), each side showing Delta, Theta, IV, Bid, Mid, Ask. In-the-money cells carry a background tint; no expiration selector is present.",
        "Trade Ticket page (reached by opening a specific contract) — the 8-tile metric grid, per-leg buy/sell badges and OCC symbols, and the Pre-Trade Risk Validation card.",
      ],
      workflowSteps: [
        "Pick a symbol on the Option Chain page and read the header's underlying price and IV Rank first — your fastest gut-check on whether options are relatively rich or cheap right now.",
        "Scan a handful of nearby strikes on the side (call or put) you're considering, comparing Delta and IV together — similar Delta but meaningfully different IV across strikes is worth noticing.",
        "Check Bid/Mid/Ask for your leading candidate — a wide spread relative to mid is a warning sign before you ever reach a formal liquidity check.",
        "Open the candidate on the Trade Ticket page and read every leg's side badge, OCC symbol, and price, then review the full Pre-Trade Risk Validation card before considering submission.",
        "If a contract or strategy you expected to see never appears anywhere (Scanner or chain), remember this platform silently filters failed liquidity/EV candidates rather than showing you a rejection reason directly.",
      ],
      metricsExplained: [
        { term: "Strike Range", explanation: "The Option Chain page shows roughly ten strikes above and below the current underlying price, at that symbol's own natural strike spacing." },
        { term: "Fixed Expiration", explanation: "The chain is currently hardcoded to one 45-day expiration cycle — there is no expiration picker on this page today." },
        { term: "Pre-Trade Risk Validation", explanation: "The Trade Ticket's own pass/fail checklist card, run on the specific contract(s) you've selected, before you can submit an order." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "Directional calls, chosen deliberately with the chain's real signals — including a deep-ITM, stock-replacement choice",
          steps: [
            "On the call side of the chain, a moderate-delta strike shows a tight bid/ask spread relative to its mid and a reasonable IV compared to nearby strikes — opening it on the Trade Ticket confirms a clean 'BUY' badge, a sensible per-share price, and a Pre-Trade Risk Validation that passes without warnings.",
            "A deep-ITM call cell (heavily tinted) carries mostly intrinsic value and a delta close to 1 — behaving much like owning the stock itself, a deliberate choice for a stock-replacement-style directional view, not something to avoid just because the cell is tinted. Its Trade Ticket shows a much higher per-share price (reflecting the large intrinsic value) and a correspondingly larger buying-power commitment.",
          ],
          note: "This platform's own trade flow supports opening a deep-ITM contract identically to any other — the chain and ticket simply show you the real, larger numbers involved, never a restriction.",
        },
        {
          label: "Average Opportunity",
          title: "A directional put with an acceptable but wider spread",
          steps: [
            "A put strike has the directional delta you want, but its bid/ask spread on the chain is noticeably wider than neighboring strikes.",
            "It may still pass the platform's own formal liquidity gate and reach the Trade Ticket, but the wider observed spread is worth weighing against a tighter alternative nearby.",
          ],
        },
        {
          label: "Poor Opportunity",
          title: "A contract rejected because of poor liquidity",
          steps: [
            "A candidate strike that looked reasonable by delta never appears when the Scanner runs a structured scan around it — filtered by the platform's own minimum open-interest or maximum-spread liquidity gate.",
            "The only visible platform trace is an incremented 'Rejected (Liquidity)' count on the Dashboard — there is no per-contract explanation shown anywhere in the UI.",
          ],
          note: "This is a genuine, disclosed platform limitation: liquidity is enforced, but not currently explained per-contract.",
        },
      ],
      commonMistakes: [
        "Looking for an expiration selector on the Option Chain page — it doesn't exist; the chain shows one fixed 45-day expiration only.",
        "Expecting to see volume or open interest as columns on the chain — they aren't rendered there, even though the platform's own data includes them.",
        "Assuming a missing candidate was overlooked rather than silently filtered by the liquidity or EV gate.",
        "Treating every ITM-tinted cell as automatically undesirable, rather than checking whether deep-ITM exposure is the deliberate point of the trade.",
      ],
      riskWarnings: [
        "This is educational content, not financial advice, and does not recommend any specific contract or trade.",
        "All chain, scanner, and trade-ticket pricing on this platform is modeled or simulated, not a live, guaranteed broker quote — it can move before any real order is placed.",
        "Options can result in rapid and substantial losses; a deep-ITM long option's larger price also means a larger dollar amount genuinely at risk.",
      ],
      bestPractices: [
        "Compare a handful of nearby strikes side by side before settling on one, rather than opening the first plausible candidate.",
        "Treat the Trade Ticket, not the chain row, as your final source of truth for exactly what you're about to trade.",
        "Remember the chain's single fixed expiration is a real, disclosed limitation, not a hidden setting to search for.",
      ],
      relatedModuleHrefs: ["/options/SPY", "/scanner", "/trade-execution-center"],
      aiCoachPrompts: [
        "Compare these two strikes for me — which has better liquidity?",
        "Why does this deep-ITM call cost so much more than the OTM strike nearby?",
        "Can I see a different expiration on this chain?",
        "Why might this contract not have shown up on my scan?",
      ],
      nextStepKeys: ["options-risk-management"],
      knowledgeCheck: [
        {
          prompt: "How many expirations can you currently browse on the Option Chain page?",
          options: ["Any expiration, via a picker", "Exactly one, hardcoded to 45 days out", "Weekly expirations only", "It depends on the symbol"],
          correctIndex: 1,
          explanation: "Confirmed by direct inspection: the chain page shows a single, fixed 45-DTE expiration; no expiration selector is wired up in the UI, despite an unused expirations endpoint existing.",
        },
        {
          prompt: "Which columns are NOT shown on the Option Chain page, despite the underlying API returning them?",
          options: ["Delta and Theta", "Bid and Ask", "Volume and Open Interest", "Strike price"],
          correctIndex: 2,
          explanation: "The chain shows Delta/Theta/IV/Bid/Mid/Ask, but volume and open interest are absent from the rendered table even though the API response includes them.",
        },
        {
          prompt: "What happens on screen when a contract fails the platform's own liquidity gate?",
          options: ["A red 'Illiquid' badge appears on that row", "It's silently filtered out — only an aggregate rejection count appears elsewhere, on the Dashboard", "The contract is shown greyed out but still selectable", "The whole chain page shows an error"],
          correctIndex: 1,
          explanation: "There is no per-contract liquidity-rejection UI anywhere — rejected contracts simply never appear in scan results or on the chain; only an aggregate Dashboard count reflects them.",
        },
        {
          prompt: "Is opening a deep in-the-money option a mistake on this platform?",
          options: ["Yes, ITM-tinted cells should always be avoided", "No — it's a legitimate, deliberate choice (e.g. stock-replacement) supported by the same real trade flow as any other contract", "Only puts can be opened ITM, never calls", "The platform blocks ITM contracts entirely"],
          correctIndex: 1,
          explanation: "A deep-ITM option is a real, valid strategy choice with a much higher price and delta near 1 — the platform's own trade flow handles it identically to any other contract; the ITM tint is informational, not a restriction.",
        },
        {
          prompt: "Where do you go to review the complete trade — every leg's side, OCC symbol, and risk validation — before considering submission?",
          options: ["The Option Chain page itself", "The Dashboard's rejection tiles", "The Trade Ticket page", "The Scanner's results table"],
          correctIndex: 2,
          explanation: "The Trade Ticket page is the platform's real, complete pre-trade review screen — the chain page and Scanner only get you to a candidate, not a full review.",
        },
      ],
      relatedGlossaryKeys: ["option-chain", "bid-ask-spread", "open-interest", "delta", "in-the-money"],
      estimatedMinutes: 12,
    }),
    topic({
      key: "options-risk-management",
      title: "Options Risk Management",
      summary: "Defined vs. undefined risk, buying power, expiration/assignment/liquidity/volatility/gap risk, and a real pre-trade checklist built entirely from this platform's own existing checks.",
      body: [
        "Defined-risk vs. undefined-risk is a structural property, not a preference: a defined-risk position has a maximum possible loss that's fixed and known at entry (a credit spread's width minus credit received); an undefined-risk ('naked') position — a short call or put with no offsetting long option — has a theoretically unlimited loss (naked call) or very large loss (naked put). This platform's own execution engine structurally blocks every naked position before it can ever be opened — the concept matters for understanding options generally, but this platform's own trade flow will never let you enter one.",
        "Position-level maximum loss and buying power are directly connected: selling a defined-risk spread ties up buying power exactly equal to that spread's own maximum loss, computed and enforced in real time — not an estimate you have to track yourself.",
        "Portfolio-wide risk (concentration, diversification, correlation) is covered in depth by the existing Portfolio path's own lessons — this lesson deliberately doesn't re-teach that ground, only connects it: a single well-sized, defined-risk position can still contribute to an unhealthy concentrated portfolio if too many similar positions stack up.",
        "Expiration risk and assignment risk are real, computed concerns: this platform derives a rule-based assignment-risk LEVEL from days-to-expiration and how far in-the-money a short strike has moved — never a prediction of whether assignment will actually happen (that decision belongs to the option's buyer), only a structural warning.",
        "Liquidity risk is enforced but not always visible: a contract failing the platform's own minimum open-interest or maximum-spread checks is filtered out silently before you'd ever see it, so 'nothing showed up' can itself be a liquidity signal.",
        "Volatility risk (vega risk) and gap risk are both modeled, disclosed features, not live feeds: the Portfolio Stress Test reprices real open positions under a hypothetical IV shock to show vega exposure in dollars; the Earnings & Event Risk overlay flags positions with known upcoming events, explicitly self-labeled SIMULATED in its own underlying data — a calendar/timing overlay, never a live news or gap-detection feed.",
      ],
      whyItMatters: "Every one of these risk categories has a real, corresponding platform feature — but the honesty is in the details: some are hard, structural enforcement (no naked positions, ever), some are live, exact math (buying power), and some are disclosed estimates or a timing overlay (assignment-risk level, event risk) — treating all of them as equally certain would be a mistake.",
      difficulty: "intermediate",
      whyItExists: "The existing Portfolio path already teaches concentration, diversification, correlation, buying power, stress testing, and event risk in depth at the WHOLE-ACCOUNT level. This lesson exists to cover the genuinely distinct, position-level and structural risk concepts the module asked for — defined vs. undefined risk, assignment risk, liquidity risk as a single-trade concern — while explicitly cross-referencing rather than duplicating the Portfolio path's own portfolio-wide lessons.",
      institutionalThinking: "A professional treats 'this platform enforces X' and 'this platform estimates X' as genuinely different levels of certainty — no naked positions is a hard guarantee; an assignment-risk level is an informed warning, not a promise. Building a pre-trade habit around the platform's own REAL checks, rather than an imagined ideal checklist, is what makes risk management repeatable.",
      screenWalkthrough: [
        "Trade Ticket page — the Pre-Trade Risk Validation card: a PASSED/BLOCKED badge, individual pass/fail checks, trade risk % and portfolio risk before→after %.",
        "Position Sizing page (`/position-sizing`) — buying-power utilization, capital-at-risk, and concentration before/after for a candidate trade.",
        "Portfolio Dashboard (`/portfolio-dashboard`) — the blended Portfolio Health score, including its Concentration and Event Risk components.",
        "Portfolio Stress Test (`/stress-test`) — real Black-Scholes repricing under a hypothetical IV shock, showing vega-risk dollars.",
        "Earnings & Event Risk overlay (`/event-risk`) — per-position event-risk levels from known upcoming dates, self-labeled SIMULATED.",
      ],
      workflowSteps: [
        "Before entering any position: confirm on the Trade Ticket that Pre-Trade Risk Validation shows PASSED, and read its trade-risk and portfolio-risk-before/after percentages, not just the pass/fail badge alone.",
        "Check Position Sizing's buying-power utilization and concentration-before/after for the candidate — a technically-passing trade can still push concentration uncomfortably high.",
        "For a short position approaching expiration or moving in-the-money: check its assignment-risk level, understanding it's a rule-based warning, not a prediction.",
        "Ahead of a known event (earnings, a scheduled release): check the Earnings & Event Risk overlay for that position, and consider running a Portfolio Stress Test IV-shock scenario.",
        "Periodically revisit Portfolio Dashboard's own Concentration/Diversification/Event Risk factors — a portfolio of individually well-sized, defined-risk trades can still drift toward unhealthy concentration over time.",
      ],
      metricsExplained: [
        { term: "Defined Risk", explanation: "A structurally capped maximum loss, fixed at entry — the only kind of position this platform's execution engine allows." },
        { term: "Buying Power Committed", explanation: "Capital tied up by an open defined-risk position, exactly equal to its own maximum loss — computed and enforced in real time." },
        { term: "Assignment Risk Level", explanation: "A rule-based (DTE + moneyness) warning level for a short position — never a prediction of whether assignment will actually occur." },
        { term: "Event Risk", explanation: "A self-labeled SIMULATED calendar/timing overlay flagging known upcoming events near an open position — not a live news feed or gap-detection system." },
      ],
      workedExamples: [
        {
          label: "Good Opportunity",
          title: "A defined-risk spread that clears every real pre-trade check",
          steps: [
            "The Trade Ticket's Pre-Trade Risk Validation shows PASSED with no warnings, trade risk sits comfortably below the position-sizing threshold, and Position Sizing's own concentration-after figure stays within a healthy range.",
            "No near-term event-risk flag applies to the symbol, and a quick Portfolio Stress Test IV-shock check shows an acceptable vega impact.",
          ],
        },
        {
          label: "Average Opportunity",
          title: "A position that passes but elevates concentration",
          steps: [
            "Pre-Trade Risk Validation still shows PASSED, but Position Sizing's concentration-after figure rises notably, since several existing positions already share the same sector.",
            "Worth pausing on even though nothing technically blocked it — the real risk here is portfolio-level, not position-level.",
          ],
        },
        {
          label: "Poor Opportunity",
          title: "Ignoring an elevated assignment-risk flag on an existing short position",
          steps: [
            "A short put has moved meaningfully in-the-money with only a few days to expiration, and its assignment-risk level reads elevated.",
            "Treating this as noise, rather than a genuine warning worth reviewing on the Trade Adjustment Preview page, ignores a real, computed signal the platform is deliberately surfacing.",
          ],
        },
      ],
      commonMistakes: [
        "Assuming this platform allows undefined-risk (naked) positions somewhere — it structurally never does, in the live trade flow.",
        "Treating a PASSED Pre-Trade Risk Validation badge as the only number worth checking, rather than also reading the trade-risk and portfolio-risk-before/after percentages next to it.",
        "Reading an assignment-risk level as a prediction rather than a rule-based warning.",
        "Assuming the Earnings & Event Risk overlay is a live news feed — it's an explicitly self-labeled SIMULATED calendar/timing overlay.",
        "Checking only position-level risk and never revisiting the Portfolio Dashboard's own concentration/diversification factors as the whole account evolves.",
      ],
      riskWarnings: [
        "This is educational content, not financial advice, and does not recommend any specific position or checklist outcome.",
        "A defined-risk position is not a LOW-risk position — its maximum loss is capped, but that maximum can still be a large, real dollar loss.",
        "Options can result in rapid and substantial losses; passing every automated check on this platform does not guarantee a profitable or even a survivable outcome for any individual trade.",
        "Modeled figures (assignment-risk level, event risk, stress-test shocks) can change before a real order is placed and are never a guarantee of what will actually happen.",
      ],
      bestPractices: [
        "Build a genuine habit: Trade Ticket validation → Position Sizing concentration check → event-risk check → (if relevant) a stress-test shock, in that order, before every new position.",
        "Never treat 'defined risk' as synonymous with 'low risk' — know the actual dollar maximum loss, not just the structural label.",
        "Revisit portfolio-wide concentration periodically, not only at the moment of a single new trade.",
      ],
      relatedModuleHrefs: ["/trade-execution-center", "/position-sizing", "/portfolio-dashboard", "/stress-test", "/event-risk", "/concentration-risk"],
      aiCoachPrompts: [
        "Walk me through this position's own Pre-Trade Risk Validation results.",
        "Why is this platform's engine refusing to let me open a naked call?",
        "Explain this position's assignment-risk level and what it does and doesn't predict.",
        "Build me a pre-trade risk checklist using this platform's own real checks.",
      ],
      nextStepKeys: [],
      knowledgeCheck: [
        {
          prompt: "Can you open a naked (undefined-risk) short call on this platform?",
          options: ["Yes, if you accept the risk warning", "Yes, but only in Full-Auto execution mode", "No — the execution engine structurally blocks every naked position before it can be opened", "Only for symbols with high open interest"],
          correctIndex: 2,
          explanation: "Confirmed: the platform's own execution and risk engines genuinely reject naked positions before they can ever be opened — this is enforced, not merely discouraged.",
        },
        {
          prompt: "How does buying power relate to a defined-risk position's maximum loss?",
          options: ["They are unrelated figures", "Buying power committed is exactly equal to the position's own maximum loss, computed in real time", "Buying power is always double the maximum loss", "Buying power only applies to undefined-risk positions"],
          correctIndex: 1,
          explanation: "Selling a defined-risk spread ties up buying power exactly equal to its own maximum loss — a real, enforced figure, not an estimate.",
        },
        {
          prompt: "What does an elevated assignment-risk level actually tell you?",
          options: ["Assignment is guaranteed to happen", "A rule-based (DTE + moneyness) warning that assignment risk is elevated — never a prediction of whether it will actually occur", "The position will be automatically closed", "Nothing — it's purely decorative"],
          correctIndex: 1,
          explanation: "It's an honest, rule-based warning level, explicitly not a predictive model — the actual exercise decision belongs entirely to the option's buyer.",
        },
        {
          prompt: "Is the Earnings & Event Risk overlay a live news or gap-detection feed?",
          options: ["Yes, it pulls real-time news", "No — it's explicitly self-labeled SIMULATED in its own data, a calendar/timing overlay built from known event dates, never a live feed", "Only for earnings, not other event types", "It only works for symbols with a live broker connection"],
          correctIndex: 1,
          explanation: "The event risk data carries an explicit SIMULATED source label in the code itself — it's a disclosed calendar/timing overlay, not a real-time gap or news-detection system.",
        },
        {
          prompt: "Does 'defined risk' mean 'low risk'?",
          options: ["Yes, always", "No — defined risk means the maximum possible loss is capped and known, but that capped amount can still be a large, real loss", "Only for iron condors specifically", "Defined risk means zero risk"],
          correctIndex: 1,
          explanation: "Defined risk is about a known ceiling on loss, not about the size of that ceiling — a defined-risk position can still lose a substantial, real amount of capital.",
        },
      ],
      relatedGlossaryKeys: ["defined-risk", "buying-power", "max-loss", "assignment", "event-risk", "concentration"],
      estimatedMinutes: 13,
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
