// v1.5.0 Sprint 3 — Specialist Coach Adapters: Options AI Coach.
//
// Domain: the original Options Income Engine coach, POST /ai/chat/stream
// (routes/ai.ts) — pages/Assistant.tsx (labeled "AI Assistant" in the nav
// since Sprint 1's naming consolidation; still the Options Engine's own
// specialist coach domain underneath). Backend intentionally left
// untouched this sprint: /ai/chat[/stream] mode-dispatches across several
// distinct narrate*() functions plus deterministic templates and bakes
// message persistence directly into the route with its own {id, message,
// createdAt} response shape — a genuinely different shape from the single
// narrate/narrateStream-pair contract createCoachAskHandlers() captures,
// so forcing it into that factory would mean distorting the shared
// abstraction to fit one domain-specific case, which this sprint's own
// "do not force domain-specific logic into generic abstractions"
// instruction rules out.
//
// Grounded in premium-selling mechanics — Greeks (Delta/Theta/Gamma/Vega),
// probability of profit, expected value, trade explanation, quizzes —
// never Trading Engine market-structure data, never Investing Engine
// fundamentals/valuation.

import { AiChatInputMode, AiChatInputLevel } from "@workspace/api-client-react";
import type { CoachConfig } from "../types";

export type OptionsChatMode = "auto" | AiChatInputMode;
export type OptionsChatLevel = AiChatInputLevel;

export interface OptionsCoachParams {
  mode: OptionsChatMode;
  level: OptionsChatLevel;
}

export const optionsCoachConfig: CoachConfig<OptionsCoachParams> = {
  id: "options",
  displayName: "Options AI Coach",
  description: "Free-form Q&A about premium selling, Greeks, probability of profit, and expected value — mode and depth selectable.",
  capabilities: ["greeks", "probability-of-profit", "expected-value", "trade-explanation", "quiz"],
  endpoint: "/ai/chat/stream",
  buildRequestBody: (question, { mode, level }) => ({
    message: question,
    mode: mode === "auto" ? undefined : mode,
    level,
  }),
  starterPrompts: () => ["Explain my latest trade in detail.", "Quiz me on premium selling."],
};
