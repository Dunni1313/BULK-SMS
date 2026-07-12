-- Phase 1, Sprint 5 — settings singleton -> per-user (per the approved Phase 1
-- Foundation plan, §2.3, §2.5 step 6).
--
-- This is the one migration step where schema and application code MUST ship
-- together: getOrCreateSettings(userId) in routes/settings.ts, and the
-- getSettingsRow()/getFundamentalsProvider() internal callers, assume this
-- constraint is already in place. Do not run this against any environment
-- without deploying the matching code change in the same window (§2.6).
--
-- Uses the same legacy-owner user Sprint 4 backfilled everything else to
-- (dunnikarp@gmail.com) — settings was excluded from Sprint 4 specifically so
-- this step could bundle its backfill with the unique constraint and code
-- change, per §2.3.
--
-- Run this against a full pg_dump backup taken immediately beforehand (§2.6).

-- ─── Step 1: backfill the (at most one) existing settings row ─────────────
UPDATE settings SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;

-- ─── Step 2: verification gate ─────────────────────────────────────────────
-- Confirm this returns 0 BEFORE running Step 3 below.
SELECT COUNT(*) AS remaining_null FROM settings WHERE user_id IS NULL;

-- ─── Step 3: enforce NOT NULL, add FK (ON DELETE RESTRICT), add unique constraint ──
ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE settings ADD CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE settings ADD CONSTRAINT settings_user_id_unique UNIQUE (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Per §2.6: this is the one step requiring a COORDINATED code + schema
-- rollback — the new code assumes userId-scoped settings, the old code
-- assumes a singleton. Revert the app deploy in the same window as:
--
--   ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_user_id_unique;
--   ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_user_id_fkey;
--   ALTER TABLE settings ALTER COLUMN user_id DROP NOT NULL;
--   -- (user_id itself is left in place, nullable, as Sprint 3/4 left it for
--   -- every other table — do not drop the column as part of this rollback)
