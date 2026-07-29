// v1.5.0 Sprint 3 — Specialist Coach Adapters: Investing AI Coach.
//
// Domain: Phase 2 Sprint 30's "AI Investment Analyst" free-form Q&A,
// POST /stock-analyst/value-research/ask/stream — StockResearch.tsx's own
// "Ask the AI Investment Analyst" panel. Backend migrated onto the shared
// createCoachAskHandlers() factory this sprint (routes/stockAnalyst.ts),
// mirroring the Trading/Options conversions.
//
// Grounded in the full assembled value-research report for the report's
// own symbol — company research, valuation/fundamentals (Graham/DCF/
// Buffett/Tom Nash), and the Investment Committee's verdict — never
// Trading Engine market-structure data, never Options Engine Greeks.

import type { CoachConfig } from "../types";

export interface InvestingCoachParams {
  symbol: string;
}

export const investingCoachConfig: CoachConfig<InvestingCoachParams> = {
  id: "investing",
  displayName: "Investing AI Coach",
  description:
    "Ask anything about this report — including the Tom Nash analysis and Investment Committee outcome. Grounded in the data above only; education, not investment advice.",
  capabilities: ["company-research", "valuation-fundamentals", "investment-committee"],
  endpoint: "/stock-analyst/value-research/ask/stream",
  buildRequestBody: (question, { symbol }) => ({ symbol, question }),
  errorMessage: "Failed to get an answer — please try again.",
  starterPrompts: ({ symbol }) => [`Why does the Investment Committee say what it says for ${symbol}?`],
};
