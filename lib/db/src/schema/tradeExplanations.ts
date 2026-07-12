import { pgTable, serial, uuid, text, integer, real, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// A saved "Explain This Trade" result: the deterministic structured summary plus
// the narrative the coach produced. Read-only artifact — explaining a trade never
// creates, previews, or submits an order.
export const tradeExplanationsTable = pgTable("trade_explanations", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull(),
  scannerResultId: integer("scanner_result_id"),
  ravishScore: real("ravish_score").notNull().default(0),
  pop: real("pop").notNull().default(0),
  maxLoss: real("max_loss").notNull().default(0),
  summary: jsonb("summary").notNull().default({}),
  narrative: text("narrative").notNull(),
  source: text("source").notNull().default("template"), // llm | template
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("trade_explanations_user_id_idx").on(table.userId),
]);

export const insertTradeExplanationSchema = createInsertSchema(tradeExplanationsTable).omit({ id: true, createdAt: true });
export type InsertTradeExplanation = z.infer<typeof insertTradeExplanationSchema>;
export type TradeExplanation = typeof tradeExplanationsTable.$inferSelect;
