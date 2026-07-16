import { pgTable, serial, uuid, text, real, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const scannerResultsTable = pgTable("scanner_results", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull(),
  expiration: text("expiration"),
  daysToExpiry: integer("days_to_expiry"),
  shortPutStrike: real("short_put_strike"),
  shortCallStrike: real("short_call_strike"),
  longPutStrike: real("long_put_strike"),
  longCallStrike: real("long_call_strike"),
  credit: real("credit"),
  maxProfit: real("max_profit").notNull().default(0),
  maxLoss: real("max_loss").notNull().default(0),
  pop: real("pop").notNull().default(0),
  ev: real("ev").notNull().default(0),
  theta: real("theta").notNull().default(0),
  vega: real("vega"),
  ivRank: real("iv_rank").notNull().default(0),
  ravishScore: real("ravish_score").notNull().default(0),
  ravishTier: text("ravish_tier").notNull().default("ignore"),
  returnOnCapital: real("return_on_capital"),
  eventRiskLevel: text("event_risk_level").notNull().default("none"),
  eventRiskPenalty: real("event_risk_penalty").notNull().default(0),
  eventRiskEvents: jsonb("event_risk_events").notNull().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("scanner_results_user_id_idx").on(table.userId),
]);

export const insertScannerResultSchema = createInsertSchema(scannerResultsTable).omit({ id: true, createdAt: true });
export type InsertScannerResult = z.infer<typeof insertScannerResultSchema>;
export type ScannerResult = typeof scannerResultsTable.$inferSelect;
