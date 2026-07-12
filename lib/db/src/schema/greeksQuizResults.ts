import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A graded Greeks/strategy quiz attempt. Used to track learning progress in the
// Greeks Tutor.
export const greeksQuizResultsTable = pgTable("greeks_quiz_results", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull().default("mixed"),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  percent: real("percent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGreeksQuizResultSchema = createInsertSchema(greeksQuizResultsTable).omit({ id: true, createdAt: true });
export type InsertGreeksQuizResult = z.infer<typeof insertGreeksQuizResultSchema>;
export type GreeksQuizResult = typeof greeksQuizResultsTable.$inferSelect;
