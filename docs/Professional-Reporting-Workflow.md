# Professional Reporting Workflow

**Phase 22 — Institutional Reporting & Client Presentation Engine.** The `ReportingCentre.tsx` UI contract — how a user builds, previews, selects sections from, exports, and presents an Institutional Report.

## 1. Permanent labels

Every page render carries four fixed badges (`data-testid="reporting-centre-labels"`): **Institutional Reporting**, **Evidence Based**, **Deterministic**, **Professional** — never conditional, never removed.

## 2. Report Builder

A single form: a report-type `Select` (populated from `GET /reporting/types`), a conditional symbol `Input` (shown only when the selected type's `requiresSymbol` is true), a conditional portfolio `Select` (shown only when `requiresPortfolio` is true, populated from the user's own portfolios via `useGetPortfolios()`), and a "Generate Report" button. Clicking Generate is the **only** thing that triggers a fetch — typing into the symbol input or changing the report type never fires a request by itself (mirrors the established `enabled`-gated-hook discipline used throughout this codebase since Sprint 19).

### Deep-linking

`?reportType=&symbol=&portfolioId=` query parameters (mirroring `DecisionEngine.tsx`'s/`InstitutionalAICoach.tsx`'s own established `?symbol=` precedent) pre-fill the builder and auto-generate on page load — this is what the "Generate Report →" links added across the other 10 integration surfaces (see `docs/Institutional-Reporting.md` §3) land on.

## 3. Report Preview

Once a report is generated, its `title`/`subtitle` and every visible section's `title`/`body` render, followed by the report's own fixed `disclaimer`. A **Density** toggle controls two modes:

- **Executive** — body text only, no bullet detail (a compact, boardroom-ready view).
- **Detailed** — body text plus every section's own `bullets` (the full evidence trail).

## 4. Section Selector

A checkbox per section (all checked by default). Unchecking a section removes it from the Report Preview, Export Preview, and Presentation View simultaneously — the three views always share one `visibleSections` derivation, so a hidden section never reappears in one view while excluded from another.

## 5. Export Preview — "Professional PDF-ready layout"

No new dependency (no `jspdf`/`html2canvas`/`react-to-print`) — the codebase had no PDF/print infrastructure before this phase (confirmed by audit), and browsers already have a print-to-PDF pipeline built in. The Export Preview tab renders a clean, formatted copy of the currently-visible sections; a parallel, always-present-but-`hidden` container (`id="reporting-centre-print-area"`, shown only via Tailwind's `print:` variant) holds the identical content for the browser's own print dialog. Clicking **"Print / Save as PDF"** calls `window.print()` — the rest of the page (builder, tabs, saved-reports list) carries a `print:hidden` class so only the report itself appears in the printed/PDF output.

## 6. Presentation View

One section per "slide," Prev/Next navigation, and a slide counter (`current / total`). Presentation View respects the same Section Selector filter as every other view — a hidden section is skipped, never a blank slide.

## 7. Save Report

"Save Report" calls `POST /reporting/reports` with the currently-generated report's own `{reportType, symbol, portfolioId}` — the backend **regenerates** fresh (never trusts client-supplied content, see `docs/Report-Generation.md` §6) and persists it. The Saved Reports card lists every persisted report (newest first); clicking one loads its full content; a delete button removes it.

## 8. Comparison Report

A dedicated card, independent of the main Report Builder: two symbol inputs and a "Compare" button. This is **pure frontend composition** — it fetches two already-generated Single Company Research Reports (`GET /reporting/company-research/:symbol`, once per symbol) and renders them side by side. No new backend endpoint, no duplicated report-assembly logic — the exact same `company-research` builder the main flow uses, called twice.

## 9. Never invents anything visually either

Every number, sentence, and bullet on this page is a direct pass-through of what `GET /reporting/*` returned — the frontend performs no aggregation, scoring, or judgment of its own. The only client-side computation is the Section Selector's set-membership filter and the Presentation View's slide index — neither touches the report's own content.

## Cross-references

- `docs/Institutional-Reporting.md` — the audit and the 11-surface integration.
- `docs/Report-Generation.md` — the 9 report types and their exact section composition.
