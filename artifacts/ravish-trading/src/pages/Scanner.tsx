import { useState } from "react";
import { useLocation } from "wouter";
import { useGetScannerResults, useRunScanner, getGetScannerResultsQueryKey, GetScannerResultsStrategy, ScannerResultRavishTier } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, FileSignature, Bot, MessageCircle } from "lucide-react";
import { TradeExplanationSheet } from "@/components/ui/trade-explanation-sheet";
import { EventRiskBadge } from "@/components/ui/event-risk-badge";
import { useTradingCoach } from "@/hooks/use-trading-coach";
import { focusFromScannerCandidate } from "@/lib/trading-coach-context";

export default function Scanner() {
  const [strategy, setStrategy] = useState<GetScannerResultsStrategy | "all">("all");
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [explainScannerId, setExplainScannerId] = useState<number>();
  const { openWithFocus } = useTradingCoach();

  const { data: results, isLoading } = useGetScannerResults(
    strategy === "all" ? undefined : { strategy }
  );

  const runScanner = useRunScanner();

  const handleRunScanner = () => {
    runScanner.mutate(
      { data: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetScannerResultsQueryKey() });
        }
      }
    );
  };

  const getTierColor = (tier?: ScannerResultRavishTier) => {
    switch (tier) {
      case 'elite': return 'border-yellow-500 text-yellow-500';
      case 'high_conviction': return 'border-slate-300 text-slate-300';
      case 'good': return 'border-success text-success';
      default: return 'border-muted text-muted';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Market Scanner</h1>
        <div className="flex gap-4 items-center">
          <Select value={strategy} onValueChange={(v: any) => setStrategy(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              <SelectItem value="iron_condor">Iron Condor</SelectItem>
              <SelectItem value="iron_fly">Iron Fly</SelectItem>
              <SelectItem value="calendar_spread">Calendar Spread</SelectItem>
              <SelectItem value="earnings">Earnings</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleRunScanner} 
            disabled={runScanner.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {runScanner.isPending ? (
              <span className="animate-pulse">Scanning...</span>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Scan
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Ranked Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground w-[100px]">Symbol</TableHead>
                <TableHead className="text-muted-foreground">Tier</TableHead>
                <TableHead className="text-muted-foreground">Strategy</TableHead>
                <TableHead className="text-muted-foreground text-right">DTE</TableHead>
                <TableHead className="text-muted-foreground text-right">Credit</TableHead>
                <TableHead className="text-muted-foreground text-right">POP</TableHead>
                <TableHead className="text-muted-foreground text-right">EV</TableHead>
                <TableHead className="text-muted-foreground text-right">Score</TableHead>
                <TableHead className="text-muted-foreground">Event Risk</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : results?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No opportunities found. Try running a scan.
                  </TableCell>
                </TableRow>
              ) : (
                results?.map((result) => (
                  <TableRow key={result.id} className="border-border hover:bg-secondary/50 font-mono text-sm">
                    <TableCell className="font-bold">{result.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`uppercase text-xs ${getTierColor(result.ravishTier)}`}>
                        {result.ravishTier?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{result.strategy.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right">{result.daysToExpiry}</TableCell>
                    <TableCell className="text-right text-success">${result.credit?.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{result.pop.toFixed(1)}%</TableCell>
                    <TableCell className="text-right text-success">{result.ev.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{result.ravishScore.toFixed(0)}</TableCell>
                    <TableCell>
                      <EventRiskBadge
                        level={result.eventRiskLevel}
                        penalty={result.eventRiskPenalty}
                        events={result.eventRiskEvents}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                          onClick={() => setExplainScannerId(result.id)}
                          title="Explain with AI Coach"
                        >
                          <Bot className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                          onClick={() => openWithFocus(focusFromScannerCandidate(result))}
                          title="Ask the AI Trading Assistant about this"
                          data-testid={`button-ask-trading-coach-${result.id}`}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => setLocation(`/ticket/${result.id}`)}
                          data-testid={`button-review-${result.id}`}
                        >
                          <FileSignature className="w-3 h-3 mr-1" />
                          Review
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <TradeExplanationSheet 
        open={!!explainScannerId} 
        onOpenChange={(open) => !open && setExplainScannerId(undefined)} 
        scannerResultId={explainScannerId} 
      />
    </div>
  );
}
