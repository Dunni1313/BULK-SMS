# Optimisation Workflow

**Phase 18 — Institutional Portfolio Optimisation Engine.** The end-to-end user workflow the Portfolio Optimisation page (`/stock-analyst/portfolio-optimisation`) is designed to support, per the phase's own brief:

> Review portfolio → Identify weak positions → Compare stronger alternatives → Review evidence → Save optimisation notes → Send candidate to watchlist. All without leaving the Institutional Workspace.

## Step-by-step

1. **Review portfolio.** Select a portfolio from the dropdown (or arrive via a `?portfolioId=` deep link from Portfolio Manager, Decision Engine, Opportunity Discovery, or the Institutional Workspace's own left-sidebar "Optimise" link). The Overview tab shows Portfolio Health (Quality/Capital Allocation/Diversification/Overall Risk scores), Concentration Analysis, and any Active Alerts for held positions (reused directly from Institutional Monitoring).

2. **Identify weak positions.** The Position Quality Ranking table (Overview tab) sorts every held position by the Decision Engine's own synthesis score. The Upgrade Analysis tab groups the same positions into Exit, Trim, and Upgrade candidates, each with a plain-language reason quoting the exact Decision Engine recommendation or concentration-cap breach that triggered it.

3. **Compare stronger alternatives.** Clicking "Compare" on any candidate switches to the Comparison View tab with that symbol pre-selected as the primary; pick a Replacement Opportunity or Cash Deployment Suggestion from the dropdown to see a side-by-side table (reusing the existing Opportunity Discovery comparison endpoint) highlighting which symbol has the best already-computed value per dimension.

4. **Review evidence.** Every candidate and replacement has a "Show Evidence" toggle revealing its full Evidence Panel: the underlying metrics (Business Quality, Financial Strength, Valuation, Margin of Safety, Investment Committee verdict, Tom Nash conviction, Decision Engine synthesis score), the Decision Engine's own recommendation, the Investment Committee's own recommendation, the already-written rank explanation, and three deterministic impact sentences (portfolio, risk, diversification) — never a price prediction or return forecast.

5. **Save optimisation notes.** Below any expanded Evidence Panel, an optional note field plus "Save Review" persists the candidate's symbol, action, note, and a snapshot of the evidence shown at that moment. The Saved Reviews tab lists every review, newest first.

6. **Send candidate to watchlist.** Every candidate and replacement card has a one-click "Watchlist" button, reusing the existing Value Watchlist `POST` endpoint — no new logic.

Every step above happens on the same page; the Allocation Summary tab additionally surfaces Capital Allocation Suggestions (a deterministic aggregation of Exit/Trim weight vs. idle cash) alongside the full Replacement Opportunities and Cash Deployment Suggestions lists.

## Cross-references

- `docs/Portfolio-Optimisation.md` — what the engine is, the audit, and the reuse map.
- `docs/Portfolio-Review-Guide.md` — how to interpret an optimisation review's classifications and evidence.
