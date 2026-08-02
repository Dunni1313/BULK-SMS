# Version 2.0 Product Strategy Pack

**Prepared for:** Board / Executive Review
**Prepared as of:** Version 1.5.0 General Availability
**Status:** Strategy only. No code, no architecture, no implementation. Awaiting approval before any Version 2.0 development begins.

---

## 1. Executive Summary

We have spent eighteen months of engineering effort building something most
teams never attempt: a single platform that carries an investor all the way
from "what should I look at" to "what did I learn from that trade" — across
three normally-separate disciplines (fundamental investing, technical
trading, and options income) — with an AI layer that behaves less like a
chatbot bolted onto a dashboard and more like a genuinely integrated research
staff.

That is the good news, and it is real. The honest news is that we have built
a **product with no customers yet**. Version 1.5 is a technically mature,
internally-consistent, paper-trading-only platform. It has never been used
by a real investor putting real capital at risk, it has no pricing, no
brand, no go-to-market motion, and — measured against the household names
in this space — it is not trying to be, and should not try to be, all
things to all investors.

The strategic opportunity is narrower and better than "compete with
Bloomberg." It is: **become the default decision-and-coaching layer for the
serious individual investor and the one-person investment shop** — the
person or small team who today stitches together five subscriptions
(a charting tool, a fundamentals screener, a broker, a spreadsheet, and a
journal app) and gets no synthesis across any of them. Nobody currently
owns that seam. We do, if we position and price for it deliberately rather
than drift into it.

**Recommendation: proceed to Version 2.0 planning, scoped explicitly around
individual/prosumer product-market fit and a narrow enterprise wedge (see
§13), not around live trading or enterprise data licensing as a first
move.**

---

## 2. What product have we actually built?

Strip away the engineering language and this is the product, in plain
terms:

An investor opens one application and gets three things a professional
investment team normally provides separately:

1. **A research analyst** — company research that runs Graham, Buffett, and
   a third named methodology ("Tom Nash") independently, then has an AI
   "Investment Committee" reconcile their disagreements into one verdict
   with a stated confidence level, rather than handing the user three
   numbers and no synthesis.
2. **A trading desk** — market structure, liquidity, multi-timeframe trend,
   probability cones, and a risk engine that will tell a user, in plain
   language, when a position is oversized relative to their own stated
   risk tolerance.
3. **An income desk** — the platform's most mature engine, running real
   options income strategies (iron condors and friends) against a real
   paper-trading brokerage connection (Alpaca), with an automation layer
   that has an actual, tested kill switch — not a "pause" button, a real
   one.

Wrapped around all three: one portfolio view, one AI coaching voice (with
consistent guardrails so it never pretends to be a licensed advisor), one
notification system, one trade journal, and — genuinely differentiating —
an embedded **Learning Centre** that teaches the underlying concepts in
context, so the product doubles as the education a new investor would
otherwise have to buy separately.

What we have **not** built: a live-trading platform, a data terminal, a
compliance system, a multi-seat firm product, or anything resembling a
finished go-to-market motion. Those are Version 2.0-and-beyond questions,
not gaps in Version 1.5's execution.

---

## 3. Who is the ideal customer?

**Primary: the "solo desk" investor.** A self-directed individual with
real capital ($100K–$5M investable), enough sophistication to want
Graham/Buffett-style rigor and real options-income mechanics, but no team
around them. Today this person's stack is Koyfin + TradingView +
a spreadsheet + a broker + a paid newsletter. We replace four of those
five and add a coaching layer none of them have.

**Secondary: the one-person or two-person RIA / independent wealth
manager.** Someone managing client capital without the budget for
Bloomberg or FactSet, who wants an institutional-feeling workspace to run
their own process and, eventually, to show clients.

**Tertiary: the serious learner.** Someone who wants to become the
"solo desk" investor above but isn't yet — a genuine top-of-funnel
audience the Learning Centre is already built to serve, and a natural free
or low-cost entry tier.

We are explicitly **not**, at this stage, building for: hedge funds,
multi-strategy asset managers, or trading desks that need Level 2 order
book data, real-time squawk, or SEC-grade recordkeeping. Chasing that
customer with this product would be a category error — see §7.

---

## 4. What problems does it solve?

- **Fragmentation.** Today's serious individual investor runs 4–6 tools
  and manually carries context between them. We collapse research,
  trading analysis, options income, journaling, and portfolio risk into
  one continuous workflow.
- **Synthesis paralysis.** Getting a Graham number, a DCF, and a Buffett
  read on a stock is available elsewhere; being told *which one to
  trust and why*, with a stated confidence level, is not. That is what
  the AI Investment Committee actually does.
- **The "black box AI" fear.** Retail investors are increasingly offered
  AI trading tools they do not trust, because those tools cannot explain
  themselves and cannot be turned off cleanly. We built the opposite: an
  automation layer with a real kill switch, and an AI layer that is
  radically honest about what it can't compute rather than fabricating
  an answer — this shows up constantly in the product as "unavailable"
  rather than a guessed number.
- **The missing feedback loop.** Most tools stop at the trade. We close
  the loop back to a journal and a learning path, so a mistake becomes a
  lesson rather than a forgotten line in a brokerage statement.

---

## 5. What makes it unique?

1. **Three-engine synthesis, not three separate apps stitched together.**
   Every engine reuses the others' outputs (a Command Center shows an
   Engine 1 verdict and an Engine 2 technical read on the same symbol,
   side by side, computed from the same underlying data) — this is
   invisible plumbing to a user, but it is why the product *feels*
   coherent instead of feeling like three products wearing one skin.
2. **An actual AI Investment Committee**, not a single AI opinion. Named,
   distinct methodologies vote; disagreement is shown, not hidden; a
   split vote defaults to the safe answer ("Hold"), never a forced
   coin-flip. No consumer product in this category does this today.
3. **Radical data-source honesty.** Every simulated number is labeled as
   simulated; every "we don't have this data" moment says so plainly
   instead of guessing. This is a genuine trust-building design choice
   most fintech products don't make, because it's easier to fake
   confidence than to admit a gap.
4. **Paper-trading-first safety culture**, with a real, tested kill
   switch and guardrail system around automation — built and reviewed
   with the seriousness of a live-money system before a single dollar
   of real capital has touched it.
5. **Education embedded in the workflow**, not sold as a separate course.
   A user hits a concept they don't understand and the platform teaches
   it right there, in context.

---

## 6. Biggest competitive advantages

- **Integration depth across the full investor lifecycle** — research →
  decision → risk → execution → journal → learning — which is the seam
  every named competitor leaves for the user to manage themselves.
- **A genuinely differentiated AI layer** (the Investment Committee, the
  per-engine AI coaches) that is disciplined rather than performative —
  this becomes a real moat once users experience competitors' AI
  features as shallower by comparison.
- **A cost structure that does not depend on expensive real-time data
  licensing** to be useful today (SIMULATED-first, LIVE-optional) — this
  means a much lower cost base than any Bloomberg/FactSet-style
  competitor, and a viable low price point.
- **A safety-first automation posture** that is a genuine selling point
  to a cautious, sophisticated buyer who has been burned by "black box"
  trading bots before.

---

## 7. Biggest weaknesses

- **No live trading.** The entire platform is paper-trading-only today.
  This is the single biggest gap between "impressive demo" and "product
  I trust with real money," and it is the first thing a professional
  trader or family office CIO will ask about.
- **Data depth.** No true real-time quotes, no Level 2/order book, no
  licensed institutional fundamentals data by default — SIMULATED data
  is honest, but it is not what a professional evaluator expects to see
  in a live demo.
- **Unproven with real customers.** Zero pricing, zero paying users,
  zero retention data. Every claim about product-market fit in this
  document is a hypothesis, not a fact.
- **Navigation and naming sprawl** (documented in detail in the Final
  Product Review): 89+ pages, multiple similarly-named "Portfolio" and
  "Coach" surfaces, and no clear "start here" path for a first-time
  user. This reads as an engineering-led information architecture, not
  a product-led one.
- **No compliance, multi-seat, or recordkeeping tooling** — a hard
  blocker for the RIA/wealth-manager segment beyond a solo practitioner.
- **No mobile experience.** A meaningful gap against every named
  competitor for a customer who wants to check a position from their
  phone.
- **Single-tenant fallback risk.** The platform's own safety default
  (an unauthenticated request falling back to a shared "legacy owner"
  identity) is the right engineering choice for a rollback switch, but
  it is a genuine operational landmine if a public launch ever forgets
  to flip it off — a process risk, not a product one, but one the
  executive team should be aware exists.

---

## 8. Which features delight users?

Based on direct evaluation against a professional user's expectations
(not user testing, which does not exist yet — flagged honestly):

- **The AI Investment Committee.** Seeing three named, independent
  methodologies disagree and then watching the product reconcile that
  disagreement into one answer, with a stated confidence level, reads as
  genuinely novel rather than gimmicky.
- **The Cross-Engine Command Center / Daily Report.** The single
  "what does my whole portfolio and the market look like today" view is
  the closest thing in the product to a personal chief investment
  officer, and it is a strong daily-habit hook.
- **Honest unavailable states.** Once a sophisticated user notices the
  product says "we don't have this" instead of fabricating a number,
  trust visibly increases — this is a slow-burn delight, but a durable
  one.
- **The kill switch and guardrails around automation.** A cautious buyer
  who tests "can I actually stop this" and finds a real, working answer
  converts from skeptic to advocate quickly.
- **The Trade Journal → Learning loop.** Turning a losing trade into a
  documented lesson, in the same tool that made the trade, is a real
  behavior-change mechanic most competitors don't attempt.

---

## 9. Which features confuse users?

- **Too many "Portfolio" surfaces.** Seven distinct pages carry the word
  "Portfolio" in some form. A new user cannot tell which one is "the"
  portfolio view.
- **Two differently-named AI Trade Coach systems**, and at least five
  different nouns (Coach / Mentor / Analyst / Assistant) used across the
  product for what is functionally the same "ask the AI about this" idea.
- **The engine boundary itself is invisible to a new user.** Nothing in
  the first five minutes explains why "Trading" and "Investing" are
  different engines, or why "Options Income" behaves so differently
  (real broker connection, real automation) from the other two
  (research and analysis only, no live orders).
- **Multiple command-center-style landing surfaces** (Command Center,
  Institutional Command Centre, Executive Dashboard, Cross-Engine
  Workspace) whose names imply overlapping purposes even where the
  actual content differs — a first-time user has no way to guess which
  one is "home."
- **A first-run experience with no path.** There is no onboarding
  sequence; a new user is handed the entire surface area at once.

---

## 10. Which features should be removed?

Not from the codebase — from what a paying customer is exposed to at
launch. Removal here means "hide from the default experience," not "delete."

- **The legacy, statistically-fabricated backtest path** in the Options
  Income Engine, now that a genuine simulation-based backtester exists
  alongside it — keeping both visible to an end user undermines the
  "we never fabricate data" positioning that is otherwise a real
  strength.
- **One of the two "Trade Coach" naming tracks** — pick one noun and one
  entry point per engine, retire the rest from the visible nav.
- **The internal design/prototyping sandbox** — already correctly kept
  out of the shipped product; ensure it stays that way at launch.
- **Redundant Portfolio-branded pages** — consolidate to one primary
  portfolio hub with drill-downs, rather than seven parallel entry
  points.
- **Any admin/operations surface** from the default customer-facing
  build — that is an internal tool and should never appear in a
  customer's navigation.

---

## 11. Which features should move to Version 2?

- **Live trading**, gated behind a validated cohort of paper-trading
  users who have demonstrated real engagement — this is the single
  highest-value, highest-risk item on the roadmap and should not be
  rushed.
- **Live market data and live broker/provider verification** (real-time
  quotes, live Alpaca, live fundamentals providers) — a prerequisite for
  live trading, not a nice-to-have alongside it.
- **A genuine composable strategy builder** — deliberately deferred by
  the engineering team already given its proximity to the platform's
  most safety-critical code; the right call, and it should stay deferred
  until live trading itself is proven.
- **Mobile.**
- **Multi-seat / team accounts** for the RIA segment, with basic
  compliance-friendly recordkeeping and export.
- **Notification delivery beyond in-app** (email/push), once there is a
  real user base whose attention we need to compete for outside the
  browser tab.
- **A deliberate navigation and information-architecture redesign** —
  not a rebuild, a consolidation, informed directly by §9 and §10 above.
- **Broker integrations beyond Alpaca**, once a live-trading product
  thesis is validated with one broker first.

---

## 12. Competitive positioning

**We are not a Bloomberg competitor, a data terminal, or a broker. We are
the decision-and-coaching layer that sits between "I have an idea" and
"I placed and learned from a trade" — a layer none of the following
products fully own today.**

| Product | What they actually own | Where we differ |
|---|---|---|
| **Bloomberg** | Real-time institutional data, the trading-desk standard, six-figure enterprise pricing | We do not compete on data depth or price point at all — we compete on being usable by a single sophisticated individual, at a fraction of the cost, with a coaching layer Bloomberg has no reason to build |
| **TradingView** | Charting excellence and a massive social/community layer | TradingView is a charting and idea-sharing tool; we are a decision-and-execution-and-learning system. A user could use both without overlap — TradingView for charts, us for judgment |
| **Koyfin** | Affordable institutional-style research and analytics for retail — our closest analog on the investing side | Koyfin stops at research. We continue past research into trading, options income, execution, journaling, and a synthesized AI verdict Koyfin doesn't attempt |
| **FactSet** | Enterprise-grade data and analytics sold to professional analysts at asset managers | Entirely different buyer (enterprise procurement vs. an individual's own subscription) — not a near-term competitor in any segment we're targeting |
| **Morningstar** | Trusted retail brand in fund/stock ratings and research | Morningstar tells you a rating; we tell you three independent methodologies' verdicts, reconcile their disagreement, and then help you act on it and learn from the outcome |
| **Interactive Brokers** | The actual broker and execution venue | We are not a broker and should not try to become one — we are a layer that sits on top of a broker (today, Alpaca for paper trading); a live-trading Version 2 must decide deliberately whether to stay broker-agnostic or deepen one relationship, not drift into competing with brokers |
| **Option Alpha** | The closest direct competitor — automated options income strategies | Options income is one of our three engines, not the whole product; we differentiate by wrapping options income inside a full-portfolio, full-lifecycle system with cross-engine AI synthesis Option Alpha does not have |

**Positioning statement:** *"Your own investment committee — institutional
decision discipline, options income management, and an AI coach that
never pretends to know more than it does, in one workspace built for the
serious individual investor, not the trading desk."*

---

## 13. Strategic recommendations

### Vision
Democratize institutional-grade investment judgment — not just data — for
the serious individual investor and the small independent investment
practice.

### Mission
Give every serious investor the research analyst, risk manager, trading
coach, and execution partner that only large institutions could
previously afford — powered by AI, held to real financial discipline, and
never pretending to certainty it doesn't have.

### Brand positioning
"Your own investment committee." Lead with judgment and synthesis, not
with feature lists or data volume — that is the one dimension no named
competitor is contesting today.

### Pricing model
A three-tier SaaS structure:
- **Free / Learner** — Learning Centre access, limited research lookups,
  SIMULATED-only — the top-of-funnel product.
- **Pro** (the core paid tier) — full three-engine access, paper
  trading, unlimited AI coaching and Investment Committee synthesis.
- **Elite / Practice** — multi-portfolio support, priority AI usage,
  and — once available — live trading and live data, priced to also
  suit the solo-RIA segment.
Live data/provider costs (FMP, Alpha Vantage, a live broker) should be
passed through or bundled only at the paid tiers, preserving the
SIMULATED-first cost advantage at the free tier.

### Target customer (go-to-market priority order)
1. The solo, sophisticated self-directed investor (§3, primary).
2. The options-income trading community specifically — Option Alpha's
   own audience is a proven, addressable market and our closest
   like-for-like comparison.
3. The one-person RIA, once basic recordkeeping exists.

### Go-to-market strategy
Content and community-led, not enterprise-sales-led, in Year 1:
- The Learning Centre is already a built asset — publish it, or excerpts
  of it, as public content (articles, short-form video, a public
  "glossary") to build organic top-of-funnel demand before a hard paywall.
- Go directly to existing options-income and value-investing communities
  (the exact audiences Option Alpha and Koyfin already validated exist
  and pay) rather than trying to invent a new audience.
- Creator/affiliate partnerships with finance educators who would
  otherwise build this exact "teach and then hand off to a tool" flow
  themselves.
- Avoid enterprise/RIA sales motion entirely until compliance and
  multi-seat tooling exists — selling to that segment before the
  product supports it will damage trust with the first cohort that
  matters most.

### Enterprise opportunities
Not a Year 1 priority, but a credible Year 2–3 path:
- **White-label the decision engine** (Investment Committee synthesis,
  risk scoring) for small RIAs who want an "institutional-grade" report
  to hand clients, without building it themselves.
- **API/embed the AI Investment Committee** as a component other
  fintech products could license — the reconciliation-of-disagreement
  mechanic is the genuinely defensible IP here, more than any single
  UI.
- **B2B2C with a broker** who wants to add real research/coaching depth
  to their own retail app without building it in-house.

### Version 2.0 roadmap (sequenced)
1. Navigation/IA consolidation and first-run onboarding (§9/§10) — fix
   the product before scaling its audience.
2. Live paper-trading cohort validation and real user/pricing data
   before committing to live trading.
3. Live trading (single broker first), gated on the above.
4. Mobile.
5. RIA-tier tooling (multi-seat, basic compliance export).
6. Enterprise/white-label motion (§ above), once the core product has
   paying retail customers.

### Three-year product vision
- **Year 1:** Nail individual/prosumer product-market fit on the
  existing paper-trading, three-engine product; prove the pricing model
  and the content-led GTM motion; fix the navigation/IA issues surfaced
  in this review before scaling paid acquisition.
- **Year 2:** Ship live trading and live data for a validated cohort;
  launch the RIA/practice tier with basic compliance tooling; begin the
  white-label/API conversation with the first design-partner firm.
- **Year 3:** Be recognized as the default "AI investment committee"
  layer — both as a direct consumer product and as an embeddable
  capability other platforms license — with a clear identity distinct
  from every competitor in §12: not a data terminal, not a broker, not a
  single-strategy bot, but the judgment layer serious investors and the
  firms that serve them plug their own capital and their own clients
  into.

---

## 14. Closing note to the board

Version 1.5 is a genuinely differentiated, technically disciplined
product with no customers, no price, and no brand yet. That is not a
weakness to apologize for — it is the actual, honest starting line. The
single highest-leverage next step is not more engineering; it is
choosing the customer in §3, fixing the first five minutes of the
product in §9/§10, and finding out — with real users, at a real price —
whether the thesis in this document survives contact with the market.

**No development should begin against this document until it is formally
approved.**
