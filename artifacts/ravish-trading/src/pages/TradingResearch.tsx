// Phase 3, Sprint 40 — Institutional Trading Engine, Trading Research page
// skeleton + Market Structure card (the first bounded slice of the approved
// Route+UI backlog reduction — see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 40 as-built note).
// Phase 3, Sprint 41 added the Multi-Timeframe confluence card (the second
// bounded slice) onto this same shell, without touching the Market
// Structure card's own logic, exactly as Sprint 40's own header comment
// anticipated. Phase 3, Sprint 42 added the Market Regime card (the third
// bounded slice) the same way. Phase 3, Sprint 43 added the Probability
// card (the fourth bounded slice) the same way. Phase 3, Sprint 44 added
// the Portfolio Risk section (the fifth bounded slice) - unlike the four
// symbol-search-gated cards above, this section is portfolio-wide (reads
// the calling user's own trading_positions), so it is always visible,
// independent of the symbol search box. Phase 3, Sprint 45 added the
// Liquidity tab (the sixth bounded slice) - unlike Structure/Multi-
// Timeframe/Regime/Probability (eager cards, per Phase 3 plan section 21's
// "cheap enough to compute eagerly" group), Liquidity is designed as an
// on-demand tab (matching Phase 2's Statements/Peers precedent), since it
// carries its own volume-profile computation and is not part of that
// eager-card group. The Structure/Multi-Timeframe/Regime/Probability cards
// were moved into a "Research" tab (unchanged content, just a new tab
// wrapper) so the on-demand "Liquidity" tab could sit alongside them
// without restructuring their own logic. Phase 3, Sprint 48 added the AI
// Trade Coach chat panel (the seventh bounded slice) to the Research tab,
// after the Probability card - reuses Sprint 47's own POST
// /trading/coach/ask/stream route and the exact streamCoach() SSE client
// StockResearch.tsx's "Ask the AI Investment Analyst" panel already
// established (Phase 2, Sprint 30), adapted (not rewritten) for Engine 2.
//
// Advisory/education only: this page never previews, schedules, or submits
// any order, and never touches a real brokerage account - Engine 2 is
// read-only/advisory throughout this phase (Phase 3 plan section 19).

import { useState } from "react";
import {
  useGetTradingStructure,
  getGetTradingStructureQueryKey,
  useGetTradingMultiTimeframe,
  getGetTradingMultiTimeframeQueryKey,
  useGetTradingRegime,
  getGetTradingRegimeQueryKey,
  useGetTradingProbability,
  getGetTradingProbabilityQueryKey,
  useGetTradingLiquidity,
  getGetTradingLiquidityQueryKey,
  useListTradingPositions,
  getListTradingPositionsQueryKey,
  useCreateTradingPosition,
  useDeleteTradingPosition,
  useGetTradingRisk,
  getGetTradingRiskQueryKey,
  useGetSettings,
  useUpdateSettings,
  type TradingPositionInputSide,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { streamCoach } from "@/lib/coach-stream";
import { Markdown } from "@/components/ui/markdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  Gauge,
  Target,
  ShieldAlert,
  Trash2,
  Droplets,
  MessageCircle,
  Send,
} from "lucide-react";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function trendBadgeClass(trend: string): string {
  if (trend === "uptrend") return "border-emerald-500/40 text-emerald-400";
  if (trend === "downtrend") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "uptrend") return <TrendingUp className="h-4 w-4" />;
  if (trend === "downtrend") return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function confidenceBadgeClass(level: string): string {
  if (level === "High") return "border-emerald-500/40 text-emerald-400";
  if (level === "Moderate") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

function agreementBadgeClass(agreement: string): string {
  if (agreement === "unanimous") return "border-emerald-500/40 text-emerald-400";
  if (agreement === "majority") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

function regimeBadgeClass(regimeLabel: string): string {
  if (regimeLabel === "trending-bullish") return "border-emerald-500/40 text-emerald-400";
  if (regimeLabel === "trending-bearish") return "border-rose-500/40 text-rose-400";
  if (regimeLabel === "volatile-choppy") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

function volatilityBadgeClass(volatilityRegime: string): string {
  if (volatilityRegime === "high") return "border-amber-500/40 text-amber-400";
  if (volatilityRegime === "low") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

function riskGradeBadgeClass(label: string): string {
  if (label === "Excellent" || label === "Strong") return "border-emerald-500/40 text-emerald-400";
  if (label === "Moderate") return "border-amber-500/40 text-amber-400";
  if (label === "Elevated" || label === "Poor") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

function liquidityBandBadgeClass(band: string): string {
  if (band === "High") return "border-emerald-500/40 text-emerald-400";
  if (band === "Moderate") return "border-amber-500/40 text-amber-400";
  return "border-rose-500/40 text-rose-400";
}

function pressureBadgeClass(direction: string): string {
  if (direction === "buying") return "border-emerald-500/40 text-emerald-400";
  if (direction === "selling") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

export default function TradingResearch() {
  const [inputValue, setInputValue] = useState("");
  const [symbol, setSymbol] = useState("");
  const [tab, setTab] = useState("research");

  const { data: structure, isLoading, isError } = useGetTradingStructure(symbol, {
    query: { queryKey: getGetTradingStructureQueryKey(symbol), enabled: !!symbol },
  });

  const {
    data: multiTimeframe,
    isLoading: isMultiTimeframeLoading,
    isError: isMultiTimeframeError,
  } = useGetTradingMultiTimeframe(symbol, {
    query: { queryKey: getGetTradingMultiTimeframeQueryKey(symbol), enabled: !!symbol },
  });

  const {
    data: regime,
    isLoading: isRegimeLoading,
    isError: isRegimeError,
  } = useGetTradingRegime(symbol, {
    query: { queryKey: getGetTradingRegimeQueryKey(symbol), enabled: !!symbol },
  });

  const {
    data: probability,
    isLoading: isProbabilityLoading,
    isError: isProbabilityError,
  } = useGetTradingProbability(symbol, {
    query: { queryKey: getGetTradingProbabilityQueryKey(symbol), enabled: !!symbol },
  });

  // On-demand: unlike the four eager cards above, liquidity is fetched only
  // when the Liquidity tab is actually opened for a searched symbol,
  // matching Phase 2's established queryKey + enabled-gated on-demand-tab
  // pattern (Statements/Peers, Sprints 19-20).
  const {
    data: liquidity,
    isLoading: isLiquidityLoading,
    isError: isLiquidityError,
  } = useGetTradingLiquidity(symbol, {
    query: { queryKey: getGetTradingLiquidityQueryKey(symbol), enabled: tab === "liquidity" && !!symbol },
  });

  const queryClient = useQueryClient();

  const { data: settings } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const [accountValueInput, setAccountValueInput] = useState("");

  const { data: positions } = useListTradingPositions({
    query: { queryKey: getListTradingPositionsQueryKey() },
  });
  const createPosition = useCreateTradingPosition();
  const deletePosition = useDeleteTradingPosition();
  const { data: risk } = useGetTradingRisk({
    query: { queryKey: getGetTradingRiskQueryKey() },
  });

  const [newPosition, setNewPosition] = useState({
    symbol: "",
    side: "long" as TradingPositionInputSide,
    quantity: "",
    entryPrice: "",
    stopPrice: "",
    targetPrice: "",
  });

  function invalidatePositionsAndRisk() {
    queryClient.invalidateQueries({ queryKey: getListTradingPositionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTradingRiskQueryKey() });
  }

  function handleSaveAccountValue(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(accountValueInput);
    if (!accountValueInput || isNaN(value) || value <= 0) return;
    updateSettings.mutate(
      { data: { tradingAccountValue: value } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTradingRiskQueryKey() }) },
    );
  }

  function handleAddPosition(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number(newPosition.quantity);
    const entryPrice = Number(newPosition.entryPrice);
    if (!newPosition.symbol.trim() || !quantity || !entryPrice) return;

    createPosition.mutate(
      {
        data: {
          symbol: newPosition.symbol.trim().toUpperCase(),
          side: newPosition.side,
          quantity,
          entryPrice,
          stopPrice: newPosition.stopPrice ? Number(newPosition.stopPrice) : undefined,
          targetPrice: newPosition.targetPrice ? Number(newPosition.targetPrice) : undefined,
        },
      },
      {
        onSuccess: () => {
          invalidatePositionsAndRisk();
          setNewPosition({ symbol: "", side: "long", quantity: "", entryPrice: "", stopPrice: "", targetPrice: "" });
        },
      },
    );
  }

  function handleDeletePosition(id: number) {
    deletePosition.mutate({ id }, { onSuccess: invalidatePositionsAndRisk });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSymbol(inputValue.trim().toUpperCase());
  }

  // Phase 3, Sprint 48 — AI Trade Coach free-form Q&A. Local to this page
  // (keyed only off `symbol`), reuses the exact streamCoach() SSE client
  // StockResearch.tsx's own Ask panel already established (Phase 2, Sprint
  // 30) against Sprint 47's already-shipped POST /trading/coach/ask/stream
  // route — no new coaching logic here, only the chat UI.
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachHistory, setCoachHistory] = useState<{ question: string; answer: string }[]>([]);
  const [coachStreamingAnswer, setCoachStreamingAnswer] = useState("");
  const [coachAsking, setCoachAsking] = useState(false);

  function handleAskCoach(e: React.FormEvent) {
    e.preventDefault();
    const question = coachQuestion.trim();
    if (!question || coachAsking || !symbol) return;
    setCoachAsking(true);
    setCoachStreamingAnswer("");
    setCoachQuestion("");
    streamCoach(
      "/trading/coach/ask/stream",
      { symbol, question },
      {
        onDelta: (text) => setCoachStreamingAnswer((prev) => prev + text),
        onDone: (data) => {
          const d = data as { answer?: string };
          setCoachHistory((prev) => [...prev, { question, answer: d.answer ?? coachStreamingAnswer }]);
          setCoachStreamingAnswer("");
          setCoachAsking(false);
        },
        onError: () => {
          setCoachHistory((prev) => [...prev, { question, answer: "Failed to get an answer — please try again." }]);
          setCoachStreamingAnswer("");
          setCoachAsking(false);
        },
      },
    ).catch(() => setCoachAsking(false));
  }

  return (
    <div className="space-y-6 p-6" data-testid="page-trading-research">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trading Research</h1>
        <p className="text-sm text-muted-foreground">
          Institutional Trading Engine (Engine 2) — SIMULATED market analysis, advisory only. Never places an order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter a symbol, e.g. AAPL"
          className="max-w-xs"
          data-testid="input-trading-research-symbol"
        />
        <Button type="submit" data-testid="button-trading-research-search">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="research" data-testid="tab-research">
            Research
          </TabsTrigger>
          <TabsTrigger value="liquidity" disabled={!symbol} data-testid="tab-liquidity">
            Liquidity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="research" className="mt-4 space-y-6">
      {!symbol && (
        <p className="text-sm text-muted-foreground">Enter a symbol above to view its market structure analysis.</p>
      )}

      {symbol && isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {symbol && isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Could not resolve "{symbol}" — check the ticker and try again.
          </CardContent>
        </Card>
      )}

      {symbol && structure && (
        <Card data-testid="card-market-structure">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Market Structure — {structure.symbol}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {structure.dataSource}
              </Badge>
            </div>
            <CardDescription>
              {structure.interval} interval, {structure.candleCount} candles — {fmtUsd(structure.currentPrice)} current price
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`flex items-center gap-1 ${trendBadgeClass(structure.trend)}`}>
                <TrendIcon trend={structure.trend} />
                {structure.trend}
              </Badge>
              <Badge variant="outline" className={confidenceBadgeClass(structure.confidenceLevel)}>
                {structure.confidenceLevel} confidence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{structure.trendDetail}</p>

            {structure.zones.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Support / Resistance Zones</h3>
                <ul className="space-y-1">
                  {structure.zones.map((zone, i) => (
                    <li
                      key={`${zone.kind}-${zone.price}-${i}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      <span className={zone.kind === "support" ? "text-emerald-400" : "text-rose-400"}>
                        {zone.kind === "support" ? "Support" : "Resistance"} — {fmtUsd(zone.price)}
                      </span>
                      <span className="text-muted-foreground">{zone.strength} touches</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {structure.zones.length === 0 && (
              <p className="text-sm text-muted-foreground">No repeated support/resistance zone detected in this sample.</p>
            )}

            <p className="border-t border-border pt-3 text-sm text-muted-foreground">{structure.summary}</p>
          </CardContent>
        </Card>
      )}

      {symbol && isMultiTimeframeLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {symbol && isMultiTimeframeError && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Could not resolve multi-timeframe data for "{symbol}".
          </CardContent>
        </Card>
      )}

      {symbol && multiTimeframe && (
        <Card data-testid="card-multi-timeframe">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Multi-Timeframe Confluence — {multiTimeframe.symbol}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {multiTimeframe.dataSource}
              </Badge>
            </div>
            <CardDescription>Trend confluence across {multiTimeframe.timeframes.map((t) => t.interval).join(" / ")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {multiTimeframe.dominantTrend ? (
                <Badge variant="outline" className={`flex items-center gap-1 ${trendBadgeClass(multiTimeframe.dominantTrend)}`}>
                  <TrendIcon trend={multiTimeframe.dominantTrend} />
                  {multiTimeframe.dominantTrend}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  No dominant trend
                </Badge>
              )}
              <Badge variant="outline" className={agreementBadgeClass(multiTimeframe.trendAgreement)}>
                {multiTimeframe.trendAgreement}
              </Badge>
              {multiTimeframe.confluenceScore !== null && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {multiTimeframe.confluenceScore}% confluence
                </Badge>
              )}
              <Badge variant="outline" className={confidenceBadgeClass(multiTimeframe.confidenceLevel)}>
                {multiTimeframe.confidenceLevel} confidence
              </Badge>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Per-Timeframe Trend</h3>
              <ul className="space-y-1">
                {multiTimeframe.timeframes.map((tf) => (
                  <li
                    key={tf.interval}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground">{tf.interval}</span>
                    <span className={`flex items-center gap-1 ${trendBadgeClass(tf.structure.trend)}`}>
                      <TrendIcon trend={tf.structure.trend} />
                      {tf.structure.trend}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="border-t border-border pt-3 text-sm text-muted-foreground">{multiTimeframe.summary}</p>
          </CardContent>
        </Card>
      )}

      {symbol && isRegimeLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {symbol && isRegimeError && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Could not resolve regime data for "{symbol}".
          </CardContent>
        </Card>
      )}

      {symbol && regime && (
        <Card data-testid="card-market-regime">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Market Regime — {regime.symbol}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {regime.dataSource}
              </Badge>
            </div>
            <CardDescription>Composite of trend, liquidity, and realized-volatility axes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={regimeBadgeClass(regime.regimeLabel)}>
                {regime.regimeLabel}
              </Badge>
              <Badge variant="outline" className={volatilityBadgeClass(regime.volatilityRegime)}>
                {`${regime.volatilityRegime} volatility${regime.volatilityAnnualizedPct !== null ? ` (${regime.volatilityAnnualizedPct}%)` : ""}`}
              </Badge>
              <Badge variant="outline" className="border-border text-muted-foreground">
                {regime.liquidityRegime} liquidity
              </Badge>
              <Badge variant="outline" className={confidenceBadgeClass(regime.confidenceLevel)}>
                {regime.confidenceLevel} confidence
              </Badge>
            </div>

            <p className="border-t border-border pt-3 text-sm text-muted-foreground">{regime.summary}</p>
          </CardContent>
        </Card>
      )}

      {symbol && isProbabilityLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      )}

      {symbol && isProbabilityError && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Could not resolve probability data for "{symbol}".
          </CardContent>
        </Card>
      )}

      {symbol && probability && (
        <Card data-testid="card-probability">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Probability — {probability.symbol}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {probability.dataSource}
              </Badge>
            </div>
            <CardDescription>
              Driftless lognormal probability cone (±1σ/±2σ) around {fmtUsd(probability.currentPrice)} current price
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!probability.available && (
              <p className="text-sm text-muted-foreground">
                {probability.unavailableReason ?? "Probability cone unavailable for this symbol."}
              </p>
            )}

            {probability.available && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {probability.volatilityAnnualizedPct !== null
                      ? `${probability.volatilityAnnualizedPct}% annualized volatility`
                      : "Volatility unavailable"}
                  </Badge>
                  <Badge variant="outline" className={confidenceBadgeClass(probability.confidenceLevel)}>
                    {probability.confidenceLevel} confidence
                  </Badge>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Probability Cone</h3>
                  <ul className="space-y-1">
                    {probability.cone.map((level) => (
                      <li
                        key={level.daysAhead}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground">{level.daysAhead}d</span>
                        <span>
                          1σ: {fmtUsd(level.low1Sigma)} – {fmtUsd(level.high1Sigma)}
                        </span>
                        <span className="text-muted-foreground">
                          2σ: {fmtUsd(level.low2Sigma)} – {fmtUsd(level.high2Sigma)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <p className="border-t border-border pt-3 text-sm text-muted-foreground">{probability.summary}</p>
          </CardContent>
        </Card>
      )}

      {symbol && (
        <Card data-testid="card-trade-coach">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Ask the AI Trade Coach
            </CardTitle>
            <CardDescription>
              Ask anything about {symbol}'s structure, liquidity, regime, and probability cone, plus your own
              portfolio risk and recent journal reflections. Grounded in the data above only — education, not
              investment advice. Never places an order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {coachHistory.length === 0 && !coachStreamingAnswer && (
              <p className="text-sm text-muted-foreground" data-testid="trade-coach-empty">
                No questions yet — ask something like "What does my portfolio risk look like for {symbol}?"
              </p>
            )}

            {(coachHistory.length > 0 || coachStreamingAnswer) && (
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1" data-testid="trade-coach-history">
                {coachHistory.map((turn, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-xs font-medium text-foreground/90">Q: {turn.question}</p>
                    <div className="border-l border-border pl-3 text-xs text-muted-foreground">
                      <Markdown className="inline text-xs">{turn.answer}</Markdown>
                    </div>
                  </div>
                ))}
                {coachAsking && (
                  <div className="space-y-1" data-testid="trade-coach-loading">
                    <p className="border-l border-border pl-3 text-xs text-muted-foreground">
                      {coachStreamingAnswer || "thinking…"}
                    </p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleAskCoach} className="flex gap-2">
              <Input
                value={coachQuestion}
                onChange={(e) => setCoachQuestion(e.target.value)}
                placeholder="e.g. Is now a good time to look at AAPL given my risk profile?"
                disabled={coachAsking}
                data-testid="trade-coach-input"
              />
              <Button type="submit" size="sm" disabled={!coachQuestion.trim() || coachAsking} data-testid="trade-coach-submit">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="liquidity" className="mt-4">
          {!symbol && (
            <p className="text-sm text-muted-foreground">Enter a symbol above to view its liquidity analysis.</p>
          )}

          {symbol && isLiquidityLoading && (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          )}

          {symbol && isLiquidityError && (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Could not resolve liquidity data for "{symbol}".
              </CardContent>
            </Card>
          )}

          {symbol && liquidity && (
            <Card data-testid="card-liquidity">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    Liquidity — {liquidity.symbol}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {liquidity.dataSource}
                  </Badge>
                </div>
                <CardDescription>
                  {liquidity.interval} interval, {liquidity.candleCount} candles — {fmtUsd(liquidity.currentPrice)} current price
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={liquidityBandBadgeClass(liquidity.liquidityBand)}>
                    {liquidity.liquidityBand} liquidity
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {`$${(liquidity.avgDollarVolume / 1_000_000).toFixed(1)}M avg daily dollar volume`}
                  </Badge>
                  <Badge variant="outline" className={pressureBadgeClass(liquidity.buySellPressure.direction)}>
                    {`${liquidity.buySellPressure.direction} pressure (${liquidity.buySellPressure.buyPct}% buy / ${liquidity.buySellPressure.sellPct}% sell)`}
                  </Badge>
                  <Badge variant="outline" className={confidenceBadgeClass(liquidity.confidenceLevel)}>
                    {liquidity.confidenceLevel} confidence
                  </Badge>
                </div>

                {liquidity.volumeProfile.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Volume Profile</h3>
                    <ul className="space-y-1">
                      {liquidity.volumeProfile.map((level, i) => (
                        <li
                          key={`${level.price}-${i}`}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                        >
                          <span className="text-muted-foreground">{fmtUsd(level.price)}</span>
                          <span>{level.pctOfTotal}% of volume</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {liquidity.volumeProfile.length === 0 && (
                  <p className="text-sm text-muted-foreground">No volume data available to build a profile for this sample.</p>
                )}

                <p className="border-t border-border pt-3 text-sm text-muted-foreground">{liquidity.summary}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card data-testid="card-portfolio-risk">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Portfolio Risk
          </CardTitle>
          <CardDescription>
            Position sizing, stop/target discipline, and portfolio risk budget over your own open trading positions. Never places an order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSaveAccountValue} className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Account Value</label>
              <Input
                type="number"
                value={accountValueInput}
                onChange={(e) => setAccountValueInput(e.target.value)}
                placeholder={settings?.tradingAccountValue != null ? String(settings.tradingAccountValue) : "e.g. 100000"}
                className="w-40"
                data-testid="input-account-value"
              />
            </div>
            <Button type="submit" variant="outline" data-testid="button-save-account-value">
              Save
            </Button>
            {settings?.tradingAccountValue != null && (
              <span className="pb-2 text-sm text-muted-foreground">Current: {fmtUsd(settings.tradingAccountValue)}</span>
            )}
          </form>

          <form onSubmit={handleAddPosition} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Symbol</label>
              <Input
                value={newPosition.symbol}
                onChange={(e) => setNewPosition({ ...newPosition, symbol: e.target.value })}
                placeholder="AAPL"
                className="w-24"
                data-testid="input-position-symbol"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Side</label>
              <select
                value={newPosition.side}
                onChange={(e) => setNewPosition({ ...newPosition, side: e.target.value as TradingPositionInputSide })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                data-testid="select-position-side"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Quantity</label>
              <Input
                type="number"
                value={newPosition.quantity}
                onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
                className="w-24"
                data-testid="input-position-quantity"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Entry Price</label>
              <Input
                type="number"
                value={newPosition.entryPrice}
                onChange={(e) => setNewPosition({ ...newPosition, entryPrice: e.target.value })}
                className="w-28"
                data-testid="input-position-entry-price"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Stop Price</label>
              <Input
                type="number"
                value={newPosition.stopPrice}
                onChange={(e) => setNewPosition({ ...newPosition, stopPrice: e.target.value })}
                className="w-28"
                data-testid="input-position-stop-price"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Target Price</label>
              <Input
                type="number"
                value={newPosition.targetPrice}
                onChange={(e) => setNewPosition({ ...newPosition, targetPrice: e.target.value })}
                className="w-28"
                data-testid="input-position-target-price"
              />
            </div>
            <Button type="submit" data-testid="button-add-position">
              Add Position
            </Button>
          </form>

          {positions && positions.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Positions</h3>
              <ul className="space-y-1">
                {positions.map((p) => (
                  <li
                    key={p.id}
                    data-testid={`row-position-${p.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <span>
                      {p.symbol} · {p.side} · {p.quantity} @ {fmtUsd(p.entryPrice)}
                      {p.stopPrice != null ? ` · stop ${fmtUsd(p.stopPrice)}` : ""}
                      {p.targetPrice != null ? ` · target ${fmtUsd(p.targetPrice)}` : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePosition(p.id)}
                      data-testid={`button-delete-position-${p.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(!positions || positions.length === 0) && (
            <p className="text-sm text-muted-foreground">No trading positions yet — add one above.</p>
          )}

          {risk && (
            <div className="space-y-3 border-t border-border pt-4" data-testid="section-risk-analysis">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={riskGradeBadgeClass(risk.overall.label)}>
                  Overall: {risk.overall.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{risk.overall.detail}</p>

              <ul className="space-y-1">
                <li className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
                  Position sizing: {risk.positionSizing.detail}
                </li>
                <li className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
                  Stop/target discipline: {risk.stopDiscipline.detail}
                </li>
                <li className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
                  Portfolio risk budget: {risk.portfolioBudget.detail}
                </li>
              </ul>

              {risk.positionContexts.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Per-Position Touch Probability (SIMULATED regime context)</h3>
                  <ul className="space-y-1">
                    {risk.positionContexts.map((ctx) => (
                      <li
                        key={ctx.positionId}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground">{ctx.symbol}</span>
                        <span>
                          {ctx.regimeLabel ?? "regime unavailable"}
                          {ctx.stopTouchProbability != null ? ` · stop touch ${Math.round(ctx.stopTouchProbability * 100)}%` : ""}
                          {ctx.targetTouchProbability != null
                            ? ` · target touch ${Math.round(ctx.targetTouchProbability * 100)}%`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
