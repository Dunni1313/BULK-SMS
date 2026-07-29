// v1.5.0 Sprint 2 — AI Coach Architecture Consolidation, Framework
// (Frontend). The shared conversation engine every specialist AI Coach
// surface in this app now builds on. Before this sprint, this exact state
// machine (question input, an in-flight optimistic bubble, streamed-delta
// accumulation, an abort controller + Stop button, an honest error turn,
// retry-last-question) was hand-duplicated six times:
//
//   - TradingCoachWorkspace.tsx (the dockable "AI Trading Assistant")
//   - pages/Assistant.tsx (the original Options Engine "AI Assistant")
//   - pages/TradeWorkspace.tsx's embedded deterministic-coach panel
//   - pages/MarketStructureWorkbench.tsx's embedded panel
//   - pages/TradePlanningStudio.tsx's embedded panel
//   - pages/LiquidityWorkbench.tsx's embedded panel
//
// The last four were byte-for-byte identical (same state variable names,
// same handler shape, same POST /trading/coach/ask/stream endpoint) aside
// from cosmetic strings (placeholder text, empty-state copy, data-testid
// prefixes). The first two share the same fuller state machine (an
// AbortController-backed Stop button, a distinct honest error-turn flag,
// retry-last-question, and a server-persisted message list the hook
// itself never needs to know about).
//
// This hook is deliberately endpoint/body/answer-shape agnostic
// (`endpoint`/`buildRequestBody`/`extractAnswer` are all caller-supplied)
// so it serves every existing coach's own wire format without forcing a
// new shared request contract onto any of them — the six refactored call
// sites all still hit the exact same six existing backend routes, with
// the exact same request bodies, unchanged.
//
// Design note on `history` vs. server-persisted messages: this hook
// always accumulates completed turns into its own local `history` array.
// A page whose history is server-persisted (TradingCoachWorkspace,
// Assistant.tsx) simply never reads `history` — it renders its own
// fetched message list instead, and only consumes `pendingQuestion` /
// `streamingAnswer` / `isStreaming` / `stopped` / `erroredReply` for the
// "in-flight, not yet persisted" bubble, using `onAnswered` to invalidate
// its own query cache once the turn actually persists server-side. A page
// with no server persistence (the four embedded Workbench panels) instead
// renders `history` directly and ignores `erroredReply`/`stopped` — this
// hook always maintains both representations of a failure (an appended
// history turn using the same wording those four panels already used,
// AND the distinct `erroredReply` flag TradingCoachWorkspace/Assistant.tsx
// already used), so each existing consumer keeps working from the same
// single hook without either behavior changing.

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { streamCoach } from "@/lib/coach-stream";
import type { CoachTurn } from "./types";

/** Every existing coach's `done` SSE payload already carries an `answer`
 * field — this is the shared default extractAnswer(), used whenever a
 * caller doesn't supply its own. */
function defaultExtractAnswer(data: unknown): string | undefined {
  if (data && typeof data === "object" && "answer" in data) {
    return String((data as { answer: unknown }).answer);
  }
  return undefined;
}

export interface UseCoachConversationOptions {
  /** The streaming endpoint path, passed straight to streamCoach() (which
   * already prefixes it with /api) — e.g. "/trading-coach/ask/stream". */
  endpoint: string;
  /** Builds the POST body for a given question. Every existing coach
   * endpoint expects a different shape (symbol+question, message+mode+
   * level, question+symbol+scannerCandidateId+tradingPositionId, …), so
   * this stays a plain caller-supplied function — re-evaluated on every
   * send, so it always sees the caller's latest closed-over state (e.g. a
   * changed `symbol` or `focus`). */
  buildRequestBody: (question: string) => unknown;
  /** True while sending should be blocked entirely (e.g. no symbol
   * selected yet) — mirrors every existing coach's own `!symbol` guard. */
  disabled?: boolean;
  /** Reads the final answer text off the SSE `done` payload. Every
   * existing coach's `done` event already carries an `answer` field, so
   * the default reads that; falls back to the accumulated streamed text
   * if the field is missing, never fabricating an empty answer. */
  extractAnswer?: (doneData: unknown) => string | undefined;
  /** The honest failure-turn text — matches every existing coach's own
   * "Failed to get an answer" wording exactly unless overridden. */
  errorMessage?: string;
  /** Called once a turn completes successfully (never on error), after
   * it's already been appended to this hook's own `history` — e.g. to
   * invalidate a server-persisted message list. Never required for a page
   * that only needs local `history`. */
  onAnswered?: (turn: CoachTurn) => void;
}

export interface UseCoachConversationResult {
  question: string;
  setQuestion: (value: string) => void;
  /** Every turn this hook has completed. A page rendering server-
   * persisted history instead may simply ignore this. */
  history: CoachTurn[];
  /** The question currently in flight, or null once it's settled. */
  pendingQuestion: string | null;
  /** The accumulated streamed answer text for the in-flight question. */
  streamingAnswer: string;
  isStreaming: boolean;
  /** True once the user has explicitly called stop() for the current (or
   * most recent) turn — mirrors the exact "Stopped" badge convention
   * TradingCoachWorkspace.tsx/Assistant.tsx already use. */
  stopped: boolean;
  /** True after a genuine mid-stream/server error — the distinct flag
   * TradingCoachWorkspace.tsx/Assistant.tsx already render a dedicated
   * error turn from. */
  erroredReply: boolean;
  /** Sends the given question, or the current `question` field if
   * omitted. No-ops when empty, already streaming, or `disabled`. */
  send: (question?: string) => void;
  /** Convenience `<form onSubmit>` handler — preventDefault() then
   * send(). */
  submit: (e: FormEvent) => void;
  /** Aborts the in-flight request, leaving the partial streamed answer
   * visible (never discarded) and setting `stopped`. */
  stop: () => void;
  /** Resends the most recently sent question — a no-op if none exists. */
  retry: () => void;
  /** Clears the in-flight/error transient state — `pendingQuestion` back to
   * null, `streamingAnswer` back to "", `stopped`/`erroredReply` back to
   * false. Mirrors TradingCoachWorkspace.tsx's own pre-existing
   * `handleClearConversation()` exactly; deliberately never touches
   * `history` or aborts an in-flight request, since no existing caller
   * needs either. */
  reset: () => void;
}

export function useCoachConversation(options: UseCoachConversationOptions): UseCoachConversationResult {
  const { endpoint, buildRequestBody, disabled, extractAnswer, errorMessage, onAnswered } = options;

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<CoachTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [erroredReply, setErroredReply] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string | null>(null);
  // A ref mirror of streamingAnswer so the onDone handler (whose own
  // closure is fixed at send-time) always reads the truly-latest
  // accumulated text for the "no answer field in the payload" fallback,
  // never a stale value captured before the last delta arrived.
  const streamingAnswerRef = useRef("");

  useEffect(() => () => abortRef.current?.abort(), []);

  const failureMessage = errorMessage ?? "Failed to get an answer — please try again.";

  const send = useCallback(
    (explicitQuestion?: string) => {
      const q = (explicitQuestion ?? question).trim();
      if (!q || isStreaming || disabled) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      lastQuestionRef.current = q;
      streamingAnswerRef.current = "";
      setQuestion("");
      setPendingQuestion(q);
      setStreamingAnswer("");
      setStopped(false);
      setErroredReply(false);
      setIsStreaming(true);

      streamCoach(
        endpoint,
        buildRequestBody(q),
        {
          onDelta: (text) => {
            streamingAnswerRef.current += text;
            setStreamingAnswer((prev) => prev + text);
          },
          onDone: (data) => {
            const extract = extractAnswer ?? defaultExtractAnswer;
            const answer = extract(data) ?? streamingAnswerRef.current;
            const turn: CoachTurn = { question: q, answer };
            setHistory((prev) => [...prev, turn]);
            setIsStreaming(false);
            setPendingQuestion(null);
            setStreamingAnswer("");
            onAnswered?.(turn);
          },
          onError: () => {
            setHistory((prev) => [...prev, { question: q, answer: failureMessage }]);
            setStreamingAnswer("");
            setIsStreaming(false);
            setErroredReply(true);
          },
        },
        controller.signal,
      ).catch(() => {
        // An abort lands here too — keep the partial reply visible.
        setIsStreaming(false);
      });
    },
    [endpoint, buildRequestBody, disabled, extractAnswer, failureMessage, isStreaming, onAnswered, question],
  );

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      send();
    },
    [send],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStopped(true);
  }, []);

  const retry = useCallback(() => {
    if (lastQuestionRef.current) send(lastQuestionRef.current);
  }, [send]);

  const reset = useCallback(() => {
    setPendingQuestion(null);
    setStreamingAnswer("");
    setStopped(false);
    setErroredReply(false);
  }, []);

  return {
    question,
    setQuestion,
    history,
    pendingQuestion,
    streamingAnswer,
    isStreaming,
    stopped,
    erroredReply,
    send,
    submit,
    stop,
    retry,
    reset,
  };
}
