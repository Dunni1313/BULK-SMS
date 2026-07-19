# Institutional Decision Engine

**Phase 14 — Institutional Investment Decision Engine.** This document describes the platform's Institutional Decision Engine — a deterministic synthesis layer sitting on top of every existing Institutional Investing Engine module — and, critically, what it reuses rather than duplicates.

**A repository audit was performed before any code was written.** It confirmed the platform already had two decision-adjacent outputs — `analyzeValueDecision()` (a blended-model-only 6-way verdict, `lib/valueInvesting.ts`, Phase 2) and the Investment Committee's 3-way Buy/Hold/Wait synthesis (`lib/investmentCommittee.ts`, Phase 2 Sprint 17) — plus an unstructured 6-line "Buffett Checklist." Neither combined all of Business Quality, Competitive Advantage, Management Quality, Capital Allocation, Financial Strength, Valuation, Margin of Safety, the Investment Committee, and Tom Nash's conviction score into one recommendation; neither produced a structured Pass/Warning/Fail checklist; neither had Decision History, Timeline, or Notes. This phase's job was to build only those genuine gaps, composing on top of what already existed.

---

## 1. What already existed (unmodified this phase)

| Capability | Module | Notes |
|---|---|---|
| Blended-model 6-way decision | `lib/valueInvesting.ts` → `analyzeValueDecision()` | LONG-TERM BUY / BUY ONLY ON PULLBACK / WATCHLIST / HOLD / TRIM / AVOID — untouched, still part of `ValueResearchReport.decision` |
| Investment Committee | `lib/investmentCommittee.ts` → `synthesizeInvestmentCommittee()` | 3-way Buy/Hold/Wait, `confidenceScore`, `agreement` — reused directly |
| Tom Nash conviction | `lib/tomNashEngine.ts` → `analyzeTomNash()` | 5-pillar `convictionScore` — reused directly |
| Consolidated Margin of Safety | `lib/marginOfSafety.ts` → `consolidateMarginOfSafety()` | Cross-model average MoS/range/agreement — reused directly |
| `classifyMarginOfSafety()` | `lib/valueInvesting.ts` (exported) | Reused verbatim for both the Valuation and Margin of Safety checklist items |
| Business Quality / Investment Quality / Competitive Advantage / Financial Strength / Financial Ratios | Existing Phase 2 modules | All already inputs to `ValueResearchReport` — reused, never recomputed |
| Management Quality | `lib/managementAnalysis.ts` → `buildManagementQualityAnalysis()` | On-demand (Document Intelligence/EDGAR) — reused as an optional input |
| Portfolio Intelligence | `lib/portfolioIntelligence.ts` (Phase 13) | Diversification Score, portfolio risk, sector allocation — reused as an optional input when a portfolio is supplied |
| Concentration caps | `lib/investingRisk.ts` | Exported `SINGLE_SYMBOL_CONCENTRATION_CAP_PCT` (25%), `SECTOR_CONCENTRATION_CAP_PCT` (40%) — reused verbatim |
| Notes/snapshots precedent | `investing_research_notes` (Phase 12), `investing_portfolio_snapshots`/`investing_portfolio_notes` (Phase 13) | Exact per-symbol notes / snapshot table shapes mirrored |

None of these were rewritten or duplicated. `lib/decisionEngine.ts` composes on top of them.

## 2. Genuine gaps identified and built this phase

- **A single 6-way recommendation** (Buy/Accumulate/Hold/Reduce/Sell/Avoid) synthesizing every reused signal above — no existing module produced this exact vocabulary or combined all these inputs.
- **A structured, 15-item Investment Checklist** (Pass/Warning/Fail/Unavailable + Explanation per item) — the existing "Buffett Checklist" was 6 unstructured bullets and omitted Management, Capital Allocation, Portfolio Fit, Risk, and Diversification entirely.
- **Supporting/Contradicting Evidence, Catalysts, Things to Monitor, Why Buy/Why Wait/Why Sell** — no existing module produced any of these narrative breakdowns.
- **Decision History/Timeline/Notes** — no persistence existed for a decision snapshot or a decision-specific note.
- **Portfolio-context checklist items** (Risk, Portfolio Fit, Diversification) — no existing decision output considered a user's actual portfolio exposure.

## 3. What this phase built

### 3.1 `lib/decisionEngine.ts` — the core composition module
`buildInstitutionalDecision(report, managementQuality, portfolioContext)` — a pure function. It takes an already-built `ValueResearchReport` (built once by the caller via the existing `buildValueResearchReport()`), an optional `ManagementQualityResult`, and an optional `DecisionPortfolioContext` (both pre-resolved by the route layer). It performs zero provider calls, zero database access, and zero new valuation/quality scoring — every number is either reused directly or combined via a disclosed weighted average (the same pattern Tom Nash Engine and Portfolio Intelligence already establish).

The one genuinely new logic:
- **Synthesis score** — a weighted average of `tomNash.convictionScore` (0.5), `investmentCommittee.confidenceScore` (0.2), `competitiveAdvantage.score` (0.15, if available), and `managementQuality.score` (0.15, if available), renormalized over whichever are present.
- **Recommendation derivation** — hard gates first (`financialStrength.rating === "Risky"` → Sell; `"Weak"` → Avoid, matching `analyzeValueDecision()`'s own quality-first-filter precedent), then a table keyed by the Investment Committee's verdict × the synthesis score, with a final downgrade when a supplied portfolio is already at or above the single-symbol concentration cap for this holding.
- **Checklist status derivation** — threshold-based Pass (≥65)/Warning (≥45)/Fail bucketing of already-computed 0-100 scores, and dedicated categorical mappings for Moat rating and the classified valuation/margin-of-safety labels.

### 3.2 New database objects
- `investing_decision_snapshots` — per-symbol, per-user, explicit-save-only composite snapshot (recommendation, confidence, full analysis blob) — mirrors `investing_portfolio_snapshots`' shape.
- `investing_decision_notes` — per-symbol, per-user free-text notes — mirrors `investing_research_notes` exactly, deliberately a separate table from Research Notes (different purpose, different tab).

### 3.3 New routes (all on the existing `routes/stockAnalyst.ts`)
- `GET /stock-analyst/decision/:symbol` (optional undocumented `?portfolioId=` query param, same precedent as `/trading/structure/:symbol`'s own `?interval=`/`?lookback=`).
- `GET`/`POST /stock-analyst/decision/:symbol/snapshots`.
- `GET`/`POST /stock-analyst/decision/:symbol/notes`, `PATCH`/`DELETE /stock-analyst/decision/notes/:id`.

### 3.4 UI — new `DecisionEngine.tsx` page at `/decision-engine`
Tabs: Overview / Evidence / Checklist / Risks / Catalysts / History / Notes. Permanent labels — "Institutional Decision Engine / Educational / Deterministic / Evidence Based" — shown near the header. Deep-linking via `?symbol=` and `?portfolioId=` (mirrors `StockResearch.tsx`'s/`PortfolioConstruction.tsx`'s own precedents). A portfolio dropdown lets a user optionally supply portfolio context for the Risk/Portfolio Fit/Diversification checklist items.

### 3.5 Integrations
- **Institutional Home** — a new `decision-engine` widget (a symbol-input navigation aid, deliberately zero new data fetch — the Decision Engine's own composition is real, non-trivial work and stays on-demand behind its own page).
- **Portfolio Manager** (`PortfolioConstruction.tsx`) — a per-holding "Get decision" link in the Holdings tab, deep-linking with both `symbol` and `portfolioId`.
- **Stock Research** (`StockResearch.tsx`) — a new, button-gated "Institutional Decision Engine" summary card (mirrors the Investment Thesis card's own on-demand discipline) with a link to the full page.
- **Institutional Mentor** — a new "Institutional Decision Engine Review" section (plain snapshot/note counts, zero new scoring), mirroring the existing Watchlist/Portfolio Review sections exactly. Deliberately named `decisionEngineReview`, distinct from the pre-existing, unrelated `decisionReview` field (the Options Engine's own decision-journal review).
- **Learning Centre Glossary** — 4 new `value-investing`-category terms (Institutional Decision Engine, Investment Checklist, Supporting/Contradicting Evidence, Decision Confidence).
- **Command Palette / Global Search / Navigation** — automatically covered by adding "Decision Engine" to the single shared `NAV_ITEMS` source of truth (`lib/nav-items.ts`), which both the sidebar and the Command Palette's "Navigate" group already render from.

## 4. Safety invariants

- Advisory/education only — this module never previews, schedules, or submits any order, and never touches a real brokerage account.
- Never-fabricate discipline: Management Quality/Portfolio Fit/Risk/Diversification are always honestly `unavailable` (with an explicit reason) when the underlying data can't be resolved — never approximated.
- Zero LLM calls anywhere in this module — zero price forecasting, zero probability guessing.
- Every recommendation and checklist item is either a direct reuse of an existing, already-tested engine's output, or a disclosed, simple, new formula (the synthesis-score weighted average; the Pass/Warning/Fail thresholds) — never a black-box judgment.

## Cross-references

- `docs/Decision-Framework.md` — the full deterministic decision-framework methodology and checklist derivation.
- `docs/Investment-Recommendations.md` — the recommendation output fields (Strengths/Weaknesses/Risks/Catalysts/Why Buy/Why Wait/Why Sell) and how each is derived.
- `docs/Institutional-Portfolio-Manager.md` — Phase 13's own Portfolio Intelligence module, reused here for portfolio context.
- `docs/Institutional-Investing-Engine.md` — Engine 1's own consolidation report (Phase 12), the foundation this phase composes on top of.
