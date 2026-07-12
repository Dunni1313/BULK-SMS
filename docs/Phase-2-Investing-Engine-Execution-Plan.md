# Phase 2 — Institutional Investment Decision Engine: Engineering Roadmap
**DK AI Institutional Investing & Trading OS**
**Status:** Approved, with an approved scope expansion (see §0.1) following Sprint 12's completion. Sprints 11–17 are shipped; Sprint 18 onward is planning only until each sprint's own pre-implementation plan is separately approved. This document is grounded in direct inspection of the actual repository (every file path, function signature, and code behavior cited below was read from source, not inferred) plus `docs/DK-AI-OS-Architecture-Blueprint.md` and `docs/DK-Option-Engine-Technical-Audit.md`.

**Approval:** Approved by the project owner following presentation of this roadmap. Each sprint (the first Phase 2 sprint was Sprint 11) requires a separate, explicit go-ahead per the established per-sprint process (see `CLAUDE.md` §3) before implementation begins.

**Engine renamed:** originally "Institutional Investing Engine," expanded and renamed to **Institutional Investment Decision Engine** per the approved scope expansion in §0.1 — same Phase 2, same engine, broadened mandate (named-analyst engines plus a multi-analyst committee synthesis, not just company research and valuation).

---

## 0. Correction to the existing Blueprint doc

The Blueprint (`docs/DK-AI-OS-Architecture-Blueprint.md` §2.2) tags **Economic Moat Analysis** and **Quality Score** as 🔴 NEW ("no equivalent found"). Direct inspection of `artifacts/api-server/src/lib/valueInvesting.ts` shows both already exist and are reasonably built:

- `analyzeMoat()` — full `MoatRating` (Wide/Medium/Narrow/None), 6 scored moat-source candidates (switching cost, network effect, brand+IP, scale, pricing power, distribution), a composite score, and a `durabilityYears` estimate.
- `analyzeBusinessQuality()` — the "Quality Score": a 0–100 composite (ROIC/ROE/margin/consistency/growth/qualitative blend) with `Wonderful/Good/Average/Weak` tiers.
- **Margin of Safety** also already exists as part of the blended `analyzeValuation()` — not a separate module today, but the math (`(fairValue - price) / fairValue`, High/Medium/Low/None labels) is already written and unit-tested.

Net effect: these three are 🟡 **ENHANCE**, not 🔴 NEW. This *reduces* Phase 2's genuinely-new surface area versus what the Blueprint implied — the real net-new work concentrates in Management Quality Analysis, Annual Report Analysis, Industry Comparison, Portfolio Construction, Financial Statement Analysis (full line items), and Risk Analysis (equity-specific).

The other correction worth flagging: what the audit calls "Valuation Models (DCF, Graham, Buffett)" is actually **one blended heuristic** (`analyzeValuation()` — an earnings-multiple method + an FCF-yield method, averaged). There is no discounted-cash-flow projection, no Graham Number, and no owner-earnings model anywhere in the code today. Splitting these into three explicitly named, swappable models (as the Blueprint itself calls for) is real, non-trivial work — it just isn't as far along as "Valuation ✅ Built" suggests.

---

## 0.1 Scope expansion (post-Sprint-12): Tom Nash Engine + AI Investment Committee

**Added after Sprint 12 (Graham Valuation) shipped, at the project owner's explicit direction. This is an addition to the approved roadmap, not a revision of anything already built — Sprint 12's implementation is unchanged.**

The engine's mandate is expanded from "company research + named valuation models" to a genuine **multi-analyst investment decision engine**: alongside the Graham (Sprint 12, done) and Buffett (Sprint 14) valuation engines, a third named analyst — a **Tom Nash Engine** — and a synthesis layer — an **AI Investment Committee** — are added. The document title reflects this: **Institutional Investing Engine → Institutional Investment Decision Engine**.

**Why this fits the existing architecture without redesign:** Graham and Buffett already establish the pattern every analyst in this engine follows — a pure function over the provider-agnostic `Fundamentals` object, producing a `{available, ..., marginOfSafety/conviction, rating/verdict, summary}`-shaped result, folded into the same `ValueResearchReport` and the same `stockAnalysisHistoryTable.valueResearchJson` persistence. Tom Nash and the Committee extend this pattern rather than inventing a new one — see §1.17–1.18 for the full mapping.

**What's genuinely new vs. reused:** Of Tom Nash's 12 listed capabilities, roughly half reuse existing analyzers directly (business quality, growth, balance sheet strength, cash-flow quality) or reuse the existing verdict/conviction shape (conviction score, Buy/Hold/Wait recommendation). The other half is genuinely new and data-dependent (capital allocation/buybacks, insider ownership, sector/macro context, interest-rate sensitivity, AI/tech-cycle analysis, probability-based scoring) — see §1.17 for exactly which is which. Because of this split, **Tom Nash is built in three sprints, not one**: a Core sprint (15) that ships everything already reusable plus a first-pass probability/conviction framework, and two later Enhancement sprints (23, 25) sequenced right after the sprints that produce the data those specific features actually need (filing ingestion, management analysis, industry/sector data) — this is what "maximising reuse of existing code" means concretely: land the reusable 60% immediately after Buffett, don't fake the other 40% with stub data just to ship it in one sprint.

**The AI Investment Committee (Sprint 17, Core; refined in Sprint 26)** is a synthesis layer, not a fourth analyst: it takes Graham's, Buffett's, and Tom Nash's independently-computed verdicts and combines them into one consolidated recommendation + confidence score. It ships right after Tom Nash's Core sprint (v1, combining whatever each analyst can produce at that point) and is revisited once Tom Nash's Enhancement sprints deepen its inputs — the Committee's own aggregation logic doesn't need to change when an input analyst gets richer, only the confidence weighting might.

**New owner decisions this expansion introduces** (see §2, items 6–9): the Committee's aggregation methodology, the concrete definition of Tom Nash's "probability-based scoring," the macro/interest-rate data sourcing approach, and the insider-ownership/buyback data provider.

---

## 1. Module-by-module mapping

Legend: 🟢 MOVE · 🟡 ENHANCE · 🔴 NEW

### 1.1 Company Research 🟡

| | |
|---|---|
| **Existing code reusable** | `routes/stockAnalyst.ts` (all endpoints), `lib/valueReport.ts`'s `buildValueResearchReport()` (15-section assembler), `StockResearch.tsx`/`StockScanner.tsx` (999 + 467 lines, both wired into nav, both tested), `stockAnalysisHistoryTable` persistence pattern |
| **New components required** | This module is the *umbrella* — it doesn't need new logic of its own, but its report assembler needs to grow new sections as later sprints land (valuation-model breakdown, Tom Nash analysis, Investment Committee synthesis, statement analysis, management analysis, earnings analysis) |
| **DB changes** | None directly — consumes the other modules' persisted data via `valueResearchJson` |
| **External data providers** | None new — inherits whatever the sub-modules need |
| **AI capabilities** | Already has `narrateValueResearch`/`narrateValueResearchStream` (anti-impersonation + `VALUE_DISCLAIMER` enforced) — extend, don't replace |
| **UI pages** | `StockResearch.tsx` — extend with new report sections as they land; no new page |
| **APIs required** | `POST /stock-analyst/value-research` and `/value-research/stream` already exist — response shape grows |
| **Complexity** | Low (integration only, once sub-modules exist) |
| **Dependencies** | Financial Statement Analysis, Financial Ratio Analysis, all 3 Valuation modules + Margin of Safety, Moat, Management Quality, Earnings Analysis, Annual Report Analysis, Tom Nash Investment Engine, AI Investment Committee |

### 1.2 Financial Statement Analysis 🟡

| | |
|---|---|
| **Existing code reusable** | `fundamentals.ts`'s provider seam (`FundamentalsProvider`, `resolveFundamentals`, live/simulated honesty contract, 15-min cache, freshness tracking) — the *pattern* is exactly right, it's the *data depth* that's shallow today |
| **New components required** | A structured multi-year statement layer: full Income Statement, Balance Sheet, Cash Flow Statement line items (not just the ~20 derived ratios/per-share fields `Fundamentals` carries today). New `FmpFundamentalsProvider`/`AlphaVantageFundamentalsProvider` calls to their `/income-statement`, `/balance-sheet-statement`, `/cash-flow-statement` endpoints (FMP) and `INCOME_STATEMENT`/`BALANCE_SHEET`/`CASH_FLOW` (AV, already partially called for `fcfPositiveYears` — extend to keep full line items) |
| **DB changes** | None required if cached in-process like fundamentals today; optionally persist snapshots alongside `stock_analysis_history` JSON (no schema migration) |
| **External data providers** | FMP/Alpha Vantage — **already wired**, just needs additional endpoint calls on existing keys |
| **AI capabilities** | Statement-trend narration (new, thin wrapper over `ai-core`'s `narrate()`) |
| **UI pages** | New "Financial Statements" tab/section inside `StockResearch.tsx`'s `ReportView` (3 sub-tabs: Income/Balance Sheet/Cash Flow, using existing `revenueHistory`/`epsHistory`/`fcfHistory` chart pattern already in the Fundamentals type) |
| **APIs required** | New `GET /stock-analyst/statements/:symbol` |
| **Complexity** | Medium — mechanical provider-call expansion, but real HTTP schema-mapping work, and FMP/AV rate limits become a real constraint here |
| **Dependencies** | None (foundational — DCF and Ratio Analysis benefit from it but can bootstrap off existing history arrays without waiting) |

### 1.3 DCF Valuation 🔴

| | |
|---|---|
| **Existing code reusable** | `Fundamentals.fcfPerShare`, `.revenueHistory`/`.epsHistory`/`.fcfHistory` (6-year arrays, **already computed today** — `backHistory()` in `fundamentals.ts`), `analyzeValuation()`'s FCF-yield method as a starting point for terminal-value logic, `VALUE_DISCLAIMER`/`LIVE_VALUE_DISCLAIMER` split |
| **New components required** | A genuine multi-year DCF engine: N-year FCF projection (growth-rate decay curve), discount rate (WACC proxy or a settings-configurable required return), terminal value (Gordon growth or exit-multiple), sum-of-discounted-cashflows → intrinsic value/share. None of this exists today — `analyzeValuation()` is a single-year yield-cap heuristic, not a DCF |
| **DB changes** | None (fits inside `valueResearchJson`) |
| **External data providers** | None new — uses existing Fundamentals fields |
| **AI capabilities** | Narrate assumptions/sensitivity in plain English (new, thin `ai-core` wrapper) |
| **UI pages** | New "DCF Valuation" card in `ReportView`, with an assumptions panel (growth rate, discount rate, terminal multiple — user-adjustable, mirrors the existing Beginner/Advanced toggle pattern) |
| **APIs required** | Folds into `POST /stock-analyst/value-research` response; optionally a dedicated `POST /stock-analyst/dcf` for what-if recalculation without a full report rebuild |
| **Complexity** | Medium-High — the actual net-new quantitative model in the valuation cluster |
| **Dependencies** | Financial Statement Analysis (nice-to-have, not blocking — can launch off existing history arrays) |

### 1.4 Graham Valuation 🔴

| | |
|---|---|
| **Existing code reusable** | `Fundamentals.epsTtm`, `.bookPerShare` — both already fetched/computed today, which is all the classic Graham Number needs |
| **New components required** | Graham Number (`√(22.5 × EPS × BVPS)`) and/or Graham's growth formula (`V = EPS × (8.5 + 2g) × 4.4/Y`) — neither exists today. Cheapest, most self-contained of the three valuation builds — no new data, no projection engine, pure formula |
| **DB changes** | None |
| **External data providers** | None new |
| **AI capabilities** | Optional short narration ("why Graham's conservative screen says X") |
| **UI pages** | New "Graham Valuation" card in `ReportView` |
| **APIs required** | Folds into existing `value-research` response |
| **Complexity** | Low — best first win in the valuation cluster, do it first to prove the "3 named models" pattern cheaply |
| **Dependencies** | None |

### 1.5 Buffett Valuation 🟡

| | |
|---|---|
| **Existing code reusable** | `analyzeValuation()`'s FCF-yield method is the closest existing analogue and should become the seed of this model, not be discarded |
| **New components required** | A true owner-earnings adjustment (net income + D&A − maintenance capex − ΔNWC, not raw `fcfPerShare`) and a quality/moat-adjusted required-return (Buffett's approach ties the discount rate to business quality, not a flat WACC) |
| **DB changes** | None |
| **External data providers** | None new (owner-earnings needs D&A/capex/NWC — available from Sprint 19's fuller statement data; can approximate off existing FCF fields in the interim) |
| **AI capabilities** | Narration reusing the existing `enforceValueSafety`/anti-impersonation pattern (already built specifically because this model is Buffett-flavored) |
| **UI pages** | New "Buffett Valuation (Owner Earnings)" card in `ReportView` |
| **APIs required** | Folds into `value-research` |
| **Complexity** | Medium |
| **Dependencies** | Financial Statement Analysis (for a real maintenance-capex split; degrades gracefully to the current FCF proxy without it) |

### 1.6 Margin of Safety 🟡

| | |
|---|---|
| **Existing code reusable** | The `(fairValue-price)/fairValue` math and High/Medium/Low/None labeling already exist inside `analyzeValuation()` |
| **New components required** | Once 3+ separate fair-value models exist, MoS needs to become a **cross-model** view: per-model MoS, a consolidated range (min/max/average fair value across models), and a "models agree/disagree" signal — none of this multi-model consolidation exists today (today there's exactly one blended fair value) |
| **DB changes** | None |
| **External data providers** | None |
| **AI capabilities** | None beyond existing disclaimer enforcement |
| **UI pages** | Consolidated "Margin of Safety" summary card sitting above the 3 individual valuation cards in `ReportView` |
| **APIs required** | Folds into `value-research` |
| **Complexity** | Low-Medium (mostly aggregation logic) |
| **Dependencies** | DCF, Graham, Buffett Valuation (needs all three to exist first) |

### 1.7 Economic Moat Analysis 🟡

| | |
|---|---|
| **Existing code reusable** | `analyzeMoat()` — fully working today (see §0) |
| **New components required** | `durabilityYears` is currently a static lookup (15/10/6/2 by rating tier) — replace with a signal derived from real data (ROIC persistence over the statement-history years from Sprint 19, or moat-source count trend). Qualitative sourcing could deepen using Sprint 22/23's filing-text extraction (e.g., detect actual moat language in the 10-K's Business/MD&A sections) |
| **DB changes** | None |
| **External data providers** | None new |
| **AI capabilities** | Optional: LLM-assisted qualitative moat commentary sourced from filing text (ties to Sprint 22) |
| **UI pages** | Existing moat card in `ReportView` — enhance, don't rebuild |
| **APIs required** | None new |
| **Complexity** | Low-Medium (enhancement, not a build) |
| **Dependencies** | Financial Statement Analysis (for ROIC-persistence signal), Annual Report Analysis (optional, for filing-sourced qualitative signal) |

### 1.8 Management Quality Analysis 🔴

| | |
|---|---|
| **Existing code reusable** | `ai-core`'s `complete()`/`narrate()` primitives, the `enforceValueSafety`/anti-impersonation pattern as a template for a new persona-safety wrapper (this module will discuss real named executives — the highest compliance-risk surface in Engine 1) |
| **New components required** | Everything — no equivalent exists. Needs: filing/transcript text (from Annual Report Analysis, Sprint 22), an extraction+summarization pipeline (capital-allocation track record, insider ownership/buying-selling patterns if available, tenure, compensation-alignment signals), and LLM-assisted qualitative synthesis with a hard anti-fabrication/anti-defamation guard (never assert facts about a named individual the source text doesn't support) |
| **DB changes** | New table or fold into a new `investing_filing_analysis` table (see Portfolio Construction/Annual Report Analysis section) |
| **External data providers** | SEC EDGAR (free, 10-K/10-Q text — proxy statements for compensation/ownership data too) |
| **AI capabilities** | Heaviest AI lift in Engine 1 — multi-step extraction + synthesis, new disclaimer variant, new anti-impersonation-style guard scoped to "don't fabricate claims about a real executive" |
| **UI pages** | New "Management" tab in `ReportView` |
| **APIs required** | New `GET /stock-analyst/management/:symbol` |
| **Complexity** | High — real compliance risk (discussing real people), real engineering novelty (long-document synthesis) |
| **Dependencies** | Annual Report Analysis (shares filing-ingestion infrastructure) |

### 1.9 Industry Comparison 🔴

| | |
|---|---|
| **Existing code reusable** | `StockScanner.tsx`'s existing compare-dialog UI (side-by-side metric table for up to 2 symbols) is structurally the same UI shape needed here, just scoped to 2 arbitrary symbols instead of a sector-defined peer group |
| **New components required** | Sector/industry taxonomy (FMP's `/profile` endpoint — already being called by `FmpFundamentalsProvider` — very likely already returns `sector`/`industry` fields today that are simply not being parsed/kept; verify and capture before adding any new provider call), a peer-group definition (static config to start), peer-relative ratio comparison (percentile rank within group) |
| **DB changes** | None if peer groups are static config; a new table only if user-customizable peer sets are wanted (deferred scope question, see §2) |
| **External data providers** | None new if the `sector`/`industry` fields are already present in the existing FMP response and just being dropped — verify this first, it may be a zero-new-provider-call win |
| **AI capabilities** | Peer-comparison narration (new, thin wrapper) |
| **UI pages** | New "Industry Comparison" section/page, extends `StockScanner.tsx`'s compare pattern to N-symbol peer tables |
| **APIs required** | New `GET /stock-analyst/industry/:symbol` |
| **Complexity** | Medium |
| **Dependencies** | Financial Ratio Analysis (the comparison is ratio-vs-peer-group) |

### 1.10 Financial Ratio Analysis 🟡

| | |
|---|---|
| **Existing code reusable** | `valueReport.ts`'s 14 `keyMetrics` (P/E, PEG, P/S, P/B, FCF yield, dividend yield, ROIC, ROE, net margin, 5y growth ×2, D/E, interest coverage) — already computed today, just presented as a flat list, not a dedicated analytical section |
| **New components required** | Expand the ratio set (quick ratio, asset turnover, ROA, payout ratio, EV/EBITDA), multi-year trend charts (reuses `revenueHistory`/`epsHistory`/`fcfHistory` chart pattern already in the codebase) |
| **DB changes** | None |
| **External data providers** | None new for the expanded ratios computable from existing Fundamentals fields; a few (EV/EBITDA) need Sprint 19's fuller statement data |
| **AI capabilities** | Optional trend commentary |
| **UI pages** | New dedicated "Ratios" tab in `ReportView` (today it's a flat metrics grid — this makes it a first-class analytical surface with trend charts) |
| **APIs required** | Folds into existing `value-research` response |
| **Complexity** | Low — mostly presentation + a handful of new formulas over data already fetched |
| **Dependencies** | Financial Statement Analysis (for EV/EBITDA and a few statement-derived ratios only) |

### 1.11 Portfolio Construction 🔴

| | |
|---|---|
| **Existing code reusable** | The `settings`/`value_watchlist` per-user-table pattern (schema shape, `getScopedUserId` scoping, insert/update/delete idiom) as the exact template; `portfolioHealth.ts`'s architecture (banded pure scorers → weighted composite → hard-cap overrides) as a scoring template, not its options-specific code |
| **New components required** | Everything — no equity holdings/allocation model exists (the `trades` table is options-positions-only, and per the Blueprint, unifying it into one instrument-agnostic Portfolio DB is Phase 5 work, not now). Needs: a `investing_portfolios` + `investing_holdings` table pair, an allocation/rebalancing engine (target-weight vs. actual-weight drift, simple mean-variance or equal-weight/risk-parity constructor as a first version), and a UI to build/edit a target portfolio from Watchlist candidates |
| **DB changes** | New tables: `investing_portfolios` (id, userId FK, name, description, createdAt/updatedAt) and `investing_holdings` (id, portfolioId FK, symbol, shares, costBasis, targetWeightPct, addedAt) — both follow the Phase 1 `userId`/FK/index convention exactly |
| **External data providers** | None new (uses existing Fundamentals/price data) |
| **AI capabilities** | Allocation-rationale narration (new) |
| **UI pages** | New "Portfolio Construction" page, sourcing candidates from Watchlist |
| **APIs required** | New `investing/portfolios` CRUD route file (mirrors `stockAnalyst.ts`'s watchlist CRUD pattern almost verbatim) |
| **Complexity** | Medium-High (new domain: allocation/optimization math is genuinely new, even if the CRUD scaffolding is copy-paste) |
| **Dependencies** | Watchlists (candidate source), Risk Analysis (constraints feed back in) |

### 1.12 Watchlists 🟢

| | |
|---|---|
| **Existing code reusable** | Fully built — `valueWatchlistTable`, full CRUD in `stockAnalyst.ts` (`GET/POST /value-watchlist`, `PATCH/DELETE /value-watchlist/:id`), tenant-isolation tested |
| **New components required** | Minor polish only: bulk-add from Industry Comparison/Scanner results, threshold alerts (price crosses `desiredBuyPrice`, or MoS crosses `marginOfSafetyTarget`) — the alerting piece needs the Notification Service, which is 🔴 NEW at the *platform* layer (Blueprint Phase 5), so full alerting is out of Phase 2's reach; a Phase-2-scoped version could just surface "target met" as a UI badge without push/email delivery |
| **DB changes** | None required for the UI-badge version |
| **External data providers** | None |
| **AI capabilities** | None new |
| **UI pages** | Existing watchlist tab in `StockResearch.tsx` — minor additions only |
| **APIs required** | None new for the UI-badge version |
| **Complexity** | Low |
| **Dependencies** | None (feeds Portfolio Construction) |

### 1.13 AI Investment Analyst 🟡

| | |
|---|---|
| **Existing code reusable** | `lib/ai-core` (Sprint 9's full extraction — `narrate`/`narrateStream`/`complete`/`completeStream`, cache/single-flight/timeout, provider detection), `coachLLM.ts` as the exact template for a thin domain layer, `routes/ai.ts`'s existing intent-detection pattern (auto-routes "teaching intent" into coach narration — the Blueprint explicitly flags this as reusable for cross-module routing), `valueSchool.ts`'s education-focused Q&A as the base to extend |
| **New components required** | An **open-ended** research mode (today's Value School only answers from a fixed 7-lesson/9-question bank) — free-form question-answering over a symbol's assembled report data, reusing `narrateFreeform` (already exists in `coachLLM.ts` for the options coach — needs an investing-domain equivalent) |
| **DB changes** | None |
| **External data providers** | None new |
| **AI capabilities** | The module *is* the AI capability — new system prompt, new disclaimer variant if needed, reuses `ai-core` primitives directly |
| **UI pages** | New "Ask the Analyst" panel in `StockResearch.tsx`, or a dedicated chat surface |
| **APIs required** | New `POST /stock-analyst/ask` (+ stream variant) |
| **Complexity** | Medium (mostly prompt/context-assembly work over already-existing data, once other modules exist to answer questions about) |
| **Dependencies** | Benefits from every other module existing first (more data to answer questions about) but can ship an MVP against just the existing report today |

### 1.14 Earnings Analysis 🔴

| | |
|---|---|
| **Existing code reusable** | None, despite the name collision — `lib/earnings.ts` is a fully options-specific IV-crush strategy selector (picks iron-fly/condor/calendar based on IV rank vs. historical move), zero overlap with "investing" earnings analysis (EPS/revenue beat-miss history, guidance tracking). Only the *pure/deterministic-function* coding style is worth carrying over |
| **New components required** | Everything: historical EPS/revenue actual-vs-estimate + surprise%, guidance direction (raised/lowered/maintained), a trend view across recent quarters |
| **DB changes** | None if computed live + cached in-process (like fundamentals' 15-min cache) rather than persisted — recommended for MVP to avoid DB churn |
| **External data providers** | FMP has an earnings-surprises endpoint; Alpha Vantage has `EARNINGS`; both are on **already-configured** keys |
| **AI capabilities** | Trend/guidance narration (new, thin wrapper) |
| **UI pages** | New "Earnings" tab in `ReportView` |
| **APIs required** | New `GET /stock-analyst/earnings/:symbol` |
| **Complexity** | Medium |
| **Dependencies** | None |

### 1.15 Annual Report Analysis 🔴

| | |
|---|---|
| **Existing code reusable** | `ai-core`'s `complete()` for chunked summarization, the disclaimer/safety pattern as a template |
| **New components required** | Everything, and this is Engine 1's own "long pole" (parallel to Engine 3's Order Flow in the Blueprint): a filing-ingestion pipeline (fetch 10-K/10-Q text), a chunking/section-extraction step (10-Ks run 50–150 pages — naive single-shot summarization will blow the LLM context window; needs to isolate MD&A, Risk Factors, Business Overview sections and summarize per-section before a final roll-up synthesis), and a persistence layer so filings aren't re-fetched/re-summarized every request |
| **DB changes** | New table: `investing_filing_analysis` (id, userId FK, symbol, filingType, filingDate, sourceUrl, sectionsJson, summaryJson, createdAt) — shared with Management Quality Analysis |
| **External data providers** | SEC EDGAR (free, full-text search + filing index API, US-listed only — a real scope limit, no international filings). Earnings-call transcripts are a **separate, paid** data source (10-Ks don't include call transcripts) — explicitly out of this module's MVP unless approved |
| **AI capabilities** | Multi-step: per-section summarization + final synthesis; heaviest token/cost usage in Engine 1 |
| **UI pages** | New "Annual Report" tab in `ReportView`, showing extracted sections + AI summary with source-quote links |
| **APIs required** | New `GET /stock-analyst/filings/:symbol`, `POST /stock-analyst/filings/:symbol/analyze` |
| **Complexity** | **Highest in Engine 1** — genuinely new engineering (document ingestion + chunked synthesis), external dependency outside engineering's direct control (EDGAR uptime/rate limits, and a real cost/vendor decision if transcripts are wanted) |
| **Dependencies** | None structurally, but Management Quality Analysis depends on it |

### 1.16 Risk Analysis 🔴

| | |
|---|---|
| **Existing code reusable** | `portfolioHealth.ts`'s architecture (banded pure scorers → weighted composite → hard-cap overrides → threat-bucket labels) is a strong template; its actual code is not reusable (Greeks/theta-specific) |
| **New components required** | An equity-portfolio risk scorer: concentration (per-holding and per-sector, HHI-style — same shape as `computeRiskConcentration`'s pattern), estimated beta (needs a benchmark correlation calc — new), simple drawdown/volatility estimate. Requires actual holdings to compute against |
| **DB changes** | New table: `investing_risk_snapshots` (id, userId FK, portfolioId FK, concentrationScore, sectorExposureJson, betaEstimate, createdAt) — mirrors `dailyReportsTable`'s snapshot-history pattern |
| **External data providers** | None new for a beta *estimate*; a real beta calc benefits from real historical price series (Polygon, already wired for the options engine, could be reused here — worth confirming it's licensed for equity price history use in Engine 1, not just options quotes) |
| **AI capabilities** | Risk-narrative commentary (new) |
| **UI pages** | New "Portfolio Risk" panel, likely inside the Portfolio Construction page |
| **APIs required** | New `GET /investing/portfolios/:id/risk` |
| **Complexity** | Medium-High |
| **Dependencies** | Portfolio Construction (needs real holdings to score) |

### 1.17 Tom Nash Investment Engine 🟡🔴 (mixed — see below)

Added in the §0.1 scope expansion. A third named analyst engine alongside Graham and Buffett, but broader in scope than either — it spans 12 listed capabilities, roughly half already reusable from existing analyzers, half genuinely new. Legend within this row: 🟡 = reuses an existing analyzer directly, 🔴 = no equivalent exists.

| | |
|---|---|
| **Existing code reusable** | 🟡 Business quality assessment — `analyzeBusinessQuality()` directly. 🟡 Revenue and earnings growth analysis — `Fundamentals.revenueGrowth5y`/`.epsGrowth5y`/`.revenueGrowthFwd`, the same fields Graham and the blended model already read. 🟡 Balance sheet strength — `analyzeFinancialStrength()` directly. 🟡 Cash flow quality — `Fundamentals.fcfPerShare`/`.fcfMargin`/`.fcfPositiveYears`, deepened once Financial Statement Analysis lands. 🟡 Conviction score / Buy-Hold-Wait recommendation — reuses the `verdict + conviction + rationale` shape `ValueDecision` already established, new vocabulary only. `classifyMarginOfSafety`/`FairValueMethod` pattern (Sprint 12) as the template for any quantitative sub-score. `ai-core` for the qualitative macro/tech-cycle narrative. |
| **New components required** | 🔴 Capital allocation analysis — needs buyback $ / share-count-trend data, not currently fetched by any provider call. 🔴 Share buybacks — same data gap; a "buyback yield" derived from historical shares-outstanding trend. 🔴 Insider ownership — needs proxy-statement-sourced ownership/insider-transaction data; ties directly to Management Quality Analysis's filing-ingestion pipeline (Sprint 23). 🔴 Sector & macro analysis — needs a sector/rate-regime context layer; ties to Industry Comparison (Sprint 20) for the sector half. 🔴 Interest rate sensitivity — a new duration-like classification (long-duration growth vs. value exposure) — no existing code, genuinely new quantitative framework. 🔴 AI/technology-cycle analysis — the most qualitative, LLM-narrated component, bounded by deterministic inputs (R&D intensity, revenue mix) rather than a hard formula. 🔴 Probability-based investment scoring — a new statistical framework; **no direct code reuse, only architectural inspiration** from the options engine's Ravish Score (a weighted composite of several signals into one number) — the actual definition of "probability" here is an open owner decision (see §2 item 7). |
| **DB changes** | None for the Core sprint (folds into `valueResearchJson` like every other analyst); the Enhancement sprints sourcing insider/buyback data may want a short-lived cache table if that data proves expensive/rate-limited to fetch (same pattern as fundamentals' 15-min live cache) — a decision for those sprints, not now |
| **External data providers** | FMP has an `/insider-trading` endpoint and historical shares-outstanding data (buyback proxy) — **unverified**, same Q9-style caveat as everything else in this roadmap. Macro/interest-rate data: no real feed currently wired anywhere in the codebase; `marketBriefing.ts`'s synthetic-proxy pattern (clearly SIMULATED-labeled) is the honest, zero-cost starting point rather than a new paid vendor — see §2 item 8 |
| **AI capabilities** | Second-heaviest AI lift in Engine 1 after Management Quality Analysis — sector/macro/tech-cycle commentary is a genuine narrative-synthesis task via `ai-core`, with the same anti-fabrication/disclaimer discipline; the probability score and conviction number themselves stay deterministic — the LLM narrates them, never invents them |
| **UI pages** | New "Tom Nash Analysis" tab in `ReportView`, with sub-cards for Growth & Quality, Capital Allocation, Macro & Cycle Context, and Probability & Conviction — broader than the single-card pattern Graham/Buffett use |
| **APIs required** | New `GET /stock-analyst/tom-nash/:symbol` — a dedicated endpoint rather than folding into `value-research`, so the core report stays fast while this heavier, multi-source analysis is fetched separately |
| **Complexity** | **High** — the broadest single module in Engine 1 alongside Annual Report Analysis; deliberately split across 3 sprints (Core + 2 Enhancements) specifically to manage that |
| **Dependencies** | Business Quality, Moat, Financial Strength (existing), Financial Statement Analysis, Industry Comparison (sector context), Annual Report Analysis + Management Quality Analysis (buyback/insider data) |

### 1.18 AI Investment Committee 🔴

Added in the §0.1 scope expansion. A synthesis layer, not a fourth analyst — combines Graham's, Buffett's, and Tom Nash's independently-computed outputs into one consolidated recommendation and confidence score.

| | |
|---|---|
| **Existing code reusable** | The `verdict + conviction/rating + rationale` shape every analyst (Graham, the blended/Buffett model, and Tom Nash) already produces is exactly the common contract a committee needs to aggregate over — no new per-analyst interface required. `ai-core`'s `narrate()` for the committee's synthesized written reasoning. The disclaimer/anti-fabrication pattern established since Sprint 12 |
| **New components required** | A committee-aggregation function taking 3 independent analyst outputs and producing one consolidated verdict + confidence score. Needs a defined, honest aggregation methodology — **a genuine owner decision, not something to decide unilaterally** (see §2 item 6): e.g. weighted-average confidence with verdict derived from it, vs. explicit majority/unanimous/split framing that surfaces disagreement rather than hiding it behind a fabricated consensus number |
| **DB changes** | None required — folds into the same persisted report JSON; optionally two denormalized columns (`committeeVerdict`, `committeeConfidence`) on `stockAnalysisHistoryTable` later for filtering/sorting history by committee outcome — deferred, optional, same pattern flagged for the valuation models in Sprint 12's own planning |
| **External data providers** | None new — a pure synthesis layer over already-computed analyst outputs |
| **AI capabilities** | The committee's "detailed reasoning" narrative is a natural `ai-core` synthesis task — turning 3 structured analyst outputs into coherent prose — with the same discipline as every other narration path: never claim agreement or disagreement the underlying numbers don't actually show |
| **UI pages** | New "Investment Committee" card in `ReportView` — a 3-column mini-summary (Graham / Buffett / Tom Nash verdicts) plus the consolidated verdict, confidence score, and expandable reasoning |
| **APIs required** | New `GET /stock-analyst/investment-committee/:symbol` — dedicated endpoint, mirroring Tom Nash's own pattern, so the core report stays fast |
| **Complexity** | Medium — the aggregation logic itself is bounded; the real complexity is ensuring the methodology is sound and honestly communicated, not raw engineering volume |
| **Dependencies** | Graham Valuation (done), Buffett Valuation (Sprint 14), Tom Nash Investment Engine — at least its Core sprint for a v1 Committee; richer confidence scoring benefits from Tom Nash's later Enhancement sprints too |

---

## 2. Cross-cutting decisions needing owner sign-off

Following the same pattern as Phase 1's "Outstanding owner decisions" — these are genuine forks, not things to be decided unilaterally. Items 1–5 predate the §0.1 scope expansion (1 is resolved/shipped in Sprint 11; the rest still apply to their respective future sprints); items 6–9 are new as of the scope expansion and must be resolved before Sprint 16 (Tom Nash Core) and Sprint 17 (Committee Core) begin.

1. ~~**Universe decoupling.**~~ **RESOLVED (Sprint 11).** Engine 1 now has its own symbol-agnostic simulated-price generator (`lib/investingUniverse.ts`), no longer depending on the options engine's internals.
2. **Annual Report Analysis data source.** Recommend SEC EDGAR (free, 10-K/10-Q text, US-listed only) for the MVP, with earnings-call transcripts explicitly deferred (separate paid vendor decision). **Needs owner OK** — this determines Sprint 22/23's scope and whether a paid vendor conversation happens now or later.
3. **Industry Comparison peer groups.** Recommend static, hardcoded peer-group config for MVP (fast, no new table) rather than user-customizable peer sets (needs a new table + UI). **Low-stakes, but worth confirming** since it's cheap to upgrade later if it should be done right the first time.
4. **Portfolio Construction's relationship to the future unified Portfolio DB.** The Blueprint's Phase 5 plan unifies stocks + options into one Portfolio DB. Building `investing_portfolios`/`investing_holdings` now (Phase 2) means a migration later (Phase 5) to fold them in. Recommend building it now anyway — Phase 2 shouldn't block on Phase 5 — but **flagging that this is a deliberate "build twice" tradeoff**, not an oversight.
5. **Live-data verification (carried over from the Blueprint's own top risk note).** The Blueprint's closing line says: *"re-verify the audit's Q9 finding (live data providers unverified) — it's the one open assumption everything else in this plan is built on top of."* Phase 2 leans on FMP/Alpha Vantage more heavily than any prior phase (Sprint 19's full statement calls, Sprint 25's earnings endpoints). This was flagged for Sprint 11 and **deferred, awaiting production API credentials** (per Sprint 11's completion report) — still open, still the one assumption the whole roadmap sits on top of.
6. **AI Investment Committee aggregation methodology (new).** How exactly should Graham's, Buffett's, and Tom Nash's independent verdicts combine into one recommendation + confidence score? Recommendation: an explicit agreement-aware approach — e.g. weighted-average confidence, with the verdict category derived from that average, **plus a visible "unanimous / majority / split" signal** when the three analysts disagree, rather than a single blended number that quietly papers over real disagreement. **Needs owner OK** — this is the Committee's entire reason for existing, not an implementation detail.
7. **Tom Nash "probability-based investment scoring" — concrete definition (new).** The requested capability is underspecified as given: probability of what, over what horizon (e.g., probability of a positive return over 3–5 years vs. probability of beating a benchmark vs. probability the Buy verdict resolves correctly in hindsight)? **Needs owner input before Sprint 16's own pre-implementation plan can be written in full detail** — flagged here at the roadmap level so it isn't quietly decided inside the sprint's implementation.
8. **Macro / interest-rate data sourcing for Tom Nash (new).** Recommend the same honest-SIMULATED-first pattern every other module in this engine already uses (à la `marketBriefing.ts`'s synthetic regime proxy) rather than a new paid macro-data vendor, at least for Sprint 16/26's initial versions. **Needs owner OK**, since a real live feed is a genuine cost/vendor decision, not just an engineering one.
9. **Insider ownership / share-buyback data provider (new).** FMP appears to expose relevant endpoints (`/insider-trading`, historical shares outstanding), but — consistent with every other provider claim in this roadmap — **this is unverified** and needs a real, live check when Sprint 24 (Tom Nash Enhancement I) is planned, not assumed to work from documentation alone.

---

## 3. Sprint breakdown

Continuing the numbering from Phase 1 (Sprint 10 was the last completed). Each sprint follows the established process: read plan section → present pre-implementation plan → wait for approval → implement exactly as approved → validate honestly → single commit → report → stop for approval before the next sprint.

### Sprint 11 — Universe Decoupling, Provider Verification & Engine 1 Settings
- **Objective:** Remove Engine 1's simulated-data dependency on the options engine's `UNIVERSE_SYMBOLS`/`optionsMath.getSnapshot`; add Engine 1-specific settings fields; live-verify FMP and Alpha Vantage end-to-end for real (per §2.5).
- **Deliverables:** A standalone Engine-1 simulated-price generator; new nullable/defaulted `settings` columns (`investingRiskFreeRate`, `investingDefaultDiscountRate`, `investingFilingsProvider`); a documented, real (non-mocked) live-fetch verification run against both FMP and Alpha Vantage with real keys.
- **Files likely to change:** New `lib/investingUniverse.ts` (or similar); `lib/fundamentals.ts` (swap the price source); `lib/db/src/schema/settings.ts`; new manual migration `006_investing_settings.sql`.
- **Tests required:** Unit tests proving Engine 1's simulated data no longer imports anything from `optionsMath.ts`; existing `value.test.ts`/`fundamentals-freshness.test.ts` pass unmodified in assertions.
- **Acceptance criteria:** Engine 1 can generate a report for a symbol outside the 10-name options universe in SIMULATED mode; live FMP/AV calls verified working end-to-end with real keys, documented with actual response samples (redacted of key values).
- **Rollback:** `git revert`; migration is purely additive/nullable, safe to leave or drop the 3 new columns.
- **Estimated effort:** Medium.

### Sprint 12 — Graham Valuation
- **Objective:** Add the first explicitly named, standalone valuation model.
- **Deliverables:** `analyzeGrahamValuation()` (Graham Number and/or growth formula) in a new module, wired into the report and `ReportView` as its own card.
- **Files likely to change:** New `lib/grahamValuation.ts`; `lib/valueReport.ts` (add section); `stockAnalyst.ts` response shape (openapi.yaml update); `StockResearch.tsx`.
- **Tests required:** Unit tests for the formula against known inputs; a report-shape regression test.
- **Acceptance criteria:** A Graham fair-value figure renders alongside the existing blended valuation, clearly labeled, honest `null` when EPS/BVPS unavailable.
- **Rollback:** `git revert`; no schema change.
- **Estimated effort:** Low.

### Sprint 13 — DCF Valuation
- **Objective:** Build the genuine multi-year discounted-cash-flow engine.
- **Deliverables:** `analyzeDcfValuation()` — N-year FCF projection off existing history arrays, discount rate, terminal value, sum-of-discounted-cashflows; an assumptions panel in the UI.
- **Files likely to change:** New `lib/dcfValuation.ts`; `lib/valueReport.ts`; `StockResearch.tsx`; openapi.yaml.
- **Tests required:** Unit tests covering sensitivity to growth/discount-rate inputs, honest-unavailable path when FCF is negative/absent.
- **Acceptance criteria:** DCF fair value renders with visible assumptions (not a black box); matches hand-calculated values for a fixture case.
- **Rollback:** `git revert`; no schema change.
- **Estimated effort:** Medium-High.

### Sprint 14 — Buffett Valuation & Consolidated Margin of Safety
- **Objective:** Refactor the existing blended `analyzeValuation()` into an explicit owner-earnings "Buffett Valuation" model; build the cross-model Margin of Safety consolidation.
- **Deliverables:** `analyzeBuffettValuation()` (owner-earnings-flavored); a `consolidateMarginOfSafety()` that takes Graham/DCF/Buffett outputs and produces a range + agreement signal; the old blended `analyzeValuation()` is retired (or kept as an internal fallback, decision to confirm in the sprint plan) once its callers are migrated.
- **Files likely to change:** `lib/valueInvesting.ts` (retire/refactor `analyzeValuation`), new `lib/marginOfSafety.ts`; `lib/valueReport.ts`; `StockResearch.tsx`; `value.test.ts` updates (flagged non-regression risk since this touches the most heavily-tested existing function).
- **Tests required:** Full `value.test.ts` regression pass; new tests for owner-earnings math and MoS consolidation.
- **Acceptance criteria:** Three distinct fair-value cards + one consolidated MoS summary; existing narration/disclaimer invariants unchanged.
- **Rollback:** `git revert`; this is the highest-regression-risk sprint in the valuation cluster — treat `value.test.ts` as the gate, not just typecheck.
- **Estimated effort:** Medium-High.
- **Forward reference (§0.1 scope expansion):** Buffett's `verdict + conviction + rationale` output is one of the three inputs the AI Investment Committee (Sprint 17) consolidates — no change to this sprint's own scope, just noting the shape this sprint produces needs to stay stable for that later consumer.

### Sprint 15 — Investment Quality Engine — SHIPPED
- **Objective:** Inserted ahead of Tom Nash Core, at the project owner's explicit direction, after Sprint 14 shipped. Build a reusable, metric-by-metric Investment Quality Engine — the shared scoring foundation the Buffett Engine, Tom Nash Engine, AI Investment Committee, future valuation models, and Portfolio AI should all consume instead of each hand-rolling its own quality scoring. Not the Tom Nash Engine itself — that remains Sprint 16.
- **Deliverables:** `analyzeInvestmentQuality()` in new `lib/investmentQuality.ts`, scoring all 12 requested metrics (Revenue Growth, EPS Growth, FCF Growth, ROE, ROIC, Gross Margin, Operating Margin, Net Margin, Debt Levels, Cash Position, Share Dilution/Buybacks, Insider Ownership) — the last two honestly `unavailable` (no fabrication) pending Sprint 24's (Tom Nash Enhancement I) filing-ingestion infrastructure. Produces individual metric scores, an overall weighted Quality Score, strengths, weaknesses, a confidence level, and human-readable explanations. Wired into the Value Report as a new, purely additive "Investment Quality" section (inserted right after "Business Quality," renumbering every later section's display number only) and a new `StockResearch.tsx` pillar card. `valueInvesting.ts`'s `analyzeFinancialStrength()` had its leverage/interest-coverage/net-cash formulas extracted into small exported helper functions (`leverageScore`, `coverageScore`, `cashPositionScore`) — a behavior-preserving refactor (its own output is unchanged) so this engine reuses the exact same Debt Levels/Cash Position math rather than a second, subtly different one.
- **Files changed:** New `lib/investmentQuality.ts`, `lib/investmentQuality.test.ts`, `lib/valueReport.investmentQualityIntegration.test.ts`; modified `lib/valueInvesting.ts` (helper extraction), `lib/valueReport.ts` (new field/section), `lib/valueReport.grahamIntegration.test.ts`/`valueReport.dcfIntegration.test.ts`/`valueReport.buffettIntegration.test.ts` (mechanical section-numbering updates only), `StockResearch.tsx`/`StockResearch.test.tsx`, `test/fixtures/valueReport.ts`, `openapi.yaml` (+ regenerated `api-zod`/`api-client-react`).
- **Tests:** New engine unit tests (all 12 metrics' scoring math, the two permanently-unavailable metrics' honest paths, confidence-level thresholds, strengths/weaknesses derivation, ETF handling); new integration regression test proving Graham/DCF/Buffett/the blended model's own outputs are unchanged (`toEqual` against standalone calls); existing integration test files' section-count/numbering assertions updated (established mechanical-update pattern, not a behavior change).
- **Acceptance criteria met:** All 12 metrics render (10 scored, 2 honestly unavailable); overall score/strengths/weaknesses/confidence render in a new pillar card; Graham/DCF/Buffett/blended valuation math is untouched; no new owner-facing gaps beyond the 2 explicitly deferred metrics.
- **Rollback:** `git revert`; no schema migration — a pure code revert fully undoes this sprint.
- **Estimated effort:** Medium.
- **Renumbering note:** This insertion is why Tom Nash Core (formerly Sprint 15) is now Sprint 16, and every sprint after it shifted by one, through Sprint 31 (Company Research Unification, formerly 30).

### Sprint 16 — Tom Nash Investment Engine (Core) — SHIPPED
- **Objective:** Build the first version of the Tom Nash Investment Engine as a pure COMPOSITION layer over the reusable modules already shipped (Sprint 15's Investment Quality Engine, `analyzeFinancialStrength`, and the 4 valuation models), rather than duplicating any scoring logic.
- **Deliverables (as actually built):** `analyzeTomNash()` in new `lib/tomNashEngine.ts`, taking already-computed `iq`/`fin`/`blended`/`graham`/`dcf`/`buffett` as parameters (zero re-fetching, zero recomputation). Five pillars: **Business Quality** = the Investment Quality Engine's own overall score, reused whole; **Growth** = a renormalized average of Investment Quality's own Revenue/EPS/FCF Growth metric scores; **Capital Allocation** = a renormalized average of Cash Position/Debt Levels/ROIC (relabeled "Capital efficiency"), with Share Dilution/Buybacks surfaced as an unavailable line item but excluded from the number; **Financial Strength** = `analyzeFinancialStrength()`'s own score, called through directly; **Valuation** = the one genuinely new piece of logic — a `{Cheap:100, Fair:65, Expensive:35, "Very Expensive":0}` bucket mapping applied to whichever of Blended/Graham/DCF/Buffett are available, reusing their already-computed `rating` fields, deliberately isolated inside this module so it can be refined later without touching the 4 underlying models. Overall **Conviction Score** = equal-weighted (20% each) average across the 5 pillars, renormalized over whichever are available; internal weight constant kept named/adjustable for future Tom Nash enhancement sprints. **Buy/Hold/Wait verdict**: `>=70` Buy, `45–69` Hold, `<45` Wait. Output shape (`{verdict, convictionScore, rationale, summary}`) deliberately mirrors the contract every other analyst produces, so a future AI Investment Committee (Sprint 17) can treat Tom Nash as one more voting member. Explicitly NOT in this sprint: macro/interest-rate/sector-rotation/AI-cycle analysis, insider-ownership scoring, filing ingestion — Investment Quality's own "Insider Ownership" metric is simply never pulled into any pillar here.
- **Integration decision (deviation from this entry's original pre-Sprint-16 text, approved before implementation):** folded directly into `buildValueResearchReport()` — new field, new "14. Tom Nash Analysis" section inserted right after "Margin of Safety" — rather than a separate `GET /stock-analyst/tom-nash/:symbol` route. Core's actual composition is 100% in-memory reuse of already-computed values (no new provider calls), so the original "keep the core report fast" rationale for a separate route doesn't apply yet; it will matter once Enhancement sprints (24/26) add genuinely heavier external data.
- **Files changed:** New `lib/tomNashEngine.ts`, `lib/tomNashEngine.test.ts`, `lib/valueReport.tomNashIntegration.test.ts`; modified `lib/valueReport.ts` (field/section, report grows 19→20 sections), `valueReport.grahamIntegration.test.ts`/`dcfIntegration.test.ts`/`buffettIntegration.test.ts`/`investmentQualityIntegration.test.ts` (mechanical section-numbering updates only), `StockResearch.tsx` (new full-width "Tom Nash Analysis" card), `test/fixtures/valueReport.ts`, `openapi.yaml` (+ regenerated `api-zod`/`api-client-react`).
- **Tests:** Unit tests proving each pillar's reuse (Business Quality byte-identical to Investment Quality's score, Financial Strength byte-identical to `analyzeFinancialStrength`'s score, Growth/Capital Allocation's renormalization math, the bucket-mapping Valuation score, conviction-score weighting, Buy/Hold/Wait thresholds, honest-unavailable paths, Insider Ownership never surfaced); integration regression test proving Graham/DCF/Buffett/the blended model/Investment Quality's own outputs are unchanged (`toEqual` against standalone calls).
- **Acceptance criteria met:** All 5 pillar scores + conviction score + verdict + reasoning render; every underlying engine's own computation is provably unchanged; no macro/insider/filing logic introduced.
- **Rollback:** `git revert`; no schema migration — a pure code revert fully undoes this sprint.
- **Estimated effort:** Medium-High (breadth, not depth — most of the real algorithmic novelty is deferred to the Enhancement sprints).

### Sprint 17 — AI Investment Committee (Core) — SHIPPED
- **Objective:** Ship the first working version of the multi-analyst synthesis layer as a pure ORCHESTRATION layer — combining Graham's, Buffett's, and Tom Nash's own already-computed outputs, introducing no new business logic beyond what genuinely didn't exist yet.
- **Deliverables (as actually built):** `synthesizeInvestmentCommittee(graham, buffett, tomNash)` in new `lib/investmentCommittee.ts`. Graham and Buffett are pure valuation models — they only produce a categorical `rating`, not a Buy/Hold/Wait verdict — so per the approved decision each casts its Committee vote via a bucket collapse of that rating (Cheap → Buy, Fair → Hold, Expensive/Very Expensive → Wait), with confidence reusing the exact same rating→score table Tom Nash's own Valuation pillar already uses (`VALUATION_RATING_SCORE`, exported from `tomNashEngine.ts` — zero new scoring logic). Tom Nash (Sprint 16) already produces a real `{verdict, convictionScore}` and votes with that directly, unmodified. Agreement classification reuses `marginOfSafety.ts`'s own bucket-counting algorithm, generalized (Sprint 17 extraction) into an exported, generic `classifyAgreementSignal<T>(labels: T[])` — the same `unanimous/majority/split/insufficient-data` taxonomy already proven for the Consolidated Margin of Safety, now applied to 3 Buy/Hold/Wait votes. Per the approved decision, when all voting analysts genuinely disagree (split), the consolidated verdict defaults to **Hold** — the safe, neutral call — and the agreement signal is always surfaced so a user can see the actual level of consensus. A model that's `available: false` (e.g. Graham/Buffett on a deeply unprofitable company) is simply excluded from `votes[]`, never fabricated; if only Tom Nash ends up voting, agreement honestly reports `insufficient-data` and the consolidated verdict is that lone vote. Reasoning is **deterministic and rule-based only this sprint** — one line per vote plus one consolidated line — per the approved decision to defer real `ai-core`-narrated synthesis to a later Committee enhancement sprint, once the aggregation logic itself is stable.
- **Integration decision (consistent with Sprint 16's precedent):** folded directly into `buildValueResearchReport()` — new field, new "15. Investment Committee" section inserted right after "Tom Nash Analysis" — rather than a separate route, since Core has no new external data dependency.
- **Files changed:** New `lib/investmentCommittee.ts`, `lib/investmentCommittee.test.ts`, `lib/valueReport.investmentCommitteeIntegration.test.ts`; modified `lib/tomNashEngine.ts` (exported `VALUATION_RATING_SCORE`, no behavior change), `lib/marginOfSafety.ts` (extracted generic `classifyAgreementSignal`, no behavior change — confirmed via its own existing tests), `lib/valueReport.ts` (field/section, report grows 20→21 sections), the 5 existing `valueReport.*Integration.test.ts` files (mechanical section-numbering updates only), `StockResearch.tsx` (new "Investment Committee" card), `test/fixtures/valueReport.ts`, `openapi.yaml` (+ regenerated `api-zod`/`api-client-react`).
- **Tests:** Unit tests for the rating→verdict bucket mapping, Tom Nash's direct vote pass-through, unavailable-model exclusion, unanimous/majority/split/insufficient-data scenarios (constructed fixtures), the split→Hold default, confidence-score averaging over only the votes actually cast, and the reasoning shape; integration regression test proving Graham/DCF/Buffett/the blended model/Investment Quality/Tom Nash's own outputs are unchanged (`toEqual` against standalone calls).
- **Acceptance criteria met:** Given the available analyst outputs, the Committee produces a consolidated verdict and confidence score that visibly reflects agreement or disagreement — never a fabricated false consensus; every underlying engine's own computation is provably unchanged.
- **Rollback:** `git revert`; no schema change.
- **Estimated effort:** Medium.

### Sprint 18 — Financial Ratio Analysis
- **Objective:** Promote the existing 14-metric flat list into a dedicated ratio-analysis surface with trend charts.
- **Deliverables:** Expanded ratio set (quick ratio, ROA, asset turnover, payout ratio), a new "Ratios" tab with multi-year trend charts reusing the existing history-array chart pattern.
- **Files likely to change:** `lib/valueReport.ts`; `StockResearch.tsx`; openapi.yaml.
- **Tests required:** Unit tests for new ratio formulas; existing `value.test.ts` metrics assertions unchanged.
- **Acceptance criteria:** New ratios computed with the same null-if-uncomputable honesty guarantee as existing ones.
- **Rollback:** `git revert`; no schema change.
- **Estimated effort:** Low.

### Sprint 19 — Financial Statement Analysis
- **Objective:** Add full multi-year Income Statement/Balance Sheet/Cash Flow Statement line items.
- **Deliverables:** New provider calls (FMP `/income-statement`, `/balance-sheet-statement`, `/cash-flow-statement`; AV equivalents), a new structured statement type, a 3-sub-tab UI.
- **Files likely to change:** `lib/fundamentals.ts` (both live providers gain new methods); new type in the shared `Fundamentals`-adjacent module; `StockResearch.tsx`; openapi.yaml.
- **Tests required:** Mocked-fetch tests for both providers (matching existing `value.test.ts` conventions); rate-limit/fallback path tests.
- **Acceptance criteria:** Real multi-year statement line items render for a live-mode symbol; SIMULATED mode produces a plausible-but-fake equivalent (same honesty labeling).
- **Rollback:** `git revert`; no schema change if cached in-process.
- **Estimated effort:** Medium.

### Sprint 20 — Industry Comparison
- **Objective:** Add peer-group comparison.
- **Deliverables:** Sector/industry field capture (verify FMP's `/profile` response first — may already be present and simply unused), static peer-group config, an N-symbol comparison view extending `StockScanner.tsx`'s existing 2-symbol compare-dialog pattern.
- **Files likely to change:** `lib/fundamentals.ts` (capture sector/industry if already returned, or add the field if not); new `lib/industryPeers.ts`; new route; `StockScanner.tsx`/`StockResearch.tsx`; openapi.yaml.
- **Tests required:** Unit tests for peer-ratio percentile ranking.
- **Acceptance criteria:** A symbol's ratios render against its peer group with percentile context.
- **Rollback:** `git revert`; no schema change (static config).
- **Estimated effort:** Medium.
- **Forward reference (§0.1 scope expansion):** the sector taxonomy this sprint builds is what Tom Nash Enhancement II (Sprint 26) reuses for its sector-context half — no change to this sprint's own scope.

### Sprint 21 — Economic Moat Analysis Enhancement
- **Objective:** Replace the static `durabilityYears` lookup with a data-derived signal.
- **Deliverables:** `durabilityYears` derived from ROIC persistence (Sprint 19 data) rather than a fixed table.
- **Files likely to change:** `lib/valueInvesting.ts` (`analyzeMoat`); tests.
- **Tests required:** Regression test for the changed durability calc; existing moat-rating tests unchanged.
- **Acceptance criteria:** Durability estimate visibly varies by company rather than being one of 4 fixed values.
- **Rollback:** `git revert`; no schema change.
- **Estimated effort:** Low.

### Sprint 22 — Annual Report Analysis (the long pole)
- **Objective:** Ingest and summarize 10-K/10-Q filings.
- **Deliverables:** SEC EDGAR ingestion, section extraction (MD&A/Risk Factors/Business), chunked per-section summarization + final synthesis via `ai-core`'s `complete()`, persistence table.
- **Files likely to change:** New `lib/filingsProvider.ts`, new `lib/filingAnalysis.ts`, new `lib/db/src/schema/investingFilingAnalysis.ts`, new manual migration, new route, `StockResearch.tsx`.
- **Tests required:** Mocked-EDGAR-response tests for ingestion; chunking-boundary tests; a real (rate-limit-aware) live EDGAR smoke test.
- **Acceptance criteria:** A real 10-K's key sections are extracted and summarized with source-quote traceability; degrades honestly (not silently) when EDGAR has no filing for a symbol (e.g. non-US-listed).
- **Rollback:** `git revert`; drop the new table if migration was applied.
- **Estimated effort:** **High** — expect this to be the longest sprint in Phase 2, budget accordingly.

### Sprint 23 — Management Quality Analysis
- **Objective:** Build the qualitative management-analysis layer on top of Sprint 22's filing text.
- **Deliverables:** Capital-allocation/tenure/compensation-alignment synthesis, a new anti-fabrication safety wrapper scoped to claims about real named individuals.
- **Files likely to change:** New `lib/managementAnalysis.ts`; extends `investing_filing_analysis` table usage; new safety-check function alongside `enforceValueSafety`; `StockResearch.tsx`.
- **Tests required:** Safety-wrapper tests (analogous to the existing anti-impersonation regex tests) proving fabricated claims about a named executive are caught/discarded.
- **Acceptance criteria:** Management commentary never asserts a fact the source filing text doesn't support; disclaimer present on every response.
- **Rollback:** `git revert`.
- **Estimated effort:** High — this is the module carrying the most real-world compliance/reputational risk in Engine 1, review it with that lens before shipping.
- **Forward reference (§0.1 scope expansion):** this sprint's filing-ingestion pipeline is exactly what Tom Nash Enhancement I (Sprint 24) reuses for insider-ownership data — no change to this sprint's own scope.

### Sprint 24 — Tom Nash Investment Engine (Enhancement I: Capital Allocation, Buybacks & Insider Ownership)
- **Objective:** Add the filing-dependent third of Tom Nash's capability list, now that Annual Report Analysis (21) and Management Quality Analysis (22) have built the filing-ingestion infrastructure this needs.
- **Deliverables:** Capital allocation analysis (buyback $ / share-count-trend, reusing the filing text already extracted by Sprint 22/23); a "buyback yield" derived from historical shares-outstanding trend; insider ownership % and recent insider buy/sell activity (per the provider verified in §2 item 9).
- **Files likely to change:** `lib/tomNashEngine.ts` (extends Sprint 16's Core module, does not replace it); reuses `investing_filing_analysis` table read paths; `StockResearch.tsx`'s Tom Nash tab gains a Capital Allocation sub-card; openapi.yaml.
- **Tests required:** Mocked-provider tests for the insider-ownership/buyback endpoints; regression tests proving Sprint 16's Core output (business quality, growth, balance sheet, cash flow, conviction, verdict) is unchanged by this addition.
- **Acceptance criteria:** A symbol's Tom Nash analysis now includes capital-allocation commentary grounded in real filing text (or an honest "unavailable" state), without altering any Core-sprint output.
- **Rollback:** `git revert`; no new schema if the insider/buyback data is fetched live rather than cached.
- **Estimated effort:** Medium-High.

### Sprint 25 — Earnings Analysis
- **Objective:** Build the investing-specific earnings-history module (distinct from the options `earnings.ts` IV-crush selector).
- **Deliverables:** EPS/revenue actual-vs-estimate history, surprise%, guidance direction.
- **Files likely to change:** New `lib/earningsAnalysis.ts` (deliberately separate file from options' `earnings.ts` to avoid confusing the two); new route; `StockResearch.tsx`; openapi.yaml.
- **Tests required:** Mocked-provider tests for both FMP/AV earnings endpoints.
- **Acceptance criteria:** A 4–8 quarter earnings-surprise trend renders for a live-mode symbol.
- **Rollback:** `git revert`; no schema change if cached in-process.
- **Estimated effort:** Medium.

### Sprint 26 — Tom Nash Investment Engine (Enhancement II: Sector & Macro, Rate Sensitivity, AI/Tech Cycle) + Committee Confidence Refinement
- **Objective:** Ship the remaining thematic/macro third of Tom Nash's capability list, now that Industry Comparison (20) provides real sector context, and revisit the AI Investment Committee's (Sprint 17) confidence weighting now that Tom Nash's full feature set exists.
- **Deliverables:** Sector & macro analysis (reusing Sprint 20's sector taxonomy); interest-rate sensitivity classification (per the sourcing decided in §2 item 8 — SIMULATED-proxy by default); AI/technology-cycle analysis (LLM-narrated, bounded by deterministic inputs); a refinement pass on `synthesizeInvestmentCommittee()`'s confidence weighting to account for Tom Nash now being a fully-featured analyst rather than its Sprint-16 Core subset.
- **Files likely to change:** `lib/tomNashEngine.ts` (further extension); new `lib/investingMacro.ts` (or similar, SIMULATED-proxy pattern mirroring `marketBriefing.ts`); `lib/investmentCommittee.ts` (confidence-weighting update only — aggregation methodology itself unchanged); `StockResearch.tsx`; openapi.yaml.
- **Tests required:** Unit tests for the macro-proxy module; regression tests proving Sprints 15/23's existing Tom Nash output is unchanged; Committee regression tests confirming the confidence-weighting change doesn't alter already-shipped unanimous/majority/split logic, only its inputs.
- **Acceptance criteria:** Tom Nash's full 12-capability spec is complete; the Investment Committee's confidence score visibly reflects Tom Nash's now-complete analysis.
- **Rollback:** `git revert`; no schema change if the macro module stays SIMULATED-only.
- **Estimated effort:** Medium-High.

### Sprint 27 — Watchlist Polish
- **Objective:** Small, low-risk enhancements to the already-complete Watchlist module.
- **Deliverables:** Bulk-add from Industry Comparison/Scanner; UI-badge alerts when price/MoS targets are crossed (no push/email delivery — that's Phase 5's Notification Service).
- **Files likely to change:** `stockAnalyst.ts`; `StockScanner.tsx`/`StockResearch.tsx`.
- **Tests required:** Existing watchlist tests unchanged; new tests for bulk-add and badge logic.
- **Acceptance criteria:** No regression to existing CRUD; badges render correctly against live data.
- **Rollback:** `git revert`; no schema change.
- **Estimated effort:** Low.

### Sprint 28 — Portfolio Construction
- **Objective:** Build the new equity-portfolio allocation module.
- **Deliverables:** `investing_portfolios`/`investing_holdings` tables, CRUD routes (mirroring the watchlist CRUD pattern), a first-version allocation engine (equal-weight or simple target-weight-drift), a construction UI sourcing candidates from Watchlist.
- **Files likely to change:** New schema files + migration; new `lib/portfolioConstruction.ts`; new route file; new frontend page; openapi.yaml.
- **Tests required:** Tenant-isolation tests (reusing the established `assertTenantIsolation` helper) for both new tables; allocation-math unit tests.
- **Acceptance criteria:** A user can build a target portfolio from watchlist symbols and see actual-vs-target weight drift.
- **Rollback:** `git revert`; drop both new tables if migrations were applied.
- **Estimated effort:** Medium-High.

### Sprint 29 — Risk Analysis
- **Objective:** Build the equity-portfolio risk scorer.
- **Deliverables:** Concentration/sector-exposure/beta-estimate scoring (architecture modeled on `portfolioHealth.ts`'s pattern), a new snapshot-history table.
- **Files likely to change:** New `lib/investingRisk.ts`; new schema + migration (`investing_risk_snapshots`); new route; Portfolio Construction UI gains a risk panel.
- **Tests required:** Unit tests for the scorer (pure functions, same testability discipline as `portfolioHealth.ts`); tenant-isolation test for the new table.
- **Acceptance criteria:** Risk scores update as holdings change; hard-cap overrides behave as documented (e.g., concentration cap trips at a defined threshold).
- **Rollback:** `git revert`; drop the new table if applied.
- **Estimated effort:** Medium-High.

### Sprint 30 — AI Investment Analyst
- **Objective:** Ship the open-ended research-assistant mode.
- **Deliverables:** `narrateInvestingFreeform`-equivalent (thin wrapper over `ai-core`, following `coachLLM.ts`'s template exactly), a chat-style UI surface.
- **Files likely to change:** New `lib/investingCoachLLM.ts` (mirrors `coachLLM.ts`'s shape); new route; new/extended frontend panel.
- **Tests required:** Disclaimer-enforcement tests (mirroring the existing safety-invariant test block in `value.test.ts`).
- **Acceptance criteria:** Free-form questions about a researched symbol get grounded answers referencing the assembled report data, with disclaimer always present — including questions about the Tom Nash analysis and Investment Committee outcome.
- **Rollback:** `git revert`.
- **Estimated effort:** Medium.

### Sprint 31 — Company Research Unification
- **Objective:** Wire every module built in Sprints 12–29 into one coherent Company Research experience.
- **Deliverables:** `buildValueResearchReport()` grows to assemble all new sections, including Tom Nash's full analysis and the Investment Committee's consolidated recommendation; `StockResearch.tsx`'s `ReportView` becomes the single umbrella surface; end-to-end regression pass across the whole engine.
- **Files likely to change:** `lib/valueReport.ts`, `StockResearch.tsx`, openapi.yaml (final consolidated response schema).
- **Tests required:** Full existing `value.test.ts` suite plus a new full-report-shape integration test; a live smoke test generating a complete report for both a SIMULATED and a LIVE-mode symbol.
- **Acceptance criteria:** One symbol lookup produces a complete institutional investment decision report — company overview, statements, ratios, Graham/DCF/Buffett valuations + consolidated MoS, moat, management, industry comparison, earnings history, filing analysis, the full Tom Nash analysis, and the AI Investment Committee's final recommendation — all in one place, matching the Blueprint's original Engine 1 vision plus the §0.1 scope expansion.
- **Rollback:** `git revert`; this sprint is integration-only, lowest schema risk of the phase.
- **Estimated effort:** Medium.

---

## 4. Sequencing rationale

- **Sprints 11–14 (foundation + valuation split) must go first** — every later module either reads from the statement/valuation layer or renders inside the same report, so getting the "3 named models + consolidated MoS" architecture right early avoids rework.
- **Sprints 15–16 (Tom Nash Core, Committee Core) come immediately after Buffett, exactly as directed, and deliberately ship a partial-but-honest v1** — the reusable ~60% of Tom Nash's spec plus a first-pass probability/conviction framework, and a Committee that combines whatever the three analysts can produce at that point. This is the "maximise reuse" resolution: land what's reusable now, defer what genuinely needs data that doesn't exist yet, and say so clearly in the UI rather than faking completeness.
- **Sprints 18–21 are cheap, low-risk, high-value** — mostly enhancing what already exists (ratios, statements, industry comps, moat refinement) — good place to bank momentum, same reasoning the Blueprint used for Phase 4 (Options Income). Sprint 20 (Industry Comparison) additionally sets up the sector taxonomy Tom Nash Enhancement II (Sprint 26) needs.
- **Sprint 22 (Annual Report Analysis) is Engine 1's long pole**, structurally identical in role to Engine 2's Order Flow in the Blueprint — new engineering domain, external dependency outside engineering's direct control (EDGAR), real cost/vendor questions if transcripts are wanted later. Consider starting its data-ingestion groundwork in parallel with Sprints 18–21 rather than strictly serially, if the timeline should be de-risked the way the Blueprint recommends for Engine 2.
- **Sprint 23 (Management Quality) depends on 22** and carries the highest reputational/compliance risk in Engine 1 (discussing real executives) — budget real review time, not just test-passing time. It also unlocks Sprint 24.
- **Sprint 24 (Tom Nash Enhancement I) is sequenced immediately after Sprints 22–23 specifically because it reuses their filing-ingestion infrastructure** for insider-ownership data — this is the concrete "maximise reuse" payoff of not building Tom Nash's insider/buyback capability back in Sprint 16, when that infrastructure didn't exist yet.
- **Sprint 26 (Tom Nash Enhancement II) is sequenced after Sprint 20 (Industry Comparison)** for the same reuse reason — it needs real sector data, not a duplicate taxonomy. It also folds in a Committee confidence-weighting refinement, since Tom Nash's output is materially richer by this point than at Sprint 17.
- **Sprints 28–29 (Portfolio Construction, Risk Analysis) are the only sprints needing new relational tables beyond additive JSON/columns** — sequenced late so the allocation engine has real modules (valuations, ratios, moat, Tom Nash, Committee) to rank candidates by by the time it's built.
- **Sprint 31 is the integration checkpoint** — mirrors Phase 1's own pattern of "additive sprints, one consolidation pass at the end," and is where the phase's own Sprint-6-equivalent (Company Research, now Institutional Investment Decision Engine) becomes real — do not begin implementation on any sprint from 16 onward until that sprint's own pre-implementation plan is separately approved.
