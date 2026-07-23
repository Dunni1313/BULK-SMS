# Institutional Trading Engine — Domain Model (Phase 24 Foundation)

The shared TypeScript domain model lives in `artifacts/api-server/src/lib/tradingDomainModel.ts`. Types are grouped below by whether they're reused unmodified from the already-shipped Engine 2 (Sprints 32-38) or genuinely new this phase.

---

## 1. Reused, unmodified (re-exported only)

### Market Data (`lib/tradingMarketData.ts`)

```ts
type Timeframe = "1m" | "5m" | "15m" | "1h" | "1D";

interface Candle {
  time: string; // ISO timestamp of the bar's open
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketDataProvider {
  readonly id: string;
  readonly isLive: boolean;
  getCandles(symbol: string, interval: Timeframe, lookback: number, asOf?: string): Promise<Candle[] | null>;
  getQuote(symbol: string, asOf?: string): Promise<MarketQuote | null>;
}
```

### Market Structure (`lib/tradingMarketStructure.ts`)

```ts
type TrendStructure = "uptrend" | "downtrend" | "range";

interface SwingPoint {
  time: string;
  price: number;
  kind: "high" | "low";
}

interface SupportResistanceZone {
  price: number;
  kind: "support" | "resistance";
  strength: number; // number of swing touches clustered into this zone
}

interface MarketStructureAnalysis {
  symbol: string;
  interval: Timeframe;
  dataSource: "SIMULATED" | "LIVE";
  candleCount: number;
  currentPrice: number;
  trend: TrendStructure;
  trendDetail: string;
  swingPoints: SwingPoint[];
  zones: SupportResistanceZone[];
  confidenceLevel: "High" | "Moderate" | "Low";
  confidenceExplanation: string;
  summary: string;
}
```

### Liquidity (`lib/tradingLiquidity.ts`)

```ts
type LiquidityBand = "High" | "Moderate" | "Low";
type PressureDirection = "buying" | "selling" | "neutral";

interface VolumeProfileLevel {
  price: number;
  volume: number;
  pctOfTotal: number;
}

interface BuySellPressure {
  buyPct: number;
  sellPct: number;
}
```

---

## 2. New this phase

### Order Block

The last opposing candle before a decisive, displacing move. A structural marker only — detection over a real candle series is explicitly deferred (see `docs/Trading-Roadmap.md`).

```ts
type OrderBlockDirection = "bullish" | "bearish";

interface OrderBlock {
  id: string;
  symbol: string;
  interval: Timeframe;
  direction: OrderBlockDirection;
  time: string; // ISO timestamp of the originating candle's open
  high: number;
  low: number;
  mitigated: boolean; // has price traded back through this zone since it formed
}
```

### Fair Value Gap

A 3-candle imbalance marker.

```ts
type FairValueGapDirection = "bullish" | "bearish";

interface FairValueGap {
  id: string;
  symbol: string;
  interval: Timeframe;
  direction: FairValueGapDirection;
  startTime: string; // ISO timestamp of the first candle in the pattern
  endTime: string; // ISO timestamp of the third candle in the pattern
  gapHigh: number;
  gapLow: number;
  filled: boolean; // has price fully retraced through the gap since it formed
}
```

### Session Data

Static, well-known UTC session windows (the same category of static reference data as `tradingMarketData.ts`'s own `TRADING_MARKET_UNIVERSE`) plus the shape a computed session read is reported in.

```ts
type TradingSessionName = "sydney" | "tokyo" | "london" | "new_york";

interface TradingSessionWindow {
  name: TradingSessionName;
  label: string;
  startUtcHour: number; // 0-23, UTC
  endUtcHour: number; // 0-23, UTC — may wrap past midnight
}

// TRADING_SESSION_WINDOWS: Sydney 21-06, Tokyo 00-09, London 07-16, New York 12-21 (all UTC)

interface SessionData {
  symbol: string;
  asOf: string;
  activeSessions: TradingSessionName[];
  sessionHigh: number | null;
  sessionLow: number | null;
}
```

### Trade Plan & Risk Parameters

A human-authored pre-trade intent — never machine-generated, distinct from `TradingPositionInput` (`lib/tradingRisk.ts`), which represents an already-open position.

```ts
type TradeDirection = "long" | "short";
type TradePlanStatus = "draft" | "active" | "closed" | "cancelled";

interface RiskParameters {
  accountRiskPct: number; // % of account the human intends to risk, e.g. 1
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  positionSize: number | null; // derived — see computeRiskParameters() below
  riskRewardRatio: number | null; // derived
}

interface TradePlan {
  id: string;
  symbol: string;
  direction: TradeDirection;
  status: TradePlanStatus;
  thesis: string; // free-text, human-authored — never generated
  risk: RiskParameters;
  createdAt: string;
}
```

**`computeRiskParameters(params, accountValue)`** — the one real function in the whole domain model file. Pure arithmetic:

- `riskRewardRatio = |target − entry| / |entry − stop|`, honestly `null` when stop distance is zero.
- `positionSize = (accountValue × accountRiskPct / 100) / |entry − stop|`, honestly `null` when `accountValue` isn't positive or stop distance is zero.

It never decides whether the entry/stop/target levels are good — only what they imply arithmetically given an account size. This is the same honest-null discipline every analyzer in this codebase already follows (never a fabricated `0` in place of "can't compute this").

**Status transitions** (`transitionTradePlanStatus`, `lib/trading/tradePlanService.ts`): `draft → active | cancelled`; `active → closed | cancelled`; `closed`/`cancelled` are terminal. An invalid transition returns `null` rather than silently mutating the plan.

## 3. Explicitly not modeled this phase

- No `Strategy` implementation shape beyond `StrategyDefinition` (key/label/category/description/timeframes) — the registry is empty.
- No database row/table for `TradePlan` — in-memory only.
- No `OrderBlock[]`/`FairValueGap[]` detection function — the types exist, the algorithms don't yet.
