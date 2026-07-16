// Theta income aggregation. Sums per-position daily theta from open trades and
// projects it across daily/weekly/monthly/annualized horizons, with breakdowns by
// symbol and strategy. Pure function over already-computed per-trade greeks so it
// is unit-testable without a database.

export interface ThetaPosition {
  symbol: string;
  strategy: string;
  theta: number; // dollars/day for the position (positive = collecting)
}

export interface ThetaBreakdown {
  key: string;
  theta: number;
}

export interface ThetaIncome {
  daily: number;
  weekly: number;
  monthly: number;
  annualized: number;
  bySymbol: ThetaBreakdown[];
  byStrategy: ThetaBreakdown[];
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function aggregate(positions: ThetaPosition[], keyOf: (p: ThetaPosition) => string): ThetaBreakdown[] {
  const map = new Map<string, number>();
  for (const p of positions) {
    map.set(keyOf(p), (map.get(keyOf(p)) ?? 0) + p.theta);
  }
  return [...map.entries()]
    .map(([key, theta]) => ({ key, theta: round2(theta) }))
    .sort((a, b) => b.theta - a.theta);
}

export function computeThetaIncome(positions: ThetaPosition[]): ThetaIncome {
  const daily = positions.reduce((s, p) => s + p.theta, 0);
  return {
    daily: round2(daily),
    weekly: round2(daily * 7),
    monthly: round2(daily * 30),
    annualized: round2(daily * 365),
    bySymbol: aggregate(positions, (p) => p.symbol),
    byStrategy: aggregate(positions, (p) => p.strategy),
  };
}
