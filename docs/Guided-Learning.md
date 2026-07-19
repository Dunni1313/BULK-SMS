# Guided Learning

**Phase 21 — Institutional AI Coach & Education Platform.** Guided walkthroughs for the Institutional Investing Engine's own modules, plus the Progress Tracker that shows how far a user has gotten through them.

## 1. The Institutional Investing Engine Learning Path

A 9th `LearningPath` (key `institutional-investing`), added to `lib/learningPaths.ts` alongside the existing 8 (Foundations, Options Greeks, Volatility, Options Strategies, Portfolio, Performance, and `institutional` — Engine 3's own options-portfolio thinking, deliberately distinct and untouched). Reuses the exact same `LearningTopic`/`LearningPath` shape every other path already uses — no new content system, no new route (the existing `GET /learning-centre/paths`/`GET /learning-centre/paths/:pathKey` routes serve it automatically).

The 9 topics, one per module named in the Phase 21 brief:

1. **Business Quality** — is this a good business, independent of price?
2. **Financial Strength** — can the balance sheet survive a bad year?
3. **The Decision Engine** — one recommendation, synthesised from every already-computed signal.
4. **Portfolio Optimisation** — Upgrade/Trim/Exit/Core, reading your own holdings against the Decision Engine.
5. **The Research Terminal** — Search, Analyse, Compare, Review, all in one screen.
6. **The Investment Committee** — three independent analysts, one consolidated verdict.
7. **Monitoring & Alerts** — what already happened, not a live feed.
8. **Margin of Safety** — how much room for error is priced in?
9. **Opportunity Discovery** — screen, rank, and bucket the known universe using the Decision Engine's own score.

Every topic's `externalHref` links to its own already-built page (confirmed against `App.tsx`'s real routes before this content was written — no fabricated URL), and every `relatedGlossaryKeys` entry is a real, pre-existing key in `lib/glossary.ts` (cross-checked by `learningPaths.test.ts`'s own dedicated test, the same discipline every prior path's content already follows).

## 2. Progress Tracker

`lib/learningProgress.ts`'s `LearningItemType` gained a 9th value, `"coach"` — a flat (non-path) tracking category, mirroring `"strategy"`'s own shape exactly, since coach explanations aren't organized into paths. `LearningProgressSummary` gained `coachesViewed`/`completedCoachKeys`, computed the same way `strategiesViewed`/`completedStrategyKeys` already are. `learning_progress` needed **zero schema change** — `item_type` was already free text, not a DB enum.

`CoachDrawer` calls `POST /learning-centre/progress/view` (itemType `"coach"`, itemKey `${coach}:${symbol}`) every time it's opened — the same established `recordViewed`/`recordCompleted` mutation pattern `LearningPaths.tsx`/`Glossary.tsx`/`StrategyAcademy.tsx` already use.

The standalone `pages/InstitutionalAICoach.tsx` page's own "Progress Tracker" card shows:
- **Coach explanations viewed** — `progress.coachesViewed`, a plain count.
- **Institutional Investing Engine path completion** — `progress.pathCompletion` filtered to `pathKey === "institutional-investing"`, showing `topicsCompleted`/`topicsTotal` and the existing `percentComplete` field, rendered via the shared `<Progress>` bar component.

The page's own "Guided Learning Mode" card lists all 9 topics (fetched via `GET /learning-centre/paths/institutional-investing`), each with a checkmark (`CheckCircle2` vs. `Circle`) driven by `progress.completedLessonKeys.has(topic.key)` — the exact same completion-lookup convention `LearningPaths.tsx` itself already uses for every other path.

## 3. Never a second content or progress system

No new table, no new route, no new content format. `docs/Institutional-AI-Coach.md` §1 documents the audit that led to this reuse decision.

## Cross-references

- `docs/Institutional-AI-Coach.md` — the 8 coaches and the audit.
- `docs/Evidence-Based-Explanations.md` — the Explanation Drawer's own UI contract.
