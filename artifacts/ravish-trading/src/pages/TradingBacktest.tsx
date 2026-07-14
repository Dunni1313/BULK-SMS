// Phase 3, Sprint 49 — Institutional Trading Engine, Backtesting
// (Engine-2-native) (approved Phase 3 plan §18; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 49 as-built note).
//
// A genuine walk-forward price-action backtest, distinct from the
// options-side Backtest.tsx page it borrows its rendering pattern from
// (recharts equity-curve LineChart, KPI tile grid, a history table) — not
// its options-specific logic (no "Explain This Trade" sheet here; this
// engine has no options legs to explain). Every result comes from
// lib/tradingBacktest.ts's own real trade-by-trade replay over SIMULATED
// candles (Sprint 32's MarketDataProvider), reused unmodified via
// routes/tradingBacktest.ts — this page adds zero backtest math of its
// own, only the form + rendering.
//
// Honest-empty handling throughout: a strategy with zero triggered trades
// shows "No trades triggered" rather than a fabricated empty chart; an
// unavailable result (too few candles) shows its own unavailableReason.

import { useState } from "react";
import {
  useRunTradingBacktest,
  useListTradingBacktestResults,
  getListTradingBacktestResultsQueryKey,
  TradingBacktestStrategy,
  type TradingTimeframe,
  type TradingBacktestResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, FlaskConical } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

const STRATEGY_LABELS: Record<string, string> = {
  "trend-following": "Trend Following",
  "mean-reversion": "Mean Reversion",
  "structure-breakout": "Structure Breakout",
};

const INTERVALS: TradingTimeframe[] = ["1m", "5m", "15m", "1h", "1D"];

function pct(n: number | null): string {
  return n === null ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

function exitReasonBadgeClass(reason: string): string {
  if (reason === "target") return "border-emerald-500/40 text-emerald-400";
  if (reason === "stop") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

export default function TradingBacktest() {
  const [symbol, setSymbol] = useState("SPY");
  const [strategy, setStrategy] = useState<TradingBacktestStrategy>(TradingBacktestStrategy["trend-following"]);
  const [interval, setInterval] = useState<TradingTimeframe>("1D");
  const [lastResult, setLastResult] = useState<TradingBacktestResult | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: results, isLoading } = useListTradingBacktestResults();
  const runBacktest = useRunTradingBacktest();

  const handleRun = () => {
    runBacktest.mutate(
      { data: { symbol, strategy, interval } },
      {
        onSuccess: (data) => {
          setLastResult(data);
          queryClient.invalidateQueries({ queryKey: getListTradingBacktestResultsQueryKey() });
          toast({ title: "Backtest completed" });
        },
        onError: () => {
          toast({ title: "Backtest failed", variant: "destructive" });
        },
      },
    );
  };

  const selectedResult = lastResult ?? results?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Backtesting</h1>
        <p className="text-sm text-muted-foreground">
          A genuine walk-forward simulation replaying SIMULATED candles through a named entry/exit rule set — advisory
          only, never places an order.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>New Backtest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Symbol</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="font-mono bg-background"
                data-testid="input-backtest-symbol"
              />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Strategy</label>
              <Select value={strategy} onValueChange={(v: TradingBacktestStrategy) => setStrategy(v)}>
                <SelectTrigger className="bg-background" data-testid="select-backtest-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trend-following">Trend Following</SelectItem>
                  <SelectItem value="mean-reversion">Mean Reversion</SelectItem>
                  <SelectItem value="structure-breakout">Structure Breakout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Interval</label>
              <Select value={interval} onValueChange={(v: TradingTimeframe) => setInterval(v)}>
                <SelectTrigger className="bg-background" data-testid="select-backtest-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRun}
              disabled={runBacktest.isPending || !symbol}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full md:w-auto"
              data-testid="button-run-backtest"
            >
              {runBacktest.isPending ? "Simulating..." : (
                <>
                  <Play className="w-4 h-4 mr-2" /> Run
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedResult && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Equity Curve</CardTitle>
                <CardDescription className="font-mono">
                  {selectedResult.symbol} • {STRATEGY_LABELS[selectedResult.strategy] ?? selectedResult.strategy} •{" "}
                  {selectedResult.interval}
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-sky-500/40 text-sky-400">
                {selectedResult.dataSource}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedResult.available ? (
              <div className="text-sm text-muted-foreground py-8 text-center" data-testid="text-backtest-unavailable">
                {selectedResult.unavailableReason}
              </div>
            ) : selectedResult.totalTrades === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center" data-testid="text-backtest-no-trades">
                {selectedResult.summary}
              </div>
            ) : (
              <>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedResult.equityCurve} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => `$${v}`}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                        itemStyle={{ color: "hsl(var(--primary))" }}
                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                  <div className="bg-background p-3 rounded border border-border">
                    <div className="text-xs text-muted-foreground uppercase">Win Rate</div>
                    <div className="text-xl font-mono text-primary">{pct(selectedResult.winRate)}</div>
                  </div>
                  <div className="bg-background p-3 rounded border border-border">
                    <div className="text-xs text-muted-foreground uppercase">Avg R</div>
                    <div className="text-xl font-mono">{selectedResult.avgR === null ? "n/a" : selectedResult.avgR.toFixed(2)}</div>
                  </div>
                  <div className="bg-background p-3 rounded border border-border">
                    <div className="text-xs text-muted-foreground uppercase">Max Drawdown</div>
                    <div className="text-xl font-mono text-destructive">{pct(selectedResult.maxDrawdownPct)}</div>
                  </div>
                  <div className="bg-background p-3 rounded border border-border">
                    <div className="text-xs text-muted-foreground uppercase">Total Return</div>
                    <div className="text-xl font-mono text-success">{pct(selectedResult.totalReturnPct)}</div>
                  </div>
                  <div className="bg-background p-3 rounded border border-border">
                    <div className="text-xs text-muted-foreground uppercase">Trades</div>
                    <div className="text-xl font-mono">{selectedResult.totalTrades}</div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mt-4">{selectedResult.summary}</p>

                <div className="mt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Entry</TableHead>
                        <TableHead>Exit</TableHead>
                        <TableHead className="text-right">Entry Px</TableHead>
                        <TableHead className="text-right">Exit Px</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">P&L%</TableHead>
                        <TableHead className="text-right">R</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedResult.trades.map((t, i) => (
                        <TableRow key={i} className="border-border font-mono text-sm">
                          <TableCell>{new Date(t.entryDate).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(t.exitDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">${t.entryPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${t.exitPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={exitReasonBadgeClass(t.exitReason)}>
                              {t.exitReason}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right ${t.pnlPct >= 0 ? "text-success" : "text-destructive"}`}>
                            {(t.pnlPct * 100).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right">{t.rMultiple.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Symbol</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Avg R</TableHead>
                <TableHead className="text-right">Return</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : results?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4" data-testid="text-backtest-history-empty">
                    No backtests run yet.
                  </TableCell>
                </TableRow>
              ) : (
                results?.map((res) => (
                  <TableRow
                    key={res.id}
                    className="border-border font-mono text-sm hover:bg-secondary/50 cursor-pointer"
                    onClick={() => setLastResult(res)}
                  >
                    <TableCell className="font-bold">{res.symbol}</TableCell>
                    <TableCell className="capitalize">{STRATEGY_LABELS[res.strategy] ?? res.strategy}</TableCell>
                    <TableCell>{res.interval}</TableCell>
                    <TableCell className="text-right">{res.totalTrades}</TableCell>
                    <TableCell className="text-right">{pct(res.winRate)}</TableCell>
                    <TableCell className="text-right">{res.avgR === null ? "n/a" : res.avgR.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-success">{pct(res.totalReturnPct)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
