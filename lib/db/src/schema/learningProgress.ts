import { pgTable, serial, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// AI Teacher & Learning Centre sprint — Learning Progress. The ONLY
// user-state mutation this sprint introduces, per the sprint's own
// explicit instruction ("This is the only permitted user-state
// mutation"). Quiz scores are NOT duplicated here — they already have
// their own dedicated tables (greeks_quiz_results, value_quiz_results,
// both pre-existing) which lib/learningProgress.ts reads directly
// rather than re-storing.
//
// One row per (user_id, item_type, item_key), upserted on view/complete
// — never a growing event log, since the Learning Progress feature only
// needs "has this been viewed/completed and when," not a full history
// of every individual view.
export const learningProgressTable = pgTable(
  "learning_progress",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    itemType: text("item_type").notNull(), // lesson | glossary | path | strategy
    itemKey: text("item_key").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("learning_progress_user_id_idx").on(table.userId),
    uniqueIndex("learning_progress_user_item_idx").on(table.userId, table.itemType, table.itemKey),
  ],
);

export const insertLearningProgressSchema = createInsertSchema(learningProgressTable).omit({ id: true, updatedAt: true });
export type InsertLearningProgress = z.infer<typeof insertLearningProgressSchema>;
export type LearningProgressRow = typeof learningProgressTable.$inferSelect;
