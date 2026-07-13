import { pgTable, serial, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 2, Sprint 22 — Document Intelligence Engine (approved Phase 2 plan,
// Sprint 22). A persisted record of a generated filing analysis for a single
// symbol/document. `sectionsJson` holds the extracted Business/Risk Factors/
// MD&A sections (raw text + deterministic excerpt); `summaryJson` holds the
// deterministic executive summary and reused key financial highlights.
//
// `filingType` is a free-text discriminator (not a DB enum) so future document
// types (10-Q, earnings-transcript, investor-presentation, sustainability-
// report, management-commentary) plug into this same table without a schema
// change — only documentProviders.ts needs a new provider implementation.
//
// Brand-new table: NOT NULL from creation, no nullable->backfill->enforce
// migration needed (same precedent as platform_audit_log, Sprint 10).
// userId is mandatory + ON DELETE RESTRICT, matching stock_analysis_history's
// established per-user-history convention — the underlying filing content is
// objectively shared across users, but this table is "your research history,"
// not a shared cache (the actual EDGAR-fetch dedup happens in an in-process
// cache in filingAnalysis.ts, not here).
export const investingFilingAnalysisTable = pgTable("investing_filing_analysis", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  filingType: text("filing_type").notNull(),
  filingDate: text("filing_date"), // YYYY-MM-DD, null when no filing was found
  sourceUrl: text("source_url"),
  sectionsJson: jsonb("sections_json").notNull(),
  summaryJson: jsonb("summary_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("investing_filing_analysis_user_id_idx").on(table.userId),
  index("investing_filing_analysis_symbol_filing_type_idx").on(table.symbol, table.filingType),
]);

export const insertInvestingFilingAnalysisSchema = createInsertSchema(investingFilingAnalysisTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInvestingFilingAnalysis = z.infer<typeof insertInvestingFilingAnalysisSchema>;
export type InvestingFilingAnalysisRow = typeof investingFilingAnalysisTable.$inferSelect;
