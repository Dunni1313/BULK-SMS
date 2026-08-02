// v1.5.0 Sprint 4 — AI Context & Tools Consolidation. Proves each coach's
// `ContextProvider` (CoachConfig.buildRequestBody, Sprint 3's own field,
// now given the explicit ContextProvider<TParams> type alias) genuinely
// only reads its own declared params shape — never reaches into another
// coach's fields, even when a superset object containing every other
// coach's own param fields is deliberately handed to it. This is the
// direct, structural proof of "context providers remain isolated,"
// complementing useSpecialistCoach.test.ts's own runtime hook-level
// isolation proof (Sprint 3) at the pure-function level.

import { describe, it, expect } from "vitest";
import { tradingCoachConfig } from "./coaches/tradingCoach.config";
import { investingCoachConfig } from "./coaches/investingCoach.config";
import { optionsCoachConfig } from "./coaches/optionsCoach.config";
import { AiChatInputLevel } from "@workspace/api-client-react";

// A deliberately over-stuffed params object carrying every field any of
// the 3 coaches' own TParams shapes could ever read (symbol, mode, level),
// so a context provider that accidentally read a field outside its own
// contract would be caught red-handed by an unexpected key in its output.
const supersetParams = {
  symbol: "AAPL",
  mode: "teach_greeks" as const,
  level: AiChatInputLevel.advanced,
};

describe("ContextProvider isolation — each coach's buildRequestBody only reads its own declared params", () => {
  it("Trading AI Coach's context provider produces only {symbol, question} — no mode/level leakage", () => {
    const body = tradingCoachConfig.buildRequestBody("a question", supersetParams);
    expect(body).toEqual({ symbol: "AAPL", question: "a question" });
  });

  it("Investing AI Coach's context provider produces only {symbol, question} — no mode/level leakage", () => {
    const body = investingCoachConfig.buildRequestBody("a question", supersetParams);
    expect(body).toEqual({ symbol: "AAPL", question: "a question" });
  });

  it("Options AI Coach's context provider produces only {message, mode, level} — no symbol leakage", () => {
    const body = optionsCoachConfig.buildRequestBody("a question", supersetParams);
    expect(body).toEqual({ message: "a question", mode: "teach_greeks", level: AiChatInputLevel.advanced });
    expect(body).not.toHaveProperty("symbol");
  });

  it("Options' body shape never matches Trading's or Investing's (mode/level vs. symbol) — the two symbol-scoped coaches legitimately share the same {symbol, question} shape, since both ground their answers in a single searched symbol", () => {
    const tradingBody = tradingCoachConfig.buildRequestBody("shared question", supersetParams);
    const investingBody = investingCoachConfig.buildRequestBody("shared question", supersetParams);
    const optionsBody = optionsCoachConfig.buildRequestBody("shared question", supersetParams);

    expect(tradingBody).toEqual(investingBody);
    expect(JSON.stringify(optionsBody)).not.toBe(JSON.stringify(tradingBody));
    expect(JSON.stringify(optionsBody)).not.toBe(JSON.stringify(investingBody));
  });
});
