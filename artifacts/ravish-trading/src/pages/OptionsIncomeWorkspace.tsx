// Phase 35 — Institutional Options Income Engine (Foundation).
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data. This page introduces no new signal, score, prediction, or trading
// logic of its own. Every figure is a direct read/count/tally/simple
// aggregate from:
//   - GET /options-income/dashboard   — Income Overview, Monthly Premium
//     (theta projection), Strategy Mix, Upcoming Expirations
//   - GET /options-income/positions   — the deterministic Position Model
//     (Underlying, Strategy, Expiration, Premium, Collateral, live Greeks,
//     Status, Lifecycle, Notes)
//   - PATCH /options-income/positions/:id/notes — the one genuine write
//     surface this page has, scoped to the notes field only
//   - GET /options-income/strategy-library — the static 9-template catalog
//   - GET /portfolio/dashboard (Phase — Portfolio Risk Dashboard, reused
//     unmodified) — Buying Power, Portfolio Exposure, net Greeks
//   - GET /reporting/options-income-summary — the Options Income Summary
//     report (Phase 35's own Reporting Centre extension)
//
// No live brokerage execution, no auto trading, no auto adjustments, no AI
// predictions, no direction forecasting, no position recommendations, no
// trade alerts, no market timing — Foundation phase only.
//
// Seven tabs mapping the phase brief's 10 named provide-items onto the
// established multi-tab workspace pattern (CrossEngineWorkspace.tsx,
// ExecutiveIntelligence.tsx):
//   Dashboard        — Income Overview, Monthly Premium, Strategy Mix
//   Positions        — Position Model, Position Notes, Position Lifecycle
//   Strategy Library — the 9 reusable strategy templates
//   Income Calendar  — Upcoming Expirations grouped by date
//   Greeks Overview  — per-position live Greeks + portfolio net Greeks
//   Risk & Exposure  — Buying Power, Portfolio Exposure, links to the
//                      existing Portfolio Dashboard / Concentration /
//                      Stress Test pages (never re-derived here)
//   Reporting        — Options Income Summary report + link to the
//                      Reporting Centre

import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOptionsIncomeDashboard,
  useListOptionsIncomePositions,
  getListOptionsIncomePositionsQueryKey,
  getGetOptionsIncomeDashboardQueryKey,
  useUpdateOptionsIncomePositionNotes,
  useGetOptionsStrategyLibrary,
  useGetPortfolioDashboard,
  useGetOptionsIncomeSummaryReport,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  ListChecks,
  Library,
  CalendarClock,
  Waves,
  ShieldAlert,
  FileBarChart2,
  Wallet,
} from "lucide-react";

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function KpiCard({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return (
    <Card className="bg-card border-border" data-testid={testId}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function lifecycleBadgeClass(lifecycle: string): string {
  if (lifecycle === "open") return "border-blue-500/40 text-blue-400";
  if (lifecycle === "closed_expired") return "border-emerald-500/40 text-emerald-400";
  if (lifecycle === "closed_assigned") return "border-amber-500/40 text-amber-400";
  if (lifecycle === "closed_rolled") return "border-indigo-500/40 text-indigo-400";
  if (lifecycle === "closed_manual") return "border-muted-foreground/40 text-muted-foreground";
  return "border-destructive/40 text-destructive";
}

export default function OptionsIncomeWorkspace() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("dashboard");
  const [positionStatus, setPositionStatus] = useState<"open" | "closed" | "all">("open");
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const dashboardQuery = useGetOptionsIncomeDashboard();
  const positionsQuery = useListOptionsIncomePositions({ status: positionStatus });
  const openPositionsQuery = useListOptionsIncomePositions({ status: "open" });
  const strategyLibraryQuery = useGetOptionsStrategyLibrary();
  const portfolioDashboardQuery = useGetPortfolioDashboard();
  const reportQuery = useGetOptionsIncomeSummaryReport();

  const updateNotes = useUpdateOptionsIncomePositionNotes({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOptionsIncomePositionsQueryKey({ status: positionStatus }) });
        queryClient.invalidateQueries({ queryKey: getGetOptionsIncomeDashboardQueryKey() });
        toast({ title: "Notes saved" });
      },
      onError: () => toast({ title: "Could not save notes", variant: "destructive" }),
    },
  });

  const dashboard = dashboardQuery.data;
  const positions = positionsQuery.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="options-income-workspace">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Waves className="w-6 h-6 text-emerald-400" /> Institutional Options Income Workspace
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          The institutional foundation for the Options Income Engine — a Position Model, Strategy Library, Income
          Dashboard, Income Calendar, Greeks Overview, and Risk & Exposure view built entirely from your own
          already-persisted positions. No live brokerage execution, auto trading, auto adjustments, AI predictions,
          direction forecasting, position recommendations, trade alerts, or market timing.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="options-income-workspace-labels">
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
            Options Income
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            No Predictions
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="tab-oiw-dashboard">
            <BarChart3 className="w-4 h-4 mr-1" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="positions" data-testid="tab-oiw-positions">
            <ListChecks className="w-4 h-4 mr-1" /> Positions
          </TabsTrigger>
          <TabsTrigger value="strategy-library" data-testid="tab-oiw-strategy-library">
            <Library className="w-4 h-4 mr-1" /> Strategy Library
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-oiw-calendar">
            <CalendarClock className="w-4 h-4 mr-1" /> Income Calendar
          </TabsTrigger>
          <TabsTrigger value="greeks" data-testid="tab-oiw-greeks">
            <Waves className="w-4 h-4 mr-1" /> Greeks Overview
          </TabsTrigger>
          <TabsTrigger value="risk-exposure" data-testid="tab-oiw-risk-exposure">
            <ShieldAlert className="w-4 h-4 mr-1" /> Risk & Exposure
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-oiw-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Dashboard: Income Overview, Monthly Premium, Strategy Mix ─── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {dashboardQuery.isLoading ? (
            <div className="space-y-3" data-testid="options-income-dashboard-loading">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-48" />
            </div>
          ) : dashboardQuery.isError || !dashboard ? (
            <p className="text-sm text-destructive" data-testid="options-income-dashboard-error">
              Could not load the Options Income Dashboard. Please try again.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="options-income-overview-kpis">
                <KpiCard label="Open Positions" value={dashboard.overview.openPositionsCount} testId="kpi-oiw-open-positions" />
                <KpiCard label="Closed Positions" value={dashboard.overview.closedPositionsCount} testId="kpi-oiw-closed-positions" />
                <KpiCard label="Capital Allocated" value={fmtUsd(dashboard.overview.totalCapitalAllocated)} testId="kpi-oiw-capital-allocated" />
                <KpiCard label="Open Credit Collected" value={fmtUsd(dashboard.overview.totalCreditCollectedOpen)} testId="kpi-oiw-open-credit" />
                <KpiCard label="Realized Premium" value={fmtUsd(dashboard.overview.totalRealizedPremium)} testId="kpi-oiw-realized-premium" />
              </div>

              <Card className="bg-card border-border" data-testid="panel-oiw-theta-income">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Monthly Premium (Theta Income)</CardTitle>
                  <CardDescription className="text-xs">
                    A theta projection from live position Greeks across your open positions — never a P/L forecast.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div data-testid="theta-daily">
                      <p className="text-xs text-muted-foreground">Daily</p>
                      <p className="text-lg font-semibold">{fmtUsd(dashboard.overview.theta.daily)}</p>
                    </div>
                    <div data-testid="theta-weekly">
                      <p className="text-xs text-muted-foreground">Weekly</p>
                      <p className="text-lg font-semibold">{fmtUsd(dashboard.overview.theta.weekly)}</p>
                    </div>
                    <div data-testid="theta-monthly">
                      <p className="text-xs text-muted-foreground">Monthly</p>
                      <p className="text-lg font-semibold">{fmtUsd(dashboard.overview.theta.monthly)}</p>
                    </div>
                    <div data-testid="theta-annualized">
                      <p className="text-xs text-muted-foreground">Annualized</p>
                      <p className="text-lg font-semibold">{fmtUsd(dashboard.overview.theta.annualized)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-oiw-strategy-mix">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Strategy Mix</CardTitle>
                  <CardDescription className="text-xs">Open positions tallied by strategy.</CardDescription>
                </CardHeader>
                <CardContent>
                  {dashboard.strategyMix.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2" data-testid="strategy-mix-empty">
                      No open positions to break down by strategy yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5" data-testid="strategy-mix-list">
                      {dashboard.strategyMix.map((m) => (
                        <li key={m.strategy} className="flex items-center justify-between text-xs" data-testid={`strategy-mix-${m.strategy}`}>
                          <span>{m.strategyLabel ?? m.strategy}</span>
                          <span className="text-muted-foreground">
                            {m.positionCount} position(s) · {fmtUsd(m.capitalAllocated)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Positions: Position Model, Notes, Lifecycle ────────────────── */}
        <TabsContent value="positions" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-oiw-positions">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Positions Workspace</CardTitle>
              <CardDescription className="text-xs">
                The deterministic Position Model — Underlying, Strategy, Expiration, Premium, Collateral, live
                Greeks, Status, Lifecycle, and Notes.
              </CardDescription>
              <div className="flex gap-1.5 mt-2" data-testid="position-status-filter">
                {(["open", "closed", "all"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={positionStatus === s ? "default" : "outline"}
                    onClick={() => setPositionStatus(s)}
                    data-testid={`position-status-${s}`}
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {positionsQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : positions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="positions-empty">
                  No {positionStatus === "all" ? "" : positionStatus} positions on record yet.
                </p>
              ) : (
                <div className="space-y-3" data-testid="positions-list">
                  {positions.map((p) => (
                    <div key={p.id} className="border border-border rounded p-3 space-y-2" data-testid={`position-${p.id}`}>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold">{p.underlying}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {p.strategyLabel ?? p.strategy}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${lifecycleBadgeClass(p.lifecycle)}`} data-testid={`position-lifecycle-${p.id}`}>
                          {p.lifecycle.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-muted-foreground">Exp: {p.expiration ?? "—"}</span>
                        <span className="text-muted-foreground">Premium: {fmtUsd(p.premium)}</span>
                        <span className="text-muted-foreground">Collateral: {fmtUsd(p.collateral)}</span>
                        {p.realizedPnl !== null && (
                          <span className={p.realizedPnl >= 0 ? "text-emerald-400" : "text-destructive"}>
                            Realized: {fmtUsd(p.realizedPnl)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground" data-testid={`position-greeks-${p.id}`}>
                        <span>Δ {p.greeks.delta.toFixed(3)}</span>
                        <span>Γ {p.greeks.gamma.toFixed(4)}</span>
                        <span>Θ {p.greeks.theta.toFixed(2)}</span>
                        <span>V {p.greeks.vega.toFixed(2)}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Textarea
                          value={noteDrafts[p.id] ?? p.notes ?? ""}
                          onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Add a note…"
                          className="text-xs min-h-[2.5rem]"
                          data-testid={`position-notes-input-${p.id}`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateNotes.mutate({ id: p.id, data: { notes: noteDrafts[p.id] ?? p.notes ?? "" } })}
                          data-testid={`position-notes-save-${p.id}`}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Strategy Library ────────────────────────────────────────────── */}
        <TabsContent value="strategy-library" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-oiw-strategy-library">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Strategy Library</CardTitle>
              <CardDescription className="text-xs">
                Reusable strategy templates — metadata only, never a generated trade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {strategyLibraryQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="strategy-library-grid">
                  {(strategyLibraryQuery.data ?? []).map((t) => (
                    <div key={t.key} className="border border-border rounded p-3 space-y-1.5" data-testid={`strategy-template-${t.key}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{t.label}</span>
                        {t.builtByThisEngine && (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400">
                            Built by this engine
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.summary}</p>
                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[9px]">
                          {t.legCount} leg(s)
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {t.incomeType}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {t.collateralType}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Ideal market: {t.idealMarket}</p>
                      <p className="text-[10px] text-muted-foreground">Assignment risk: {t.assignmentRisk}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Income Calendar ─────────────────────────────────────────────── */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-oiw-calendar">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Income Calendar</CardTitle>
              <CardDescription className="text-xs">Open positions grouped by real expiration date, soonest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : !dashboard || dashboard.upcomingExpirations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="calendar-empty">
                  No open positions with a recorded expiration date.
                </p>
              ) : (
                <div className="space-y-3" data-testid="calendar-groups">
                  {dashboard.upcomingExpirations.map((g) => (
                    <div key={g.expiration} className="border border-border rounded p-3" data-testid={`calendar-group-${g.expiration}`}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold">{g.expiration}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {g.daysToExpiry}d
                        </Badge>
                      </div>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {g.positions.map((p) => (
                          <li key={p.id}>
                            {p.symbol} — {p.strategy} — {fmtUsd(p.credit)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Greeks Overview ─────────────────────────────────────────────── */}
        <TabsContent value="greeks" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-oiw-greeks">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Portfolio Net Greeks</CardTitle>
              <CardDescription className="text-xs">
                Reused directly from the existing Portfolio Risk Dashboard — never recomputed here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {portfolioDashboardQuery.isLoading ? (
                <Skeleton className="h-16" />
              ) : portfolioDashboardQuery.data ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="portfolio-net-greeks">
                  <div>
                    <p className="text-xs text-muted-foreground">Delta</p>
                    <p className="text-lg font-semibold">{portfolioDashboardQuery.data.netGreeks.delta.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gamma</p>
                    <p className="text-lg font-semibold">{portfolioDashboardQuery.data.netGreeks.gamma.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Theta</p>
                    <p className="text-lg font-semibold">{portfolioDashboardQuery.data.netGreeks.theta.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vega</p>
                    <p className="text-lg font-semibold">{portfolioDashboardQuery.data.netGreeks.vega.toFixed(2)}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-oiw-position-greeks">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Per-Position Greeks</CardTitle>
              <CardDescription className="text-xs">Live Greeks for every open position.</CardDescription>
            </CardHeader>
            <CardContent>
              {openPositionsQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : (openPositionsQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="position-greeks-empty">
                  No open positions to show Greeks for.
                </p>
              ) : (
                <ul className="space-y-1.5" data-testid="position-greeks-list">
                  {(openPositionsQuery.data ?? []).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 text-xs" data-testid={`greeks-row-${p.id}`}>
                      <span className="font-semibold">{p.underlying}</span>
                      <span className="text-muted-foreground">Δ {p.greeks.delta.toFixed(3)}</span>
                      <span className="text-muted-foreground">Γ {p.greeks.gamma.toFixed(4)}</span>
                      <span className="text-muted-foreground">Θ {p.greeks.theta.toFixed(2)}</span>
                      <span className="text-muted-foreground">V {p.greeks.vega.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Risk & Exposure ─────────────────────────────────────────────── */}
        <TabsContent value="risk-exposure" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-oiw-risk-exposure">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" /> Buying Power & Portfolio Exposure
              </CardTitle>
              <CardDescription className="text-xs">
                Reused directly from the existing Portfolio Risk Dashboard — never recomputed here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {portfolioDashboardQuery.isLoading ? (
                <Skeleton className="h-24" />
              ) : portfolioDashboardQuery.data ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <KpiCard label="Buying Power" value={fmtUsd(portfolioDashboardQuery.data.buyingPower)} testId="kpi-oiw-buying-power" />
                    <KpiCard label="Portfolio Value" value={fmtUsd(portfolioDashboardQuery.data.portfolioValue)} testId="kpi-oiw-portfolio-value" />
                    <KpiCard label="Total Risk" value={`${portfolioDashboardQuery.data.totalRiskPct.toFixed(1)}%`} testId="kpi-oiw-total-risk-pct" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Allocation by Symbol</p>
                    <ul className="space-y-1 text-xs text-muted-foreground" data-testid="exposure-by-symbol">
                      {portfolioDashboardQuery.data.allocationBySymbol.slice(0, 5).map((b) => (
                        <li key={b.key}>
                          {b.label}: {b.weightPct.toFixed(1)}%
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/portfolio-dashboard" className="text-xs text-primary hover:underline" data-testid="link-portfolio-dashboard">
                  View full Portfolio Dashboard →
                </Link>
                <Link href="/concentration-risk" className="text-xs text-primary hover:underline" data-testid="link-concentration-risk">
                  View Concentration Risk →
                </Link>
                <Link href="/stress-test" className="text-xs text-primary hover:underline" data-testid="link-stress-test">
                  View Stress Test →
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Reporting ───────────────────────────────────────────────────── */}
        <TabsContent value="reporting" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-oiw-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Income Reporting</CardTitle>
              <CardDescription className="text-xs">
                The Options Income Summary report, reused from the platform's own Institutional Reporting Centre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : reportQuery.data ? (
                <div className="space-y-3" data-testid="options-income-report">
                  {reportQuery.data.sections.map((s) => (
                    <div key={s.id}>
                      <p className="text-sm font-semibold">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.body}</p>
                      {s.bullets && s.bullets.length > 0 && (
                        <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                          {s.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              <Link href="/reporting-centre" className="text-xs text-primary hover:underline block" data-testid="link-reporting-centre">
                Open the Institutional Reporting Centre →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
