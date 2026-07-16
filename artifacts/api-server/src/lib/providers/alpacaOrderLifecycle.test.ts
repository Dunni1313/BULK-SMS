import { describe, it, expect } from "vitest";
import { normalizeAlpacaOrderStatus, normalizeLocalTradeStatus, isStatusContradiction } from "./alpacaOrderLifecycle.js";

describe("normalizeAlpacaOrderStatus", () => {
  it("maps every known Alpaca raw status to its correct bucket", () => {
    expect(normalizeAlpacaOrderStatus("new")).toBe("new");
    expect(normalizeAlpacaOrderStatus("accepted")).toBe("accepted");
    expect(normalizeAlpacaOrderStatus("accepted_for_bidding")).toBe("accepted");
    expect(normalizeAlpacaOrderStatus("calculated")).toBe("accepted");
    expect(normalizeAlpacaOrderStatus("pending_new")).toBe("pending");
    expect(normalizeAlpacaOrderStatus("pending_cancel")).toBe("pending");
    expect(normalizeAlpacaOrderStatus("pending_replace")).toBe("pending");
    expect(normalizeAlpacaOrderStatus("stopped")).toBe("pending");
    expect(normalizeAlpacaOrderStatus("suspended")).toBe("pending");
    expect(normalizeAlpacaOrderStatus("partially_filled")).toBe("partially_filled");
    expect(normalizeAlpacaOrderStatus("filled")).toBe("filled");
    // Alpaca's real spelling ("canceled") normalizes to this codebase's own
    // "cancelled" spelling.
    expect(normalizeAlpacaOrderStatus("canceled")).toBe("cancelled");
    expect(normalizeAlpacaOrderStatus("cancelled")).toBe("cancelled");
    expect(normalizeAlpacaOrderStatus("rejected")).toBe("rejected");
    expect(normalizeAlpacaOrderStatus("expired")).toBe("expired");
  });

  it("is case-insensitive", () => {
    expect(normalizeAlpacaOrderStatus("FILLED")).toBe("filled");
    expect(normalizeAlpacaOrderStatus("Rejected")).toBe("rejected");
  });

  it("honestly maps an unrecognized or missing status to 'unknown', never guessing", () => {
    expect(normalizeAlpacaOrderStatus("some_future_alpaca_status")).toBe("unknown");
    expect(normalizeAlpacaOrderStatus(null)).toBe("unknown");
    expect(normalizeAlpacaOrderStatus(undefined)).toBe("unknown");
    expect(normalizeAlpacaOrderStatus("")).toBe("unknown");
  });
});

describe("normalizeLocalTradeStatus", () => {
  it("passes through the 3 known local statuses unchanged", () => {
    expect(normalizeLocalTradeStatus("pending")).toBe("pending");
    expect(normalizeLocalTradeStatus("open")).toBe("open");
    expect(normalizeLocalTradeStatus("closed")).toBe("closed");
  });

  it("honestly maps anything else to 'unknown'", () => {
    expect(normalizeLocalTradeStatus("something_else")).toBe("unknown");
    expect(normalizeLocalTradeStatus(null)).toBe("unknown");
    expect(normalizeLocalTradeStatus(undefined)).toBe("unknown");
  });
});

describe("isStatusContradiction", () => {
  it("flags a local open/closed trade whose broker order was rejected, cancelled, or expired", () => {
    expect(isStatusContradiction("open", "rejected")).toBe(true);
    expect(isStatusContradiction("open", "cancelled")).toBe(true);
    expect(isStatusContradiction("open", "expired")).toBe(true);
    expect(isStatusContradiction("closed", "rejected")).toBe(true);
    expect(isStatusContradiction("closed", "cancelled")).toBe(true);
    expect(isStatusContradiction("closed", "expired")).toBe(true);
  });

  it("flags a local pending trade whose broker order actually filled (a stale local record)", () => {
    expect(isStatusContradiction("pending", "filled")).toBe(true);
  });

  it("never flags a consistent pairing", () => {
    expect(isStatusContradiction("pending", "new")).toBe(false);
    expect(isStatusContradiction("pending", "accepted")).toBe(false);
    expect(isStatusContradiction("pending", "pending")).toBe(false);
    expect(isStatusContradiction("open", "filled")).toBe(false);
    expect(isStatusContradiction("open", "partially_filled")).toBe(false);
    expect(isStatusContradiction("closed", "filled")).toBe(false);
  });

  it("never flags a pairing where either side is unknown, rather than guessing", () => {
    expect(isStatusContradiction("unknown", "filled")).toBe(false);
    expect(isStatusContradiction("open", "unknown")).toBe(false);
    expect(isStatusContradiction("unknown", "unknown")).toBe(false);
  });
});
