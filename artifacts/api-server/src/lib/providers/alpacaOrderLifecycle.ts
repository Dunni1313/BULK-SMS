// Normalized paper-order lifecycle model. Alpaca's own order `status` field
// uses a larger, more granular vocabulary than any consumer of this platform
// needs to branch on individually (see
// https://docs.alpaca.markets/docs/orders-at-alpaca — "new", "accepted",
// "pending_new", "accepted_for_bidding", "pending_cancel", "pending_replace",
// "replaced", "partially_filled", "filled", "done_for_day", "canceled",
// "expired", "rejected", "stopped", "suspended", "calculated"). This module
// is the single source of truth mapping that raw vocabulary down to the 9
// named buckets the reconciliation UI/service actually reasons about —
// reused by both alpacaBroker.ts (to attach a normalizedStatus to every
// order it returns) and brokerReconciliation.ts (to compare against local
// trade state) so the mapping is never duplicated or allowed to drift.
//
// Deliberately conservative: an Alpaca status string this mapping doesn't
// recognize (a future Alpaca API addition, or a malformed/unexpected value)
// maps to "unknown" rather than being silently guessed into one of the 8
// named buckets — never a fabricated classification.

export type NormalizedOrderStatus =
  | "new"
  | "accepted"
  | "pending"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected"
  | "expired"
  | "unknown";

const STATUS_MAP: Record<string, NormalizedOrderStatus> = {
  new: "new",
  accepted: "accepted",
  accepted_for_bidding: "accepted",
  calculated: "accepted",
  pending_new: "pending",
  pending_cancel: "pending",
  pending_replace: "pending",
  stopped: "pending",
  suspended: "pending",
  partially_filled: "partially_filled",
  filled: "filled",
  // Alpaca spells this without the second "l" ("canceled") — normalized here
  // to this codebase's own "cancelled" spelling (matching the Trading
  // Journal/Positions vocabulary already used elsewhere in this app).
  canceled: "cancelled",
  cancelled: "cancelled",
  rejected: "rejected",
  expired: "expired",
};

export function normalizeAlpacaOrderStatus(raw: string | null | undefined): NormalizedOrderStatus {
  if (!raw) return "unknown";
  return STATUS_MAP[raw.toLowerCase()] ?? "unknown";
}

// A small number of local trade rows use "pending"/"open"/"closed" as their
// own coarse status vocabulary (lib/db/src/schema/trades.ts) — this maps
// that vocabulary into the SAME normalized-status space so reconciliation
// can compare local vs. broker state on a shared, honest footing, without
// pretending finer-grained distinctions (e.g. "accepted" vs. "new") exist
// locally when they don't.
export type NormalizedLocalStatus = "pending" | "open" | "closed" | "unknown";

export function normalizeLocalTradeStatus(raw: string | null | undefined): NormalizedLocalStatus {
  if (raw === "pending" || raw === "open" || raw === "closed") return raw;
  return "unknown";
}

// Whether a given (local status, broker status) pair represents a genuine,
// worth-flagging contradiction — deliberately narrow and explicit rather
// than an exhaustive state machine, appropriate for this sprint's
// "foundation" scope (see docs/Alpaca-Paper-Trading-Architecture.md). Never
// flags a pairing this table doesn't explicitly know is a contradiction —
// an unrecognized/ambiguous combination is treated as consistent rather than
// guessed as a mismatch.
export function isStatusContradiction(
  local: NormalizedLocalStatus,
  broker: NormalizedOrderStatus,
): boolean {
  if (local === "unknown" || broker === "unknown") return false;
  // A trade the platform believes reached the market (open/closed) can never
  // legitimately correspond to a broker order that was rejected, cancelled,
  // or expired before ever filling — that's the clearest, least ambiguous
  // contradiction this data can reveal.
  if ((local === "open" || local === "closed") && (broker === "rejected" || broker === "cancelled" || broker === "expired")) {
    return true;
  }
  // A trade still marked "pending" locally (never observed to have filled)
  // whose broker order is actually fully filled means the local record is
  // stale — a real, worth-surfacing discrepancy.
  if (local === "pending" && broker === "filled") {
    return true;
  }
  return false;
}
