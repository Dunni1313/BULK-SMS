// Phase 3, Sprint 50 — Institutional Trading Engine, Institutional Dashboard
// (approved Phase 3 plan §3/§4/§21; the module named "Institutional
// Dashboard — NEW page" in the plan's own architecture diagram — see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 50 as-built note).
//
// Pure COMPOSITION layer, zero new engine calculations of any kind — every
// figure on this page comes from a route already shipped and already
// covered by its own dedicated tests (Sprints 32-49). This page's own only
// job is arranging already-computed data into one screen.
//
// Literal acceptance bar (Phase 3 plan §22, "Sprint 46 (Dashboard)"): "one
// symbol lookup surfaces Structure + Liquidity + Multi-Timeframe +
// Probability + Regime + Risk without any additional navigation." Unlike
// TradingResearch.tsx (Sprints 40-48), which deliberately puts Liquidity
// behind its own on-demand tab (a disclosed cost-control choice, Sprint 45),
// this page fetches all five per-symbol signals concurrently and renders
// them together — no tabs, no additional clicks — because "no additional
// navigation" is this page's whole reason to exist. Portfolio Risk (Sprint
// 38/44) is portfolio-wide, not per-symbol, so it's shown as an always-
// visible summary alongside the per-symbol cards, satisfying the bar's own
// "...and Risk" clause without requiring a symbol to be searched first.
//
// Every card here is a condensed READ-ONLY summary, not a re-implementation
// of TradingResearch.tsx's full detail views (support/resistance list, full
// per-timeframe list, full probability cone table, full volume-profile
// list, the position-management form, the full journal/backtest CRUD) —
// duplicating those would mean duplicating their state/mutation logic, the
// exact thing this sprint's "do not duplicate calculations or business
// logic" instruction rules out. Each summary card links out to its own
// full, already-built page (Trading Research / Trading Journal / Trading
// Backtest) for management actions, reusing that page's own UI rather than
// re-implementing it here.
//
// Advisory/education only: this page never previews, schedules, or submits
// any order, and never touches a real brokerage account. Every SIMULATED
// data source is labeled exactly as its own originating card already
// labels it — this page fabricates nothing of its own.
//
// Phase 4, Sprint 54 — Cross-Engine Command Center (approved Phase 4 plan,
// Sprint 54; see docs/Phase-4-Master-Execution-Plan.md's Sprint 54 as-built
// note). Adds a "Cross-Engine Verdict" section pairing Engine 1's
// Investment Committee verdict (Phase 2, Sprint 17) with Engine 2's own
// technical read (the already-fetched Market Regime analysis, Sprint 36) —
// the Blueprint's own long-flagged "nice-to-have," deliberately deferred at
// this page's own Sprint 50 kickoff to keep that sprint bounded. Zero new
// engine calculations: the Engine 1 side is one more read of the existing,
// already-tested GET /stock-analyst/value/:symbol route (unused elsewhere
// in the frontend — StockResearch.tsx instead streams a narrated report via
// a heavier SSE endpoint, which this page deliberately does not need for a
// plain verdict read); the Engine 2 side reuses the `regime` object already
// fetched by the signal grid below, not a second fetch or a new
// computation.
//
// Phase 4, Sprint 55 — Macro/Regime Side-by-Side View (approved Phase 4
// plan, Sprint 55; see docs/Phase-4-Master-Execution-Plan.md's Sprint 55
// as-built note). Adds a "Macro / Regime Side-by-Side" section showing all
// 3 engines' own independent regime-shaped reads together: Engine 3's
// existing Market Briefing (lib/marketBriefing.ts, options-IV-derived,
// already had its own route/hook, GET /briefing — reused here read-only,
// same generated hook PortfolioAI.tsx's own richer LLM-narrated card
// already uses, but rendered as a condensed summary here, not a
// re-implementation of that card's own streaming/refresh logic); Engine 1's
// macro/interest-rate proxy (lib/investingMacro.ts, Phase 2 Sprint 26,
// date-seeded and genuinely deliberately independent of Engine 3's own
// regime read per that module's own doc comment — previously had no route
// at all, so this sprint added the one new thin pass-through route, GET
// /stock-analyst/macro, exposing already-tested, unmodified logic); and
// Engine 2's Market Regime (the same already-fetched `regime` object the
// Cross-Engine Verdict section above and the per-symbol grid below both
// already use — a third reuse of that one fetch, not a third fetch).
// Zero engine-logic merging: each card is independently attributable to
// its own originating engine, and none of the three values are combined,
// averaged, or reconciled into a new consolidated reading anywhere.
//
// Phase 5, Sprint 66 — Unified Portfolio Dashboard (approved Phase 5 plan,
// Sprint 66; see docs/Phase-5-Master-Execution-Plan.md's Sprint 66 as-built
// note). Adds a "Portfolio Overview" section pairing Engine 1's Portfolio
// Construction (target-weight stock holdings, Phase 2 Sprint 28,
// GET /portfolio-construction/portfolios, the same list the
// PortfolioConstruction.tsx page itself already fetches) with Engine 3's
// real trades-backed account (GET /portfolio/summary, the same summary
// PortfolioAI.tsx's own cockpit already fetches) — side by side only, per
// the project owner's own explicit decision: NO blended net-worth or
// combined-allocation computation, since a target-weight model and a live
// P&L ledger are structurally different things. Zero new backend routes,
// zero new engine calculations — both hooks were already generated and
// already used elsewhere in the frontend; this section is the first place
// either is fetched inside InstitutionalDashboard.tsx itself. Always
// visible, not gated by the page's per-symbol search (matching the
// existing Portfolio Risk section's own Sprint 50 precedent, since a
// portfolio isn't scoped to a single symbol lookup), positioned directly
// above that row so every portfolio-wide card sits together. Each card
// stays a condensed summary that links out to its own full page
// (/stock-analyst/portfolio-construction, /portfolio) for management
// actions, the same "link out, don't re-implement" pattern every other
// summary card on this page already follows.

import { useState } from "react";
import { Link } from "wouter";
import {
  useGetValueReport,
  getGetValueReportQueryKey,
  useGetMarketBriefing,
  getGetMarketBriefingQueryKey,
  useGetMacroContext,
  getGetMacroContextQueryKey,
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
  useGetTradingRisk,
  getGetTradingRiskQueryKey,
  useListTradingJournalEntries,
  getListTradingJournalEntriesQueryKey,
  useListTradingBacktestResults,
  getListTradingBacktestResultsQueryKey,
  useGetPortfolios,
  getGetPortfoliosQueryKey,
  useGetPortfolioSummary,
  getGetPortfolioSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fmtUsd,
  trendBadgeClass,
  TrendIcon,
  confidenceBadgeClass,
  agreementBadgeClass,
  regimeBadgeClass,
  volatilityBadgeClass,
  riskGradeBadgeClass,
  liquidityBandBadgeClass,
  pressureBadgeClass,
} from "@/lib/trading-format";
import {
  Activity,
  Layers,
  Gauge,
  Target,
  Droplets,
  Search,
  ShieldAlert,
  NotebookPen,
  History,
  MessageCircle,
  Users,
  Scale,
  Newspaper,
  Landmark,
  Briefcase,
  PieChart,
  ExternalLink,
} from "lucide-react";

// Bounded — a fast-scan summary, not a full history dump. The full lists
// live on Trading Journal / Trading Backtest, one link away.
const RECENT_ITEMS_LIMIT = 3;

function SkeletonCard({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

function ErrorCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

// Investment Committee verdicts are Buy/Hold/Wait — a different vocabulary
// than the Engine 2 badge helpers in trading-format.tsx (which are Engine
// 2's own trend/regime/liquidity vocabulary). Kept local rather than added
// to that shared module, since mixing Engine 1's vocabulary into an
// Engine-2-labeled file would blur the "each engine's own vocabulary"
// separation those helpers' own header comment already establishes.
function committeeVerdictBadgeClass(verdict: string): string {
  if (verdict === "Buy") return "border-emerald-500/40 text-emerald-400";
  if (verdict === "Wait") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

// Engine 3's own regime vocabulary (risk_on/neutral/risk_off, IV-derived) —
// kept local for the same reason as committeeVerdictBadgeClass above: a
// third engine's own vocabulary, not Engine 2's, so it doesn't belong in
// trading-format.tsx.
function briefingRegimeBadgeClass(regime: string): string {
  if (regime === "risk_on") return "border-emerald-500/40 text-emerald-400";
  if (regime === "risk_off") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

// Engine 1's own macro/rate-regime vocabulary (rising_rates/falling_rates/
// stable_rates, lib/investingMacro.ts) — likewise kept local, a fourth
// distinct vocabulary alongside Investment Committee's Buy/Hold/Wait and
// Market Briefing's risk_on/neutral/risk_off above.
function macroRegimeBadgeClass(regime: string): string {
  if (regime === "rising_rates") return "border-amber-500/40 text-amber-400";
  if (regime === "falling_rates") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

export default function InstitutionalDashboard() {
  const [inputValue, setInputValue] = useState("");
  const [symbol, setSymbol] = useState("");

  // Phase 4, Sprint 54 — Engine 1's side of the Cross-Engine Verdict.
  // Resolves concurrently with every Engine 2 signal below, for the same
  // symbol — the plain, non-streaming report route (GET
  // /stock-analyst/value/:symbol), not the heavier SSE narration endpoint
  // StockResearch.tsx uses, since this card only needs the already-computed
  // Investment Committee field, not narrated commentary.
  const {
    data: valueReport,
    isLoading: isValueReportLoading,
    isError: isValueReportError,
  } = useGetValueReport(symbol, {
    query: { queryKey: getGetValueReportQueryKey(symbol), enabled: !!symbol },
  });

  // Phase 4, Sprint 55 — Engine 3's and Engine 1's own regime reads for the
  // Macro/Regime Side-by-Side section. Both are global/market-wide, not
  // symbol-scoped, so — unlike every per-symbol hook on this page — they
  // fetch unconditionally (no `enabled` gate), the same always-fetched
  // pattern the portfolio-wide Risk/Journal/Backtest hooks below already
  // use. Engine 2's own regime read is not fetched again here — the
  // Macro/Regime section reuses the same `regime` object the per-symbol
  // grid below fetches once, a third read of one fetch, not a third fetch.
  const { data: marketBriefing, isLoading: isMarketBriefingLoading } = useGetMarketBriefing({
    query: { queryKey: getGetMarketBriefingQueryKey() },
  });
  const { data: macroContext, isLoading: isMacroContextLoading } = useGetMacroContext({
    query: { queryKey: getGetMacroContextQueryKey() },
  });

  // All five per-symbol signals resolve concurrently, none gated behind a
  // tab — this is the page's entire point ("without any additional
  // navigation").
  const { data: structure, isLoading: isStructureLoading, isError: isStructureError } = useGetTradingStructure(symbol, {
    query: { queryKey: getGetTradingStructureQueryKey(symbol), enabled: !!symbol },
  });
  const {
    data: multiTimeframe,
    isLoading: isMultiTimeframeLoading,
    isError: isMultiTimeframeError,
  } = useGetTradingMultiTimeframe(symbol, {
    query: { queryKey: getGetTradingMultiTimeframeQueryKey(symbol), enabled: !!symbol },
  });
  const { data: regime, isLoading: isRegimeLoading, isError: isRegimeError } = useGetTradingRegime(symbol, {
    query: { queryKey: getGetTradingRegimeQueryKey(symbol), enabled: !!symbol },
  });
  const {
    data: probability,
    isLoading: isProbabilityLoading,
    isError: isProbabilityError,
  } = useGetTradingProbability(symbol, {
    query: { queryKey: getGetTradingProbabilityQueryKey(symbol), enabled: !!symbol },
  });
  const { data: liquidity, isLoading: isLiquidityLoading, isError: isLiquidityError } = useGetTradingLiquidity(symbol, {
    query: { queryKey: getGetTradingLiquidityQueryKey(symbol), enabled: !!symbol },
  });

  // Portfolio-wide, not per-symbol — always visible, matching
  // TradingResearch.tsx's own Sprint 44 precedent for this exact hook.
  const { data: risk } = useGetTradingRisk({ query: { queryKey: getGetTradingRiskQueryKey() } });
  const { data: journalEntries } = useListTradingJournalEntries({
    query: { queryKey: getListTradingJournalEntriesQueryKey() },
  });
  const { data: backtestResults } = useListTradingBacktestResults({
    query: { queryKey: getListTradingBacktestResultsQueryKey() },
  });

  // Phase 5, Sprint 66 — Portfolio Overview. Portfolio-wide, not per-symbol
  // (like the risk/journal/backtest hooks above), so likewise always
  // fetched, no `enabled` gate. Neither hook is new — useGetPortfolios()
  // already powers PortfolioConstruction.tsx's own list, and
  // useGetPortfolioSummary() already powers PortfolioAI.tsx's own cockpit;
  // this is the first time either is fetched inside this page.
  const { data: constructionPortfolios } = useGetPortfolios({
    query: { queryKey: getGetPortfoliosQueryKey() },
  });
  const { data: optionsPortfolioSummary } = useGetPortfolioSummary({
    query: { queryKey: getGetPortfolioSummaryQueryKey() },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSymbol(inputValue.trim().toUpperCase());
  }

  const recentJournalEntries = (journalEntries ?? []).slice(0, RECENT_ITEMS_LIMIT);
  const recentBacktests = (backtestResults ?? []).slice(0, RECENT_ITEMS_LIMIT);
  const totalConstructionHoldings = (constructionPortfolios ?? []).reduce((sum, p) => sum + p.holdingsCount, 0);

  return (
    <div className="space-y-6 p-6" data-testid="page-institutional-dashboard">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Institutional Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          One-screen cross-engine overview — Engine 1's Investment Committee verdict, all 3 engines' own independent
          macro/regime reads side-by-side, and Engine 2's Structure, Multi-Timeframe, Regime, Probability, Liquidity,
          for a single symbol lookup — plus your own Portfolio Risk and a side-by-side view of Engine 1's Portfolio
          Construction and Engine 3's Options Income Portfolio (no blended net-worth figure — they're structurally
          different things). SIMULATED market data, advisory only. Never places an order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter a symbol, e.g. AAPL"
          className="max-w-xs"
          data-testid="input-dashboard-symbol"
        />
        <Button type="submit" data-testid="button-dashboard-search">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      {!symbol && (
        <p className="text-sm text-muted-foreground">
          Enter a symbol above to see Engine 1's Investment Committee verdict, Engine 2's technical read, and the full
          Engine 2 signal set at a glance.
        </p>
      )}

      {symbol && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="grid-cross-engine-verdict">
          {isValueReportLoading && <SkeletonCard icon={<Users className="h-4 w-4" />} title="Engine 1 — Investment Committee" />}
          {isValueReportError && (
            <ErrorCard
              icon={<Users className="h-4 w-4" />}
              title="Engine 1 — Investment Committee"
              message={`Could not resolve "${symbol}".`}
            />
          )}
          {valueReport && (
            <Card data-testid="card-dashboard-committee">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Engine 1 — Investment Committee
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {valueReport.dataSource}
                  </Badge>
                </div>
                <CardDescription>Consolidated Graham + Buffett + Tom Nash recommendation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={committeeVerdictBadgeClass(valueReport.investmentCommittee.consolidatedVerdict)}
                  >
                    {valueReport.investmentCommittee.consolidatedVerdict}
                  </Badge>
                  <Badge variant="outline" className={agreementBadgeClass(valueReport.investmentCommittee.agreement)}>
                    {valueReport.investmentCommittee.agreement.replace(/-/g, " ")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{valueReport.investmentCommittee.summary}</p>
              </CardContent>
            </Card>
          )}

          {isRegimeLoading && <SkeletonCard icon={<Scale className="h-4 w-4" />} title="Engine 2 — Technical Read" />}
          {isRegimeError && (
            <ErrorCard icon={<Scale className="h-4 w-4" />} title="Engine 2 — Technical Read" message={`Could not resolve "${symbol}".`} />
          )}
          {regime && (
            <Card data-testid="card-dashboard-technical-read">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scale className="h-4 w-4" />
                    Engine 2 — Technical Read
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {regime.dataSource}
                  </Badge>
                </div>
                <CardDescription>Structure + Multi-Timeframe + Liquidity, consolidated into one regime.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={regimeBadgeClass(regime.regimeLabel)}>
                    {regime.regimeLabel}
                  </Badge>
                  <Badge variant="outline" className={confidenceBadgeClass(regime.confidenceLevel)}>
                    {regime.confidenceLevel}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{regime.summary}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {symbol && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Macro / Regime Side-by-Side</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="grid-macro-regime">
            {isMarketBriefingLoading && <SkeletonCard icon={<Newspaper className="h-4 w-4" />} title="Engine 3 — Market Briefing" />}
            {marketBriefing && (
              <Card data-testid="card-dashboard-market-briefing">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Newspaper className="h-4 w-4" />
                    Engine 3 — Market Briefing
                  </CardTitle>
                  <CardDescription>Options-income context, options-IV-derived. Global, not symbol-specific.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={briefingRegimeBadgeClass(marketBriefing.briefing.regime)}>
                      {marketBriefing.briefing.regimeLabel}
                    </Badge>
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {marketBriefing.briefing.vixLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{marketBriefing.briefing.headline}</p>
                </CardContent>
              </Card>
            )}

            {isMacroContextLoading && <SkeletonCard icon={<Landmark className="h-4 w-4" />} title="Engine 1 — Macro Context" />}
            {macroContext && (
              <Card data-testid="card-dashboard-macro-context">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Landmark className="h-4 w-4" />
                      Engine 1 — Macro Context
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {macroContext.dataSource}
                    </Badge>
                  </div>
                  <CardDescription>Interest-rate proxy, date-seeded. Global, not symbol-specific.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="outline" className={macroRegimeBadgeClass(macroContext.regime)}>
                    {macroContext.regimeLabel}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{macroContext.summary}</p>
                </CardContent>
              </Card>
            )}

            {isRegimeLoading && <SkeletonCard icon={<Gauge className="h-4 w-4" />} title="Engine 2 — Market Regime" />}
            {isRegimeError && (
              <ErrorCard icon={<Gauge className="h-4 w-4" />} title="Engine 2 — Market Regime" message={`Could not resolve "${symbol}".`} />
            )}
            {regime && (
              <Card data-testid="card-dashboard-macro-regime-engine2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Gauge className="h-4 w-4" />
                      Engine 2 — Market Regime
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {regime.dataSource}
                    </Badge>
                  </div>
                  <CardDescription>Trend + liquidity + volatility, for {symbol}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={regimeBadgeClass(regime.regimeLabel)}>
                      {regime.regimeLabel}
                    </Badge>
                    <Badge variant="outline" className={volatilityBadgeClass(regime.volatilityRegime)}>
                      {regime.volatilityRegime} volatility
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{regime.summary}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {symbol && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="grid-signal-cards">
          {isStructureLoading && <SkeletonCard icon={<Activity className="h-4 w-4" />} title="Market Structure" />}
          {isStructureError && (
            <ErrorCard icon={<Activity className="h-4 w-4" />} title="Market Structure" message={`Could not resolve "${symbol}".`} />
          )}
          {structure && (
            <Card data-testid="card-dashboard-structure">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Market Structure
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {structure.dataSource}
                  </Badge>
                </div>
                <CardDescription>{fmtUsd(structure.currentPrice)} current price</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`flex items-center gap-1 ${trendBadgeClass(structure.trend)}`}>
                    <TrendIcon trend={structure.trend} />
                    {structure.trend}
                  </Badge>
                  <Badge variant="outline" className={confidenceBadgeClass(structure.confidenceLevel)}>
                    {structure.confidenceLevel}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{structure.summary}</p>
                <a
                  href={`/market-structure-workbench?symbol=${symbol}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  data-testid="link-open-market-structure-workbench"
                >
                  <ExternalLink className="h-3 w-3" /> Open full Market Structure Workbench
                </a>
              </CardContent>
            </Card>
          )}

          {isMultiTimeframeLoading && <SkeletonCard icon={<Layers className="h-4 w-4" />} title="Multi-Timeframe" />}
          {isMultiTimeframeError && (
            <ErrorCard icon={<Layers className="h-4 w-4" />} title="Multi-Timeframe" message={`Could not resolve "${symbol}".`} />
          )}
          {multiTimeframe && (
            <Card data-testid="card-dashboard-multi-timeframe">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-4 w-4" />
                    Multi-Timeframe
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {multiTimeframe.dataSource}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
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
                </div>
                <p className="text-sm text-muted-foreground">{multiTimeframe.summary}</p>
              </CardContent>
            </Card>
          )}

          {isRegimeLoading && <SkeletonCard icon={<Gauge className="h-4 w-4" />} title="Market Regime" />}
          {isRegimeError && (
            <ErrorCard icon={<Gauge className="h-4 w-4" />} title="Market Regime" message={`Could not resolve "${symbol}".`} />
          )}
          {regime && (
            <Card data-testid="card-dashboard-regime">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gauge className="h-4 w-4" />
                    Market Regime
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {regime.dataSource}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={regimeBadgeClass(regime.regimeLabel)}>
                    {regime.regimeLabel}
                  </Badge>
                  <Badge variant="outline" className={volatilityBadgeClass(regime.volatilityRegime)}>
                    {regime.volatilityRegime} volatility
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{regime.summary}</p>
              </CardContent>
            </Card>
          )}

          {isProbabilityLoading && <SkeletonCard icon={<Target className="h-4 w-4" />} title="Probability" />}
          {isProbabilityError && (
            <ErrorCard icon={<Target className="h-4 w-4" />} title="Probability" message={`Could not resolve "${symbol}".`} />
          )}
          {probability && (
            <Card data-testid="card-dashboard-probability">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" />
                    Probability
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {probability.dataSource}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {!probability.available ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-dashboard-probability-unavailable">
                    {probability.unavailableReason ?? "Probability cone unavailable for this symbol."}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {probability.volatilityAnnualizedPct !== null
                        ? `${probability.volatilityAnnualizedPct}% volatility`
                        : "Volatility unavailable"}
                    </Badge>
                    <Badge variant="outline" className={confidenceBadgeClass(probability.confidenceLevel)}>
                      {probability.confidenceLevel}
                    </Badge>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{probability.summary}</p>
              </CardContent>
            </Card>
          )}

          {isLiquidityLoading && <SkeletonCard icon={<Droplets className="h-4 w-4" />} title="Liquidity" />}
          {isLiquidityError && (
            <ErrorCard icon={<Droplets className="h-4 w-4" />} title="Liquidity" message={`Could not resolve "${symbol}".`} />
          )}
          {liquidity && (
            <Card data-testid="card-dashboard-liquidity">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Droplets className="h-4 w-4" />
                    Liquidity
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {liquidity.dataSource}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={liquidityBandBadgeClass(liquidity.liquidityBand)}>
                    {liquidity.liquidityBand} liquidity
                  </Badge>
                  <Badge variant="outline" className={pressureBadgeClass(liquidity.buySellPressure.direction)}>
                    {liquidity.buySellPressure.direction} pressure
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{liquidity.summary}</p>
                <a
                  href={`/liquidity-workbench?symbol=${symbol}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  data-testid="link-open-liquidity-workbench"
                >
                  <ExternalLink className="h-3 w-3" /> Open full Liquidity &amp; Session Workbench
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Portfolio Overview</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="grid-portfolio-overview">
          <Card data-testid="card-dashboard-portfolio-construction">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4" />
                Engine 1 — Portfolio Construction
              </CardTitle>
              <CardDescription>Target-weight stock allocations. Never a live P&L ledger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {constructionPortfolios && constructionPortfolios.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {constructionPortfolios.length} portfolio{constructionPortfolios.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {totalConstructionHoldings} holding{totalConstructionHoldings === 1 ? "" : "s"}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-dashboard-construction-empty">
                  No portfolios yet.
                </p>
              )}
              <Link href="/stock-analyst/portfolio-construction" className="text-xs text-primary hover:underline">
                Manage portfolios →
              </Link>
            </CardContent>
          </Card>

          <Card data-testid="card-dashboard-options-portfolio">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="h-4 w-4" />
                Engine 3 — Options Income Portfolio
              </CardTitle>
              <CardDescription>Real trades-backed account. Never a target-weight model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {optionsPortfolioSummary ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {fmtUsd(optionsPortfolioSummary.accountValue)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        optionsPortfolioSummary.totalPnl >= 0
                          ? "border-emerald-500/40 text-emerald-400"
                          : "border-rose-500/40 text-rose-400"
                      }
                    >
                      {fmtUsd(optionsPortfolioSummary.totalPnl)} P&L
                    </Badge>
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {optionsPortfolioSummary.openPositions} open position
                      {optionsPortfolioSummary.openPositions === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-dashboard-options-portfolio-empty">
                  No account activity yet.
                </p>
              )}
              <Link href="/portfolio" className="text-xs text-primary hover:underline">
                Manage portfolio →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card data-testid="card-dashboard-risk">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              Portfolio Risk
            </CardTitle>
            <CardDescription>Your own open trading positions — never places an order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {risk ? (
              <>
                <Badge variant="outline" className={riskGradeBadgeClass(risk.overall.label)}>
                  {risk.overall.label}
                </Badge>
                <p className="text-sm text-muted-foreground">{risk.overall.detail}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-dashboard-risk-empty">
                No risk analysis available yet — add a trading position to get started.
              </p>
            )}
            <Link href="/trading-research" className="text-xs text-primary hover:underline">
              Manage positions →
            </Link>
            <Link href="/trade-planning-studio" className="block text-xs text-primary hover:underline" data-testid="link-open-trade-planning-studio">
              Open Trade Planning &amp; Risk Studio →
            </Link>
            <Link href="/trading-ai-coach" className="block text-xs text-primary hover:underline" data-testid="link-open-trading-ai-coach">
              Open Institutional Trading AI Coach →
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="card-dashboard-journal">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4" />
              Recent Journal Reflections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentJournalEntries.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-dashboard-journal-empty">
                No journal entries yet.
              </p>
            )}
            {recentJournalEntries.length > 0 && (
              <ul className="space-y-1">
                {recentJournalEntries.map((e) => (
                  <li key={e.id} className="rounded-md border border-border px-2 py-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{e.title}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {e.mood}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/trading-journal" className="text-xs text-primary hover:underline">
              View journal →
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="card-dashboard-backtests">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Recent Backtests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentBacktests.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-dashboard-backtests-empty">
                No backtests run yet.
              </p>
            )}
            {recentBacktests.length > 0 && (
              <ul className="space-y-1">
                {recentBacktests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
                    <span>
                      {r.symbol} · {r.strategy}
                    </span>
                    <span className="text-muted-foreground">
                      {r.available && r.totalTrades > 0 && r.winRate !== null
                        ? `${(r.winRate * 100).toFixed(0)}% win`
                        : "no trades"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/trading-backtest" className="text-xs text-primary hover:underline">
              Run backtest →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-dashboard-coach">
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            Have a question about what you're seeing? Ask the AI Trade Coach on the Trading Research page.
          </div>
          <Link href="/trading-research">
            <Button type="button" variant="outline" size="sm" data-testid="button-dashboard-open-coach">
              Open AI Trade Coach
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
