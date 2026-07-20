// Phase 24 — Institutional Trading Engine Foundation.
//
// A genuinely empty deterministic placeholder, per the approved scope:
// "No signal generation yet. No strategy logic yet." This page makes zero
// API calls of its own — every card below shows a static, clearly-labeled
// illustrative example of the new lib/tradingDomainModel.ts shapes (Order
// Block, Fair Value Gap, Session Data, Trade Plan), never live data.
//
// Reuses the Executive Dashboard's own design language (Phase 23) rather
// than TradingResearch.tsx's slightly different existing header style,
// per the explicit instruction for this new page. Links out to the real,
// already-shipped Engine 2 pages (Trading Research, Trading Journal,
// Trading Backtest) rather than re-implementing any of their
// functionality — this page is the architecture overview, not a
// replacement for any of them.

import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutTemplate,
  Boxes,
  Waves,
  Clock,
  NotebookPen,
  Activity,
  History,
  ShieldAlert,
  Compass,
} from "lucide-react";

// Static illustrative examples only — never fetched, never computed here.
// Mirrors the exact shapes defined in artifacts/api-server/src/lib/
// tradingDomainModel.ts.
const EXAMPLE_ORDER_BLOCK = {
  symbol: "AAPL",
  interval: "1h",
  direction: "bullish",
  time: "2026-07-18T14:00:00.000Z",
  high: 231.4,
  low: 229.1,
  mitigated: false,
};

const EXAMPLE_FAIR_VALUE_GAP = {
  symbol: "AAPL",
  interval: "1h",
  direction: "bullish",
  startTime: "2026-07-18T13:00:00.000Z",
  endTime: "2026-07-18T15:00:00.000Z",
  gapHigh: 230.8,
  gapLow: 229.95,
  filled: false,
};

const EXAMPLE_SESSION_DATA = {
  symbol: "AAPL",
  asOf: "2026-07-20T14:30:00.000Z",
  activeSessions: ["new_york", "london"],
  sessionHigh: 232.1,
  sessionLow: 228.4,
};

const EXAMPLE_TRADE_PLAN = {
  symbol: "AAPL",
  direction: "long",
  status: "draft",
  thesis: "Reclaim of the daily order block with London/NY session overlap.",
  risk: {
    accountRiskPct: 1,
    entryPrice: 230,
    stopPrice: 227,
    targetPrice: 239,
    positionSize: 33.33,
    riskRewardRatio: 3,
  },
};

function DomainModelCard({
  icon: Icon,
  title,
  status,
  description,
  example,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: "new";
  description: string;
  example: Record<string, unknown>;
  testId: string;
}) {
  return (
    <Card className="bg-card border-border" data-testid={testId}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="w-4 h-4 text-indigo-400" /> {title}
          </CardTitle>
          <Badge variant="outline" className="text-[9px] uppercase border-amber-500/40 text-amber-400">
            {status === "new" ? "New this phase" : status}
          </Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Illustrative example — not live data
        </p>
        <pre className="text-[11px] bg-background/60 border border-border/60 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(example, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function AvailableLinkCard({
  icon: Icon,
  title,
  description,
  href,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  testId: string;
}) {
  return (
    <Card className="bg-card border-border" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-400" /> {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href} className="text-xs text-primary hover:underline inline-block">
          Open {title} →
        </Link>
      </CardContent>
    </Card>
  );
}

export default function TradeWorkspace() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutTemplate className="w-6 h-6 text-indigo-400" /> Trade Workspace
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          The Institutional Trading Engine's shared architecture — new domain concepts (Order Blocks, Fair Value
          Gaps, Session Data, Trade Plans) alongside the already-shipped Market Structure, Multi-Timeframe,
          Liquidity, Risk, Journal, and Backtest engines. This page is a foundation overview, not a replacement
          for any existing Trading Research/Journal/Backtest page.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="trade-workspace-permanent-labels">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Institutional Trading Engine
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Architecture Foundation
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            No Signal Generation Yet
          </Badge>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">New Domain Model (this phase)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <DomainModelCard
            icon={Boxes}
            title="Order Block"
            status="new"
            description="The last opposing candle before a displacing move. Shape only — detection is future work."
            example={EXAMPLE_ORDER_BLOCK}
            testId="domain-card-order-block"
          />
          <DomainModelCard
            icon={Waves}
            title="Fair Value Gap"
            status="new"
            description="A 3-candle imbalance marker. Shape only — detection is future work."
            example={EXAMPLE_FAIR_VALUE_GAP}
            testId="domain-card-fair-value-gap"
          />
          <DomainModelCard
            icon={Clock}
            title="Session Data"
            status="new"
            description="Static Sydney/Tokyo/London/New York session windows plus a session high/low shape."
            example={EXAMPLE_SESSION_DATA}
            testId="domain-card-session-data"
          />
          <DomainModelCard
            icon={ShieldAlert}
            title="Trade Plan & Risk Parameters"
            status="new"
            description="A human-authored pre-trade plan. Position size and R:R are pure arithmetic, never a signal."
            example={EXAMPLE_TRADE_PLAN}
            testId="domain-card-trade-plan"
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Already Available (Engine 2, reused unchanged)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AvailableLinkCard
            icon={Activity}
            title="Trading Research"
            description="Market Structure, Multi-Timeframe, Regime, Probability, Liquidity, Portfolio Risk, and the AI Trade Coach."
            href="/trading-research"
            testId="available-card-trading-research"
          />
          <AvailableLinkCard
            icon={NotebookPen}
            title="Trading Journal"
            description="Full CRUD trading journal, linked to your own trading positions."
            href="/trading-journal"
            testId="available-card-trading-journal"
          />
          <AvailableLinkCard
            icon={History}
            title="Trading Backtest"
            description="Walk-forward backtesting over real, simulated candle history."
            href="/trading-backtest"
            testId="available-card-trading-backtest"
          />
        </div>
      </div>

      <Card className="bg-card border-border" data-testid="coming-next-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Compass className="w-4 h-4 text-muted-foreground" /> Coming Next
          </CardTitle>
          <CardDescription className="text-xs">
            Explicitly deferred, per the approved foundation-only scope for this phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Real Order Block / Fair Value Gap detection over a candle series</li>
            <li>A Strategy Framework with real, selectable, evaluable strategies</li>
            <li>A Trading Watchlist (distinct from Engine 1's fundamentals-based Value Watchlist)</li>
            <li>Trade Plan persistence (a database table, once this page's own planning panel needs one)</li>
            <li>A Trading learning path in the Learning Centre</li>
            <li>A Trading reporting framework, mirroring Engine 1's Institutional Reporting Engine</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
