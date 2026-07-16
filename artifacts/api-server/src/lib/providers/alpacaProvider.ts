// Alpaca options provider. Reads credentials from the environment (preferred) or
// the settings row, and fetches option-chain snapshots from Alpaca's market-data
// API. When credentials are absent it reports itself unavailable so the factory
// falls back to the mock provider — it never silently fabricates data.

import { logger } from "../logger.js";
import type { OptionChainData, OptionQuote, OptionsProvider } from "./types.js";

const ALPACA_DATA_URL = "https://data.alpaca.markets/v1beta1/options/snapshots";

interface AlpacaCreds {
  key: string;
  secret: string;
}

// Exported so the execution/order layer can reuse the exact same Alpaca connection
// (env-first, then the settings-stored key) without duplicating credential logic.
export function readAlpacaCreds(settingsApiKey?: string | null): AlpacaCreds | null {
  const key = process.env.ALPACA_API_KEY ?? settingsApiKey ?? "";
  const secret = process.env.ALPACA_API_SECRET ?? "";
  if (key && secret) return { key, secret };
  return null;
}

// Alpaca encodes option symbols as OCC: e.g. AAPL241220C00150000.
function parseOcc(occ: string): { strike: number; type: "call" | "put"; expiration: string } | null {
  const m = occ.match(/^[A-Z]+(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const [, yymmdd, cp, strike8] = m;
  const year = 2000 + Number(yymmdd.slice(0, 2));
  const month = yymmdd.slice(2, 4);
  const day = yymmdd.slice(4, 6);
  return {
    expiration: `${year}-${month}-${day}`,
    type: cp === "C" ? "call" : "put",
    strike: Number(strike8) / 1000,
  };
}

export class AlpacaOptionsProvider implements OptionsProvider {
  readonly name = "alpaca" as const;
  private settingsApiKey?: string | null;

  constructor(settingsApiKey?: string | null) {
    this.settingsApiKey = settingsApiKey;
  }

  isAvailable(): boolean {
    return readAlpacaCreds(this.settingsApiKey) !== null;
  }

  async getChain(symbol: string): Promise<OptionChainData | null> {
    const creds = readAlpacaCreds(this.settingsApiKey);
    if (!creds) return null;

    try {
      const url = `${ALPACA_DATA_URL}/${encodeURIComponent(symbol)}?feed=indicative&limit=1000`;
      const resp = await fetch(url, {
        headers: {
          "APCA-API-KEY-ID": creds.key,
          "APCA-API-SECRET-KEY": creds.secret,
          accept: "application/json",
        },
      });
      if (!resp.ok) {
        logger.warn({ symbol, status: resp.status }, "Alpaca options snapshot failed");
        return null;
      }
      const data = (await resp.json()) as {
        snapshots?: Record<string, AlpacaSnapshot>;
      };
      const snapshots = data.snapshots ?? {};
      const contracts: OptionQuote[] = [];
      let underlyingPrice = 0;

      for (const [occ, snap] of Object.entries(snapshots)) {
        const parsed = parseOcc(occ);
        if (!parsed) continue;
        const bid = snap.latestQuote?.bp ?? 0;
        const ask = snap.latestQuote?.ap ?? 0;
        const greeks = snap.greeks ?? {};
        const quoteTime = snap.latestQuote?.t ?? new Date().toISOString();
        if (snap.underlyingPrice) underlyingPrice = snap.underlyingPrice;
        contracts.push({
          symbol,
          strike: parsed.strike,
          type: parsed.type,
          expiration: parsed.expiration,
          bid,
          ask,
          mid: bid > 0 && ask > 0 ? Math.round(((bid + ask) / 2) * 100) / 100 : 0,
          // Preserve absent greeks/IV as NaN (not 0) so the data-quality gate in
          // marketData.checkData() rejects malformed contracts instead of admitting
          // them with fabricated zero values.
          delta: greeks.delta ?? NaN,
          theta: greeks.theta ?? NaN,
          vega: greeks.vega ?? NaN,
          gamma: greeks.gamma ?? NaN,
          iv: snap.impliedVolatility ?? NaN,
          openInterest: snap.openInterest ?? 0,
          volume: snap.dailyBar?.v ?? 0,
          quoteTime,
        });
      }

      if (contracts.length === 0) return null;

      return {
        symbol,
        underlyingPrice,
        ivRank: 0, // Alpaca snapshots do not provide IV rank; left for enrichment.
        iv30: 0,
        earningsDate: null,
        quoteTime: new Date().toISOString(),
        contracts,
      };
    } catch (err) {
      logger.error({ err, symbol }, "Alpaca options provider error");
      return null;
    }
  }
}

interface AlpacaSnapshot {
  latestQuote?: { bp?: number; ap?: number; t?: string };
  greeks?: { delta?: number; theta?: number; vega?: number; gamma?: number };
  impliedVolatility?: number;
  openInterest?: number;
  underlyingPrice?: number;
  dailyBar?: { v?: number };
}
