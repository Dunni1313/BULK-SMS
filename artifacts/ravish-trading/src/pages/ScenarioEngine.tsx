// Phase 39 — Institutional Scenario & Stress Testing Engine.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/scenarioEngine.ts). This page introduces no new signal, score,
// prediction, or trading logic of its own — it is analytical only. No AI
// predictions, no market forecasting, no price targets, no trade
// recommendations, no portfolio optimisation, no auto hedging, no auto
// execution, no Monte Carlo simulation, no random scenario generation.
//
// Every figure is a direct read from:
//   - POST /scenario-engine/dashboard — the Investing/Trading/Options/
//     Combined scenario views (Portfolio Impact Summary, Asset Impact,
//     Sector Impact, Strategy Impact, Greeks Impact, Buying Power Impact,
//     Capital Impact, Scenario Comparison), plus the Market Move Simulator
//     (a caller-supplied custom percentage-move scenario)
//   - GET /scenario-engine/coach     — the deterministic AI Coach
//   - GET /scenario-engine/learning  — Learning Centre integration
//   - GET /reporting/scenario-analysis-report,
//     GET /reporting/stress-test-report — Reporting Centre links

import { useState } from "react";
import { Link } from "wouter";
import { useRunScenarioDashboard, useListScenarioCoachTopics, useListScenarioLearning } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, GraduationCap, FileBarChart2, Loader2, Trash2, Waves } from "lucide-react";

type ScenarioView = "combined" | "investing" | "trading" | "options";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

interface CustomScenarioDraft {
  label: string;
  priceShockPct: string;
}

export default function ScenarioEngine() {
  const [tab, setTab] = useState<string>("dashboard");
  const [view, setView] = useState<ScenarioView>("combined");
  const [customScenarios, setCustomScenarios] = useState<CustomScenarioDraft[]>([]);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftPct, setDraftPct] = useState("");

  const dashboardMutation = useRunScenarioDashboard();
  const coachQuery = useListScenarioCoachTopics();
  const learningQuery = useListScenarioLearning();

  const dashboard = dashboardMutation.data;

  function runDashboard() {
    dashboardMutation.mutate({
      data: {
        customScenarios: customScenarios.map((c) => ({
          label: c.label.trim() || undefined,
          priceShockPct: c.priceShockPct.trim() === "" ? 0 : Number(c.priceShockPct),
        })),
      },
    });
  }

  function addCustomScenario() {
    if (draftPct.trim() === "" || Number.isNaN(Number(draftPct))) return;
    setCustomScenarios((prev) => [...prev, { label: draftLabel, priceShockPct: draftPct }]);
    setDraftLabel("");
    setDraftPct("");
  }

  function removeCustomScenario(index: number) {
    setCustomScenarios((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="scenario-engine">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Waves className="w-6 h-6 text-amber-400" /> Institutional Scenario & Stress Testing Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A deterministic Scenario & Stress Testing Engine evaluating the impact of hypothetical market moves across
          Investing, Trading, and Options portfolios. Analytical only — no AI predictions, no market forecasting, no
          price targets, no trade recommendations, no portfolio optimisation, no auto hedging, no auto execution, no
          Monte Carlo simulation, no random scenario generation.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="scenario-engine-labels">
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
            Cross-Engine Scenario Analysis
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Display Only — No Recommendations
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="tab-se-dashboard">
            <Waves className="w-4 h-4 mr-1" /> Scenario Dashboard
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-se-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-se-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Scenario Dashboard ─────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-se-simulator">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Market Move Simulator</CardTitle>
              <CardDescription className="text-xs">
                8 default deterministic scenarios (Market ±5%/±10%, Volatility Increase/Decrease, Interest Rate
                Increase/Decrease) run automatically. Add an optional custom percentage move below, then run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="custom-scenario-label">
                    Label (optional)
                  </label>
                  <Input
                    id="custom-scenario-label"
                    className="w-48"
                    placeholder="e.g. Flash Crash"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    data-testid="input-custom-scenario-label"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="custom-scenario-pct">
                    Custom % move
                  </label>
                  <Input
                    id="custom-scenario-pct"
                    type="number"
                    className="w-32"
                    placeholder="-15"
                    value={draftPct}
                    onChange={(e) => setDraftPct(e.target.value)}
                    data-testid="input-custom-scenario-pct"
                  />
                </div>
                <Button type="button" variant="outline" onClick={addCustomScenario} data-testid="button-add-custom-scenario">
                  Add Scenario
                </Button>
              </div>

              {customScenarios.length > 0 && (
                <div className="space-y-1" data-testid="custom-scenario-list">
                  {customScenarios.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1" data-testid={`custom-scenario-${i}`}>
                      <span>
                        {c.label.trim() || `Custom (${Number(c.priceShockPct) >= 0 ? "+" : ""}${c.priceShockPct}%)`}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomScenario(i)} data-testid={`button-remove-custom-scenario-${i}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button type="button" onClick={runDashboard} disabled={dashboardMutation.isPending} data-testid="button-run-scenario-dashboard">
                {dashboardMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Evaluating…
                  </>
                ) : (
                  "Run Scenario Analysis"
                )}
              </Button>

              {dashboardMutation.isError && (
                <p className="text-xs text-destructive flex items-center gap-1" data-testid="scenario-dashboard-error">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unable to run the Scenario & Stress Testing dashboard.
                </p>
              )}
            </CardContent>
          </Card>

          {!dashboard ? (
            dashboardMutation.isPending ? (
              <Skeleton className="h-64" />
            ) : (
              <p className="text-xs text-muted-foreground py-2" data-testid="scenario-dashboard-not-run">
                Run the Scenario Analysis above to see Portfolio/Asset/Sector/Strategy Impact across Investing,
                Trading, and Options.
              </p>
            )
          ) : (
            <>
              <Card className="bg-card border-border" data-testid="panel-se-view-selector">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Scenario View</CardTitle>
                  <CardDescription className="text-xs">Combined cross-engine view, or Investing, Trading, Options individually.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={view} onValueChange={(v) => setView(v as ScenarioView)}>
                    <SelectTrigger className="w-56" data-testid="scenario-view-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="combined" data-testid="scenario-view-option-combined">
                        Combined (Cross-Engine)
                      </SelectItem>
                      <SelectItem value="investing" data-testid="scenario-view-option-investing">
                        Investing
                      </SelectItem>
                      <SelectItem value="trading" data-testid="scenario-view-option-trading">
                        Trading
                      </SelectItem>
                      <SelectItem value="options" data-testid="scenario-view-option-options">
                        Options
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {view === "combined" && (
                <div className="space-y-4" data-testid="panel-se-combined">
                  <Card className="bg-card border-border" data-testid="panel-se-portfolio-impact">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Portfolio Impact Summary</CardTitle>
                      <CardDescription className="text-xs">Never blended across engines — each row is one engine's own repriced impact for one scenario.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.byEngine.map((e, i) => (
                        <div key={`${e.engine}-${e.scenarioKey}-${i}`} className="flex justify-between text-xs" data-testid={`combined-by-engine-${e.engine}-${i}`}>
                          <span>
                            [{e.engine}] {e.scenarioLabel}
                          </span>
                          <span className="text-muted-foreground">{e.available ? fmtUsd(e.impactDollars) : "unavailable"}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-se-asset-impact">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Asset Impact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.assetImpact.length === 0 ? (
                        <p className="text-xs text-muted-foreground" data-testid="scenario-asset-impact-empty">
                          No asset impact available yet.
                        </p>
                      ) : (
                        dashboard.combined.assetImpact.slice(0, 20).map((a, i) => (
                          <div key={`${a.engine}-${a.symbol}-${a.scenarioKey}-${i}`} className="flex justify-between text-xs" data-testid={`combined-asset-${a.engine}-${i}`}>
                            <span>
                              [{a.engine}] {a.symbol} ({a.scenarioKey})
                            </span>
                            <span className="text-muted-foreground">{fmtUsd(a.impactDollars)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-se-sector-impact">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Sector Impact</CardTitle>
                      <CardDescription className="text-xs">Investing only.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.sectorImpact.length === 0 ? (
                        <p className="text-xs text-muted-foreground" data-testid="scenario-sector-impact-empty">
                          No sector impact available yet.
                        </p>
                      ) : (
                        dashboard.combined.sectorImpact.slice(0, 20).map((s, i) => (
                          <div key={`${s.sector}-${s.scenarioKey}-${i}`} className="flex justify-between text-xs" data-testid={`combined-sector-${i}`}>
                            <span>
                              {s.sector} ({s.scenarioKey})
                            </span>
                            <span className="text-muted-foreground">{fmtUsd(s.impactDollars)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-se-strategy-impact">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Strategy Impact</CardTitle>
                      <CardDescription className="text-xs">Trading + Options, never blended into one number across engines.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.combined.strategyImpact.length === 0 ? (
                        <p className="text-xs text-muted-foreground" data-testid="scenario-strategy-impact-empty">
                          No strategy impact available yet.
                        </p>
                      ) : (
                        dashboard.combined.strategyImpact.slice(0, 20).map((s, i) => (
                          <div key={`${s.engine}-${s.key}-${s.scenarioKey}-${i}`} className="flex justify-between text-xs" data-testid={`combined-strategy-${s.engine}-${i}`}>
                            <span>
                              [{s.engine}] {s.label} ({s.scenarioKey})
                            </span>
                            <span className="text-muted-foreground">{fmtUsd(s.impactDollars)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {view === "investing" && (
                <div className="space-y-4" data-testid="panel-se-investing">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Investing — Scenario Impact</CardTitle>
                      <CardDescription className="text-xs">
                        {dashboard.investing.holdingsCount} holding(s) across {dashboard.investing.portfolioCount} portfolio(s). Linear repricing — no convexity/Greeks for a raw equity holding.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {dashboard.investing.results.map((r) => (
                        <div key={r.scenario.key} className="flex justify-between text-xs" data-testid={`investing-scenario-${r.scenario.key}`}>
                          <span>{r.scenario.label}</span>
                          <span className="text-muted-foreground">
                            {r.available ? `${fmtUsd(r.totalImpactDollars)} (${fmtPct(r.totalImpactPct)})` : (r.reason ?? "unavailable")}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {view === "trading" && (
                <div className="space-y-4" data-testid="panel-se-trading">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Trading — Scenario Impact</CardTitle>
                      <CardDescription className="text-xs">{dashboard.trading.openPositionsCount} open position(s). Linear repricing — no convexity/Greeks for a raw equity position.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {dashboard.trading.results.map((r) => (
                        <div key={r.scenario.key} className="flex justify-between text-xs" data-testid={`trading-scenario-${r.scenario.key}`}>
                          <span>{r.scenario.label}</span>
                          <span className="text-muted-foreground">{r.available ? fmtUsd(r.totalImpactDollars) : (r.reason ?? "unavailable")}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {view === "options" && (
                <div className="space-y-4" data-testid="panel-se-options">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Options — Price / Volatility Scenarios</CardTitle>
                      <CardDescription className="text-xs">Reused directly, unmodified, from the existing What-If Stress Test engine (Black-Scholes repricing).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {!dashboard.options.stressTest.available ? (
                        <p className="text-xs text-muted-foreground" data-testid="options-stress-test-unavailable">
                          {dashboard.options.stressTest.inputIssues.join("; ") || "No open Options positions on record."}
                        </p>
                      ) : (
                        dashboard.options.stressTest.scenarios.map((s, i) => (
                          <div key={`${s.label}-${i}`} className="flex justify-between text-xs" data-testid={`options-price-vol-scenario-${i}`}>
                            <span>{s.label}</span>
                            <span className="text-muted-foreground">
                              {fmtUsd(s.portfolioValueImpact)} (P&amp;L {fmtUsd(s.unrealizedPnlImpact)})
                            </span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-se-greeks-impact">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Greeks Impact</CardTitle>
                      <CardDescription className="text-xs">Same real open positions' Greeks, immediately after each scenario's shock.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.options.stressTest.available &&
                        dashboard.options.stressTest.scenarios.map((s, i) => (
                          <div key={`greeks-${s.label}-${i}`} className="flex justify-between text-xs" data-testid={`options-greeks-${i}`}>
                            <span>{s.label}</span>
                            <span className="text-muted-foreground">
                              Δ {s.after.greeks.delta} · Γ {s.after.greeks.gamma} · Θ {s.after.greeks.theta} · V {s.after.greeks.vega}
                            </span>
                          </div>
                        ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-se-buying-power-impact">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Buying Power Impact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.options.stressTest.available &&
                        dashboard.options.stressTest.scenarios.map((s, i) => (
                          <div key={`bp-${s.label}-${i}`} className="flex justify-between text-xs" data-testid={`options-buying-power-${i}`}>
                            <span>{s.label}</span>
                            <span className="text-muted-foreground">{fmtUsd(s.buyingPowerImpactDollars)}</span>
                          </div>
                        ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-se-capital-impact">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Capital Impact</CardTitle>
                      <CardDescription className="text-xs">Defined-risk options strategies' reserved margin does not move purely from a price/volatility shock.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.options.stressTest.available &&
                        dashboard.options.stressTest.scenarios.map((s, i) => (
                          <div key={`ci-${s.label}-${i}`} className="flex justify-between text-xs" data-testid={`options-capital-impact-${i}`}>
                            <span>{s.label}</span>
                            <span className="text-muted-foreground">
                              {s.after.totalRiskDollars != null ? `$${s.after.totalRiskDollars.toLocaleString()}` : "unavailable"} ({s.after.totalRiskPct != null ? s.after.totalRiskPct.toFixed(2) + "%" : "unavailable"})
                            </span>
                          </div>
                        ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border" data-testid="panel-se-rate-scenarios">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Interest Rate Scenarios</CardTitle>
                      <CardDescription className="text-xs">A shocked risk-free rate supplied to the existing, unmodified Black-Scholes pricer.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dashboard.options.rateScenarios.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No interest rate scenarios evaluated.</p>
                      ) : (
                        dashboard.options.rateScenarios.map((r) => (
                          <div key={r.scenario.key} className="flex justify-between text-xs" data-testid={`options-rate-scenario-${r.scenario.key}`}>
                            <span>{r.scenario.label}</span>
                            <span className="text-muted-foreground">{r.available ? fmtUsd(r.totalImpactDollars) : "unavailable"}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── Coach & Learning ───────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-se-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">Deterministic explanations of scenario analysis, stress testing, portfolio resilience, Greeks impact under stress, and capital impact — never a trade recommendation.</CardDescription>
            </CardHeader>
            <CardContent>
              {coachQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="space-y-3" data-testid="coach-topics">
                  {(coachQuery.data ?? []).map((t) => (
                    <div key={t.topic} data-testid={`coach-topic-${t.topic}`}>
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

          <Card className="bg-card border-border" data-testid="panel-se-learning">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Learning Centre — By Topic</CardTitle>
              <CardDescription className="text-xs">Existing Learning Centre content connected to each topic. No duplicated content.</CardDescription>
            </CardHeader>
            <CardContent>
              {learningQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-3" data-testid="learning-by-topic">
                  {(learningQuery.data ?? []).map((bundle) => (
                    <div key={bundle.topic} data-testid={`learning-topic-${bundle.topic}`}>
                      <p className="text-xs font-semibold">{bundle.topic.replace(/_/g, " ")}</p>
                      <ul className="space-y-0.5">
                        {bundle.links.map((l) => (
                          <li key={`${l.pathKey}-${l.topicKey}`}>
                            <Link href={l.href} className="text-xs text-primary hover:underline" data-testid={`learning-link-${l.pathKey}-${l.topicKey}`}>
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
          <Card className="bg-card border-border" data-testid="panel-se-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Scenario Reporting</CardTitle>
              <CardDescription className="text-xs">Scenario Analysis Report and Stress Test Report, reused from the platform's own Institutional Reporting Centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reporting-centre?reportType=scenario-analysis-report" className="text-xs text-primary hover:underline block" data-testid="link-report-scenario-analysis-report">
                Generate Scenario Analysis Report →
              </Link>
              <Link href="/reporting-centre?reportType=stress-test-report" className="text-xs text-primary hover:underline block" data-testid="link-report-stress-test-report">
                Generate Stress Test Report →
              </Link>
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
