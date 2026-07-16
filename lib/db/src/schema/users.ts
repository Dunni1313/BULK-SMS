import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Phase 1 — Foundation. The users table is the multi-tenancy anchor: every
// user-owned table (trades, settings, journal, etc.) references this via a
// user_id foreign key (Sprint 3+).
//
// Uses uuid (unlike every other table's serial id) so user identifiers are
// non-guessable and safe to expose in tokens/URLs — a deliberate departure
// from the existing serial-id convention, called out as Owner Decision #5 in
// the approved Phase 1 Foundation plan.
//
// Phase 1, Sprint 6 — this is now Better-Auth's `user` model (see
// lib/auth/src/index.ts's drizzleAdapter config: modelName "users",
// fields.name -> displayName). emailVerified and image are Better-Auth's
// required base fields; role is exposed to it as an additionalField
// (input: false, so a client can never self-assign a role at signup).
//
// authProvider, externalId, and passwordHash predate the Sprint 6 provider
// decision and are NOT read or written by Better-Auth: it stores per-provider
// credentials (including hashed passwords) on the new `accounts` table
// instead, so more than one auth method can be linked to one user. Left in
// place, unused, rather than dropped — flag before removing in a later sprint.
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // NOT NULL: Better-Auth's `name` field is required (verified against its own
  // schema and its @better-auth/cli generate output, which independently
  // generates this same column as NOT NULL). Every existing row already has
  // one (the Sprint 4 legacy-owner backfill set it), and every future row
  // is created either by that backfill or by Better-Auth's signup flow,
  // which always supplies it.
  displayName: text("display_name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Vestigial — see the file comment above. Not read or written by Better-Auth.
  authProvider: text("auth_provider").notNull().default("password"),
  externalId: text("external_id"),
  passwordHash: text("password_hash"),
  // Forward-looking; not enforced by any route in Phase 1. Exposed to
  // Better-Auth as a read-only additionalField (see lib/auth).
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
