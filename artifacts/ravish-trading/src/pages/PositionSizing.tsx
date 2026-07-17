// Position Sizing & Portfolio Impact Calculator sprint.
//
// Extends the Order Preview & Risk Simulator (previous sprint) with a
// full pre-trade Position Sizing and Portfolio Impact experience — still
// fully read-only, still no submit button anywhere on this page. Calls
// POST /execution/position-sizing (lib/positionSizing.ts, backend), which
// itself only ever reads local data and reuses last sprint's
// buildOrderPreview()/execution.ts's own unmodified previewOptionOrder().
//
// "Current portfolio" and "Hypothetical post-preview portfolio" are always
// shown as clearly separate, labeled sections — the hypothetical section
// is never rendered as if it were real, already-open positions.

import { useState } from "react";
import { usePreviewPositionSizing } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import type { OrderPreviewInputStrategy } from "@workspace/api-client-react";

const STRATEGIES = [
  { value: "iron_condor", label: "Iron Condor" },
  { value: "iron_fly", label: "Iron Fly" },
  { value: "calendar_spread", label: "Calendar Spread" },
  { value: "earnings", label: "Earnings Play" },
] as const;

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function warningBadgeClass(status: "ok" | "warning" | "blocked"): string {
  if (status === "ok") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "warning") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function warningIcon(status: "ok" | "warning" | "blocked") {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  return <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />;
}

function PaperTradingBanner() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
        Paper Trading Mode
      </Badge>
      <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-preview-only">
        Preview Only – No order will be submitted
      </Badge>
    </div>
  );
}

export default function PositionSizing() {
  const [symbol, setSymbol] = useState("");
  const [strategy, setStrategy] = useState<string>("iron_condor");
  const [quantity, setQuantity] = useState("1");
  const [customQuantity, setCustomQuantity] = useState("");

  const analysis = usePreviewPositionSizing();
  const result = analysis.data;

  function runAnalysis() {
    const parsedQuantity = quantity.trim() === "" ? null : Number(quantity);
    const parsedCustom = customQuantity.trim() === "" ? null : Number(customQuantity);
    analysis.mutate({
      data: {
        symbol: symbol.trim() === "" ? null : symbol.trim(),
        strategy: (strategy || null) as OrderPreviewInputStrategy,
        quantity: parsedQuantity === null || Number.isNaN(parsedQuantity) ? null : parsedQuantity,
        customQuantity: parsedCustom === null || Number.isNaN(parsedCustom) ? null : parsedCustom,
      },
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Position Sizing &amp; Portfolio Impact</h1>
        </div>
        <PaperTradingBanner />
        <p className="text-sm text-muted-foreground mt-1">
          A pre-trade sizing and portfolio-impact calculator, extending Order Preview. Every
          calculation reuses this platform&apos;s existing execution and options pricing logic —
          nothing here places, modifies, or cancels an order.
        </p>
      </div>

      {/* ─── Input form ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Enter a symbol, strategy, and quantity, then Preview Only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" htmlFor="input-sizing-symbol">Symbol</label>
              <Input
                id="input-sizing-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL"
                data-testid="input-sizing-symbol"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" id="label-sizing-strategy">Strategy</label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="bg-background" aria-labelledby="label-sizing-strategy" data-testid="select-sizing-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" htmlFor="input-sizing-quantity">Quantity</label>
              <Input
                id="input-sizing-quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-sizing-quantity"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block" htmlFor="input-sizing-custom-quantity">Custom Scenario Quantity (optional)</label>
              <Input
                id="input-sizing-custom-quantity"
                type="number"
                min={1}
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                placeholder="e.g. 6"
                data-testid="input-sizing-custom-quantity"
              />
            </div>
          </div>
          <Button type="button" onClick={runAnalysis} disabled={analysis.isPending} data-testid="button-analyze-position-sizing">
            {analysis.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...
              </>
            ) : (
              "Preview Only"
            )}
          </Button>
        </CardContent>
      </Card>

      {analysis.isPending && (
        <Card className="bg-card border-border" data-testid="sizing-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {analysis.isError && (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive" data-testid="text-sizing-error">
              Failed to generate a position sizing analysis. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {result && !result.preview.available && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Preview Not Available</CardTitle>
            <CardDescription>Fix the issues below and try again — no order was submitted.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1" data-testid="list-sizing-input-issues">
              {result.preview.inputIssues.map((issue, i) => (
                <li key={i} className="text-sm text-destructive flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span data-testid={`text-sizing-input-issue-${issue.field}`}>{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result && result.positionSizing && (
        <Card className="bg-card border-border" data-testid="card-position-sizing">
          <CardHeader>
            <CardTitle>Position Sizing</CardTitle>
            <CardDescription>All figures reuse execution.ts&apos;s own existing ticket-building logic.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Recommended Size</div>
                <div className="font-mono" data-testid="text-recommended-quantity">
                  {result.positionSizing.recommendedQuantity ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Position Size % of Portfolio</div>
                <div className="font-mono" data-testid="text-position-size-pct">
                  {fmtPct(result.positionSizing.positionSizePctOfPortfolio)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Buying Power Utilization</div>
                <div className="font-mono" data-testid="text-buying-power-utilization">
                  {fmtPct(result.positionSizing.buyingPowerUtilizationPct)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Capital at Risk</div>
                <div className="font-mono text-destructive" data-testid="text-capital-at-risk">
                  {fmtCurrency(result.positionSizing.capitalAtRisk)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Max Theoretical Loss</div>
                <div className="font-mono text-destructive" data-testid="text-max-theoretical-loss">
                  {fmtCurrency(result.positionSizing.maxTheoreticalLoss)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Max Theoretical Gain</div>
                <div className="font-mono text-emerald-400" data-testid="text-max-theoretical-gain">
                  {fmtCurrency(result.positionSizing.maxTheoreticalGain)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risk/Reward Ratio</div>
                <div className="font-mono" data-testid="text-sizing-risk-reward-ratio">
                  {result.positionSizing.riskRewardRatio === null
                    ? "N/A"
                    : `1 : ${result.positionSizing.riskRewardRatio.toFixed(2)}`}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Concentration Before</div>
                <div className="font-mono" data-testid="text-concentration-before">
                  {fmtPct(result.positionSizing.concentrationBeforePct)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Concentration After</div>
                <div className="font-mono" data-testid="text-concentration-after">
                  {fmtPct(result.positionSizing.concentrationAfterPct)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-1">Break-Even Price(s)</div>
              {result.positionSizing.breakEvens.length > 0 ? (
                <div className="flex gap-4" data-testid="list-break-evens">
                  {result.positionSizing.breakEvens.map((be) => (
                    <span key={be.label} className="font-mono text-sm" data-testid={`text-break-even-${be.label.toLowerCase()}`}>
                      {be.label}: {fmtCurrency(be.price)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-break-even-unavailable">
                  {result.positionSizing.breakEvenUnavailableReason}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="bg-card border-border" data-testid="card-portfolio-impact">
          <CardHeader>
            <CardTitle>Portfolio Impact</CardTitle>
            <CardDescription>
              Current portfolio (real, already-open positions) vs. hypothetical post-preview portfolio
              (never real — a simulation only).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div data-testid="section-current-portfolio">
                <h3 className="text-sm font-semibold mb-2">Current Portfolio</h3>
                <div className="text-sm space-y-1">
                  <div data-testid="text-current-open-positions">
                    Open positions: {result.portfolioImpact.current.openPositionsCount}
                  </div>
                  <div data-testid="text-current-total-risk">
                    Total risk: {fmtCurrency(result.portfolioImpact.current.totalRiskDollars)} (
                    {fmtPct(result.portfolioImpact.current.totalRiskPct)})
                  </div>
                  <div data-testid="text-current-long-short">
                    Long: {fmtCurrency(result.portfolioImpact.current.longExposureDollars)} / Short:{" "}
                    {fmtCurrency(result.portfolioImpact.current.shortExposureDollars)}
                  </div>
                  <div data-testid="text-current-greeks">
                    Δ {result.portfolioImpact.current.greeks.delta} / Γ {result.portfolioImpact.current.greeks.gamma} / Θ{" "}
                    {result.portfolioImpact.current.greeks.theta} / V {result.portfolioImpact.current.greeks.vega}
                  </div>
                  {result.portfolioImpact.current.exposureBySymbol.length === 0 ? (
                    <p className="text-muted-foreground" data-testid="text-current-empty">
                      No open positions.
                    </p>
                  ) : (
                    <ul data-testid="list-current-exposure-by-symbol">
                      {result.portfolioImpact.current.exposureBySymbol.map((e) => (
                        <li key={e.symbol} data-testid={`text-current-exposure-${e.symbol}`}>
                          {e.symbol}: {fmtCurrency(e.riskDollars)} ({fmtPct(e.pctOfAccount)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div data-testid="section-hypothetical-portfolio">
                <h3 className="text-sm font-semibold mb-2">Hypothetical Post-Preview Portfolio</h3>
                {result.portfolioImpact.hypothetical ? (
                  <div className="text-sm space-y-1">
                    <div data-testid="text-hypothetical-open-positions">
                      Open positions: {result.portfolioImpact.hypothetical.openPositionsCount}
                    </div>
                    <div data-testid="text-hypothetical-total-risk">
                      Total risk: {fmtCurrency(result.portfolioImpact.hypothetical.totalRiskDollars)} (
                      {fmtPct(result.portfolioImpact.hypothetical.totalRiskPct)})
                    </div>
                    <div data-testid="text-hypothetical-long-short">
                      Long: {fmtCurrency(result.portfolioImpact.hypothetical.longExposureDollars)} / Short:{" "}
                      {fmtCurrency(result.portfolioImpact.hypothetical.shortExposureDollars)}
                    </div>
                    <div data-testid="text-hypothetical-greeks">
                      Δ {result.portfolioImpact.hypothetical.greeks.delta} / Γ {result.portfolioImpact.hypothetical.greeks.gamma} / Θ{" "}
                      {result.portfolioImpact.hypothetical.greeks.theta} / V {result.portfolioImpact.hypothetical.greeks.vega}
                    </div>
                    <ul data-testid="list-hypothetical-exposure-by-symbol">
                      {result.portfolioImpact.hypothetical.exposureBySymbol.map((e) => (
                        <li key={e.symbol} data-testid={`text-hypothetical-exposure-${e.symbol}`}>
                          {e.symbol}: {fmtCurrency(e.riskDollars)} ({fmtPct(e.pctOfAccount)})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-hypothetical-unavailable">
                    No valid order to simulate yet.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Estimated Greeks Impact</h3>
              {result.portfolioImpact.deltaImpact !== null ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Delta Impact</div>
                    <div className="font-mono" data-testid="text-delta-impact">
                      {result.portfolioImpact.deltaImpact}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Theta Impact</div>
                    <div className="font-mono" data-testid="text-theta-impact">
                      {result.portfolioImpact.thetaImpact}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Gamma Impact</div>
                    <div className="font-mono" data-testid="text-gamma-impact">
                      {result.portfolioImpact.gammaImpact}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Vega Impact</div>
                    <div className="font-mono" data-testid="text-vega-impact">
                      {result.portfolioImpact.vegaImpact}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-greeks-impact-unavailable">
                  No valid order to simulate yet.
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">Exposure by Sector</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-sector-exposure-unavailable">
                {result.portfolioImpact.sectorExposure.reason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.riskWarnings.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Risk Warnings</CardTitle>
            <CardDescription>
              Informational only — this is a dry-run preview, so nothing here ever blocks a real
              submission because no submission is ever made.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2" data-testid="list-risk-warnings">
              {result.riskWarnings.map((w) => (
                <li key={w.code} className="flex items-start gap-2 text-sm" data-testid={`warning-item-${w.code}`}>
                  {warningIcon(w.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{w.label}</span>
                      <Badge className={warningBadgeClass(w.status)} data-testid={`badge-warning-${w.code}`}>
                        {w.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{w.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result && result.scenarios.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Scenario Comparison</CardTitle>
            <CardDescription>How position exposure, risk, buying power, and concentration change by size.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="table-scenarios">
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Capital at Risk</TableHead>
                  <TableHead>Buying Power Required</TableHead>
                  <TableHead>Buying Power Utilization</TableHead>
                  <TableHead>Concentration After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.scenarios.map((s) => (
                  <TableRow key={s.label} data-testid={`row-scenario-${s.label.replace(/\W+/g, "-")}`}>
                    <TableCell>{s.label}</TableCell>
                    <TableCell>{s.quantity}</TableCell>
                    {s.available ? (
                      <>
                        <TableCell>{fmtCurrency(s.capitalAtRisk)}</TableCell>
                        <TableCell>{fmtCurrency(s.buyingPowerRequired)}</TableCell>
                        <TableCell>{fmtPct(s.buyingPowerUtilizationPct)}</TableCell>
                        <TableCell>{fmtPct(s.concentrationAfterPct)}</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={4} className="text-muted-foreground" data-testid={`text-scenario-unavailable-${s.label.replace(/\W+/g, "-")}`}>
                        {s.unavailableReason}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
