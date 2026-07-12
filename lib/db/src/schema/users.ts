import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Phase 1 — Foundation. The users table is the multi-tenancy anchor: every
// user-owned table (trades, settings, journal, etc.) will reference this via
// a user_id foreign key added in later Sprint 1 follow-ups (Sprint 3+). This
// table alone has no effect on any existing route or behavior — nothing reads
// or writes it yet.
//
// Uses uuid (unlike every other table's serial id) so user identifiers are
// non-guessable and safe to expose in tokens/URLs — a deliberate departure
// from the existing serial-id convention, called out as Owner Decision #5 in
// the approved Phase 1 Foundation plan.
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  // "password" | "oauth" | a specific provider name once Sprint 6 (auth
  // implementation) lands. Default keeps this table usable standalone before
  // the auth provider decision (Owner Decision #1) is finalized.
  authProvider: text("auth_provider").notNull().default("password"),
  // Populated only if a hosted auth provider (e.g. Clerk) is chosen.
  externalId: text("external_id"),
  // Populated only if self-hosted credential auth (e.g. Better-Auth) is chosen.
  passwordHash: text("password_hash"),
  // Forward-looking; not enforced by any route in Phase 1.
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
