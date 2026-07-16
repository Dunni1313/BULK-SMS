// Portfolio Risk Dashboard & Health Score sprint.
//
// A single executive dashboard unifying every prior read-only Paper
// Trading portfolio overlay this codebase already has (Position Sizing,
// Portfolio Stress Test, Earnings & Event Risk, Correlation &
// Concentration) via GET /portfolio/dashboard
// (lib/portfolioDashboard.ts, backend) — a pure composition layer, zero
// new pricing/provider calls. This page never submits, closes, or
// modifies anything; every widget links out to its own already-existing
// detailed page rather than re-implementing that page's own logic here.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useGetPortfolioDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";

type FactorSortMode = "default" | "score_asc";

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function ratingBadgeClass(code: string): string {
  if (code === "healthy") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (code === "moderate_risk") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (code === "elevated_risk") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function ratingColor(code: string): string {
  if (code === "healthy") return "#22c55e";
  if (code === "moderate_risk") return "#38bdf8";
  if (code === "elevated_risk") return "#f59e0b";
  return "#ef4444";
}

// Mirrors pages/Dashboard.tsx's own established ScoreRing gauge pattern
// (a small RadialBarChart-based ring), sized larger for this page's own
// headline Health Score — the same visual technique, not a new charting
// approach.
function HealthGauge({ score, ratingCode }: { score: number; ratingCode: string }) {
  const rounded = Math.round(score);
  const color = ratingColor(ratingCode);
  const data = [{ value: rounded }, { value: 100 - rounded }];
  return (
    <div className="relative w-24 h-24" data-testid="gauge-health-score">
      <RadialBarChart
        width={96}
        height={96}
        cx={48}
        cy={48}
        innerRadius={32}
        outerRadius={44}
        startAngle={90}
        endAngle={-270}
        data={data}
        barSize={10}
      >
        <RadialBar dataKey="value" cornerRadius={8} isAnimationActive={false}>
          <Cell fill={color} />
          <Cell fill="transparent" />
        </RadialBar>
      </RadialBarChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-mono font-bold" style={{ color }}>
          {rounded}
        </span>
      </div>
    </div>
  );
}

export default function PortfolioDashboard() {
  const { data: result, isLoading, isError } = useGetPortfolioDashboard();
  const [factorSortMode, setFactorSortMode] = useState<FactorSortMode>("default");
  const [minFactorScore, setMinFactorScore] = useState<string>("0");

  const filteredSortedFactors = useMemo(() => {
    if (!result) return [];
    const min = Number(minFactorScore) || 0;
    let factors = result.healthFactors.filter((f) => f.score >= min);
    factors = [...factors];
    if (factorSortMode === "score_asc") factors.sort((a, b) => a.score - b.score);
    return factors;
  }, [result, factorSortMode, minFactorScore]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Portfolio Risk Dashboard</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-read-only-portfolio-dashboard">
            Read-Only Portfolio Dashboard
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          A single executive view unifying Position Sizing, the Portfolio Stress Test, the Event Risk
          Overlay, and the Correlation &amp; Concentration Overlay into one Portfolio Health Score.
          Informational only — nothing here places, closes, or modifies a real order, and no execution
          recommendation is ever generated.
        </p>
      </div>

      {isLoading && (
        <Card className="bg-card border-border" data-testid="dashboard-loading">
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
            <p className="text-sm text-destructive" data-testid="text-dashboard-error">
              Failed to load the portfolio dashboard. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Executive Summary ──────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-executive-summary">
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex items-center gap-4">
                <HealthGauge score={result.healthScore} ratingCode={result.overallRiskRating.code} />
                <div>
                  <div className="text-xs text-muted-foreground">Portfolio Health Score</div>
                  <Badge className={ratingBadgeClass(result.overallRiskRating.code)} data-testid="badge-overall-risk-rating">
                    {result.overallRiskRating.label}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm flex-1">
                <div>
                  <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  <div className="font-mono text-lg" data-testid="text-portfolio-value">{fmtUsd(result.portfolioValue)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Buying Power</div>
                  <div className="font-mono text-lg" data-testid="text-buying-power">{fmtUsd(result.buyingPower)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Risk</div>
                  <div className="font-mono text-lg" data-testid="text-total-risk">
                    {fmtUsd(result.totalRiskDollars)} ({fmtPct(result.totalRiskPct)})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Paper Trading Status</div>
                  <div data-testid="text-paper-trading-status">Active — Simulated Account</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Broker Status</div>
                  <div data-testid="text-broker-status">
                    {!result.credentialsConfigured
                      ? "No credentials configured"
                      : result.brokerConnected === true
                        ? "Connected"
                        : result.brokerConnected === false
                          ? "Disconnected"
                          : "Not yet checked"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Portfolio Update</div>
                  <div data-testid="text-last-portfolio-update">{new Date(result.lastPortfolioUpdate).toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Overall Risk Breakdown (Health Score factors) ─────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Overall Risk Breakdown</CardTitle>
              <CardDescription>
                Every factor is derived from an already-computed figure in the Stress Test, Event Risk, or
                Concentration overlays — never a fabricated statistical model.
              </CardDescription>
              <div className="flex flex-wrap gap-3 pt-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Sort By</label>
                  <Select value={factorSortMode} onValueChange={(v) => setFactorSortMode(v as FactorSortMode)}>
                    <SelectTrigger className="bg-background w-44" data-testid="select-factor-sort-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default Order</SelectItem>
                      <SelectItem value="score_asc">Score (Worst First)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min. Score</label>
                  <Select value={minFactorScore} onValueChange={setMinFactorScore}>
                    <SelectTrigger className="bg-background w-36" data-testid="select-min-factor-score">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All factors</SelectItem>
                      <SelectItem value="50">50+</SelectItem>
                      <SelectItem value="80">80+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSortedFactors.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-health-factors">
                  No health factors match this filter.
                </p>
              ) : (
                <ul className="space-y-2" data-testid="list-health-factors">
                  {filteredSortedFactors.map((f) => (
                    <li key={f.code} data-testid={`factor-${f.code}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{f.label}</span>
                        <span className="font-mono">{f.score}/100</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${f.score}%`, backgroundColor: f.score >= 60 ? "#22c55e" : f.score >= 40 ? "#f59e0b" : "#ef4444" }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ─── Risk Panels ─────────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-risk-panels">
            <CardHeader>
              <CardTitle>Risk Panels</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
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
                <div className="text-xs text-muted-foreground">Largest Position</div>
                {result.largestPosition ? (
                  <div data-testid="text-largest-position">
                    {result.largestPosition.symbol} ({fmtPct(result.largestPosition.pctOfAccount)})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-largest-position-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Largest Risk Contributor</div>
                {result.largestRiskContributor ? (
                  <div data-testid="text-largest-risk-contributor">
                    {result.largestRiskContributor.symbol} ({fmtPct(result.largestRiskContributor.deltaSharePct)} of delta)
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-largest-risk-contributor-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Highest Event Risk</div>
                {result.highestEventRisk ? (
                  <div data-testid="text-highest-event-risk">
                    {result.highestEventRisk.symbol} ({result.highestEventRisk.riskLevel})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-highest-event-risk-none">None</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Highest Concentration</div>
                {result.highestConcentration ? (
                  <div data-testid="text-highest-concentration">
                    {result.highestConcentration.bucket.label} ({fmtPct(result.highestConcentration.bucket.weightPct)})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-highest-concentration-none">None</div>
                )}
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Highest Directional Exposure</div>
                {result.highestDirectionalExposure ? (
                  <div data-testid="text-highest-directional-exposure">
                    {fmtUsd(result.highestDirectionalExposure.exposureDollars)} ({result.highestDirectionalExposure.direction})
                  </div>
                ) : (
                  <div className="text-muted-foreground" data-testid="text-highest-directional-exposure-none">None</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Dashboard Widgets ──────────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Detail Pages</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="grid-widgets">
              {result.widgets.map((w) => (
                <Link key={w.code} href={w.linkHref} data-testid={`widget-link-${w.code}`}>
                  <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardContent className="pt-4">
                      <div className="text-sm font-semibold">{w.label}</div>
                      <div className="text-sm mt-1" data-testid={`widget-headline-${w.code}`}>{w.headline}</div>
                      <div className="text-xs text-muted-foreground mt-1">{w.detail}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* ─── Portfolio Allocation ───────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Portfolio Allocation</CardTitle>
              <CardDescription>Allocation by symbol, reused directly from the Concentration overlay.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.allocationBySymbol.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-allocation">No open positions.</p>
              ) : (
                <div className="h-56" data-testid="chart-allocation-by-symbol">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.allocationBySymbol} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="label" width={100} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                        formatter={(v: number) => [`${v}%`, "Weight"]}
                      />
                      <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Concentration Snapshot ─────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Concentration Snapshot</CardTitle>
              <CardDescription>Allocation by sector, reused directly from the Concentration overlay.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.allocationBySector.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-sector-allocation">No open positions.</p>
              ) : (
                <div className="h-56" data-testid="chart-allocation-by-sector">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.allocationBySector} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="label" width={130} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                        formatter={(v: number) => [`${v}%`, "Weight"]}
                      />
                      <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Event Timeline Summary ─────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-event-timeline">
            <CardHeader>
              <CardTitle>Event Timeline Summary</CardTitle>
              <CardDescription>Reused directly from the Earnings &amp; Event Risk Portfolio Overlay.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Within 1 Day</div>
                <div className="font-mono" data-testid="text-events-within-1-day">{result.eventTimelineSummary.within1Day}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Within 3 Days</div>
                <div className="font-mono" data-testid="text-events-within-3-days">{result.eventTimelineSummary.within3Days}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Within 7 Days</div>
                <div className="font-mono" data-testid="text-events-within-7-days">{result.eventTimelineSummary.within7Days}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Within 14 Days</div>
                <div className="font-mono" data-testid="text-events-within-14-days">{result.eventTimelineSummary.within14Days}</div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Stress Test Summary ────────────────────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Stress Test Summary</CardTitle>
              <CardDescription>Portfolio value impact per default scenario, reused directly from the Portfolio Stress Test.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.stressTestSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-stress-test-summary">No scenarios evaluated.</p>
              ) : (
                <ul className="space-y-1 text-sm" data-testid="list-stress-test-summary">
                  {result.stressTestSummary.map((s, i) => (
                    <li key={i} className="flex items-center justify-between" data-testid={`stress-scenario-${i}`}>
                      <span>{s.label}</span>
                      <span className="font-mono">
                        {fmtUsd(s.portfolioValueImpact)} (risk score {s.riskScoreAfter})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ─── Guidance ────────────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-guidance">
            <CardHeader>
              <CardTitle>Guidance</CardTitle>
              <CardDescription>Informational only — no execution recommendation is ever generated.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" data-testid="list-guidance">
                {result.guidance.map((g) => (
                  <li key={g.code} data-testid={`guidance-${g.code}`}>
                    <Badge className={ratingBadgeClass(result.overallRiskRating.code)}>{g.label}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">{g.detail}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
