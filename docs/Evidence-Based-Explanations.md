# Evidence-Based Explanations

**Phase 21 — Institutional AI Coach & Education Platform.** The UI contract for the Explanation Drawer (`CoachDrawer`) and the Evidence Explorer — how every number on screen traces back to a named, already-computed source.

## 1. The Explanation Drawer (`CoachDrawer`)

`src/components/coach/CoachDrawer.tsx` — a reusable Sheet-based drawer, embedded across all 11 integration surfaces (see `docs/Institutional-AI-Coach.md` §3). Props: `symbol`, `coach` (default coach type, switchable via an in-drawer `Select` unless `allowCoachSwitch={false}`), `portfolioId` (optional, threads into the Portfolio Coach's context), and an optional custom `trigger`.

Every render is a direct read of `GET /stock-analyst/coach/:coach/:symbol` (via the shared `useCoachExplanation` hook, `src/hooks/use-coach-explanation.ts`) — the component has no explanation logic of its own, mirroring `ExplainButton.tsx`'s own established "server computes, component only renders" discipline.

### Permanent labels

Every drawer header carries four fixed badges: **Institutional AI Coach**, **Educational**, **Deterministic**, **Evidence Based** — never conditional, never removed.

### Interactive quick actions

Six buttons, each changing which section of the SAME already-fetched explanation is emphasised — never a second fetch, never a new judgment:

| Button | Reveals |
|---|---|
| "What does this mean?" (default) | `whyThisExists` |
| "Why?" | `whyThisExists` |
| "Show the evidence" | `metricsUsed`, `supportingEvidence`, `risksReducingConfidence`, `strengthsIncreasingConfidence` |
| "Teach me" | `howToInterpret`, `commonMistakes`, `institutionalPerspective` |
| "Explain like I'm new" | `howToInterpret` only (a gentler subset of "Teach me") |
| "Show calculation sources" | `calculationSources` (badges naming the exact engine/module each figure came from) |

Every drawer also shows `relatedGlossaryKeys` (linking to `/learn/glossary/:key`) and a "Continue with Guided Learning →" link to the new Institutional Investing Engine path, plus the coach's own fixed `disclaimer` string at the bottom — never paraphrased, always the exact server-provided text.

## 2. The Evidence Explorer

On the standalone `pages/InstitutionalAICoach.tsx` page, the Evidence Explorer is its own full-width card (not gated behind a quick-action toggle, since the whole page is already a dedicated "look under the hood" surface): it shows `metricsUsed` and `supportingEvidence` as labeled lists (each item carrying its own `source` — which engine/module produced it), `risksReducingConfidence`/`strengthsIncreasingConfidence` when present, `calculationSources` as badges, and `relatedGlossaryKeys` as clickable badges.

## 3. Why "evidence-based" is enforceable, not just a label

Every field in a `CoachEvidenceItem` (`{label, detail, source}`) is constructed in `lib/investingCoach.ts` by directly quoting an already-computed value and naming its origin — e.g. `ev("Business Quality", "78/100 (Good)", "Business Quality Engine")`. There is no code path in `investingCoach.ts` that invents a number or a judgment; every value plugged into a `CoachEvidenceItem` traces back through the function call graph to `buildValueResearchReport()`/`buildInstitutionalDecision()`/`platform_notifications`, all pre-existing, already-tested modules. This is proven by `lib/investingCoach.test.ts`'s own dedicated assertions (e.g., the Investment Coach test asserting `metricsUsed` contains the report's own `businessQuality.score`, byte-identical).

## Cross-references

- `docs/Institutional-AI-Coach.md` — the 8 coaches, the audit, and the 11-surface integration.
- `docs/Guided-Learning.md` — the Institutional Investing Engine path and Progress Tracker.
