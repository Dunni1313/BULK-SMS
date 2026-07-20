# Trading Learning Mode (Phase 29)

This document describes the interactive Learning Mode the Institutional Trading AI Coach adds — the new **Institutional Trading Engine** Learning Path — and how it reuses the existing Learning Centre infrastructure verbatim rather than introducing a second content system.

## 1. Reuse, not a new system — the governing rule

Per the phase brief's own instruction ("Reuse existing Learning Centre infrastructure"), the Trading Learning Mode is **not** a new feature — it is the 10th entry in the same `LEARNING_PATHS: LearningPath[]` array (`lib/learningPaths.ts`) that already holds Foundations, Greeks, Volatility, Strategies, Portfolio, Performance, Institutional (Engine 3), and Institutional Investing (Engine 1, Phase 21). Same `LearningPath`/`LearningTopic` TypeScript literal shape, same `GET /learning-centre/paths/:pathKey` route (which resolves any registered path key with zero hardcoded whitelist), same Learning Progress tracker (`lib/learningProgress.ts`), same Glossary cross-referencing discipline.

## 2. The `trading-engine` path — 8 topics, one per coach

| Topic key | Title | Links to | Related glossary terms |
|---|---|---|---|
| `trading-market-structure` | Market Structure | `/market-structure-workbench` | `market-structure`, `support-resistance-zone`, `multi-timeframe-confluence` |
| `trading-liquidity` | Liquidity | `/liquidity-workbench` | `liquidity-band`, `volume-profile`, `buy-sell-pressure` |
| `trading-sessions` | Sessions | `/liquidity-workbench` | `trading-session`, `session-overlap` |
| `trading-risk-management` | Risk Management | `/trade-planning-studio` | `trading-position-sizing`, `risk-reward-ratio`, `trading-capital-allocation`, `portfolio-risk-budget` |
| `trading-trade-planning` | Trade Planning & Scenario Comparison | `/trade-planning-studio` | `trade-plan`, `scenario-comparison`, `risk-reward-ratio` |
| `trading-journal-review` | The Trading Journal | `/trading-journal` | `trading-journal`, `r-multiple` |
| `trading-psychology-discipline` | Psychology & Discipline | `/trading-journal` | `trading-journal`, `r-multiple` |
| `trading-ai-coach-overview` | The Trading AI Coach | `/trading-ai-coach` | `market-structure`, `trade-plan` |

Every `externalHref` was confirmed against a real, already-existing route in `App.tsx` before being written — never a fabricated URL (proven by `learningPaths.test.ts`'s own known-routes cross-reference test).

## 3. The `"trading"` glossary category

`lib/glossary.ts` gained a 9th `GlossaryCategory` value, `"trading"`, and 15 new terms. Two of them — `trading-position-sizing` and `trading-capital-allocation` — are deliberately prefixed to avoid colliding with Engine 1's own pre-existing `"position-sizing"`/`"capital-allocation"` glossary keys (a genuine collision caught by `glossary.test.ts`'s own unique-key test during implementation, not anticipated in the pre-approval plan — see `docs/Trading-Coaching-Architecture.md` §3 for the full account). Every other term is a plain, non-colliding new key.

## 4. Progress tracking — zero new persistence

`lib/learningProgress.ts`'s `LearningItemType = "lesson" | "glossary" | "path" | "strategy" | "coach"` needed no change. A Trading Coach explanation view is recorded with `itemType: "coach"` and `itemKey: "${coach}:${symbol}"` (or `"${coach}:account"` for the account-wide Journal/Psychology coaches) — the exact same call shape `CoachDrawer.tsx` already uses for Engine 1, just a different `itemKey` string. `coachesViewed` therefore already counts Engine 1 and Engine 2 coach views together as one honest total, with no engine-specific column or table.

## 5. The Trading AI Coach page's own Guided Learning Mode

`pages/TradingAICoach.tsx` renders the `trading-engine` path's 8 topics with the same checkmark/circle completion-state UI Phase 21's `InstitutionalAICoach.tsx` already established, reading `useGetLearningProgress()`'s own `completedLessonKeys` set — no new completion-tracking logic.
