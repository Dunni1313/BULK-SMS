// Alpaca Paper Order Lifecycle & Reconciliation Foundation sprint — live
// route integration tests for GET /broker/orders, GET /broker/orders/:id,
// and GET /broker/reconciliation. Uses the real app + a real Postgres
// connection (unauthenticated requests resolve to the legacy-owner
// stand-in, matching every other route test in this suite).
//
// No real Alpaca credentials exist in this session — the "no credentials
// configured" cases below are exercised against the REAL, live environment
// state, no mocking needed. The success/failure-mode cases mock global
// fetch (this file's own worker only) with temporarily-set credential env
// vars, restored in afterEach.
//
// GET /broker/reconciliation reads the legacy-owner account's own real
// trades table, which other concurrently-running test files may also
// mutate under parallel execution — per the same disclosed precedent as
// routes/tradingRisk.route.test.ts (Sprint 44), assertions against that
// shared account stay shape-only (never an exact trade count); precise
// reconciliation-logic correctness is already independently proven against
// an isolated, dedicated test user in lib/brokerReconciliation.test.ts.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { Server } from "node:http";

function jsonResponse(status: number, data: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as unknown as Response;
}

const rawOrder = {
  id: "order-1",
  symbol: "SPY",
  side: "sell",
  qty: "1",
  type: "limit",
  status: "filled",
  filled_qty: "1",
  filled_avg_price: "2.15",
  submitted_at: "2026-07-16T10:00:00Z",
};

describe("Broker orders + reconciliation (live routes)", () => {
  let server: Server;
  let baseUrl: string;
  let realFetch: typeof fetch;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    realFetch = globalThis.fetch.bind(globalThis);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_API_SECRET;
  });

  describe("GET /broker/orders", () => {
    it("returns 200 with available:false and an honest reason with no credentials configured (real environment state)", async () => {
      expect(process.env.ALPACA_API_KEY).toBeUndefined();
      expect(process.env.ALPACA_API_SECRET).toBeUndefined();

      const res = await fetch(`${baseUrl}/api/broker/orders`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { available: boolean; unavailableReason: string | null; orders: unknown[] };
      expect(body.available).toBe(false);
      expect(body.unavailableReason).toMatch(/no alpaca credentials configured/i);
      expect(body.orders).toEqual([]);
    });

    it("returns 200 with a well-shaped, mapped order list on success (mocked network only)", async () => {
      process.env.ALPACA_API_KEY = "k";
      process.env.ALPACA_API_SECRET = "s";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        if (url.includes("/v2/orders?status=all")) return jsonResponse(200, [rawOrder]);
        throw new Error(`unexpected fetch url in test: ${url}`);
      });

      const res = await fetch(`${baseUrl}/api/broker/orders`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { available: boolean; orders: { id: string; normalizedStatus: string; filledQty: number }[] };
      expect(body.available).toBe(true);
      expect(body.orders).toHaveLength(1);
      expect(body.orders[0].id).toBe("order-1");
      expect(body.orders[0].normalizedStatus).toBe("filled");
      expect(body.orders[0].filledQty).toBe(1);
    });

    it("returns 200 with available:false on an authentication failure (mocked network only)", async () => {
      process.env.ALPACA_API_KEY = "bad";
      process.env.ALPACA_API_SECRET = "bad";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        if (url.includes("/v2/orders?status=all")) return jsonResponse(401, { message: "unauthorized" });
        throw new Error(`unexpected fetch url in test: ${url}`);
      });

      const res = await fetch(`${baseUrl}/api/broker/orders`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { available: boolean; unavailableReason: string | null };
      expect(body.available).toBe(false);
      expect(body.unavailableReason).toMatch(/authentication failed/i);
    });
  });

  describe("GET /broker/orders/:orderId", () => {
    it("returns 200 with available:false and an honest reason with no credentials configured (real environment state)", async () => {
      const res = await fetch(`${baseUrl}/api/broker/orders/order-1`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { available: boolean; unavailableReason: string | null; order: unknown };
      expect(body.available).toBe(false);
      expect(body.unavailableReason).toMatch(/no alpaca credentials configured/i);
      expect(body.order).toBeNull();
    });

    it("returns 200 with the mapped order on success (mocked network only)", async () => {
      process.env.ALPACA_API_KEY = "k";
      process.env.ALPACA_API_SECRET = "s";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        if (url.endsWith("/v2/orders/order-1")) return jsonResponse(200, rawOrder);
        throw new Error(`unexpected fetch url in test: ${url}`);
      });

      const res = await fetch(`${baseUrl}/api/broker/orders/order-1`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { available: boolean; order: { id: string; filledAvgPrice: number } };
      expect(body.available).toBe(true);
      expect(body.order.id).toBe("order-1");
      expect(body.order.filledAvgPrice).toBe(2.15);
    });

    it("returns 200 with available:false for an unknown order id (a 404 from Alpaca), never a fabricated order", async () => {
      process.env.ALPACA_API_KEY = "k";
      process.env.ALPACA_API_SECRET = "s";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        if (url.endsWith("/v2/orders/does-not-exist")) return jsonResponse(404, { message: "order not found" });
        throw new Error(`unexpected fetch url in test: ${url}`);
      });

      const res = await fetch(`${baseUrl}/api/broker/orders/does-not-exist`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { available: boolean; order: unknown };
      expect(body.available).toBe(false);
      expect(body.order).toBeNull();
    });
  });

  describe("GET /broker/reconciliation", () => {
    it("returns 200 with available:false and an honest reason with no credentials configured (real environment state), never a fabricated reconciled result", async () => {
      const res = await fetch(`${baseUrl}/api/broker/reconciliation`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        available: boolean;
        unavailableReason: string | null;
        orders: unknown[];
        positions: unknown[];
        fullyReconciled: boolean;
      };
      expect(body.available).toBe(false);
      expect(body.unavailableReason).toMatch(/no alpaca credentials configured/i);
      expect(body.orders).toEqual([]);
      expect(body.positions).toEqual([]);
      expect(body.fullyReconciled).toBe(false);
    });

    it("returns 200 with a well-shaped result on success (mocked network only)", async () => {
      process.env.ALPACA_API_KEY = "k";
      process.env.ALPACA_API_SECRET = "s";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        if (url.includes("/v2/orders?status=all")) return jsonResponse(200, []);
        if (url.includes("/v2/positions")) return jsonResponse(200, []);
        throw new Error(`unexpected fetch url in test: ${url}`);
      });

      const res = await fetch(`${baseUrl}/api/broker/reconciliation`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        available: boolean;
        generatedAt: string;
        localOrdersConsidered: number;
        brokerOrdersConsidered: number;
        issueCount: number;
      };
      expect(body.available).toBe(true);
      expect(typeof body.generatedAt).toBe("string");
      expect(typeof body.localOrdersConsidered).toBe("number");
      expect(body.brokerOrdersConsidered).toBe(0);
      expect(typeof body.issueCount).toBe("number");
    });

    it("returns 200 with available:false on a network failure (mocked network only)", async () => {
      process.env.ALPACA_API_KEY = "k";
      process.env.ALPACA_API_SECRET = "s";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        if (url.includes("/v2/orders?status=all")) throw new Error("ECONNREFUSED");
        throw new Error(`unexpected fetch url in test: ${url}`);
      });

      const res = await fetch(`${baseUrl}/api/broker/reconciliation`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { available: boolean; unavailableReason: string | null };
      expect(body.available).toBe(false);
      expect(body.unavailableReason).toMatch(/could not reach alpaca/i);
    });
  });
});
