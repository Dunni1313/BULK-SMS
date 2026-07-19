# Institutional Opportunity Discovery Engine

**Phase 15 — Institutional Opportunity Discovery Engine.** This document describes the platform's Opportunity Discovery scanner — a deterministic orchestration layer that scans a symbol universe and ranks/buckets opportunities using every already-existing Institutional Investing engine.

**A repository audit was performed before any code was written.** It confirmed the platform already had every scoring/valuation building block needed (Business Quality, Investment Quality, Competitive Advantage, Financial Strength, Financial Ratios, Graham/DCF/Buffett valuation, the consolidated Margin of Safety, Tom Nash's conviction score, the Investment Committee's verdict, and the Institutional Decision Engine's own synthesis score/recommendation, Phase 14), plus two real, already-known symbol lists (`INVESTING_UNIVERSE`, `SECTOR_PEER_UNIVERSE`) and a proven "re-express a full report as a compact ranking row" pattern (`summaryFromReport()`, the existing `/value-universe` scanner). What did **not** exist was any multi-symbol scan-and-rank orchestrator, a screener, a ranking/bucketing layer, or Saved Screens persistence. This phase's job was to build only those genuine gaps.

---

## 1. What already existed (unmodified this phase)

| Capability | Module | Notes |
|---|---|---|
| Business Quality / Investment Quality / Competitive Advantage / Financial Strength / Financial Ratios | Existing Phase 2 modules | Reused directly off `ValueResearchReport` — never recomputed |
| Graham / DCF / Buffett valuation + consolidated Margin of Safety | `lib/marginOfSafety.ts` | Reused directly |
| Tom Nash conviction score | `lib/tomNashEngine.ts` | Reused directly |
| Investment Committee verdict | `lib/investmentCommittee.ts` | Reused directly |
| Decision Engine synthesis score / recommendation | `lib/decisionEngine.ts` (Phase 14) → exported `decisionSynthesisScore()`/`deriveRecommendation()` | The scanner's own ranking number — reused verbatim, never recomputed |
| Scan universe symbols | `lib/investingUniverse.ts` (`INVESTING_UNIVERSE`), `lib/industryPeers.ts` (`SECTOR_PEER_UNIVERSE`, ~63 symbols/11 sectors) | Unioned, deduplicated — no new symbol list invented |
| "Report → compact ranking row" pattern | `routes/stockAnalyst.ts` → `summaryFromReport()` | Precedent extended with the newer Phase 12-14 fields |
| Watchlist add | `POST /value-watchlist` | Reused directly for the "Add to Watchlist" one-click action |
| Portfolio Fit | Decision Engine's own `?portfolioId=` context | Reused via deep link for "Compare to Portfolio" — no new comparison logic |
| Research Notes, Historical Financials, Auth, Caching, Monitoring | Existing, unmodified | Reused as-is |

None of these were rewritten or duplicated. `lib/opportunityDiscovery.ts` composes on top of them.

## 2. Genuine gaps identified and built this phase

- **A multi-symbol scan orchestrator** — nothing previously built N reports and turned them into a filterable, sortable list.
- **A Screener** — 17 named filter dimensions over already-computed fields.
- **A ranking system** with a deterministic, per-row "why it ranks here" explanation.
- **Ten named Opportunity Buckets** (Top Opportunities, Undervalued, High Quality, Wide Moat, Dividend, Growth, Deep Value, Turnaround Candidates, Watchlist Candidates, Portfolio Upgrade Candidates), each a disclosed threshold/set rule.
- **A Comparison View** highlighting the best already-computed value per dimension across a small, user-selected set of symbols.
- **Saved Screens persistence** — no filter-criteria table existed.

## 3. What this phase built

### 3.1 `lib/opportunityDiscovery.ts` — the core composition module
Pure functions, zero new provider calls beyond resolving each symbol's `Fundamentals` once (reused into `buildValueResearchReport()`'s `fundamentalsOverride` seam, so no duplicate fetch): `getOpportunityScanUniverse()`, `buildOpportunityRow()`, `scanOpportunities()`, `applyScreenerFilters()`, `rankOpportunities()`, `bucketOpportunities()`, `compareOpportunities()`.

**Cost control, per the established on-demand-for-heavier-operations discipline (Phase 2 Sprints 19-20, the Cross-Engine Daily Report):** scanning up to ~70 symbols is real work, so it's always an explicit "Run Scan" action, never eager on page load. Each scanned symbol's recommendation is computed **without Management Quality or portfolio context** (an honestly-marked-unavailable placeholder is passed to `decisionSynthesisScore()`) — running an EDGAR filing fetch per scanned symbol would be prohibitively expensive; a user who wants the full picture opens the existing Decision Engine page for that one symbol (the "Analyse" one-click action).

### 3.2 New database object
- `investing_saved_screens` — per-user, explicit-save-only Screener filter criteria (never scan results — those are always recomputed fresh).

### 3.3 New routes (`routes/opportunityDiscovery.ts`)
- `POST /opportunity-discovery/scan` — the scan orchestrator, with optional `filters`, `watchlistAware`, and `portfolioId`.
- `GET /opportunity-discovery/compare?symbols=A,B,C` — a lightweight comparison over a small, hand-picked set (no full-universe scan).
- `GET`/`POST /opportunity-discovery/saved-screens`, `PATCH`/`DELETE /opportunity-discovery/saved-screens/:id`.

### 3.4 UI — new `OpportunityDiscovery.tsx` page at `/opportunity-discovery`
Tabs: Opportunities (the 10 buckets) / Top Rankings / Comparison View / Saved Screens, plus an always-visible Screener form. Permanent labels — "Institutional Opportunity Discovery / Educational / Deterministic / Evidence Based." One-click "Analyse" (deep link to Decision Engine), "Add to Watchlist" (direct reuse of `POST /value-watchlist`), and watchlist/portfolio-aware bucket context toggles.

### 3.5 Integrations
- **Institutional Home** — a new `opportunity-discovery` widget (navigation aid only, zero new data fetch — the scan itself stays on-demand behind its own page).
- **Institutional Mentor** — a new "Opportunity Discovery Review" section (plain saved-screen counts, zero new scoring), mirroring the Watchlist/Portfolio/Decision Engine Review sections exactly.
- **Learning Centre Glossary** — 4 new `value-investing`-category terms.
- **Command Palette / Global Search / Navigation** — automatically covered by adding "Opportunity Discovery" to the single shared `NAV_ITEMS` source (`lib/nav-items.ts`).

## 4. Safety invariants

- Advisory/education only — never previews, schedules, or submits any order, never touches a real brokerage account.
- Never-fabricate discipline: the Country filter is accepted but always reported `unavailableFilters: ["country"]`, never silently applied or approximated — no provider (SIMULATED or LIVE) supplies a country field anywhere in this codebase.
- Zero LLM calls, zero price forecasting, zero probability guessing.
- Every ranked/bucketed number is either a direct reuse of an existing, already-tested engine's output, or a disclosed reuse of the Decision Engine's own synthesis score — never a new valuation/quality/ratio formula.

## Cross-references

- `docs/Institutional-Screener.md` — the full 17-filter-dimension specification.
- `docs/Ranking-Methodology.md` — the ranking/bucketing rules in full detail.
- `docs/Institutional-Decision-Engine.md` — Phase 14's own module, reused here for the synthesis score and recommendation.
- `docs/Institutional-Investing-Engine.md` — Engine 1's own consolidation report (Phase 12), the foundation this phase composes on top of.
