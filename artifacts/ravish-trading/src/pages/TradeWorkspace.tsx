// Phase 25 — Institutional Trade Workspace.
//
// This is an orchestration and workflow layer, not a new engine. It
// creates ZERO new market-analysis logic, ZERO new scoring, and duplicates
// NO existing business logic — every analytical panel below reuses an
// already-shipped Engine 2 hook exactly as it exists on TradingResearch.tsx
// (Market Structure, Multi-Timeframe, Liquidity, Portfolio Risk), plus the
// AI Trade Coach's own streamCoach() SSE client (Sprint 47/48) and Trading
// Journal's own list/create hooks (Sprint 39/46) — none of that logic is
// re-implemented here, only re-composed into one guided workflow. The only
// genuinely new pieces this phase are: (1) the Trade Plan / Workspace Notes
// / Session backend surfaces (real persistence for a concept that was
// in-memory-only since Phase 24, per that phase's own "extract/persist on
// the second real consumer" precedent — this page IS that consumer), and
// (2) this page's own client-side Trade Checklist composition
// (src/lib/trade-checklist.ts), a pure read of already-fetched panel data.
//
// Replaces Phase 24's static, zero-API-call placeholder (which only showed
// illustrative JSON examples of the domain model) with a real, interactive,
// resizable-panel workspace mirroring InstitutionalWorkspace.tsx's own
// established layout/keyboard-shortcut/deep-linking mechanics (Phase 17).
// "Saved layouts" is realized the same way InstitutionalWorkspace.tsx
// realizes it — ResizablePanelGroup's own autoSaveId persists panel sizes
// across sessions — rather than introducing a second, heavier named-
// layout-configuration concept (ResearchTerminal.tsx's own distinct
// "Saved Layouts" feature, built for a different, multi-symbol-set page).
//
// Workflow: Select Instrument -> Review Structure -> Review Liquidity ->
// Review Multi-Timeframe Analysis -> Create Trade Plan -> Review Risk ->
// Record Notes -> Consult AI Trading Coach -> Save Workspace. All within
// this one page.
//
// Deliberately deferred, per the approved scope: Order Block detection,
// Fair Value Gap detection, ICT/SMC logic, any named strategy, automated
// signals, automated execution. Advisory/education only — this page never
// previews, schedules, or submits any order.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTradingStructure,
  getGetTradingStructureQueryKey,
  useGetTradingMultiTimeframe,
  getGetTradingMultiTimeframeQueryKey,
  useGetTradingLiquidity,
  getGetTradingLiquidityQueryKey,
  useGetTradingRisk,
  getGetTradingRiskQueryKey,
  useGetTradingSession,
  getGetTradingSessionQueryKey,
  useListTradingTradePlansForSymbol,
  getListTradingTradePlansForSymbolQueryKey,
  useCreateTradingTradePlan,
  useUpdateTradingTradePlan,
  useDeleteTradingTradePlan,
  useListTradingWorkspaceNotesForSymbol,
  getListTradingWorkspaceNotesForSymbolQueryKey,
  useCreateTradingWorkspaceNote,
  useDeleteTradingWorkspaceNote,
  useListTradingJournalEntries,
  getListTradingJournalEntriesQueryKey,
  useCreateTradingJournalEntry,
  type TradingTradePlanInputDirection,
  type TradingTradePlanUpdateStatus,
  type TradingTradePlan,
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
  trendBadgeClass,
  TrendIcon,
  confidenceBadgeClass,
  agreementBadgeClass,
  liquidityBandBadgeClass,
  pressureBadgeClass,
  riskGradeBadgeClass,
} from "@/lib/trading-format";
import { buildTradeChecklist, type ChecklistItemStatus } from "@/lib/trade-checklist";
import {
  LayoutTemplate,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  Droplets,
  Layers,
  ClipboardList,
  ShieldAlert,
  NotebookPen,
  MessageCircle,
  StickyNote,
  Clock,
  ListChecks,
  FileCheck2,
  Send,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
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
    navigate(upper ? `/trade-workspace?symbol=${upper}` : "/trade-workspace");
  }

  return [symbol, setSymbol];
}

function checklistBadgeClass(status: ChecklistItemStatus): string {
  if (status === "pass") return "border-emerald-500/40 text-emerald-400";
  if (status === "warn") return "border-amber-500/40 text-amber-400";
  if (status === "fail") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

function ChecklistIcon({ status }: { status: ChecklistItemStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (status === "fail") return <XCircle className="h-3.5 w-3.5" />;
  return <HelpCircle className="h-3.5 w-3.5" />;
}

interface TradePlanFormState {
  direction: TradingTradePlanInputDirection;
  thesis: string;
  accountRiskPct: string;
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
}

const EMPTY_PLAN_FORM: TradePlanFormState = {
  direction: "long",
  thesis: "",
  accountRiskPct: "1",
  entryPrice: "",
  stopPrice: "",
  targetPrice: "",
};

export default function TradeWorkspace() {
  const [symbol, setSymbol] = useSymbolFromDeepLink();
  const [query, setQuery] = useState(symbol);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => setQuery(symbol), [symbol]);

  // Keyboard shortcuts, mirroring InstitutionalWorkspace.tsx's own
  // established convention exactly: "/" focuses the symbol search,
  // "Escape" blurs it, "[" / "]" collapse or expand the left/right panels.
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

  // ─── Reused Engine 2 analytical panels (Structure/Multi-Timeframe/
  // Liquidity/Session) — same hooks TradingResearch.tsx already uses,
  // fetched eagerly here since this workspace's own workflow explicitly
  // names "Review Structure -> Review Liquidity -> Review Multi-Timeframe"
  // as sequential steps a user takes on every visit, not an optional,
  // cost-deferred tab. ───────────────────────────────────────────────────
  const { data: structure, isLoading: structureLoading } = useGetTradingStructure(symbol, {
    query: { queryKey: getGetTradingStructureQueryKey(symbol), enabled: !!symbol },
  });
  const { data: multiTimeframe, isLoading: multiTimeframeLoading } = useGetTradingMultiTimeframe(symbol, {
    query: { queryKey: getGetTradingMultiTimeframeQueryKey(symbol), enabled: !!symbol },
  });
  const { data: liquidity, isLoading: liquidityLoading } = useGetTradingLiquidity(symbol, {
    query: { queryKey: getGetTradingLiquidityQueryKey(symbol), enabled: !!symbol },
  });
  const { data: session } = useGetTradingSession(symbol, {
    query: { queryKey: getGetTradingSessionQueryKey(symbol), enabled: !!symbol },
  });
  const { data: risk } = useGetTradingRisk({ query: { queryKey: getGetTradingRiskQueryKey() } });

  // ─── Trade Plan Panel (new this phase) ────────────────────────────────
  const { data: tradePlans } = useListTradingTradePlansForSymbol(symbol, {
    query: { queryKey: getListTradingTradePlansForSymbolQueryKey(symbol), enabled: !!symbol },
  });
  const createTradePlan = useCreateTradingTradePlan();
  const updateTradePlan = useUpdateTradingTradePlan();
  const deleteTradePlan = useDeleteTradingTradePlan();
  const [planForm, setPlanForm] = useState<TradePlanFormState>(EMPTY_PLAN_FORM);
  const currentPlan: TradingTradePlan | undefined = tradePlans?.[0];

  function invalidateTradePlans() {
    queryClient.invalidateQueries({ queryKey: getListTradingTradePlansForSymbolQueryKey(symbol) });
  }

  function handleCreateTradePlan(e?: React.FormEvent) {
    e?.preventDefault();
    const accountRiskPct = Number(planForm.accountRiskPct);
    const entryPrice = Number(planForm.entryPrice);
    const stopPrice = Number(planForm.stopPrice);
    const targetPrice = Number(planForm.targetPrice);
    if (!symbol || !planForm.thesis.trim() || !accountRiskPct || !entryPrice || !stopPrice || !targetPrice) return;

    createTradePlan.mutate(
      {
        data: {
          symbol,
          direction: planForm.direction,
          thesis: planForm.thesis.trim(),
          accountRiskPct,
          entryPrice,
          stopPrice,
          targetPrice,
          accountValue: risk?.accountValue ?? undefined,
        },
      },
      {
        onSuccess: () => {
          invalidateTradePlans();
          setPlanForm(EMPTY_PLAN_FORM);
          toast({ title: "Trade plan saved" });
        },
      },
    );
  }

  function handleTransitionPlan(id: number, status: TradingTradePlanUpdateStatus) {
    updateTradePlan.mutate({ id, data: { status } }, { onSuccess: invalidateTradePlans });
  }

  function handleDeletePlan(id: number) {
    deleteTradePlan.mutate({ id }, { onSuccess: invalidateTradePlans });
  }

  // ─── Notes Panel (new this phase) ─────────────────────────────────────
  const { data: workspaceNotes } = useListTradingWorkspaceNotesForSymbol(symbol, {
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
      {
        onSuccess: () => {
          invalidateNotes();
          setNoteText("");
        },
      },
    );
  }

  function handleDeleteNote(id: number) {
    deleteNote.mutate({ id }, { onSuccess: invalidateNotes });
  }

  // ─── Journal Panel — reuses Sprint 39/46's own Trading Journal CRUD
  // exactly, a condensed recent-entries view + quick-add, linking out to
  // the full /trading-journal page for full management (the same "link
  // out, don't duplicate" precedent every other summary panel in this
  // codebase follows). trading_journal_entries has no symbol column of
  // its own (see lib/db/src/schema/tradingJournalEntries.ts), so entries
  // are shown globally, newest-first, not filtered by symbol — an honest
  // limitation, not a fabricated filter. ─────────────────────────────────
  const { data: journalEntries } = useListTradingJournalEntries({
    query: { queryKey: getListTradingJournalEntriesQueryKey() },
  });
  const createJournalEntry = useCreateTradingJournalEntry();
  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");

  function handleAddJournalEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!journalTitle.trim() || !journalContent.trim()) return;
    createJournalEntry.mutate(
      { data: { title: journalTitle.trim(), content: journalContent.trim(), mood: "neutral" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTradingJournalEntriesQueryKey() });
          setJournalTitle("");
          setJournalContent("");
        },
      },
    );
  }

  // ─── AI Trading Coach Panel — reuses Sprint 47/48's own POST
  // /trading/coach/ask/stream route and the exact streamCoach() SSE client
  // TradingResearch.tsx's own coach panel already established, unmodified.
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

  // ─── Trade Checklist (new this phase) — a pure, client-side composition
  // over already-fetched panel data, zero new scoring. ───────────────────
  const checklist = useMemo(
    () => buildTradeChecklist({ structure, multiTimeframe, liquidity, risk, tradePlan: currentPlan }),
    [structure, multiTimeframe, liquidity, risk, currentPlan],
  );

  // ─── Evidence Panel — surfaces the concrete supporting facts already
  // computed by each reused engine, verbatim. Zero new computation: every
  // line is a direct read of an already-computed summary/detail string. ──
  const evidenceItems = useMemo(() => {
    const items: { label: string; detail: string }[] = [];
    if (structure) items.push({ label: "Market Structure", detail: structure.trendDetail });
    if (multiTimeframe) items.push({ label: "Multi-Timeframe", detail: multiTimeframe.summary });
    if (liquidity) items.push({ label: "Liquidity", detail: liquidity.summary });
    if (risk) items.push({ label: "Portfolio Risk", detail: risk.overall.detail });
    if (currentPlan) items.push({ label: "Trade Plan Thesis", detail: currentPlan.thesis });
    return items;
  }, [structure, multiTimeframe, liquidity, risk, currentPlan]);

  // ─── Save Workspace — the workflow's final step. Persists whatever is
  // genuinely pending: an in-progress trade plan form (if filled in but
  // not yet submitted) and/or unsaved note text. Never silently discards
  // either — each is saved via the exact same mutation its own panel's
  // Save button would use. ───────────────────────────────────────────────
  function handleSaveWorkspace() {
    let savedSomething = false;
    if (planForm.thesis.trim() && planForm.entryPrice && planForm.stopPrice && planForm.targetPrice) {
      handleCreateTradePlan();
      savedSomething = true;
    }
    if (noteText.trim()) {
      handleSaveNote();
      savedSomething = true;
    }
    toast({
      title: savedSomething ? "Workspace saved" : "Nothing pending to save",
      description: savedSomething
        ? "Your trade plan and/or notes have been persisted."
        : "Create a trade plan or write a note first.",
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6" data-testid="page-trade-workspace">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-400" /> Institutional Trade Workspace
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-1.5" data-testid="trade-workspace-permanent-labels">
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
        <div className="flex items-center gap-2">
          <form onSubmit={runSearch} className="flex items-center gap-2 w-full max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                placeholder="Select an instrument (e.g. AAPL)…  Press / to focus"
                className="h-8 pl-8 text-xs"
                data-testid="workspace-symbol-search"
              />
            </div>
            <Button type="submit" size="sm" className="h-8 text-xs" data-testid="workspace-symbol-search-submit">
              Select
            </Button>
          </form>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSaveWorkspace}
            disabled={!symbol}
            data-testid="button-save-workspace"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Workspace
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" autoSaveId="trade-workspace-layout">
          {!leftCollapsed && (
            <>
              <ResizablePanel defaultSize={20} minSize={14} maxSize={32} data-testid="workspace-left-panel">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {/* Instrument Overview */}
                    <Card data-testid="panel-instrument-overview">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Instrument Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        {!symbol && <p className="text-muted-foreground text-xs">No instrument selected yet.</p>}
                        {symbol && (
                          <>
                            <p className="font-semibold">{symbol}</p>
                            {structure && (
                              <p className="text-muted-foreground text-xs">
                                {fmtUsd(structure.currentPrice)} · {structure.dataSource}
                              </p>
                            )}
                            {!structure && structureLoading && <Skeleton className="h-4 w-24" />}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Session Summary */}
                    <Card data-testid="panel-session-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Session Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        {!session && <p className="text-muted-foreground text-xs">Select an instrument to see session data.</p>}
                        {session && (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {session.activeSessions.length === 0 && (
                                <span className="text-xs text-muted-foreground">No sessions currently open</span>
                              )}
                              {session.activeSessions.map((s) => (
                                <Badge key={s} variant="outline" className="text-[10px]">
                                  {s.replace("_", " ")}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {session.sessionHigh != null && session.sessionLow != null
                                ? `Today's range: ${fmtUsd(session.sessionLow)} - ${fmtUsd(session.sessionHigh)}`
                                : "No session range available yet"}
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Trade Checklist */}
                    <Card data-testid="panel-trade-checklist">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ListChecks className="h-4 w-4" /> Trade Checklist
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5">
                          {checklist.map((item) => (
                            <li key={item.id} className="flex items-start gap-2 text-xs" data-testid={`checklist-item-${item.id}`}>
                              <span className={checklistBadgeClass(item.status)}>
                                <ChecklistIcon status={item.status} />
                              </span>
                              <span>
                                <span className="font-medium">{item.label}</span>
                                <span className="block text-muted-foreground">{item.detail}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Evidence Panel */}
                    <Card data-testid="panel-evidence">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4" /> Evidence
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {evidenceItems.length === 0 && (
                          <p className="text-xs text-muted-foreground">No supporting evidence gathered yet.</p>
                        )}
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
                  </div>
                </ScrollArea>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={leftCollapsed && rightCollapsed ? 100 : rightCollapsed ? 78 : leftCollapsed ? 78 : 56} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setLeftCollapsed((v) => !v)}
                  aria-label="Toggle left panel"
                  data-testid="toggle-left-panel"
                >
                  {leftCollapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
                </Button>
                <span className="text-xs text-muted-foreground">Structure → Liquidity → Multi-Timeframe → Trade Plan → Risk</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setRightCollapsed((v) => !v)}
                  aria-label="Toggle right panel"
                  data-testid="toggle-right-panel"
                >
                  {rightCollapsed ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {!symbol && (
                    <p className="text-sm text-muted-foreground">
                      Select an instrument above to begin: review structure, liquidity, and multi-timeframe confluence,
                      then create a trade plan.
                    </p>
                  )}

                  {/* Market Structure Summary */}
                  {symbol && structureLoading && !structure && (
                    <Card>
                      <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                      <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                    </Card>
                  )}
                  {symbol && structure && (
                    <Card data-testid="panel-market-structure">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Market Structure Summary
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {structure.interval} interval, {structure.candleCount} candles
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`flex items-center gap-1 ${trendBadgeClass(structure.trend)}`}>
                            <TrendIcon trend={structure.trend} /> {structure.trend}
                          </Badge>
                          <Badge variant="outline" className={confidenceBadgeClass(structure.confidenceLevel)}>
                            {structure.confidenceLevel} confidence
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{structure.trendDetail}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Liquidity Summary */}
                  {symbol && liquidityLoading && !liquidity && (
                    <Card>
                      <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                      <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                    </Card>
                  )}
                  {symbol && liquidity && (
                    <Card data-testid="panel-liquidity">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Droplets className="h-4 w-4" /> Liquidity Summary
                        </CardTitle>
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
                      </CardContent>
                    </Card>
                  )}

                  {/* Multi-Timeframe Summary */}
                  {symbol && multiTimeframeLoading && !multiTimeframe && (
                    <Card>
                      <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                      <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                    </Card>
                  )}
                  {symbol && multiTimeframe && (
                    <Card data-testid="panel-multi-timeframe">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4" /> Multi-Timeframe Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {multiTimeframe.dominantTrend ? (
                            <Badge variant="outline" className={trendBadgeClass(multiTimeframe.dominantTrend)}>
                              {multiTimeframe.dominantTrend}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-border text-muted-foreground">
                              No dominant trend
                            </Badge>
                          )}
                          <Badge variant="outline" className={agreementBadgeClass(multiTimeframe.trendAgreement)}>
                            {multiTimeframe.trendAgreement} agreement
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{multiTimeframe.summary}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Trade Plan Panel */}
                  {symbol && (
                    <Card data-testid="panel-trade-plan">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" /> Trade Plan
                        </CardTitle>
                        <CardDescription className="text-xs">
                          A human-authored pre-trade plan. Position size and R:R are pure arithmetic, never a signal.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <form onSubmit={handleCreateTradePlan} className="grid grid-cols-2 gap-2">
                          <div className="space-y-1 col-span-2">
                            <label className="text-xs text-muted-foreground">Thesis</label>
                            <Textarea
                              value={planForm.thesis}
                              onChange={(e) => setPlanForm({ ...planForm, thesis: e.target.value })}
                              placeholder="Why this trade, right now?"
                              className="min-h-[60px] text-sm"
                              data-testid="input-plan-thesis"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Direction</label>
                            <select
                              value={planForm.direction}
                              onChange={(e) =>
                                setPlanForm({ ...planForm, direction: e.target.value as TradingTradePlanInputDirection })
                              }
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                              data-testid="select-plan-direction"
                            >
                              <option value="long">Long</option>
                              <option value="short">Short</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Account Risk %</label>
                            <Input
                              type="number"
                              value={planForm.accountRiskPct}
                              onChange={(e) => setPlanForm({ ...planForm, accountRiskPct: e.target.value })}
                              data-testid="input-plan-risk-pct"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Entry Price</label>
                            <Input
                              type="number"
                              value={planForm.entryPrice}
                              onChange={(e) => setPlanForm({ ...planForm, entryPrice: e.target.value })}
                              data-testid="input-plan-entry-price"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Stop Price</label>
                            <Input
                              type="number"
                              value={planForm.stopPrice}
                              onChange={(e) => setPlanForm({ ...planForm, stopPrice: e.target.value })}
                              data-testid="input-plan-stop-price"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Target Price</label>
                            <Input
                              type="number"
                              value={planForm.targetPrice}
                              onChange={(e) => setPlanForm({ ...planForm, targetPrice: e.target.value })}
                              data-testid="input-plan-target-price"
                            />
                          </div>
                          <Button type="submit" className="col-span-2" data-testid="button-save-plan">
                            Save Trade Plan
                          </Button>
                        </form>

                        {tradePlans && tradePlans.length > 0 && (
                          <div className="space-y-2 border-t border-border pt-3">
                            <h3 className="text-xs font-medium text-muted-foreground">Saved Plans</h3>
                            {tradePlans.map((plan) => (
                              <div
                                key={plan.id}
                                data-testid={`row-trade-plan-${plan.id}`}
                                className="rounded-md border border-border p-2 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {plan.direction} · {plan.status}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {plan.status === "draft" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px]"
                                        onClick={() => handleTransitionPlan(plan.id, "active")}
                                        data-testid={`button-activate-plan-${plan.id}`}
                                      >
                                        Activate
                                      </Button>
                                    )}
                                    {plan.status === "active" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px]"
                                        onClick={() => handleTransitionPlan(plan.id, "closed")}
                                        data-testid={`button-close-plan-${plan.id}`}
                                      >
                                        Close
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => handleDeletePlan(plan.id)}
                                      data-testid={`button-delete-plan-${plan.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-muted-foreground">{plan.thesis}</p>
                                <p className="text-muted-foreground">
                                  Entry {fmtUsd(plan.risk.entryPrice)} · Stop {fmtUsd(plan.risk.stopPrice)} · Target{" "}
                                  {fmtUsd(plan.risk.targetPrice)}
                                  {plan.risk.positionSize != null ? ` · Size ${plan.risk.positionSize}` : ""}
                                  {plan.risk.riskRewardRatio != null ? ` · R:R ${plan.risk.riskRewardRatio}` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Risk Panel */}
                  {risk && (
                    <Card data-testid="panel-risk">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4" /> Risk Panel
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Portfolio-wide position sizing, stop/target discipline, and risk budget. Never places an order.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Badge variant="outline" className={riskGradeBadgeClass(risk.overall.label)}>
                          Overall: {risk.overall.label}
                        </Badge>
                        <p className="text-sm text-muted-foreground">{risk.overall.detail}</p>
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
              <ResizablePanel defaultSize={24} minSize={16} maxSize={36} data-testid="workspace-right-panel">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {/* Notes Panel */}
                    <Card data-testid="panel-notes">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <StickyNote className="h-4 w-4" /> Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <form onSubmit={handleSaveNote} className="space-y-2">
                          <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder={symbol ? `Note about ${symbol}…` : "Select an instrument to add a note"}
                            disabled={!symbol}
                            className="min-h-[60px] text-sm"
                            data-testid="input-note-text"
                          />
                          <Button type="submit" size="sm" disabled={!symbol || !noteText.trim()} data-testid="button-save-note">
                            Save Note
                          </Button>
                        </form>
                        {workspaceNotes && workspaceNotes.length > 0 && (
                          <ul className="space-y-1.5">
                            {workspaceNotes.map((n) => (
                              <li
                                key={n.id}
                                data-testid={`row-note-${n.id}`}
                                className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-xs"
                              >
                                <span className="text-muted-foreground">{n.note}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 shrink-0"
                                  onClick={() => handleDeleteNote(n.id)}
                                  data-testid={`button-delete-note-${n.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(!workspaceNotes || workspaceNotes.length === 0) && symbol && (
                          <p className="text-xs text-muted-foreground">No notes yet for {symbol}.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Journal Panel */}
                    <Card data-testid="panel-journal">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <NotebookPen className="h-4 w-4" /> Journal
                        </CardTitle>
                        <CardDescription className="text-xs">
                          <a href="/trading-journal" className="text-primary hover:underline">
                            Open full Trading Journal →
                          </a>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <form onSubmit={handleAddJournalEntry} className="space-y-2">
                          <Input
                            value={journalTitle}
                            onChange={(e) => setJournalTitle(e.target.value)}
                            placeholder="Entry title"
                            data-testid="input-journal-quick-title"
                          />
                          <Textarea
                            value={journalContent}
                            onChange={(e) => setJournalContent(e.target.value)}
                            placeholder="What happened?"
                            className="min-h-[50px] text-sm"
                            data-testid="input-journal-quick-content"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!journalTitle.trim() || !journalContent.trim()}
                            data-testid="button-add-journal-entry"
                          >
                            Add Entry
                          </Button>
                        </form>
                        {journalEntries && journalEntries.length > 0 && (
                          <ul className="space-y-1.5">
                            {journalEntries.slice(0, 5).map((entry) => (
                              <li key={entry.id} className="rounded-md border border-border p-2 text-xs" data-testid={`row-journal-${entry.id}`}>
                                <p className="font-medium">{entry.title}</p>
                                <p className="text-muted-foreground line-clamp-2">{entry.content}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(!journalEntries || journalEntries.length === 0) && (
                          <p className="text-xs text-muted-foreground">No journal entries yet.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* AI Trading Coach Panel */}
                    <Card data-testid="panel-ai-coach">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" /> AI Trading Coach
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {coachHistory.length === 0 && !coachStreamingAnswer && (
                          <p className="text-xs text-muted-foreground" data-testid="coach-empty">
                            {symbol
                              ? `Ask something like "What should I watch for on ${symbol}?"`
                              : "Select an instrument to consult the AI Trading Coach."}
                          </p>
                        )}
                        {(coachHistory.length > 0 || coachStreamingAnswer) && (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1" data-testid="coach-history">
                            {coachHistory.map((turn, i) => (
                              <div key={i} className="space-y-1">
                                <p className="text-xs font-medium text-foreground/90">Q: {turn.question}</p>
                                <div className="border-l border-border pl-2 text-xs text-muted-foreground">
                                  <Markdown className="inline text-xs">{turn.answer}</Markdown>
                                </div>
                              </div>
                            ))}
                            {coachAsking && (
                              <p className="border-l border-border pl-2 text-xs text-muted-foreground" data-testid="coach-loading">
                                {coachStreamingAnswer || "thinking…"}
                              </p>
                            )}
                          </div>
                        )}
                        <form onSubmit={handleAskCoach} className="flex gap-2">
                          <Input
                            value={coachQuestion}
                            onChange={(e) => setCoachQuestion(e.target.value)}
                            placeholder="Ask the coach…"
                            disabled={coachAsking || !symbol}
                            data-testid="coach-input"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!coachQuestion.trim() || coachAsking || !symbol}
                            data-testid="coach-submit"
                          >
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
