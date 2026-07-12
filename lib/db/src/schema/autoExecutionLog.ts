import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Phase 6 — audit trail for the Full-Auto engine. Every cycle records one row per
// decision: a single "blocked" row when a guardrail halts the whole cycle, or one
// "executed" / "skipped" / "rejected" row per candidate evaluated.
export const autoExecutionLogTable = pgTable("auto_execution_log", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull(),
  // Which auto engine wrote the row: "open" = full-auto opening engine,
  // "adjust" = auto-adjustment engine. Defaults to "open" for backward compat
  // with rows written before the adjustment engine existed.
  kind: text("kind").notNull().default("open"), // open | adjust
  decision: text("decision").notNull(), // executed | skipped | rejected | blocked
  reason: text("reason").notNull(),
  symbol: text("symbol"),
  strategy: text("strategy"),
  ravishScore: real("ravish_score").notNull().default(0),
  tradeId: integer("trade_id"),
  alpacaOrderId: text("alpaca_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAutoExecutionLogSchema = createInsertSchema(autoExecutionLogTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAutoExecutionLog = z.infer<typeof insertAutoExecutionLogSchema>;
export type AutoExecutionLogEntry = typeof autoExecutionLogTable.$inferSelect;
