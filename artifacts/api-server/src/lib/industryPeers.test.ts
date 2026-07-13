// Phase 2, Sprint 20 — Industry Comparison Engine's static peer taxonomy
// (approved Phase 2 plan, Sprint 20). Pure, deterministic, no I/O.

import { describe, it, expect } from "vitest";
import {
  SECTORS,
  KNOWN_SECTOR_PROFILES,
  SECTOR_PEER_UNIVERSE,
  getSectorProfile,
  selectPeerSymbols,
} from "./industryPeers.js";

describe("SECTOR_PEER_UNIVERSE", () => {
  it("has a fixed-order peer list for every declared sector, derived from KNOWN_SECTOR_PROFILES", () => {
    for (const sector of SECTORS) {
      expect(Array.isArray(SECTOR_PEER_UNIVERSE[sector])).toBe(true);
      for (const sym of SECTOR_PEER_UNIVERSE[sector]) {
        expect(KNOWN_SECTOR_PROFILES[sym]?.sector).toBe(sector);
      }
    }
  });

  it("every non-Diversified sector has at least 6 candidates (so 5 peers remain after excluding a self-match)", () => {
    for (const sector of SECTORS) {
      if (sector === "Diversified") continue;
      expect(SECTOR_PEER_UNIVERSE[sector].length).toBeGreaterThanOrEqual(6);
    }
  });

  it("the Diversified sector only contains real ETF tickers already hand-authored as kind:\"etf\"", () => {
    expect(SECTOR_PEER_UNIVERSE.Diversified.sort()).toEqual(["IWM", "QQQ", "SPY"]);
  });
});

describe("getSectorProfile", () => {
  it("returns the real, known classification for a well-known symbol", () => {
    expect(getSectorProfile("AAPL")).toEqual({ sector: "Technology", industry: "Consumer Electronics" });
    expect(getSectorProfile("aapl")).toEqual({ sector: "Technology", industry: "Consumer Electronics" });
  });

  it("returns a deterministic synthetic classification for an unknown symbol, never a fabricated real-sounding one", () => {
    const a = getSectorProfile("ZZZZQ");
    const b = getSectorProfile("ZZZZQ");
    expect(a).toEqual(b);
    expect(SECTORS).toContain(a.sector);
    expect(a.sector).not.toBe("Diversified");
    expect(a.industry).toBe(`${a.sector} (unclassified)`);
  });

  it("synthetic assignment varies by symbol (not a constant fallback)", () => {
    const symbols = ["ZZZA", "ZZZB", "ZZZC", "ZZZD", "ZZZE", "ZZZF"];
    const sectors = new Set(symbols.map((s) => getSectorProfile(s).sector));
    expect(sectors.size).toBeGreaterThan(1);
  });
});

describe("selectPeerSymbols", () => {
  it("returns up to `count` peers in fixed order, excluding the target symbol", () => {
    const peers = selectPeerSymbols("Technology", "AAPL", 5);
    expect(peers).not.toContain("AAPL");
    expect(peers.length).toBe(5);
    expect(peers).toEqual(SECTOR_PEER_UNIVERSE.Technology.filter((s) => s !== "AAPL").slice(0, 5));
  });

  it("is deterministic across repeated calls", () => {
    const a = selectPeerSymbols("Health Care", "JNJ", 5);
    const b = selectPeerSymbols("Health Care", "JNJ", 5);
    expect(a).toEqual(b);
  });

  it("returns fewer than `count` when the sector doesn't have enough candidates", () => {
    const peers = selectPeerSymbols("Diversified", "SPY", 5);
    expect(peers.length).toBe(2);
    expect(peers).not.toContain("SPY");
  });

  it("excludes the target case-insensitively", () => {
    const peers = selectPeerSymbols("Technology", "aapl", 5);
    expect(peers).not.toContain("AAPL");
  });
});
