// Alpaca broker (account/positions/orders) — read-only. Distinct from
// alpacaProvider.ts (options-chain MARKET DATA); this module is about the
// PAPER TRADING ACCOUNT itself: balances, open positions, open orders, and
// whether the configured credentials actually authenticate. It shares
// alpacaProvider.ts's own readAlpacaCreds() so both modules resolve
// credentials identically (env first, then the settings-stored key).
//
// Scope, deliberately narrow (Phase 6 broker-verification milestone):
//   - GET /v2/account, GET /v2/positions, GET /v2/orders only.
//   - The hardcoded Alpaca PAPER TRADING base URL only — the same
//     paper-api.alpaca.markets host execution.ts's own ALPACA_ORDERS_URL
//     already uses for order submission. No live-trading URL exists here or
//     anywhere else in this codebase.
//   - No order submission, cancellation, or modification of any kind — this
//     file only ever issues GET requests.
//   - Never fabricates a value: a failed or unreachable call returns an
//     honest failure result (with a reason), never a zeroed-out or guessed
//     account/position/order shape.

import { logger } from "../logger.js";
import { readAlpacaCreds } from "./alpacaProvider.js";

// Paper Trading only — matches execution.ts's own ALPACA_ORDERS_URL host.
// There is deliberately no live-trading equivalent of this constant.
const ALPACA_TRADING_BASE_URL = "https://paper-api.alpaca.markets";

export interface AlpacaAccount {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  equity: number;
  patternDayTrader: boolean;
}

export interface AlpacaPosition {
  symbol: string;
  qty: number;
  side: string;
  marketValue: number;
  avgEntryPrice: number;
  unrealizedPl: number;
}

export interface AlpacaOrder {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  type: string;
  status: string;
  submittedAt: string | null;
}

export type BrokerFailureReason =
  | "no_credentials"
  | "unauthorized"
  | "http_error"
  | "network_error";

export type BrokerResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: BrokerFailureReason; status?: number; message: string };

async function alpacaGet<T>(path: string, creds: { key: string; secret: string }): Promise<BrokerResult<T>> {
  try {
    const resp = await fetch(`${ALPACA_TRADING_BASE_URL}${path}`, {
      headers: {
        "APCA-API-KEY-ID": creds.key,
        "APCA-API-SECRET-KEY": creds.secret,
        accept: "application/json",
      },
    });
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, reason: "unauthorized", status: resp.status, message: "Alpaca rejected the configured credentials" };
    }
    if (!resp.ok) {
      return { ok: false, reason: "http_error", status: resp.status, message: `Alpaca returned HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as T;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, path }, "Alpaca broker request failed");
    return { ok: false, reason: "network_error", message: err instanceof Error ? err.message : "network request failed" };
  }
}

// Raw shapes Alpaca's own API returns — numeric account fields are STRINGS
// (a well-documented Alpaca quirk), parsed to numbers at the boundary here so
// every caller downstream works with real numbers, never a string typo.
interface RawAlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  pattern_day_trader: boolean;
}

interface RawAlpacaPosition {
  symbol: string;
  qty: string;
  side: string;
  market_value: string;
  avg_entry_price: string;
  unrealized_pl: string;
}

interface RawAlpacaOrder {
  id: string;
  symbol: string;
  side: string;
  qty: string;
  type: string;
  status: string;
  submitted_at?: string | null;
}

export async function getAlpacaAccount(settingsApiKey?: string | null): Promise<BrokerResult<AlpacaAccount>> {
  const creds = readAlpacaCreds(settingsApiKey);
  if (!creds) return { ok: false, reason: "no_credentials", message: "No Alpaca API key/secret configured" };

  const result = await alpacaGet<RawAlpacaAccount>("/v2/account", creds);
  if (!result.ok) return result;

  const raw = result.data;
  return {
    ok: true,
    data: {
      id: raw.id,
      accountNumber: raw.account_number,
      status: raw.status,
      currency: raw.currency,
      buyingPower: parseFloat(raw.buying_power),
      cash: parseFloat(raw.cash),
      portfolioValue: parseFloat(raw.portfolio_value),
      equity: parseFloat(raw.equity),
      patternDayTrader: raw.pattern_day_trader,
    },
  };
}

export async function getAlpacaPositions(settingsApiKey?: string | null): Promise<BrokerResult<AlpacaPosition[]>> {
  const creds = readAlpacaCreds(settingsApiKey);
  if (!creds) return { ok: false, reason: "no_credentials", message: "No Alpaca API key/secret configured" };

  const result = await alpacaGet<RawAlpacaPosition[]>("/v2/positions", creds);
  if (!result.ok) return result;

  return {
    ok: true,
    data: result.data.map((p) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      side: p.side,
      marketValue: parseFloat(p.market_value),
      avgEntryPrice: parseFloat(p.avg_entry_price),
      unrealizedPl: parseFloat(p.unrealized_pl),
    })),
  };
}

export async function getAlpacaOrders(settingsApiKey?: string | null): Promise<BrokerResult<AlpacaOrder[]>> {
  const creds = readAlpacaCreds(settingsApiKey);
  if (!creds) return { ok: false, reason: "no_credentials", message: "No Alpaca API key/secret configured" };

  // Explicit status=open, so this is unambiguously "open orders" rather than
  // relying on Alpaca's own default (which is also open-only, but stating it
  // here documents the intent and survives if Alpaca ever changes its default).
  const result = await alpacaGet<RawAlpacaOrder[]>("/v2/orders?status=open", creds);
  if (!result.ok) return result;

  return {
    ok: true,
    data: result.data.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      qty: parseFloat(o.qty),
      type: o.type,
      status: o.status,
      submittedAt: o.submitted_at ?? null,
    })),
  };
}

export interface BrokerHealth {
  connected: boolean;
  authenticationSuccessful: boolean;
  accountStatus: string | null;
  buyingPower: number | null;
  cashBalance: number | null;
  portfolioValue: number | null;
  openPositionsCount: number | null;
  openOrdersCount: number | null;
  lastSuccessfulCheckAt: string | null;
  reason: string;
  checkedAt: string;
}

// In-memory, module-level — mirrors fundamentals.ts's own getLastLiveFetch()
// pattern (Phase 1). Two distinct pieces of state, deliberately not conflated:
//   - lastSuccessfulCheckAt: timestamp of the most recent check that actually
//     authenticated successfully; a failed check never updates it, so a
//     stale/broken connection is never reported as "last successful"
//     indefinitely.
//   - lastCheckConnected: the CURRENT connection status as of the most recent
//     check (success or failure) — this is what settings.alpacaConnected
//     reflects, so a broken connection correctly flips back to false rather
//     than staying "connected" forever because it once succeeded.
let lastSuccessfulCheckAt: string | null = null;
let lastCheckConnected: boolean | null = null;

export function getLastSuccessfulBrokerCheck(): string | null {
  return lastSuccessfulCheckAt;
}

// Reflects the outcome of the most recent broker-health check only — null
// (never client-visible as such; callers should treat null as "not
// connected") until a check has actually been performed at least once, per
// the same "honestly false until proven otherwise" discipline every other
// *Connected field in this codebase already follows.
export function getLastBrokerCheckConnected(): boolean | null {
  return lastCheckConnected;
}

// The Broker Health orchestrator: performs a live, authenticated round trip
// to Alpaca's Paper Trading API and reports the result honestly. Never
// fabricates a value — every numeric/count field is null unless it was
// actually resolved from a real Alpaca response this call.
export async function checkAlpacaBrokerHealth(settingsApiKey?: string | null): Promise<BrokerHealth> {
  const checkedAt = new Date().toISOString();

  const accountResult = await getAlpacaAccount(settingsApiKey);
  if (!accountResult.ok) {
    const reason =
      accountResult.reason === "no_credentials"
        ? "No Alpaca credentials configured"
        : accountResult.reason === "unauthorized"
          ? "Alpaca rejected the configured credentials (authentication failed)"
          : accountResult.reason === "network_error"
            ? `Could not reach Alpaca: ${accountResult.message}`
            : `Alpaca returned an error: ${accountResult.message}`;
    lastCheckConnected = false;
    return {
      connected: false,
      authenticationSuccessful: false,
      accountStatus: null,
      buyingPower: null,
      cashBalance: null,
      portfolioValue: null,
      openPositionsCount: null,
      openOrdersCount: null,
      lastSuccessfulCheckAt,
      reason,
      checkedAt,
    };
  }

  // Authentication succeeded — record it. Positions/orders are fetched next;
  // if either individually fails (e.g. a transient hiccup right after the
  // account call succeeded), that does not retroactively make authentication
  // fail — the two counts are simply reported honestly as null.
  lastSuccessfulCheckAt = checkedAt;
  lastCheckConnected = true;

  const [positionsResult, ordersResult] = await Promise.all([
    getAlpacaPositions(settingsApiKey),
    getAlpacaOrders(settingsApiKey),
  ]);

  return {
    connected: true,
    authenticationSuccessful: true,
    accountStatus: accountResult.data.status,
    buyingPower: accountResult.data.buyingPower,
    cashBalance: accountResult.data.cash,
    portfolioValue: accountResult.data.portfolioValue,
    openPositionsCount: positionsResult.ok ? positionsResult.data.length : null,
    openOrdersCount: ordersResult.ok ? ordersResult.data.length : null,
    lastSuccessfulCheckAt,
    reason: "Connected — Alpaca Paper Trading account authenticated successfully",
    checkedAt,
  };
}
