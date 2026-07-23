// Phase 24 — Institutional Trading Engine Foundation.
//
// Alert service boundary. Fully satisfied by reuse already — no new code
// needed. lib/notifications.ts's evaluateRiskAlerts() (Sprint 56) already
// reads directly from trading_positions and Engine 2's own
// computeTradingRisk(), and every alert — Engine 1's watchlist crossings,
// Engine 2's risk breaches, or any future Engine 2 alert type — is
// persisted through the same shared platform_notifications table and
// surfaced through the same NotificationBell.tsx. Engine 2 does not need,
// and should not get, its own parallel alert table or delivery mechanism.
//
// This file exists only to document that reuse decision at the same
// service-boundary granularity as every other file in lib/trading/, and
// to give a future Engine 2 module one stable import point rather than
// reaching into lib/notifications.ts directly.

export {
  evaluateWatchlistAlerts,
  evaluateRiskAlerts,
  evaluateAndPersistAlertsForUser,
} from "../notifications.js";
