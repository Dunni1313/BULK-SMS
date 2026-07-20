// Phase 27 — Institutional Liquidity & Session Workbench.
//
// An integration and workflow phase, not a rebuild of the existing
// Liquidity Engine (Sprint 35) or Session Service (Phase 25). Every
// liquidity band/pressure/volume-profile read on this page is computed by
// the already-shipped Liquidity Engine, reused exactly as
// TradingResearch.tsx/TradeWorkspace.tsx/MarketStructureWorkbench.tsx
// already call it. The Session Overview panel is a direct, unmodified
// reuse of Phase 25's own GET /trading/session/:symbol (activeSessionsAt()
// + today's realized high/low). The genuinely new pieces this phase are:
// (1) lib/trading/sessionWindows.ts — for each of the 4 real named
// sessions, its own most recent window's start/end/high/low/range/
// duration/data-freshness, plus which is active/previous/upcoming (pure
// timestamp math, reusing TRADING_SESSION_WINDOWS/activeSessionsAt
// unmodified); and (2) lib/tradingLiquidityTimeline.ts — a chronological
// liquidity/pressure timeline built by replaying the existing
// analyzeLiquidity() over rolling candle windows (zero new scoring),
// plus a plain statistical "Relative Liquidity" comparison and the
// full-sample volume profile as Key Liquidity Zones.
//
// Disclosed, honest data-coverage limitation (see docs/Session-Analysis.md):
// the existing SimulatedMarketDataProvider's own intraday candle
// generation only covers a stylized ~09:30-16:00 UTC business-hours
// window. Sydney (21:00-06:00 UTC) and Tokyo (00:00-09:00 UTC) never
// overlap that window, so their own high/low/candleCount honestly read
// null/0 in the Session High/Low Explorer and Session Comparison panels —
// the same "thin/empty sample -> honest empty result, never fabricated"
// rule every other engine in this codebase already follows, not a bug.
//
// Mirrors MarketStructureWorkbench.tsx's/TradeWorkspace.tsx's own
// established resizable-panel/deep-linking/keyboard-shortcut mechanics.
//
// Workflow: Select Instrument -> Review Market Structure -> Review
// Session -> Review Liquidity -> Compare Sessions -> Review Trade Plan ->
// Record Notes -> Consult AI Trading Coach -> Save Workspace.
//
// Deliberately deferred, per the approved scope: Order Block detection,
// Fair Value Gap detection, ICT/SMC/ASAD/Trader Bill logic, automated
// signals, automated execution. The AI Trading Coach panel explains
// existing liquidity/session outputs only — it reuses the exact same
// /trading/coach/ask/stream endpoint (Sprint 47/48, extended this phase to
// also ground on session data) whose own prompt already refuses to invent
// entries/stops/targets/directional calls; nothing about that endpoint's
// safety contract is modified.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTradingLiquidity,
  getGetTradingLiquidityQueryKey,
  useGetTradingSession,
  getGetTradingSessionQueryKey,
  useGetTradingSessionWindows,
  getGetTradingSessionWindowsQueryKey,
  useGetTradingLiquidityTimeline,
  getGetTradingLiquidityTimelineQueryKey,
  useGetTradingStructure,
  getGetTradingStructureQueryKey,
  useListTradingTradePlansForSymbol,
  getListTradingTradePlansForSymbolQueryKey,
  useCreateTradingTradePlan,
  useListTradingWorkspaceNotesForSymbol,
  getListTradingWorkspaceNotesForSymbolQueryKey,
  useCreateTradingWorkspaceNote,
  useDeleteTradingWorkspaceNote,
  type TradingTradePlanInputDirection,
} from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  fmtUsd,
  confidenceBadgeClass,
  liquidityBandBadgeClass,
  pressureBadgeClass,
} from "@/lib/trading-format";
import {
  Droplets,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  ClipboardList,
  StickyNote,
  MessageCircle,
  FileCheck2,
  ArrowUpDown,
  History,
  Trash2,
  Send,
  ExternalLink,
  Activity,
  BarChart3,
  Save,
} from "lucide-react";

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
    navigate(upper ? `/liquidity-workbench?symbol=${upper}` : "/liquidity-workbench");
  }

  return [symbol, setSymbol];
}

// Pure display helper — the 4 named sessions' own role vocabulary
// (active/previous/upcoming/other), a real structural fact from the
// engine's own timestamp math, never a new score or probability.
function sessionRoleBadgeClass(role: string): string {
  if (role === "active") return "border-emerald-500/40 text-emerald-400";
  if (role === "previous") return "border-border text-muted-foreground";
  if (role === "upcoming") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

function relativeLiquidityBadgeClass(relative: string): string {
  if (relative === "Above Average") return "border-emerald-500/40 text-emerald-400";
  if (relative === "Below Average") return "border-amber-500/40 text-amber-400";
  if (relative === "Average") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

export default function LiquidityWorkbench() {
  const [symbol, setSymbol] = useSymbolFromDeepLink();
  const [query, setQuery] = useState(symbol);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => setQuery(symbol), [symbol]);

  // Keyboard shortcuts, mirroring TradeWorkspace.tsx's/MarketStructureWorkbench.tsx's
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

  // ─── Review Market Structure (existing Market Structure Engine, reused
  // unmodified — a condensed read, the full Workbench lives on its own
  // page). ─────────────────────────────────────────────────────────────
  const { data: structure } = useGetTradingStructure(symbol, {
    query: { queryKey: getGetTradingStructureQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Session Overview (existing Session Service, Phase 25, reused
  // completely unmodified). ────────────────────────────────────────────
  const { data: session } = useGetTradingSession(symbol, {
    query: { queryKey: getGetTradingSessionQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Active/Previous/Upcoming Session Summary, Session High/Low
  // Explorer, Session Comparison (new this phase, lib/trading/sessionWindows.ts). ─
  const { data: sessionWindows, isLoading: sessionWindowsLoading } = useGetTradingSessionWindows(symbol, {
    query: { queryKey: getGetTradingSessionWindowsQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Liquidity Overview, Liquidity Band Explorer, Buy/Sell Pressure
  // Summary, Volume Profile Summary (existing Liquidity Engine, Sprint
  // 35/45, reused unmodified). ─────────────────────────────────────────
  const { data: liquidity, isLoading: liquidityLoading } = useGetTradingLiquidity(symbol, {
    query: { queryKey: getGetTradingLiquidityQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Liquidity Timeline (new this phase, lib/tradingLiquidityTimeline.ts). ─
  const { data: liquidityTimeline } = useGetTradingLiquidityTimeline(symbol, {
    query: { queryKey: getGetTradingLiquidityTimelineQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Session Notes (Phase 25's Workspace Notes, reused unmodified — the
  // same per-symbol notes stream every other Engine 2 surface shares). ──
  const { data: notes } = useListTradingWorkspaceNotesForSymbol(symbol, {
    query: { queryKey: getListTradingWorkspaceNotesForSymbolQueryKey(symbol), enabled: !!symbol },
  });
  const createNote = useCreateTradingWorkspaceNote();
  const deleteNote = useDeleteTradingWorkspaceNote();
  const [noteText, setNoteText] = useState("");

  function invalidateNotes() {
    queryClient.invalidateQueries({ queryKey: getListTradingWorkspaceNotesForSymbolQueryKey(symbol) });
  }

  function handleSaveNote(e?: React.FormEvent) {
    e?.preventDefault();
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
  // thesis pre-filled from the Liquidity Engine's own already-computed
  // summary text). ─────────────────────────────────────────────────────
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
    if (liquidity && !planThesis) setPlanThesis(liquidity.summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidity]);

  function handleCreatePlanFromLiquidity(e?: React.FormEvent) {
    e?.preventDefault();
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
          toast({ title: "Trade plan linked", description: "Your liquidity/session findings were saved into a new trade plan." });
        },
      },
    );
  }

  function handleSaveWorkspace() {
    let didSomething = false;
    if (noteText.trim()) {
      handleSaveNote();
      didSomething = true;
    }
    if (planThesis.trim() && Number(planRiskPct) && Number(planEntry) && Number(planStop) && Number(planTarget)) {
      handleCreatePlanFromLiquidity();
      didSomething = true;
    }
    if (didSomething) {
      toast({ title: "Workspace saved", description: "Pending notes and/or trade plan were saved." });
    } else {
      toast({ title: "Nothing to save", description: "No pending note or trade plan form was filled in." });
    }
  }

  // ─── AI Trading Coach — explains existing liquidity/session outputs
  // only. Reuses Sprint 47/48's own /trading/coach/ask/stream endpoint and
  // streamCoach() SSE client unmodified; the endpoint's own prompt already
  // refuses to invent entries/stops/targets/directional recommendations. ──
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

  // ─── Evidence Panel — surfaces the concrete supporting facts already
  // computed by each reused engine, verbatim. ─────────────────────────────
  const evidenceItems = useMemo(() => {
    const items: { label: string; detail: string }[] = [];
    if (structure) items.push({ label: "Market Structure", detail: structure.trendDetail });
    if (sessionWindows) items.push({ label: "Session Windows", detail: sessionWindows.summary });
    if (liquidity) items.push({ label: "Liquidity Overview", detail: liquidity.summary });
    if (liquidityTimeline) items.push({ label: "Liquidity Timeline", detail: liquidityTimeline.summary });
    return items;
  }, [structure, sessionWindows, liquidity, liquidityTimeline]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6" data-testid="page-liquidity-workbench">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Droplets className="w-5 h-5 text-sky-400" /> Liquidity &amp; Session Workbench
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
        <ResizablePanelGroup direction="horizontal" autoSaveId="liquidity-workbench-layout">
          {!leftCollapsed && (
            <>
              <ResizablePanel defaultSize={22} minSize={15} maxSize={34} data-testid="workbench-left-panel">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {/* Liquidity Overview */}
                    <Card data-testid="panel-liquidity-overview">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Droplets className="h-4 w-4" /> Liquidity Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {!symbol && <p className="text-xs text-muted-foreground">Select an instrument to view its liquidity.</p>}
                        {symbol && liquidityLoading && !liquidity && <Skeleton className="h-10 w-full" />}
                        {symbol && liquidity && (
                          <>
                            <p className="text-sm font-semibold">{fmtUsd(liquidity.currentPrice)}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={liquidityBandBadgeClass(liquidity.liquidityBand)}>
                                {liquidity.liquidityBand} liquidity
                              </Badge>
                              <Badge variant="outline" className={pressureBadgeClass(liquidity.buySellPressure.direction)}>
                                {liquidity.buySellPressure.direction}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{liquidity.summary}</p>
                            <a
                              href={`/trading-research?symbol=${symbol}`}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                              data-testid="link-open-trading-research"
                            >
                              <ExternalLink className="h-3 w-3" /> Full Liquidity detail in Trading Research
                            </a>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Session Overview — existing Session Service, reused unmodified */}
                    <Card data-testid="panel-session-overview">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Session Overview
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
                              {sessionWindows?.overlap && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                                  overlap
                                </Badge>
                              )}
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

                    {/* Active Session Summary */}
                    <Card data-testid="panel-active-session-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Active Session</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!sessionWindows && <p className="text-muted-foreground">Not yet reviewed.</p>}
                        {sessionWindows && !sessionWindows.activeSession && (
                          <p className="text-muted-foreground">No session currently open.</p>
                        )}
                        {sessionWindows?.activeSession && (
                          <>
                            <Badge variant="outline" className={sessionRoleBadgeClass("active")}>
                              {sessionWindows.activeSession.label}
                            </Badge>
                            <p className="text-muted-foreground">
                              {sessionWindows.activeSession.high != null && sessionWindows.activeSession.low != null
                                ? `Range: ${fmtUsd(sessionWindows.activeSession.low)} - ${fmtUsd(sessionWindows.activeSession.high)}`
                                : "No candle data available in this window"}
                            </p>
                            <p className="text-muted-foreground">Duration: {sessionWindows.activeSession.durationHours}h</p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Previous Session Summary */}
                    <Card data-testid="panel-previous-session-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Previous Session</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!sessionWindows && <p className="text-muted-foreground">Not yet reviewed.</p>}
                        {sessionWindows && !sessionWindows.previousSession && (
                          <p className="text-muted-foreground">No previous session identified.</p>
                        )}
                        {sessionWindows?.previousSession && (
                          <>
                            <Badge variant="outline" className={sessionRoleBadgeClass("previous")}>
                              {sessionWindows.previousSession.label}
                            </Badge>
                            <p className="text-muted-foreground">
                              {sessionWindows.previousSession.high != null && sessionWindows.previousSession.low != null
                                ? `Range: ${fmtUsd(sessionWindows.previousSession.low)} - ${fmtUsd(sessionWindows.previousSession.high)}`
                                : "No candle data available in this window"}
                            </p>
                            <p className="text-muted-foreground">
                              Freshness:{" "}
                              {sessionWindows.previousSession.freshnessMinutes != null
                                ? `${sessionWindows.previousSession.freshnessMinutes} min ago`
                                : "unavailable"}
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Buy / Sell Pressure Summary */}
                    <Card data-testid="panel-buy-sell-pressure">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Buy / Sell Pressure</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!liquidity && <p className="text-muted-foreground">Not yet reviewed.</p>}
                        {liquidity && (
                          <>
                            <Badge variant="outline" className={pressureBadgeClass(liquidity.buySellPressure.direction)}>
                              {liquidity.buySellPressure.direction} ({liquidity.buySellPressure.buyPct}% buy / {liquidity.buySellPressure.sellPct}% sell)
                            </Badge>
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
                <span className="text-xs text-muted-foreground">Session Explorer → Liquidity Band → Volume Profile → Comparison → Timeline</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setRightCollapsed((v) => !v)} aria-label="Toggle right panel" data-testid="toggle-right-panel">
                  {rightCollapsed ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {!symbol && (
                    <p className="text-sm text-muted-foreground">
                      Select an instrument above to begin: review the session explorer, then liquidity bands, volume
                      profile, session comparison, and the liquidity timeline.
                    </p>
                  )}

                  {/* Session High / Low Explorer */}
                  {symbol && (
                    <Card data-testid="panel-session-high-low-explorer">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4" /> Session High / Low Explorer
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Sydney and Tokyo may honestly show no candle data — the SIMULATED data model's own intraday
                          coverage is limited to business hours. See docs/Session-Analysis.md.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {sessionWindowsLoading && !sessionWindows && <Skeleton className="h-24 w-full" />}
                        {sessionWindows && (
                          <ul className="space-y-1">
                            {sessionWindows.sessions.map((s) => (
                              <li
                                key={s.name}
                                className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs"
                                data-testid={`row-session-${s.name}`}
                              >
                                <span className="font-medium">{s.label}</span>
                                <Badge variant="outline" className={`text-[10px] ${sessionRoleBadgeClass(s.role)}`}>
                                  {s.role}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {s.high != null && s.low != null ? `${fmtUsd(s.low)} - ${fmtUsd(s.high)}` : "no candle data"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Liquidity Band Explorer */}
                  {symbol && (
                    <Card data-testid="panel-liquidity-band-explorer">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" /> Liquidity Band Explorer
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {!liquidity && <p className="text-xs text-muted-foreground">Not yet reviewed.</p>}
                        {liquidity && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={liquidityBandBadgeClass(liquidity.liquidityBand)}>
                              Current: {liquidity.liquidityBand}
                            </Badge>
                            <Badge variant="outline" className={confidenceBadgeClass(liquidity.confidenceLevel)}>
                              {liquidity.confidenceLevel} confidence
                            </Badge>
                            {liquidityTimeline && (
                              <Badge variant="outline" className={relativeLiquidityBadgeClass(liquidityTimeline.relativeLiquidity)} data-testid="badge-relative-liquidity">
                                Relative: {liquidityTimeline.relativeLiquidity}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Volume Profile Summary */}
                  {symbol && liquidity && (
                    <Card data-testid="panel-volume-profile-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Volume Profile Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {liquidity.volumeProfile.length === 0 && (
                          <p className="text-xs text-muted-foreground">No repeated volume level detected in this sample.</p>
                        )}
                        {liquidity.volumeProfile.length > 0 && (
                          <ul className="space-y-1">
                            {liquidity.volumeProfile.map((level, i) => (
                              <li key={i} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs" data-testid={`row-volume-level-${i}`}>
                                <span>{fmtUsd(level.price)}</span>
                                <span className="text-muted-foreground">{level.pctOfTotal}% of volume</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Session Comparison */}
                  {symbol && sessionWindows && (
                    <Card data-testid="panel-session-comparison">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Session Comparison
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground border-b border-border">
                                <th className="py-1 pr-2">Session</th>
                                <th className="py-1 pr-2">Role</th>
                                <th className="py-1 pr-2">Duration</th>
                                <th className="py-1 pr-2">Range</th>
                                <th className="py-1 pr-2">Candles</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionWindows.sessions.map((s) => (
                                <tr key={s.name} className="border-b border-border/50" data-testid={`row-comparison-${s.name}`}>
                                  <td className="py-1 pr-2 font-medium">{s.label}</td>
                                  <td className="py-1 pr-2">{s.role}</td>
                                  <td className="py-1 pr-2 text-muted-foreground">{s.durationHours}h</td>
                                  <td className="py-1 pr-2 text-muted-foreground">
                                    {s.range != null ? fmtUsd(s.range) : "—"}
                                  </td>
                                  <td className="py-1 pr-2 text-muted-foreground">{s.candleCount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Liquidity Timeline */}
                  {symbol && (
                    <Card data-testid="panel-liquidity-timeline">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <History className="h-4 w-4" /> Liquidity Timeline
                        </CardTitle>
                        <CardDescription className="text-xs">{liquidityTimeline?.summary}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {liquidityTimeline && liquidityTimeline.points.length === 0 && (
                          <p className="text-xs text-muted-foreground">No liquidity timeline points detected in this sample.</p>
                        )}
                        {liquidityTimeline && liquidityTimeline.points.length > 0 && (
                          <ul className="space-y-1 max-h-56 overflow-y-auto">
                            {liquidityTimeline.points.map((p, i) => (
                              <li key={i} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs" data-testid={`row-timeline-point-${i}`}>
                                <span className="text-muted-foreground">{new Date(p.periodEnd).toLocaleDateString()}</span>
                                <Badge variant="outline" className={`text-[10px] ${liquidityBandBadgeClass(p.liquidityBand)}`}>
                                  {p.liquidityBand}
                                </Badge>
                                <span>{p.buySellDirection}</span>
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

                    {/* Session Notes */}
                    <Card data-testid="panel-session-notes">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <StickyNote className="h-4 w-4" /> Session Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <form onSubmit={handleSaveNote} className="space-y-2">
                          <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder={symbol ? `Note about ${symbol}'s session/liquidity…` : "Select an instrument to add a note"}
                            disabled={!symbol}
                            className="min-h-[50px] text-sm"
                            data-testid="input-session-note-text"
                          />
                          <Button type="submit" size="sm" disabled={!symbol || !noteText.trim()} data-testid="button-save-session-note">
                            Save Note
                          </Button>
                        </form>
                        {notes && notes.length > 0 && (
                          <ul className="space-y-1.5">
                            {notes.map((n) => (
                              <li key={n.id} data-testid={`row-session-note-${n.id}`} className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-xs">
                                <span className="text-muted-foreground">{n.note}</span>
                                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => handleDeleteNote(n.id)} data-testid={`button-delete-session-note-${n.id}`}>
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
                        <CardDescription className="text-xs">Thesis pre-filled from the Liquidity Overview's own summary.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <form onSubmit={handleCreatePlanFromLiquidity} className="grid grid-cols-2 gap-2">
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

                    {/* AI Trading Coach — liquidity/session explanations only */}
                    <Card data-testid="panel-workbench-coach">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" /> AI Trading Coach
                        </CardTitle>
                        <CardDescription className="text-xs">Explains existing liquidity/session outputs only — never a signal or directional call.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {coachHistory.length === 0 && !coachStreamingAnswer && (
                          <p className="text-xs text-muted-foreground" data-testid="workbench-coach-empty">
                            {symbol ? `Ask something like "Which session has the deepest liquidity for ${symbol}?"` : "Select an instrument to consult the coach."}
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
                            placeholder="Ask about liquidity or sessions…"
                            disabled={coachAsking || !symbol}
                            data-testid="workbench-coach-input"
                          />
                          <Button type="submit" size="sm" disabled={!coachQuestion.trim() || coachAsking || !symbol} data-testid="workbench-coach-submit">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </CardContent>
                    </Card>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center gap-1.5"
                      onClick={handleSaveWorkspace}
                      disabled={!symbol}
                      data-testid="button-save-workspace"
                    >
                      <Save className="h-3.5 w-3.5" /> Save Workspace
                    </Button>
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
