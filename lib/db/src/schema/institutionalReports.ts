import { pgTable, serial, uuid, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 22 — Institutional Reporting & Client Presentation Engine. A
// user-saved, point-in-time snapshot of a generated InstitutionalReport
// (lib/institutionalReporting.ts) — mirrors daily_reports' own
// headline-columns-plus-jsonb-payload pattern exactly (Phase 3's Portfolio
// AI Daily Report precedent): `payload` holds the FULL structured report
// (every ReportSection, verbatim), the scalar columns exist only so a
// history/list view can query cheaply without deserialising `payload`.
//
// Brand-new table: NOT NULL from creation except the genuinely-optional
// `symbol`/`portfolioId` (a report type may be scoped to neither, e.g. the
// Watchlist Report or the AI Coach Learning Summary). userId mandatory + ON
// DELETE RESTRICT (universal convention, same as every other user-owned
// history table since Sprint 4). No foreign key to investing_portfolios —
// portfolioId is stored as a loose reference (mirrors journal_entries.trade_id's
// and trading_journal_entries.trading_position_id's own established
// precedent of an unenforced cross-reference) since a saved report should
// survive even if the portfolio it was generated from is later deleted or
// renamed.
export const institutionalReportsTable = pgTable(
  "institutional_reports",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    reportType: text("report_type").notNull(),
    title: text("title").notNull(),
    symbol: text("symbol"),
    portfolioId: integer("portfolio_id"),
    dataSource: text("data_source").notNull().default("MIXED"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("institutional_reports_user_id_idx").on(table.userId),
    index("institutional_reports_report_type_idx").on(table.reportType),
  ],
);

export const insertInstitutionalReportSchema = createInsertSchema(institutionalReportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInstitutionalReport = z.infer<typeof insertInstitutionalReportSchema>;
export type InstitutionalReportRow = typeof institutionalReportsTable.$inferSelect;
