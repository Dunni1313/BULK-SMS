import { pgTable, serial, uuid, text, real, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
//
// The ONE genuinely new persistence primitive this phase introduces: a
// user-defined, editable POLICY (a named limit against an already-computed
// figure from an existing engine). Every prior phase's own thresholds
// (Phase 40's Executive Alerts, Phase 2 Sprint 29's/Phase 3's own named
// concentration/risk caps) are hardcoded constants — no existing table lets
// a user set and persist their OWN limit. This table fills exactly that
// gap; it never stores a computed value itself (current values are always
// resolved fresh from lib/riskExposureEngine.ts/lib/decisionSupportEngine.ts/
// lib/portfolioDashboard.ts/lib/optionsIncomeAnalytics.ts on every read —
// see lib/complianceEngine.ts).
//
// `policyType` is free text, not a DB enum (matching
// investing_filing_analysis.filing_type's/trading_positions.instrument_type's
// own established precedent), so a future policy type needs no schema
// change — see lib/compliancePolicies.ts's own POLICY_TYPE_META for the
// fixed, documented set this phase actually implements.
//
// `targetKey` is genuinely nullable: for policy types scoped to a specific
// named entity (a sector, a symbol, a strategy), it holds that entity's
// key; null means "apply this policy to whichever entity of this type
// currently has the highest/most-extreme value" (a blanket rule), honestly
// resolved at evaluation time, never defaulted to a fabricated entity name.
//
// `direction` is "max" (current value must not exceed limitValue) or "min"
// (current value must not fall below limitValue) — both are real,
// requested policy shapes (e.g. "Minimum diversification score").
//
// Brand-new table: NOT NULL from creation except the genuinely-nullable
// targetKey, no nullable->backfill->enforce migration needed (same
// precedent as platform_audit_log/investing_filing_analysis). userId
// mandatory + ON DELETE RESTRICT, matching every other user-scoped table.
export const compliancePoliciesTable = pgTable(
  "compliance_policies",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    policyType: text("policy_type").notNull(),
    label: text("label").notNull(),
    targetKey: text("target_key"),
    direction: text("direction").notNull().default("max"),
    limitValue: real("limit_value").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("compliance_policies_user_id_idx").on(table.userId)],
);

export const insertCompliancePolicySchema = createInsertSchema(compliancePoliciesTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompliancePolicy = z.infer<typeof insertCompliancePolicySchema>;
export type CompliancePolicyRow = typeof compliancePoliciesTable.$inferSelect;
