// Phase 4, Sprint 58 — Options Engine-Native Backtesting (Route + UI)
// (approved Phase 4 plan, Sprint 58; conditional on Sprint 57's own Core
// output proving valuable; see docs/Phase-4-Master-Execution-Plan.md's
// Sprint 58 as-built note).
//
// A genuine walk-forward options-strategy backtest, reusing
// TradingBacktest.tsx's own established rendering pattern (recharts
// equity-curve LineChart, KPI tile grid, a history table) — not its
// Engine-2-specific trade fields (this page shows entryCredit/exitDebit/
// maxLoss/daysHeld, the options-native vocabulary lib/optionsBacktest.ts
// itself produces, not entryPrice/exitPrice/pnlPct). Every result comes
// from lib/optionsBacktest.ts's own real bar-by-bar walk-forward replay
// (Sprint 57), reused unmodified via routes/optionsBacktest.ts — this page
// adds zero backtest math of its own, only the form + rendering.
//
// Only one strategy exists this sprint (iron_condor), so there is
// deliberately no strategy selector — a dropdown with a single, unchangeable
// option would be UI for a choice that doesn't exist yet.
//
// Honest-empty handling throughout: a result with zero triggered trades
// (every candidate entry rejected) shows its own honest summary rather than
// a fabricated empty chart; an unavailable result (too few candles, or a
// symbol outside optionsMath.ts's own supported options universe) shows its
// own unavailableReason.

import { useState } from "react";
import {
  useRunOptionsBacktest,
  useListOptionsBacktestResults,
  getListOptionsBacktestResultsQueryKey,
  type OptionsBacktestResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, FlaskConical } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

function pct(n: number | null): string {
  return n === null ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function exitReasonBadgeClass(reason: string): string {
  if (reason === "profit-target" || reason === "expiration") return "border-emerald-500/40 text-emerald-400";
  if (reason === "stop-loss") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

export default function OptionsBacktest() {
  const [symbol, setSymbol] = useState("SPY");
  const [lastResult, setLastResult] = useState<OptionsBacktestResult | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: results, isLoading } = useListOptionsBacktestResults();
  const runBacktest = useRunOptionsBacktest();

  const handleRun = () => {
    runBacktest.mutate(
      { data: { symbol, strategy: "iron_condor" } },
      {
        onSuccess: (data) => {
          setLastResult(data);
          queryClient.invalidateQueries({ queryKey: getListOptionsBacktestResultsQueryKey() });
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
    <div className="space-y-6" data-testid="page-options-backtest">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Options Backtesting</h1>
        <p className="text-sm text-muted-foreground">
          A genuine walk-forward simulation replaying a real SIMULATED underlying price path (Engine 2) through actual
          options pricing (Black-Scholes, optionsMath.ts) — advisory only, never places an order.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>New Backtest</CardTitle>
          <CardDescription>Iron condor — 45 DTE entry, 50% profit target, 2x stop loss, 21 DTE exit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Symbol</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="font-mono bg-background"
                data-testid="input-options-backtest-symbol"
              />
            </div>
            <Button
              onClick={handleRun}
              disabled={runBacktest.isPending || !symbol}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full md:w-auto"
              data-testid="button-run-options-backtest"
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
                  {selectedResult.symbol} • iron_condor
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="border-sky-500/40 text-sky-400">
                  Underlying: {selectedResult.underlyingDataSource}
                </Badge>
                <Badge variant="outline" className="border-sky-500/40 text-sky-400">
                  Options: {selectedResult.optionsDataSource}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedResult.available ? (
              <div className="text-sm text-muted-foreground py-8 text-center" data-testid="text-options-backtest-unavailable">
                {selectedResult.unavailableReason}
              </div>
            ) : selectedResult.totalTrades === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center" data-testid="text-options-backtest-no-trades">
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
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">R</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedResult.trades.map((t, i) => (
                        <TableRow key={i} className="border-border font-mono text-sm">
                          <TableCell>{new Date(t.entryDate).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(t.exitDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{usd(t.entryCredit)}</TableCell>
                          <TableCell className="text-right">{usd(t.exitDebit)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={exitReasonBadgeClass(t.exitReason)}>
                              {t.exitReason}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right ${t.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                            {usd(t.pnl)}
                          </TableCell>
                          <TableCell className="text-right">{t.rMultiple.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{t.daysHeld}</TableCell>
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
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Avg R</TableHead>
                <TableHead className="text-right">Return</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : results?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4" data-testid="text-options-backtest-history-empty">
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
