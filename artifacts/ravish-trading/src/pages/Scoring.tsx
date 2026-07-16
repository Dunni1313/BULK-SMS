import { useGetScoringLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function Scoring() {
  const { data: leaderboard, isLoading } = useGetScoringLeaderboard();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Ravish Score Leaderboard</h1>
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Top AI Picks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Symbol</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right w-[150px]">POP Score</TableHead>
                <TableHead className="text-right w-[150px]">EV Score</TableHead>
                <TableHead className="text-right w-[150px]">Theta Score</TableHead>
                <TableHead className="text-right font-bold">Total Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-2 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-2 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-2 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : leaderboard?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">No scored opportunities.</TableCell>
                </TableRow>
              ) : (
                leaderboard?.map(score => (
                  <TableRow key={`${score.symbol}-${score.strategy}`} className="border-border hover:bg-secondary/50 font-mono text-sm">
                    <TableCell className="font-bold">{score.symbol}</TableCell>
                    <TableCell className="capitalize">{score.strategy.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        score.tier === 'elite' ? 'border-yellow-500 text-yellow-500' :
                        score.tier === 'high_conviction' ? 'border-slate-300 text-slate-300' :
                        score.tier === 'good' ? 'border-success text-success' : 'border-muted text-muted'
                      }>
                        {score.tier.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={score.popScore} className="h-1.5" />
                        <span className="text-xs w-8 text-right">{score.popScore.toFixed(0)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={score.evScore} className="h-1.5" />
                        <span className="text-xs w-8 text-right">{score.evScore.toFixed(0)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={score.thetaScore} className="h-1.5" />
                        <span className="text-xs w-8 text-right">{score.thetaScore.toFixed(0)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-lg font-bold text-primary">
                      {score.totalScore.toFixed(1)}
                    </TableCell>
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
