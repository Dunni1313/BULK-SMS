// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/rebalancingEngine.ts). This page introduces no new signal,
// score, or trade-recommendation logic of its own — it is planning and
// analysis only. No trade recommendations, no buy/sell signals, no
// automatic portfolio optimisation, no automatic rebalancing, no auto
// execution, no AI predictions, no forecasting, no machine learning, no
// broker integration.
//
// Every figure is a direct read from:
//   - GET /rebalancing/dashboard — per-portfolio Current/Target/Drift,
//     cross-engine Sector/Asset/Strategy/Capital Allocation, Allocation
//     Timeline, and the honest Trading/Options target-allocation
//     unavailability disclosure.
//   - POST /rebalancing/portfolios/:id/propose — the Rebalancing Planner,
//     comparing current allocation against a caller-supplied set of
//     proposed target weights. Never persists the proposal, never a
//     suggested trade or share count.
//   - GET /rebalancing/coach     — the deterministic AI Coach
//   - GET /rebalancing/learning  — Learning Centre integration
//   - GET /reporting/portfolio-allocation-report,
//     GET /reporting/rebalancing-planning-report/:portfolioId — Reporting
//     Centre links

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetRebalancingDashboard,
  getGetRebalancingDashboardQueryKey,
  useProposeAllocation,
  useListRebalancingCoachTopics,
  useListRebalancingLearning,
} from "@workspace/api-client-react";
import type { RebalancingProposedTargetInput, RebalancingProposedAllocationComparison } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, GraduationCap, FileBarChart2, Scale, GitCompare, GraduationCap as LearnIcon } from "lucide-react";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n}%`;
}

function actionBadgeClass(action: string): string {
  if (action === "buy") return "border-blue-500/40 text-blue-400";
  if (action === "sell") return "border-amber-500/40 text-amber-400";
  if (action === "hold") return "border-emerald-500/40 text-emerald-400";
  return "border-border text-muted-foreground";
}

export default function RebalancingEngine() {
  const dashboardQuery = useGetRebalancingDashboard({ query: { queryKey: getGetRebalancingDashboardQueryKey() } });
  const coachQuery = useListRebalancingCoachTopics();
  const learningQuery = useListRebalancingLearning();
  const proposeMutation = useProposeAllocation();

  const dashboard = dashboardQuery.data;

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [draftTargets, setDraftTargets] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState<RebalancingProposedAllocationComparison | null>(null);

  const selectedSummary = useMemo(
    () => (dashboard?.portfolios ?? []).find((p) => String(p.portfolioId) === selectedPortfolioId) ?? null,
    [dashboard, selectedPortfolioId],
  );

  function selectPortfolio(id: string) {
    setSelectedPortfolioId(id);
    setComparison(null);
    const summary = (dashboard?.portfolios ?? []).find((p) => String(p.portfolioId) === id);
    const initial: Record<string, string> = {};
    for (const h of summary?.allocation.holdings ?? []) {
      initial[h.symbol] = String(h.targetWeightPct);
    }
    setDraftTargets(initial);
  }

  function runComparison() {
    if (!selectedSummary) return;
    const targets: RebalancingProposedTargetInput[] = Object.entries(draftTargets)
      .filter(([, v]) => v.trim() !== "" && !Number.isNaN(Number(v)))
      .map(([symbol, v]) => ({ symbol, targetWeightPct: Number(v) }));
    proposeMutation.mutate(
      { id: selectedSummary.portfolioId, data: { targets } },
      { onSuccess: (result) => setComparison(result) },
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="rebalancing-engine">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Scale className="w-6 h-6 text-amber-400" /> Institutional Portfolio Rebalancing & Allocation Planning Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare current allocations with target allocations and evaluate proposed portfolio changes. Planning and
          analysis only — no trade recommendations, no buy/sell signals, no automatic portfolio optimisation, no
          automatic rebalancing, no auto execution, no AI predictions, no forecasting, no machine learning, no broker
          integration.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="rebalancing-labels">
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
            Rebalancing & Allocation Planning
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Planning Only — No Trade Recommendations
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="tab-re-dashboard">
            <Scale className="w-4 h-4 mr-1" /> Allocation Dashboard
          </TabsTrigger>
          <TabsTrigger value="planner" data-testid="tab-re-planner">
            <GitCompare className="w-4 h-4 mr-1" /> Rebalancing Planner
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-re-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-re-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Allocation Dashboard ───────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {dashboardQuery.isLoading ? (
            <Skeleton className="h-96" />
          ) : dashboardQuery.isError || !dashboard ? (
            <p className="text-xs text-destructive flex items-center gap-1" data-testid="rebalancing-dashboard-error">
              <AlertTriangle className="w-3.5 h-3.5" /> Unable to load the Rebalancing dashboard.
            </p>
          ) : (
            <>
              <Card className="bg-card border-border" data-testid="panel-re-portfolios">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Current vs. Target Allocation</CardTitle>
                  <CardDescription className="text-xs">{dashboard.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboard.portfolios.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="rebalancing-portfolios-empty">
                      No Investing portfolios on record yet.
                    </p>
                  ) : (
                    dashboard.portfolios.map((p) => (
                      <div key={p.portfolioId} data-testid={`portfolio-${p.portfolioId}`}>
                        <p className="text-sm font-semibold">{p.portfolioName}</p>
                        <p className="text-xs text-muted-foreground mb-1.5">{p.allocation.summary}</p>
                        <div className="space-y-1">
                          {p.allocation.holdings.map((h) => (
                            <div key={h.symbol} className="flex items-center justify-between text-xs" data-testid={`holding-${p.portfolioId}-${h.symbol}`}>
                              <span>{h.symbol}</span>
                              <span className="text-muted-foreground">
                                current {fmtPct(h.actualWeightPct)} / target {fmtPct(h.targetWeightPct)} / drift{" "}
                                {h.driftPct != null ? `${h.driftPct > 0 ? "+" : ""}${h.driftPct}pp` : "n/a"}
                              </span>
                              <Badge variant="outline" className={`text-[10px] ${actionBadgeClass(h.rebalanceAction)}`}>
                                {h.rebalanceAction}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-re-sector-allocation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sector Allocation</CardTitle>
                  <CardDescription className="text-xs">Reused directly from the Risk & Exposure Engine.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {dashboard.crossEngineSectorAllocation.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No sector data available yet.</p>
                  ) : (
                    dashboard.crossEngineSectorAllocation.map((s, i) => (
                      <div key={`${s.engine}-${s.sector}-${i}`} className="flex justify-between text-xs">
                        <span>
                          [{s.engine}] {s.sector}
                        </span>
                        <span className="text-muted-foreground">{s.weightPct.toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-re-asset-allocation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Asset Allocation</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Investing</p>
                    <p className="text-sm">
                      {dashboard.crossEngineAssetAllocation.investingHoldingsCount} holding(s) / {dashboard.crossEngineAssetAllocation.investingPortfolioCount} portfolio(s)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trading</p>
                    <p className="text-sm">{dashboard.crossEngineAssetAllocation.tradingOpenPositionsCount} open position(s)</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Options</p>
                    <p className="text-sm">{dashboard.crossEngineAssetAllocation.optionsOpenPositionsCount} open position(s)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-re-strategy-allocation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Strategy Allocation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {dashboard.crossEngineStrategyAllocation.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No open options positions to break down by strategy.</p>
                  ) : (
                    dashboard.crossEngineStrategyAllocation.map((s) => (
                      <div key={s.key} className="flex justify-between text-xs">
                        <span>{s.label ?? s.key}</span>
                        <span className="text-muted-foreground">
                          {s.positionCount} position(s) ({s.weightPct.toFixed(1)}%)
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-re-capital-allocation">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Capital Allocation</CardTitle>
                  <CardDescription className="text-xs">Investing, Trading, and Options capital figures shown side by side — never blended into one total.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {dashboard.crossEngineCapitalAllocation.map((c) => (
                    <div key={c.label}>
                      <p className="text-[10px] text-muted-foreground">{c.label}</p>
                      <p className="text-sm">{fmtUsd(c.value)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-re-timeline">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Allocation Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {dashboard.allocationTimeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="rebalancing-timeline-empty">
                      No historical allocation data points yet.
                    </p>
                  ) : (
                    dashboard.allocationTimeline.map((t, i) => (
                      <div key={`${t.date}-${i}`} className="text-xs">
                        <span className="text-muted-foreground">
                          {t.date} [{t.source}]:
                        </span>{" "}
                        {t.detail}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-re-availability">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Target Allocation Availability</CardTitle>
                  <CardDescription className="text-xs">Honest disclosure of which engines have a genuine, stored target-weight concept — never approximated for an engine that has none.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {dashboard.targetAllocationAvailability.map((t) => (
                    <div key={t.engine} data-testid={`availability-${t.engine}`}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="capitalize">{t.engine}</span>
                        <Badge variant="outline" className={`text-[10px] ${t.available ? "border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground"}`}>
                          {t.available ? "available" : "unavailable"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{t.reason}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Rebalancing Planner ────────────────────────────────────────── */}
        <TabsContent value="planner" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-re-planner">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rebalancing Planner</CardTitle>
              <CardDescription className="text-xs">
                Compare a portfolio's current allocation against manually-entered proposed target weights. No optimisation, no suggested trades, no execution plan — dollar
                capital-movement figures only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedPortfolioId} onValueChange={selectPortfolio}>
                <SelectTrigger className="bg-background" data-testid="planner-portfolio-select">
                  <SelectValue placeholder="Select a portfolio…" />
                </SelectTrigger>
                <SelectContent>
                  {(dashboard?.portfolios ?? []).map((p) => (
                    <SelectItem key={p.portfolioId} value={String(p.portfolioId)}>
                      {p.portfolioName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedSummary && (
                <div className="space-y-2" data-testid="planner-target-inputs">
                  {selectedSummary.allocation.holdings.map((h) => (
                    <div key={h.symbol} className="flex items-center gap-2 text-xs">
                      <span className="w-16">{h.symbol}</span>
                      <span className="text-muted-foreground w-28">current {fmtPct(h.actualWeightPct)}</span>
                      <Input
                        type="number"
                        className="h-7 w-24 bg-background"
                        value={draftTargets[h.symbol] ?? ""}
                        onChange={(e) => setDraftTargets((prev) => ({ ...prev, [h.symbol]: e.target.value }))}
                        data-testid={`planner-target-${h.symbol}`}
                      />
                      <span className="text-muted-foreground">% proposed target</span>
                    </div>
                  ))}
                  <Button size="sm" onClick={runComparison} disabled={proposeMutation.isPending} data-testid="planner-compare-btn">
                    {proposeMutation.isPending ? "Comparing…" : "Compare Proposed Allocation"}
                  </Button>
                </div>
              )}

              {proposeMutation.isError && (
                <p className="text-xs text-destructive" data-testid="planner-error">
                  Unable to compute the proposed allocation comparison.
                </p>
              )}

              {comparison && (
                <div className="space-y-2 pt-2 border-t border-border" data-testid="planner-comparison-result">
                  <p className="text-xs text-muted-foreground">{comparison.summary}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Capital to deploy</p>
                      <p className="text-sm">{fmtUsd(comparison.totalCapitalToDeployDollars)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Capital to raise</p>
                      <p className="text-sm">{fmtUsd(comparison.totalCapitalToRaiseDollars)}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {comparison.rows.map((r) => (
                      <div key={r.symbol} className="flex items-center justify-between text-xs" data-testid={`comparison-row-${r.symbol}`}>
                        <span>{r.symbol}</span>
                        <span className="text-muted-foreground">
                          {fmtPct(r.currentWeightPct)} → {fmtPct(r.proposedTargetWeightPct)} (drift {r.driftFromProposedPct != null ? `${r.driftFromProposedPct > 0 ? "+" : ""}${r.driftFromProposedPct}pp` : "n/a"})
                        </span>
                        <span className="text-muted-foreground">{fmtUsd(r.capitalMovementDollars)}</span>
                        <Badge variant="outline" className={`text-[10px] ${actionBadgeClass(r.rebalanceActionVsProposed)}`}>
                          {r.rebalanceActionVsProposed}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Coach & Learning ───────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-re-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">
                Deterministic explanations of portfolio allocation, rebalancing concepts, diversification, capital efficiency, and portfolio construction — never a trade
                recommendation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coachQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="space-y-3" data-testid="re-coach-topics">
                  {(coachQuery.data ?? []).map((t) => (
                    <div key={t.topic} data-testid={`re-coach-topic-${t.topic}`}>
                      <p className="text-sm font-semibold">{t.title}</p>
                      {t.explanation.map((p, i) => (
                        <p key={i} className="text-xs text-muted-foreground mt-1">
                          {p}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-re-learning">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <LearnIcon className="w-4 h-4" /> Learning Centre — By Topic
              </CardTitle>
              <CardDescription className="text-xs">Existing Learning Centre content connected to each topic. No duplicated content.</CardDescription>
            </CardHeader>
            <CardContent>
              {learningQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-3" data-testid="re-learning-by-topic">
                  {(learningQuery.data ?? []).map((bundle) => (
                    <div key={bundle.topic} data-testid={`re-learning-topic-${bundle.topic}`}>
                      <p className="text-xs font-semibold">{bundle.topic.replace(/_/g, " ")}</p>
                      <ul className="space-y-0.5">
                        {bundle.links.map((l) => (
                          <li key={`${l.pathKey}-${l.topicKey}`}>
                            <Link href={l.href} className="text-xs text-primary hover:underline" data-testid={`re-learning-link-${l.pathKey}-${l.topicKey}`}>
                              {l.title}
                            </Link>
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

        {/* ─── Reporting ───────────────────────────────────────────────────── */}
        <TabsContent value="reporting" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-re-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rebalancing Reporting</CardTitle>
              <CardDescription className="text-xs">Portfolio Allocation Report and Rebalancing Planning Report, reused from the platform's own Institutional Reporting Centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reporting-centre?reportType=portfolio-allocation-report" className="text-xs text-primary hover:underline block" data-testid="link-report-portfolio-allocation-report">
                Generate Portfolio Allocation Report →
              </Link>
              {selectedSummary ? (
                <Link
                  href={`/reporting-centre?reportType=rebalancing-planning-report&portfolioId=${selectedSummary.portfolioId}`}
                  className="text-xs text-primary hover:underline block"
                  data-testid="link-report-rebalancing-planning-report"
                >
                  Generate Rebalancing Planning Report for {selectedSummary.portfolioName} →
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Select a portfolio in the Rebalancing Planner tab to generate its own Rebalancing Planning Report.</p>
              )}
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
