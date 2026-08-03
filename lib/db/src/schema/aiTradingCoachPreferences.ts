import { pgTable, serial, uuid, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. One row per user,
// durable across sessions (never resets daily) — see
// 045_ai_trading_coach.sql's own header comment for the full reuse-audit
// rationale on why no existing table/Settings field could hold this.
export const aiTradingCoachPreferencesTable = pgTable(
  "ai_trading_coach_preferences",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    experienceLevel: text("experience_level").notNull().default("beginner"),
    beginnerModeEnabled: boolean("beginner_mode_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_trading_coach_preferences_user_id_idx").on(table.userId)],
);

export type AiTradingCoachPreferencesRow = typeof aiTradingCoachPreferencesTable.$inferSelect;
export type NewAiTradingCoachPreferencesRow = typeof aiTradingCoachPreferencesTable.$inferInsert;
