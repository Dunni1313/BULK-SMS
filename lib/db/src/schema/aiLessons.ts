import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Persisted coaching output — every explanation, greek lesson, or journal review
// the AI Trading Coach produces is saved here so the user can revisit what they
// have learned on the Trade Lessons page.
export const aiLessonsTable = pgTable("ai_lessons", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  kind: text("kind").notNull().default("lesson"), // trade_explanation | greek | journal_review | quiz
  topic: text("topic").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("template"), // llm | template
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ai_lessons_user_id_idx").on(table.userId),
]);

export const insertAiLessonSchema = createInsertSchema(aiLessonsTable).omit({ id: true, createdAt: true });
export type InsertAiLesson = z.infer<typeof insertAiLessonSchema>;
export type AiLesson = typeof aiLessonsTable.$inferSelect;
