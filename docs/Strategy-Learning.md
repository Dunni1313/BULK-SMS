# Strategy Learning Integration

Phase 31. The Institutional Strategy Workbench reuses the existing
Learning Centre exactly as the Phase 30 Strategy Framework page already
does — no new lessons, no new learning path, no new progress-tracking
mechanism.

## What is reused, unmodified

- **`lib/learningPaths.ts`'s `strategy-framework` learning path** (Phase 30,
  4 topics: overview, categories-and-evidence, checklist-engine, coach) —
  the Workbench does not add a second, Workbench-specific learning path.
  The Workbench's own header text and workflow-step list serve as its
  "guided tour," reusing the Framework page's Guided Learning Mode/Progress
  Tracker pattern for the deeper educational content.
- **`lib/learningProgress.ts`'s `learning_progress` table and
  `recordViewed()`/`getLearningProgress()` functions** — a Strategy
  Learning Panel's "Mark as viewed" action records exactly the same
  `itemType: "strategy"`, `itemKey: \`strategy-framework:<id>\`` row Phase
  30 already established. The Workbench never writes a different key
  shape.
- **`StrategyLearningPanel`** — extracted this phase, unmodified in
  behavior, from the component Phase 30's `StrategyFramework.tsx`
  originally built inline. Both pages render the exact same Learning
  Viewer: educational notes, references, and the Mark-as-viewed button.

## What the Workbench provides on top

- **Strategy Overview** — the active strategy's name/description/category/
  version, shown at the top of the Workspace.
- **References** — the strategy's own `references` array, rendered
  by the reused `StrategyLearningPanel`.
- **Educational Notes** — the strategy's own `educationalNotes` field,
  same panel.
- **Related Concepts** — surfaced via the Evidence Explorer (which existing
  engines — Market Structure, Liquidity & Session, Risk, Trade Planning,
  Journal, AI Coach — this strategy cites) and the Strategy Coach panel's
  own `metricsUsed`/`relatedGlossaryKeys` fields (Phase 30's
  `explainStrategyCoach()`, unmodified).
- **Learning Progress** — surfaced two ways: (1) directly, via the
  Learning Viewer's own Mark-as-viewed button and the Learning Centre's
  own Progress tab (unchanged); (2) indirectly, via the Comparison view's
  new "Learning Coverage" column (see `docs/Strategy-Comparison.md`) and
  the Reporting Centre's new "Learning Coverage" report section (below).

## Reporting Centre extension

`lib/institutionalReporting.ts`'s `buildStrategyFrameworkSummaryReport()`
(Phase 30) gained two new, additive sections this phase — not a new
report type:

- **Learning Coverage** — one line per registered strategy, "viewed" or
  "not yet viewed," derived from the same `viewedStrategyKeys` list the
  Comparison view uses (`routes/institutionalReporting.ts`'s
  `loadStrategyFrameworkSummaryInputs()` now also calls
  `getLearningProgress(userId)` — reusing that existing function, not a
  new query path).
- **Workspace Notes** — every Strategy Note (see the Strategy Notes panel,
  `docs/Strategy-Workbench.md`) recorded against a strategy, listed by
  strategy name and last-updated timestamp.

Both new params (`learningCoverage`, `workspaceNotes`) on
`buildStrategyFrameworkSummaryReport()` default to empty arrays, so every
pre-Phase-31 call site is byte-identical when it omits them — confirmed by
a dedicated regression test.

## Never fabricated

Both new sections honestly report "no registered strategies" / "no
workspace notes have been recorded yet" when there is nothing to show —
never a fabricated coverage percentage or invented note. Learning
Coverage's own "viewed" flag is a real lookup against a real, already-
persisted `learning_progress` row; it is never inferred from anything
else (e.g., checklist completion does not imply "viewed").
