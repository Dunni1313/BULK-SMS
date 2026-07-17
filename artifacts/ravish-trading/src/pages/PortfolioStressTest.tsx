// Portfolio Stress Test & Scenario Simulator sprint.
//
// A dedicated What-If page: build one or more hypothetical price / IV /
// time-decay shocks and see the full Before/After impact on the current
// open portfolio — WITHOUT ever contacting a broker or mutating a single
// row. Calls POST /execution/stress-test (lib/portfolioStressTest.ts,
// backend), which itself only ever reads local trade data and reuses
// optionsMath.ts's own existing, unmodified bs() for every shocked
// repricing. This page has no submit action of any kind.

import { useState } from "react";
import {
  useRunPortfolioStressTest,
  type ScenarioShockInput,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Loader2,
  Minus,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

const PRICE_PRESETS = [-10, -5, -2, -1, 1, 2, 5, 10];
const IV_PRESETS = [-20, -10, -5, 5, 10, 20];
const TIME_DECAY_PRESETS = [1, 7, 14, 30];

const QUICK_SCENARIOS: { label: string; shock: ScenarioShockInput }[] = [
  { label: "Bullish (+5%)", shock: { priceShockPct: 5, ivShockPct: 0, timeDecayDays: 0 } },
  { label: "Bearish (-5%)", shock: { priceShockPct: -5, ivShockPct: 0, timeDecayDays: 0 } },
  { label: "High Volatility (+20% IV)", shock: { priceShockPct: 0, ivShockPct: 20, timeDecayDays: 0 } },
  { label: "Low Volatility (-20% IV)", shock: { priceShockPct: 0, ivShockPct: -20, timeDecayDays: 0 } },
];

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtSigned(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n >= 0 ? "+" : ""}${fmtCurrency(n)}`;
}

function describeShock(shock: ScenarioShockInput): string {
  const parts: string[] = [];
  if (shock.priceShockPct) parts.push(`Price ${shock.priceShockPct! >= 0 ? "+" : ""}${shock.priceShockPct}%`);
  if (shock.ivShockPct) parts.push(`IV ${shock.ivShockPct! >= 0 ? "+" : ""}${shock.ivShockPct}%`);
  if (shock.timeDecayDays) parts.push(`+${shock.timeDecayDays}d`);
  return parts.length > 0 ? parts.join(", ") : "No shock";
}

function riskScoreBadgeClass(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (score >= 60) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function impactBadgeClass(n: number): string {
  if (n > 0) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (n < 0) return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

function ImpactIcon({ n }: { n: number }) {
  if (n > 0) return <TrendingUp className="w-3.5 h-3.5" />;
  if (n < 0) return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
}

interface BuilderScenario {
  key: string;
  label: string;
  shock: ScenarioShockInput;
}

let nextKey = 0;

export default function PortfolioStressTest() {
  const [scenarios, setScenarios] = useState<BuilderScenario[]>([]);
  const [scenarioLabel, setScenarioLabel] = useState("");
  const [priceChoice, setPriceChoice] = useState("0");
  const [priceCustom, setPriceCustom] = useState("");
  const [ivChoice, setIvChoice] = useState("0");
  const [ivCustom, setIvCustom] = useState("");
  const [timeChoice, setTimeChoice] = useState("0");
  const [timeCustom, setTimeCustom] = useState("");

  const stressTest = useRunPortfolioStressTest();
  const result = stressTest.data;

  function resolvedPrice(): number {
    return priceChoice === "custom" ? Number(priceCustom) || 0 : Number(priceChoice);
  }
  function resolvedIv(): number {
    return ivChoice === "custom" ? Number(ivCustom) || 0 : Number(ivChoice);
  }
  function resolvedTime(): number {
    return timeChoice === "custom" ? Number(timeCustom) || 0 : Number(timeChoice);
  }

  function addQuickScenario(q: { label: string; shock: ScenarioShockInput }) {
    setScenarios((prev) => [...prev, { key: String(nextKey++), label: q.label, shock: q.shock }]);
  }

  function addCustomScenario() {
    const shock: ScenarioShockInput = {
      priceShockPct: resolvedPrice(),
      ivShockPct: resolvedIv(),
      timeDecayDays: resolvedTime(),
    };
    const label = scenarioLabel.trim() || describeShock(shock);
    setScenarios((prev) => [...prev, { key: String(nextKey++), label, shock }]);
    setScenarioLabel("");
    setPriceChoice("0");
    setPriceCustom("");
    setIvChoice("0");
    setIvCustom("");
    setTimeChoice("0");
    setTimeCustom("");
  }

  function removeScenario(key: string) {
    setScenarios((prev) => prev.filter((s) => s.key !== key));
  }

  function runStressTest() {
    stressTest.mutate({
      data:
        scenarios.length > 0
          ? { scenarios: scenarios.map((s) => ({ label: s.label, ...s.shock })) }
          : {},
    });
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Portfolio Stress Test &amp; Scenario Simulator</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-simulation-only">
            Simulation Only — No broker interaction occurs
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Model hypothetical underlying price, implied-volatility, and time-decay moves against your
          current open portfolio. Nothing here places, closes, or modifies a real order — every scenario
          result below is a hypothetical, in-memory computation only.
        </p>
      </div>

      {/* ─── Quick scenarios ────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Quick Scenarios</CardTitle>
          <CardDescription>Add a named preset scenario to the list below with one click.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {QUICK_SCENARIOS.map((q) => (
            <Button
              key={q.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addQuickScenario(q)}
              data-testid={`button-quick-scenario-${q.label.replace(/[^a-zA-Z0-9]+/g, "-")}`}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              {q.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* ─── Custom scenario builder ────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Build a Custom Scenario</CardTitle>
          <CardDescription>Combine an underlying price change, an IV change, and time decay into one scenario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" htmlFor="input-scenario-label">Label (optional)</label>
              <input
                id="input-scenario-label"
                type="text"
                value={scenarioLabel}
                onChange={(e) => setScenarioLabel(e.target.value)}
                placeholder="e.g. Earnings gap down"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                data-testid="input-scenario-label"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" id="label-price-shock">Underlying Price Change</label>
              <Select value={priceChoice} onValueChange={setPriceChoice}>
                <SelectTrigger className="bg-background" aria-labelledby="label-price-shock" data-testid="select-price-shock">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No change</SelectItem>
                  {PRICE_PRESETS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p >= 0 ? "+" : ""}
                      {p}%
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom %</SelectItem>
                </SelectContent>
              </Select>
              {priceChoice === "custom" && (
                <input
                  type="number"
                  value={priceCustom}
                  onChange={(e) => setPriceCustom(e.target.value)}
                  placeholder="e.g. -7.5"
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  data-testid="input-price-shock-custom"
                />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" id="label-iv-shock">Implied Volatility Change</label>
              <Select value={ivChoice} onValueChange={setIvChoice}>
                <SelectTrigger className="bg-background" aria-labelledby="label-iv-shock" data-testid="select-iv-shock">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No change</SelectItem>
                  {IV_PRESETS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p >= 0 ? "+" : ""}
                      {p}%
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom %</SelectItem>
                </SelectContent>
              </Select>
              {ivChoice === "custom" && (
                <input
                  type="number"
                  value={ivCustom}
                  onChange={(e) => setIvCustom(e.target.value)}
                  placeholder="e.g. 35"
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  data-testid="input-iv-shock-custom"
                />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" id="label-time-decay">Time Decay</label>
              <Select value={timeChoice} onValueChange={setTimeChoice}>
                <SelectTrigger className="bg-background" aria-labelledby="label-time-decay" data-testid="select-time-decay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No time passes</SelectItem>
                  {TIME_DECAY_PRESETS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      +{p} day{p === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom days</SelectItem>
                </SelectContent>
              </Select>
              {timeChoice === "custom" && (
                <input
                  type="number"
                  min={0}
                  value={timeCustom}
                  onChange={(e) => setTimeCustom(e.target.value)}
                  placeholder="e.g. 21"
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  data-testid="input-time-decay-custom"
                />
              )}
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={addCustomScenario} data-testid="button-add-scenario">
            Add Scenario
          </Button>
        </CardContent>
      </Card>

      {/* ─── Scenario list + run ────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Scenarios to Run</CardTitle>
          <CardDescription>
            {scenarios.length === 0
              ? "No custom scenarios added — running will use the default Bullish/Bearish/High Vol/Low Vol presets."
              : `${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} queued.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scenarios.length > 0 && (
            <ul className="space-y-2" data-testid="list-queued-scenarios">
              {scenarios.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-3 py-2"
                  data-testid={`queued-scenario-${s.key}`}
                >
                  <span>
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground ml-2">{describeShock(s.shock)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeScenario(s.key)}
                    data-testid={`button-remove-scenario-${s.key}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" onClick={runStressTest} disabled={stressTest.isPending} data-testid="button-run-stress-test">
            {stressTest.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Simulating...
              </>
            ) : (
              "Run Stress Test"
            )}
          </Button>
        </CardContent>
      </Card>

      {stressTest.isPending && (
        <Card className="bg-card border-border" data-testid="stress-test-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      )}

      {stressTest.isError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-stress-test-error">
              Failed to run the stress test. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && result.inputIssues.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Notices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1" data-testid="list-stress-test-input-issues">
              {result.inputIssues.map((issue, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span data-testid={`text-stress-test-input-issue-${i}`}>{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* ─── Base case (current portfolio, unshocked) ─────────────── */}
          <Card className="bg-card border-border" data-testid="card-base-case">
            <CardHeader>
              <CardTitle>Current Portfolio (Base Case)</CardTitle>
              <CardDescription>Today's real, unshocked open positions — not a simulation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  <div className="font-mono" data-testid="text-base-portfolio-value">{fmtCurrency(result.base.portfolioValue)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Unrealized P/L</div>
                  <div className="font-mono" data-testid="text-base-unrealized-pnl">{fmtSigned(result.base.totalUnrealizedPnl)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Buying Power</div>
                  <div className="font-mono" data-testid="text-base-buying-power">{fmtCurrency(result.base.buyingPower)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Risk Score</div>
                  <Badge className={riskScoreBadgeClass(result.riskScoreBefore)} data-testid="badge-risk-score-before">
                    {result.riskScoreBefore}
                  </Badge>
                </div>
              </div>
              <div className="text-sm font-mono" data-testid="text-base-greeks">
                Δ {result.base.greeks.delta} / Γ {result.base.greeks.gamma} / Θ {result.base.greeks.theta} / V {result.base.greeks.vega}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Exposure by Symbol</h4>
                  {result.base.exposureBySymbol.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-base-exposure-symbol-empty">No open positions.</p>
                  ) : (
                    <ul className="text-sm space-y-1" data-testid="list-base-exposure-by-symbol">
                      {result.base.exposureBySymbol.map((e) => (
                        <li key={e.symbol} data-testid={`base-exposure-symbol-${e.symbol}`}>
                          {e.symbol}: {fmtCurrency(e.markValue)} ({fmtPct(e.pctOfAccount)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Exposure by Strategy</h4>
                  {result.base.exposureByStrategy.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-base-exposure-strategy-empty">No open positions.</p>
                  ) : (
                    <ul className="text-sm space-y-1" data-testid="list-base-exposure-by-strategy">
                      {result.base.exposureByStrategy.map((e) => (
                        <li key={e.strategy} data-testid={`base-exposure-strategy-${e.strategy}`}>
                          {e.strategy.replace(/_/g, " ")}: {fmtCurrency(e.markValue)} ({fmtPct(e.pctOfAccount)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground" data-testid="text-sector-exposure-unavailable">
                Exposure by sector: {result.sectorExposure.reason}
              </div>
            </CardContent>
          </Card>

          {/* ─── Scenario comparison ───────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="grid-scenario-comparison">
            {result.scenarios.map((s, i) => (
              <Card key={i} className="bg-card border-border" data-testid={`card-scenario-${i}`}>
                <CardHeader>
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  <CardDescription data-testid={`text-scenario-shock-${i}`}>
                    Price {s.shock.priceShockPct >= 0 ? "+" : ""}
                    {s.shock.priceShockPct}% · IV {s.shock.ivShockPct >= 0 ? "+" : ""}
                    {s.shock.ivShockPct}% · +{s.shock.timeDecayDays}d
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Portfolio Value After</div>
                      <div className="font-mono" data-testid={`text-scenario-portfolio-value-${i}`}>{fmtCurrency(s.after.portfolioValue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">P/L Impact</div>
                      <Badge className={`${impactBadgeClass(s.unrealizedPnlImpact)} flex items-center gap-1 w-fit`} data-testid={`badge-scenario-pnl-impact-${i}`}>
                        <ImpactIcon n={s.unrealizedPnlImpact} />
                        {fmtSigned(s.unrealizedPnlImpact)}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Buying Power Impact (est.)</div>
                      <div className="font-mono" data-testid={`text-scenario-bp-impact-${i}`}>{fmtSigned(s.buyingPowerImpactDollars)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Risk Score After</div>
                      <Badge className={riskScoreBadgeClass(s.riskScoreAfter)} data-testid={`badge-risk-score-after-${i}`}>
                        {s.riskScoreAfter}
                      </Badge>
                    </div>
                  </div>
                  <div className="font-mono text-xs" data-testid={`text-scenario-greeks-change-${i}`}>
                    ΔΔ {fmtSigned(s.deltaChange)} / ΔΓ {fmtSigned(s.gammaChange)} / ΔΘ {fmtSigned(s.thetaChange)} / ΔV {fmtSigned(s.vegaChange)}
                  </div>
                  <div data-testid={`text-scenario-drawdown-${i}`}>
                    Drawdown: {s.drawdownPct > 0 ? fmtPct(s.drawdownPct) : "None"}
                  </div>

                  <div className="border-t border-border pt-3 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">Risk Analysis</h4>
                    {s.largestGainingPosition && (
                      <div data-testid={`text-scenario-largest-gain-${i}`}>
                        Largest gain: {s.largestGainingPosition.symbol} {fmtSigned(s.largestGainingPosition.pnlImpact)}
                      </div>
                    )}
                    {s.largestLosingPosition && (
                      <div data-testid={`text-scenario-largest-loss-${i}`}>
                        Largest loss: {s.largestLosingPosition.symbol} {fmtSigned(s.largestLosingPosition.pnlImpact)}
                      </div>
                    )}
                    {s.positionsBreachingThreshold.length > 0 ? (
                      <ul className="space-y-1" data-testid={`list-scenario-breaches-${i}`}>
                        {s.positionsBreachingThreshold.map((b) => (
                          <li key={b.tradeId} className="text-destructive flex items-start gap-1" data-testid={`scenario-breach-${i}-${b.tradeId}`}>
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {b.symbol}: {fmtPct(b.lossPctOfAccount)} loss exceeds {fmtPct(b.thresholdPct)} threshold
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground" data-testid={`text-scenario-no-breaches-${i}`}>
                        No positions breach the configured risk threshold.
                      </div>
                    )}
                    {s.concentrationChanges.length > 0 && (
                      <ul className="space-y-1" data-testid={`list-scenario-concentration-${i}`}>
                        {s.concentrationChanges.map((c) => (
                          <li key={c.symbol} data-testid={`scenario-concentration-${i}-${c.symbol}`}>
                            {c.symbol}: {fmtPct(c.beforePct)} → {fmtPct(c.afterPct)} ({fmtSigned(c.changePts)}pts)
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
