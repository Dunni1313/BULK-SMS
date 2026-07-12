import { pgTable, serial, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A saved "Explain This Trade" result: the deterministic structured summary plus
// the narrative the coach produced. Read-only artifact — explaining a trade never
// creates, previews, or submits an order.
export const tradeExplanationsTable = pgTable("trade_explanations", {
  id: serial("id").primaryKey(),
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
});

export const insertTradeExplanationSchema = createInsertSchema(tradeExplanationsTable).omit({ id: true, createdAt: true });
export type InsertTradeExplanation = z.infer<typeof insertTradeExplanationSchema>;
export type TradeExplanation = typeof tradeExplanationsTable.$inferSelect;
