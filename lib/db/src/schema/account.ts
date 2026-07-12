import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Phase 1, Sprint 6 — Better-Auth's `account` model (lib/auth/src/index.ts:
// modelName "accounts"). One row per linked auth method for a user (e.g. an
// email/password credential, or later a Google/GitHub OAuth link) — this is
// where Better-Auth stores the hashed password for credential sign-in
// (`password`), not on `users`. ON DELETE CASCADE: see session.ts's comment,
// same reasoning (auth-plumbing, not business/financial data).
export const accountsTable = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("accounts_user_id_idx").on(table.userId),
]);

export type Account = typeof accountsTable.$inferSelect;
