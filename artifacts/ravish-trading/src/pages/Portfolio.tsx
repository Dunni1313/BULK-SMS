import { useGetPortfolioGreeks, useGetPortfolioPositions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExplainButton } from "@/components/learn/ExplainButton";
import { MessageCircle } from "lucide-react";
import { useTradingCoach } from "@/hooks/use-trading-coach";

export default function Portfolio() {
  const { data: greeks, isLoading: isLoadingGreeks } = useGetPortfolioGreeks();
  const { data: positions, isLoading: isLoadingPositions } = useGetPortfolioPositions();
  const { openWithFocus } = useTradingCoach();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Portfolio Greeks</h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
          onClick={() => openWithFocus({})}
          data-testid="button-ask-trading-coach-portfolio"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Ask AI Trading Coach
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-1.5">
              Beta-Weighted Delta <ExplainButton metrics={["delta"]} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGreeks ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-mono flex items-center gap-3">
                {greeks?.totalDelta.toFixed(2)}
                <Badge variant="outline" className={
                  greeks?.deltaStatus === 'neutral' ? 'border-primary text-primary' :
                  greeks?.deltaStatus === 'bullish' ? 'border-success text-success' : 'border-destructive text-destructive'
                }>
                  {greeks?.deltaStatus}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-1.5">
              Theta (Daily Income) <ExplainButton metrics={["theta"]} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGreeks ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-mono text-success">
                ${greeks?.dailyThetaIncome.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-1.5">
              Vega <ExplainButton metrics={["vega"]} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGreeks ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-mono text-destructive">
                {greeks?.totalVega.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-1.5">
              Gamma <ExplainButton metrics={["gamma"]} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGreeks ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-mono">
                {greeks?.totalGamma.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {greeks?.recommendations && greeks.recommendations.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary uppercase">AI Portfolio Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {greeks.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Symbol</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right">DTE</TableHead>
                <TableHead className="text-right">Unrealized P&L</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="text-right">Theta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPositions ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : positions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No active positions.
                  </TableCell>
                </TableRow>
              ) : (
                positions?.map((pos) => (
                  <TableRow key={pos.id} className="border-border font-mono text-sm hover:bg-secondary/50">
                    <TableCell className="font-bold">{pos.symbol}</TableCell>
                    <TableCell className="capitalize">{pos.strategy.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right">
                      {pos.expiration ? Math.max(0, Math.floor((new Date(pos.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : '-'}
                    </TableCell>
                    <TableCell className={`text-right ${pos.unrealizedPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ${pos.unrealizedPnl.toFixed(2)}
                      {pos.unrealizedPnlPercent !== undefined && ` (${pos.unrealizedPnlPercent.toFixed(1)}%)`}
                    </TableCell>
                    <TableCell className="text-right">{pos.delta.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-success">{pos.theta.toFixed(2)}</TableCell>
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
