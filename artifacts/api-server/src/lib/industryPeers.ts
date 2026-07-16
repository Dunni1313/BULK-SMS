// Phase 2, Sprint 20 — static, deterministic sector/peer taxonomy for the
// Industry Comparison Engine (approved Phase 2 plan, Sprint 20).
//
// This module is pure and provider-agnostic: it holds no financial data, only
// categorical metadata (which sector/industry a company is publicly known to
// belong to, and a fixed, deterministic peer list per sector). It never fetches
// anything and never fabricates a financial figure — `industryComparison.ts` is
// responsible for actually resolving each peer's Fundamentals (which may
// honestly come back null/SIMULATED/fallback, same as any other symbol).
//
// KNOWN_SECTOR_PROFILES covers real, publicly-known companies' real sector and
// industry classification (e.g. "Apple -> Technology / Consumer Electronics").
// This is categorical metadata, not fabricated financial data, so it's
// consistent with this codebase's never-fabricate-a-number discipline even in
// SIMULATED mode. Any ticker outside this table (including any of the original
// 10 `INVESTING_UNIVERSE` symbols not repeated here, or an arbitrary user-typed
// symbol) falls back to a deterministic seeded sector assignment — never a
// guessed real-sounding classification.

import { makeRng } from "./deterministic.js";

export const SECTORS = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Financial Services",
  "Health Care",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Diversified",
] as const;

export type Sector = (typeof SECTORS)[number];

export interface SectorProfile {
  sector: Sector;
  industry: string;
}

// Real, well-known public companies' real sector/industry classification.
// Deliberately not limited to the 10-symbol INVESTING_UNIVERSE so every sector
// has meaningful peer coverage (7 of the 10 INVESTING_UNIVERSE symbols cluster in
// Technology/Communication Services alone).
export const KNOWN_SECTOR_PROFILES: Record<string, SectorProfile> = {
  // Technology
  AAPL: { sector: "Technology", industry: "Consumer Electronics" },
  MSFT: { sector: "Technology", industry: "Software—Infrastructure" },
  NVDA: { sector: "Technology", industry: "Semiconductors" },
  ORCL: { sector: "Technology", industry: "Software—Infrastructure" },
  CRM: { sector: "Technology", industry: "Software—Application" },
  ADBE: { sector: "Technology", industry: "Software—Application" },
  AMD: { sector: "Technology", industry: "Semiconductors" },
  INTC: { sector: "Technology", industry: "Semiconductors" },

  // Communication Services
  GOOGL: { sector: "Communication Services", industry: "Internet Content & Information" },
  META: { sector: "Communication Services", industry: "Interactive Media & Services" },
  NFLX: { sector: "Communication Services", industry: "Entertainment" },
  DIS: { sector: "Communication Services", industry: "Entertainment" },
  TMUS: { sector: "Communication Services", industry: "Telecom Services" },
  VZ: { sector: "Communication Services", industry: "Telecom Services" },

  // Consumer Discretionary
  AMZN: { sector: "Consumer Discretionary", industry: "Internet Retail" },
  TSLA: { sector: "Consumer Discretionary", industry: "Auto Manufacturers" },
  HD: { sector: "Consumer Discretionary", industry: "Home Improvement Retail" },
  MCD: { sector: "Consumer Discretionary", industry: "Restaurants" },
  NKE: { sector: "Consumer Discretionary", industry: "Footwear & Accessories" },
  SBUX: { sector: "Consumer Discretionary", industry: "Restaurants" },

  // Consumer Staples
  PG: { sector: "Consumer Staples", industry: "Household & Personal Products" },
  KO: { sector: "Consumer Staples", industry: "Beverages—Non-Alcoholic" },
  PEP: { sector: "Consumer Staples", industry: "Beverages—Non-Alcoholic" },
  WMT: { sector: "Consumer Staples", industry: "Discount Stores" },
  COST: { sector: "Consumer Staples", industry: "Discount Stores" },
  PM: { sector: "Consumer Staples", industry: "Tobacco" },

  // Financial Services
  JPM: { sector: "Financial Services", industry: "Banks—Diversified" },
  BAC: { sector: "Financial Services", industry: "Banks—Diversified" },
  V: { sector: "Financial Services", industry: "Credit Services" },
  MA: { sector: "Financial Services", industry: "Credit Services" },
  GS: { sector: "Financial Services", industry: "Capital Markets" },
  MS: { sector: "Financial Services", industry: "Capital Markets" },

  // Health Care
  JNJ: { sector: "Health Care", industry: "Drug Manufacturers—General" },
  UNH: { sector: "Health Care", industry: "Healthcare Plans" },
  PFE: { sector: "Health Care", industry: "Drug Manufacturers—General" },
  ABBV: { sector: "Health Care", industry: "Drug Manufacturers—General" },
  MRK: { sector: "Health Care", industry: "Drug Manufacturers—General" },
  LLY: { sector: "Health Care", industry: "Drug Manufacturers—General" },

  // Industrials
  CAT: { sector: "Industrials", industry: "Farm & Heavy Construction Machinery" },
  BA: { sector: "Industrials", industry: "Aerospace & Defense" },
  HON: { sector: "Industrials", industry: "Conglomerates" },
  GE: { sector: "Industrials", industry: "Specialty Industrial Machinery" },
  UPS: { sector: "Industrials", industry: "Integrated Freight & Logistics" },
  LMT: { sector: "Industrials", industry: "Aerospace & Defense" },

  // Energy
  XOM: { sector: "Energy", industry: "Oil & Gas Integrated" },
  CVX: { sector: "Energy", industry: "Oil & Gas Integrated" },
  COP: { sector: "Energy", industry: "Oil & Gas E&P" },
  SLB: { sector: "Energy", industry: "Oil & Gas Equipment & Services" },
  EOG: { sector: "Energy", industry: "Oil & Gas E&P" },
  PSX: { sector: "Energy", industry: "Oil & Gas Refining & Marketing" },

  // Utilities
  NEE: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  DUK: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  SO: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  D: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  AEP: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  EXC: { sector: "Utilities", industry: "Utilities—Regulated Electric" },

  // Real Estate
  PLD: { sector: "Real Estate", industry: "REIT—Industrial" },
  AMT: { sector: "Real Estate", industry: "REIT—Specialty" },
  EQIX: { sector: "Real Estate", industry: "REIT—Specialty" },
  O: { sector: "Real Estate", industry: "REIT—Retail" },
  SPG: { sector: "Real Estate", industry: "REIT—Retail" },
  PSA: { sector: "Real Estate", industry: "REIT—Industrial" },

  // Diversified (ETFs) — deliberately limited to the 3 ETF symbols already
  // hand-authored with kind:"etf" in fundamentals.ts's PROFILES table, so
  // SIMULATED peer fundamentals for this sector never mislabel an ETF as
  // kind:"stock" via the generic syntheticProfile() fallback.
  SPY: { sector: "Diversified", industry: "Diversified Large-Cap ETF" },
  QQQ: { sector: "Diversified", industry: "Diversified Large-Cap Tech-Weighted ETF" },
  IWM: { sector: "Diversified", industry: "Diversified Small-Cap ETF" },
};

// Fixed-order peer candidate list per sector, derived directly from
// KNOWN_SECTOR_PROFILES (single source of truth — no separate list to drift out
// of sync). Order is the table's own insertion order, kept stable so peer
// selection is deterministic across requests.
export const SECTOR_PEER_UNIVERSE: Record<Sector, string[]> = SECTORS.reduce(
  (acc, sector) => {
    acc[sector] = Object.entries(KNOWN_SECTOR_PROFILES)
      .filter(([, p]) => p.sector === sector)
      .map(([sym]) => sym);
    return acc;
  },
  {} as Record<Sector, string[]>,
);

// Deterministic per-symbol sector bucket for any symbol NOT in
// KNOWN_SECTOR_PROFILES — never a fabricated real-sounding classification, just
// a stable pseudo-random bucket assignment so peer comparison degrades
// gracefully (some peer group) rather than failing outright for an unlisted
// symbol. Excludes "Diversified" (reserved for genuine ETFs, which this
// fallback has no way to detect).
const SYNTHETIC_SECTORS = SECTORS.filter((s) => s !== "Diversified");

export function getSectorProfile(symbol: string): SectorProfile {
  const sym = symbol.toUpperCase();
  const known = KNOWN_SECTOR_PROFILES[sym];
  if (known) return known;
  const rng = makeRng(`${sym}|synthetic-sector`);
  const sector = SYNTHETIC_SECTORS[Math.floor(rng() * SYNTHETIC_SECTORS.length)];
  return { sector, industry: `${sector} (unclassified)` };
}

// Deterministic peer selection: the sector's fixed-order candidate list, minus
// the target symbol itself, sliced to `count`. No market-cap/liquidity ranking
// (that would require a live call) — just stable, provider-agnostic ordering.
export function selectPeerSymbols(sector: Sector, excludeSymbol: string, count: number): string[] {
  const exclude = excludeSymbol.toUpperCase();
  return SECTOR_PEER_UNIVERSE[sector].filter((sym) => sym !== exclude).slice(0, count);
}
