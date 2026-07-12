import { pgTable, serial, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 1, Sprint 10 — a generalized audit log for the *platform*, not just
// options automation (see docs/Phase-1-Foundation-Execution-Plan.md §6.2).
// Deliberately separate from autoExecutionLog (Phase 6's kill-switch audit
// trail), which is NOT modified, migrated, or merged into this table — see
// CLAUDE.md rule 3 and the plan's §6.1/§6.3.
//
// userId is nullable specifically for system-level events with no acting user
// (e.g. a scheduled job's own lifecycle), not for any per-user action within
// one. ON DELETE SET NULL (not RESTRICT, unlike every other user-scoped
// table): an audit trail's job is to survive the thing it's auditing — if a
// user is ever deleted, the row should outlive them (losing only its
// attribution), not block the deletion or vanish with it.
export const platformAuditLogTable = pgTable("platform_audit_log", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  engine: text("engine").notNull(), // options_income | trading | investing | platform
  eventType: text("event_type").notNull(), // e.g. auth.login, settings.updated
  action: text("action").notNull(), // created | updated | deleted | executed | viewed | rejected | blocked
  result: text("result").notNull(), // success | failure | blocked
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  reason: text("reason"),
  runId: text("run_id"),
  // Structured, engine-specific payload. NEVER passwords, tokens, API keys,
  // cookies, or raw request bodies — callers must only pass already-sanitized
  // fields (e.g. changed field NAMES, not their values).
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("platform_audit_log_user_id_created_at_idx").on(table.userId, table.createdAt),
  index("platform_audit_log_engine_event_type_created_at_idx").on(
    table.engine,
    table.eventType,
    table.createdAt,
  ),
]);

export const insertPlatformAuditLogSchema = createInsertSchema(platformAuditLogTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlatformAuditLog = z.infer<typeof insertPlatformAuditLogSchema>;
export type PlatformAuditLogEntry = typeof platformAuditLogTable.$inferSelect;
