import { useState } from "react";
import {
  useGetPerformanceAnalytics,
  useGetEquityCurve,
  useGetPerformanceBreakdown,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ComposedChart,
  Area,
} from "recharts";

type Period = "1m" | "3m" | "6m" | "1y" | "all";
type Dimension = "strategy" | "ticker" | "duration" | "delta" | "ivrank";

const PERIODS: { value: Period; label: string }[] = [
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "strategy", label: "Strategy" },
  { value: "ticker", label: "Ticker" },
  { value: "duration", label: "Duration" },
  { value: "delta", label: "Delta" },
  { value: "ivrank", label: "IV Rank" },
];

const fmtUsd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;

export default function Performance() {
  const [period, setPeriod] = useState<Period>("1y");
  const [dimension, setDimension] = useState<Dimension>("strategy");

  const { data: analytics, isLoading } = useGetPerformanceAnalytics({ period });
  const { data: equity, isLoading: equityLoading } = useGetEquityCurve({ period });
  const { data: breakdown, isLoading: breakdownLoading } = useGetPerformanceBreakdown({
    dimension,
    period,
  });

  const sortedBreakdown = [...(breakdown ?? [])].sort((a, b) => b.totalReturn - a.totalReturn);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-amber-500/10">
              Simulated
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Modeled closed-trade analytics across {analytics?.totalTrades ?? "—"} positions — connect a broker in
            Settings for live history
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          className="bg-card border border-border rounded-md p-1"
        >
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value} className="text-xs font-mono px-3">
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Win Rate" loading={isLoading} value={fmtPct(analytics?.winRate ?? 0)} tone="primary" />
        <Kpi label="Profit Factor" loading={isLoading} value={(analytics?.profitFactor ?? 0).toFixed(2)} tone="success" />
        <Kpi label="Expectancy" loading={isLoading} value={fmtUsd(analytics?.expectancy ?? 0)} tone={(analytics?.expectancy ?? 0) >= 0 ? "success" : "destructive"} />
        <Kpi label="Total P&L" loading={isLoading} value={fmtUsd(analytics?.totalReturn ?? 0)} tone={(analytics?.totalReturn ?? 0) >= 0 ? "success" : "destructive"} />
        <Kpi label="Return on Capital" loading={isLoading} value={fmtPct(analytics?.returnOnCapital ?? 0)} />
        <Kpi label="Max Drawdown" loading={isLoading} value={fmtPct(analytics?.maxDrawdown ?? 0)} tone="destructive" />
        <Kpi label="Avg Win" loading={isLoading} value={fmtUsd(analytics?.avgWin ?? 0)} tone="success" />
        <Kpi label="Avg Loss" loading={isLoading} value={fmtUsd(analytics?.avgLoss ?? 0)} tone="destructive" />
        <Kpi label="Sharpe" loading={isLoading} value={(analytics?.sharpeRatio ?? 0).toFixed(2)} />
        <Kpi label="Sortino" loading={isLoading} value={(analytics?.sortinoRatio ?? 0).toFixed(2)} />
        <Kpi label="Avg Hold (days)" loading={isLoading} value={(analytics?.avgHoldingDays ?? 0).toFixed(1)} />
        <Kpi label="Theta Collected" loading={isLoading} value={fmtUsd(analytics?.thetaCollected ?? 0)} tone="success" />
      </div>

      {/* Equity curve + underwater drawdown */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Equity Curve & Drawdown</CardTitle>
          <CardDescription>Account value progression with the underwater drawdown plot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {equityLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <>
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={equity ?? []} margin={{ top: 5, right: 8, bottom: 0, left: 8 }} syncId="equity">
                    <defs>
                      <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" hide />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                      formatter={(v: number) => [fmtUsd(v), "Equity"]}
                    />
                    <Area type="monotone" dataKey="value" name="Equity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#eqFill)" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[90px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={equity ?? []} margin={{ top: 0, right: 8, bottom: 5, left: 8 }} syncId="equity">
                    <defs>
                      <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={40} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                      domain={["auto", 0]}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                      formatter={(v: number) => [fmtPct(v, 2), "Drawdown"]}
                    />
                    <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke="hsl(var(--destructive))" strokeWidth={1} fill="url(#ddFill)" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Highlights row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Highlight label="Best Strategy" loading={isLoading} value={analytics?.bestStrategy ?? "—"} tone="success" />
        <Highlight label="Worst Strategy" loading={isLoading} value={analytics?.worstStrategy ?? "—"} tone="destructive" />
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Top Tickers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              (analytics?.bestTickers ?? []).slice(0, 3).map((t) => (
                <div key={t.symbol} className="flex justify-between text-sm font-mono">
                  <span>{t.symbol}</span>
                  <span className="text-success">{fmtUsd(t.totalReturn)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Worst Tickers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              (analytics?.worstTickers ?? []).slice(0, 3).map((t) => (
                <div key={t.symbol} className="flex justify-between text-sm font-mono">
                  <span>{t.symbol}</span>
                  <span className={t.totalReturn >= 0 ? "text-success" : "text-destructive"}>{fmtUsd(t.totalReturn)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actual vs Expected POP + cost drag */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle>Actual vs Expected POP</CardTitle>
            <CardDescription>Realized win rate against the modeled probability of profit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <PopBar label="Expected POP" value={analytics?.expectedPop ?? 0} loading={isLoading} tone="muted" />
            <PopBar label="Actual POP" value={analytics?.actualPop ?? 0} loading={isLoading} tone="primary" />
            <p className="text-xs text-muted-foreground font-mono">
              Edge:{" "}
              {analytics
                ? `${((analytics.actualPop - analytics.expectedPop) * 100).toFixed(1)} pts`
                : "—"}{" "}
              (positive = outperforming the model)
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Cost Impact</CardTitle>
            <CardDescription>Frictions vs gross profit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm pt-2">
            <Row label="Commission" value={fmtUsd(analytics?.totalCommission ?? 0)} />
            <Row label="Slippage" value={fmtUsd(analytics?.totalSlippage ?? 0)} />
            <Row label="Cost Drag" value={fmtPct(analytics?.commissionImpactPct ?? 0)} highlight />
          </CardContent>
        </Card>
      </div>

      {/* Breakdown section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Breakdown</CardTitle>
              <CardDescription>Slice performance across dimensions</CardDescription>
            </div>
            <ToggleGroup
              type="single"
              value={dimension}
              onValueChange={(v) => v && setDimension(v as Dimension)}
              className="bg-secondary/40 border border-border rounded-md p-1"
            >
              {DIMENSIONS.map((d) => (
                <ToggleGroupItem key={d.value} value={d.value} className="text-xs px-3">
                  {d.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {breakdownLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedBreakdown} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="label" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                      formatter={(v: number) => [fmtUsd(v), "Total P&L"]}
                    />
                    <Bar dataKey="totalReturn" radius={[0, 4, 4, 0]}>
                      {sortedBreakdown.map((b) => (
                        <Cell key={b.key} fill={b.totalReturn >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bucket</TableHead>
                      <TableHead className="text-right">Trades</TableHead>
                      <TableHead className="text-right">Win%</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
                      <TableHead className="text-right">PF</TableHead>
                      <TableHead className="text-right">Exp.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBreakdown.map((b) => (
                      <TableRow key={b.key}>
                        <TableCell className="font-medium">{b.label}</TableCell>
                        <TableCell className="text-right font-mono">{b.totalTrades}</TableCell>
                        <TableCell className="text-right font-mono">{fmtPct(b.winRate, 0)}</TableCell>
                        <TableCell className={`text-right font-mono ${b.totalReturn >= 0 ? "text-success" : "text-destructive"}`}>
                          {fmtUsd(b.totalReturn)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{b.profitFactor.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtUsd(b.expectancy)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly returns */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Monthly Returns</CardTitle>
          <CardDescription>P&L percentage by month</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.monthlyReturns ?? []} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={20} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                    formatter={(v: number) => [fmtPct(v, 2), "Return"]}
                  />
                  <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                    {(analytics?.monthlyReturns ?? []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.return >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  loading,
  tone = "default",
}: {
  label: string;
  value: string;
  loading: boolean;
  tone?: "default" | "primary" | "success" | "destructive";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-7 w-16" /> : <div className={`text-xl font-mono ${toneClass}`}>{value}</div>}
      </CardContent>
    </Card>
  );
}

function Highlight({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: string;
  loading: boolean;
  tone: "success" | "destructive";
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className={`text-lg font-semibold ${tone === "success" ? "text-success" : "text-destructive"}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function PopBar({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone: "primary" | "muted";
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-mono">
        <span className="text-muted-foreground">{label}</span>
        <span>{fmtPct(value)}</span>
      </div>
      {loading ? (
        <Skeleton className="h-2 w-full" />
      ) : (
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${tone === "primary" ? "bg-primary" : "bg-muted-foreground"}`}
            style={{ width: `${Math.min(100, value * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "text-foreground font-semibold" : ""}>{value}</span>
    </div>
  );
}
