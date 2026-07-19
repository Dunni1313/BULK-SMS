# Institutional AI Coach

**Phase 21 — Institutional AI Coach & Education Platform.** A deterministic Institutional AI Coach that explains and teaches using the outputs the platform already computes. This is an orchestration and educational phase — no new valuation model, no new scoring system, and no new investment recommendation was built.

---

## 1. Audit — what already existed, reused unmodified

| Capability needed | Already exists as | Reuse plan |
|---|---|---|
| Contextual "explain this metric" widget | `lib/metricExplainer.ts` + `components/learn/ExplainButton.tsx` (Options Income Engine's own "Explain Mode," AI Teacher & Learning Centre sprint) | Confirmed the exact pattern to extend at Engine-1 scope — "server computes, component only renders," never a client-side judgment |
| Deterministic Decision Engine synthesis, evidence, checklist | `lib/decisionEngine.ts` (Phase 14) | Reused directly — Investment/Decision/Risk/Portfolio Coaches all read straight from `InstitutionalDecisionAnalysis` |
| Four named valuation models + consolidated margin of safety | `lib/valueReport.ts`'s `valuation`/`grahamValuation`/`dcfValuation`/`buffettValuation`/`consolidatedMarginOfSafety` (Phase 2) | Reused directly by the Valuation Coach |
| Business Quality / Investment Quality / Competitive Advantage factor detail | `ValueResearchReport`'s own already-computed fields (Phase 2) | Reused directly by the Research Coach |
| Portfolio fit / concentration caps | `DecisionPortfolioContext` + `SINGLE_SYMBOL_CONCENTRATION_CAP_PCT`/`SECTOR_CONCENTRATION_CAP_PCT` (Phase 2 Sprint 29, Phase 14) | Reused directly by the Portfolio Coach |
| Monitoring alerts | `platform_notifications` (the same rows `GET /notifications` and the Investment Memo's Monitoring Summary already read) | Reused directly by the Monitoring Coach |
| Investment Committee votes/verdict/agreement | `report.investmentCommittee` (Phase 2 Sprint 17) | Reused directly by the Committee Coach |
| Structured educational content | `lib/learningPaths.ts`/`lib/glossary.ts` (AI Teacher & Learning Centre sprint) | Extended with a 9th path (Institutional Investing Engine), zero new content system |
| Progress tracking | `lib/learningProgress.ts` (`learning_progress` table) | Extended `LearningItemType` with `"coach"`, zero new table |

**Genuine gap found:** nothing in the platform explained *why* a Decision Engine recommendation, a valuation reading, a portfolio fit, a risk flag, a research factor, a monitoring alert, or a Committee verdict existed, in plain language, with common-mistakes/institutional-perspective framing, for Engine 1. That gap is this phase's entire deliverable.

## 2. What this phase added

### 2.1 `lib/investingCoach.ts` — 8 deterministic coaches

A pure composition module, structurally identical in discipline to `decisionEngine.ts`/`investmentMemo.ts`: it computes nothing new, it only quotes already-computed fields into a shared `CoachExplanation` shape.

| Coach | Reuses |
|---|---|
| Investment Coach | Business Quality, Moat, Financial Strength, the Investment Committee, Tom Nash, and the Decision Engine's own recommendation/explanation/evidence |
| Portfolio Coach | `DecisionPortfolioContext` (weight, sector exposure, diversification/risk scores) + the concentration caps |
| Decision Coach | The Decision Engine's own checklist, drivers, and contradicting evidence/things-to-monitor |
| Valuation Coach | Blended/Graham/DCF/Buffett valuation models + the Consolidated Margin of Safety |
| Risk Coach | The report's own risk flags, Financial Strength's flags, and (when a portfolio is supplied) the Decision Engine's Risk/Diversification checklist items |
| Research Coach | Business Quality's factor list, Investment Quality's strengths/weaknesses, Competitive Advantage's 11 dimensions |
| Monitoring Coach | The user's own recorded `platform_notifications` for the symbol |
| Committee Coach | The Investment Committee's own votes, consolidated verdict, confidence, agreement, and reasoning |

Every `CoachExplanation` carries: `headline`, `whyThisExists`, `metricsUsed`, `supportingEvidence`, `risksReducingConfidence`, `strengthsIncreasingConfidence`, `howToInterpret`, `commonMistakes`, `institutionalPerspective`, `relatedGlossaryKeys`, `calculationSources`, and a fixed `disclaimer`. The only genuinely new content in this file is static, hand-authored educational copy (`howToInterpret`/`commonMistakes`/`institutionalPerspective`) — it never varies per symbol and never encodes a new judgment about any specific company.

### 2.2 `GET /stock-analyst/coach/:coach/:symbol`

A thin route (`routes/stockAnalyst.ts`) reusing the exact same `buildValueResearchReport`/`buildInstitutionalDecision`/`resolveDecisionManagementQuality`/`resolveDecisionPortfolioContext` helpers the `/decision/:symbol` and `/investment-memo/:symbol` routes already call, plus the symbol's own `platform_notifications` rows. 400 for an unrecognized coach type, 404 for an unresolvable symbol. Optional `?portfolioId=` (undocumented query param, same Orval-collision precedent as `/decision/:symbol`) supplies Portfolio Coach context.

### 2.3 `CoachDrawer` and `InstitutionalAICoach.tsx`

See `docs/Evidence-Based-Explanations.md` for the drawer's own UI contract, and `docs/Guided-Learning.md` for the Guided Learning Mode / Progress Tracker sections of the standalone page.

## 3. Integration — 11 surfaces

`CoachDrawer` is embedded across: Research Terminal, Decision Engine, Portfolio Optimisation, Investment Committee Workbench, Institutional Workspace, Portfolio Construction (Portfolio Manager), Institutional Monitoring, Institutional Mentor (a general link, since that page has no single-symbol context), Learning Centre (a quick-link card), Navigation (`nav-items.ts`, a new "Institutional AI Coach" entry), and the Command Palette (automatic — it reads the same `ALL_NAV_ITEMS` array, per the established Phase 19/20 precedent).

## 4. Never invents reasoning, never generates opinions

Every field in a `CoachExplanation` is a direct quote of an already-computed value — confirmed by construction (`investingCoach.ts` makes no new provider call and computes nothing itself beyond static educational copy; every input it reads was already computed by an existing, already-tested engine). No LLM is called anywhere in this phase.

## Cross-references

- `docs/Guided-Learning.md` — the 9-topic Institutional Investing Engine Learning Path and Progress Tracker.
- `docs/Evidence-Based-Explanations.md` — the Explanation Drawer's UI contract and the Evidence Explorer.
- `docs/Institutional-Research-Terminal.md`, `docs/Investment-Committee-Workbench.md`, `docs/Portfolio-Optimisation.md` — the underlying engines this phase composes.
