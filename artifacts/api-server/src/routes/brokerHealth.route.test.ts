// Read-only Alpaca Paper Trading broker/account verification — live route
// integration tests for GET /broker/health, plus a proof that GET /settings'
// alpacaConnected field is computed from that check's outcome rather than a
// static stored value. Uses the real app + a real Postgres connection
// (unauthenticated requests resolve to the legacy-owner stand-in, matching
// every other route test in this suite).
//
// No real Alpaca credentials exist in this session (confirmed: neither
// ALPACA_API_KEY nor ALPACA_API_SECRET is set in the environment) — the
// "no credentials configured" case below is exercised against the REAL,
// live environment state, no mocking needed. The authenticated-success and
// authentication-failed cases mock global fetch (this file's own worker
// only — vitest isolates test files by default) with temporarily-set
// credential env vars, restored in afterEach. Only calls to Alpaca's own
// host are faked; requests to this file's own local test server pass
// through to the real, captured fetch.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { Server } from "node:http";

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

function jsonResponse(status: number, data: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as unknown as Response;
}

describe("GET /broker/health (live route)", () => {
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

  it("returns 200 honestly reporting 'not connected, no credentials' — the real state of this environment", async () => {
    // Confirm the real, unmocked environment genuinely has no Alpaca creds —
    // if this ever fails, it means credentials were added and this test's
    // premise (a live, unmocked "no credentials" proof) no longer holds.
    expect(process.env.ALPACA_API_KEY).toBeUndefined();
    expect(process.env.ALPACA_API_SECRET).toBeUndefined();

    const res = await fetch(`${baseUrl}/api/broker/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connected: boolean;
      authenticationSuccessful: boolean;
      accountStatus: string | null;
      buyingPower: number | null;
      openPositionsCount: number | null;
      openOrdersCount: number | null;
      reason: string;
      checkedAt: string;
    };
    expect(body.connected).toBe(false);
    expect(body.authenticationSuccessful).toBe(false);
    expect(body.accountStatus).toBeNull();
    expect(body.buyingPower).toBeNull();
    expect(body.openPositionsCount).toBeNull();
    expect(body.openOrdersCount).toBeNull();
    expect(body.reason).toMatch(/no alpaca credentials configured/i);
    expect(typeof body.checkedAt).toBe("string");
  });

  it("returns 200 with a fully-populated, real-authenticated shape when Alpaca accepts the credentials (mocked network only), and GET /settings then reflects alpacaConnected:true", async () => {
    process.env.ALPACA_API_KEY = "test-paper-key";
    process.env.ALPACA_API_SECRET = "test-paper-secret";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return realFetch(input, init);
      if (url.endsWith("/v2/account")) return jsonResponse(200, rawAccount);
      if (url.includes("/v2/positions")) {
        return jsonResponse(200, [
          { symbol: "AAPL", qty: "5", side: "long", market_value: "900", avg_entry_price: "180", unrealized_pl: "0" },
        ]);
      }
      if (url.includes("/v2/orders")) return jsonResponse(200, []);
      throw new Error(`unexpected fetch url in test: ${url}`);
    });

    const res = await fetch(`${baseUrl}/api/broker/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connected: boolean;
      authenticationSuccessful: boolean;
      accountStatus: string;
      buyingPower: number;
      cashBalance: number;
      portfolioValue: number;
      openPositionsCount: number;
      openOrdersCount: number;
      lastSuccessfulCheckAt: string | null;
    };
    expect(body.connected).toBe(true);
    expect(body.authenticationSuccessful).toBe(true);
    expect(body.accountStatus).toBe("ACTIVE");
    expect(body.buyingPower).toBe(200000.5);
    expect(body.cashBalance).toBe(100000.25);
    expect(body.portfolioValue).toBe(150000.75);
    expect(body.openPositionsCount).toBe(1);
    expect(body.openOrdersCount).toBe(0);
    expect(body.lastSuccessfulCheckAt).not.toBeNull();

    const settingsRes = await fetch(`${baseUrl}/api/settings`);
    const settingsBody = (await settingsRes.json()) as { alpacaConnected: boolean };
    expect(settingsBody.alpacaConnected).toBe(true);
  });

  it("returns 200 honestly reporting an authentication failure on a 401 from Alpaca (mocked network only), and GET /settings then reflects alpacaConnected:false again", async () => {
    process.env.ALPACA_API_KEY = "bad-key";
    process.env.ALPACA_API_SECRET = "bad-secret";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return realFetch(input, init);
      if (url.endsWith("/v2/account")) return jsonResponse(401, { message: "unauthorized" });
      throw new Error(`unexpected fetch url in test: ${url}`);
    });

    const res = await fetch(`${baseUrl}/api/broker/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected: boolean; authenticationSuccessful: boolean; reason: string };
    expect(body.connected).toBe(false);
    expect(body.authenticationSuccessful).toBe(false);
    expect(body.reason).toMatch(/authentication failed/i);

    const settingsRes = await fetch(`${baseUrl}/api/settings`);
    const settingsBody = (await settingsRes.json()) as { alpacaConnected: boolean };
    expect(settingsBody.alpacaConnected).toBe(false);
  });

  it("returns 200 honestly reporting a network failure when Alpaca is unreachable (mocked network only)", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return realFetch(input, init);
      if (url.endsWith("/v2/account")) throw new Error("ECONNREFUSED");
      throw new Error(`unexpected fetch url in test: ${url}`);
    });

    const res = await fetch(`${baseUrl}/api/broker/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected: boolean; reason: string };
    expect(body.connected).toBe(false);
    expect(body.reason).toMatch(/could not reach alpaca/i);
  });
});
