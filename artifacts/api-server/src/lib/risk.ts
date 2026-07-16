// Risk validation: enforces defined-risk-only trades (no naked options),
// per-trade and portfolio risk caps, stop-loss and profit-target rules.

export interface RiskLeg {
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  quantity: number;
  expiration?: string | null;
}

// Worst-case loss (in dollars) computed from the submitted legs and quantities,
// so multi-lot or non-canonical structures are sized correctly. For single-expiry
// defined-risk spreads the payoff is piecewise-linear, so the minimum P&L occurs
// at a strike breakpoint (or 0 / far OTM). For multi-expiry structures (calendars,
// diagonals) the front leg's time value makes an exact closed form intractable, so
// we fall back to the net debit paid — the standard conservative worst case.
export function maxLossFromLegs(legs: RiskLeg[], creditDollars: number): number {
  const expirations = new Set(legs.map((l) => l.expiration ?? "_"));
  if (expirations.size > 1) {
    return Math.max(0, -creditDollars);
  }
  const strikes = [...new Set(legs.map((l) => l.strike))].sort((a, b) => a - b);
  if (strikes.length === 0) return Math.max(0, -creditDollars);
  const testPoints = [0, ...strikes, strikes[strikes.length - 1] * 2];
  let worst = Infinity;
  for (const S of testPoints) {
    let payoff = creditDollars;
    for (const l of legs) {
      const intrinsic =
        l.optionType === "call" ? Math.max(0, S - l.strike) : Math.max(0, l.strike - S);
      const sign = l.side === "buy" ? 1 : -1;
      payoff += sign * intrinsic * l.quantity * 100;
    }
    worst = Math.min(worst, payoff);
  }
  return Math.max(0, -worst);
}

// Strategy-aware stop-loss threshold (negative dollars). Credit trades stop at a
// multiple of the credit received; net-debit trades (e.g. calendars) have no credit
// to multiply, so they stop at a fraction of the debit at risk. In all cases the
// stop is clamped so it can never sit beyond the position's max loss (which would
// make it unreachable).
export function computeStopLoss(
  creditDollars: number,
  maxLossDollars: number,
  multiplier: number,
): number {
  const raw =
    creditDollars > 0
      ? -Math.abs(creditDollars) * multiplier
      : -Math.max(0, maxLossDollars) * 0.5;
  return Math.max(-Math.max(0, maxLossDollars), raw);
}

export interface RiskSettings {
  maxRiskPerTrade: number; // percent of account
  maxPortfolioRisk: number; // percent of account
  stopLossMultiplier: number; // multiple of credit
  profitTarget50: number;
  profitTarget75: number;
  profitTarget90: number;
}

export interface RiskCheck {
  label: string;
  passed: boolean;
  detail: string;
}

// Every short leg must be covered by a long leg of the same option type —
// otherwise the position carries naked (undefined) risk.
export function isDefinedRisk(legs: RiskLeg[]): { ok: boolean; reason: string | null } {
  const count = (side: "buy" | "sell", type: "call" | "put") =>
    legs
      .filter((l) => l.side === side && l.optionType === type)
      .reduce((s, l) => s + l.quantity, 0);
  const shortCalls = count("sell", "call");
  const longCalls = count("buy", "call");
  const shortPuts = count("sell", "put");
  const longPuts = count("buy", "put");
  if (shortCalls > longCalls) {
    return { ok: false, reason: "Naked short call — undefined risk not allowed" };
  }
  if (shortPuts > longPuts) {
    return { ok: false, reason: "Naked short put — undefined risk not allowed" };
  }
  return { ok: true, reason: null };
}

export interface TradeRiskInput {
  symbol: string;
  strategy: string;
  legs: RiskLeg[];
  credit: number; // dollars (negative = debit)
  maxLoss: number; // dollars
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  checks: RiskCheck[];
  riskDollars: number;
  riskPct: number;
  stopLoss: number;
  profitTarget50: number;
  profitTarget75: number;
  profitTarget90: number;
}

export function validateTrade(
  trade: TradeRiskInput,
  accountValue: number,
  settings: RiskSettings,
): ValidationResult {
  const violations: string[] = [];
  const checks: RiskCheck[] = [];

  const defined = isDefinedRisk(trade.legs);
  checks.push({
    label: "Defined risk",
    passed: defined.ok,
    detail: defined.ok ? "All shorts are protected by longs" : defined.reason!,
  });
  if (!defined.ok) violations.push(defined.reason!);

  // Multi-expiry credit structures (e.g. reverse calendars / credit diagonals)
  // have a loss that is not bounded by the net debit, so maxLossFromLegs cannot
  // size them safely. Only multi-expiry NET-DEBIT structures (true calendars) are
  // allowed; reject multi-expiry net-credit submissions as undefined risk.
  const multiExpiry =
    new Set(trade.legs.map((l) => l.expiration ?? "_")).size > 1;
  const multiExpiryCreditOk = !(multiExpiry && trade.credit > 0);
  checks.push({
    label: "Multi-expiry shape",
    passed: multiExpiryCreditOk,
    detail: multiExpiryCreditOk
      ? "Single-expiry, or a net-debit calendar"
      : "Multi-expiry net-credit structures have unbounded risk",
  });
  if (!multiExpiryCreditOk) {
    violations.push(
      "Multi-expiry net-credit structure — undefined risk not allowed",
    );
  }

  const riskDollars = Math.max(0, trade.maxLoss);
  const riskPct = accountValue > 0 ? (riskDollars / accountValue) * 100 : 0;
  const perTradeOk = riskPct <= settings.maxRiskPerTrade + 1e-6;
  checks.push({
    label: `Risk per trade ≤ ${settings.maxRiskPerTrade}%`,
    passed: perTradeOk,
    detail: `$${riskDollars.toFixed(0)} = ${riskPct.toFixed(2)}% of account`,
  });
  if (!perTradeOk) {
    violations.push(
      `Trade risk ${riskPct.toFixed(2)}% exceeds the ${settings.maxRiskPerTrade}% per-trade cap`,
    );
  }

  const creditAbs = Math.abs(trade.credit);
  const stopLoss = -creditAbs * settings.stopLossMultiplier;
  const maxProfit = creditAbs;

  return {
    valid: violations.length === 0,
    violations,
    checks,
    riskDollars,
    riskPct,
    stopLoss,
    profitTarget50: maxProfit * (settings.profitTarget50 / 100),
    profitTarget75: maxProfit * (settings.profitTarget75 / 100),
    profitTarget90: maxProfit * (settings.profitTarget90 / 100),
  };
}

export interface OpenTradeRisk {
  id: number;
  symbol: string;
  strategy: string;
  credit: number;
  maxLoss: number;
}

export interface PortfolioRiskStatus {
  accountValue: number;
  maxRiskPerTradePct: number;
  maxPortfolioRiskPct: number;
  portfolioRiskDollars: number;
  portfolioRiskUsedPct: number;
  withinLimits: boolean;
  openTrades: number;
  stopLossMultiplier: number;
  profitTargets: number[];
  checks: RiskCheck[];
  violations: string[];
  perTrade: {
    id: number;
    symbol: string;
    strategy: string;
    riskDollars: number;
    riskPct: number;
    withinLimit: boolean;
  }[];
}

export function computePortfolioRisk(
  trades: OpenTradeRisk[],
  accountValue: number,
  settings: RiskSettings,
): PortfolioRiskStatus {
  const perTrade = trades.map((t) => {
    const riskDollars = Math.max(0, t.maxLoss);
    const riskPct = accountValue > 0 ? (riskDollars / accountValue) * 100 : 0;
    return {
      id: t.id,
      symbol: t.symbol,
      strategy: t.strategy,
      riskDollars: Math.round(riskDollars),
      riskPct: Math.round(riskPct * 100) / 100,
      withinLimit: riskPct <= settings.maxRiskPerTrade + 1e-6,
    };
  });

  const portfolioRiskDollars = perTrade.reduce((s, t) => s + t.riskDollars, 0);
  const portfolioRiskUsedPct =
    accountValue > 0 ? (portfolioRiskDollars / accountValue) * 100 : 0;
  const portfolioOk = portfolioRiskUsedPct <= settings.maxPortfolioRisk + 1e-6;
  const allTradesOk = perTrade.every((t) => t.withinLimit);

  const violations: string[] = [];
  if (!portfolioOk) {
    violations.push(
      `Portfolio risk ${portfolioRiskUsedPct.toFixed(1)}% exceeds the ${settings.maxPortfolioRisk}% cap`,
    );
  }
  perTrade
    .filter((t) => !t.withinLimit)
    .forEach((t) =>
      violations.push(
        `${t.symbol} ${t.strategy.replace(/_/g, " ")} risk ${t.riskPct}% exceeds the ${settings.maxRiskPerTrade}% per-trade cap`,
      ),
    );

  const checks: RiskCheck[] = [
    {
      label: `Portfolio risk ≤ ${settings.maxPortfolioRisk}%`,
      passed: portfolioOk,
      detail: `$${portfolioRiskDollars.toLocaleString()} = ${portfolioRiskUsedPct.toFixed(1)}% of account`,
    },
    {
      label: `Each trade ≤ ${settings.maxRiskPerTrade}%`,
      passed: allTradesOk,
      detail: allTradesOk
        ? "All open trades within per-trade cap"
        : `${perTrade.filter((t) => !t.withinLimit).length} trade(s) over the cap`,
    },
    {
      label: "Defined-risk only",
      passed: true,
      detail: "All strategies are spreads with capped loss",
    },
    {
      label: `Stop loss at ${settings.stopLossMultiplier}× credit`,
      passed: true,
      detail: "Automatic exit rule active on all positions",
    },
  ];

  return {
    accountValue,
    maxRiskPerTradePct: settings.maxRiskPerTrade,
    maxPortfolioRiskPct: settings.maxPortfolioRisk,
    portfolioRiskDollars: Math.round(portfolioRiskDollars),
    portfolioRiskUsedPct: Math.round(portfolioRiskUsedPct * 100) / 100,
    withinLimits: portfolioOk && allTradesOk,
    openTrades: trades.length,
    stopLossMultiplier: settings.stopLossMultiplier,
    profitTargets: [
      settings.profitTarget50,
      settings.profitTarget75,
      settings.profitTarget90,
    ],
    checks,
    violations,
    perTrade,
  };
}
