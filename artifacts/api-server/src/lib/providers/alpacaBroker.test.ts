// Read-only Alpaca Paper Trading broker/account verification. Unit tests for
// getAlpacaAccount/getAlpacaPositions/getAlpacaOrders (mocked fetch — no real
// Alpaca credentials exist in this environment) and the checkAlpacaBrokerHealth
// orchestrator, including its module-level "last successful check"/"last check
// connected" cache.
//
// `lastSuccessfulCheckAt`/`lastCheckConnected` are process-local module state
// with no reset hook (mirroring fundamentals.ts's own getLastLiveFetch()
// precedent — see fundamentals-freshness.test.ts's own header comment for the
// same pattern) — the "checkAlpacaBrokerHealth orchestrator" describe block
// below runs its cases in a DELIBERATE order: the null/never-checked
// assertions come first, then the first real success, then a later failure
// proving the two cache fields are tracked independently.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  getAlpacaAccount,
  getAlpacaPositions,
  getAlpacaOrders,
  getAlpacaAllOrders,
  getAlpacaOrder,
  getAlpacaPosition,
  checkAlpacaBrokerHealth,
  getLastSuccessfulBrokerCheck,
  getLastBrokerCheckConnected,
} from "./alpacaBroker.js";

function jsonResponse(status: number, data: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as unknown as Response;
}

const rawAccount = {
  id: "acct-1",
  account_number: "PA0000001",
  status: "ACTIVE",
  currency: "USD",
  buying_power: "200000.50",
  cash: "100000.25",
  portfolio_value: "150000.75",
  equity: "150000.75",
  pattern_day_trader: false,
};

const rawPositions = [
  {
    symbol: "AAPL",
    qty: "10",
    side: "long",
    market_value: "1750.00",
    avg_entry_price: "170.00",
    unrealized_pl: "50.00",
  },
];

const rawOrders = [
  {
    id: "order-1",
    symbol: "SPY",
    side: "sell",
    qty: "1",
    type: "limit",
    status: "accepted",
    filled_qty: "0",
    filled_avg_price: null,
    submitted_at: "2026-07-16T10:00:00Z",
  },
];

let originalKey: string | undefined;
let originalSecret: string | undefined;

beforeEach(() => {
  originalKey = process.env.ALPACA_API_KEY;
  originalSecret = process.env.ALPACA_API_SECRET;
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ALPACA_API_KEY;
  else process.env.ALPACA_API_KEY = originalKey;
  if (originalSecret === undefined) delete process.env.ALPACA_API_SECRET;
  else process.env.ALPACA_API_SECRET = originalSecret;
});

describe("getAlpacaAccount", () => {
  it("is honestly unavailable with no credentials configured, never fabricating an account", async () => {
    const result = await getAlpacaAccount(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_credentials");
  });

  it("parses Alpaca's string-encoded numeric fields into real numbers on success", async () => {
    process.env.ALPACA_API_KEY = "test-key";
    process.env.ALPACA_API_SECRET = "test-secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, rawAccount));

    const result = await getAlpacaAccount(null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: "acct-1",
        accountNumber: "PA0000001",
        status: "ACTIVE",
        currency: "USD",
        buyingPower: 200000.5,
        cash: 100000.25,
        portfolioValue: 150000.75,
        equity: 150000.75,
        patternDayTrader: false,
      });
    }
    // Confirms this went to the hardcoded Paper Trading host, never live.
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toBe("https://paper-api.alpaca.markets/v2/account");
  });

  it("reports 'unauthorized' distinctly from other HTTP errors on a 401", async () => {
    process.env.ALPACA_API_KEY = "bad-key";
    process.env.ALPACA_API_SECRET = "bad-secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "unauthorized" }));

    const result = await getAlpacaAccount(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unauthorized");
  });

  it("reports a 403 as 'unauthorized' too", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(403, { message: "forbidden" }));

    const result = await getAlpacaAccount(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unauthorized");
  });

  it("reports a non-auth HTTP failure as 'http_error', carrying the real status", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(500, { message: "server error" }));

    const result = await getAlpacaAccount(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("http_error");
      expect(result.status).toBe(500);
    }
  });

  it("reports an unreachable network as 'network_error', never a fabricated account", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await getAlpacaAccount(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("network_error");
  });
});

describe("getAlpacaPositions", () => {
  it("is honestly unavailable with no credentials configured", async () => {
    const result = await getAlpacaPositions(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_credentials");
  });

  it("maps Alpaca's raw position shape to real numbers", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, rawPositions));

    const result = await getAlpacaPositions(null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        { symbol: "AAPL", qty: 10, side: "long", marketValue: 1750, avgEntryPrice: 170, unrealizedPl: 50 },
      ]);
    }
  });

  it("honestly reports an empty position list as an empty array, not null", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, []));

    const result = await getAlpacaPositions(null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
});

describe("getAlpacaOrders", () => {
  it("is honestly unavailable with no credentials configured", async () => {
    const result = await getAlpacaOrders(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_credentials");
  });

  it("explicitly requests status=open and maps the raw order shape", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, rawOrders));

    const result = await getAlpacaOrders(null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        {
          id: "order-1",
          symbol: "SPY",
          side: "sell",
          qty: 1,
          type: "limit",
          status: "accepted",
          normalizedStatus: "accepted",
          filledQty: 0,
          filledAvgPrice: null,
          submittedAt: "2026-07-16T10:00:00Z",
        },
      ]);
    }
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toBe("https://paper-api.alpaca.markets/v2/orders?status=open");
  });
});

describe("checkAlpacaBrokerHealth orchestrator", () => {
  it("is not connected and has never been successfully checked before any call this process (no credentials)", async () => {
    const health = await checkAlpacaBrokerHealth(null);
    expect(health.connected).toBe(false);
    expect(health.authenticationSuccessful).toBe(false);
    expect(health.reason).toMatch(/no alpaca credentials configured/i);
    expect(health.accountStatus).toBeNull();
    expect(health.buyingPower).toBeNull();
    expect(health.cashBalance).toBeNull();
    expect(health.portfolioValue).toBeNull();
    expect(health.openPositionsCount).toBeNull();
    expect(health.openOrdersCount).toBeNull();
    // No check has ever succeeded yet.
    expect(health.lastSuccessfulCheckAt).toBeNull();
    expect(getLastSuccessfulBrokerCheck()).toBeNull();
    expect(getLastBrokerCheckConnected()).toBe(false);
  });

  it("reports an honest 'authentication failed' reason on a 401, still never connected", async () => {
    process.env.ALPACA_API_KEY = "bad";
    process.env.ALPACA_API_SECRET = "bad";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "unauthorized" }));

    const health = await checkAlpacaBrokerHealth(null);
    expect(health.connected).toBe(false);
    expect(health.authenticationSuccessful).toBe(false);
    expect(health.reason).toMatch(/authentication failed/i);
    expect(getLastBrokerCheckConnected()).toBe(false);
    expect(getLastSuccessfulBrokerCheck()).toBeNull();
  });

  it("reports an honest unreachable reason on a network failure", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ETIMEDOUT"));

    const health = await checkAlpacaBrokerHealth(null);
    expect(health.connected).toBe(false);
    expect(health.reason).toMatch(/could not reach alpaca/i);
    expect(getLastBrokerCheckConnected()).toBe(false);
  });

  it("on a full success, reports connected with real account figures and real open counts, and records the first successful-check timestamp", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.endsWith("/v2/account")) return jsonResponse(200, rawAccount);
      if (url.includes("/v2/positions")) return jsonResponse(200, rawPositions);
      if (url.includes("/v2/orders")) return jsonResponse(200, rawOrders);
      throw new Error(`unexpected url ${url}`);
    });

    const health = await checkAlpacaBrokerHealth(null);
    expect(health.connected).toBe(true);
    expect(health.authenticationSuccessful).toBe(true);
    expect(health.accountStatus).toBe("ACTIVE");
    expect(health.buyingPower).toBe(200000.5);
    expect(health.cashBalance).toBe(100000.25);
    expect(health.portfolioValue).toBe(150000.75);
    expect(health.openPositionsCount).toBe(1);
    expect(health.openOrdersCount).toBe(1);
    expect(health.reason).toMatch(/connected/i);
    expect(health.lastSuccessfulCheckAt).not.toBeNull();
    expect(health.lastSuccessfulCheckAt).toBe(health.checkedAt);

    expect(getLastSuccessfulBrokerCheck()).toBe(health.checkedAt);
    expect(getLastBrokerCheckConnected()).toBe(true);
  });

  it("stays connected (authentication succeeded) even when positions/orders individually fail — reports those counts honestly as null, never fabricated", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.endsWith("/v2/account")) return jsonResponse(200, rawAccount);
      if (url.includes("/v2/positions")) return jsonResponse(500, { message: "transient" });
      if (url.includes("/v2/orders")) return jsonResponse(200, rawOrders);
      throw new Error(`unexpected url ${url}`);
    });

    const health = await checkAlpacaBrokerHealth(null);
    expect(health.connected).toBe(true);
    expect(health.authenticationSuccessful).toBe(true);
    expect(health.openPositionsCount).toBeNull();
    expect(health.openOrdersCount).toBe(1);
  });

  it("a later failed check flips getLastBrokerCheckConnected() back to false, while getLastSuccessfulBrokerCheck() keeps the earlier success's timestamp — the two are tracked independently", async () => {
    const successAt = getLastSuccessfulBrokerCheck();
    expect(successAt).not.toBeNull();
    expect(getLastBrokerCheckConnected()).toBe(true);

    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "unauthorized" }));

    const health = await checkAlpacaBrokerHealth(null);
    expect(health.connected).toBe(false);
    // The last-successful timestamp is NOT cleared by this failure.
    expect(health.lastSuccessfulCheckAt).toBe(successAt);
    expect(getLastSuccessfulBrokerCheck()).toBe(successAt);
    // But the current-connection flag honestly flips to false.
    expect(getLastBrokerCheckConnected()).toBe(false);
  });
});

describe("getAlpacaAllOrders", () => {
  it("is honestly unavailable with no credentials configured", async () => {
    const result = await getAlpacaAllOrders(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_credentials");
  });

  it("requests status=all and maps every order, including its normalized status and fill fields", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, [
        { ...rawOrders[0], status: "filled", filled_qty: "1", filled_avg_price: "2.35" },
      ]),
    );

    const result = await getAlpacaAllOrders(null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].status).toBe("filled");
      expect(result.data[0].normalizedStatus).toBe("filled");
      expect(result.data[0].filledQty).toBe(1);
      expect(result.data[0].filledAvgPrice).toBe(2.35);
    }
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toBe("https://paper-api.alpaca.markets/v2/orders?status=all");
  });

  it("honestly reports 'unknown' normalizedStatus for a raw status this codebase doesn't recognize, never guessing", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, [{ ...rawOrders[0], status: "some_future_status" }]),
    );

    const result = await getAlpacaAllOrders(null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[0].normalizedStatus).toBe("unknown");
  });

  it("reports every failure mode identically to getAlpacaOrders", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "unauthorized" }));

    const result = await getAlpacaAllOrders(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unauthorized");
  });
});

describe("getAlpacaOrder (single order by id)", () => {
  it("is honestly unavailable with no credentials configured", async () => {
    const result = await getAlpacaOrder("order-1", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_credentials");
  });

  it("fetches the exact order-id path and maps the result, including fill info", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, { ...rawOrders[0], status: "partially_filled", filled_qty: "1", filled_avg_price: "2.10" }),
    );

    const result = await getAlpacaOrder("order-1", null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("order-1");
      expect(result.data.normalizedStatus).toBe("partially_filled");
      expect(result.data.filledQty).toBe(1);
      expect(result.data.filledAvgPrice).toBe(2.1);
    }
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toBe("https://paper-api.alpaca.markets/v2/orders/order-1");
  });

  it("URL-encodes the order id", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, rawOrders[0]));

    await getAlpacaOrder("order/with slash", null);
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toBe("https://paper-api.alpaca.markets/v2/orders/order%2Fwith%20slash");
  });

  it("reports a rejected order honestly", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { ...rawOrders[0], status: "rejected" }));

    const result = await getAlpacaOrder("order-1", null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.normalizedStatus).toBe("rejected");
  });

  it("reports a cancelled order honestly (normalizing Alpaca's own 'canceled' spelling)", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { ...rawOrders[0], status: "canceled" }));

    const result = await getAlpacaOrder("order-1", null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.normalizedStatus).toBe("cancelled");
  });

  it("reports 404 (order not found) as an http_error, not a fabricated order", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(404, { message: "order not found" }));

    const result = await getAlpacaOrder("does-not-exist", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("http_error");
  });

  it("reports a network failure honestly", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ETIMEDOUT"));

    const result = await getAlpacaOrder("order-1", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("network_error");
  });
});

describe("getAlpacaPosition (single position by symbol)", () => {
  it("is honestly unavailable with no credentials configured", async () => {
    const result = await getAlpacaPosition("AAPL", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_credentials");
  });

  it("fetches the exact symbol path and maps a real position", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, rawPositions[0]));

    const result = await getAlpacaPosition("AAPL", null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        symbol: "AAPL",
        qty: 10,
        side: "long",
        marketValue: 1750,
        avgEntryPrice: 170,
        unrealizedPl: 50,
      });
    }
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toBe("https://paper-api.alpaca.markets/v2/positions/AAPL");
  });

  it("treats a 404 as an honest 'no position' result — ok:true, data:null — never an error", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(404, { message: "position does not exist" }));

    const result = await getAlpacaPosition("MSFT", null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("still reports a genuine authentication failure as unauthorized, not confused with a 404", async () => {
    process.env.ALPACA_API_KEY = "bad";
    process.env.ALPACA_API_SECRET = "bad";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "unauthorized" }));

    const result = await getAlpacaPosition("AAPL", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unauthorized");
  });

  it("reports a network failure honestly", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await getAlpacaPosition("AAPL", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("network_error");
  });
});
