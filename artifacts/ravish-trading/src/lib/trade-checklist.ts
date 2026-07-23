// Phase 25 — Institutional Trade Workspace. Pure, I/O-free composition over
// already-fetched panel data (Market Structure, Multi-Timeframe, Liquidity,
// Risk, Trade Plan) — the Trade Checklist panel's own logic. Zero new
// signal/scoring logic: every item here reads an already-computed field
// from an existing engine response and reports an honest pass/warn/fail/
// unknown status. "unknown" (never a fabricated pass) is used whenever the
// underlying panel simply hasn't loaded/been reviewed yet.

import type {
  TradingStructureAnalysis,
  TradingMultiTimeframeAnalysis,
  TradingLiquidityAnalysis,
  TradingRiskAnalysis,
  TradingTradePlan,
} from "@workspace/api-client-react";

export type ChecklistItemStatus = "pass" | "warn" | "fail" | "unknown";

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistItemStatus;
  detail: string;
}

export interface TradeChecklistInputs {
  structure?: TradingStructureAnalysis | null;
  multiTimeframe?: TradingMultiTimeframeAnalysis | null;
  liquidity?: TradingLiquidityAnalysis | null;
  risk?: TradingRiskAnalysis | null;
  tradePlan?: TradingTradePlan | null;
}

export function buildTradeChecklist(inputs: TradeChecklistInputs): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  items.push(
    inputs.structure
      ? {
          id: "structure-reviewed",
          label: "Market structure reviewed",
          status: "pass",
          detail: `Trend: ${inputs.structure.trend} (${inputs.structure.confidenceLevel} confidence)`,
        }
      : {
          id: "structure-reviewed",
          label: "Market structure reviewed",
          status: "unknown",
          detail: "Not yet reviewed",
        },
  );

  items.push(
    inputs.multiTimeframe
      ? {
          id: "confluence-reviewed",
          label: "Multi-timeframe confluence reviewed",
          status: inputs.multiTimeframe.trendAgreement === "split" ? "warn" : "pass",
          detail:
            inputs.multiTimeframe.trendAgreement === "split"
              ? "Timeframes disagree on direction"
              : `${inputs.multiTimeframe.trendAgreement} agreement${
                  inputs.multiTimeframe.dominantTrend ? ` on ${inputs.multiTimeframe.dominantTrend}` : ""
                }`,
        }
      : {
          id: "confluence-reviewed",
          label: "Multi-timeframe confluence reviewed",
          status: "unknown",
          detail: "Not yet reviewed",
        },
  );

  items.push(
    inputs.liquidity
      ? {
          id: "liquidity-checked",
          label: "Liquidity checked",
          status: inputs.liquidity.liquidityBand === "Low" ? "warn" : "pass",
          detail: `${inputs.liquidity.liquidityBand} liquidity, ${inputs.liquidity.buySellPressure.direction} pressure`,
        }
      : {
          id: "liquidity-checked",
          label: "Liquidity checked",
          status: "unknown",
          detail: "Not yet reviewed",
        },
  );

  items.push(
    inputs.tradePlan
      ? {
          id: "plan-created",
          label: "Trade plan created",
          status: "pass",
          detail: `${inputs.tradePlan.direction} plan, status: ${inputs.tradePlan.status}`,
        }
      : {
          id: "plan-created",
          label: "Trade plan created",
          status: "unknown",
          detail: "No trade plan saved yet",
        },
  );

  items.push(
    inputs.tradePlan
      ? {
          id: "position-size-computed",
          label: "Position size computed",
          status: inputs.tradePlan.risk.positionSize !== null ? "pass" : "warn",
          detail:
            inputs.tradePlan.risk.positionSize !== null
              ? `${inputs.tradePlan.risk.positionSize} shares/contracts, R:R ${inputs.tradePlan.risk.riskRewardRatio ?? "n/a"}`
              : "Account value not supplied — position size not derived",
        }
      : {
          id: "position-size-computed",
          label: "Position size computed",
          status: "unknown",
          detail: "No trade plan saved yet",
        },
  );

  items.push(
    inputs.risk
      ? {
          id: "risk-within-limits",
          label: "Portfolio risk within limits",
          status: inputs.risk.portfolioBudget.capBreached ? "fail" : "pass",
          detail: inputs.risk.overall.detail,
        }
      : {
          id: "risk-within-limits",
          label: "Portfolio risk within limits",
          status: "unknown",
          detail: "Not yet reviewed",
        },
  );

  return items;
}
