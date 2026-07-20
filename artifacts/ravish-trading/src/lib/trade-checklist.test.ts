import { describe, it, expect } from "vitest";
import { buildTradeChecklist } from "./trade-checklist";
import type {
  TradingStructureAnalysis,
  TradingMultiTimeframeAnalysis,
  TradingLiquidityAnalysis,
  TradingRiskAnalysis,
  TradingTradePlan,
} from "@workspace/api-client-react";

const baseStructure: TradingStructureAnalysis = {
  symbol: "AAPL",
  interval: "1D",
  dataSource: "SIMULATED",
  candleCount: 90,
  currentPrice: 200,
  trend: "uptrend",
  trendDetail: "Higher highs and higher lows",
  swingPoints: [],
  zones: [],
  confidenceLevel: "High",
  confidenceExplanation: "Plenty of candles",
  summary: "Uptrend",
};

const baseMultiTimeframe: TradingMultiTimeframeAnalysis = {
  symbol: "AAPL",
  dataSource: "SIMULATED",
  timeframes: [],
  trendAgreement: "unanimous",
  dominantTrend: "uptrend",
  confluenceScore: 100,
  confidenceLevel: "High",
  confidenceExplanation: "All agree",
  summary: "Unanimous uptrend",
};

const baseLiquidity: TradingLiquidityAnalysis = {
  symbol: "AAPL",
  interval: "1D",
  dataSource: "SIMULATED",
  candleCount: 90,
  currentPrice: 200,
  volumeProfile: [],
  avgDollarVolume: 50_000_000,
  liquidityScore: 90,
  liquidityBand: "High",
  buySellPressure: { direction: "buying", buyingPct: 60, sellingPct: 40 },
  confidenceLevel: "High",
  confidenceExplanation: "Plenty of volume",
  summary: "Highly liquid",
};

const baseRisk: TradingRiskAnalysis = {
  overall: { score: 90, label: "Excellent", detail: "Well within limits" },
  positionSizing: { score: 90, label: "Excellent", detail: "ok" } as any,
  stopDiscipline: { score: 90, label: "Excellent", detail: "ok" } as any,
  portfolioBudget: { score: 90, label: "Excellent", detail: "ok", totalRiskDollars: 100, totalRiskUsedPct: 2, capBreached: false, perPosition: [] } as any,
  components: [],
  accountValue: 50000,
  openPositionsCount: 1,
  positionContexts: [],
};

const baseTradePlan: TradingTradePlan = {
  id: 1,
  symbol: "AAPL",
  direction: "long",
  status: "draft",
  thesis: "Breakout",
  risk: { accountRiskPct: 1, entryPrice: 100, stopPrice: 95, targetPrice: 115, positionSize: 100, riskRewardRatio: 3 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("buildTradeChecklist", () => {
  it("reports every item as unknown when nothing has been reviewed yet", () => {
    const items = buildTradeChecklist({});
    expect(items.every((i) => i.status === "unknown")).toBe(true);
    expect(items.map((i) => i.id)).toEqual([
      "structure-reviewed",
      "confluence-reviewed",
      "liquidity-checked",
      "plan-created",
      "position-size-computed",
      "risk-within-limits",
    ]);
  });

  it("reports pass for structure/confluence/liquidity once reviewed and healthy", () => {
    const items = buildTradeChecklist({
      structure: baseStructure,
      multiTimeframe: baseMultiTimeframe,
      liquidity: baseLiquidity,
    });
    expect(items.find((i) => i.id === "structure-reviewed")?.status).toBe("pass");
    expect(items.find((i) => i.id === "confluence-reviewed")?.status).toBe("pass");
    expect(items.find((i) => i.id === "liquidity-checked")?.status).toBe("pass");
  });

  it("warns on split multi-timeframe agreement, never fabricating a dominant trend", () => {
    const items = buildTradeChecklist({
      multiTimeframe: { ...baseMultiTimeframe, trendAgreement: "split", dominantTrend: null, confluenceScore: null },
    });
    const item = items.find((i) => i.id === "confluence-reviewed");
    expect(item?.status).toBe("warn");
    expect(item?.detail).toContain("disagree");
  });

  it("warns on low liquidity", () => {
    const items = buildTradeChecklist({
      liquidity: { ...baseLiquidity, liquidityBand: "Low" },
    });
    expect(items.find((i) => i.id === "liquidity-checked")?.status).toBe("warn");
  });

  it("reports pass for a saved trade plan and its derived position size", () => {
    const items = buildTradeChecklist({ tradePlan: baseTradePlan });
    expect(items.find((i) => i.id === "plan-created")?.status).toBe("pass");
    expect(items.find((i) => i.id === "position-size-computed")?.status).toBe("pass");
  });

  it("warns on position size when accountValue was never supplied (honest null, not fabricated)", () => {
    const planWithoutSize: TradingTradePlan = {
      ...baseTradePlan,
      risk: { ...baseTradePlan.risk, positionSize: null },
    };
    const items = buildTradeChecklist({ tradePlan: planWithoutSize });
    expect(items.find((i) => i.id === "position-size-computed")?.status).toBe("warn");
  });

  it("fails risk-within-limits when the portfolio budget cap is breached", () => {
    const breachedRisk: TradingRiskAnalysis = {
      ...baseRisk,
      portfolioBudget: { ...baseRisk.portfolioBudget, capBreached: true } as any,
    };
    const items = buildTradeChecklist({ risk: breachedRisk });
    expect(items.find((i) => i.id === "risk-within-limits")?.status).toBe("fail");
  });

  it("passes risk-within-limits when the cap is not breached", () => {
    const items = buildTradeChecklist({ risk: baseRisk });
    expect(items.find((i) => i.id === "risk-within-limits")?.status).toBe("pass");
  });
});
