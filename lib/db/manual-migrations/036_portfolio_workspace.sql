-- Phase 44 — Institutional Portfolio Workspace & Workflow Center.
--
-- Three genuinely new persistence primitives, all monitoring/organisation
-- only:
--
-- portfolio_workflow_instances tracks a user's own progress through a
-- deterministic, static Workflow Center catalog (lib/portfolioWorkflows.ts
-- holds the actual workflow/step DEFINITIONS; this table only tracks which
-- steps a specific run has been marked complete). workflow_key is free
-- text referencing a catalog key, not a DB enum, matching
-- investing_watchlists.kind's/compliance_policies.policy_type's own
-- established free-text precedent. completed_step_keys is jsonb (matching
-- trading_strategies'/investing_watchlist_items.tags' own established
-- jsonb string-array pattern). Reaching "completed" status is a
-- deterministic bookkeeping computation over a user's own explicit
-- checklist actions, never automation of any trading/execution behaviour.
--
-- workspace_pinned_resources is a user's own explicit pins (the kickoff's
-- "Pinned Resources" and "Favorites" are the same underlying concept here
-- — see docs/Institutional-Workspace-Model.md) across dashboards, reports,
-- watchlists, strategies, learning topics, or a plain page. resource_type/
-- resource_key are free text. A unique (user_id, resource_type,
-- resource_key) constraint prevents pinning the same resource twice.
-- Nothing is ever auto-pinned.
--
-- workspace_recent_views is a per-user log of resources explicitly opened
-- FROM the Portfolio Workspace itself — deliberately not a global,
-- every-page view tracker (see docs/Institutional-Workspace-Model.md for
-- the disclosed scope boundary). No unique constraint — recordRecentView()
-- (lib/workspacePins.ts) deletes any existing row for the same
-- (user_id, resource_type, resource_key) before inserting a fresh one, so
-- the list always shows distinct resources ordered by their own most-
-- recent view.
--
-- All three tables: user_id -> users.id stays the universal ON DELETE
-- RESTRICT convention. Brand-new tables, NOT NULL from creation, no
-- nullable->backfill->enforce migration needed (same precedent as
-- platform_audit_log/investing_filing_analysis/compliance_policies/
-- investing_watchlists).

CREATE TABLE IF NOT EXISTS portfolio_workflow_instances (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  workflow_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  completed_step_keys jsonb NOT NULL DEFAULT '[]',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_workflow_instances_user_id_idx
  ON portfolio_workflow_instances (user_id);

CREATE TABLE IF NOT EXISTS workspace_pinned_resources (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resource_type text NOT NULL,
  resource_key text NOT NULL,
  label text NOT NULL,
  link_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_pinned_resources_user_resource_unique UNIQUE (user_id, resource_type, resource_key)
);

CREATE INDEX IF NOT EXISTS workspace_pinned_resources_user_id_idx
  ON workspace_pinned_resources (user_id);

CREATE TABLE IF NOT EXISTS workspace_recent_views (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resource_type text NOT NULL,
  resource_key text NOT NULL,
  label text NOT NULL,
  link_path text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_recent_views_user_id_idx
  ON workspace_recent_views (user_id);

CREATE INDEX IF NOT EXISTS workspace_recent_views_user_viewed_at_idx
  ON workspace_recent_views (user_id, viewed_at);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS workspace_recent_views;
--   DROP TABLE IF EXISTS workspace_pinned_resources;
--   DROP TABLE IF EXISTS portfolio_workflow_instances;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- these tables.
