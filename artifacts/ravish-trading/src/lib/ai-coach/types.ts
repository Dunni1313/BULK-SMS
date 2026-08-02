// v1.5.0 Sprint 2 — AI Coach Architecture Consolidation, Framework
// (Frontend). Shared types for the reusable conversation engine
// (useCoachConversation.ts) that every specialist AI Coach surface in this
// app is built on: the dockable "AI Trading Assistant" (TradingCoachWorkspace),
// the original Options Engine "AI Assistant" (Assistant.tsx), and the four
// embedded deterministic-coach panels on TradeWorkspace.tsx,
// MarketStructureWorkbench.tsx, TradePlanningStudio.tsx, and
// LiquidityWorkbench.tsx.

/** One completed question/answer exchange. */
export interface CoachTurn {
  question: string;
  answer: string;
}

// v1.5.0 Sprint 3 — Specialist Coach Adapters. The declarative "adapter
// contract" every specialist AI Coach's call site now builds from, instead
// of inlining its own endpoint string/request-body literal/error text
// directly into a useCoachConversation() call. `TParams` is whatever
// per-call-site state that specific coach's own page already owns (a
// searched symbol, a selected mode/level, ...) — the config never reads
// component state itself, it only describes how to turn (question, params)
// into a request and how to present the coach, so a page's own state
// management is completely unaffected by adopting a config.
export interface CoachConfig<TParams> {
  /** Unique id, e.g. "trading" | "investing" | "options". */
  id: string;
  /** Human display name, e.g. "Trading AI Coach". */
  displayName: string;
  /** One-line description of what this coach answers and what grounds it —
   * shown to a reader of the config, not necessarily rendered verbatim in
   * the UI (each page keeps its own existing copy). */
  description: string;
  /** The specialist-only data/analysis this coach's answers are grounded
   * in. Documents context/tool isolation: no two coaches' configs list the
   * same capability, and no coach's buildRequestBody reads another
   * coach's params type. */
  capabilities: readonly string[];
  /** The SSE streaming endpoint path, passed straight through to
   * useCoachConversation → streamCoach(). Unchanged from each coach's own
   * pre-existing endpoint. */
  endpoint: string;
  /** Builds this coach's own request body from a question plus its own
   * call-site params — the coach's "context provider." */
  buildRequestBody: (question: string, params: TParams) => unknown;
  /** True while this coach should refuse to send (e.g. no symbol chosen
   * yet). Omit for a coach that's always available once rendered. */
  isDisabled?: (params: TParams) => boolean;
  /** The honest failure-turn text on a genuine mid-stream error. Omit to
   * fall back to useCoachConversation's own default wording. */
  errorMessage?: string;
  /** Optional canned starter questions, derived from the coach's own
   * params (e.g. interpolating the current symbol). */
  starterPrompts?: (params: TParams) => string[];
}
