import { pgTable, serial, uuid, text, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// A graded Greeks/strategy quiz attempt. Used to track learning progress in the
// Greeks Tutor.
export const greeksQuizResultsTable = pgTable("greeks_quiz_results", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  topic: text("topic").notNull().default("mixed"),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  percent: real("percent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("greeks_quiz_results_user_id_idx").on(table.userId),
]);

export const insertGreeksQuizResultSchema = createInsertSchema(greeksQuizResultsTable).omit({ id: true, createdAt: true });
export type InsertGreeksQuizResult = z.infer<typeof insertGreeksQuizResultSchema>;
export type GreeksQuizResult = typeof greeksQuizResultsTable.$inferSelect;
