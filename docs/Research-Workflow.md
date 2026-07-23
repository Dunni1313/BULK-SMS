# Research Workflow

**Phase 17 — Institutional Workspace & Unified Research Cockpit.** The end-to-end user workflow the Institutional Workspace (`/workspace`) is designed to support, per the phase's own brief:

> Search a company → Read research → Review valuation → See Decision Engine → Review portfolio impact → Review monitoring alerts → Save notes → Add to watchlist → Compare against portfolio. Without leaving the workspace.

## Step-by-step

1. **Search a company.** Type a symbol in the header search box (or press `/` to focus it from anywhere on the page) and submit — or click any symbol already surfaced in the left sidebar (Watchlists, Portfolio, Notes) or the right sidebar (Monitoring alerts, Related Opportunities). The URL updates to `/workspace?symbol=<SYMBOL>`, so the current research context is always shareable.

2. **Read research.** The Main Research Area resolves `GET /stock-analyst/value/:symbol` (via `useGetValueReport`, deterministic-only — no LLM narration on this page, see `docs/Institutional-Workspace.md` §5) and renders the full report: Company Overview, Business Quality, Financial Strength, Competitive Advantage, Historical Trends, and more, via `StockResearch.tsx`'s own `<ReportView>` component, imported unmodified.

3. **Review valuation.** The same report includes Graham, DCF, and Buffett valuation, plus the Consolidated Margin of Safety — all already part of `<ReportView>`, no separate fetch.

4. **See Decision Engine.** The `<DecisionSummaryCard>` (also from `StockResearch.tsx`, on-demand/button-gated exactly as it is on the Stock Research page) surfaces the synthesized Buy/Accumulate/Hold/Reduce/Sell/Avoid recommendation, with a link to the full Decision Engine page for its complete checklist/evidence view.

5. **Review portfolio impact.** The right sidebar's "Portfolio Impact" section checks whether the currently-researched symbol appears in the user's own primary portfolio (`useGetPortfolios()` + `useGetPortfolio(id)`), showing its target/actual weight and drift when held, or an honest "not held" message when it isn't. A link out to Portfolio Construction is provided for comparing across every portfolio the user owns.

6. **Review monitoring alerts.** The right sidebar's "Active Alerts" section filters the user's own unread notifications (`useListNotifications()`) down to ones tied to the current symbol. The left sidebar's "Monitoring" section separately surfaces unread alerts across every symbol, each clickable to pivot research straight to that alert's own symbol.

7. **Save notes.** The right sidebar's "Research Notes" section is `StockResearch.tsx`'s own `<ResearchNotesCard>`, imported unmodified — free-text, per-symbol, never AI-generated. The left sidebar's "Notes" section lists the user's notes across every symbol they've researched (the one new backend endpoint this phase added, `GET /stock-analyst/research-notes` — see `docs/Institutional-Workspace.md` §3), each clickable to jump straight back to that symbol's research.

8. **Add to watchlist.** A single "Add to Watchlist" button sits above the report, reusing `useAddValueWatchlist()` — the same mutation the Value Research page's own watchlist tab uses. Once added, the symbol shows up immediately in the left sidebar's "Watchlists" section.

9. **Compare against portfolio / related opportunities.** The right sidebar's "Related Opportunities" section surfaces the current symbol's industry peers (`useGetIndustryComparison(symbol)`'s own `peerGroup`), each a one-click pivot to that peer's own research — a lightweight "Quick Compare" without leaving the page.

Every step above happens on the same page, with the same 3-panel layout staying in place — only the Main Research Area's content and the two sidebars' symbol-scoped sections update as the user moves from company to company.

## What deliberately stays outside the Workspace

- **Statements / Peers (full view) / Filings / Earnings tabs** — the heavier, on-demand modules `StockResearch.tsx` itself gates behind explicit tab clicks. Reachable via a one-click deep-link to the full Value Research page (`/stock-analyst?symbol=...`), not duplicated inside the Workspace.
- **AI-narrated commentary and free-form Q&A** — the Workspace is deterministic-only by design; the full Value Research page remains the place for the streamed AI Research Thesis and the "Ask the AI Investment Analyst" panel.
- **Full side-by-side portfolio comparison / bulk watchlist management** — available on their own dedicated pages (Portfolio Construction, Stock Research's Watchlist tab), linked out to rather than reimplemented here.

## Cross-references

- `docs/Institutional-Workspace.md` — what the Workspace is, the audit, and the reuse map.
- `docs/Workspace-Architecture.md` — the technical layout, resizable panels, saved layouts, keyboard shortcuts.
