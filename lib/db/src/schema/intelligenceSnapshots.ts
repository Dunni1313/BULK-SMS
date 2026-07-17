import { pgTable, serial, uuid, text, integer, real, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Brand-new table, NOT NULL from creation, no backfill
// needed. userId mandatory + ON DELETE RESTRICT, matching every other
// user-scoped table's convention.
//
// This table exists for exactly one reason: the Timeline Engine's own
// "new / resolved / persistent observations" diffing and the Observation
// Engine's own trend observations ("Buying Power increasing", "Theta
// income improving", "Portfolio Health improved") both genuinely require
// comparing today's already-computed figures against a PRIOR day's
// already-computed figures — a capability that does not exist anywhere
// else in this platform (every other overlay/dashboard in this codebase
// is a stateless, point-in-time read). Every column here is a snapshot
// of an already-computed value from an existing, unmodified module
// (Portfolio Dashboard's own healthScore/overallRiskRating/buyingPower/
// healthFactors, and Theta Income's own monthly projection) — never a
// new calculation, never new market data, and never a statistical
// forecast: comparing two already-known past values (today vs. the most
// recently recorded snapshot) is history-keeping, not prediction.
//
// At most one row per (userId, snapshotDate) — enforced by the unique
// index below and written via a real DB-level upsert
// (.onConflictDoNothing()), not a check-then-insert race.
export const intelligenceSnapshotsTable = pgTable(
  "intelligence_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    snapshotDate: text("snapshot_date").notNull(),
    healthScore: integer("health_score").notNull(),
    overallRiskRatingCode: text("overall_risk_rating_code").notNull(),
    buyingPower: real("buying_power").notNull(),
    totalRiskPct: real("total_risk_pct").notNull(),
    concentrationScore: integer("concentration_score").notNull(),
    diversificationScore: integer("diversification_score").notNull(),
    eventRiskScore: integer("event_risk_score").notNull(),
    directionalExposureScore: integer("directional_exposure_score").notNull(),
    greeksExposureScore: integer("greeks_exposure_score").notNull(),
    thetaMonthly: real("theta_monthly").notNull(),
    netDelta: real("net_delta").notNull(),
    observationCodes: jsonb("observation_codes").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("intelligence_snapshots_user_id_idx").on(table.userId),
    uniqueIndex("intelligence_snapshots_user_date_idx").on(table.userId, table.snapshotDate),
  ],
);

export const insertIntelligenceSnapshotSchema = createInsertSchema(intelligenceSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertIntelligenceSnapshot = z.infer<typeof insertIntelligenceSnapshotSchema>;
export type IntelligenceSnapshotRow = typeof intelligenceSnapshotsTable.$inferSelect;
