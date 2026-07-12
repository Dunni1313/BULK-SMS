import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

// Phase 1, Sprint 6 — Better-Auth's `verification` model (lib/auth/src/index.ts:
// modelName "verifications"). Short-lived tokens (email verification, password
// reset, etc.), keyed by `identifier` (typically an email) rather than a
// user_id FK — a verification can exist before the user row it will apply to
// is fully resolved (e.g. an email-verification flow during signup).
export const verificationsTable = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("verifications_identifier_idx").on(table.identifier),
]);

export type Verification = typeof verificationsTable.$inferSelect;
