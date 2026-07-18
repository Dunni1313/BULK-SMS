import { pgTable, serial, uuid, text, boolean, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 11 — Live Market Operations & Production Validation. "Add
// reconciliation reports" — a persisted history of GET /broker/reconciliation
// runs (lib/brokerReconciliation.ts's own buildReconciliation(), completely
// unmodified), so drift between the local trades table and Alpaca's own
// orders/positions is visible over time, not only in the current live
// comparison. Explicit-trigger-only, matching this platform's own
// established never-auto-persist-without-a-user-action discipline
// (Sprint 27/44 precedent) — nothing writes here except a real POST to
// /broker/reconciliation/reports.
//
// Brand-new table, NOT NULL from creation (except the genuinely-optional
// unavailableReason), no backfill needed. user_id mandatory, ON DELETE
// RESTRICT — matches every other user-scoped table's convention.
//
// detailJson holds the full ReconciliationResult (every order/position
// entry, for drill-down); the promoted headline columns
// (issueCount/fullyReconciled/localOrdersConsidered/brokerOrdersConsidered)
// let a list view show summary figures without deserializing the jsonb
// blob for every row — the same "jsonb blob plus promoted headline
// columns" pattern stock_analysis_history/trading_backtest_results already
// established.
export const brokerReconciliationReportsTable = pgTable(
  "broker_reconciliation_reports",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    available: boolean("available").notNull(),
    unavailableReason: text("unavailable_reason"),
    localOrdersConsidered: integer("local_orders_considered").notNull(),
    brokerOrdersConsidered: integer("broker_orders_considered").notNull(),
    issueCount: integer("issue_count").notNull(),
    fullyReconciled: boolean("fully_reconciled").notNull(),
    detailJson: jsonb("detail_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("broker_reconciliation_reports_user_id_idx").on(table.userId)],
);

export const insertBrokerReconciliationReportSchema = createInsertSchema(brokerReconciliationReportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBrokerReconciliationReport = z.infer<typeof insertBrokerReconciliationReportSchema>;
export type BrokerReconciliationReportRow = typeof brokerReconciliationReportsTable.$inferSelect;
