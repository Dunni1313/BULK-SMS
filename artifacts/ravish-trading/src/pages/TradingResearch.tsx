// Phase 3, Sprint 40 — Institutional Trading Engine, Trading Research page
// skeleton + Market Structure card (the first bounded slice of the approved
// Route+UI backlog reduction — see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 40 as-built note).
//
// Advisory/education only: this page never previews, schedules, or submits
// any order, and never touches a real brokerage account — Engine 2 is
// read-only/advisory throughout this phase (Phase 3 plan §19). Deliberately
// a thin skeleton: one symbol input, one card. Future sprints add further
// panels (Multi-Timeframe, Liquidity, Regime, Risk, Probability) onto this
// same page shell without touching this card's own logic.

import { useState } from "react";
import { useGetTradingStructure, getGetTradingStructureQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function trendBadgeClass(trend: string): string {
  if (trend === "uptrend") return "border-emerald-500/40 text-emerald-400";
  if (trend === "downtrend") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "uptrend") return <TrendingUp className="h-4 w-4" />;
  if (trend === "downtrend") return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function confidenceBadgeClass(level: string): string {
  if (level === "High") return "border-emerald-500/40 text-emerald-400";
  if (level === "Moderate") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

export default function TradingResearch() {
  const [inputValue, setInputValue] = useState("");
  const [symbol, setSymbol] = useState("");

  const { data: structure, isLoading, isError } = useGetTradingStructure(symbol, {
    query: { queryKey: getGetTradingStructureQueryKey(symbol), enabled: !!symbol },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSymbol(inputValue.trim().toUpperCase());
  }

  return (
    <div className="space-y-6 p-6" data-testid="page-trading-research">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trading Research</h1>
        <p className="text-sm text-muted-foreground">
          Institutional Trading Engine (Engine 2) — SIMULATED market analysis, advisory only. Never places an order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter a symbol, e.g. AAPL"
          className="max-w-xs"
          data-testid="input-trading-research-symbol"
        />
        <Button type="submit" data-testid="button-trading-research-search">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {!symbol && (
        <p className="text-sm text-muted-foreground">Enter a symbol above to view its market structure analysis.</p>
      )}

      {symbol && isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {symbol && isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Could not resolve "{symbol}" — check the ticker and try again.
          </CardContent>
        </Card>
      )}

      {symbol && structure && (
        <Card data-testid="card-market-structure">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Market Structure — {structure.symbol}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {structure.dataSource}
              </Badge>
            </div>
            <CardDescription>
              {structure.interval} interval, {structure.candleCount} candles — {fmtUsd(structure.currentPrice)} current price
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`flex items-center gap-1 ${trendBadgeClass(structure.trend)}`}>
                <TrendIcon trend={structure.trend} />
                {structure.trend}
              </Badge>
              <Badge variant="outline" className={confidenceBadgeClass(structure.confidenceLevel)}>
                {structure.confidenceLevel} confidence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{structure.trendDetail}</p>

            {structure.zones.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Support / Resistance Zones</h3>
                <ul className="space-y-1">
                  {structure.zones.map((zone, i) => (
                    <li
                      key={`${zone.kind}-${zone.price}-${i}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      <span className={zone.kind === "support" ? "text-emerald-400" : "text-rose-400"}>
                        {zone.kind === "support" ? "Support" : "Resistance"} — {fmtUsd(zone.price)}
                      </span>
                      <span className="text-muted-foreground">{zone.strength} touches</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {structure.zones.length === 0 && (
              <p className="text-sm text-muted-foreground">No repeated support/resistance zone detected in this sample.</p>
            )}

            <p className="border-t border-border pt-3 text-sm text-muted-foreground">{structure.summary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
