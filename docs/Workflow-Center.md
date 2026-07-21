# Workflow Center

Phase 44 — deterministic, checklist-style guidance through the platform's
own already-shipped modules, for the institutional review processes a
portfolio manager runs on a recurring cadence.

**This is bookkeeping over a user's own explicit actions, never
automation.** There is no recommendation logic, no scoring, and no
automated action anywhere in `lib/portfolioWorkflows.ts`. A workflow "step"
is nothing more than a label, a short description, and a deep link to an
already-shipped page; "completing" a step is a plain checkbox toggle the
user performs after reviewing that page themselves.

## The model

- **`WorkflowDefinition`** — a static catalog entry: `key`, `title`,
  `description`, `cadence` (`ad_hoc | daily | weekly | monthly |
  quarterly`), and an ordered list of `steps`.
- **`WorkflowStepDefinition`** — `key`, `label`, `detail`, and `linkPath`
  (a real, already-shipped page route).
- **`WORKFLOW_CATALOG`** — a fixed, in-code array of 9 workflows (see
  below). This is the same "static catalog" pattern already established by
  `WORKSPACE_QUICK_ACTIONS` (`lib/workspacePins.ts`) and
  `DEFAULT_WIDGET_IDS` (`dashboardWorkspaces.ts`, an earlier phase) — never
  user-editable, never persisted, always available via
  `GET /portfolio-workspace/workflows`.
- **`portfolio_workflow_instances` table** — a per-user record of a
  started workflow: which catalog `workflowKey` it's an instance of, its
  own `status` (`active | completed | abandoned`), the set of
  `completedStepKeys` the user has checked off, and timestamps
  (`startedAt`, `completedAt`, `updatedAt`).

Starting a workflow (`POST /portfolio-workspace/workflows/:key/start`)
simply creates a new instance row with no steps yet completed. Toggling a
step (`PATCH .../workflows/instances/:id` with `{ stepKey, completed }`)
adds or removes that key from the instance's own `completedStepKeys` set.
**When every step in the catalog definition's own step list is checked,
the instance's status is deterministically flipped to `"completed"`** and
`completedAt` is stamped — a pure computation over the catalog's already-
known step count and the user's own checklist state, nothing more. If a
step is later unchecked on a completed instance, status reverts to
`"active"` and `completedAt` clears. A user can also abandon an instance
directly (`{ status: "abandoned" }`) without completing every step, or
delete it entirely.

Nothing in this model ever reads or writes trade data, portfolio holdings,
positions, or account state — it only reads/writes its own 3 dedicated
rows per instance. This was verified directly by an end-to-end test
(`routes/portfolioWorkspace.route.test.ts`) that snapshots the full
Portfolio Workspace Dashboard, starts and completes a workflow instance,
and re-fetches the dashboard to confirm every non-`activeWorkflows` field
is byte-identical.

## The 9 catalog workflows

| Key | Title | Cadence | Steps |
|---|---|---|---|
| `morning_review` | Morning Review | daily | Outstanding Issues → Watchlists → Risk alerts → Compliance breaches |
| `weekly_review` | Weekly Review | weekly | Performance → Scenario results → Watchlists → Recent Reports |
| `monthly_review` | Monthly Review | monthly | Rebalancing drift → Diversification → Full Compliance → Generate Institutional Review Report |
| `quarterly_review` | Quarterly Review | quarterly | Full Portfolio Snapshot → Full Risk review → Full Performance review → Full Compliance review → Generate Institutional Review Report |
| `portfolio_review` | Portfolio Review | ad hoc | Holdings Overview → Rebalancing/Allocation → Executive Health |
| `risk_review` | Risk Review | ad hoc | Risk Overview → Scenario impact → Concentration/Correlation |
| `compliance_review` | Compliance Review | ad hoc | Policy violations → Greeks limits → Buying-power limits |
| `performance_review` | Performance Review | ad hoc | Investing performance → Trading performance → Options performance |
| `scenario_review` | Scenario Review | ad hoc | Market shock scenarios → Options Stress Test → Options rate scenarios |

Every step's `linkPath` resolves to a page already shipped in an earlier
phase — Portfolio Workspace itself, Watchlists Engine, Risk & Exposure
Engine, Monitoring & Compliance Engine, Performance & Attribution Engine,
Scenario Engine, Rebalancing Engine, Decision Support Engine, Concentration
Risk, and the Reporting Centre. No new analytical surface was introduced
by this file — it is purely a navigational index over existing pages.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/portfolio-workspace/workflows` | The static 9-workflow catalog |
| GET | `/portfolio-workspace/workflows/instances` | The calling user's own instances (`?status=active\|completed\|abandoned` optional) |
| POST | `/portfolio-workspace/workflows/:key/start` | Start a new instance (404 for an unknown key) |
| PATCH | `/portfolio-workspace/workflows/instances/:id` | Toggle a step, or set status directly |
| DELETE | `/portfolio-workspace/workflows/instances/:id` | Delete an instance |

Every instance route is ownership-scoped — a `PATCH`/`DELETE` against
another user's instance id 404s exactly the same way a nonexistent id
would, never a separate 403, matching this codebase's own established IDOR
convention throughout every prior phase.

## Where it surfaces

The Workflow Center tab on `/portfolio-workspace` (`PortfolioWorkspace.tsx`)
shows the full catalog with a "Start" button per workflow, and every active
instance with a checklist (one checkbox per step, a progress bar, and a
delete action). The Portfolio Workspace Dashboard's own **Active
Workflows** section (`GET /portfolio-workspace/dashboard`) also surfaces
every currently-`active` instance, so a manager can see in-progress review
work alongside the rest of the portfolio picture without opening a second
tab.

## Testing

Covered as part of `routes/portfolioWorkspace.route.test.ts` (catalog
shape, full start/list/toggle/auto-complete/delete lifecycle, 404s for an
unknown workflow key and cross-user access, and the never-mutates-
portfolio-data proof) and `pages/PortfolioWorkspace.test.tsx` (the Workflow
Center tab's own catalog-render, start, and step-toggle interactions). See
`docs/Portfolio-Workspace.md` for the full testing summary across the
whole phase.
