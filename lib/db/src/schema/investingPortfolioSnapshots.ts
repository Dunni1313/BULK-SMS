import { pgTable, serial, uuid, integer, real, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { investingPortfoliosTable } from "./investingPortfolios";

// Phase 13 — Institutional Portfolio Manager. A user-saved point-in-time
// composite snapshot of a portfolio's Quality/Risk/Diversification scores
// and headline allocation figures, written only via an explicit "Save
// Snapshot" action — the same never-persist-unless-asked discipline
// investing_risk_snapshots (Phase 2, Sprint 29) already established.
//
// Deliberately a SEPARATE table from investing_risk_snapshots, not an
// extension of it: that table is scoped specifically to
// PortfolioRiskAnalysis (concentration/sector/beta) and stays untouched;
// this one captures the broader Quality + extended Risk + Diversification
// + allocation composite lib/portfolioIntelligence.ts produces. Both can
// coexist for the same portfolio without conflict or duplication.
//
// `analysisJson` holds the full PortfolioIntelligenceAnalysis object (same
// jsonb-blob-plus-headline-columns pattern as investing_risk_snapshots);
// qualityScore/riskScore/diversificationScore/totalMarketValue/
// holdingsCount are promoted to their own nullable columns so a history
// list can be rendered/sorted without deserializing the blob.
//
// Brand-new table: NOT NULL from creation (except the genuinely-nullable
// score/value columns, honest when a component couldn't be scored), no
// nullable->backfill->enforce migration needed (same precedent as
// investing_risk_snapshots). `userId` is mandatory + ON DELETE RESTRICT;
// `portfolioId` uses ON DELETE CASCADE, matching investing_holdings' and
// investing_risk_snapshots' own precedent.
export const investingPortfolioSnapshotsTable = pgTable("investing_portfolio_snapshots", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  portfolioId: integer("portfolio_id").notNull().references(() => investingPortfoliosTable.id, { onDelete: "cascade" }),
  qualityScore: real("quality_score"),
  riskScore: real("risk_score"),
  diversificationScore: real("diversification_score"),
  totalMarketValue: real("total_market_value"),
  holdingsCount: integer("holdings_count").notNull().default(0),
  analysisJson: jsonb("analysis_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("investing_portfolio_snapshots_user_id_idx").on(table.userId),
  index("investing_portfolio_snapshots_portfolio_id_idx").on(table.portfolioId),
]);

export const insertInvestingPortfolioSnapshotSchema = createInsertSchema(investingPortfolioSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInvestingPortfolioSnapshot = z.infer<typeof insertInvestingPortfolioSnapshotSchema>;
export type InvestingPortfolioSnapshotRow = typeof investingPortfolioSnapshotsTable.$inferSelect;
