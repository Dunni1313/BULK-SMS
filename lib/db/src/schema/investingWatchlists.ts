import { pgTable, serial, uuid, text, integer, boolean, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
//
// The ONE genuinely new persistence primitive this phase introduces: named,
// taggable, manually-orderable watchlists. The existing value_watchlist
// table (Phase 2, Investing Engine) is a single flat per-user list with no
// multi-list, tag, category, or manual-ordering support — it is left
// completely untouched by this phase; these are deliberately separate,
// parallel tables, never a migration of that data.
//
// investing_watchlists is the list itself (a named collection). `kind` is
// a free-text label ("personal" | "institutional" by convention, not a DB
// enum, matching investing_filing_analysis.filing_type's/
// trading_positions.instrument_type's/compliance_policies.policy_type's
// own established precedent) — both kinds remain owned by and scoped to
// the single authenticated user; this platform has no multi-user sharing
// or permission model, and none is introduced here. "Institutional" is a
// user's own label for a list they treat as an institutional/desk-level
// watchlist, not a literal shared-across-users construct.
//
// investing_watchlist_items are the symbols within a list, each carrying
// its own category/tags/notes/manual sortOrder. `tags` is a jsonb string
// array (matching trading_strategies.ts's own established
// jsonb(...).notNull().$type<string[]>() pattern for array-typed columns
// in this codebase, rather than native Postgres text[] or a separate
// many-to-many join table — a single list rarely holds more than a
// handful of tags per symbol, so a join table would be pure overhead).
//
// watchlist_id -> investing_watchlists.id is deliberately ON DELETE
// CASCADE (a deviation from the otherwise-universal ON DELETE RESTRICT
// convention) — the same precedent investing_holdings ->
// investing_portfolios (Phase 2 Sprint 28) and trading_positions'
// portfolio-scoped children (Phase 3) already established: deleting your
// own watchlist is routine self-service cleanup on your own sub-resource,
// functionally distinct from the whole-user-deletion scenario RESTRICT
// protects against. user_id -> users.id stays RESTRICT on both new
// tables, no exception there. item.user_id is a deliberate denormalized
// duplicate of the parent watchlist's own user_id (not derived via a
// join), so tenant-isolation queries against investing_watchlist_items
// can filter directly on user_id without a join, matching this
// codebase's own established per-table ownership-scoping discipline
// (getScopedUserId(req) + and(eq(id), eq(userId)) on every table).
//
// A unique (watchlist_id, symbol) constraint prevents the same symbol
// being added to the same list twice; adding it to a second list is fine
// and expected.
//
// Brand-new tables: NOT NULL from creation except no genuinely-nullable
// column exists here, no nullable->backfill->enforce migration needed
// (same precedent as platform_audit_log/investing_filing_analysis/
// compliance_policies).
export const investingWatchlistsTable = pgTable(
  "investing_watchlists",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("personal"),
    description: text("description").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("investing_watchlists_user_id_idx").on(table.userId)],
);

export const investingWatchlistItemsTable = pgTable(
  "investing_watchlist_items",
  {
    id: serial("id").primaryKey(),
    watchlistId: integer("watchlist_id")
      .notNull()
      .references(() => investingWatchlistsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    category: text("category").notNull().default(""),
    tags: jsonb("tags").notNull().default([]).$type<string[]>(),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("investing_watchlist_items_watchlist_id_idx").on(table.watchlistId),
    index("investing_watchlist_items_user_id_idx").on(table.userId),
    unique("investing_watchlist_items_watchlist_symbol_unique").on(table.watchlistId, table.symbol),
  ],
);

export const insertInvestingWatchlistSchema = createInsertSchema(investingWatchlistsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingWatchlist = z.infer<typeof insertInvestingWatchlistSchema>;
export type InvestingWatchlistRow = typeof investingWatchlistsTable.$inferSelect;

export const insertInvestingWatchlistItemSchema = createInsertSchema(investingWatchlistItemsTable).omit({
  id: true,
  watchlistId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  addedAt: true,
});
export type InsertInvestingWatchlistItem = z.infer<typeof insertInvestingWatchlistItemSchema>;
export type InvestingWatchlistItemRow = typeof investingWatchlistItemsTable.$inferSelect;
