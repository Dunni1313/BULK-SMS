# Institutional Portfolio Manager

**Phase 13 — AI Portfolio Manager & Institutional Portfolio Intelligence.** This document describes the platform's Institutional Portfolio Manager — the central portfolio management system for long-term, target-allocation investors built in this phase — and, critically, what it reuses rather than duplicates from the existing Institutional Investing Engine ("Engine 1", Phase 2/12).

**A repository audit was performed before any code was written.** It confirmed a real Portfolio Construction Engine (`lib/portfolioConstruction.ts`, target-weight allocation/drift/rebalance) and a real Portfolio Risk Analysis module (`lib/investingRisk.ts`, concentration/sector-exposure/beta scoring) already existed (Phase 2, Sprints 28–29). This phase's job was to identify the *genuine gaps* around those two modules — Quality/Capital-Allocation scoring, richer allocation breakdowns, extended risk dimensions, performance/income analytics, snapshots, notes — and build only those, composing on top of what already existed.

---

## 1. What already existed (unmodified this phase)

| Capability | Module | Notes |
|---|---|---|
| Target-weight allocation, drift, rebalance signal | `lib/portfolioConstruction.ts` | `computePortfolioAllocation()`/`buildPortfolioAllocation()`, unchanged in substance |
| Portfolio Risk Analysis | `lib/investingRisk.ts` | Concentration, sector exposure, beta ("cyclicality") scoring |
| `investing_portfolios`/`investing_holdings`/`investing_risk_snapshots` tables | `lib/db/src/schema/*` | Phase 2, Sprints 28–29 |
| `PortfolioConstruction.tsx` page | `pages/PortfolioConstruction.tsx` | Portfolio list, holdings CRUD, existing Risk panel |
| Value Watchlist | `value_watchlist` table | Reused for the Watchlist-vs-Portfolio comparison |
| Full Company Research composition | `lib/valueReport.ts` (`buildValueResearchReport`) | Reused per distinct holding symbol for Quality/Capital Allocation/Valuation |
| Investment Quality / Tom Nash / Investment Committee | `lib/investmentQuality.ts`, `lib/tomNashEngine.ts`, `lib/investmentCommittee.ts` | Reused, unmodified, via the report above |

None of these were rewritten or duplicated. Every new module below composes on top of them.

## 2. Genuine gaps identified and built this phase

- **Portfolio-level Quality / Capital Allocation scores** — no portfolio-wide roll-up of Investment Quality or Tom Nash's Capital Allocation pillar existed.
- **Sector / Industry / Market-Cap Allocation** — `PortfolioHoldingAllocation` never exposed `industry`/`marketCap`, and no allocation-breakdown computation existed.
- **Growth vs. Value / Quality mix** — no portfolio-level classification of holdings existed.
- **Country / Currency exposure** — genuinely impossible with any provider in this codebase; always honestly `unavailable`.
- **Cost basis / Performance Analytics** — `investing_holdings` had no cost-basis column; no P&L computation existed.
- **Diversification Score** — no composite existed.
- **Extended Risk dimensions** (Cash Risk, Dividend Dependence, Leverage Exposure, Quality Drift, Portfolio Stability) — only Concentration/Sector/Beta existed.
- **Income/Dividend analytics** — no portfolio-level dividend-yield/income roll-up existed.
- **Watchlist vs. Portfolio comparison** — no comparison existed.
- **Position sizing / rebalancing assistant** — drift/rebalance action existed, but no concrete suggested-share-delta.
- **Composite snapshots** (Quality/Risk/Diversification, distinct from the existing risk-only snapshot) and **Timeline** — didn't exist.
- **Portfolio Notes** — no free-text note table for a portfolio existed (only per-symbol research notes, Phase 12).

## 3. What this phase built

### 3.1 `lib/portfolioIntelligence.ts` — the core composition module
`buildPortfolioIntelligence(holdings, provider, previousSnapshot?)` — reuses `buildPortfolioAllocation()` (unmodified) and `computePortfolioRiskFromAllocation()` (unmodified) exactly once each, then resolves each **distinct** holding symbol's `Fundamentals` once and feeds it into `buildValueResearchReport()` via its existing `fundamentalsOverride` parameter — zero duplicate provider calls. Produces the Quality/Capital-Allocation scores, allocation breakdowns, extended risk dimensions, performance, income, and the position-sizing/rebalancing assistant. `compareWatchlistToPortfolio()` is a pure set-comparison function reusing the existing watchlist table's own symbol list.

**On-demand, not eager**, per the established Sprint 19–20 precedent: this composes `buildValueResearchReport()` per distinct holding, real non-trivial work, so it lives behind its own route (`GET /portfolio-construction/portfolios/:id/intelligence`), never folded into the eager portfolio-detail view. Sector/Industry/Market-Cap fields themselves *are* eager — they ride along on `buildPortfolioAllocation()`'s own already-eager resolution (extended, not duplicated).

### 3.2 New/extended database objects
- `investing_holdings.avg_cost_basis` (nullable, additive) — the one new column, for Performance Analytics.
- `investing_portfolio_snapshots` — a new, separate composite (Quality/Risk/Diversification) snapshot table, distinct from and coexisting with the existing risk-only `investing_risk_snapshots`.
- `investing_portfolio_notes` — mirrors `investing_research_notes` (Phase 12) exactly, scoped to a portfolio instead of a symbol.
- `Fundamentals.marketCap` — a new public field on the existing `Fundamentals` interface, mirroring `beta`'s own Sprint 29 precedent: LIVE providers (FMP `/profile.mktCap`, Alpha Vantage `OVERVIEW.MarketCapitalization`) already fetched this for internal use; it's now simply exposed. SIMULATED gets a deterministic seeded value. **Zero new provider calls.**

### 3.3 New routes (all on the existing `routes/portfolioConstruction.ts`)
- `GET .../portfolios/:id/intelligence` — the full analysis above.
- `GET .../portfolios/:id/watchlist-comparison` — reuses the caller's own watchlist.
- `GET/POST .../portfolios/:id/snapshots` — the new composite snapshot, explicit "Save" only.
- `GET/POST .../portfolios/:id/notes`, `PATCH/DELETE .../portfolios/:id/notes/:noteId` — full note CRUD.

### 3.4 UI — `PortfolioConstruction.tsx` extended into a tabbed Institutional Portfolio Manager
Overview / Holdings / Allocation / Quality / Risk / Performance / Income / Snapshots / Timeline / Notes tabs. Holdings and the existing Risk panel are the *original* content, relocated into their own tabs, unmodified in substance (Holdings gained a Cost Basis input column and the rebalancing-assistant badges; Risk gained the 5 new extended-risk cards alongside the original concentration/sector/beta badges). Permanent labels — "Institutional Portfolio Manager / Educational / Deterministic / Data Driven" — shown near the header. Deep-linking via `?portfolioId=` (mirrors `StockResearch.tsx`'s own `?symbol=` precedent).

### 3.5 Integrations
- **Institutional Home** — a new `portfolio-summary` widget (reuses `GET /portfolio-construction/portfolios` directly), auto-reconciled into existing workspaces the same way `watchlist-summary` was in Phase 12.
- **Command Palette** — a new "Portfolios" group, deep-linking to a specific portfolio via `?portfolioId=`.
- **Institutional Mentor** — a new "Institutional Portfolio Manager Review" section (plain portfolio/holding counts, zero new scoring), mirroring the existing Watchlist Review section exactly.
- **Learning Centre Glossary** — 4 new `portfolio`-category terms (Portfolio Diversification Score, Cash Allocation (Portfolio), Growth vs. Value Mix, Rebalancing Assistant).
- **Operations Dashboard** — deliberately **not** touched. That page's scope is live-market-operations/broker-reconciliation health (Phase 11), which has no natural touchpoint with a target-allocation portfolio construction tool; forcing an integration there would have been a low-value, artificial addition.

## 4. Safety invariants

- Advisory/education only — this module never previews, schedules, or submits any order, and never touches a real brokerage account (same discipline as the Watchlist and the existing Portfolio Construction Engine).
- Never-fabricate discipline: Country and Currency exposure are always honestly `available: false` with an explicit reason — no provider in this codebase models either dimension. Performance figures are honestly `null` whenever `avgCostBasis`/`shares` weren't entered.
- Zero LLM calls anywhere in this module.
- Every score is either a direct reuse of an existing, already-tested engine's output, or a disclosed, simple, new formula (Diversification Score's Herfindahl-Hirschman Index; the extended risk dimensions' banding) — never a black-box judgment.

## Cross-references

- `docs/Portfolio-Scoring.md` — the Quality/Capital-Allocation/Diversification scoring methodology.
- `docs/Portfolio-Risk-Framework.md` — the full risk framework, including the 5 new extended dimensions.
- `docs/Institutional-Investing-Engine.md` — Engine 1's own consolidation report (Phase 12), the foundation this phase composes on top of.
