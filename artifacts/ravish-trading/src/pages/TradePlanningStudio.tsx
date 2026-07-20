// Phase 28 — Institutional Trade Planning & Risk Studio.
//
// An orchestration and workflow phase, not a rebuild of Trade Plans, Risk
// Management, Trading Journal, the Institutional Trade Workspace, the
// Market Structure Workbench, or the Liquidity & Session Workbench. Every
// analytical read on this page reuses an already-shipped Engine 2 hook
// exactly as TradeWorkspace.tsx/MarketStructureWorkbench.tsx/
// LiquidityWorkbench.tsx already call it (Market Structure, Multi-
// Timeframe, Liquidity, Session, Portfolio Risk), plus Phase 25's own
// Trade Plans/Workspace Notes persistence and Trade Checklist composition
// (src/lib/trade-checklist.ts, reused verbatim), the AI Trade Coach's own
// streamCoach() SSE client, and Trading Journal's own list/create hooks.
//
// The genuinely new pieces this phase introduces are: (1) Entry/Stop/
// Target Planning split into 3 distinct panels sharing one form (the brief's
// own named panels), submitting via the exact same computeRiskParameters()
// math routes/tradingTradePlans.ts's POST already uses; (2) Position Size
// Review / Risk-Reward Review / Capital Allocation Summary / Portfolio
// Exposure Summary — richer, dedicated displays of TradingRiskAnalysis's
// own already-computed positionSizing/portfolioBudget/stopDiscipline
// fields, which no existing page surfaced beyond a single prose sentence
// each; (3) Scenario Comparison — a stateless preview (POST
// /trading/trade-plans/scenarios/compare, Phase 28) comparing 2-5
// candidate entry/stop/target combinations via the same
// computeRiskParameters() math, never persisted, never a new formula; and
// (4) Planning Timeline — a chronological rendering of the symbol's own
// already-persisted Trade Plans, oldest to newest, zero new computation.
//
// Workflow: Select Instrument -> Review Market Structure -> Review
// Liquidity -> Review Session -> Create Trade Plan -> Review Risk ->
// Compare Scenarios -> Record Notes -> Review Checklist -> Save Trade
// Plan -> Open Trading Journal. All within this one page.
//
// Deliberately deferred, per the approved scope: automated execution,
// trading signals, ICT/SMC/ASAD/Trader Bill logic, Order Block/Fair Value
// Gap detection. The AI Trading Coach panel explains existing plan/risk
// outputs only — it never invents entries/stops/targets/directional calls.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTradingStructure,
  getGetTradingStructureQueryKey,
  useGetTradingLiquidity,
  getGetTradingLiquidityQueryKey,
  useGetTradingSession,
  getGetTradingSessionQueryKey,
  useGetTradingMultiTimeframe,
  getGetTradingMultiTimeframeQueryKey,
  useGetTradingRisk,
  getGetTradingRiskQueryKey,
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
  useCompareTradingScenarios,
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
  liquidityBandBadgeClass,
  riskGradeBadgeClass,
} from "@/lib/trading-format";
import { buildTradeChecklist, type ChecklistItemStatus } from "@/lib/trade-checklist";
import {
  ClipboardList,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  Droplets,
  Clock,
  ShieldAlert,
  StickyNote,
  MessageCircle,
  NotebookPen,
  ListChecks,
  FileCheck2,
  Send,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
  LogIn,
  Target,
  ArrowDownToLine,
  Crosshair,
  Wallet,
  PieChart,
  GitCompareArrows,
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
    navigate(upper ? `/trade-planning-studio?symbol=${upper}` : "/trade-planning-studio");
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

interface ScenarioFormRow {
  name: string;
  direction: TradingTradePlanInputDirection;
  accountRiskPct: string;
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
}

function emptyScenarioRow(name: string): ScenarioFormRow {
  return { name, direction: "long", accountRiskPct: "1", entryPrice: "", stopPrice: "", targetPrice: "" };
}

export default function TradePlanningStudio() {
  const [symbol, setSymbol] = useSymbolFromDeepLink();
  const [query, setQuery] = useState(symbol);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => setQuery(symbol), [symbol]);

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

  // ─── Review Market Structure / Liquidity / Session (existing Engine 2
  // engines, reused unmodified). ──────────────────────────────────────────
  const { data: structure } = useGetTradingStructure(symbol, {
    query: { queryKey: getGetTradingStructureQueryKey(symbol), enabled: !!symbol },
  });
  const { data: liquidity } = useGetTradingLiquidity(symbol, {
    query: { queryKey: getGetTradingLiquidityQueryKey(symbol), enabled: !!symbol },
  });
  const { data: session } = useGetTradingSession(symbol, {
    query: { queryKey: getGetTradingSessionQueryKey(symbol), enabled: !!symbol },
  });
  const { data: multiTimeframe } = useGetTradingMultiTimeframe(symbol, {
    query: { queryKey: getGetTradingMultiTimeframeQueryKey(symbol), enabled: !!symbol },
  });

  // ─── Review Risk (existing Risk Management Engine, reused unmodified —
  // this page surfaces its full positionSizing/stopDiscipline/portfolioBudget
  // structure, which no prior page went beyond one prose sentence each
  // for). Portfolio-wide, not symbol-scoped. ──────────────────────────────
  const { data: risk } = useGetTradingRisk({ query: { queryKey: getGetTradingRiskQueryKey() } });

  // ─── Create Trade Plan / Planning Timeline (existing trading_trade_plans
  // persistence, Phase 25, reused unmodified). Entry/Stop/Target Planning
  // split into 3 panels per the approved brief, sharing one form. ────────
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

  // ─── Compare Scenarios (new this phase) — a stateless preview, never
  // persisted, over 2-5 candidate entry/stop/target combinations via the
  // exact same computeRiskParameters() math a real Trade Plan uses. ──────
  const [scenarioRows, setScenarioRows] = useState<ScenarioFormRow[]>([emptyScenarioRow("Scenario A"), emptyScenarioRow("Scenario B")]);
  const compareScenarios = useCompareTradingScenarios();
  const [comparison, setComparison] = useState<{
    scenarios: { name: string; direction: string; risk: { positionSize: number | null; riskRewardRatio: number | null } }[];
    bestRiskRewardName: string | null;
    tightestRiskName: string | null;
    summary: string;
  } | null>(null);

  function updateScenarioRow(index: number, patch: Partial<ScenarioFormRow>) {
    setScenarioRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addScenarioRow() {
    setScenarioRows((rows) => (rows.length >= 5 ? rows : [...rows, emptyScenarioRow(`Scenario ${String.fromCharCode(65 + rows.length)}`)]));
  }

  function handleCompareScenarios(e?: React.FormEvent) {
    e?.preventDefault();
    const scenarios = scenarioRows
      .filter((r) => r.entryPrice && r.stopPrice && r.targetPrice)
      .map((r) => ({
        name: r.name,
        direction: r.direction,
        accountRiskPct: Number(r.accountRiskPct),
        entryPrice: Number(r.entryPrice),
        stopPrice: Number(r.stopPrice),
        targetPrice: Number(r.targetPrice),
      }));
    if (scenarios.length < 2) {
      toast({ title: "Fill in at least 2 scenarios to compare", variant: "destructive" });
      return;
    }
    compareScenarios.mutate(
      { data: { symbol: symbol || undefined, accountValue: risk?.accountValue ?? undefined, scenarios } },
      { onSuccess: (data) => setComparison(data) },
    );
  }

  // ─── Record Notes (Phase 25's Workspace Notes, reused unmodified). ─────
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

  // ─── Open Trading Journal — a condensed recent-entries view + quick-add,
  // reusing Sprint 39/46's own Trading Journal CRUD exactly, the same
  // "link out, don't duplicate" precedent TradeWorkspace.tsx established. ─
  const { data: journalEntries } = useListTradingJournalEntries({
    query: { queryKey: getListTradingJournalEntriesQueryKey() },
  });

  // ─── Review Checklist — reuses Phase 25's own buildTradeChecklist(), zero
  // new scoring logic, identical inputs to TradeWorkspace.tsx's own. ──────
  const checklist = useMemo(
    () => buildTradeChecklist({ structure, multiTimeframe, liquidity, risk, tradePlan: currentPlan }),
    [structure, multiTimeframe, liquidity, risk, currentPlan],
  );

  // ─── Evidence Panel ─────────────────────────────────────────────────────
  const evidenceItems = useMemo(() => {
    const items: { label: string; detail: string }[] = [];
    if (structure) items.push({ label: "Market Structure", detail: structure.trendDetail });
    if (liquidity) items.push({ label: "Liquidity", detail: liquidity.summary });
    if (risk) items.push({ label: "Portfolio Risk", detail: risk.overall.detail });
    if (currentPlan) items.push({ label: "Trade Plan Thesis", detail: currentPlan.thesis });
    if (comparison) items.push({ label: "Scenario Comparison", detail: comparison.summary });
    return items;
  }, [structure, liquidity, risk, currentPlan, comparison]);

  // ─── AI Trading Coach ───────────────────────────────────────────────────
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

  // ─── Save Trade Plan (final workflow step before Open Trading Journal) ─
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
      title: savedSomething ? "Trade plan saved" : "Nothing pending to save",
      description: savedSomething
        ? "Your trade plan and/or notes have been persisted. Open the Trading Journal to record the outcome."
        : "Fill in the Entry/Stop/Target planning panels or write a note first.",
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -m-6" data-testid="page-trade-planning-studio">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400" /> Trade Planning &amp; Risk Studio
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-1.5" data-testid="studio-permanent-labels">
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
                data-testid="studio-symbol-search"
              />
            </div>
            <Button type="submit" size="sm" className="h-8 text-xs" data-testid="studio-symbol-search-submit">
              Select
            </Button>
          </form>
          <Button size="sm" className="h-8 text-xs" onClick={handleSaveWorkspace} disabled={!symbol} data-testid="button-save-trade-plan">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Trade Plan
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" autoSaveId="trade-planning-studio-layout">
          {!leftCollapsed && (
            <>
              <ResizablePanel defaultSize={22} minSize={15} maxSize={34} data-testid="studio-left-panel">
                <ScrollArea className="h-full">
                  <div className="p-3 space-y-3">
                    {/* Market Structure */}
                    <Card data-testid="panel-structure-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" /> Market Structure
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!symbol && <p className="text-muted-foreground">Select an instrument to review structure.</p>}
                        {symbol && !structure && <Skeleton className="h-8 w-full" />}
                        {structure && (
                          <>
                            <Badge variant="outline" className={`flex w-fit items-center gap-1 ${trendBadgeClass(structure.trend)}`}>
                              <TrendIcon trend={structure.trend} /> {structure.trend}
                            </Badge>
                            <p className="text-muted-foreground">{structure.trendDetail}</p>
                            <a
                              href={`/market-structure-workbench?symbol=${symbol}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                              data-testid="link-open-market-structure-workbench"
                            >
                              <ExternalLink className="h-3 w-3" /> Full Market Structure Workbench
                            </a>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Liquidity */}
                    <Card data-testid="panel-liquidity-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Droplets className="h-4 w-4" /> Liquidity
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs">
                        {!liquidity && <p className="text-muted-foreground">{symbol ? "Not yet reviewed." : "Select an instrument to review liquidity."}</p>}
                        {liquidity && (
                          <>
                            <Badge variant="outline" className={liquidityBandBadgeClass(liquidity.liquidityBand)}>
                              {liquidity.liquidityBand} liquidity
                            </Badge>
                            <p className="text-muted-foreground">{liquidity.summary}</p>
                            <a
                              href={`/liquidity-workbench?symbol=${symbol}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                              data-testid="link-open-liquidity-workbench"
                            >
                              <ExternalLink className="h-3 w-3" /> Full Liquidity &amp; Session Workbench
                            </a>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Session */}
                    <Card data-testid="panel-session-summary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Session
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
                <span className="text-xs text-muted-foreground">Entry/Stop/Target → Risk Review → Scenario Comparison → Timeline</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setRightCollapsed((v) => !v)} aria-label="Toggle right panel" data-testid="toggle-right-panel">
                  {rightCollapsed ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {!symbol && (
                    <p className="text-sm text-muted-foreground">
                      Select an instrument above to begin: plan an entry/stop/target, review risk, compare scenarios,
                      then save a trade plan.
                    </p>
                  )}

                  {symbol && (
                    <form onSubmit={handleCreateTradePlan} className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="panel-trade-plan-workspace">
                      {/* Entry Planning Panel */}
                      <Card data-testid="panel-entry-planning">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <LogIn className="h-4 w-4" /> Entry Planning
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <select
                            value={planForm.direction}
                            onChange={(e) => setPlanForm({ ...planForm, direction: e.target.value as TradingTradePlanInputDirection })}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            data-testid="select-plan-direction"
                          >
                            <option value="long">Long</option>
                            <option value="short">Short</option>
                          </select>
                          <Input
                            type="number"
                            value={planForm.entryPrice}
                            onChange={(e) => setPlanForm({ ...planForm, entryPrice: e.target.value })}
                            placeholder="Entry price"
                            className="h-8 text-xs"
                            data-testid="input-plan-entry-price"
                          />
                          <Input
                            type="number"
                            value={planForm.accountRiskPct}
                            onChange={(e) => setPlanForm({ ...planForm, accountRiskPct: e.target.value })}
                            placeholder="Account risk %"
                            className="h-8 text-xs"
                            data-testid="input-plan-risk-pct"
                          />
                        </CardContent>
                      </Card>

                      {/* Stop Planning Panel */}
                      <Card data-testid="panel-stop-planning">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <ArrowDownToLine className="h-4 w-4" /> Stop Planning
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Input
                            type="number"
                            value={planForm.stopPrice}
                            onChange={(e) => setPlanForm({ ...planForm, stopPrice: e.target.value })}
                            placeholder="Stop price"
                            className="h-8 text-xs"
                            data-testid="input-plan-stop-price"
                          />
                          <p className="text-xs text-muted-foreground">Defines the dollar risk per share/contract.</p>
                        </CardContent>
                      </Card>

                      {/* Target Planning Panel */}
                      <Card data-testid="panel-target-planning">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Crosshair className="h-4 w-4" /> Target Planning
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Input
                            type="number"
                            value={planForm.targetPrice}
                            onChange={(e) => setPlanForm({ ...planForm, targetPrice: e.target.value })}
                            placeholder="Target price"
                            className="h-8 text-xs"
                            data-testid="input-plan-target-price"
                          />
                          <p className="text-xs text-muted-foreground">Defines the reward, and thus R:R.</p>
                        </CardContent>
                      </Card>

                      <div className="md:col-span-3 space-y-2">
                        <Textarea
                          value={planForm.thesis}
                          onChange={(e) => setPlanForm({ ...planForm, thesis: e.target.value })}
                          placeholder="Thesis — why this trade, right now?"
                          className="min-h-[50px] text-sm"
                          data-testid="input-plan-thesis"
                        />
                        <Button type="submit" size="sm" data-testid="button-save-plan">
                          Save Trade Plan
                        </Button>
                      </div>

                      {tradePlans && tradePlans.length > 0 && (
                        <div className="md:col-span-3 space-y-2 border-t border-border pt-3">
                          <h3 className="text-xs font-medium text-muted-foreground">Saved Plans (Planning Timeline)</h3>
                          <ul className="space-y-1.5" data-testid="panel-planning-timeline">
                            {[...tradePlans].reverse().map((plan) => (
                              <li key={plan.id} data-testid={`row-trade-plan-${plan.id}`} className="rounded-md border border-border p-2 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {new Date(plan.createdAt).toLocaleDateString()} — {plan.direction} · {plan.status}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {plan.status === "draft" && (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleTransitionPlan(plan.id, "active")} data-testid={`button-activate-plan-${plan.id}`}>
                                        Activate
                                      </Button>
                                    )}
                                    {plan.status === "active" && (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleTransitionPlan(plan.id, "closed")} data-testid={`button-close-plan-${plan.id}`}>
                                        Close
                                      </Button>
                                    )}
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeletePlan(plan.id)} data-testid={`button-delete-plan-${plan.id}`}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-muted-foreground">{plan.thesis}</p>
                                <p className="text-muted-foreground">
                                  Entry {fmtUsd(plan.risk.entryPrice)} · Stop {fmtUsd(plan.risk.stopPrice)} · Target {fmtUsd(plan.risk.targetPrice)}
                                  {plan.risk.positionSize != null ? ` · Size ${plan.risk.positionSize}` : ""}
                                  {plan.risk.riskRewardRatio != null ? ` · R:R ${plan.risk.riskRewardRatio}` : ""}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </form>
                  )}

                  {/* Position Size Review */}
                  <Card data-testid="panel-position-size-review">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" /> Position Size Review
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs">
                      {!currentPlan && <p className="text-muted-foreground">No trade plan saved yet.</p>}
                      {currentPlan && (
                        <>
                          <p>
                            {currentPlan.risk.positionSize != null
                              ? `Computed position size: ${currentPlan.risk.positionSize} shares/contracts`
                              : "Account value not supplied — position size not derived"}
                          </p>
                          {risk?.positionSizing && (
                            <p className="text-muted-foreground">{risk.positionSizing.detail}</p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Risk/Reward Review */}
                  <Card data-testid="panel-risk-reward-review">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Crosshair className="h-4 w-4" /> Risk / Reward Review
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs">
                      {!currentPlan && <p className="text-muted-foreground">No trade plan saved yet.</p>}
                      {currentPlan && (
                        <p>{currentPlan.risk.riskRewardRatio != null ? `R:R ${currentPlan.risk.riskRewardRatio}` : "Zero stop distance — R:R not computable"}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Capital Allocation Summary */}
                  <Card data-testid="panel-capital-allocation-summary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Wallet className="h-4 w-4" /> Capital Allocation Summary
                      </CardTitle>
                      <CardDescription className="text-xs">Reused directly from the Risk Management Engine's own portfolio risk budget.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {!risk && <p className="text-muted-foreground">Not yet reviewed.</p>}
                      {risk && (
                        <>
                          <Badge variant="outline" className={riskGradeBadgeClass(risk.portfolioBudget.label)}>
                            {risk.portfolioBudget.label}
                          </Badge>
                          <p className="text-muted-foreground">{risk.portfolioBudget.detail}</p>
                          {risk.portfolioBudget.perPosition.length > 0 && (
                            <ul className="space-y-1">
                              {risk.portfolioBudget.perPosition.map((p) => (
                                <li key={p.id} data-testid={`row-allocation-${p.id}`} className="flex items-center justify-between rounded-md border border-border px-2 py-1">
                                  <span>{p.symbol}</span>
                                  <span className="text-muted-foreground">
                                    {p.riskDollars != null ? `${fmtUsd(p.riskDollars)} (${p.riskPct}%)` : "no stop defined"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Portfolio Exposure Summary */}
                  <Card data-testid="panel-portfolio-exposure-summary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PieChart className="h-4 w-4" /> Portfolio Exposure Summary
                      </CardTitle>
                      <CardDescription className="text-xs">Reused directly from the Risk Management Engine's own stop/target discipline and position sizing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs">
                      {!risk && <p className="text-muted-foreground">Not yet reviewed.</p>}
                      {risk && (
                        <>
                          <p>
                            {risk.stopDiscipline.openPositionsCount} open position(s), {risk.stopDiscipline.positionsFullyPlanned} fully planned (stop + target)
                          </p>
                          {risk.stopDiscipline.missingStopSymbols.length > 0 && (
                            <p className="text-muted-foreground">Missing stop: {risk.stopDiscipline.missingStopSymbols.join(", ")}</p>
                          )}
                          {risk.stopDiscipline.missingTargetSymbols.length > 0 && (
                            <p className="text-muted-foreground">Missing target: {risk.stopDiscipline.missingTargetSymbols.join(", ")}</p>
                          )}
                          {risk.positionSizing.largestPositionSymbol && (
                            <p className="text-muted-foreground">
                              Largest single-position risk: {risk.positionSizing.largestPositionSymbol} at {risk.positionSizing.largestPositionRiskPct}%
                              {risk.positionSizing.capBreached ? " (cap breached)" : ""}
                            </p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Scenario Comparison */}
                  <Card data-testid="panel-scenario-comparison">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <GitCompareArrows className="h-4 w-4" /> Scenario Comparison
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Compare 2-5 candidate entry/stop/target combinations before committing to a trade plan. Never persisted.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <form onSubmit={handleCompareScenarios} className="space-y-2">
                        {scenarioRows.map((row, i) => (
                          <div key={i} className="grid grid-cols-5 gap-1.5" data-testid={`scenario-row-${i}`}>
                            <Input
                              value={row.name}
                              onChange={(e) => updateScenarioRow(i, { name: e.target.value })}
                              className="h-7 text-xs"
                              data-testid={`input-scenario-name-${i}`}
                            />
                            <Input
                              type="number"
                              placeholder="Entry"
                              value={row.entryPrice}
                              onChange={(e) => updateScenarioRow(i, { entryPrice: e.target.value })}
                              className="h-7 text-xs"
                              data-testid={`input-scenario-entry-${i}`}
                            />
                            <Input
                              type="number"
                              placeholder="Stop"
                              value={row.stopPrice}
                              onChange={(e) => updateScenarioRow(i, { stopPrice: e.target.value })}
                              className="h-7 text-xs"
                              data-testid={`input-scenario-stop-${i}`}
                            />
                            <Input
                              type="number"
                              placeholder="Target"
                              value={row.targetPrice}
                              onChange={(e) => updateScenarioRow(i, { targetPrice: e.target.value })}
                              className="h-7 text-xs"
                              data-testid={`input-scenario-target-${i}`}
                            />
                            <Input
                              type="number"
                              placeholder="Risk %"
                              value={row.accountRiskPct}
                              onChange={(e) => updateScenarioRow(i, { accountRiskPct: e.target.value })}
                              className="h-7 text-xs"
                              data-testid={`input-scenario-risk-pct-${i}`}
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={addScenarioRow} disabled={scenarioRows.length >= 5} data-testid="button-add-scenario-row">
                            Add Scenario
                          </Button>
                          <Button type="submit" size="sm" data-testid="button-compare-scenarios">
                            Compare
                          </Button>
                        </div>
                      </form>

                      {comparison && (
                        <div className="space-y-2 border-t border-border pt-2" data-testid="scenario-comparison-results">
                          <p className="text-xs text-muted-foreground">{comparison.summary}</p>
                          <ul className="space-y-1">
                            {comparison.scenarios.map((s) => (
                              <li key={s.name} data-testid={`row-scenario-result-${s.name}`} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs">
                                <span className="font-medium">
                                  {s.name}
                                  {comparison.bestRiskRewardName === s.name && (
                                    <Badge variant="outline" className="ml-1.5 border-emerald-500/40 text-emerald-400 text-[9px]">
                                      Best R:R
                                    </Badge>
                                  )}
                                  {comparison.tightestRiskName === s.name && (
                                    <Badge variant="outline" className="ml-1.5 border-sky-500/40 text-sky-400 text-[9px]">
                                      Tightest Risk
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-muted-foreground">
                                  {s.risk.riskRewardRatio != null ? `R:R ${s.risk.riskRewardRatio}` : "R:R n/a"}
                                  {s.risk.positionSize != null ? ` · size ${s.risk.positionSize}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          {!rightCollapsed && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={24} minSize={16} maxSize={36} data-testid="studio-right-panel">
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

                    {/* Trade Review Notes */}
                    <Card data-testid="panel-trade-review-notes">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <StickyNote className="h-4 w-4" /> Trade Review Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <form onSubmit={handleSaveNote} className="space-y-2">
                          <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder={symbol ? `Note about ${symbol}'s plan/risk…` : "Select an instrument to add a note"}
                            disabled={!symbol}
                            className="min-h-[50px] text-sm"
                            data-testid="input-review-note-text"
                          />
                          <Button type="submit" size="sm" disabled={!symbol || !noteText.trim()} data-testid="button-save-review-note">
                            Save Note
                          </Button>
                        </form>
                        {notes && notes.length > 0 && (
                          <ul className="space-y-1.5">
                            {notes.map((n) => (
                              <li key={n.id} data-testid={`row-review-note-${n.id}`} className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-xs">
                                <span className="text-muted-foreground">{n.note}</span>
                                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => handleDeleteNote(n.id)} data-testid={`button-delete-review-note-${n.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(!notes || notes.length === 0) && symbol && <p className="text-xs text-muted-foreground">No notes yet for {symbol}.</p>}
                      </CardContent>
                    </Card>

                    {/* Open Trading Journal */}
                    <Card data-testid="panel-open-trading-journal">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <NotebookPen className="h-4 w-4" /> Trading Journal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        {journalEntries && journalEntries.length > 0 ? (
                          <p className="text-muted-foreground">{journalEntries.length} entries on record.</p>
                        ) : (
                          <p className="text-muted-foreground">No journal entries yet.</p>
                        )}
                        <a href="/trading-journal" className="flex items-center gap-1 text-primary hover:underline" data-testid="link-open-trading-journal">
                          <ExternalLink className="h-3 w-3" /> Open Trading Journal
                        </a>
                      </CardContent>
                    </Card>

                    {/* AI Trading Coach */}
                    <Card data-testid="panel-ai-coach">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" /> AI Trading Coach
                        </CardTitle>
                        <CardDescription className="text-xs">Explains existing plan/risk outputs only — never a signal or directional call.</CardDescription>
                        <a
                          href={symbol ? `/trading-ai-coach?symbol=${symbol}&coach=risk` : "/trading-ai-coach"}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          data-testid="link-open-trading-ai-coach"
                        >
                          <ExternalLink className="h-3 w-3" /> Open full Institutional Trading AI Coach
                        </a>
                        <a
                          href="/strategy-framework"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          data-testid="link-open-strategy-framework"
                        >
                          <ExternalLink className="h-3 w-3" /> Register or review your own Strategy Framework
                        </a>
                        <a
                          href="/strategy-workbench"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          data-testid="link-open-strategy-workbench"
                        >
                          <ExternalLink className="h-3 w-3" /> Open the Institutional Strategy Workbench
                        </a>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {coachHistory.length === 0 && !coachStreamingAnswer && (
                          <p className="text-xs text-muted-foreground" data-testid="studio-coach-empty">
                            {symbol ? `Ask something like "Is my planned risk within limits for ${symbol}?"` : "Select an instrument to consult the coach."}
                          </p>
                        )}
                        {(coachHistory.length > 0 || coachStreamingAnswer) && (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1" data-testid="studio-coach-history">
                            {coachHistory.map((turn, i) => (
                              <div key={i} className="space-y-1">
                                <p className="text-xs font-medium text-foreground/90">Q: {turn.question}</p>
                                <div className="border-l border-border pl-2 text-xs text-muted-foreground">
                                  <Markdown className="inline text-xs">{turn.answer}</Markdown>
                                </div>
                              </div>
                            ))}
                            {coachAsking && (
                              <p className="border-l border-border pl-2 text-xs text-muted-foreground" data-testid="studio-coach-loading">
                                {coachStreamingAnswer || "thinking…"}
                              </p>
                            )}
                          </div>
                        )}
                        <form onSubmit={handleAskCoach} className="flex gap-2">
                          <Input
                            value={coachQuestion}
                            onChange={(e) => setCoachQuestion(e.target.value)}
                            placeholder="Ask about planning or risk…"
                            disabled={coachAsking || !symbol}
                            data-testid="studio-coach-input"
                          />
                          <Button type="submit" size="sm" disabled={!coachQuestion.trim() || coachAsking || !symbol} data-testid="studio-coach-submit">
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
