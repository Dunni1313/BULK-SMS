import { useState } from "react";
import { useListBacktestResults, useRunBacktest, getListBacktestResultsQueryKey, BacktestInputStrategy, BacktestInputPeriod, ExplainTradeInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Bot } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { TradeExplanationSheet } from "@/components/ui/trade-explanation-sheet";

// Backtest strategies are a compatible subset of the coach's explain strategies.
type ExplainStrategy = ExplainTradeInput["strategy"];

export default function Backtest() {
  const [symbol, setSymbol] = useState("SPY");
  const [strategy, setStrategy] = useState<BacktestInputStrategy>("iron_condor");
  const [period, setPeriod] = useState<BacktestInputPeriod>("1y");
  const [explain, setExplain] = useState<{ symbol: string; strategy: ExplainStrategy } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: results, isLoading } = useListBacktestResults();
  const runBacktest = useRunBacktest();

  const handleRun = () => {
    runBacktest.mutate(
      { data: { symbol, strategy, period } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBacktestResultsQueryKey() });
          toast({ title: "Backtest completed" });
        },
        onError: () => {
          toast({ title: "Backtest failed", variant: "destructive" });
        }
      }
    );
  };

  const selectedResult = results?.[0]; // Show latest by default for chart

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Backtest Engine</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>New Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Symbol</label>
              <Input 
                value={symbol} 
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="font-mono bg-background"
              />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Strategy</label>
              <Select value={strategy} onValueChange={(v: any) => setStrategy(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iron_condor">Iron Condor</SelectItem>
                  <SelectItem value="iron_fly">Iron Fly</SelectItem>
                  <SelectItem value="calendar_spread">Calendar Spread</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Period</label>
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1y">1 Year</SelectItem>
                  <SelectItem value="2y">2 Years</SelectItem>
                  <SelectItem value="5y">5 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleRun} 
              disabled={runBacktest.isPending || !symbol}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full md:w-auto"
            >
              {runBacktest.isPending ? "Simulating..." : <><Play className="w-4 h-4 mr-2" /> Run</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedResult && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Equity Curve</CardTitle>
                <CardDescription className="font-mono">
                  {selectedResult.symbol} • {selectedResult.strategy.replace('_', ' ')} • {selectedResult.period}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setExplain({
                    symbol: selectedResult.symbol,
                    strategy: selectedResult.strategy as ExplainStrategy,
                  })
                }
                className="shrink-0 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
              >
                <Bot className="w-4 h-4 mr-2" /> Explain This Trade
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedResult.equityCurve} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, {month:'short', year:'2-digit'})}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(v) => `$${v}`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-background p-3 rounded border border-border">
                <div className="text-xs text-muted-foreground uppercase">Win Rate</div>
                <div className="text-xl font-mono text-primary">{(selectedResult.winRate * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-background p-3 rounded border border-border">
                <div className="text-xs text-muted-foreground uppercase">Expectancy</div>
                <div className="text-xl font-mono text-success">${selectedResult.expectancy.toFixed(2)}</div>
              </div>
              <div className="bg-background p-3 rounded border border-border">
                <div className="text-xs text-muted-foreground uppercase">Max Drawdown</div>
                <div className="text-xl font-mono text-destructive">{(selectedResult.maxDrawdown * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-background p-3 rounded border border-border">
                <div className="text-xs text-muted-foreground uppercase">Total Return</div>
                <div className="text-xl font-mono">{(selectedResult.totalReturn * 100).toFixed(1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Symbol</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Expectancy</TableHead>
                <TableHead className="text-right">Return</TableHead>
                <TableHead className="text-right">Coach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ) : results?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-4">No backtests run yet.</TableCell></TableRow>
              ) : (
                results?.map(res => (
                  <TableRow key={res.id} className="border-border font-mono text-sm hover:bg-secondary/50">
                    <TableCell className="font-bold">{res.symbol}</TableCell>
                    <TableCell className="capitalize">{res.strategy.replace('_', ' ')}</TableCell>
                    <TableCell>{res.period}</TableCell>
                    <TableCell className="text-right">{res.totalTrades}</TableCell>
                    <TableCell className="text-right">{(res.winRate * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">${res.expectancy.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-success">{(res.totalReturn * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExplain({ symbol: res.symbol, strategy: res.strategy as ExplainStrategy })
                        }
                        className="h-7 px-2 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
                      >
                        <Bot className="w-3.5 h-3.5 mr-1" /> Explain
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TradeExplanationSheet
        open={explain !== null}
        onOpenChange={(o) => !o && setExplain(null)}
        symbol={explain?.symbol}
        strategy={explain?.strategy}
      />
    </div>
  );
}
