# Institutional Trading AI Coach (Phase 29)

**Phase 29 — Institutional Trading AI Coach.** An orchestration and education phase, not a rebuild of the Trade Workspace, Market Structure Workbench, Liquidity & Session Workbench, Trade Planning Studio, Risk Studio, Trading Journal, Reporting, or the existing free-form Trading AI infrastructure. Every explanation this phase produces is a direct quote (or a trivial relabeling/tally) of an existing, already-computed Engine 2 output or an already-recorded Trading Journal fact — never a new trading signal, a price prediction, a buy/sell recommendation, or an invented probability.

This document describes what the Coach is and how it's put together. See also:

- `docs/Trading-Learning-Mode.md` — the Guided Learning Mode this phase adds (the new "Institutional Trading Engine" Learning Path) and how it reuses the existing Learning Centre content system.
- `docs/Trading-Coaching-Architecture.md` — the full audit, the genuine gaps found, and the architectural decisions behind the deterministic-vs-LLM split.

---

## 1. Audit performed before writing any code

Per the explicit instruction for this phase, the existing Trading AI Coach, Institutional Trade Workspace, Market Structure Workbench, Liquidity Workbench, Trade Planning Studio, Risk Studio, Trading Journal, Reporting, Learning Centre, and Executive Dashboard were audited first, and only genuine coaching gaps were built.

| Requested area | Already exists as | Status this phase |
|---|---|---|
| Trading AI Coach (existing) | `routes/tradingCoach.ts` — free-form LLM Q&A (`POST /trading/coach/ask[/stream]`), `narrateTradeFreeform()` (`coachLLM.ts`, Sprint 47/48) | Reused, unmodified — this phase adds a **second**, deterministic capability alongside it, never replacing it |
| Institutional Trade Workspace | `TradeWorkspace.tsx` (Phase 25) | Reused, unmodified — gained one outbound deep link from its existing AI Trading Coach panel |
| Market Structure Workbench | `MarketStructureWorkbench.tsx` (Phase 26) | Reused, unmodified — gained an outbound deep link from its own coach panel |
| Liquidity & Session Workbench | `LiquidityWorkbench.tsx` (Phase 27) | Reused, unmodified — gained an outbound deep link the same way |
| Trade Planning Studio / Risk Studio | `TradePlanningStudio.tsx` (Phase 28) | Reused, unmodified — gained an outbound deep link from its own AI Coach panel |
| Trading Journal | `routes/tradingJournal.ts` (Sprint 39/46) + `TradingJournal.tsx` | Reused, unmodified — the new Journal/Psychology coaches read its rows read-only; gained a header link |
| Reporting | `lib/institutionalReporting.ts`'s `"ai-coach-summary"` report type (Phase 21) | **Already engine-agnostic** — it reads generic `learning_progress` rows regardless of which engine's coach produced them, so zero code change was needed to cover Engine 2 |
| Learning Centre | `lib/learningPaths.ts`, `lib/glossary.ts`, `lib/learningProgress.ts` | Genuinely extended — see §2 below |
| Executive Dashboard | `InstitutionalDashboard.tsx` (Phase 23) | Reused, unmodified — gained one outbound link |

### The exact precedent reused for this phase's core design

Phase 21's own **Institutional AI Coach** (Engine 1) already solved this exact problem: `lib/investingCoach.ts` (8 deterministic, zero-LLM coach explainer functions), `GET /stock-analyst/coach/:coach/:symbol`, `CoachDrawer.tsx` (a reusable Evidence Explorer drawer), and `InstitutionalAICoach.tsx` (a standalone page). Phase 29 builds the direct Engine-2 analog of every one of these, never generalizing the Engine-1 versions (per this codebase's "engines never depend on each other's internals" convention).

### Genuine gaps found and built

| Gap | Why it was genuinely missing |
|---|---|
| Deterministic (zero-LLM) Trading Coach explanations | The only Engine 2 coach capability was free-form LLM Q&A — no structured, evidence-first, never-hallucinating explanation existed |
| Structure / Liquidity / Session / Risk / Trade Plan / Journal / Scenario / Psychology & Discipline coaches | None of these 8 distinct explainer types existed for Engine 2 |
| Evidence Explorer for Engine 2 | No reusable drawer/page surfaced metrics-used/supporting-evidence/calculation-sources for Engine 2 outputs |
| Standalone Trading AI Coach page | No single page unified all 8 coaches, Guided Learning, and Progress Tracking for Engine 2 |
| Trading Engine learning path + glossary terms | `lib/learningPaths.ts` had no Engine-2-scoped path; `lib/glossary.ts` had no `"trading"` category |

---

## 2. What was built

### Backend

- **`lib/tradingCoach.ts`** — 8 deterministic explainer functions (`explainStructureCoach`, `explainLiquidityCoach`, `explainSessionCoach`, `explainRiskCoach`, `explainTradePlanCoach`, `explainJournalCoach`, `explainPsychologyCoach`, `explainScenarioCoach`), each producing a `TradingCoachExplanation` (headline, whyThisExists, metricsUsed[], supportingEvidence[], risks/strengths, howToInterpret[], commonMistakes[], institutionalPerspective, relatedGlossaryKeys[], calculationSources[], disclaimer) — mirroring `investingCoach.ts`'s own `CoachExplanation` shape exactly. Zero new scoring/signal logic; every per-symbol/per-plan/per-entry sentence is a direct read of an already-computed field.
- **Routes** (added to the existing `routes/tradingCoach.ts`, alongside the untouched free-form Q&A routes):
  - `GET /trading/coach/:coach/:symbol` — `structure`, `liquidity`, `session`, `risk`, `trade-plan` (symbol-scoped, reuses `buildProbabilityAnalysis()`'s regime chain, `buildSessionData()`, and the free-form coach's own `gatherUserContext()` helper).
  - `GET /trading/coach/:coach` — `journal`, `psychology` (account-wide, reuses the same Trading Journal read).
  - `POST /trading/coach/scenario` — Scenario Coach, reuses `computeScenarioComparison()` (Phase 28) verbatim over the same request shape `POST /trading/trade-plans/scenarios/compare` already accepts.
- **`lib/learningPaths.ts`** — new `TRADING_ENGINE_PATH` (8 topics, one per coach), reusing the exact `LearningPath`/`LearningTopic` content shape.
- **`lib/glossary.ts`** — new `"trading"` category + 15 new terms (`market-structure`, `support-resistance-zone`, `multi-timeframe-confluence`, `liquidity-band`, `volume-profile`, `buy-sell-pressure`, `trading-session`, `session-overlap`, `trading-position-sizing`, `risk-reward-ratio`, `trading-capital-allocation`, `portfolio-risk-budget`, `trade-plan`, `scenario-comparison`, `trading-journal`, `r-multiple`) — deliberately `trading-`-prefixed on the two that would otherwise collide with Engine 1's own `"position-sizing"`/`"capital-allocation"` glossary keys.
- **`lib/learningProgress.ts`** — **zero changes needed.** Its `LearningItemType = "coach"` was already engine-agnostic (a free-text `itemKey`), so Trading Coach views add to the exact same `coachesViewed` counter Engine 1's coach already populates.
- **Reporting** — **zero changes needed.** `"ai-coach-summary"`'s own report builder already reads generic `learning_progress` rows.

No protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) was touched. `lib/tradingMultiTimeframe.ts`, `lib/tradingLiquidity.ts`, `lib/tradingDomainModel.ts`, `lib/tradingRisk.ts`, `lib/tradingScenarioComparison.ts`, `routes/tradingJournal.ts`, `routes/tradingTradePlans.ts` all have a zero-line diff.

### Frontend

- **`components/coach/TradingCoachDrawer.tsx`** — a reusable Evidence Explorer drawer, a deliberate parallel to `CoachDrawer.tsx` (not a shared generalization).
- **`hooks/use-trading-coach-explanation.ts`** — resolves the correct GET route (symbol-scoped vs. account-scoped) per coach type.
- **`pages/TradingAICoach.tsx`** (`/trading-ai-coach`) — the standalone page: symbol search + 8 coach tabs (including a Scenario Coach tab with its own 2-5-row scenario-input form), Learning Panel, Evidence Explorer, Guided Learning Mode (reusing the new `trading-engine` path), Progress Tracker.

---

## 3. Deferred / explicitly out of scope

Per the phase brief's own instruction: no trading signals, no price prediction, no ICT/SMC/ASAD/Trader Bill logic, no Order Block/Fair Value Gap detection were implemented anywhere in this phase. The Scenario Coach never says "recommended" — it only reports which already-computed number is numerically higher or lower (`bestRiskRewardName`/`tightestRiskName`), matching Phase 28's own established discipline. The Psychology & Discipline Coach never computes a psychological score — every sentence is a literal tally over the user's own already-recorded journal fields (mood tags, lesson-learned presence, recorded R-multiple sign).
