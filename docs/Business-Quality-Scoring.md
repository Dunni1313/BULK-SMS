# Business Quality Scoring

**Phase 12 — Institutional Investing Engine Consolidation & Integration.** How the Institutional Investing Engine scores a company's underlying business quality — independent of whether its stock happens to be cheap or expensive right now. Both scoring engines described here (`lib/investmentQuality.ts`, `lib/competitiveAdvantage.ts`) already existed before this phase (Phase 2, Sprints 15 and 21); this document is new, the scoring logic is not.

Every score below is 0-100, deterministic, and computed purely from already-reported financial data or already-fetched filing/qualitative signals — never an LLM opinion, never a fabricated number when data is missing (an unavailable metric is honestly reported `unavailable`, with a reason, and excluded from the weighted average via renormalization).

## 1. Business Quality Score (Investment Quality Engine)

`lib/investmentQuality.ts` — a 12-metric, weighted composite.

| Metric | Weight | Benchmark direction |
|---|---|---|
| Revenue Growth | 10% | Higher is better |
| EPS Growth | 10% | Higher is better |
| Free Cash Flow Growth | 10% | Higher is better (derived as a CAGR from the 6-year `fcfHistory` array) |
| Return on Equity | 10% | Higher is better |
| Return on Invested Capital | 12% | Higher is better — the single most important quality signal |
| Gross Margin | 6% | Higher is better |
| Operating Margin | 7% | Higher is better |
| Net Margin | 7% | Higher is better |
| Debt Levels | 10% | Lower leverage / higher interest coverage is better |
| Cash Position | 8% | Higher net cash is better |
| Share Dilution / Buybacks | 5% | Buybacks (shrinking share count) score higher than dilution |
| Insider Ownership | 5% | Higher insider ownership is better (alignment signal) |

**Share Dilution/Buybacks and Insider Ownership are honestly `unavailable`** whenever the active data provider doesn't supply the underlying field (e.g., no `sharesOutstandingChange5y`/`insiderOwnershipPct`) — never approximated. When both are missing, the overall score renormalizes over the remaining 10 metrics, and `confidenceLevel` reads "Moderate" rather than "High" — a self-documenting property of the honesty discipline, not a bug.

The final score maps to a rating (`Wonderful`/`Good`/`Average`/`Weak`) and a human-readable summary that names the company's own top strengths and weaknesses.

## 2. Competitive Advantage Score (11 dimensions)

`lib/competitiveAdvantage.ts` — a broader framework than the classic economic moat, scoring 11 distinct dimensions of competitive protection:

1. **Brand Strength**
2. **Network Effects**
3. **Switching Costs**
4. **Cost Advantages** — blends pricing power with the Business Quality Engine's own already-scored Gross Margin metric (no new formula)
5. **Economies of Scale**
6. **Intangible Assets** (patents, IP, brand equity)
7. **Regulatory Advantages**
8. **Distribution Advantages**
9. **Recurring Revenue Quality**
10. **Customer Concentration Risk** — always honestly `unavailable`; no provider (SIMULATED or LIVE) publishes revenue-by-customer concentration data today
11. **Competitive Durability** — blends the Business Quality Engine's own ROIC score, Financial Strength's own FCF-reliability score, and a historical revenue/EPS consistency check — the one genuinely composite dimension, still built entirely from already-computed figures

10 of 11 dimensions are always available by design; the overall score renormalizes over those 10 when Customer Concentration Risk can't be scored, and classifies to the same `Wide`/`Medium`/`Narrow`/`None` vocabulary the classic Economic Moat rating already uses (`classifyMoatRating()`, shared, not duplicated).

## 3. How these feed into the rest of the engine

- **Tom Nash Conviction Engine** (`lib/tomNashEngine.ts`) reuses the Business Quality Score directly as its own "Business Quality" pillar — no re-scoring.
- **Management Quality Analysis** (`lib/managementAnalysis.ts`) reuses Tom Nash's Capital Allocation pillar and Competitive Advantage's Competitive Durability dimension for two of its own 9 dimensions.
- **Industry Comparison** (`lib/industryComparison.ts`) ranks a company's Business Quality/Competitive Advantage scores against sector peers — the same numbers, viewed relatively rather than in isolation.
- **The Investment Thesis Generator** (Phase 12, `lib/investmentThesisGenerator.ts`) describes both scores in its "Business Overview" section — it never recomputes them.

## Cross-references

- `docs/Institutional-Investing-Engine.md` — the full engine overview.
- `docs/Financial-Metrics-Reference.md` — the raw financial metrics these composite scores are built from.
