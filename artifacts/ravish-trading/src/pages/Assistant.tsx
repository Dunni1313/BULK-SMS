import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetAiMessages,
  useGetCoachLessons,
  getGetAiMessagesQueryKey,
  AiChatInputMode,
  AiChatInputLevel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Send, Bot, User, BrainCircuit, Lightbulb, BookOpen, GraduationCap, Sparkles, FileText, Square, MessageSquare, NotebookText, ListTree, Scale, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSpecialistCoach } from "@/lib/ai-coach/useSpecialistCoach";
import { optionsCoachConfig } from "@/lib/ai-coach/coaches/optionsCoach.config";
import { useCoachConversations } from "@/lib/ai-coach/useCoachConversations";
import { ConversationSidebar } from "@/lib/ai-coach/ConversationSidebar";
import { useAiWorkspaces } from "@/lib/ai-coach/useAiWorkspaces";
import { WorkspaceSidebar } from "@/lib/ai-coach/WorkspaceSidebar";
import { WorkspaceHeader } from "@/lib/ai-coach/WorkspaceHeader";
import { useAiNotebooks } from "@/lib/ai-coach/useAiNotebooks";
import { NotebookSidebar } from "@/lib/ai-coach/NotebookSidebar";
import { NotebookHeader } from "@/lib/ai-coach/NotebookHeader";
import { NotebookEditor } from "@/lib/ai-coach/NotebookEditor";
import { NotebookSummaryPanel } from "@/lib/ai-coach/NotebookSummaryPanel";
import { NotebookEmptyState } from "@/lib/ai-coach/NotebookEmptyState";
import { useAiStrategies } from "@/lib/ai-coach/useAiStrategies";
import { useStrategyTemplates } from "@/lib/ai-coach/useStrategyTemplates";
import { StrategySidebar } from "@/lib/ai-coach/StrategySidebar";
import { StrategyHeader } from "@/lib/ai-coach/StrategyHeader";
import { StrategyEditor } from "@/lib/ai-coach/StrategyEditor";
import { StrategySummaryPanel } from "@/lib/ai-coach/StrategySummaryPanel";
import { StrategyComparisonView } from "@/lib/ai-coach/StrategyComparisonView";
import { StrategyEmptyState } from "@/lib/ai-coach/StrategyEmptyState";
import { compareStrategies as fetchStrategyComparison, compareStrategiesWithAi, type StrategyComparison } from "@/lib/ai-coach/strategiesApi";
import { useTradePlans } from "@/lib/ai-coach/useTradePlans";
import { useTradePlanChecklistTemplates } from "@/lib/ai-coach/useTradePlanChecklistTemplates";
import { TradePlannerSidebar } from "@/lib/ai-coach/TradePlannerSidebar";
import { TradePlanHeader } from "@/lib/ai-coach/TradePlanHeader";
import { TradePlanEditor } from "@/lib/ai-coach/TradePlanEditor";
import { TradePlanChecklist } from "@/lib/ai-coach/TradePlanChecklist";
import { TradePlanSummary } from "@/lib/ai-coach/TradePlanSummary";
import { TradePlanComparison } from "@/lib/ai-coach/TradePlanComparison";
import { TradePlanEmptyState } from "@/lib/ai-coach/TradePlanEmptyState";
import {
  compareTradePlans as fetchTradePlanComparison,
  compareTradePlansWithAi,
  type TradePlanComparison as TradePlanComparisonResult,
} from "@/lib/ai-coach/tradePlansApi";
import { Markdown } from "@/components/ui/markdown";

type ChatMode = "auto" | AiChatInputMode;
type ChatLevel = AiChatInputLevel;

const MODE_OPTIONS: { value: ChatMode; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: AiChatInputMode.explain_trade, label: "Explain Trade" },
  { value: AiChatInputMode.teach_greeks, label: "Teach Greeks" },
  { value: AiChatInputMode.risk_coach, label: "Risk Coach" },
  { value: AiChatInputMode.strategy_coach, label: "Strategy Coach" },
  { value: AiChatInputMode.value_research, label: "Value Research" },
  { value: AiChatInputMode.quiz, label: "Quiz Me" },
];

const REFERENCE_CARDS: { sym: string; name: string; plain: string }[] = [
  { sym: "Δ", name: "Delta", plain: "Direction & ≈ chance of finishing in-the-money. ~0.20 short ≈ 80% POP." },
  { sym: "Θ", name: "Theta", plain: "Daily time-decay income — the premium seller's edge. Positive is good." },
  { sym: "Γ", name: "Gamma", plain: "How fast delta moves. Sellers are short gamma near expiry — risk accelerates." },
  { sym: "V", name: "Vega", plain: "Sensitivity to IV. Sellers are short vega and prefer high IV rank." },
  { sym: "POP", name: "Prob. of Profit", plain: "Odds the trade is a winner at expiration. Ravish targets high-POP setups." },
  { sym: "EV", name: "Expected Value", plain: "Average $ outcome weighted by probability. Must be positive to trade." },
];

export default function Assistant() {
  // v1.5.0 Sprint 6 — AI Coach Memory. The Options AI Coach now has its own
  // multi-conversation history (isolated from Trading/Investing — see
  // useCoachConversations.ts), rendered instead of this page's old flat,
  // ungrouped useGetAiMessages() history. The underlying POST /ai/chat[/
  // stream] route is completely unchanged and still writes to its own
  // pre-existing ai_messages table server-side as it always has — this is
  // a disclosed, harmless side effect of an otherwise-untouched route, not
  // read by this page's UI anymore. useGetAiMessages()'s own query is still
  // invalidated on each answer (unchanged), in case any other surface still
  // reads it.
  const { isLoading: isMessagesLoading } = useGetAiMessages();
  const { data: lessons } = useGetCoachLessons();
  const queryClient = useQueryClient();

  const recentLessons = (lessons ?? []).slice(0, 4);

  const [mode, setMode] = useState<ChatMode>("auto");
  const [level, setLevel] = useState<ChatLevel>(AiChatInputLevel.beginner);
  const scrollRef = useRef<HTMLDivElement>(null);

  // v1.5.0 Sprint 7 — AI Workspaces. The Options AI Coach now supports
  // reusable workspaces grouping conversations, research, files, and notes.
  // useCoachConversations() gained an optional workspaceId scope (Sprint 6's
  // own hook, extended additively) — passing the active workspace's id
  // scopes the list to it; omitting it (activeWorkspaceId === null) is
  // Sprint 6's original, un-grouped "All conversations" behavior.
  const optionsWorkspaces = useAiWorkspaces("options");
  const optionsCoachConversations = useCoachConversations("options", optionsWorkspaces.activeWorkspaceId ?? undefined);

  // v1.5.0 Sprint 8 — AI Research Notebooks. A structured knowledge space
  // inside a workspace (or unscoped) for collecting and refining AI
  // research over time — a peer surface to the conversation view above,
  // switched via the "Conversations"/"Notebooks" toggle below, never
  // interleaved with the streaming chat state machine.
  const [assistantView, setAssistantView] = useState<"conversations" | "notebooks" | "strategies" | "trade-plans">("conversations");
  const optionsNotebooks = useAiNotebooks("options", optionsWorkspaces.activeWorkspaceId ?? undefined);

  // v1.5.0 Sprint 9 — AI Strategy Builder. A reusable, structured
  // trading/options playbook, a third peer surface alongside Conversations
  // and Notebooks, switched via the same toggle below — never interleaved
  // with either's own state.
  const optionsStrategies = useAiStrategies("options", optionsWorkspaces.activeWorkspaceId ?? undefined);
  const optionsStrategyTemplates = useStrategyTemplates();
  const [compareMode, setCompareMode] = useState(false);
  const [compareIdA, setCompareIdA] = useState<number | null>(null);
  const [compareIdB, setCompareIdB] = useState<number | null>(null);
  const [strategyComparison, setStrategyComparison] = useState<StrategyComparison | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  useEffect(() => {
    if (compareIdA == null || compareIdB == null) {
      setStrategyComparison(null);
      return;
    }
    let cancelled = false;
    setIsLoadingComparison(true);
    fetchStrategyComparison(compareIdA, compareIdB)
      .then((result) => {
        if (!cancelled) setStrategyComparison(result);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingComparison(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compareIdA, compareIdB]);

  // v1.5.0 Sprint 10 — Institutional Trade Planner. A fully prepared trade
  // before execution — a fourth peer surface alongside Conversations,
  // Notebooks, and Strategies, switched via the same toggle below — never
  // interleaved with any of their own state. This module is planning
  // only; it never executes a trade.
  const optionsTradePlans = useTradePlans("options", optionsWorkspaces.activeWorkspaceId ?? undefined);
  const optionsTradePlanChecklistTemplates = useTradePlanChecklistTemplates("options");
  const [tradePlanCompareMode, setTradePlanCompareMode] = useState(false);
  const [tradePlanCompareIdA, setTradePlanCompareIdA] = useState<number | null>(null);
  const [tradePlanCompareIdB, setTradePlanCompareIdB] = useState<number | null>(null);
  const [tradePlanComparison, setTradePlanComparison] = useState<TradePlanComparisonResult | null>(null);
  const [isLoadingTradePlanComparison, setIsLoadingTradePlanComparison] = useState(false);

  useEffect(() => {
    if (tradePlanCompareIdA == null || tradePlanCompareIdB == null) {
      setTradePlanComparison(null);
      return;
    }
    let cancelled = false;
    setIsLoadingTradePlanComparison(true);
    fetchTradePlanComparison(tradePlanCompareIdA, tradePlanCompareIdB)
      .then((result) => {
        if (!cancelled) setTradePlanComparison(result);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTradePlanComparison(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tradePlanCompareIdA, tradePlanCompareIdB]);

  // v1.5.0 Sprint 2 — AI Coach Framework: the send/stream/error/stop state
  // machine (question input, in-flight optimistic bubble, streamed-delta
  // accumulation, AbortController + Stop, honest error turn) is the shared
  // useCoachConversation() hook rather than hand-duplicated local state.
  // v1.5.0 Sprint 3 — Specialist Coach Adapters: this page's own endpoint/
  // request-body literals are now declared once in optionsCoach.config.ts
  // (the "Options AI Coach" adapter) rather than inlined here — identical
  // wire behavior: the same endpoint (POST /ai/chat/stream), the same
  // request body ({message, mode, level}), and the same SSE
  // `meta -> delta... -> done -> error` contract via streamCoach() under
  // the hood. `mode`/`level` are read fresh on every send since the
  // config's buildRequestBody is re-evaluated per call.
  const coach = useSpecialistCoach(optionsCoachConfig, { mode, level }, {
    onAnswered: (turn) => {
      queryClient.invalidateQueries({ queryKey: getGetAiMessagesQueryKey() });
      optionsCoachConversations.persistTurn(turn);
    },
  });

  const messages = optionsCoachConversations.activeMessages;
  const isLoading = isMessagesLoading || optionsCoachConversations.isLoadingMessages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, coach.isStreaming, coach.streamingAnswer, coach.pendingQuestion, coach.erroredReply]);

  return (
    <div className="h-full flex flex-col max-h-[calc(100vh-3rem)]">
      <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DK Option Engine</h1>
          <p className="text-muted-foreground text-sm mt-1">Ask about portfolio risk, delta neutrality, or scan for opportunities.</p>
        </div>
        
        <div className="flex gap-2">
          <Link href="/learn/greeks" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors">
            <Lightbulb className="w-3 h-3" /> Greeks Tutor
          </Link>
          <Link href="/learn/quiz" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors">
            <BrainCircuit className="w-3 h-3" /> Trading Quiz
          </Link>
          <Link href="/lessons" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors">
            <BookOpen className="w-3 h-3" /> Lessons
          </Link>
        </div>
      </div>

      {/* Coaching controls: response mode + teaching depth */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mode</span>
          <Select value={mode} onValueChange={(v) => setMode(v as ChatMode)}>
            <SelectTrigger className="h-8 w-[160px] bg-background border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Depth</span>
          <ToggleGroup
            type="single"
            value={level}
            onValueChange={(v) => v && setLevel(v as ChatLevel)}
            className="border border-border rounded-md bg-background"
          >
            <ToggleGroupItem value={AiChatInputLevel.beginner} className="h-8 px-3 text-xs data-[state=on]:bg-indigo-500/20 data-[state=on]:text-indigo-400">
              Beginner
            </ToggleGroupItem>
            <ToggleGroupItem value={AiChatInputLevel.advanced} className="h-8 px-3 text-xs data-[state=on]:bg-indigo-500/20 data-[state=on]:text-indigo-400">
              Advanced
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            size="sm"
            variant="outline"
            disabled={coach.isStreaming}
            onClick={() => coach.send("Explain my latest trade in detail.")}
            className="h-8 text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Explain latest trade
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={coach.isStreaming}
            onClick={() => coach.send("Quiz me on premium selling.")}
            className="h-8 text-xs border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Quiz me
          </Button>
        </div>
      </div>

      {/* Plain-English quick reference for the metrics the coach uses */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {REFERENCE_CARDS.map((c) => (
          <div key={c.name} className="rounded-lg border border-border bg-card/60 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-mono text-sm font-bold text-indigo-400">{c.sym}</span>
              <span className="text-[11px] font-semibold text-foreground/90">{c.name}</span>
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">{c.plain}</p>
          </div>
        ))}
      </div>

      {recentLessons.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-card/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> Recent Lessons
            </p>
            <Link href="/lessons" className="text-[11px] text-indigo-400 hover:text-indigo-300">View all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentLessons.map((l) => (
              <Link
                key={l.id}
                href="/lessons"
                className="group flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-3 py-2 hover:border-indigo-500/40 transition-colors"
              >
                <span className="text-xs text-foreground/90 truncate group-hover:text-foreground">{l.title}</span>
                {l.source === "llm" && (
                  <Badge variant="outline" className="ml-auto shrink-0 text-[9px] h-4 px-1 border-indigo-500/30 text-indigo-400 bg-indigo-500/10">AI</Badge>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* v1.5.0 Sprint 8 — AI Research Notebooks: a peer surface to the
          conversation view, switched via this toggle. Neither view's own
          state is torn down when the other is shown — only its rendering
          is conditional. */}
      <div className="mb-3 flex gap-1.5" data-testid="assistant-view-toggle">
        <Button
          type="button"
          size="sm"
          variant={assistantView === "conversations" ? "default" : "outline"}
          className="h-7 gap-1.5 text-xs"
          onClick={() => setAssistantView("conversations")}
          data-testid="assistant-view-conversations"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Conversations
        </Button>
        <Button
          type="button"
          size="sm"
          variant={assistantView === "notebooks" ? "default" : "outline"}
          className="h-7 gap-1.5 text-xs"
          onClick={() => setAssistantView("notebooks")}
          data-testid="assistant-view-notebooks"
        >
          <NotebookText className="h-3.5 w-3.5" />
          Notebooks
        </Button>
        <Button
          type="button"
          size="sm"
          variant={assistantView === "strategies" ? "default" : "outline"}
          className="h-7 gap-1.5 text-xs"
          onClick={() => setAssistantView("strategies")}
          data-testid="assistant-view-strategies"
        >
          <ListTree className="h-3.5 w-3.5" />
          Strategies
        </Button>
        <Button
          type="button"
          size="sm"
          variant={assistantView === "trade-plans" ? "default" : "outline"}
          className="h-7 gap-1.5 text-xs"
          onClick={() => setAssistantView("trade-plans")}
          data-testid="assistant-view-trade-plans"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Trade Planner
        </Button>
      </div>

      {assistantView === "trade-plans" ? (
        <div className="flex-1 flex gap-3 min-h-0" data-testid="assistant-trade-plans-view">
          <TradePlannerSidebar
            plans={optionsTradePlans.plans}
            isLoading={optionsTradePlans.isLoadingPlans}
            activePlanId={optionsTradePlans.activePlanId}
            searchTerm={optionsTradePlans.searchTerm}
            onSearchChange={optionsTradePlans.setSearchTerm}
            statusFilter={optionsTradePlans.statusFilter}
            onStatusFilterChange={optionsTradePlans.setStatusFilter}
            includeArchived={optionsTradePlans.includeArchived}
            onIncludeArchivedChange={optionsTradePlans.setIncludeArchived}
            onCreatePlan={(input) => optionsTradePlans.createPlanAnd({ ...input, workspaceId: optionsWorkspaces.activeWorkspaceId })}
            onSelectPlan={(id) => {
              setTradePlanCompareMode(false);
              optionsTradePlans.selectPlan(id);
            }}
            onClearSelection={optionsTradePlans.clearSelection}
            onTogglePin={optionsTradePlans.togglePinById}
            onDeletePlan={optionsTradePlans.deletePlanById}
            testId="assistant-trade-plan-sidebar"
          />
          <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 p-2">
              <span className="text-xs font-medium text-muted-foreground">Options trade plan — planning only, never executes</span>
              <Button
                type="button"
                size="sm"
                variant={tradePlanCompareMode ? "default" : "outline"}
                className="h-7 gap-1.5 text-xs"
                onClick={() => setTradePlanCompareMode((v) => !v)}
                data-testid="assistant-trade-plan-compare-toggle"
              >
                <Scale className="h-3.5 w-3.5" />
                Compare
              </Button>
            </div>
            {tradePlanCompareMode ? (
              <ScrollArea className="flex-1 p-4">
                <TradePlanComparison
                  plans={optionsTradePlans.plans}
                  selectedIdA={tradePlanCompareIdA}
                  selectedIdB={tradePlanCompareIdB}
                  onSelectA={setTradePlanCompareIdA}
                  onSelectB={setTradePlanCompareIdB}
                  comparison={tradePlanComparison}
                  isLoadingComparison={isLoadingTradePlanComparison}
                  onGenerateAiComparison={() =>
                    tradePlanCompareIdA != null && tradePlanCompareIdB != null
                      ? compareTradePlansWithAi(tradePlanCompareIdA, tradePlanCompareIdB)
                      : Promise.resolve(null)
                  }
                  testId="assistant-trade-plan-comparison"
                />
              </ScrollArea>
            ) : optionsTradePlans.activePlanDetail ? (
              <ScrollArea className="flex-1 p-4">
                <TradePlanHeader
                  plan={optionsTradePlans.activePlanDetail}
                  onUpdate={(input) => optionsTradePlans.updatePlanById(optionsTradePlans.activePlanDetail!.id, input)}
                  onTogglePin={(pinned) => optionsTradePlans.togglePinById(optionsTradePlans.activePlanDetail!.id, pinned)}
                  onDelete={() => optionsTradePlans.deletePlanById(optionsTradePlans.activePlanDetail!.id)}
                  testId="assistant-trade-plan-header"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3">
                    <TradePlanEditor
                      plan={optionsTradePlans.activePlanDetail}
                      onUpsertSection={optionsTradePlans.upsertSection}
                      onDeleteSection={optionsTradePlans.removeSection}
                      linkableNotebooks={optionsNotebooks.notebooks.map((n) => ({ id: n.id, title: n.title }))}
                      linkableConversations={optionsCoachConversations.conversations.map((c) => ({ id: c.id, title: c.title }))}
                      linkableFiles={optionsWorkspaces.activeWorkspaceDetail?.files.map((f) => ({ id: f.id, fileName: f.fileName }))}
                      testId="assistant-trade-plan-editor"
                    />
                    <TradePlanChecklist
                      items={optionsTradePlans.activePlanDetail.checklistItems}
                      progress={optionsTradePlans.activePlanDetail.checklistProgress}
                      templates={optionsTradePlanChecklistTemplates.templates}
                      onAddItem={optionsTradePlans.addChecklistItem}
                      onApplyTemplate={optionsTradePlans.applyChecklistTemplate}
                      onToggleCompleted={(itemId, completed) => optionsTradePlans.updateChecklistItem(itemId, { completed })}
                      onDeleteItem={optionsTradePlans.removeChecklistItem}
                      testId="assistant-trade-plan-checklist"
                    />
                  </div>
                  <TradePlanSummary
                    onLoadMissingInformation={optionsTradePlans.loadMissingInformation}
                    onReview={optionsTradePlans.review}
                    onSummarize={optionsTradePlans.summarize}
                    onGenerateRiskHighlights={optionsTradePlans.generateRiskHighlights}
                    onReviewRiskReward={optionsTradePlans.reviewRiskReward}
                    onGenerateExecutiveSummary={optionsTradePlans.generateExecutiveSummary}
                    onGeneratePreparationNotes={optionsTradePlans.generatePreparationNotes}
                    onGeneratePreTradeChecklist={optionsTradePlans.generatePreTradeChecklist}
                    onGenerateVerificationQuestions={optionsTradePlans.generateVerificationQuestions}
                    testId="assistant-trade-plan-summary-panel"
                  />
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <TradePlanEmptyState
                  title="No trade plan selected"
                  description="Choose a trade plan on the left, or create a new one to start preparing your next trade."
                  testId="assistant-trade-plan-detail-empty"
                />
              </div>
            )}
          </Card>
        </div>
      ) : assistantView === "strategies" ? (
        <div className="flex-1 flex gap-3 min-h-0" data-testid="assistant-strategies-view">
          <StrategySidebar
            strategies={optionsStrategies.strategies}
            isLoading={optionsStrategies.isLoadingStrategies}
            activeStrategyId={optionsStrategies.activeStrategyId}
            templates={optionsStrategyTemplates}
            searchTerm={optionsStrategies.searchTerm}
            onSearchChange={optionsStrategies.setSearchTerm}
            folder={optionsStrategies.folder}
            onFolderChange={optionsStrategies.setFolder}
            statusFilter={optionsStrategies.statusFilter}
            onStatusFilterChange={optionsStrategies.setStatusFilter}
            includeArchived={optionsStrategies.includeArchived}
            onIncludeArchivedChange={optionsStrategies.setIncludeArchived}
            onCreateStrategy={(input) => optionsStrategies.createStrategyAnd({ ...input, workspaceId: optionsWorkspaces.activeWorkspaceId })}
            onSelectStrategy={(id) => {
              setCompareMode(false);
              optionsStrategies.selectStrategy(id);
            }}
            onClearSelection={optionsStrategies.clearSelection}
            onTogglePin={optionsStrategies.togglePinById}
            onToggleArchive={optionsStrategies.toggleArchiveById}
            onDeleteStrategy={optionsStrategies.deleteStrategyById}
            testId="assistant-strategy-sidebar"
          />
          <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 p-2">
              <span className="text-xs font-medium text-muted-foreground">Options strategy playbook</span>
              <Button
                type="button"
                size="sm"
                variant={compareMode ? "default" : "outline"}
                className="h-7 gap-1.5 text-xs"
                onClick={() => setCompareMode((v) => !v)}
                data-testid="assistant-strategy-compare-toggle"
              >
                <Scale className="h-3.5 w-3.5" />
                Compare
              </Button>
            </div>
            {compareMode ? (
              <ScrollArea className="flex-1 p-4">
                <StrategyComparisonView
                  strategies={optionsStrategies.strategies}
                  selectedIdA={compareIdA}
                  selectedIdB={compareIdB}
                  onSelectA={setCompareIdA}
                  onSelectB={setCompareIdB}
                  comparison={strategyComparison}
                  isLoadingComparison={isLoadingComparison}
                  onGenerateAiComparison={() =>
                    compareIdA != null && compareIdB != null ? compareStrategiesWithAi(compareIdA, compareIdB) : Promise.resolve(null)
                  }
                  testId="assistant-strategy-comparison"
                />
              </ScrollArea>
            ) : optionsStrategies.activeStrategyDetail ? (
              <ScrollArea className="flex-1 p-4">
                <StrategyHeader
                  strategy={optionsStrategies.activeStrategyDetail}
                  onUpdate={(input) => optionsStrategies.updateStrategyById(optionsStrategies.activeStrategyDetail!.id, input)}
                  onTogglePin={(pinned) => optionsStrategies.togglePinById(optionsStrategies.activeStrategyDetail!.id, pinned)}
                  onToggleArchive={(archived) => optionsStrategies.toggleArchiveById(optionsStrategies.activeStrategyDetail!.id, archived)}
                  onDelete={() => optionsStrategies.deleteStrategyById(optionsStrategies.activeStrategyDetail!.id)}
                  testId="assistant-strategy-header"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <StrategyEditor
                    strategy={optionsStrategies.activeStrategyDetail}
                    onUpsertSection={optionsStrategies.upsertSection}
                    onDeleteSection={optionsStrategies.removeSection}
                    linkableNotebooks={optionsNotebooks.notebooks.map((n) => ({ id: n.id, title: n.title }))}
                    linkableConversations={optionsCoachConversations.conversations.map((c) => ({ id: c.id, title: c.title }))}
                    linkableFiles={optionsWorkspaces.activeWorkspaceDetail?.files.map((f) => ({ id: f.id, fileName: f.fileName }))}
                    testId="assistant-strategy-editor"
                  />
                  <StrategySummaryPanel
                    onLoadMissingSections={optionsStrategies.loadMissingSections}
                    onSummarize={optionsStrategies.summarize}
                    onSuggestImprovements={optionsStrategies.suggestImprovements}
                    onGenerateExecutiveSummary={optionsStrategies.generateExecutiveSummary}
                    onGenerateLearningNotes={optionsStrategies.generateLearningNotes}
                    onGenerateRiskHighlights={optionsStrategies.generateRiskHighlights}
                    onGenerateSetupChecklist={optionsStrategies.generateSetupChecklist}
                    onGenerateTradePrepChecklist={optionsStrategies.generateTradePrepChecklist}
                    onGenerateReviewQuestions={optionsStrategies.generateReviewQuestions}
                    testId="assistant-strategy-summary-panel"
                  />
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <StrategyEmptyState
                  title="No strategy selected"
                  description="Choose a strategy on the left, or create a new one to start building your playbook."
                  testId="assistant-strategy-detail-empty"
                />
              </div>
            )}
          </Card>
        </div>
      ) : assistantView === "notebooks" ? (
        <div className="flex-1 flex gap-3 min-h-0" data-testid="assistant-notebooks-view">
          <NotebookSidebar
            notebooks={optionsNotebooks.notebooks}
            isLoading={optionsNotebooks.isLoadingNotebooks}
            activeNotebookId={optionsNotebooks.activeNotebookId}
            searchTerm={optionsNotebooks.searchTerm}
            onSearchChange={optionsNotebooks.setSearchTerm}
            onCreateNotebook={(input) => optionsNotebooks.createNotebookAnd({ ...input, workspaceId: optionsWorkspaces.activeWorkspaceId })}
            onSelectNotebook={optionsNotebooks.selectNotebook}
            onClearSelection={optionsNotebooks.clearSelection}
            onTogglePin={optionsNotebooks.togglePinById}
            onToggleArchive={optionsNotebooks.toggleArchiveById}
            onDeleteNotebook={optionsNotebooks.deleteNotebookById}
            testId="assistant-notebook-sidebar"
          />
          <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
            {optionsNotebooks.activeNotebookDetail ? (
              <ScrollArea className="flex-1 p-4">
                <NotebookHeader
                  notebook={optionsNotebooks.activeNotebookDetail}
                  onRename={(input) => optionsNotebooks.updateNotebookById(optionsNotebooks.activeNotebookDetail!.id, input)}
                  onTogglePin={(pinned) => optionsNotebooks.togglePinById(optionsNotebooks.activeNotebookDetail!.id, pinned)}
                  onToggleArchive={(archived) => optionsNotebooks.toggleArchiveById(optionsNotebooks.activeNotebookDetail!.id, archived)}
                  onDelete={() => optionsNotebooks.deleteNotebookById(optionsNotebooks.activeNotebookDetail!.id)}
                  onSearch={optionsNotebooks.searchContents}
                  testId="assistant-notebook-header"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <NotebookEditor
                    notebook={optionsNotebooks.activeNotebookDetail}
                    onAddNote={optionsNotebooks.addNote}
                    onDeleteNote={optionsNotebooks.deleteNote}
                    onLinkConversation={optionsNotebooks.linkConversation}
                    onLinkFile={optionsWorkspaces.activeWorkspaceDetail ? optionsNotebooks.linkFile : undefined}
                    onRemoveLink={optionsNotebooks.removeLink}
                    linkableConversations={optionsCoachConversations.conversations.map((c) => ({ id: c.id, title: c.title }))}
                    linkableFiles={optionsWorkspaces.activeWorkspaceDetail?.files.map((f) => ({ id: f.id, fileName: f.fileName }))}
                    testId="assistant-notebook-editor"
                  />
                  <NotebookSummaryPanel
                    onSummarize={optionsNotebooks.summarize}
                    onMergeNotes={optionsNotebooks.mergeNotes}
                    onGenerateTakeaways={optionsNotebooks.generateTakeaways}
                    onGenerateActionItems={optionsNotebooks.generateActionItems}
                    onSaveAsNote={(kind, content) => optionsNotebooks.addNote(kind, content)}
                    testId="assistant-notebook-summary-panel"
                  />
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <NotebookEmptyState
                  title="No notebook selected"
                  description="Choose a notebook on the left, or create a new one to start collecting research."
                  testId="assistant-notebook-detail-empty"
                />
              </div>
            )}
          </Card>
        </div>
      ) : (
      <div className="flex-1 flex gap-3 min-h-0">
        {/* v1.5.0 Sprint 7 — AI Workspaces: WorkspaceSidebar (top half)
            groups multiple conversations into a reusable research project;
            ConversationSidebar (bottom half, unchanged from Sprint 6) is
            scoped to whichever workspace is active, or every un-grouped
            conversation when "All conversations" is selected. */}
        <div className="flex w-64 shrink-0 flex-col gap-3">
          <div className="max-h-64 overflow-hidden">
            <WorkspaceSidebar
              workspaces={optionsWorkspaces.workspaces}
              isLoading={optionsWorkspaces.isLoadingWorkspaces}
              activeWorkspaceId={optionsWorkspaces.activeWorkspaceId}
              searchTerm={optionsWorkspaces.searchTerm}
              onSearchChange={optionsWorkspaces.setSearchTerm}
              onCreateWorkspace={optionsWorkspaces.createWorkspaceAnd}
              onSelectWorkspace={optionsWorkspaces.selectWorkspace}
              onClearSelection={optionsWorkspaces.clearSelection}
              onTogglePin={optionsWorkspaces.togglePinById}
              onToggleArchive={optionsWorkspaces.toggleArchiveById}
              onDeleteWorkspace={optionsWorkspaces.deleteWorkspaceById}
              testId="assistant-workspace-sidebar"
            />
          </div>
          <ConversationSidebar
            conversations={optionsCoachConversations.conversations}
            isLoading={optionsCoachConversations.isLoadingConversations}
            activeConversationId={optionsCoachConversations.activeConversationId}
            searchTerm={optionsCoachConversations.searchTerm}
            onSearchChange={optionsCoachConversations.setSearchTerm}
            onNewConversation={optionsCoachConversations.startNewConversation}
            onSelectConversation={optionsCoachConversations.selectConversation}
            onRenameConversation={optionsCoachConversations.renameConversationById}
            onDeleteConversation={optionsCoachConversations.deleteConversationById}
            onToggleFavourite={optionsCoachConversations.toggleFavouriteById}
            testId="assistant-coach-sidebar"
          />
        </div>
      <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
        {optionsWorkspaces.activeWorkspaceDetail && (
          <div className="px-4 pt-4">
            <WorkspaceHeader
              workspace={optionsWorkspaces.activeWorkspaceDetail}
              onTogglePin={(pinned) => optionsWorkspaces.togglePinById(optionsWorkspaces.activeWorkspaceDetail!.id, pinned)}
              onToggleArchive={(archived) => optionsWorkspaces.toggleArchiveById(optionsWorkspaces.activeWorkspaceDetail!.id, archived)}
              onDelete={() => optionsWorkspaces.deleteWorkspaceById(optionsWorkspaces.activeWorkspaceDetail!.id)}
              onAddNote={optionsWorkspaces.addNote}
              onDeleteNote={optionsWorkspaces.deleteNote}
              onAddFile={optionsWorkspaces.addFile}
              onDeleteFile={optionsWorkspaces.deleteFile}
              testId="assistant-workspace-header"
            />
          </div>
        )}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6 pb-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-[80%] rounded-lg" />
                <Skeleton className="h-12 w-[80%] rounded-lg ml-auto" />
              </div>
            ) : messages?.length === 0 ? (
              <div className="text-center text-muted-foreground mt-20">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-20 text-indigo-400" />
                <p className="text-lg text-foreground/80 font-medium">Hello. I am DK Option Engine Coach.</p>
                <p className="text-sm mt-2 mb-8">How can I help you improve your premium selling today?</p>
                
                <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                  <Badge variant="outline" className="px-3 py-2 cursor-pointer hover:bg-secondary border-indigo-500/30 text-indigo-400" onClick={() => coach.send("Explain my latest trade in detail.")}>
                    Explain my latest trade
                  </Badge>
                  <Badge variant="outline" className="px-3 py-2 cursor-pointer hover:bg-secondary border-indigo-500/30 text-indigo-400" onClick={() => coach.send("Quiz me on Iron Condor mechanics.")}>
                    Quiz me on Iron Condors
                  </Badge>
                  <Badge variant="outline" className="px-3 py-2 cursor-pointer hover:bg-secondary border-border" onClick={() => coach.send("What is the best Iron Condor today?")}>
                    Find best Iron Condor
                  </Badge>
                  <Badge variant="outline" className="px-3 py-2 cursor-pointer hover:bg-secondary border-border" onClick={() => coach.send("How delta neutral is my portfolio?")}>
                    Check portfolio delta
                  </Badge>
                </div>
              </div>
            ) : (
              messages?.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`px-4 py-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-secondary text-foreground' : 'bg-indigo-500/10 border border-indigo-500/20 text-foreground'}`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <Markdown className="text-sm">{msg.content}</Markdown>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Optimistic user message + streaming assistant reply */}
            {coach.pendingQuestion && (
              <div className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-secondary">
                  <User size={16} />
                </div>
                <div className="px-4 py-3 rounded-lg max-w-[80%] bg-secondary text-foreground">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{coach.pendingQuestion}</p>
                </div>
              </div>
            )}

            {/* Phase 4, Sprint 59 — an honest failure turn on a genuine
                mid-stream server error, matching the exact onError
                convention StockResearch.tsx/TradingResearch.tsx already
                established (Sprints 30, 48), instead of silently leaving
                pendingUser stuck on screen with no reply. */}
            {coach.erroredReply && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div
                  className="px-4 py-3 rounded-lg max-w-[80%] bg-destructive/10 border border-destructive/30 text-foreground"
                  data-testid="assistant-error-turn"
                >
                  <p className="text-sm">Failed to get an answer — please try again.</p>
                </div>
              </div>
            )}

            {(coach.isStreaming || (coach.stopped && coach.streamingAnswer)) && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                {coach.streamingAnswer ? (
                  <div className="px-4 py-3 rounded-lg max-w-[80%] bg-indigo-500/10 border border-indigo-500/20 text-foreground">
                    <div className="text-sm leading-relaxed">
                      <Markdown className="text-sm inline">{coach.streamingAnswer}</Markdown>
                      {coach.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-indigo-400 animate-pulse" />
                      )}
                    </div>
                    {coach.stopped && (
                      <p className="text-[11px] text-muted-foreground/70 mt-2 flex items-center gap-1">
                        <Square className="w-3 h-3" /> Stopped
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        
        <CardFooter className="p-4 border-t border-border bg-card">
          <form onSubmit={coach.submit} className="flex w-full gap-2">
            <Input
              value={coach.question}
              onChange={e => coach.setQuestion(e.target.value)}
              placeholder="Ask Ravish Coach..."
              className="bg-background border-border flex-1 font-mono text-sm"
              disabled={coach.isStreaming}
              data-testid="assistant-input"
            />
            {coach.isStreaming ? (
              <Button
                type="button"
                onClick={coach.stop}
                size="icon"
                variant="destructive"
                title="Stop generating"
                data-testid="assistant-stop"
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={!coach.question.trim()} size="icon" className="bg-indigo-600 hover:bg-indigo-700" aria-label="Send message" data-testid="assistant-submit">
                <Send className="w-4 h-4" />
              </Button>
            )}
          </form>
        </CardFooter>
      </Card>
      </div>
      )}
    </div>
  );
}
