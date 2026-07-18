# Institutional Investing Engine

**Phase 12 — Institutional Investing Engine Consolidation & Integration.** This document describes the platform's Institutional Investing Engine ("Engine 1") as it exists after this phase — a mature, pre-existing analysis system (built across an earlier documentation thread's Phase 2, Sprints 11–31) that this phase treats as **canonical**, plus the genuinely new pieces this phase added on top of it.

**No second Institutional Investing Engine was built.** A repository audit performed before any code was written confirmed a complete, tested, production engine already existed — this phase's entire brief was to consolidate, modernise, and integrate it, never to duplicate its business logic, valuation models, quality scoring, or watchlists.

---

## 1. What already existed (unmodified this phase)

| Capability | Module | Notes |
|---|---|---|
| Fundamentals / financial data | `lib/fundamentals.ts` | SIMULATED-first, live FMP/Alpha Vantage optional |
| Financial Ratios | `lib/financialRatios.ts` | P/E, EV/EBITDA, FCF Yield, liquidity/leverage ratios |
| Business Quality Score | `lib/investmentQuality.ts` | 12-metric, 0-100 composite |
| Economic Moat | `lib/valueInvesting.ts` (`analyzeMoat`) | Wide/Medium/Narrow/None |
| Competitive Advantage | `lib/competitiveAdvantage.ts` | 11-dimension scoring |
| Management Quality | `lib/managementAnalysis.ts` | 9-dimension, 3 partially LLM-narrated (structural, never a character judgement of a named individual) |
| Graham / DCF / Buffett Valuation | `lib/grahamValuation.ts`, `lib/dcfValuation.ts`, `lib/buffettValuation.ts` | Three independent deterministic fair-value models |
| Consolidated Margin of Safety | `lib/marginOfSafety.ts` | Range/average/agreement across all 4 valuation models |
| Tom Nash Conviction Engine | `lib/tomNashEngine.ts` | 5-pillar composite conviction score + Buy/Hold/Wait |
| AI Investment Committee | `lib/investmentCommittee.ts` | Consolidates Graham/Buffett/Tom Nash's votes |
| Full Company Research Report | `lib/valueReport.ts` | 23-section `ValueResearchReport`, assembled eagerly |
| Financial Statements / Industry Comparison / Filings / Earnings | `lib/financialStatements` route, `lib/industryComparison.ts`, `lib/filingAnalysis.ts`, `lib/earningsAnalysis.ts` | On-demand, heavier tabs |
| Portfolio Construction | `lib/portfolioConstruction.ts` | Target-weight stock portfolios, distinct from the Options Income Engine's real trades-backed portfolio |
| Value Watchlist | `value_watchlist` table, routes in `routes/stockAnalyst.ts` | Per-user, per-symbol tracked names |
| Value Investing School | `lib/valueSchool.ts`, `ValueInvestingSchool.tsx` | Lessons + server-authoritative quiz bank |

None of these were rewritten, re-derived, or duplicated. Every new piece below reads from them; it never recomputes what they already compute.

## 2. What this phase added

### 2.1 Investment Thesis Generator (`lib/investmentThesisGenerator.ts`)
A deterministic, template-based composition over an already-built `ValueResearchReport`. **Zero LLM calls.** It never invents a new score, a new valuation, or a new buy/sell/price recommendation — every sentence is filled in from a field the report already computed (Business Quality, Moat, Competitive Advantage, Financial Strength, all 4 valuation models, the Consolidated Margin of Safety, Tom Nash, the Investment Committee, and the existing `risks[]`/strengths/weaknesses lists). Fetched on demand via `GET /stock-analyst/investment-thesis/:symbol` and rendered in a new "Investment Thesis" card on the Value Research page — the button reads "Generate Thesis," never "Get Recommendation."

### 2.2 Research Notes (`investing_research_notes` table, routes in `routes/stockAnalyst.ts`)
Free-text, per-user, per-symbol notes — the user's own durable record, never AI-generated, never tied to the watchlist by foreign key. `GET/POST /stock-analyst/research-notes[/:symbol]`, `PATCH/DELETE /stock-analyst/research-notes/:id`. Surfaced in a new "Research Notes" panel on the Value Research page.

### 2.3 Watchlist history/change-tracking
No new table was built for this. `stock_analysis_history` (Phase 1, Sprint 4) already stores a Business Quality/Moat/Financial Strength/Valuation/Margin-of-Safety/Decision snapshot on every research run. The Watchlist tab now filters that already-fetched history by each watchlisted symbol and shows up to 3 prior snapshots inline — zero new backend logic, zero new persistence.

### 2.4 Institutional Home widget
A new `watchlist-summary` widget on the Institutional Home / Personal Dashboard (Phase 10), reusing the existing `GET /value-watchlist` hook directly. A workspace saved before this widget existed is reconciled to include it automatically (visible by default), so no user needs to manually re-add it.

### 2.5 Command Palette / Global Search
A new "Watchlist" command group, reusing the existing watchlist hook, letting a user jump straight from ⌘K to any tracked company's Value Research page.

### 2.6 Institutional Mentor
A new "Long-Term Investing Watchlist Review" section — a plain, ownership-scoped read of the user's own watchlist rows (already-stored `currentDecision`/`marginOfSafetyTarget` fields), with a deterministic count-and-bucket summary sentence. Zero new scoring.

### 2.7 Learning Centre
`lib/glossary.ts` gained a new `value-investing` category with 18 terms (Margin of Safety, Intrinsic Value, Economic Moat, ROIC, Owner Earnings, Graham Number, DCF, Circle of Competence, Conviction Score, and more) — a genuine content gap this phase's audit found (zero prior value-investing terms existed). The Learning Centre's own Overview page already linked to Value Investing School before this phase (confirmed during the audit, not duplicated).

### 2.8 Permanent labels
`StockResearch.tsx` now always shows "Institutional Investing Engine / Educational / Deterministic / Data Driven" badges near the page header.

## 3. Safety invariants (unchanged, re-confirmed)

- No buy/sell recommendation is ever newly generated — the Investment Thesis restates the platform's own existing `ValueDecision`/Tom Nash/Investment Committee verdicts, never inventing a new one.
- No price prediction, ever, anywhere in this engine.
- No LLM calls in any Phase 12 code path (`investmentThesisGenerator.ts` is pure string templating).
- Every figure in the Investment Thesis and the Mentor's Watchlist Review traces back to an already-computed, already-tested value.

## Cross-references

- `docs/Financial-Metrics-Reference.md` — every financial metric Engine 1 computes, what it means, why it matters.
- `docs/Business-Quality-Scoring.md` — the Business Quality / Investment Quality scoring methodology.
