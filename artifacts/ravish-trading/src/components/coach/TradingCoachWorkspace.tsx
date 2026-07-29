// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only), Frontend UI (approved design doc:
// docs/v1.3.0-AI-Trading-Coach-Design.md, §2–§7). The orchestrator: owns
// every hook and every piece of local state, composing the small
// presentational sub-components below it. Reused identically by
// TradingCoachPanel.tsx (the dockable Sheet) and pages/AITradingCoach.tsx
// (the full-page surface) — the only difference between the two call
// sites is whether an `onClose` handler is supplied.
//
// Streaming/message-send logic mirrors pages/Assistant.tsx's own
// established pattern (Sprint 59) exactly: local pendingUser/
// streamingReply/isStreaming/stopped/erroredReply state, an AbortController
// ref, and streamCoach() against the SSE `meta -> delta... -> done -> error`
// contract — the ONLY difference is the endpoint
// (POST /trading-coach/ask/stream, Sprint 1) and the request body, which
// additionally carries whatever optional symbol/scannerCandidateId/
// tradingPositionId the TradingCoachProvider's current `focus` holds.
// Persisted history comes from the real, already-shipped
// GET /trading-coach/messages via the generated
// useGetUnifiedTradingCoachMessages() hook.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetUnifiedTradingCoachMessages, getGetUnifiedTradingCoachMessagesQueryKey } from "@workspace/api-client-react";
import { streamCoach } from "@/lib/coach-stream";
import { useTradingCoach } from "@/hooks/use-trading-coach";
import { getSuggestedPrompts, getSuggestedActions } from "@/lib/trading-coach-context";
import { TradingCoachHeader } from "./TradingCoachHeader";
import { TradingCoachContextPanel } from "./TradingCoachContextPanel";
import { TradingCoachMessages } from "./TradingCoachMessages";
import { TradingCoachSuggestedPrompts } from "./TradingCoachSuggestedPrompts";
import { TradingCoachSuggestedActions } from "./TradingCoachSuggestedActions";
import { TradingCoachComposer } from "./TradingCoachComposer";
import { TradingCoachDisclaimer } from "./TradingCoachDisclaimer";

export function TradingCoachWorkspace({ onClose }: { onClose?: () => void }) {
  const { focus, clearFocus } = useTradingCoach();
  const queryClient = useQueryClient();

  const { data: messages, isLoading: isLoadingHistory } = useGetUnifiedTradingCoachMessages();

  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [erroredReply, setErroredReply] = useState(false);
  // A view-only "clear conversation" cutoff — never a server delete (Sprint
  // 1's backend has no such endpoint). Resets to null (nothing hidden)
  // whenever this workspace mounts fresh, matching the deliberately
  // ephemeral, disclosed nature of "Clear conversation."
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string | null>(null);

  const visibleMessages = (messages ?? []).filter((m) => !clearedAt || m.createdAt > clearedAt);

  function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    lastQuestionRef.current = trimmed;
    setInput("");
    setPendingUserMessage(trimmed);
    setStreamingReply("");
    setStopped(false);
    setErroredReply(false);
    setIsStreaming(true);

    streamCoach(
      "/trading-coach/ask/stream",
      {
        question: trimmed,
        symbol: focus.symbol,
        scannerCandidateId: focus.scannerCandidateId,
        tradingPositionId: focus.tradingPositionId,
      },
      {
        onDelta: (text) => setStreamingReply((prev) => prev + text),
        onDone: () => {
          queryClient.invalidateQueries({ queryKey: getGetUnifiedTradingCoachMessagesQueryKey() });
          setIsStreaming(false);
          setPendingUserMessage(null);
          setStreamingReply("");
        },
        onError: () => {
          setIsStreaming(false);
          setErroredReply(true);
        },
      },
      controller.signal,
    ).catch(() => {
      // An abort lands here too — keep the partial reply visible.
      setIsStreaming(false);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStopped(true);
  }

  function handleRetry() {
    if (lastQuestionRef.current) send(lastQuestionRef.current);
  }

  function handleClearConversation() {
    setClearedAt(new Date().toISOString());
    setPendingUserMessage(null);
    setStreamingReply("");
    setErroredReply(false);
    setStopped(false);
  }

  const suggestedPrompts = getSuggestedPrompts(focus);
  const suggestedActions = getSuggestedActions(focus);
  const hasHistory = visibleMessages.length > 0;

  return (
    <div className="flex h-full flex-col gap-3" data-testid="trading-coach-workspace">
      <TradingCoachHeader onClose={onClose} />
      <TradingCoachContextPanel focus={focus} onClearFocus={clearFocus} />

      <TradingCoachMessages
        isLoadingHistory={isLoadingHistory}
        messages={visibleMessages}
        pendingUserMessage={pendingUserMessage}
        streamingReply={streamingReply}
        isStreaming={isStreaming}
        stopped={stopped}
        erroredReply={erroredReply}
        onRetry={handleRetry}
      />

      {hasHistory && !isStreaming && <TradingCoachSuggestedActions actions={suggestedActions} />}

      <TradingCoachSuggestedPrompts prompts={suggestedPrompts} onSelect={send} disabled={isStreaming} />

      <TradingCoachComposer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={handleStop}
        onClearConversation={handleClearConversation}
        isStreaming={isStreaming}
        hasHistory={hasHistory}
      />

      <TradingCoachDisclaimer />
    </div>
  );
}
