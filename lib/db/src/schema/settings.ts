import { pgTable, serial, uuid, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 5 — settings is now per-user, not a singleton (see the
  // approved Phase 1 plan §2.3). The unique constraint replaces "always the
  // first row" with "always the one row for this user" — same one-row-per-
  // owner shape, now correctly scoped. ON DELETE RESTRICT per §2.4.
  userId: uuid("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "restrict" }),
  executionMode: text("execution_mode").notNull().default("manual"),
  maxRiskPerTrade: real("max_risk_per_trade").notNull().default(1.0),
  maxPortfolioRisk: real("max_portfolio_risk").notNull().default(10.0),
  profitTarget50: real("profit_target_50").notNull().default(50.0),
  profitTarget75: real("profit_target_75").notNull().default(75.0),
  profitTarget90: real("profit_target_90").notNull().default(90.0),
  stopLossMultiplier: real("stop_loss_multiplier").notNull().default(2.0),
  alpacaConnected: boolean("alpaca_connected").notNull().default(false),
  alpacaApiKey: text("alpaca_api_key"),
  scannerMode: text("scanner_mode").notNull().default("mock"),
  marketDataProvider: text("market_data_provider").notNull().default("mock"),
  defaultDte: integer("default_dte").notNull().default(45),
  shortDelta: real("short_delta").notNull().default(0.20),
  minIvRank: real("min_iv_rank").notNull().default(30.0),
  // Phase 6 — Full-Auto guardrails. The master switch (autoExecuteEnabled) is the
  // kill switch: even in full_auto mode nothing auto-submits unless it is armed.
  autoExecuteEnabled: boolean("auto_execute_enabled").notNull().default(false),
  autoMaxTradesPerDay: integer("auto_max_trades_per_day").notNull().default(5),
  autoMaxConcurrentPositions: integer("auto_max_concurrent_positions").notNull().default(10),
  autoMinRavishScore: real("auto_min_ravish_score").notNull().default(68.0),
  autoMaxDailyLossPct: real("auto_max_daily_loss_pct").notNull().default(5.0),
  autoQuantityPerTrade: integer("auto_quantity_per_trade").notNull().default(1),
  // Task #20 — Trade Adjustment Engine triggers. All have defaults so existing
  // settings rows keep working without a manual backfill.
  adjDeltaDriftTrigger: real("adj_delta_drift_trigger").notNull().default(0.30),
  adjPopDropTrigger: real("adj_pop_drop_trigger").notNull().default(15.0),
  adjShortStrikeProximityPct: real("adj_short_strike_proximity_pct").notNull().default(2.0),
  adjIvExpansionTrigger: real("adj_iv_expansion_trigger").notNull().default(25.0),
  adjDteTrigger: integer("adj_dte_trigger").notNull().default(21),
  // Master switch for the auto-adjustment loop (separate from autoExecuteEnabled,
  // which arms opening trades). Auto-adjust only ever closes / de-risks positions.
  autoAdjustEnabled: boolean("auto_adjust_enabled").notNull().default(false),
  // Event Risk Filter (earnings / FOMC / CPI / jobs / dividends / major events).
  // All default-on and additive for backward compat.
  eventRiskEnabled: boolean("event_risk_enabled").notNull().default(true),
  eventRiskBlockEarningsShortPremium: boolean("event_risk_block_earnings_short_premium").notNull().default(true),
  eventRiskAutoBlockHigh: boolean("event_risk_auto_block_high").notNull().default(true),
  // Task #66 — Value-investing fundamentals data provider. Today only the
  // SIMULATED provider exists; these are forward-looking placeholders so a future
  // live fundamentals feed can be selected without a schema change. All default so
  // existing settings rows keep working.
  fundamentalsProvider: text("fundamentals_provider").notNull().default("simulated"),
  fundamentalsConnected: boolean("fundamentals_connected").notNull().default(false),
  fundamentalsApiKey: text("fundamentals_api_key"),
  // How old (in hours) live fundamentals may be before the UI flags them as
  // stale and nudges a refresh. Operator-tunable; defaults to 24h.
  fundamentalsStalenessHours: integer("fundamentals_staleness_hours").notNull().default(24),
  // When a LIVE provider is connected, auto re-fetch the coverage universe once its
  // data crosses the staleness threshold (default on; subject to a client-side
  // cooldown + the server's live cache so it never spams the provider). No effect
  // for SIMULATED data, which has no freshness concept.
  fundamentalsAutoRefresh: boolean("fundamentals_auto_refresh").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
