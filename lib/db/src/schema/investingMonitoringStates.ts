import { pgTable, serial, uuid, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 16 — Institutional Monitoring & Alerts Engine.
//
// The ONE genuinely new persistence primitive this phase introduces: a
// generic "last observed signal state" cache, per (user, entityType,
// entityKey), used only so the Monitoring Engine can diff an already-
// computed engine output against what it saw last time. It never stores a
// new score or computation of its own — `stateJson` is always a direct
// snapshot of an already-computed structure (an OpportunityRow for
// entityType="symbol", a {qualityScore, riskScore, diversificationScore}
// triple for entityType="portfolio", or a matched-symbol list for
// entityType="saved_screen").
//
// Deliberately NOT the same thing as investing_decision_snapshots /
// investing_portfolio_snapshots / investing_risk_snapshots (all explicit,
// user-triggered "Save Snapshot" history records, Phases 13/14/29) — this
// table is written automatically by the Monitoring Engine's own evaluation
// tick, never by a user action, and is overwritten (not appended to) on
// every evaluation — it has no history of its own, only a "most recent"
// row per entity, enforced by the unique index below.
//
// Brand-new table: NOT NULL from creation, no nullable->backfill->enforce
// migration needed. userId mandatory + ON DELETE RESTRICT, matching every
// other per-user table's convention.
export const investingMonitoringStatesTable = pgTable(
  "investing_monitoring_states",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(), // "symbol" | "portfolio" | "saved_screen"
    entityKey: text("entity_key").notNull(), // symbol string, portfolioId as text, or savedScreenId as text
    stateJson: jsonb("state_json").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("investing_monitoring_states_entity_idx").on(table.userId, table.entityType, table.entityKey)],
);

export const insertInvestingMonitoringStateSchema = createInsertSchema(investingMonitoringStatesTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertInvestingMonitoringState = z.infer<typeof insertInvestingMonitoringStateSchema>;
export type InvestingMonitoringStateRow = typeof investingMonitoringStatesTable.$inferSelect;
