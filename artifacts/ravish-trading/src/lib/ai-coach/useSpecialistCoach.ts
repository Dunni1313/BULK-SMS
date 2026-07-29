// v1.5.0 Sprint 3 — Specialist Coach Adapters. The thin adapter that turns a
// declarative CoachConfig<TParams> into a working useCoachConversation()
// instance — the one place `config.endpoint`/`config.buildRequestBody`/
// `config.isDisabled`/`config.errorMessage` actually get wired into the
// Sprint 2 conversation engine. Every specialist coach page calls this
// instead of constructing its own useCoachConversation({...}) options
// object inline, so "what this coach answers" (the config) stays separate
// from "how a conversation is streamed/retried/stopped" (the shared hook).

import { useCoachConversation, type UseCoachConversationResult } from "./useCoachConversation";
import type { CoachConfig, CoachTurn } from "./types";

export function useSpecialistCoach<TParams>(
  config: CoachConfig<TParams>,
  params: TParams,
  options?: { onAnswered?: (turn: CoachTurn) => void },
): UseCoachConversationResult {
  return useCoachConversation({
    endpoint: config.endpoint,
    buildRequestBody: (question) => config.buildRequestBody(question, params),
    disabled: config.isDisabled?.(params),
    errorMessage: config.errorMessage,
    onAnswered: options?.onAnswered,
  });
}
