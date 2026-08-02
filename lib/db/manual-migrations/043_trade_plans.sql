-- v1.5.0 Sprint 10 — Institutional Trade Planner
--
-- A Trade Plan is a fully prepared trade *before* execution — planning
-- only, this migration introduces no execution/order/broker concept.
-- Mirrors the Sprint 9 AI Strategy Builder's own schema conventions
-- exactly (see 042_ai_strategies.sql): free-text discriminator columns
-- validated at the application layer (never a DB enum/CHECK constraint,
-- so new statuses/kinds/asset classes never require a migration), a
-- single kind-discriminated sections table with a partial unique index
-- for the "one per plan" section kinds, and an immutable append-only
-- versions table.
--
-- One deliberate size difference from Sprint 9's 3-table pattern: this
-- migration adds a 4th table, trade_plan_checklist_items. The Checklist
-- Engine's own requirements (required/optional items, per-item
-- completion state, a progress percentage) need genuine persistent
-- per-item row storage — Strategy Builder's own AI-generated checklists
-- are ephemeral prose output, never saved as rows, so there is no
-- existing table this could reuse. This is the only new table beyond
-- the plans/sections/versions triple.

-- ---------------------------------------------------------------------
-- trade_plans — the top-level planning record.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_plans (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Trade Plans belong to Workspaces (optional — detach, don't destroy,
  -- the same policy Strategies/Notebooks already use for workspace_id).
  workspace_id INTEGER REFERENCES ai_workspaces(id) ON DELETE SET NULL,
  -- Which coach this plan belongs to: "trading" | "investing" | "options".
  -- Portfolio Coach is deliberately excluded per the approved scope.
  coach_id TEXT NOT NULL,
  -- "Linked Strategy" from the spec's own structure list is represented
  -- solely by this column, not a duplicate section row — the same
  -- relationship must never be stored twice.
  strategy_id INTEGER REFERENCES ai_strategies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  planned_asset TEXT,
  asset_class TEXT,
  -- App-validated: "long" | "short".
  direction TEXT,
  -- App-validated: "draft" | "ready" | "watching" | "executed" |
  -- "cancelled" | "archived". No separate archived boolean column —
  -- unlike Strategy's own status+archived pair, Trade Plan's status
  -- enum already includes "archived" as a terminal state, so a second
  -- boolean would just duplicate the same fact.
  status TEXT NOT NULL DEFAULT 'draft',
  pinned BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  current_version INTEGER NOT NULL DEFAULT 1,
  -- Future execution linkage, without implementing execution: a loose,
  -- unenforced reference (no FK — mirrors trading_journal_entries own
  -- trading_position_id precedent), populated by a future sprint once
  -- an execution/order concept actually exists.
  executed_trade_ref TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_plans_user_id_idx ON trade_plans (user_id);
CREATE INDEX IF NOT EXISTS trade_plans_workspace_id_idx ON trade_plans (workspace_id);
CREATE INDEX IF NOT EXISTS trade_plans_strategy_id_idx ON trade_plans (strategy_id);
CREATE INDEX IF NOT EXISTS trade_plans_coach_id_idx ON trade_plans (coach_id);
CREATE INDEX IF NOT EXISTS trade_plans_status_idx ON trade_plans (status);

-- ---------------------------------------------------------------------
-- trade_plan_sections — kind-discriminated structured content.
-- ---------------------------------------------------------------------
-- 18 singleton qualitative kinds (at most one per plan) plus 3 multi
-- reference kinds (many per plan): attachment, research_reference,
-- notebook_reference. "Linked Notebook" from the spec's structure list
-- maps onto notebook_reference (which also covers AI Conversation
-- references, mirroring Strategy Builder's own notebook_reference kind
-- exactly — one kind, two nullable ref columns on the same row).
CREATE TABLE IF NOT EXISTS trade_plan_sections (
  id SERIAL PRIMARY KEY,
  trade_plan_id INTEGER NOT NULL REFERENCES trade_plans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content TEXT,
  -- Populated only for the notebook_reference kind.
  ref_notebook_id INTEGER REFERENCES ai_notebooks(id) ON DELETE SET NULL,
  ref_conversation_id INTEGER REFERENCES ai_coach_conversations(id) ON DELETE SET NULL,
  -- Populated only for the attachment kind.
  ref_file_id INTEGER REFERENCES ai_workspace_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_plan_sections_trade_plan_id_idx ON trade_plan_sections (trade_plan_id);
CREATE INDEX IF NOT EXISTS trade_plan_sections_kind_idx ON trade_plan_sections (kind);

-- Enforce "at most one per plan" only for the 18 singleton kinds —
-- attachment/research_reference/notebook_reference are deliberately
-- excluded so a plan can carry many of each.
CREATE UNIQUE INDEX IF NOT EXISTS trade_plan_sections_singleton_uidx
  ON trade_plan_sections (trade_plan_id, kind)
  WHERE kind NOT IN ('attachment', 'research_reference', 'notebook_reference');

-- ---------------------------------------------------------------------
-- trade_plan_versions — immutable, append-only version history.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_plan_versions (
  id SERIAL PRIMARY KEY,
  trade_plan_id INTEGER NOT NULL REFERENCES trade_plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_plan_versions_trade_plan_id_idx ON trade_plan_versions (trade_plan_id);
CREATE UNIQUE INDEX IF NOT EXISTS trade_plan_versions_plan_version_uidx
  ON trade_plan_versions (trade_plan_id, version);

-- ---------------------------------------------------------------------
-- trade_plan_checklist_items — the Checklist Engine's persistent items.
-- ---------------------------------------------------------------------
-- Required/optional items with a completion flag; progress percentage
-- is always derived (never stored) from these rows. Coach-specific
-- checklist *templates* are pure application data (lib/tradePlanChecklistTemplates.ts),
-- not a DB concept — this table only holds the actual, per-plan items
-- a user has added (whether from a template or written by hand).
CREATE TABLE IF NOT EXISTS trade_plan_checklist_items (
  id SERIAL PRIMARY KEY,
  trade_plan_id INTEGER NOT NULL REFERENCES trade_plans(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_plan_checklist_items_trade_plan_id_idx ON trade_plan_checklist_items (trade_plan_id);
