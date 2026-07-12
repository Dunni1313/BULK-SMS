import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Persisted coaching output — every explanation, greek lesson, or journal review
// the AI Trading Coach produces is saved here so the user can revisit what they
// have learned on the Trade Lessons page.
export const aiLessonsTable = pgTable("ai_lessons", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("lesson"), // trade_explanation | greek | journal_review | quiz
  topic: text("topic").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("template"), // llm | template
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiLessonSchema = createInsertSchema(aiLessonsTable).omit({ id: true, createdAt: true });
export type InsertAiLesson = z.infer<typeof insertAiLessonSchema>;
export type AiLesson = typeof aiLessonsTable.$inferSelect;
