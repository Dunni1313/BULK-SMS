import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Phase 1, Sprint 6 — Better-Auth's `session` model (lib/auth/src/index.ts:
// modelName "sessions"). A new table, not one of the 13 existing user-scoped
// tables from Sprint 3/4 — auth-plumbing, not business data, so ON DELETE
// CASCADE is deliberate here (unlike the ON DELETE RESTRICT convention for
// trades/journal/etc. in §2.4, which exists to protect financial/audit
// history — a session has no such retention concern and should simply not
// outlive the user it belongs to).
export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
]);

export type Session = typeof sessionsTable.$inferSelect;
