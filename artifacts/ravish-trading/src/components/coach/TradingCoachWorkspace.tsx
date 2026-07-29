// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only), Frontend UI (approved design doc:
// docs/v1.3.0-AI-Trading-Coach-Design.md, §2–§7). The orchestrator: owns
// every hook and every piece of local state, composing the small
// presentational sub-components below it. Reused identically by
// TradingCoachPanel.tsx (the dockable Sheet) and pages/AITradingCoach.tsx
// (the full-page surface) — the only difference between the two call
// sites is whether an `onClose` handler is supplied.
//
// v1.5.0 Sprint 2 — AI Coach Framework: the streaming/message-send state
// machine (question input, in-flight optimistic bubble, streamed-delta
// accumulation, AbortController + Stop, honest error turn, retry) is now
// the shared useCoachConversation() hook rather than hand-duplicated
// local state — identical wire behavior: the same endpoint
// (POST /trading-coach/ask/stream), the same request body (question +
// whatever optional symbol/scannerCandidateId/tradingPositionId the
// TradingCoachProvider's current `focus` holds), and the same SSE
// `meta -> delta... -> done -> error` contract via streamCoach() under
// the hood. Persisted history still comes from the real, already-shipped
// GET /trading-coach/messages via the generated
// useGetUnifiedTradingCoachMessages() hook — this workspace never reads
// the shared hook's own local `history`, only its in-flight/error state,
// exactly as documented in useCoachConversation.ts's own header comment.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetUnifiedTradingCoachMessages, getGetUnifiedTradingCoachMessagesQueryKey } from "@workspace/api-client-react";
import { useCoachConversation } from "@/lib/ai-coach/useCoachConversation";
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

  // A view-only "clear conversation" cutoff — never a server delete (Sprint
  // 1's backend has no such endpoint). Resets to null (nothing hidden)
  // whenever this workspace mounts fresh, matching the deliberately
  // ephemeral, disclosed nature of "Clear conversation."
  const [clearedAt, setClearedAt] = useState<string | null>(null);

  const coach = useCoachConversation({
    endpoint: "/trading-coach/ask/stream",
    buildRequestBody: (question) => ({
      question,
      symbol: focus.symbol,
      scannerCandidateId: focus.scannerCandidateId,
      tradingPositionId: focus.tradingPositionId,
    }),
    onAnswered: () => {
      queryClient.invalidateQueries({ queryKey: getGetUnifiedTradingCoachMessagesQueryKey() });
    },
  });

  const visibleMessages = (messages ?? []).filter((m) => !clearedAt || m.createdAt > clearedAt);

  function handleClearConversation() {
    setClearedAt(new Date().toISOString());
    coach.reset();
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
        pendingUserMessage={coach.pendingQuestion}
        streamingReply={coach.streamingAnswer}
        isStreaming={coach.isStreaming}
        stopped={coach.stopped}
        erroredReply={coach.erroredReply}
        onRetry={coach.retry}
      />

      {hasHistory && !coach.isStreaming && <TradingCoachSuggestedActions actions={suggestedActions} />}

      <TradingCoachSuggestedPrompts prompts={suggestedPrompts} onSelect={coach.send} disabled={coach.isStreaming} />

      <TradingCoachComposer
        value={coach.question}
        onChange={coach.setQuestion}
        onSubmit={coach.submit}
        onStop={coach.stop}
        onClearConversation={handleClearConversation}
        isStreaming={coach.isStreaming}
        hasHistory={hasHistory}
      />

      <TradingCoachDisclaimer />
    </div>
  );
}
