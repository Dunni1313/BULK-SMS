// Institutional Command Center sprint.
//
// Mounted at "/command-center" — a single, comprehensive executive
// workspace consolidating every existing dashboard this codebase already
// has into 8 sections, entirely by composing already-existing generated
// hooks.
//
// v1.3.2 — Version 1 Polish Sprint: corrected a stale claim in this
// comment. Phase 10 (Institutional Platform Polish & Control Center)
// introduced Home.tsx as the real landing page at "/" and this page moved
// to its own "/command-center" route at that time, but this file's own
// header comment was never updated to say so — confirmed as a genuine,
// disclosed documentation gap by the Version 1 Release Candidate Review.
// Home.tsx is the condensed, personalized, at-a-glance landing page; this
// page remains the fuller, detail-oriented executive view — the same
// "distinct-but-related surfaces, deliberately not merged" precedent this
// platform already uses elsewhere (Home.tsx's own header comment
// describes the same relationship from its side). Nothing about either
// page's actual design or behavior changed — only this comment and each
// page's own visible intro copy (see the "See Institutional Home" /
// "See Command Center" cross-links below) were corrected.
//
// This sprint adds ZERO new backend
// routes, ZERO new database queries, and ZERO new calculations of any
// kind — every figure on this page is a direct, unmodified reuse of a
// GET request another page in this codebase already makes:
//
//   - useGetPortfolioDashboard()  — Portfolio Risk Dashboard sprint
//     (Health Score, Overall Risk Rating, net Greeks, allocation
//     buckets, guidance, widgets with drill-down links, credentials/
//     broker disclosure — the single richest existing source, reused
//     directly for Sections 1, 2, 4 (Beta), 5, 6, and 7).
//   - useGetPortfolioSummary()    — the pre-existing Options Income
//     Engine dashboard's own summary (Day P/L).
//   - useGetPortfolioGreeks()     — the pre-existing, original Greeks
//     engine (pages/Portfolio.tsx) — Section 4's own literal "Greeks
//     engine."
//   - useGetThetaIncome()         — the pre-existing Theta Income
//     Engine (pages/Dashboard.tsx) — Expected Monthly Income.
//   - useGetPerformanceAnalytics({ period: "all" }) — the pre-existing
//     Performance Analytics engine's own thetaCollected (realized
//     premium from closed trades) and strategyBreakdown.
//   - useGetTopOpportunities()    — the pre-existing Scanner's own top
//     opportunity (pages/Dashboard.tsx's own "topPick" derivation,
//     reused identically here) — the AI Insights section's own
//     "Largest Opportunity."
//
// Section 8 (AI Insights) is deterministic, client-side text synthesis
// over data ALREADY fetched by the sections above — no LLM call, no new
// endpoint, and per the explicit instruction, never an execution
// recommendation.
//
// The Broker section deliberately does NOT call GET /broker/health on
// page load — that endpoint is a manual, explicit-trigger-only check
// everywhere else in this codebase (Settings.tsx's own Broker
// Connection Status card uses `enabled: false`), matching this whole
// project's "no automatic polling" discipline. Instead this page shows
// the same cached credentialsConfigured/brokerConnected/
// lastBrokerCheckAt fields useGetPortfolioDashboard() already discloses
// (itself sourced from the last real check, not a fabricated live
// state), with a link to Settings for a fresh check.
//
// This page never submits, closes, or modifies anything — every card
// links to its own already-existing detailed page rather than
// re-implementing that page's own logic.

import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetPortfolioDashboard,
  useGetPortfolioSummary,
  useGetPortfolioGreeks,
  useGetThetaIncome,
  useGetPerformanceAnalytics,
  useGetTopOpportunities,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

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

// Guidance codes considered genuinely "elevated" for the Risk Alerts
// section's own "highest-priority informational alerts only" filter —
// the healthy/moderate primary-rating codes are deliberately excluded
// here, since those aren't alerts, they're the all-clear state.
const ELEVATED_GUIDANCE_CODES = new Set([
  "elevated_risk",
  "high_risk",
  "elevated_concentration",
  "elevated_event_risk",
  "diversification_recommended",
  "review_large_positions",
]);

// This engine's own real strategy vocabulary (execution.ts's own
// `Strategy` type: iron_condor | iron_fly | calendar_spread | earnings)
// — "Wheel Positions," "Covered Calls," and "Cash Secured Puts" have no
// data source anywhere in this codebase, confirmed by direct inspection
// before writing any code, matching the exact "do not invent new event
// models" precedent the Earnings & Event Risk Portfolio Overlay sprint
// already established for a different gap. They are always honestly
// disclosed as not tracked, never fabricated as zero-meaning-"none-open"
// (which would look identical to "tracked but currently empty").
const UNTRACKED_STRATEGY_LABELS = ["Wheel Positions", "Covered Calls", "Cash Secured Puts"];

export default function CommandCenter() {
  const { data: dash, isLoading: dashLoading, isError: dashError } = useGetPortfolioDashboard();
  const { data: summary } = useGetPortfolioSummary();
  const { data: greeks } = useGetPortfolioGreeks();
  const { data: theta } = useGetThetaIncome();
  const { data: performance } = useGetPerformanceAnalytics({ period: "all" });
  const { data: topOpps } = useGetTopOpportunities();

  const topPick = topOpps?.ironCondors?.[0] ?? topOpps?.calendarSpreads?.[0] ?? null;

  const elevatedAlerts = useMemo(() => {
    if (!dash) return [];
    return dash.guidance.filter((g) => ELEVATED_GUIDANCE_CODES.has(g.code));
  }, [dash]);

  // The one genuinely new (but zero-new-calculation) piece of logic on
  // this whole page: selecting the worst already-computed stress-test
  // scenario impact from dash.stressTestSummary (a plain array `min`
  // over already-fetched numbers) — satisfies Section 5's own "Reuse...
  // Stress Test" requirement without a new stress-test call or formula.
  const worstStressScenario = useMemo(() => {
    if (!dash || dash.stressTestSummary.length === 0) return null;
    return [...dash.stressTestSummary].sort((a, b) => a.portfolioValueImpact - b.portfolioValueImpact)[0];
  }, [dash]);

  const strategyCount = (key: string): number =>
    dash?.allocationByStrategy.find((b) => b.key === key)?.positionCount ?? 0;

  const diversificationFactor = dash?.healthFactors.find((f) => f.code === "diversification") ?? null;
  const concentrationFactor = dash?.healthFactors.find((f) => f.code === "concentration") ?? null;

  const insights = useMemo(() => {
    if (!dash) return [];
    const list: { code: string; label: string; text: string; linkHref: string }[] = [];

    if (dash.highestEventRisk) {
      list.push({
        code: "largest_risk",
        label: "Largest Risk",
        text: `${dash.highestEventRisk.symbol} carries the portfolio's highest event-risk level (${dash.highestEventRisk.riskLevel}).`,
        linkHref: "/event-risk",
      });
    } else if (dash.highestConcentration) {
      list.push({
        code: "largest_risk",
        label: "Largest Risk",
        text: `${dash.highestConcentration.bucket.label} is the portfolio's largest single concentration at ${fmtPct(dash.highestConcentration.bucket.weightPct)} of deployed risk.`,
        linkHref: "/concentration-risk",
      });
    } else {
      list.push({ code: "largest_risk", label: "Largest Risk", text: "No open positions carry a notable risk concentration.", linkHref: "/concentration-risk" });
    }

    if (topPick) {
      list.push({
        code: "largest_opportunity",
        label: "Largest Opportunity",
        text: `${topPick.symbol} (${topPick.strategy.replace(/_/g, " ")}) is the Scanner's top-ranked candidate, Ravish score ${topPick.ravishScore}.`,
        linkHref: "/scanner",
      });
    } else {
      list.push({ code: "largest_opportunity", label: "Largest Opportunity", text: "No scanner opportunities currently ranked.", linkHref: "/scanner" });
    }

    list.push({
      code: "concentration",
      label: "Concentration",
      text: concentrationFactor
        ? `Symbol-level concentration health factor: ${concentrationFactor.score}/100.`
        : "Concentration factor unavailable.",
      linkHref: "/concentration-risk",
    });

    list.push({
      code: "diversification",
      label: "Diversification",
      text: diversificationFactor
        ? `Sector-level diversification health factor: ${diversificationFactor.score}/100.`
        : "Diversification factor unavailable.",
      linkHref: "/concentration-risk",
    });

    list.push({
      code: "income_status",
      label: "Income Status",
      text:
        theta && theta.monthly > 0
          ? `Generating ${fmtUsd(theta.monthly)}/month in projected theta income across the current portfolio.`
          : "No theta income is currently being generated by the open portfolio.",
      linkHref: "/options-dashboard",
    });

    return list;
  }, [dash, topPick, concentrationFactor, diversificationFactor, theta]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Institutional Command Center</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-read-only-command-center">
            Read-Only Command Center
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          The full, comprehensive executive view consolidating every existing dashboard in this platform.
          Informational only — nothing here places, closes, or modifies a real order, and no execution
          recommendation is ever generated.{" "}
          <Link
            href="/"
            className="text-indigo-400 underline-offset-2 hover:underline"
            data-testid="link-to-institutional-home"
          >
            Looking for your own personalized, at-a-glance dashboard? See Institutional Home.
          </Link>
        </p>
      </div>

      {dashLoading && (
        <Card className="bg-card border-border" data-testid="command-center-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {dashError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-command-center-error">
              Failed to load the Command Center. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {dash && (
        <>
          {/* ─── 1. Executive Overview ──────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-executive-overview">
            <CardHeader>
              <CardTitle>Executive Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Portfolio Value</div>
                <div className="font-mono text-lg" data-testid="text-portfolio-value">{fmtUsd(dash.portfolioValue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Buying Power</div>
                <div className="font-mono text-lg" data-testid="text-buying-power">{fmtUsd(dash.buyingPower)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Portfolio Health Score</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg" data-testid="text-health-score">{dash.healthScore}/100</span>
                  <Badge className={ratingBadgeClass(dash.overallRiskRating.code)} data-testid="badge-overall-risk-rating">
                    {dash.overallRiskRating.label}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Daily P/L</div>
                <div className="font-mono text-lg" data-testid="text-daily-pnl">
                  {summary ? fmtUsd(summary.dayPnl) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Theta Income (Monthly)</div>
                <div className="font-mono text-lg" data-testid="text-total-theta-income">
                  {theta ? fmtUsd(theta.monthly) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Broker Status</div>
                <div data-testid="text-broker-status-summary">
                  {!dash.credentialsConfigured
                    ? "No credentials configured"
                    : dash.brokerConnected === true
                      ? "Connected"
                      : dash.brokerConnected === false
                        ? "Disconnected"
                        : "Not yet checked"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paper Trading Status</div>
                <div data-testid="text-paper-trading-status-summary">Active — Simulated Account</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last Portfolio Update</div>
                <div data-testid="text-last-update">{new Date(dash.lastPortfolioUpdate).toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>

          {/* ─── 2. Portfolio Health ────────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Portfolio Health</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="grid-portfolio-health-widgets">
              {dash.widgets.map((w) => (
                <Link key={w.code} href={w.linkHref} data-testid={`health-widget-link-${w.code}`}>
                  <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{w.label}</div>
                      <div className="text-sm font-semibold mt-1">{w.headline}</div>
                      <div className="text-xs text-muted-foreground mt-1">{w.detail}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* ─── 3. Options Income Engine ───────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-options-income-engine">
            <CardHeader>
              <CardTitle>Options Income Engine</CardTitle>
              <CardDescription>
                Reused directly from the pre-existing Performance Analytics and Theta Income engines.{" "}
                <Link href="/options-dashboard" className="underline">Open the full dashboard →</Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Total Premium Collected (Realized)</div>
                <div className="font-mono" data-testid="text-total-premium-collected">
                  {performance ? fmtUsd(performance.thetaCollected) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Expected Monthly Income</div>
                <div className="font-mono" data-testid="text-expected-monthly-income">
                  {theta ? fmtUsd(theta.monthly) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Iron Condors</div>
                <div className="font-mono" data-testid="text-count-iron-condor">{strategyCount("iron_condor")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Calendar Spreads</div>
                <div className="font-mono" data-testid="text-count-calendar-spread">{strategyCount("calendar_spread")}</div>
              </div>
              {UNTRACKED_STRATEGY_LABELS.map((label) => (
                <div key={label}>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-untracked-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                    Not tracked in this engine
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ─── 4. Greeks Summary ──────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-greeks-summary">
            <CardHeader>
              <CardTitle>Greeks Summary</CardTitle>
              <CardDescription>
                Reused directly from the existing Greeks engine.{" "}
                <Link href="/portfolio" className="underline">Open the Greeks page →</Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Net Delta</div>
                <div className="font-mono" data-testid="text-net-delta">{greeks ? greeks.totalDelta : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Gamma</div>
                <div className="font-mono" data-testid="text-net-gamma">{greeks ? greeks.totalGamma : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Theta</div>
                <div className="font-mono" data-testid="text-net-theta">{greeks ? greeks.totalTheta : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Vega</div>
                <div className="font-mono" data-testid="text-net-vega">{greeks ? greeks.totalVega : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Beta</div>
                <div className="text-xs text-muted-foreground" data-testid="text-net-beta-unavailable">
                  {dash.netBeta === null ? "Unavailable — no beta figure exists anywhere in this engine's data model." : dash.netBeta}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── 5. Risk Alerts ─────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-risk-alerts">
            <CardHeader>
              <CardTitle>Risk Alerts</CardTitle>
              <CardDescription>Highest-priority informational alerts only. No execution recommendation is ever generated.</CardDescription>
            </CardHeader>
            <CardContent>
              {elevatedAlerts.length === 0 && (!worstStressScenario || worstStressScenario.portfolioValueImpact >= 0) ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-risk-alerts">No elevated risk alerts at this time.</p>
              ) : (
                <ul className="space-y-2" data-testid="list-risk-alerts">
                  {elevatedAlerts.map((a) => (
                    <li key={a.code} data-testid={`alert-${a.code}`}>
                      <Badge className={ratingBadgeClass(dash.overallRiskRating.code)}>{a.label}</Badge>
                      <p className="text-sm text-muted-foreground mt-1">{a.detail}</p>
                    </li>
                  ))}
                  {worstStressScenario && worstStressScenario.portfolioValueImpact < 0 && (
                    <li data-testid="alert-stress-test-worst-scenario">
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Stress Test</Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        Worst modeled scenario ({worstStressScenario.label}) impacts portfolio value by{" "}
                        {fmtUsd(worstStressScenario.portfolioValueImpact)}.
                      </p>
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ─── 6. Portfolio Allocation ────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-portfolio-allocation">
            <CardHeader>
              <CardTitle>Portfolio Allocation</CardTitle>
              <CardDescription>
                Reused directly from the Correlation &amp; Concentration overlay.{" "}
                <Link href="/concentration-risk" className="underline">Open the full breakdown →</Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {([
                ["Symbol", dash.allocationBySymbol, "chart-allocation-symbol"],
                ["Sector", dash.allocationBySector, "chart-allocation-sector"],
                ["Strategy", dash.allocationByStrategy, "chart-allocation-strategy"],
                ["Expiration", dash.expirationDistribution, "chart-allocation-expiration"],
              ] as const).map(([label, buckets, testId]) => (
                <div key={label}>
                  <div className="text-xs text-muted-foreground mb-2">{label} Allocation</div>
                  {buckets.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid={`text-no-${testId}`}>No open positions.</p>
                  ) : (
                    <div className="h-40" data-testid={testId}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={buckets} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${v}%`} />
                          <YAxis type="category" dataKey="label" width={100} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }}
                            formatter={(v: number) => [`${v}%`, "Weight"]}
                          />
                          <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ─── 7. Broker ───────────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-broker">
            <CardHeader>
              <CardTitle>Broker</CardTitle>
              <CardDescription>
                Cached from the last real check — never fetched automatically on this page.{" "}
                <Link href="/settings" className="underline">Run a fresh check in Settings →</Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Connected</div>
                <div data-testid="text-broker-connected">
                  {dash.brokerConnected === true ? "Yes" : dash.brokerConnected === false ? "No" : "Not yet checked"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last Update</div>
                <div data-testid="text-broker-last-update">
                  {dash.lastBrokerCheckAt ? new Date(dash.lastBrokerCheckAt).toLocaleString() : "Never"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Credentials Status</div>
                <div data-testid="text-broker-credentials-status">
                  {dash.credentialsConfigured ? "Configured" : "Not configured"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── 8. AI Insights ─────────────────────────────────────────── */}
          <Card className="bg-card border-border" data-testid="card-ai-insights">
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>
                Deterministic summary of already-computed figures above — never an LLM call, never an
                execution recommendation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" data-testid="list-ai-insights">
                {insights.map((i) => (
                  <li key={i.code} data-testid={`insight-${i.code}`}>
                    <Link href={i.linkHref} className="text-sm font-medium underline">{i.label}</Link>
                    <p className="text-sm text-muted-foreground">{i.text}</p>
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
