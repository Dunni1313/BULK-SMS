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
import { Send, Bot, User, BrainCircuit, Lightbulb, BookOpen, GraduationCap, Sparkles, FileText, Square } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSpecialistCoach } from "@/lib/ai-coach/useSpecialistCoach";
import { optionsCoachConfig } from "@/lib/ai-coach/coaches/optionsCoach.config";
import { useCoachConversations } from "@/lib/ai-coach/useCoachConversations";
import { ConversationSidebar } from "@/lib/ai-coach/ConversationSidebar";
import { useAiWorkspaces } from "@/lib/ai-coach/useAiWorkspaces";
import { WorkspaceSidebar } from "@/lib/ai-coach/WorkspaceSidebar";
import { WorkspaceHeader } from "@/lib/ai-coach/WorkspaceHeader";
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
    </div>
  );
}
