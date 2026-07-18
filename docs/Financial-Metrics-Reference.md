# Financial Metrics Reference

**Phase 12 — Institutional Investing Engine Consolidation & Integration.** A reference for every financial metric the Institutional Investing Engine computes and shows — what it means, why it matters, and which module produces it. Every metric below already existed before this phase (per the phase's own "reuse, do not duplicate" directive); this document is new, the metrics are not.

All figures are historical and deterministic — computed from already-reported financial data (`lib/fundamentals.ts`'s `Fundamentals` interface). None of them predict a future price.

## Growth

| Metric | Field | Meaning | Why it matters |
|---|---|---|---|
| Revenue Growth (5y) | `revenueGrowth5y` | Annualized top-line growth over the trailing 5 years | Whether the business is genuinely expanding, not just holding steady |
| Revenue Growth (forward) | `revenueGrowthFwd` | Analyst-consensus-style forward growth estimate | A forward-looking cross-check against the trailing trend |
| EPS Growth (5y) | `epsGrowth5y` | Annualized earnings-per-share growth | Whether profit is growing at least as fast as revenue (margin expansion) or slower (margin compression) |
| Revenue/EPS/FCF History | `revenueHistory`/`epsHistory`/`fcfHistory` | 6-year arrays, oldest to newest | The raw trend data every trend chart on the Financial Ratios card plots directly |

## Profitability

| Metric | Field | Meaning | Why it matters |
|---|---|---|---|
| Gross Margin | `grossMargin` | Revenue minus cost of goods sold, as a % of revenue | Pricing power and product economics |
| Operating Margin | `operatingMargin` | Operating income as a % of revenue | Efficiency of the core operating business, before financing/tax effects |
| Net Margin | `netMargin` | Net income as a % of revenue | The final, all-in profitability of every dollar of sales |
| Return on Equity (ROE) | `roe` | Net income ÷ shareholders' equity | How efficiently shareholders' own capital is converted into profit — can be inflated by leverage |
| Return on Invested Capital (ROIC) | `roic` | Operating profit ÷ total invested capital (debt + equity) | The single most important quality signal for a durable competitive advantage — a leverage-neutral view of ROE |

## Cash Flow

| Metric | Field | Meaning | Why it matters |
|---|---|---|---|
| Free Cash Flow (FCF) per share | `fcfPerShare` | Operating cash flow minus capital expenditures, per share | The cash a business actually has left over, the input to DCF and Buffett's owner-earnings model |
| FCF Margin | `fcfMargin` | FCF as a % of revenue | How much of every revenue dollar converts to real, spendable cash |
| FCF-Positive Years | `fcfPositiveYears` | Count of years (out of the tracked history) with positive FCF | A structural consistency check — a business with erratic cash generation is riskier than its margin numbers alone suggest |

## Valuation

| Metric | Field / Model | Meaning | Why it matters |
|---|---|---|---|
| P/E (trailing / forward) | `pe`/`forwardPe` | Price ÷ earnings per share | How many years of current/expected earnings an investor is paying for — historical, not future-price-predictive |
| EV/EBITDA | derived in `financialRatios.ts` | Enterprise Value ÷ EBITDA | A capital-structure-neutral valuation multiple, unaffected by debt/tax differences between companies |
| Price/FCF, Price/Sales, Price/Book | `fcfYield`, `ps`, `pb` | Price relative to cash flow / sales / book value | Alternative valuation lenses for companies where earnings are volatile or negative |
| Graham Number | `lib/grahamValuation.ts` | sqrt(22.5 × trailing EPS × book value/share) | Benjamin Graham's classic conservative fair-value formula, using only already-reported (never forward) earnings |
| DCF Fair Value | `lib/dcfValuation.ts` | Multi-year projected FCF discounted to present value + terminal value | A genuine multi-year cash-flow projection, not a single-year multiple |
| Buffett Fair Value (Owner Earnings) | `lib/buffettValuation.ts` | Owner earnings capitalized as a no-growth perpetuity at a quality/moat-adjusted required return | Warren Buffett's own preferred conservative capitalization approach |
| Consolidated Margin of Safety | `lib/marginOfSafety.ts` | Range/average across all 4 models + an agreement signal | Never a single number pretending to certainty — shows where the models agree or disagree |

## Financial Health

| Metric | Field | Meaning | Why it matters |
|---|---|---|---|
| Debt-to-Equity | `debtToEquity` | Total debt ÷ shareholders' equity | Balance-sheet leverage — higher means more financial risk in a downturn |
| Interest Coverage | `interestCoverage` | Operating income ÷ interest expense | How comfortably the company can service its debt from operating profit |
| Current Ratio | `currentRatio` | Current assets ÷ current liabilities | Short-term liquidity — can the company meet its near-term obligations |
| Net Cash per Share | `netCashPerShare` | (Cash − total debt) ÷ shares outstanding | A single number capturing whether the balance sheet is a net-cash fortress or net-debt liability |

## Shareholder-Facing

| Metric | Field | Meaning | Why it matters |
|---|---|---|---|
| Dividend per Share / Yield | `dividendPerShare`/`dividendYield` | Cash returned to shareholders per share / relative to price | Direct income return, relevant for income-focused investors |
| Share Count Change (5y) | `sharesOutstandingChange5y` | Net change in shares outstanding | Buybacks (shrinking count) increase each remaining share's claim on the business; dilution (growing count) does the opposite |
| Insider Ownership % | `insiderOwnershipPct` | % of shares held by company insiders | Alignment between management and outside shareholders — an honestly `null` field when a provider doesn't supply it, never fabricated |

## Composite scores (see `docs/Business-Quality-Scoring.md` for full methodology)

- **Business Quality Score** (`lib/investmentQuality.ts`) — a 12-metric, 0-100 composite.
- **Competitive Advantage Score** (`lib/competitiveAdvantage.ts`) — an 11-dimension composite.
- **Tom Nash Conviction Score** (`lib/tomNashEngine.ts`) — a 5-pillar composite blending several of the above.

## Cross-references

- `docs/Institutional-Investing-Engine.md` — the full engine overview.
- `docs/Business-Quality-Scoring.md` — how the composite quality scores are built from these raw metrics.
