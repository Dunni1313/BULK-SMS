# Investment Memo

**Phase 19 — Institutional Investment Committee Workbench.** The Investment Memo (`lib/investmentMemo.ts`, `GET /stock-analyst/investment-memo/:symbol`) is a deterministic, 14-section document assembled entirely from already-computed engine outputs. It never invents reasoning and never generates an opinion — every paragraph quotes a score, rating, verdict, or list item that already exists elsewhere in the platform.

## The 14 sections

| # | Section | Sourced from |
|---|---|---|
| 1 | Business Summary | `report.name`/`.symbol`/`.sector`/`.industry`/`.kind`/`.asOf`/`.dataSource` — plain descriptive facts |
| 2 | Business Quality | `report.businessQuality.score`/`.rating`/`.summary` |
| 3 | Competitive Advantage | `report.moat` + `report.competitiveAdvantage` |
| 4 | Financial Strength | `report.financialStrength` + `report.investmentQuality` |
| 5 | Valuation Summary | `report.valuation`/`.grahamValuation`/`.dcfValuation`/`.buffettValuation` (per-model fair value, margin of safety, rating) |
| 6 | Margin of Safety | `report.consolidatedMarginOfSafety` (the cross-model average, range, and agreement — distinct from the per-model breakdown above) |
| 7 | Decision Engine | `decision.recommendation`/`.confidence`/`.summary`/`.explanation`/`.drivers`/`.checklist` |
| 8 | Investment Committee Verdict | `report.investmentCommittee.consolidatedVerdict`/`.confidenceScore`/`.agreement`/`.summary` |
| 9 | Portfolio Impact | `decision.portfolioFit` (honestly "no portfolio context supplied" when none was passed) |
| 10 | Risk Summary | `decision.risks` + `decision.thingsToMonitor` |
| 11 | Catalysts | `decision.catalysts` |
| 12 | Research Notes | The user's own already-saved `investing_research_notes` rows for this symbol |
| 13 | Monitoring Summary | The user's own already-recorded `platform_notifications` rows for this symbol |
| 14 | Conclusion | Restates `decision.recommendation`/`.confidence`/`.summary` verbatim — introduces no new verdict |

## Design invariants

- **Pure function.** `buildInvestmentMemo(report, decision, researchNotes?, monitoringAlerts?)` makes no provider call, no database query, and no LLM call — the route layer resolves every input first (mirroring `tradingRisk.ts`/`portfolioOptimisation.ts`'s own "pure function over already-resolved data" discipline).
- **The recommendation is never re-derived.** `memo.recommendation`/`memo.confidence` are always `decision.recommendation`/`decision.confidence` — proven byte-identical by a dedicated unit test.
- **Honest empties, never fabrication.** No research notes → "No research notes recorded for this symbol yet." No monitoring alerts → "No monitoring alerts recorded for this symbol." No portfolio context → the Decision Engine's own honest reason, quoted verbatim.
- **Never predicts a price or forecasts a return.** Confirmed by a dedicated unit test scanning the full memo body (excluding the disclaimer, which discloses the invariant) for forecasting vocabulary.
- **On-demand, not persisted** — the same design `investmentThesisGenerator.ts`'s Investment Thesis already established (Phase 12): the memo is regenerated fresh on every call from already-computed, already-cached inputs; nothing about the memo's own text is stored. Persistence happens one layer down, via the existing Decision Snapshot ("Record Committee Decision").

## Cross-references

- `docs/Investment-Committee-Workbench.md` — the full audit and reuse map.
- `docs/Committee-Workflow.md` — the end-to-end user workflow.
