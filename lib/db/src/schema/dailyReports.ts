import { pgTable, serial, text, real, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Task #38 — Portfolio AI. A persisted snapshot of a generated Daily Report.
// The full structured report (summary, positions, risk, market briefing,
// opportunities, trades-to-avoid, adjustments) lives in `payload` as JSON; the
// scalar columns are denormalised for cheap listing/sorting on the history view.
export const dailyReportsTable = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  reportDate: text("report_date").notNull(), // YYYY-MM-DD
  healthScore: integer("health_score").notNull().default(0),
  healthLabel: text("health_label").notNull().default("Unknown"),
  exposureScore: integer("exposure_score").notNull().default(0),
  riskScore: integer("risk_score").notNull().default(0),
  openPositions: integer("open_positions").notNull().default(0),
  redCount: integer("red_count").notNull().default(0),
  yellowCount: integer("yellow_count").notNull().default(0),
  netTheta: real("net_theta").notNull().default(0),
  briefing: text("briefing").notNull().default(""),
  briefingSource: text("briefing_source").notNull().default("template"), // llm | template
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyReportSchema = createInsertSchema(dailyReportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type DailyReportRow = typeof dailyReportsTable.$inferSelect;
