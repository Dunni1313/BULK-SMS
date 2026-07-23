import { useState } from "react";
import { useListTrades, useCloseTrade, useListTradeAdjustments, getListTradesQueryKey, ListTradesStatus, TradeStrategy, TradeAdjustment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { XCircle, Bot, Wrench } from "lucide-react";
import { TradeExplanationSheet } from "@/components/ui/trade-explanation-sheet";
import { TradeAdjustmentSheet } from "@/components/ui/trade-adjustment-sheet";
import { ExplainButton } from "@/components/learn/ExplainButton";

export default function Trades() {
  const [status, setStatus] = useState<ListTradesStatus | "all">("open");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [explainTradeParams, setExplainTradeParams] = useState<{symbol: string, strategy: TradeStrategy}>();
  const [adjustTradeId, setAdjustTradeId] = useState<number>();

  const { data: trades, isLoading } = useListTrades(
    status === "all" ? undefined : { status }
  );

  // Per-row adjustment recommendations for open positions (deterministic engine).
  const { data: adjustments } = useListTradeAdjustments();
  const adjByTrade = new Map<number, TradeAdjustment>(
    (adjustments ?? []).map((a) => [a.tradeId, a])
  );

  const closeTrade = useCloseTrade();

  const handleClose = (id: number) => {
    closeTrade.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
          toast({ title: "Trade closed successfully" });
        },
        onError: () => {
          toast({ title: "Failed to close trade", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Trade Log</h1>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="open">Open Trades</TabsTrigger>
          <TabsTrigger value="closed">Closed Trades</TabsTrigger>
          <TabsTrigger value="all">All History</TabsTrigger>
        </TabsList>
        
        <Card className="mt-4 bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Symbol</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Open Date</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Current P&L</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : trades?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No trades found.
                    </TableCell>
                  </TableRow>
                ) : (
                  trades?.map((trade) => (
                    <TableRow key={trade.id} className="border-border font-mono text-sm hover:bg-secondary/50">
                      <TableCell className="font-bold">{trade.symbol}</TableCell>
                      <TableCell className="capitalize">{trade.strategy.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          trade.status === 'open' ? 'border-primary text-primary' :
                          trade.status === 'closed' ? 'border-muted text-muted-foreground' : 'border-slate-500'
                        }>
                          {trade.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(trade.openDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right text-success">${trade.credit.toFixed(2)}</TableCell>
                      <TableCell className={`text-right ${(trade.currentPnl || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {trade.currentPnl !== undefined && trade.currentPnl !== null ? `$${trade.currentPnl.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {trade.status === 'open' && adjByTrade.has(trade.id) ? (
                          <button
                            type="button"
                            onClick={() => setAdjustTradeId(trade.id)}
                            className="cursor-pointer"
                            title="View adjustment recommendation"
                          >
                            <RecommendationBadge adj={adjByTrade.get(trade.id)!} />
                          </button>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <ExplainButton
                            metrics={["probability_of_profit", "max_profit", "max_loss", "expected_move"]}
                            tradeId={trade.id}
                            label="Explain"
                            align="end"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                            onClick={() => setExplainTradeParams({ symbol: trade.symbol, strategy: trade.strategy })}
                            title="Explain with AI Coach"
                          >
                            <Bot className="w-4 h-4" />
                          </Button>
                          {trade.status === 'open' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleClose(trade.id)}
                              disabled={closeTrade.isPending}
                              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-7 px-2"
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Close
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>

      <TradeExplanationSheet 
        open={!!explainTradeParams} 
        onOpenChange={(o) => !o && setExplainTradeParams(undefined)} 
        symbol={explainTradeParams?.symbol} 
        strategy={explainTradeParams?.strategy} 
      />

      <TradeAdjustmentSheet
        open={adjustTradeId !== undefined}
        onOpenChange={(o) => !o && setAdjustTradeId(undefined)}
        tradeId={adjustTradeId}
      />
    </div>
  );
}

function RecommendationBadge({ adj }: { adj: TradeAdjustment }) {
  const cls =
    adj.severity === "critical"
      ? "border-destructive/40 text-destructive bg-destructive/10"
      : adj.severity === "warning"
      ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
      : adj.severity === "info"
      ? "border-indigo-500/40 text-indigo-400 bg-indigo-500/10"
      : "border-muted text-muted-foreground bg-muted/10";
  return (
    <Badge variant="outline" className={`gap-1 ${cls}`}>
      <Wrench className="w-3 h-3" />
      {adj.actionLabel}
    </Badge>
  );
}
