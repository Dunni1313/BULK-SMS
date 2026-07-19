# Institutional Workspace

**Phase 17 — Institutional Workspace & Unified Research Cockpit.** This document describes the Institutional Workspace: a single-page cockpit that lets a user search a company, read its full research report, review valuation, see the Decision Engine's verdict, check portfolio impact, review monitoring alerts, save notes, add to watchlist, and compare against related opportunities — all **without leaving the page**.

**This is a pure integration layer.** No new valuation model, no new scoring system, and no duplicated business logic were built this phase. Every section of the Workspace reuses an already-shipped hook or component exactly as it exists elsewhere in this codebase.

---

## 1. What the Workspace is

A 3-panel, resizable, single-page layout at `/workspace`:

- **Left sidebar** — Watchlists, Portfolio, Opportunities, Monitoring, Notes.
- **Main Research Area** — the full company research report (Company Overview through Historical Trends, Investment Committee, Tom Nash Analysis), plus the Investment Thesis and Decision Engine cards.
- **Right sidebar** — Active Alerts, Research Notes, Portfolio Impact, Related Opportunities, AI Mentor Guidance.

The user searches a symbol once (or deep-links via `/workspace?symbol=AAPL`, or clicks a symbol anywhere in the left/right sidebars) and every panel updates to that symbol.

## 2. Audit — what already existed, reused unmodified

Before any code was written, every existing investing screen was audited for its own page, APIs, components, tests, and reusable widgets:

| Existing screen | Page | Key APIs | Reused in Workspace as |
|---|---|---|---|
| Stock Research | `StockResearch.tsx` | `GET /stock-analyst/value/:symbol`, `/investment-thesis/:symbol`, `/decision-engine/:symbol` (via `useGetInstitutionalDecision`) | `<ReportView>`, `<InvestmentThesisCard>`, `<DecisionSummaryCard>`, `<ResearchNotesCard>` imported directly |
| Decision Engine | `DecisionEngine.tsx` | `GET /stock-analyst/decision-engine/:symbol` | `<DecisionSummaryCard>` (already embedded in Stock Research) |
| Opportunity Discovery | `OpportunityDiscovery.tsx` | `GET /opportunity-discovery/saved-screens` | Left sidebar "Opportunities" list (`useGetSavedScreens`), deep-links to the full page |
| Portfolio Manager | `PortfolioConstruction.tsx` | `GET /portfolio-construction/portfolios[/:id]` | Left sidebar "Portfolio" list, right sidebar "Portfolio Impact" (client-aggregated from the same holdings data) |
| Monitoring & Alerts | `MonitoringDashboard.tsx` | `GET /notifications` | Left sidebar "Monitoring" (unread alerts), right sidebar "Active Alerts" (scoped to the current symbol) |
| Watchlists | (part of Stock Research) | `GET/POST /stock-analyst/value-watchlist` | Left sidebar "Watchlists", main-area "Add to Watchlist" button |
| Learning Centre | `Glossary.tsx`, etc. | — | Not embedded directly; the Workspace stays focused on research, deep-links out where relevant |
| Institutional Mentor | `InstitutionalMentor.tsx` | `GET /institutional-mentor` | Right sidebar "AI Mentor Guidance" (`watchlistReview.summary`), deep-links to the full page |
| Research Notes | (part of Stock Research) | `GET/POST /stock-analyst/research-notes[/:symbol]` | Left sidebar "Notes" (cross-symbol), right sidebar "Research Notes" (`<ResearchNotesCard>`, per-symbol) |

**The one genuine backend gap found:** there was no way to list a user's own research notes across every symbol — only a per-symbol lookup existed. A new `GET /stock-analyst/research-notes` endpoint was added, reusing the exact same table and formatter as the existing per-symbol route (see §3). This is the only new backend code this phase introduced.

Every other capability listed above — Decision Engine's recommendation logic, Opportunity Discovery's screening, Portfolio Construction's allocation math, Monitoring's alert detection, the Institutional Mentor's deterministic reviews, Industry Comparison's peer selection — is called through its existing, already-tested hook. None of it was reimplemented.

## 3. The one new backend endpoint

`GET /stock-analyst/research-notes` — lists the calling user's own research notes across every symbol, newest first. Reuses the `investing_research_notes` table and the existing `researchNoteItem()` formatter unchanged; the only new code is the query itself (no `symbol` filter). No new table, no migration, no new business logic.

## 4. Reuse map (component-by-component)

| Workspace section | Reused from | New code |
|---|---|---|
| Main Research Area | `StockResearch.tsx`'s `<ReportView>`, `<InvestmentThesisCard>`, `<DecisionSummaryCard>` | None — imported directly |
| Left: Watchlists | `useGetValueWatchlist()` | None |
| Left: Portfolio | `useGetPortfolios()` | None |
| Left: Opportunities | `useGetSavedScreens()` | None |
| Left: Monitoring | `useListNotifications()` (filtered to unread) | None |
| Left: Notes | `useGetAllResearchNotes()` | One new route (§3) |
| Right: Active Alerts | `useListNotifications()` (filtered to the current symbol) | None |
| Right: Research Notes | `<ResearchNotesCard>` | None — imported directly |
| Right: Portfolio Impact | `useGetPortfolios()` + `useGetPortfolio(id)`'s `allocation.holdings[]` | A small client-side symbol lookup (no new math) |
| Right: Related Opportunities | `useGetIndustryComparison(symbol)`'s `peerGroup` | None |
| Right: AI Mentor Guidance | `useGetInstitutionalMentor()`'s `watchlistReview.summary` | None |

## 5. Deterministic by design

The Workspace fetches the report via `useGetValueReport(symbol)` — the same simpler, non-streaming hook `InstitutionalDashboard.tsx` already uses — rather than `StockResearch.tsx`'s heavier SSE `streamCoach()` orchestration. This keeps every figure shown in the Workspace deterministic and already-computed; no LLM call happens anywhere in this page. `<ReportView>`'s own "AI Research Thesis" card is given a fixed, honest sentence pointing to the full Value Research page for AI-narrated commentary, rather than an empty string that would otherwise render a perpetual "thinking" placeholder.

## Cross-references

- `docs/Workspace-Architecture.md` — the technical layout, resizable panels, saved layouts, keyboard shortcuts.
- `docs/Research-Workflow.md` — the end-to-end user workflow this page supports.
- `docs/Institutional-Investing-Engine.md` — the underlying Engine 1 capabilities this Workspace surfaces.
