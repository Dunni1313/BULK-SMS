// v1.3.1 — AI Trading Coach, Frontend UI. Renders conversation history +
// in-flight streaming state. Mirrors pages/Assistant.tsx's own established
// message-rendering pattern (Sprint 59) closely — persisted history first,
// then an optimistic pending-user bubble, then the streaming/error/loading
// reply — reusing the same Markdown renderer for assistant prose.
//
// A note on "Coach response structure" (Observation/Explanation/Risks/
// Questions to consider/Educational next step): this component renders
// whatever markdown the answer text actually contains — it cannot enforce
// that shape itself, since the underlying narration prompt
// (coachLLM.ts's narrateTradeFreeform/Stream, Sprint 1, out of scope for
// this UI-only sprint) is unmodified. When the model's own prose uses
// headings for these sections, the shared Markdown component already
// renders them with clear visual hierarchy (see components/ui/markdown.tsx's
// prose-headings classes) — this is advisory formatting, not an enforced
// contract, and is disclosed as such in the completion report.

import { useEffect, useRef } from "react";
import { Bot, User, Square } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";
import { TradingCoachEmptyState } from "./TradingCoachEmptyState";
import { TradingCoachErrorState } from "./TradingCoachErrorState";
import type { UnifiedTradingCoachMessage } from "@workspace/api-client-react";

export interface TradingCoachMessagesProps {
  isLoadingHistory: boolean;
  messages: UnifiedTradingCoachMessage[];
  pendingUserMessage: string | null;
  streamingReply: string;
  isStreaming: boolean;
  stopped: boolean;
  erroredReply: boolean;
  onRetry: () => void;
}

function Bubble({ role, children, testId }: { role: "user" | "assistant"; children: React.ReactNode; testId?: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`} data-testid={testId}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-secondary" : "bg-indigo-500/20 text-indigo-400"
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-secondary text-foreground" : "border border-indigo-500/20 bg-indigo-500/10 text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function TradingCoachMessages({
  isLoadingHistory,
  messages,
  pendingUserMessage,
  streamingReply,
  isStreaming,
  stopped,
  erroredReply,
  onRetry,
}: TradingCoachMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isStreaming, streamingReply, pendingUserMessage, erroredReply]);

  const isEmpty =
    !isLoadingHistory && messages.length === 0 && !pendingUserMessage && !streamingReply && !erroredReply && !isStreaming;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="trading-coach-messages">
      {isLoadingHistory ? (
        <div className="space-y-3" data-testid="trading-coach-loading-history">
          <Skeleton className="h-10 w-[70%] rounded-lg" />
          <Skeleton className="ml-auto h-10 w-[70%] rounded-lg" />
        </div>
      ) : isEmpty ? (
        <TradingCoachEmptyState />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} testId={`trading-coach-message-${m.id}`}>
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
              ) : (
                <Markdown className="text-sm">{m.message}</Markdown>
              )}
            </Bubble>
          ))}

          {pendingUserMessage && (
            <Bubble role="user" testId="trading-coach-pending-user">
              <p className="whitespace-pre-wrap leading-relaxed">{pendingUserMessage}</p>
            </Bubble>
          )}

          {erroredReply && <TradingCoachErrorState onRetry={onRetry} />}

          {(isStreaming || (stopped && streamingReply)) && (
            <Bubble role="assistant" testId="trading-coach-streaming">
              {streamingReply ? (
                <div className="leading-relaxed">
                  <Markdown className="inline text-sm">{streamingReply}</Markdown>
                  {isStreaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-indigo-400 align-middle" />}
                  {stopped && (
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <Square className="h-2.5 w-2.5" /> Stopped
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1" data-testid="trading-coach-thinking">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "0.15s" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: "0.3s" }} />
                </div>
              )}
            </Bubble>
          )}
        </div>
      )}
    </div>
  );
}
