import { pgTable, serial, uuid, text, real, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 14 — Institutional Investment Decision Engine. A user-saved
// point-in-time snapshot of a symbol's decision (recommendation + confidence
// + the full InstitutionalDecisionAnalysis blob), written only via an
// explicit "Save Snapshot" action — the same never-persist-unless-asked
// discipline investing_risk_snapshots (Phase 2, Sprint 29) and
// investing_portfolio_snapshots (Phase 13) already established.
//
// Deliberately per-symbol (not per-portfolio) — Decision History/Timeline is
// "how has my read on this stock changed over time," independent of which
// portfolio (if any) it was evaluated against.
//
// `analysisJson` holds the full InstitutionalDecisionAnalysis object (same
// jsonb-blob-plus-headline-columns pattern as the other snapshot tables);
// recommendation/confidence are promoted to their own columns so a history
// list can be rendered/sorted without deserializing the blob.
//
// Brand-new table: NOT NULL from creation, no nullable->backfill->enforce
// migration needed. userId is mandatory + ON DELETE RESTRICT, matching every
// other per-user table's convention.
export const investingDecisionSnapshotsTable = pgTable(
  "investing_decision_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    recommendation: text("recommendation").notNull(),
    confidence: real("confidence").notNull(),
    analysisJson: jsonb("analysis_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("investing_decision_snapshots_user_id_idx").on(table.userId),
    index("investing_decision_snapshots_user_symbol_idx").on(table.userId, table.symbol),
  ],
);

export const insertInvestingDecisionSnapshotSchema = createInsertSchema(investingDecisionSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInvestingDecisionSnapshot = z.infer<typeof insertInvestingDecisionSnapshotSchema>;
export type InvestingDecisionSnapshotRow = typeof investingDecisionSnapshotsTable.$inferSelect;
