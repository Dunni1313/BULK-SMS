// AI Trading Coach — LLM narration layer.
//
// This is the "prose" half of the hybrid coach. It takes the deterministic facts
// produced by coach.ts and asks the model to narrate them in plain English. It
// NEVER computes its own numbers, and it NEVER advises placing a trade. If the
// model is unavailable (no key, network/error), it degrades gracefully to a
// deterministic template so every endpoint always returns a useful answer.
//
// Provider-agnostic: ANTHROPIC_API_KEY selects the Anthropic SDK if set. Otherwise,
// OPENAI_API_KEY is used — normally for the OpenAI SDK, but for backward
// compatibility with deployments that predate the ANTHROPIC_API_KEY split, it may
// still hold an Anthropic key (sk-ant-... prefix), in which case a startup warning
// is logged and the Anthropic SDK is used instead. Prefer ANTHROPIC_API_KEY going
// forward; the sk-ant- fallback is a deprecated legacy path.

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";
import {
  COACH_DISCLAIMER,
  type TradeExplanation,
  type GreekLesson,
} from "./coach.js";
import { VALUE_DISCLAIMER } from "./valueReport.js";

const OPENAI_MODEL = process.env.OPENAI_COACH_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_COACH_MODEL || "claude-haiku-4-5-20251001";

type Provider = "openai" | "anthropic" | null;

let provider: Provider = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let initialized = false;

function init(): void {
  if (initialized) return;
  initialized = true;

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    provider = "anthropic";
    anthropicClient = new Anthropic({ apiKey: anthropicKey });
    return;
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    provider = null;
    return;
  }
  if (key.startsWith("sk-ant-")) {
    logger.warn(
      "coachLLM: OPENAI_API_KEY holds an Anthropic key (sk-ant- prefix). " +
        "This overload is deprecated — set ANTHROPIC_API_KEY instead. " +
        "Continuing to work via the legacy fallback for now.",
    );
    provider = "anthropic";
    anthropicClient = new Anthropic({ apiKey: key });
  } else {
    provider = "openai";
    openaiClient = new OpenAI({ apiKey: key });
  }
}

export function llmAvailable(): boolean {
  init();
  return provider !== null;
}

// ─── Concurrency hardening ───────────────────────────────────────────────────
// Coach LLM calls take ~10-20s. Under concurrent load they used to pile up and
// surface as 502 gateway timeouts / blank cards. Three guards prevent that:
//   1. a hard per-call timeout that aborts a hung request so it degrades to the
//      deterministic template instead of hanging forever,
//   2. a short-lived cache keyed by the lesson/trade so repeat asks are instant,
//   3. single-flight dedup so N concurrent identical asks share ONE LLM call.

const LLM_TIMEOUT_MS = Number(process.env.COACH_LLM_TIMEOUT_MS) || 25_000;
const CACHE_MAX = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  text: string;
  expires: number;
  // When this narration was generated (epoch ms). Surfaced to the UI so users
  // can tell a freshly generated take from a previously cached one.
  createdAt: number;
}

// Shared by both the streaming and non-streaming narration paths so a result
// produced by one serves the other.
const narrationCache = new Map<string, CacheEntry>();
// In-flight LLM calls keyed by cache key. Resolves with the final (disclaimer-
// enforced) text, or null if the LLM produced nothing usable.
const inflight = new Map<string, Promise<string | null>>();

function cacheGet(key: string): CacheEntry | null {
  const e = narrationCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    narrationCache.delete(key);
    return null;
  }
  // Refresh recency for a simple LRU eviction order.
  narrationCache.delete(key);
  narrationCache.set(key, e);
  return e;
}

function cacheSet(key: string, text: string): void {
  narrationCache.set(key, { text, expires: Date.now() + CACHE_TTL_MS, createdAt: Date.now() });
  while (narrationCache.size > CACHE_MAX) {
    const oldest = narrationCache.keys().next().value;
    if (oldest === undefined) break;
    narrationCache.delete(oldest);
  }
}

// Abort signal that fires after `ms`, with a cleanup to clear the timer once the
// call settles. Aborting makes the SDK throw, which our catch turns into a
// template fallback.
function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

const SYSTEM_PROMPT = `You are the Ravish Trading Coach — a patient, rigorous options-trading TUTOR. Your job is to TEACH and EXPLAIN, never to advise.

Hard rules:
- You are an educator, not a broker or advisor. NEVER tell the user to buy, sell, place, submit, or execute a trade. NEVER say "you should take this trade".
- Use ONLY the numbers in the provided DATA. Do not invent or estimate any figure not present in the data.
- Explain the *why* behind the mechanics (POP, EV, the Greeks, max loss, assignment) in clear, plain English a motivated beginner can follow.
- Be concise and structured. Prefer short paragraphs or tight bullet points.
- The Ravish Engine never executes trades automatically; any order is a manual decision the user makes on the Trade Ticket. Reinforce this if execution comes up.`;

export type NarrationSource = "llm" | "template";

export interface Narration {
  text: string;
  source: NarrationSource;
  // True when the text was served from the in-memory cache rather than freshly
  // generated this call. Undefined for the deterministic template path.
  cached?: boolean;
  // When the narration was generated (epoch ms). Present on the LLM path only.
  generatedAt?: number;
}

// Optional explanation depth. Threaded into the prompt and the cache key so a
// beginner and an advanced ask for the same lesson don't share a cached answer.
export type CoachLevel = "beginner" | "advanced";

function levelInstruction(level?: CoachLevel): string {
  if (level === "beginner")
    return " Explain at a BEGINNER depth: assume little prior options knowledge, define any jargon you use, and keep it simple and encouraging.";
  if (level === "advanced")
    return " Explain at an ADVANCED depth: assume the reader already knows options basics; be concise, precise, and focus on the nuanced trade-offs.";
  return "";
}

function levelKey(level?: CoachLevel): string {
  return level ? `:${level}` : "";
}

// Callback that receives incremental text chunks as the model streams them.
export type TokenSink = (chunk: string) => void;

// Unified single-shot completion across providers. Returns null on any failure
// so callers fall back to their deterministic template.
async function complete(
  userContent: string,
  maxTokens: number,
  opts: { json?: boolean } = {},
): Promise<string | null> {
  init();
  const { signal, done } = withTimeout(LLM_TIMEOUT_MS);
  try {
    if (provider === "anthropic" && anthropicClient) {
      const sys = opts.json
        ? `${SYSTEM_PROMPT}\n\nRespond ONLY with a single valid JSON object, no prose or code fences.`
        : SYSTEM_PROMPT;
      const resp = await anthropicClient.messages.create(
        {
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          system: sys,
          messages: [{ role: "user", content: userContent }],
        },
        { signal },
      );
      const block = resp.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text.trim() : null;
    }
    if (provider === "openai" && openaiClient) {
      const resp = await openaiClient.chat.completions.create(
        {
          model: OPENAI_MODEL,
          max_completion_tokens: maxTokens,
          ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        },
        { signal },
      );
      return resp.choices[0]?.message?.content?.trim() ?? null;
    }
    return null;
  } catch (err) {
    logger.warn({ err, provider }, "coach LLM completion failed; using template fallback");
    return null;
  } finally {
    done();
  }
}

// Safety invariant: every narration must carry the coach disclaimer — on BOTH the
// LLM path AND the deterministic template/fallback path. The model is instructed to
// include it, but enforce it deterministically so neither an LLM response nor a
// template (which may carry only a feature-specific advisory like
// ADJUSTMENT_DISCLAIMER) can ever ship without the standard COACH_DISCLAIMER.
export function enforceDisclaimer(text: string): string {
  return text.includes(COACH_DISCLAIMER) ? text : `${text}\n\n${COACH_DISCLAIMER}`;
}

// Task #66 value-narration safety. Two invariants the prompt alone cannot guarantee:
//   1. The VALUE_DISCLAIMER (carries SIMULATED + "not Warren Buffett or any real
//      person" + "does not execute trades") must always be present.
//   2. The narrator must never impersonate a real person in the first person.
// If the LLM ever claims to BE Buffett (or any persona), we discard its prose and
// fall back to the deterministic template — prose is commentary only, never the
// sole carrier of a safety claim.
// Conservative: only flag first-person impersonation framings ("I am Buffett",
// "I'm Warren Buffett", "speaking as Buffett", "this is Warren Buffett"). A bare
// "as Buffett would say" is legitimate commentary, NOT impersonation, so it is
// deliberately excluded to avoid discarding good prose — the always-appended
// VALUE_DISCLAIMER ("it is not Warren Buffett or any real person") is the backstop.
const IMPERSONATION_RE =
  /\b(?:i\s*am|i'?m|speaking\s+as|this\s+is)\s+(?:warren\s+)?buffett\b|\bi\s+am\s+(?:a\s+)?real\s+(?:person|investor)\b/i;

export function violatesAntiImpersonation(text: string): boolean {
  return IMPERSONATION_RE.test(text);
}

export function enforceValueDisclaimer(text: string): string {
  return text.includes(VALUE_DISCLAIMER) ? text : `${text}\n\n${VALUE_DISCLAIMER}`;
}

// Applied to value-narration output AFTER narrate()/narrateStream() (which already
// guarantee COACH_DISCLAIMER). Sanitizes impersonation, then guarantees the
// VALUE_DISCLAIMER. `fallback` is the deterministic template used when the LLM
// text impersonates a persona.
function enforceValueSafety(n: Narration, fallback: string): Narration {
  let text = n.text;
  let source = n.source;
  if (source === "llm" && violatesAntiImpersonation(text)) {
    text = enforceDisclaimer(fallback);
    source = "template";
  }
  return { ...n, text: enforceValueDisclaimer(text), source };
}

async function narrate(
  userPrompt: string,
  data: unknown,
  fallback: string,
  cacheKey?: string,
  bustCache = false,
): Promise<Narration> {
  if (!llmAvailable()) return { text: enforceDisclaimer(fallback), source: "template" };
  // Explicit refresh: drop any cached narration (and skip joining an in-flight
  // pre-refresh call) so a brand-new LLM call runs and re-populates the cache.
  if (cacheKey && bustCache) narrationCache.delete(cacheKey);
  if (cacheKey && !bustCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return { text: cached.text, source: "llm", cached: true, generatedAt: cached.createdAt };
  }
  const content = `${userPrompt}\n\nDATA (authoritative — use these exact numbers, do not invent others):\n${JSON.stringify(data)}`;
  const run = async (): Promise<string | null> => {
    const text = await complete(content, 900);
    if (!text) return null;
    const withDisclaimer = enforceDisclaimer(text);
    if (cacheKey) cacheSet(cacheKey, withDisclaimer);
    return withDisclaimer;
  };
  // Single-flight: concurrent identical asks share one LLM call.
  let finalText: string | null;
  if (cacheKey) {
    // On an explicit refresh, start a fresh leader instead of joining any
    // pre-refresh in-flight call so the caller always gets new prose.
    let p = bustCache ? undefined : inflight.get(cacheKey);
    if (!p) {
      p = run();
      inflight.set(cacheKey, p);
      void p.finally(() => inflight.delete(cacheKey));
    }
    finalText = await p;
  } else {
    finalText = await run();
  }
  if (!finalText) return { text: enforceDisclaimer(fallback), source: "template" };
  return { text: finalText, source: "llm", cached: false, generatedAt: Date.now() };
}

// Streaming counterpart of complete(). Pushes text chunks through onToken as the
// model produces them and resolves with the full text, or null on any failure
// so callers fall back to their deterministic template.
async function completeStream(
  userContent: string,
  maxTokens: number,
  onToken: TokenSink,
): Promise<string | null> {
  init();
  const { signal, done } = withTimeout(LLM_TIMEOUT_MS);
  try {
    if (provider === "anthropic" && anthropicClient) {
      const stream = anthropicClient.messages.stream(
        {
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        },
        { signal },
      );
      let acc = "";
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          acc += event.delta.text;
          onToken(event.delta.text);
        }
      }
      const trimmed = acc.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (provider === "openai" && openaiClient) {
      const stream = await openaiClient.chat.completions.create(
        {
          model: OPENAI_MODEL,
          max_completion_tokens: maxTokens,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        },
        { signal },
      );
      let acc = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          acc += delta;
          onToken(delta);
        }
      }
      const trimmed = acc.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  } catch (err) {
    logger.warn({ err, provider }, "coach LLM stream failed; using template fallback");
    return null;
  } finally {
    done();
  }
}

// Streaming counterpart of narrate(). When the LLM is unavailable it emits the
// deterministic template in one shot (no streaming) and returns source:template.
// On the LLM path it streams tokens live and enforces the same disclaimer
// invariant as narrate(). If the stream errors before producing any text, it
// degrades to the template; if it errors mid-stream, it finalizes whatever was
// already emitted (so the frontend never double-renders).
async function narrateStream(
  userPrompt: string,
  data: unknown,
  fallback: string,
  onToken: TokenSink,
  cacheKey?: string,
  bustCache = false,
): Promise<Narration> {
  if (!llmAvailable()) {
    const fb = enforceDisclaimer(fallback);
    onToken(fb);
    return { text: fb, source: "template" };
  }
  // Explicit refresh: drop any cached narration so a fresh LLM call runs and
  // re-streams new prose, bypassing both the cache and any pre-refresh in-flight
  // call (which would otherwise replay stale text in a single chunk).
  if (cacheKey && bustCache) narrationCache.delete(cacheKey);
  // Cache hit: emit the finished narration as a single chunk (no LLM call).
  if (cacheKey && !bustCache) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      onToken(cached.text);
      return { text: cached.text, source: "llm", cached: true, generatedAt: cached.createdAt };
    }
    // Single-flight: a concurrent identical ask is already streaming. Wait for
    // its result and emit it in one chunk rather than firing a second LLM call.
    const existing = inflight.get(cacheKey);
    if (existing) {
      const text = await existing;
      if (text) {
        onToken(text);
        return { text, source: "llm", cached: false, generatedAt: Date.now() };
      }
      const fb = enforceDisclaimer(fallback);
      onToken(fb);
      return { text: fb, source: "template" };
    }
  }
  const content = `${userPrompt}\n\nDATA (authoritative — use these exact numbers, do not invent others):\n${JSON.stringify(data)}`;
  let streamed = "";
  // The leader streams tokens live to its own client and resolves the shared
  // promise with the final (disclaimer-enforced) text for any followers.
  const leader = (async (): Promise<string | null> => {
    const text = await completeStream(content, 900, (t) => {
      streamed += t;
      onToken(t);
    });
    if (!text) return null;
    const withDisclaimer = enforceDisclaimer(text);
    if (cacheKey) cacheSet(cacheKey, withDisclaimer);
    return withDisclaimer;
  })();
  if (cacheKey) {
    inflight.set(cacheKey, leader);
    void leader.finally(() => inflight.delete(cacheKey));
  }
  const text = await leader;
  if (!text) {
    if (streamed.length === 0) {
      const fb = enforceDisclaimer(fallback);
      onToken(fb);
      return { text: fb, source: "template" };
    }
    const partial = enforceDisclaimer(streamed);
    return { text: partial.trim(), source: "llm", cached: false, generatedAt: Date.now() };
  }
  return { text, source: "llm", cached: false, generatedAt: Date.now() };
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

// Models sometimes wrap JSON in ```json fences or surrounding prose. Pull out
// the first balanced {...} object so JSON.parse has a clean target.
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

// ─── Trade explanation ───────────────────────────────────────────────────────

function tradeTemplate(e: TradeExplanation): string {
  const lines = [
    `${e.symbol} ${e.strategyLabel} — ${e.daysToExpiry} DTE (${e.symbolName} near ${money(e.underlyingPrice)})`,
    "",
    `This is a ${e.isCredit ? `credit structure collecting ${money(e.credit)}` : `net-debit structure paying ${money(Math.abs(e.credit))}`} with defined risk. ${e.profitZone}`,
    "",
    "What the numbers mean:",
    ...e.keyPoints.map((k) => `• ${k}`),
    "",
    `Volatility & assignment: ${e.greeksPlain.vega} ${e.assignmentRisk}`,
    "",
    e.rejected
      ? `Note: the scanner flagged this candidate — ${e.rejectReason}.`
      : `This candidate currently clears the scanner's quality filters.`,
    "",
    e.disclaimer,
  ];
  return lines.join("\n");
}

const TRADE_PROMPT = `Explain this options trade to a learner so they understand exactly what it is, how it makes or loses money, what the Greeks imply, the probability of profit, the maximum loss, and the assignment risk. Walk through why the Ravish Score is what it is. Do NOT recommend taking or skipping it — only explain.`;

// Trade explanations are deterministic per symbol+strategy (the underlying quote
// is canonical), so concurrent asks for the same candidate can share one call.
const tradeCacheKey = (e: TradeExplanation) => `trade:${e.symbol}:${e.strategy}`;

export async function narrateTradeExplanation(
  e: TradeExplanation,
  level?: CoachLevel,
): Promise<Narration> {
  return narrate(
    TRADE_PROMPT + levelInstruction(level),
    e,
    tradeTemplate(e),
    tradeCacheKey(e) + levelKey(level),
  );
}

export async function narrateTradeExplanationStream(
  e: TradeExplanation,
  onToken: TokenSink,
  level?: CoachLevel,
): Promise<Narration> {
  return narrateStream(
    TRADE_PROMPT + levelInstruction(level),
    e,
    tradeTemplate(e),
    onToken,
    tradeCacheKey(e) + levelKey(level),
  );
}

// ─── Trade adjustment (Task #20) ─────────────────────────────────────────────

// The recommended action and every number are decided deterministically in
// lib/adjustment.ts. This narration ONLY explains WHY — it must never change the
// action or invent figures. Routed through narrate()/narrateStream() so the
// disclaimer invariant holds.
export interface AdjustmentNarrationInput {
  symbol: string;
  symbolName: string;
  strategyLabel: string;
  action: string;
  actionLabel: string;
  severity: string;
  rationale: string;
  triggeredSignals: string[];
  currentPop: number;
  entryPop: number;
  daysToExpiry: number;
  currentPnl: number;
  maxLoss: number;
  maxProfit: number;
  threatenedSide: string | null;
  nearestShortStrike: number | null;
  distanceToShortPct: number | null;
  assignmentRisk: string;
  disclaimer: string;
}

function adjustmentTemplate(a: AdjustmentNarrationInput): string {
  const why =
    a.triggeredSignals.length > 0
      ? a.triggeredSignals.map((s) => `• ${s}`)
      : ["• No adjustment thresholds breached — the position is inside tolerance."];
  return [
    `${a.symbol} ${a.strategyLabel} — recommended action: ${a.actionLabel}`,
    "",
    a.rationale,
    "",
    "Why now:",
    ...why,
    "",
    `Position health: POP ${a.currentPop}% (entry ${a.entryPop}%), ${a.daysToExpiry} DTE, open P&L ${money(a.currentPnl)} against ${money(a.maxLoss)} max loss.`,
    "",
    `Assignment: ${a.assignmentRisk}`,
    "",
    a.disclaimer,
  ].join("\n");
}

const ADJUSTMENT_PROMPT = `You are coaching a premium seller on an OPEN options position. The recommended action and all numbers below are already decided and authoritative. Explain WHY this is the right call: what the triggered signals mean, how they affect probability of profit and defined risk, and what the action accomplishes. Do NOT change the recommended action and do NOT invent numbers. If the action is "hold" or "do_nothing", explain why no change is warranted.`;

// Adjustments depend on live signals, so key the cache on the chosen action and
// the exact set of triggered signals (deterministic for a given trade/day).
const adjustmentCacheKey = (a: AdjustmentNarrationInput) =>
  `adjust:${a.symbol}:${a.action}:${a.triggeredSignals.join("|")}`;

export async function narrateAdjustment(
  a: AdjustmentNarrationInput,
  level?: CoachLevel,
): Promise<Narration> {
  return narrate(
    ADJUSTMENT_PROMPT + levelInstruction(level),
    a,
    adjustmentTemplate(a),
    adjustmentCacheKey(a) + levelKey(level),
  );
}

export async function narrateAdjustmentStream(
  a: AdjustmentNarrationInput,
  onToken: TokenSink,
  level?: CoachLevel,
): Promise<Narration> {
  return narrateStream(
    ADJUSTMENT_PROMPT + levelInstruction(level),
    a,
    adjustmentTemplate(a),
    onToken,
    adjustmentCacheKey(a) + levelKey(level),
  );
}

// ─── Greek lessons ───────────────────────────────────────────────────────────

function greekTemplate(l: GreekLesson): string {
  return [
    l.title,
    "",
    l.definition,
    "",
    `For premium sellers: ${l.forPremiumSellers}`,
    "",
    `Live example: ${l.example}`,
    "",
    l.disclaimer,
  ].join("\n");
}

const greekPrompt = (l: GreekLesson) =>
  `Teach the option Greek "${l.greek}" to a motivated beginner. Define it, explain why it matters specifically for a premium seller, and ground it in the live example provided. Keep it tight and intuitive.`;

// Greek lessons are deterministic per greek+symbol, so concurrent "Teach Me"
// clicks for the same pair can share one call.
const greekCacheKey = (l: GreekLesson) => `greek:${l.greek}:${l.symbol}`;

export async function narrateGreekLesson(
  l: GreekLesson,
  level?: CoachLevel,
): Promise<Narration> {
  return narrate(
    greekPrompt(l) + levelInstruction(level),
    l,
    greekTemplate(l),
    greekCacheKey(l) + levelKey(level),
  );
}

export async function narrateGreekLessonStream(
  l: GreekLesson,
  onToken: TokenSink,
  level?: CoachLevel,
): Promise<Narration> {
  return narrateStream(
    greekPrompt(l) + levelInstruction(level),
    l,
    greekTemplate(l),
    onToken,
    greekCacheKey(l) + levelKey(level),
  );
}

// ─── Journal / closed-trade review ───────────────────────────────────────────

export interface JournalReviewData {
  symbol: string;
  strategy: string;
  strategyLabel: string;
  status: string;
  outcome: string;
  realizedPnl: number | null;
  credit: number;
  maxProfit: number;
  maxLoss: number;
  pop: number;
  ev: number;
  ravishScore: number;
  exitReason: string | null;
  heldDays: number | null;
}

function reviewTemplate(d: JournalReviewData): { review: string; lessonLearned: string } {
  const won = (d.realizedPnl ?? 0) >= 0;
  const review = [
    `${d.symbol} ${d.strategyLabel} — ${d.outcome}${d.realizedPnl != null ? ` (${d.realizedPnl >= 0 ? "+" : ""}${money(d.realizedPnl)})` : ""}.`,
    "",
    `Entered with a Ravish Score of ${d.ravishScore.toFixed(1)}, ${d.pop.toFixed(0)}% POP, ${d.ev >= 0 ? "+" : ""}${money(d.ev)} expected value, and ${money(d.maxLoss)} defined risk against ${money(d.maxProfit)} max profit.`,
    won
      ? `The thesis played out: premium decayed in your favor and the underlying stayed within the structure.${d.exitReason ? ` Exit reason: ${d.exitReason}.` : ""}`
      : `The trade went against the structure.${d.exitReason ? ` Exit reason: ${d.exitReason}.` : ""} With ${d.pop.toFixed(0)}% POP, occasional losers are expected — what matters is that the loss stayed inside the defined-risk cap.`,
    "",
    COACH_DISCLAIMER,
  ].join("\n");
  const lessonLearned = won
    ? `Positive-EV, high-POP ${d.strategyLabel.toLowerCase()} entries with disciplined exits compound over time. Repeat the process, not the outcome.`
    : `A losing ${d.strategyLabel.toLowerCase()} is part of a ${d.pop.toFixed(0)}%-POP edge — the defined-risk cap (${money(d.maxLoss)}) did its job. Focus on consistent sizing and exits, not avoiding every loss.`;
  return { review, lessonLearned };
}

export interface JournalReview {
  review: string;
  lessonLearned: string;
  source: NarrationSource;
}

export async function narrateJournalReview(d: JournalReviewData): Promise<JournalReview> {
  const tpl = reviewTemplate(d);
  if (!llmAvailable()) return { ...tpl, source: "template" };
  const content = `Review this CLOSED options trade like a coach doing a post-mortem. Reply as strict JSON with two string fields: "review" (2-4 sentence coaching review of how the trade went and what the process teaches) and "lessonLearned" (one concise, durable takeaway). Do NOT recommend future trades.\n\nDATA:\n${JSON.stringify(d)}`;
  const raw = await complete(content, 700, { json: true });
  if (!raw) return { ...tpl, source: "template" };
  try {
    const json = extractJsonObject(raw);
    if (!json) return { ...tpl, source: "template" };
    const parsed = JSON.parse(json) as { review?: string; lessonLearned?: string };
    return {
      review: (parsed.review?.trim() || tpl.review) + `\n\n${COACH_DISCLAIMER}`,
      lessonLearned: parsed.lessonLearned?.trim() || tpl.lessonLearned,
      source: "llm",
    };
  } catch (err) {
    logger.warn({ err }, "coach journal review JSON parse failed; using template fallback");
    return { ...tpl, source: "template" };
  }
}

// Streaming counterpart of narrateJournalReview. Streams the prose review live
// (the slow, narration-heavy part) and pairs it with the deterministic template
// lessonLearned — single-token JSON streaming would be unreadable, so the
// durable takeaway stays deterministic while the review prose streams.
export async function narrateJournalReviewStream(
  d: JournalReviewData,
  onToken: TokenSink,
): Promise<JournalReview> {
  const tpl = reviewTemplate(d);
  const prompt = `Review this CLOSED options trade like a coach doing a post-mortem. Write a 2-4 sentence coaching review of how the trade went and what the process teaches. Do NOT recommend future trades and do NOT append a separate lesson summary — only the review prose.`;
  const n = await narrateStream(prompt, d, tpl.review, onToken);
  return { review: n.text, lessonLearned: tpl.lessonLearned, source: n.source };
}

// ─── Free-form teaching answer (used by the assistant in coach mode) ──────────

export async function narrateFreeform(question: string, context: unknown, fallback: string): Promise<Narration> {
  const prompt = `Answer this options-education question for a learner. ${question}`;
  return narrate(prompt, context ?? {}, fallback);
}

// Task #38 — Portfolio AI. Narrates the daily market briefing. All numbers in
// `context` are deterministic; the LLM only writes the prose. Routed through
// narrate() so COACH_DISCLAIMER is always enforced.
export async function narrateMarketBriefing(
  context: unknown,
  fallback: string,
  bustCache = false,
): Promise<Narration> {
  return narrate(marketBriefingPrompt, context ?? {}, fallback, "briefing", bustCache);
}

const marketBriefingPrompt =
  "You are a desk strategist writing a short morning market briefing for an options premium-seller. " +
  "Using ONLY the provided deterministic data (regime, synthetic VIX, IV rank, breadth, catalysts), " +
  "write 3-4 sentences on the volatility regime, what it means for selling defined-risk premium, and " +
  "the key catalysts to watch. Be concrete and do not invent numbers.";

// Streaming counterpart of narrateMarketBriefing. Streams the prose live and
// enforces the same disclaimer invariant via narrateStream(). Shares the
// "briefing" cache key so a cached briefing is emitted in a single chunk.
export async function narrateMarketBriefingStream(
  context: unknown,
  fallback: string,
  onToken: TokenSink,
  bustCache = false,
): Promise<Narration> {
  return narrateStream(marketBriefingPrompt, context ?? {}, fallback, onToken, "briefing", bustCache);
}

// Task #51 — Portfolio AI report comparison. Narrates the plain-English story of
// what changed between two daily reports. All deltas in `context` are computed
// deterministically; the LLM only writes the prose. Routed through narrate() so
// COACH_DISCLAIMER is always enforced.
export async function narrateReportComparison(
  context: unknown,
  fallback: string,
  cacheKey?: string,
  bustCache = false,
): Promise<Narration> {
  return narrate(reportComparisonPrompt, context ?? {}, fallback, cacheKey, bustCache);
}

const reportComparisonPrompt =
  "You are a portfolio analyst summarising what changed between two daily portfolio reports for an " +
  "options premium-seller. Using ONLY the provided deterministic deltas (health/exposure/risk scores, " +
  "threat counts, opened/closed positions, trades-to-avoid changes, net greeks and P&L moves), write " +
  "2-3 plain-English sentences highlighting the MOST material changes first and what they imply. " +
  "Be concrete, reference the exact numbers given, and do not invent any figures.";

// Streaming counterpart of narrateReportComparison. Streams the prose live and
// enforces the same disclaimer invariant via narrateStream().
export async function narrateReportComparisonStream(
  context: unknown,
  fallback: string,
  onToken: TokenSink,
  cacheKey?: string,
  bustCache = false,
): Promise<Narration> {
  return narrateStream(reportComparisonPrompt, context ?? {}, fallback, onToken, cacheKey, bustCache);
}

// Task #66 — Value-investing research narration. All ratings, fair value, and
// margin of safety in `context` are deterministic (computed in valueInvesting.ts);
// the LLM ONLY writes the plain-English thesis prose. Routed through narrate() so
// the COACH_DISCLAIMER invariant always holds. The LLM must never invent a fair
// value or claim to be Warren Buffett — it is a teaching narrator only.
const valueResearchPrompt =
  "You are a patient value-investing tutor explaining a stock research summary in the spirit of " +
  "Warren Buffett's principles (moats, returns on capital, margin of safety) — but you are NOT Warren " +
  "Buffett and you must never claim to be him or any real person. Using ONLY the provided deterministic " +
  "data (business-quality score, moat rating, financial strength, fair-value estimate or its UNAVAILABLE " +
  "state, margin of safety, and the value-investor decision), write 3-5 sentences explaining the thesis " +
  "in plain English for a long-term investor. NEVER invent a fair value or margin of safety — if the data " +
  "says fair value is unavailable, say so plainly. Do not give a recommendation to buy or sell; explain " +
  "the reasoning. This is education about SIMULATED data, not investment advice.";

export async function narrateValueResearch(
  context: unknown,
  fallback: string,
  cacheKey?: string,
  bustCache = false,
): Promise<Narration> {
  const n = await narrate(valueResearchPrompt, context ?? {}, fallback, cacheKey, bustCache);
  return enforceValueSafety(n, fallback);
}

// Streaming counterpart of narrateValueResearch. Same disclaimer + anti-impersonation
// invariant — applied to the authoritative final payload (the `done` event the
// frontend uses to replace streamed tokens).
export async function narrateValueResearchStream(
  context: unknown,
  fallback: string,
  onToken: TokenSink,
  cacheKey?: string,
  bustCache = false,
): Promise<Narration> {
  const n = await narrateStream(
    valueResearchPrompt,
    context ?? {},
    fallback,
    onToken,
    cacheKey,
    bustCache,
  );
  return enforceValueSafety(n, fallback);
}
