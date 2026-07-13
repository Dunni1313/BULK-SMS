import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 2, Sprint 28 — Portfolio Construction (approved Phase 2 plan, Sprint
// 28). A user-named target-allocation portfolio, advisory/education only —
// this table never touches a real brokerage account, and constructing a
// portfolio here never places, schedules, or submits any order (same
// discipline as the value_watchlist table, Task #66).
//
// Brand-new table: NOT NULL from creation, no nullable->backfill->enforce
// migration needed (same precedent as platform_audit_log, Sprint 10, and
// investing_filing_analysis, Sprint 22). userId is mandatory + ON DELETE
// RESTRICT, matching the universal per-user-data convention.
export const investingPortfoliosTable = pgTable("investing_portfolios", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("investing_portfolios_user_id_idx").on(table.userId),
]);

export const insertInvestingPortfolioSchema = createInsertSchema(investingPortfoliosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingPortfolio = z.infer<typeof insertInvestingPortfolioSchema>;
export type InvestingPortfolioRow = typeof investingPortfoliosTable.$inferSelect;
