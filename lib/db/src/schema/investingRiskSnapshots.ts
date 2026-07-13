import { pgTable, serial, uuid, integer, real, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { investingPortfoliosTable } from "./investingPortfolios";

// Phase 2, Sprint 29 — Portfolio Risk Analysis. A user-saved point-in-time
// snapshot of a portfolio's computed risk score, written only via an
// explicit "Save Snapshot" action (never automatically on every read) — the
// same never-persist-unless-asked discipline Sprint 27's watchlist targets
// and Sprint 28's portfolio allocation already established. Risk is always
// computed fresh/live; this table exists purely to let a user build a
// history of that computation over time.
//
// `analysisJson` holds the full PortfolioRiskAnalysis object (same
// JSON-blob-plus-headline-columns pattern as stock_analysis_history);
// `overallScore` is promoted to its own nullable column so a history list
// can be rendered/sorted without deserializing the blob.
//
// Brand-new table: NOT NULL from creation (except the genuinely-nullable
// overallScore, honest when risk couldn't be scored), no
// nullable->backfill->enforce migration needed (same precedent as
// platform_audit_log/investing_filing_analysis). `userId` is mandatory +
// ON DELETE RESTRICT, matching every other user-scoped table. `portfolioId`
// uses ON DELETE CASCADE, matching investing_holdings' own precedent — a
// snapshot of a deleted portfolio is meaningless and should go with it.
export const investingRiskSnapshotsTable = pgTable("investing_risk_snapshots", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  portfolioId: integer("portfolio_id").notNull().references(() => investingPortfoliosTable.id, { onDelete: "cascade" }),
  overallScore: real("overall_score"),
  analysisJson: jsonb("analysis_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("investing_risk_snapshots_user_id_idx").on(table.userId),
  index("investing_risk_snapshots_portfolio_id_idx").on(table.portfolioId),
]);

export const insertInvestingRiskSnapshotSchema = createInsertSchema(investingRiskSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInvestingRiskSnapshot = z.infer<typeof insertInvestingRiskSnapshotSchema>;
export type InvestingRiskSnapshotRow = typeof investingRiskSnapshotsTable.$inferSelect;
