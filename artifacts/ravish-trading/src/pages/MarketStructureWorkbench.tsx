// Phase 26 — Institutional Market Structure Workbench.
//
// An integration and analysis-workflow phase, not a rebuild of Engine 2.
// Every trend/zone/confidence read on this page is computed by the
// already-shipped Market Structure Engine (Sprint 33), Multi-Timeframe
// Engine (Sprint 34), Liquidity Engine (Sprint 35), and Session Service
// (Phase 25) — reused exactly as TradingResearch.tsx/TradeWorkspace.tsx
// already call them. The only genuinely new pieces this phase are:
// (1) an optional ?interval= timeframe selector on the Structure Overview
// panel and an optional ?timeframes= selector on the Multi-Timeframe
// Matrix (both real, pre-existing server-side overrides that had never
// been exposed to any frontend caller before — see src/lib/structure-
// query.ts); (2) the new Structure Shift Timeline (lib/tradingStructureTimeline.ts,
// a pure reuse of the existing Market Structure scorer replayed over an
// expanding candle window — zero new scoring); and (3) this page's own
// client-side display-state labeling (src/lib/structure-display-state.ts,
// a pure relabeling of already-computed trend/confidence/agreement enums
// — never a new score or probability).
//
// Mirrors TradeWorkspace.tsx's own established resizable-panel / deep-
// linking / keyboard-shortcut mechanics (Phase 25, itself modeled on
// InstitutionalWorkspace.tsx, Phase 17). "Saved layouts" = autoSaveId
// panel-size persistence, the same established meaning of that phrase in
// this codebase.
//
// Workflow: Select Instrument -> Select Timeframe -> Review Current
// Structure -> Inspect Swing Sequence -> Compare Timeframes -> Review
// Support and Resistance -> Review Session Context -> Record Structure
// Notes -> Link Findings to a Trade Plan -> Open Risk or Journal panels.
//
// Deliberately deferred, per the approved scope: Order Block detection,
// Fair Value Gap detection, ICT/SMC/ASAD/Trader Bill logic, automated
// signals, automated execution. The AI Trading Coach panel explains
// existing structure outputs only — it reuses the exact same
// /trading/coach/ask/stream endpoint (Sprint 47/48) whose own prompt
// already refuses to invent entries/stops/targets/directional calls;
// nothing about that endpoint is modified this phase.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTradingLiquidity,
  getGetTradingLiquidityQueryKey,
  useGetTradingSession,
  getGetTradingSessionQueryKey,
  useListTradingTradePlansForSymbol,
  getListTradingTradePlansForSymbolQueryKey,
  useCreateTradingTradePlan,
  useListTradingWorkspaceNotesForSymbol,
  getListTradingWorkspaceNotesForSymbolQueryKey,
  useCreateTradingWorkspaceNote,
  useDeleteTradingWorkspaceNote,
  type TradingTradePlanInputDirection,
} from "@workspace/api-client-react";
import {
  useTradingStructureWithParams,
  useTradingMultiTimeframeWithParams,
  useTradingStructureTimeline,
} from "@/lib/structure-query";
import { streamCoach } from "@/lib/coach-stream";
import { Markdown } from "@/components/ui/markdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  fmtUsd,
  trendBadgeClass,
  TrendIcon,
  confidenceBadgeClass,
  agreementBadgeClass,
  liquidityBandBadgeClass,
  pressureBadgeClass,
} from "@/lib/trading-format";
import {
  deriveStructureDisplayState,
  deriveTrendAlignmentState,
  structureDisplayStateBadgeClass,
} from "@/lib/structure-display-state";
import {
  Wrench,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  Droplets,
  Layers,
  Clock,
  ClipboardList,
  StickyNote,
  MessageCircle,
  FileCheck2,
  ListTree,
  ArrowUpDown,
  History,
  Trash2,
  Send,
  ExternalLink,
} from "lucide-react";

const REAL_TIMEFRAMES = ["1m", "5m", "15m", "1h", "1D"] as const;
type RealTimeframe = (typeof REAL_TIMEFRAMES)[number];
const DEFAULT_MATRIX_TIMEFRAMES: RealTimeframe[] = ["15m", "1h", "1D"];

function useSymbolFromDeepLink(): [string, (s: string) => void] {
  const search = useSearch();
  const [, navigate] = useLocation();
  const initial = useMemo(() => new URLSearchParams(search).get("symbol")?.toUpperCase() ?? "", [search]);
  const [symbol, setSymbolState] = useState(initial);

  useEffect(() => {
    if (initial && initial !== symbol) setSymbolState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function setSymbol(next: string) {
    const upper = next.trim().toUpperCase();
    setSymbolState(upper);
    navigate(upper ? `/market-structure-workbench?symbol=${upper}` : "/market-structure-workbench");
  }

  return [symbol, setSymbol];
}

export default function MarketStructureWorkbench() {
  const [symbol, setSymbol] = useSymbolFromDeepLink();
  const [query, setQuery] = useState(symbol);
  const [overviewInterval, setOverviewInterval] = useState<RealTimeframe>("1D");
  const [matrixTimeframes, setMatrixTimeframes] = useState<RealTimeframe[]>(DEFAULT_MATRIX_TIMEFRAMES);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => setQuery(symbol), [symbol]);

  // Keyboard shortcuts, mirroring TradeWorkspace.tsx's/InstitutionalWorkspace.tsx's
  // own established convention exactly.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && typing) {
        (target as HTMLElement).blur();
      } else if (e.key === "[" && !typing) {
        setLeftCollapsed((v) => !v);
      } else if (e.key === "]" && !typing) {
        setRightCollapsed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim()) setSymbol(query.trim());
  }

  function toggleMatrixTimeframe(tf: RealTimeframe) {
    setMatrixTimeframes((prev) => {
      if (prev.includes(tf)) return prev.filter((t) => t !== tf);
      return REAL_TIMEFRAMES.filter((t) => prev.includes(t) || t === tf);
    });
  }

  // ─── Structure Overview (existing Market Structure Engine, Sprint 33/40) ──
  const { data: structure, isLoading: structureLoading } = useTradingStructureWithParams(symbol, overviewInterval, 90);

  // ─── Multi-Timeframe Structure Matrix (existing Multi-Timeframe Engine,
  // Sprint 34/41 — Phase 26 added the ?timeframes= override this page is
  // the first to exercise). ────────────────────────────────────────────────
  const { data: matrix, isLoading: matrixLoading } = useTradingMultiTimeframeWithParams(symbol, matrixTimeframes);

  // ─── Structure Shift Timeline (new this phase, zero new scoring). ──────
  const { data: timeline } = useTradingStructureTimeline(symbol, overviewInterval, 90);
  const swingSequenceEvents = useMemo(
    () => (timeline?.events ?? []).filter((e) => ["higher_high", "higher_low", "lower_high", "lower_low"].includes(e.type)),
    [timeline],
  );
  const shiftEvents = useMemo(
    () =>
      (timeline?.events ?? []).filter((e) =>
        ["trend_change", "range_entry", "range_exit", "support_test", "resistance_test"].includes(e.type),
      ),
    [timeline],
  );

  // ─── Session Structure Summary (Phase 25's Session Service, reused) ────
  const { data: session } = useGetTradingSession(symbol, {
    query: { queryKey: getGetTradingSessionQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Liquidity Context (existing Liquidity Engine, Sprint 35/45) ──────
  const { data: liquidity } = useGetTradingLiquidity(symbol, {
    query: { queryKey: getGetTradingLiquidityQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Structure Notes (Phase 25's Workspace Notes, reused unmodified) ───
  const { data: notes } = useListTradingWorkspaceNotesForSymbol(symbol, {
    query: { queryKey: getListTradingWorkspaceNotesForSymbolQueryKey(symbol), enabled: !!symbol },
  });
  const createNote = useCreateTradingWorkspaceNote();
  const deleteNote = useDeleteTradingWorkspaceNote();
  const [noteText, setNoteText] = useState("");

  function invalidateNotes() {
    queryClient.invalidateQueries({ queryKey: getListTradingWorkspaceNotesForSymbolQueryKey(symbol) });
  }

  function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || !noteText.trim()) return;
    createNote.mutate(
      { data: { symbol, note: noteText.trim() } },
      { onSuccess: () => { invalidateNotes(); setNoteText(""); } },
    );
  }

  function handleDeleteNote(id: number) {
    deleteNote.mutate({ id }, { onSuccess: invalidateNotes });
  }

  // ─── Trade Plan Integration (Phase 25's Trade Plans, reused unmodified —
  // the thesis field is pre-seeded from the Structure Engine's own already-
  // computed summary text, an honest starting point the user can edit). ──
  const { data: tradePlans } = useListTradingTradePlansForSymbol(symbol, {
    query: { queryKey: getListTradingTradePlansForSymbolQueryKey(symbol), enabled: !!symbol },
  });
  const createTradePlan = useCreateTradingTradePlan();
  const [planDirection, setPlanDirection] = useState<TradingTradePlanInputDirection>("long");
  const [planThesis, setPlanThesis] = useState("");
  const [planRiskPct, setPlanRiskPct] = useState("1");
  const [planEntry, setPlanEntry] = useState("");
  const [planStop, setPlanStop] = useState("");
  const [planTarget, setPlanTarget] = useState("");

  useEffect(() => {
    if (structure && !planThesis) setPlanThesis(structure.summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure]);

  function handleCreatePlanFromStructure(e: React.FormEvent) {
    e.preventDefault();
    const accountRiskPct = Number(planRiskPct);
    const entryPrice = Number(planEntry);
    const stopPrice = Number(planStop);
    const targetPrice = Number(planTarget);
    if (!symbol || !planThesis.trim() || !accountRiskPct || !entryPrice || !stopPrice || !targetPrice) return;
    createTradePlan.mutate(
      { data: { symbol, direction: planDirection, thesis: planThesis.trim(), accountRiskPct, entryPrice, stopPrice, targetPrice } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradingTradePlansForSymbolQueryKey(symbol) });
          toast({ title: "Trade plan linked", description: "Your structure findings were saved into a new trade plan." });
        },
      },
    );
  }

  // ─── AI Trading Coach — explains existing structure outputs only. Reuses
  // Sprint 47/48's own /trading/coach/ask/stream endpoint and streamCoach()
  // SSE client unmodified; the endpoint's own prompt already refuses to
  // invent entries/stops/targets/directional recommendations. ─────────────
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

  // ─── Trend Alignment Summary & Range/Consolidation Summary — pure
  // display-state relabeling of already-computed enums, zero new scoring. ─
  const singleTimeframeState = structure ? deriveStructureDisplayState(structure.trend, structure.confidenceLevel) : null;
  const alignmentState = matrix ? deriveTrendAlignmentState(matrix.trendAgreement, matrix.dominantTrend, matrix.confidenceLevel) : null;

  const bestSupport = structure?.zones.filter((z) => z.kind === "support").sort((a, b) => b.strength - a.strength)[0] ?? null;
  const bestResistance = structure?.zones.filter((z) => z.kind === "resistance").sort((a, b) => b.strength - a.strength)[0] ?? null;

  // ─── Evidence Panel — surfaces the concrete supporting facts already
  // computed by each reused engine, verbatim. ─────────────────────────────
  const evidenceItems = useMemo(() => {
    const items: { label: string; detail: string }[] = [];
    if (structure) items.push({ label: "Structure Overview", detail: structure.trendDetail });
    if (matrix) items.push({ label: "Multi-Timeframe Matrix", detail: matrix.summary });
    if (timeline) items.push({ label: "Structure Shift Timeline", detail: timeline.summary });
    if (liquidity) items.push({ label: "Liquidity Context", detail: liquidity.summary });
    return items;
  }, [structure, matrix, timeline, liquidity]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6" data-testid="page-market-structure-workbench">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-400" /> Market Structure Workbench
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-1.5" data-testid="workbench-permanent-labels">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
              Institutional Trading Engine
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
              Advisory Only
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
              SIMULATED
            </Badge>
          </div>
        </div>
        <form onSubmit={runSearch} className="flex items-center gap-2 w-full max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="Select an instrument (e.g. AAPL)…  Press / to focus"
              className="h-8 pl-8 text-xs"
              data-testid="workbench-symbol-search"
            />
          </div>
          <Button type="submit" size="sm" className="h-8 text-xs" data-testid="workbench-symbol-search-submit">
            Select
          </Button>
        </form>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" autoSaveId="market-structure-workbench-layout">
          {!leftCollapsed && (
            <>
              <ResizablePanel defaultSize={22} minSize={15} maxSize={34} data-testid="workbench-left-panel">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {/* Structure Overview */}
                    <Card data-testid="panel-structure-overview">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Structure Overview
                        </CardTitle>
                        <div className="flex items-center gap-1.5 pt-1">
                          <label className="text-[10px] text-muted-foreground">Timeframe</label>
                          <select
                            value={overviewInterval}
                            onChange={(e) => setOverviewInterval(e.target.value as RealTimeframe)}
                            className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]"
                            data-testid="select-overview-interval"
                          >
                            {REAL_TIMEFRAMES.map((tf) => (
                              <option key={tf} value={tf}>
                                {tf}
                              </option>
                            ))}
                          </select>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {!symbol && <p className="text-xs text-muted-foreground">Select an instrument to view its structure.</p>}
                        {symbol && structureLoading && !structure && <Skeleton className="h-10 w-full" />}
                        {symbol && structure && (
                          <>
                            <p className="text-sm font-semibold">{fmtUsd(structure.currentPrice)}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={`flex items-center gap-1 ${trendBadgeClass(structure.trend)}`}>
                                <TrendIcon trend={structure.trend} /> {structure.trend}
                              </Badge>
                              {singleTimeframeState && (
                                <Badge variant="outline" className={structureDisplayStateBadgeClass(singleTimeframeState)} data-testid="badge-structure-display-state">
                                  {singleTimeframeState}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{structure.trendDetail}</p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Range and Consolidation Summary */}
                    <Card data-testid="panel-range-consolidation">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4" /> Range &amp; Consolidation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!structure && <p className="text-muted-foreground">Not yet reviewed.</p>}
                        {structure && structure.trend !== "range" && (
                          <p className="text-muted-foreground">Not currently consolidating — structure reads {structure.trend}.</p>
                        )}
                        {structure && structure.trend === "range" && (
                          <p className="text-muted-foreground">
                            Consolidating{bestSupport ? ` above ${fmtUsd(bestSupport.price)} support` : ""}
                            {bestResistance ? ` below ${fmtUsd(bestResistance.price)} resistance` : ""}.{" "}
                            {structure.confidenceExplanation}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Trend Alignment Summary */}
                    <Card data-testid="panel-trend-alignment">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4" /> Trend Alignment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        {!matrix && <p className="text-muted-foreground">Not yet reviewed.</p>}
                        {matrix && (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={agreementBadgeClass(matrix.trendAgreement)}>
                                {matrix.trendAgreement}
                              </Badge>
                              {alignmentState && (
                                <Badge variant="outline" className={structureDisplayStateBadgeClass(alignmentState)} data-testid="badge-alignment-display-state">
                                  {alignmentState}
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground">{matrix.summary}</p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Session Structure Summary */}
                    <Card data-testid="panel-session-structure">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Session Structure
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!session && <p className="text-muted-foreground">Select an instrument to see session data.</p>}
                        {session && (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {session.activeSessions.length === 0 && <span className="text-muted-foreground">No sessions currently open</span>}
                              {session.activeSessions.map((s) => (
                                <Badge key={s} variant="outline" className="text-[10px]">
                                  {s.replace("_", " ")}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-muted-foreground">
                              {session.sessionHigh != null && session.sessionLow != null
                                ? `Today's range: ${fmtUsd(session.sessionLow)} - ${fmtUsd(session.sessionHigh)}`
                                : "No session range available yet"}
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Liquidity Context */}
                    <Card data-testid="panel-liquidity-context">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Droplets className="h-4 w-4" /> Liquidity Context
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!liquidity && <p className="text-muted-foreground">Not yet reviewed.</p>}
                        {liquidity && (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={liquidityBandBadgeClass(liquidity.liquidityBand)}>
                                {liquidity.liquidityBand} liquidity
                              </Badge>
                              <Badge variant="outline" className={pressureBadgeClass(liquidity.buySellPressure.direction)}>
                                {liquidity.buySellPressure.direction}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">{liquidity.summary}</p>
                            <a
                              href={`/liquidity-workbench?symbol=${symbol}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                              data-testid="link-open-liquidity-workbench"
                            >
                              <ExternalLink className="h-3 w-3" /> Open full Liquidity &amp; Session Workbench
                            </a>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={leftCollapsed && rightCollapsed ? 100 : rightCollapsed ? 78 : leftCollapsed ? 78 : 54} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setLeftCollapsed((v) => !v)} aria-label="Toggle left panel" data-testid="toggle-left-panel">
                  {leftCollapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
                </Button>
                <span className="text-xs text-muted-foreground">Compare Timeframes → Swings → Support/Resistance → Timeline</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setRightCollapsed((v) => !v)} aria-label="Toggle right panel" data-testid="toggle-right-panel">
                  {rightCollapsed ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {!symbol && (
                    <p className="text-sm text-muted-foreground">
                      Select an instrument above to begin: review current structure, then compare timeframes, inspect the
                      swing sequence, and review support/resistance.
                    </p>
                  )}

                  {/* Multi-Timeframe Structure Matrix */}
                  {symbol && (
                    <Card data-testid="panel-structure-matrix">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4" /> Multi-Timeframe Structure Matrix
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Only the timeframes the Market Data Provider actually supports (1m/5m/15m/1h/1D) — no Monthly/Weekly/4H
                          exists in this codebase yet.
                        </CardDescription>
                        <div className="flex flex-wrap gap-3 pt-1">
                          {REAL_TIMEFRAMES.map((tf) => (
                            <label key={tf} className="flex items-center gap-1.5 text-xs">
                              <Checkbox
                                checked={matrixTimeframes.includes(tf)}
                                onCheckedChange={() => toggleMatrixTimeframe(tf)}
                                data-testid={`checkbox-matrix-${tf}`}
                              />
                              {tf}
                            </label>
                          ))}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {matrixLoading && !matrix && <Skeleton className="h-24 w-full" />}
                        {matrix && matrix.timeframes.length === 0 && (
                          <p className="text-xs text-muted-foreground">Select at least one timeframe above.</p>
                        )}
                        {matrix && matrix.timeframes.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted-foreground border-b border-border">
                                  <th className="py-1 pr-2">Timeframe</th>
                                  <th className="py-1 pr-2">Trend</th>
                                  <th className="py-1 pr-2">Latest Swing</th>
                                  <th className="py-1 pr-2">Key Support</th>
                                  <th className="py-1 pr-2">Key Resistance</th>
                                  <th className="py-1 pr-2">Freshness</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matrix.timeframes.map((tf) => {
                                  const s = tf.structure;
                                  const latestSwing = s.swingPoints[s.swingPoints.length - 1];
                                  const support = s.zones.filter((z) => z.kind === "support").sort((a, b) => b.strength - a.strength)[0];
                                  const resistance = s.zones.filter((z) => z.kind === "resistance").sort((a, b) => b.strength - a.strength)[0];
                                  return (
                                    <tr key={tf.interval} className="border-b border-border/50" data-testid={`row-matrix-${tf.interval}`}>
                                      <td className="py-1 pr-2 font-medium">{tf.interval}</td>
                                      <td className="py-1 pr-2">
                                        <Badge variant="outline" className={`${trendBadgeClass(s.trend)} text-[10px]`}>
                                          {s.trend}
                                        </Badge>
                                      </td>
                                      <td className="py-1 pr-2 text-muted-foreground">
                                        {latestSwing ? `${latestSwing.kind} @ ${fmtUsd(latestSwing.price)}` : "none"}
                                      </td>
                                      <td className="py-1 pr-2 text-muted-foreground">{support ? fmtUsd(support.price) : "none"}</td>
                                      <td className="py-1 pr-2 text-muted-foreground">{resistance ? fmtUsd(resistance.price) : "none"}</td>
                                      <td className="py-1 pr-2 text-muted-foreground">
                                        {s.candleCount} candles, {s.confidenceLevel}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="flex items-center gap-2 pt-2">
                              <Badge variant="outline" className={agreementBadgeClass(matrix.trendAgreement)}>
                                {matrix.trendAgreement}
                                {matrix.dominantTrend ? ` — ${matrix.dominantTrend}` : ""}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground" data-testid="text-structural-conflict">
                                {matrix.dominantTrend ? "Aligned" : "Structural conflict — no dominant trend"}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Swing High / Swing Low Explorer */}
                  {symbol && structure && (
                    <Card data-testid="panel-swing-explorer">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ListTree className="h-4 w-4" /> Swing High / Swing Low Explorer
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {structure.swingPoints.length === 0 && (
                          <p className="text-xs text-muted-foreground">No swing points detected in this sample.</p>
                        )}
                        {structure.swingPoints.length > 0 && (
                          <ul className="space-y-1 max-h-48 overflow-y-auto">
                            {structure.swingPoints.map((p, i) => (
                              <li key={i} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs">
                                <span className="text-muted-foreground">{new Date(p.time).toLocaleString()}</span>
                                <Badge variant="outline" className="text-[10px]">{p.kind}</Badge>
                                <span>{fmtUsd(p.price)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* HH/HL/LH/LL sequence */}
                  {symbol && (
                    <Card data-testid="panel-hh-hl-sequence">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4" /> Higher High / Higher Low / Lower High / Lower Low Sequence
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {swingSequenceEvents.length === 0 && (
                          <p className="text-xs text-muted-foreground">No sequence events detected yet.</p>
                        )}
                        {swingSequenceEvents.length > 0 && (
                          <ul className="space-y-1 max-h-48 overflow-y-auto">
                            {swingSequenceEvents.map((e, i) => (
                              <li key={i} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs" data-testid={`row-sequence-event-${i}`}>
                                <span className="text-muted-foreground">{new Date(e.time).toLocaleDateString()}</span>
                                <span className="font-medium">{e.label}</span>
                                <span>{fmtUsd(e.price)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Support and Resistance Zone Explorer */}
                  {symbol && structure && (
                    <Card data-testid="panel-zone-explorer">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" /> Support &amp; Resistance Zone Explorer
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {structure.zones.length === 0 && <p className="text-xs text-muted-foreground">No repeated zone detected in this sample.</p>}
                        {structure.zones.length > 0 && (
                          <ul className="space-y-1">
                            {structure.zones.map((z, i) => (
                              <li key={i} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs" data-testid={`row-zone-${i}`}>
                                <Badge variant="outline" className={z.kind === "support" ? "border-emerald-500/40 text-emerald-400" : "border-rose-500/40 text-rose-400"}>
                                  {z.kind}
                                </Badge>
                                <span>{fmtUsd(z.price)}</span>
                                <span className="text-muted-foreground">{z.strength} touches</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Structure Shift Timeline */}
                  {symbol && (
                    <Card data-testid="panel-structure-timeline">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <History className="h-4 w-4" /> Structure Shift Timeline
                        </CardTitle>
                        <CardDescription className="text-xs">{timeline?.summary}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {shiftEvents.length === 0 && <p className="text-xs text-muted-foreground">No structure shift events detected in this sample.</p>}
                        {shiftEvents.length > 0 && (
                          <ul className="space-y-1 max-h-56 overflow-y-auto">
                            {shiftEvents.map((e, i) => (
                              <li key={i} className="rounded-md border border-border px-2 py-1 text-xs" data-testid={`row-timeline-event-${i}`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{e.label}</span>
                                  <span className="text-muted-foreground">{new Date(e.time).toLocaleDateString()}</span>
                                </div>
                                <p className="text-muted-foreground">{e.detail}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          {!rightCollapsed && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={24} minSize={16} maxSize={36} data-testid="workbench-right-panel">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {/* Evidence Panel */}
                    <Card data-testid="panel-evidence">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4" /> Evidence
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {evidenceItems.length === 0 && <p className="text-xs text-muted-foreground">No supporting evidence gathered yet.</p>}
                        <ul className="space-y-2">
                          {evidenceItems.map((item) => (
                            <li key={item.label} className="text-xs">
                              <span className="font-medium">{item.label}: </span>
                              <span className="text-muted-foreground">{item.detail}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Structure Notes */}
                    <Card data-testid="panel-structure-notes">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <StickyNote className="h-4 w-4" /> Structure Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <form onSubmit={handleSaveNote} className="space-y-2">
                          <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder={symbol ? `Note about ${symbol}'s structure…` : "Select an instrument to add a note"}
                            disabled={!symbol}
                            className="min-h-[50px] text-sm"
                            data-testid="input-structure-note-text"
                          />
                          <Button type="submit" size="sm" disabled={!symbol || !noteText.trim()} data-testid="button-save-structure-note">
                            Save Note
                          </Button>
                        </form>
                        {notes && notes.length > 0 && (
                          <ul className="space-y-1.5">
                            {notes.map((n) => (
                              <li key={n.id} data-testid={`row-structure-note-${n.id}`} className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-xs">
                                <span className="text-muted-foreground">{n.note}</span>
                                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => handleDeleteNote(n.id)} data-testid={`button-delete-structure-note-${n.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(!notes || notes.length === 0) && symbol && <p className="text-xs text-muted-foreground">No notes yet for {symbol}.</p>}
                      </CardContent>
                    </Card>

                    {/* Trade Plan Integration */}
                    <Card data-testid="panel-trade-plan-integration">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" /> Trade Plan Integration
                        </CardTitle>
                        <CardDescription className="text-xs">Thesis pre-filled from the Structure Overview's own summary.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <form onSubmit={handleCreatePlanFromStructure} className="grid grid-cols-2 gap-2">
                          <Textarea
                            value={planThesis}
                            onChange={(e) => setPlanThesis(e.target.value)}
                            className="col-span-2 min-h-[50px] text-xs"
                            data-testid="input-workbench-plan-thesis"
                          />
                          <select
                            value={planDirection}
                            onChange={(e) => setPlanDirection(e.target.value as TradingTradePlanInputDirection)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            data-testid="select-workbench-plan-direction"
                          >
                            <option value="long">Long</option>
                            <option value="short">Short</option>
                          </select>
                          <Input type="number" value={planRiskPct} onChange={(e) => setPlanRiskPct(e.target.value)} placeholder="Risk %" className="h-8 text-xs" data-testid="input-workbench-plan-risk" />
                          <Input type="number" value={planEntry} onChange={(e) => setPlanEntry(e.target.value)} placeholder="Entry" className="h-8 text-xs" data-testid="input-workbench-plan-entry" />
                          <Input type="number" value={planStop} onChange={(e) => setPlanStop(e.target.value)} placeholder="Stop" className="h-8 text-xs" data-testid="input-workbench-plan-stop" />
                          <Input type="number" value={planTarget} onChange={(e) => setPlanTarget(e.target.value)} placeholder="Target" className="h-8 text-xs col-span-2" data-testid="input-workbench-plan-target" />
                          <Button type="submit" size="sm" className="col-span-2" data-testid="button-link-trade-plan">
                            Link to Trade Plan
                          </Button>
                        </form>
                        {tradePlans && tradePlans.length > 0 && (
                          <p className="text-xs text-muted-foreground">{tradePlans.length} plan(s) already linked to {symbol}.</p>
                        )}
                        <a
                          href={symbol ? `/trade-workspace?symbol=${symbol}` : "/trade-workspace"}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          data-testid="link-open-trade-workspace"
                        >
                          <ExternalLink className="h-3 w-3" /> Open Risk &amp; Journal in Trade Workspace
                        </a>
                        <a
                          href={symbol ? `/trade-planning-studio?symbol=${symbol}` : "/trade-planning-studio"}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          data-testid="link-open-trade-planning-studio"
                        >
                          <ExternalLink className="h-3 w-3" /> Open full Trade Planning &amp; Risk Studio
                        </a>
                      </CardContent>
                    </Card>

                    {/* AI Trading Coach — structure explanations only */}
                    <Card data-testid="panel-workbench-coach">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" /> AI Trading Coach
                        </CardTitle>
                        <CardDescription className="text-xs">Explains existing structure outputs only — never a signal or directional call.</CardDescription>
                        <a
                          href={symbol ? `/trading-ai-coach?symbol=${symbol}&coach=structure` : "/trading-ai-coach"}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          data-testid="link-open-trading-ai-coach"
                        >
                          <ExternalLink className="h-3 w-3" /> Open full Institutional Trading AI Coach
                        </a>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {coachHistory.length === 0 && !coachStreamingAnswer && (
                          <p className="text-xs text-muted-foreground" data-testid="workbench-coach-empty">
                            {symbol ? `Ask something like "Why is ${symbol} in a range right now?"` : "Select an instrument to consult the coach."}
                          </p>
                        )}
                        {(coachHistory.length > 0 || coachStreamingAnswer) && (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1" data-testid="workbench-coach-history">
                            {coachHistory.map((turn, i) => (
                              <div key={i} className="space-y-1">
                                <p className="text-xs font-medium text-foreground/90">Q: {turn.question}</p>
                                <div className="border-l border-border pl-2 text-xs text-muted-foreground">
                                  <Markdown className="inline text-xs">{turn.answer}</Markdown>
                                </div>
                              </div>
                            ))}
                            {coachAsking && (
                              <p className="border-l border-border pl-2 text-xs text-muted-foreground" data-testid="workbench-coach-loading">
                                {coachStreamingAnswer || "thinking…"}
                              </p>
                            )}
                          </div>
                        )}
                        <form onSubmit={handleAskCoach} className="flex gap-2">
                          <Input
                            value={coachQuestion}
                            onChange={(e) => setCoachQuestion(e.target.value)}
                            placeholder="Ask about this structure…"
                            disabled={coachAsking || !symbol}
                            data-testid="workbench-coach-input"
                          />
                          <Button type="submit" size="sm" disabled={!coachQuestion.trim() || coachAsking || !symbol} data-testid="workbench-coach-submit">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
