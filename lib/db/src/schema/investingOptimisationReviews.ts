import { pgTable, serial, uuid, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { investingPortfoliosTable } from "./investingPortfolios";

// Phase 18 — Institutional Portfolio Optimisation Engine. A user-saved
// point-in-time record of an optimisation decision (upgrade/trim/exit/
// replace/note) for one symbol within one portfolio, plus the evidence that
// was shown at the moment it was saved — mirrors investing_decision_snapshots'
// (Phase 14) own headline-columns-plus-jsonb-blob pattern exactly, scoped to
// a portfolio + symbol pair instead of a bare symbol.
//
// Deliberately a separate table from investing_portfolio_notes (Phase 13):
// that table is generic free text with no symbol or action linkage; this one
// is a structured, evidence-attached record of a specific optimisation
// candidate's review, the same "don't force-fit a new concept into an
// existing table with a different shape" precedent this project has
// followed since Sprint 49 (Options Backtest getting its own table rather
// than reusing Engine 2's Trading Backtest table).
//
// Brand-new table: NOT NULL from creation except the genuinely-optional
// `symbol` (a portfolio-level review, e.g. "overall allocation looks fine
// this quarter," has no single candidate symbol). userId mandatory + ON
// DELETE RESTRICT (universal convention). portfolioId uses ON DELETE
// CASCADE, matching investing_holdings'/investing_portfolio_notes' own
// precedent — a review attached to a deleted portfolio goes with it.
export const investingOptimisationReviewsTable = pgTable(
  "investing_optimisation_reviews",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    portfolioId: integer("portfolio_id").notNull().references(() => investingPortfoliosTable.id, { onDelete: "cascade" }),
    symbol: text("symbol"),
    action: text("action").notNull(),
    note: text("note").notNull(),
    evidenceJson: jsonb("evidence_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("investing_optimisation_reviews_user_id_idx").on(table.userId),
    index("investing_optimisation_reviews_portfolio_id_idx").on(table.portfolioId),
  ],
);

export const insertInvestingOptimisationReviewSchema = createInsertSchema(investingOptimisationReviewsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInvestingOptimisationReview = z.infer<typeof insertInvestingOptimisationReviewSchema>;
export type InvestingOptimisationReviewRow = typeof investingOptimisationReviewsTable.$inferSelect;
