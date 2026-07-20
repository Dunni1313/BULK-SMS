# Risk Studio (Phase 28 — Trade Planning & Risk Studio)

This document describes the Risk-focused panels the Trade Planning & Risk Studio adds: Position Size Review, Risk/Reward Review, Capital Allocation Summary, Portfolio Exposure Summary, and Scenario Comparison. **None of these introduce new mathematics** — every figure is a direct read of an already-computed field from `lib/tradingRisk.ts` (Sprint 38/44) or `lib/tradingDomainModel.ts`'s `computeRiskParameters()` (Phase 24).

## 1. Reuse, not new math — the governing rule

Per the phase brief's own instruction ("Reuse the existing Risk Management calculations. Do NOT introduce new mathematics. Display existing deterministic outputs only"), every Risk Studio panel is a **display layer** over fields that already existed before this phase:

| Panel | Reads | Already computed by |
|---|---|---|
| Position Size Review | `TradingTradePlan.risk.positionSize` | `computeRiskParameters()`, Phase 24 |
| Risk/Reward Review | `TradingTradePlan.risk.riskRewardRatio` | `computeRiskParameters()`, Phase 24 |
| Capital Allocation Summary | `TradingRiskAnalysis.portfolioBudget` (`label`, `detail`, `perPosition[]` — each with `riskDollars`/`riskPct`/`withinLimit`) | `computeTradingRisk()`, Sprint 38 |
| Portfolio Exposure Summary | `TradingRiskAnalysis.stopDiscipline` (`openPositionsCount`, `positionsFullyPlanned`, `missingStopSymbols`, `missingTargetSymbols`) and `TradingRiskAnalysis.positionSizing` (`largestPositionSymbol`, `largestPositionRiskPct`, `capBreached`) | `computeTradingRisk()`, Sprint 38 |

Before this phase, every page that read `TradingRiskAnalysis` (`TradeWorkspace.tsx`, `TradingResearch.tsx`, `InstitutionalDashboard.tsx`) only ever rendered the top-level `overall.label`/`overall.detail` plus, at most, the 3 component detail sentences as plain prose — never the structured `perPosition[]` table or the specific missing-stop/missing-target symbol lists. This phase's genuine contribution is exposing that already-computed structure, not computing anything new.

## 2. Scenario Comparison — a stateless preview, not a recommendation

Scenario Comparison is the one genuinely new backend piece this phase adds (`lib/tradingScenarioComparison.ts`, `POST /trading/trade-plans/scenarios/compare`), and it is deliberately still not "new mathematics" in the sense the brief means: it calls `computeRiskParameters()` — the same function used to compute a real Trade Plan's own risk — once per named scenario the user is still deciding between, and returns them side by side.

- **2 to 5 scenarios** per comparison (`MIN_SCENARIOS`/`MAX_SCENARIOS`, named constants); fewer or more 400s.
- Each scenario is independently run through `computeRiskParameters()` with the same `accountRiskPct`/`entryPrice`/`stopPrice`/`targetPrice` shape a real Trade Plan uses.
- **`bestRiskRewardName`** and **`tightestRiskName`** are the scenario with the highest `riskRewardRatio` and the lowest `positionSize`, respectively — a plain `Array.reduce()` max/min over already-computed numbers, never a new formula, and honestly `null` when no scenario has a computable value for that field (e.g. every scenario has a zero stop distance, or no account value was ever supplied).
- **Never persisted.** No `trading_trade_plans` row is created by this endpoint — a scenario becomes a real Trade Plan only when the user separately submits the Entry/Stop/Target Planning panels' own form.
- The UI's own badges read "Best R:R" and "Tightest Risk" — deliberately never "Recommended" or "Best Trade," since neither label is a claim about which scenario is actually the right trade, only an honest fact about which number is numerically higher or lower.

## 3. Honest-empty discipline

Every Risk Studio panel follows the same "unavailable, never fabricated" rule every other engine in this codebase already follows:

- Position Size Review / Risk/Reward Review show "No trade plan saved yet" until a real plan exists, and "Account value not supplied — position size not derived" / "Zero stop distance — R:R not computable" when `computeRiskParameters()` itself returned `null` for that field.
- Capital Allocation Summary / Portfolio Exposure Summary show "Not yet reviewed" until `GET /trading/risk` resolves, and reuse `computeTradingRisk()`'s own honest `"Insufficient data"` label/detail when there aren't enough open, stop-defined positions to score.
- Scenario Comparison never shows a "Best R:R" or "Tightest Risk" badge on any scenario when the corresponding `best*Name` field is `null`.
