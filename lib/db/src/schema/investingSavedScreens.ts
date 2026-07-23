import { pgTable, serial, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 15 — Institutional Opportunity Discovery Engine. A user-saved,
// named set of Screener filter criteria — written only via an explicit
// "Save Screen" action, the same never-persist-unless-asked discipline
// investing_risk_snapshots (Phase 2, Sprint 29), investing_portfolio_snapshots
// (Phase 13), and investing_decision_snapshots (Phase 14) all already
// established.
//
// `filtersJson` holds the full OpportunityScreenerFilters object exactly as
// submitted — this table stores CRITERIA only, never scan results (results
// are always recomputed fresh from the live/simulated provider on each run,
// consistent with this codebase's never-persist-a-stale-derived-figure
// discipline).
//
// Brand-new table: NOT NULL from creation, no nullable->backfill->enforce
// migration needed. userId is mandatory + ON DELETE RESTRICT, matching every
// other per-user table's convention.
export const investingSavedScreensTable = pgTable(
  "investing_saved_screens",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    filtersJson: jsonb("filters_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("investing_saved_screens_user_id_idx").on(table.userId)],
);

export const insertInvestingSavedScreenSchema = createInsertSchema(investingSavedScreensTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingSavedScreen = z.infer<typeof insertInvestingSavedScreenSchema>;
export type InvestingSavedScreenRow = typeof investingSavedScreensTable.$inferSelect;
