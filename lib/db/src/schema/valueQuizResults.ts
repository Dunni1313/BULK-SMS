import { pgTable, serial, uuid, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Task #66 — A graded Value Investing School quiz attempt. Mirrors
// greeksQuizResults: grading is server-authoritative (the quizId encodes the
// question ids; the answer key is never sent to the client). Education only.
export const valueQuizResultsTable = pgTable("value_quiz_results", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 3 — nullable multi-tenancy anchor. Not yet backfilled,
  // enforced, or read/written by any route (see the approved Phase 1 plan §2.5).
  userId: uuid("user_id"),
  topic: text("topic").notNull().default("mixed"),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  percent: real("percent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertValueQuizResultSchema = createInsertSchema(valueQuizResultsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertValueQuizResult = z.infer<typeof insertValueQuizResultSchema>;
export type ValueQuizResult = typeof valueQuizResultsTable.$inferSelect;
