# Institutional Options Income Workspace — UI Walkthrough

`/options-income-workspace`. A pure presentation layer, 7 tabs, each a
direct read of one already-tested backend endpoint.

## Dashboard tab

- **Income Overview KPIs** — Open Positions, Closed Positions, Capital
  Allocated, Open Credit Collected, Realized Premium. All 5 are direct
  reads from `GET /options-income/dashboard`'s `overview` object.
- **Monthly Premium (Theta Income)** — daily/weekly/monthly/annualized
  theta, a projection from live position Greeks, explicitly labeled "never
  a P/L forecast" in the UI copy.
- **Strategy Mix** — open positions tallied by strategy, with position
  count and capital allocated per strategy.

Empty state: a brand-new user with no positions sees all-zero KPIs and an
honest "No open positions to break down by strategy yet" message — never a
fabricated non-zero figure.

## Positions tab

The full Position Model list, filterable by Open/Closed/All via 3 toggle
buttons. Each position card shows:

- Underlying, Strategy (labeled via the Strategy Library), a
  color-coded Lifecycle badge, Expiration, Premium, Collateral, and (for
  closed positions only) Realized P&L.
- Live Greeks (Δ/Γ/Θ/V).
- An editable Notes field — a `<Textarea>` plus a Save button, calling
  `PATCH /options-income/positions/:id/notes`. Saving invalidates both the
  positions list and the dashboard queries, so the update is reflected
  everywhere immediately.

## Strategy Library tab

A responsive grid of 9 strategy template cards. Each shows label, leg
count, income type, collateral type, ideal market, and assignment risk.
Templates the engine's own `execution.ts` actually builds (Iron Condor,
Iron Fly, Calendar) carry a "Built by this engine" badge — the other 6 are
presented as content-only reference material, never implying a trade could
be generated for them.

## Income Calendar tab

Open positions grouped by their own real expiration date, soonest first,
each group showing days-to-expiry and the positions expiring that day
(symbol, strategy, credit). A position with no recorded expiration is
honestly never included in any group.

## Greeks Overview tab

Two cards:

- **Portfolio Net Greeks** — reused directly from the existing Portfolio
  Risk Dashboard (`GET /portfolio/dashboard`'s `netGreeks` field), never
  recomputed.
- **Per-Position Greeks** — a live per-open-position Δ/Γ/Θ/V list.

## Risk & Exposure tab

Buying Power, Portfolio Value, and Total Risk %, plus a top-5 Allocation
by Symbol breakdown — all reused directly from the existing Portfolio Risk
Dashboard. Three outbound links let a user go deeper without this page
re-implementing that analysis: the full Portfolio Dashboard, Concentration
Risk, and Stress Test pages.

## Reporting tab

The Options Income Summary report (Reporting Centre's 14th report type),
rendered inline as its own sections (Income Overview, Monthly Premium,
Strategy Mix, Upcoming Expirations), with a link out to the full
Institutional Reporting Centre for saving, comparing, or exporting.

## Integration points

- **Navigation** — a new "Options Income Workspace" sidebar entry
  (`/options-income-workspace`), which the Command Palette inherits
  automatically.
- **Cross-Engine Workspace** — a new Workspace Shortcut and a new
  Cross-Engine Quick Action ("Open Options Income Workspace").
- **Executive Dashboard** and **Executive Intelligence** — a new outbound
  link alongside each page's existing Cross-Engine Workspace link.
- **Reporting Centre** — the Options Income Summary report type is
  selectable from the existing report-type dropdown, generated, saved,
  compared, and printed exactly like every other report type.
- **Learning Centre** — a new card in the overview grid's cross-engine
  link section.

## Testing

`OptionsIncomeWorkspace.test.tsx` — 11 tests covering the loading state,
honest all-zero/empty states, real KPI/theta/strategy-mix rendering, the
Position Model's lifecycle badge/Greeks/notes-save flow for both an open
and a closed position, Strategy Library metadata-only rendering, Income
Calendar grouping (empty and populated), Greeks Overview (portfolio +
per-position), Risk & Exposure KPIs and outbound links, and the Reporting
tab's report rendering + Reporting Centre link.

See `docs/Options-Income-Engine.md` for the product-level overview and
`docs/Options-Architecture.md` for the full audit and design-decision
record.
