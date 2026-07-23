# Professional Research Workflow

**Phase 20 — Institutional Research Terminal.** The end-to-end user workflow the Research Terminal (`/research-terminal`) is designed to support, per the phase's own brief:

> Search → Analyse → Compare → Review valuation → Review Decision Engine → Review Portfolio impact → Review Monitoring → Review Investment Committee → Save notes → Open Workspace. Without leaving the Research Terminal.

## Step-by-step

1. **Search.** Type a symbol in the header search box (`/` focuses it from anywhere) and press Enter or click Add. The symbol appears as a chip in the open-symbols strip and becomes the primary/active symbol.

2. **Analyse.** In Analyse mode (the default, or press `1`), the Overview tab shows the full `<ReportView>` — Business Quality, Competitive Advantage, Financial Strength, Valuation, Margin of Safety, and Historical Trends, all in one place, exactly as the Institutional Workspace already renders it.

3. **Compare.** Add a second (or third, fourth…) symbol via the same search box, then switch to Compare mode (press `2`). The Compare table shows every open symbol's already-computed Decision Engine synthesis score, Business Quality, Investment Quality, Margin of Safety, Investment Committee verdict, Tom Nash conviction, growth/return/leverage metrics, and dividend yield — side by side, with a ★ marking the best value per dimension.

4. **Review valuation.** Still in Analyse mode, the Overview tab's own Valuation/Margin of Safety sections (inside `<ReportView>`) show the four named valuation models and the consolidated margin of safety — the same figures the Compare table's own "Margin of Safety" column reuses.

5. **Review Decision Engine.** The Decision Engine tab shows the synthesized recommendation via `<DecisionSummaryCard>` — the same component `StockResearch.tsx` already uses.

6. **Review Portfolio impact.** Pick a portfolio from the header's portfolio selector; the Portfolio Impact tab immediately reflects whether the symbol is already held, its current weight, and its sector exposure.

7. **Review Monitoring.** The Monitoring tab shows any recorded alerts for this symbol, reusing the exact same notification records the Institutional Monitoring page and Institutional Workspace's own right sidebar already read.

8. **Review Investment Committee.** The Investment Committee tab shows the consolidated verdict, confidence, and agreement, with a direct link into the full Investment Committee Workbench (Phase 19) to record a formal decision.

9. **Save notes.** The Notes tab embeds `<ResearchNotesCard>` — the same free-text, per-symbol note system used across the platform.

10. **Open Workspace.** Every panel's header carries an "Open Workspace →" link, deep-linking straight into the Institutional Workspace (Phase 17) for the same symbol — the natural next step once a review is complete.

Every step above happens without leaving `/research-terminal` — switching symbols, modes, or tabs never navigates away from the page.

## Split-screen mode

Press `3` (or click Split) with 2+ symbols open to see two full Analyse panels side by side, each independently scrollable and tab-able — useful for a direct, full-detail comparison rather than the condensed Compare table.

## Saved Layouts

Name the current mode/symbols/portfolio/tab combination and click "Save Layout" to keep it for later — click its name to restore everything at once. Layouts are stored locally (per browser), not synced across devices, since they're a pure workspace preference, not research data.

## Cross-references

- `docs/Institutional-Research-Terminal.md` — the audit and reuse map.
- `docs/Research-Terminal-Architecture.md` — the component/data-flow architecture.
- `docs/Committee-Workflow.md` — the Investment Committee's own review workflow, one step further.
