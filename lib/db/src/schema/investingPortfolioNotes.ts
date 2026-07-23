import { pgTable, serial, uuid, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { investingPortfoliosTable } from "./investingPortfolios";

// Phase 13 — Institutional Portfolio Manager. Free-text, per-user,
// per-portfolio notes — mirrors investing_research_notes (Phase 12)
// exactly, scoped to a portfolio instead of a symbol. Never AI-generated;
// the user's own durable record.
//
// Brand-new table: NOT NULL from creation, no backfill needed. `userId`
// mandatory + ON DELETE RESTRICT. `portfolioId` uses ON DELETE CASCADE,
// matching investing_holdings'/investing_risk_snapshots' own precedent —
// a note attached to a deleted portfolio goes with it.
export const investingPortfolioNotesTable = pgTable("investing_portfolio_notes", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  portfolioId: integer("portfolio_id").notNull().references(() => investingPortfoliosTable.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("investing_portfolio_notes_user_id_idx").on(table.userId),
  index("investing_portfolio_notes_portfolio_id_idx").on(table.portfolioId),
]);

export const insertInvestingPortfolioNoteSchema = createInsertSchema(investingPortfolioNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingPortfolioNote = z.infer<typeof insertInvestingPortfolioNoteSchema>;
export type InvestingPortfolioNoteRow = typeof investingPortfolioNotesTable.$inferSelect;
