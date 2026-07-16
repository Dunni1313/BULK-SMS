// Correlation & Concentration Risk Overlay sprint.
//
// A dedicated, read-only overlay: portfolio-wide concentration,
// directional exposure, net Greeks, and correlation-style clustering
// across the user's own current open portfolio, reusing
// lib/positionSizing.ts's/serverState.ts's existing, unmodified
// currentOpenTrades()/buildSnapshot()/computeTradeGreeks() via GET
// /portfolio/concentration (lib/portfolioConcentration.ts, backend).
// This page never submits, closes, or modifies anything.

import { useMemo, useState } from "react";
import { useGetPortfolioConcentration } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer } from "recharts";

type Dimension = "symbol" | "sector" | "strategy" | "expiration" | "directionalBias" | "assetClass";
type SortMode = "weight_desc" | "weight_asc" | "label_asc";

const DIMENSION_OPTIONS: { value: Dimension; label: string }[] = [
  { value: "symbol", label: "Symbol" },
  { value: "sector", label: "Sector" },
  { value: "strategy", label: "Strategy" },
  { value: "expiration", label: "Expiration" },
  { value: "directionalBias", label: "Directional Bias" },
  { value: "assetClass", label: "Asset Class" },
];

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function guidanceBadgeClass(code: string): string {
  if (code === "well_diversified") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (code === "moderate_concentration") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (code === "high_concentration") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function heatColor(weightPct: number): string {
  // A simple, disclosed intensity scale — never a fabricated new metric,
  // purely a visual mapping of the already-computed weightPct.
  const alpha = Math.min(0.9, 0.15 + weightPct / 120);
  return `rgba(239, 68, 68, ${alpha})`;
}

export default function PortfolioConcentration() {
  const { data: result, isLoading, isError } = useGetPortfolioConcentration();
  const [dimension, setDimension] = useState<Dimension>("symbol");
  const [sortMode, setSortMode] = useState<SortMode>("weight_desc");
  const [minPositions, setMinPositions] = useState<string>("0");

  const breakdown = result?.breakdowns[dimension];

  const filteredSortedBuckets = useMemo(() => {
    if (!breakdown) return [];
    const min = Number(minPositions) || 0;
    let buckets = breakdown.buckets.filter((b) => b.positionCount >= min);
    buckets = [...buckets];
    if (sortMode === "weight_desc") buckets.sort((a, b) => b.weightPct - a.weightPct);
    else if (sortMode === "weight_asc") buckets.sort((a, b) => a.weightPct - b.weightPct);
    else buckets.sort((a, b) => a.label.localeCompare(b.label));
    return buckets;
  }, [breakdown, sortMode, minPositions]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Correlation &amp; Concentration Risk</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-read-only-portfolio-analysis">
            Read-Only Portfolio Analysis
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          A portfolio-wide view of concentration, directional exposure, net Greeks, and correlation-
          style clustering across your current open positions. Informational only — nothing here
          places, closes, or modifies a real order, and no execution recommendation is ever generated.
        </p>
      </div>

      {isLoading && (
        <Card className="bg-card border-border" data-testid="concentration-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-concentration-error">
              Failed to load portfolio concentration analysis. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Portfolio Overview ─────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-portfolio-overview">
            <CardHeader>
              <CardTitle>Portfolio Overview</CardTitle>
              <CardDescription>Current portfolio analytics — not simulated or hypothetical values.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Total Portfolio Value</div>
                <div className="font-mono text-lg" data-testid="text-total-portfolio-value">{fmtUsd(result.totalPortfolioValue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Delta</div>
                <div className="font-mono" data-testid="text-net-delta">{result.netGreeks.delta}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Gamma</div>
                <div className="font-mono" data-testid="text-net-gamma">{result.netGreeks.gamma}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Theta</div>
                <div className="font-mono" data-testid="text-net-theta">{result.netGreeks.theta}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Vega</div>
                <div className="font-mono" data-testid="text-net-vega">{result.netGreeks.vega}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Beta</div>
                <div className="text-muted-foreground text-xs" data-testid="text-net-beta-unavailable">
                  {result.netBetaUnavailableReason}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Net Directional Exposure</div>
                <div data-testid="text-net-directional-exposure">
                  {fmtUsd(result.netDirectionalExposure.netExposureDollars)} —{" "}
                  <span className="uppercase">{result.netDirectionalExposure.netBiasLabel.replace(/_/g, " ")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Portfolio Summary ──────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-portfolio-summary">
            <CardHeader>
              <CardTitle>Portfolio Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Largest Concentration</div>
                {result.summary.largestConcentration ? (
                  <div data-testid="text-largest-concentration">
                    {result.summary.largestConcentration.bucket.label} ({fmtPct(result.summary.largestConcentration.bucket.weightPct)})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-largest-concentration-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Highest Directional Exposure</div>
                {result.summary.highestDirectionalExposure ? (
                  <div data-testid="text-highest-directional-exposure">
                    {fmtUsd(result.summary.highestDirectionalExposure.exposureDollars)} (
                    {result.summary.highestDirectionalExposure.direction})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-highest-directional-exposure-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Highest Greeks Contributor</div>
                {result.summary.highestGreeksContributor ? (
                  <div data-testid="text-highest-greeks-contributor">
                    {result.summary.highestGreeksContributor.symbol} (Δ {result.summary.highestGreeksContributor.delta})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-highest-greeks-contributor-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Most Diversified Area</div>
                {result.summary.mostDiversifiedArea ? (
                  <div data-testid="text-most-diversified-area">
                    {result.summary.mostDiversifiedArea.label} (score {result.summary.mostDiversifiedArea.concentrationScore})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-most-diversified-area-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Least Diversified Area</div>
                {result.summary.leastDiversifiedArea ? (
                  <div data-testid="text-least-diversified-area">
                    {result.summary.leastDiversifiedArea.label} (score {result.summary.leastDiversifiedArea.concentrationScore})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-least-diversified-area-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Concentration / Diversification Score</div>
                <div data-testid="text-concentration-diversification-score">
                  {result.summary.concentrationScore} / {result.summary.diversificationScore}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <div className="text-xs text-muted-foreground">Portfolio Health</div>
                <Badge className={guidanceBadgeClass(result.riskGuidance.code)} data-testid="badge-portfolio-health">
                  {result.summary.portfolioHealthLabel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* ─── Risk Guidance ──────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-risk-guidance">
            <CardHeader>
              <CardTitle>Risk Guidance</CardTitle>
              <CardDescription>Informational only — no execution recommendation is ever generated.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge className={guidanceBadgeClass(result.riskGuidance.code)} data-testid="badge-risk-guidance-primary">
                {result.riskGuidance.label}
              </Badge>
              {result.riskGuidance.advisories.length > 0 ? (
                <ul className="space-y-1" data-testid="list-risk-guidance-advisories">
                  {result.riskGuidance.advisories.map((a) => (
                    <li key={a.code} className="text-sm" data-testid={`advisory-${a.code}`}>
                      <span className="font-medium">{a.label}:</span> {a.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-advisories">No additional advisories.</p>
              )}
            </CardContent>
          </Card>

          {/* ─── Directional / Long-Short / Call-Put exposure ──────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Exposure Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div data-testid="text-long-short-exposure">
                Long {fmtUsd(result.longShort.longExposureDollars)} ({fmtPct(result.longShort.longPct)}) / Short{" "}
                {fmtUsd(result.longShort.shortExposureDollars)} ({fmtPct(result.longShort.shortPct)})
              </div>
              <div data-testid="text-call-put-exposure">
                Calls {fmtUsd(result.callPut.callNotional)} ({fmtPct(result.callPut.callPct)}) / Puts{" "}
                {fmtUsd(result.callPut.putNotional)} ({fmtPct(result.callPut.putPct)})
              </div>
            </CardContent>
          </Card>

          {/* ─── Concentration Analysis (breakdown + allocation chart) ────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Concentration Analysis</CardTitle>
              <CardDescription>Concentration by symbol, sector, strategy, expiration, directional bias, and asset class.</CardDescription>
              <div className="flex flex-wrap gap-3 pt-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Dimension</label>
                  <Select value={dimension} onValueChange={(v) => setDimension(v as Dimension)}>
                    <SelectTrigger className="bg-background w-48" data-testid="select-dimension">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIMENSION_OPTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sort By</label>
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                    <SelectTrigger className="bg-background w-44" data-testid="select-sort-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weight_desc">Weight (High to Low)</SelectItem>
                      <SelectItem value="weight_asc">Weight (Low to High)</SelectItem>
                      <SelectItem value="label_asc">Label (A–Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min. Positions</label>
                  <Select value={minPositions} onValueChange={setMinPositions}>
                    <SelectTrigger className="bg-background w-36" data-testid="select-min-positions">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All buckets</SelectItem>
                      <SelectItem value="2">2+ positions</SelectItem>
                      <SelectItem value="3">3+ positions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {breakdown && (
                <div className="text-sm" data-testid="text-breakdown-concentration-score">
                  Concentration score for {DIMENSION_OPTIONS.find((d) => d.value === dimension)?.label}:{" "}
                  {breakdown.concentrationScore}/100
                </div>
              )}
              {filteredSortedBuckets.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-breakdown-buckets">
                  No open positions in this breakdown.
                </p>
              ) : (
                <>
                  <div className="h-64" data-testid="chart-allocation">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredSortedBuckets} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="label" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                          formatter={(v: number) => [`${v}%`, "Weight"]}
                        />
                        <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1 text-sm" data-testid="list-breakdown-buckets">
                    {filteredSortedBuckets.map((b) => (
                      <li key={b.key} className="flex items-center justify-between" data-testid={`bucket-${dimension}-${b.key}`}>
                        <span>
                          {b.label} <span className="text-muted-foreground">({b.positionCount} position{b.positionCount === 1 ? "" : "s"})</span>
                        </span>
                        <span className="font-mono">{fmtPct(b.weightPct)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {/* ─── Greeks Contribution ────────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Greeks Contribution</CardTitle>
              <CardDescription>Each position's own delta contribution to the portfolio's net delta.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.greeksContributions.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-greeks-contributions">No open positions.</p>
              ) : (
                <div className="h-64" data-testid="chart-greeks-contribution">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.greeksContributions} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis type="category" dataKey="symbol" width={80} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                        formatter={(v: number) => [v, "Delta"]}
                      />
                      <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                        {result.greeksContributions.map((c) => (
                          <Cell key={c.tradeId} fill={c.delta >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Concentration Heat Map ─────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Concentration Heat Map</CardTitle>
              <CardDescription>Symbol concentration, color-intensity-coded by portfolio weight.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.breakdowns.symbol.buckets.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-heatmap">No open positions.</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="grid-heatmap">
                  {result.breakdowns.symbol.buckets.map((b) => (
                    <div
                      key={b.key}
                      className="rounded-md px-3 py-2 text-xs font-medium text-white"
                      style={{ backgroundColor: heatColor(b.weightPct) }}
                      data-testid={`heatmap-cell-${b.key}`}
                    >
                      {b.label} — {fmtPct(b.weightPct)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Correlation Clusters ───────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Correlation Clusters</CardTitle>
              <CardDescription>
                Positions sharing the same underlying, sector, strategy, expiration, or directional bias —
                categorical grouping, not a statistical correlation model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.clusters.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-clusters">
                  No two positions currently share a tracked trait.
                </p>
              ) : (
                <ul className="space-y-1 text-sm" data-testid="list-clusters">
                  {result.clusters.map((c, i) => (
                    <li key={i} data-testid={`cluster-${c.dimension}-${c.key}`}>
                      <span className="font-medium">{c.positionCount} positions</span> share {c.dimension.replace(/_/g, " ")}:{" "}
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
