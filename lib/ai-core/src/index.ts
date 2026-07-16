// Shared AI narration core — provider-agnostic, engine-agnostic.
//
// Phase 1, Sprint 9 — extracted from the Options Income Engine's coachLLM.ts
// (see docs/Phase-1-Foundation-Execution-Plan.md §5) so every future coach
// (Trading, Investing) can reuse the same provider detection, timeout/cache/
// single-flight machinery, and disclaimer-enforcement guarantee without
// reimplementing it per engine.
//
// This module knows nothing about options, trades, or Greeks — every piece of
// domain-specific content (system prompt wording, disclaimer text, templates)
// is passed in by the caller (e.g. artifacts/api-server/src/lib/coachLLM.ts).
//
// Provider-agnostic: ANTHROPIC_API_KEY selects the Anthropic SDK if set.
// Otherwise, OPENAI_API_KEY is used — normally for the OpenAI SDK, but for
// backward compatibility with deployments that predate the ANTHROPIC_API_KEY
// split, it may still hold an Anthropic key (sk-ant-... prefix), in which case
// a deprecation warning fires (via the caller-supplied `onWarn`) and the
// Anthropic SDK is used instead.

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const OPENAI_MODEL = process.env.OPENAI_COACH_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_COACH_MODEL || "claude-haiku-4-5-20251001";

export type Provider = "openai" | "anthropic" | null;

// Structured-or-plain warning hook, mirroring pino's dual call shape
// (`logger.warn(msg)` or `logger.warn(meta, msg)`) so a caller can wire this
// straight into its own logger without losing any structured fields.
export type WarnHandler = (meta: Record<string, unknown> | undefined, message: string) => void;

let provider: Provider = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let initialized = false;

function init(onWarn?: WarnHandler): void {
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
    onWarn?.(
      undefined,
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

export function llmAvailable(onWarn?: WarnHandler): boolean {
  init(onWarn);
  return provider !== null;
}

// ─── Concurrency hardening ───────────────────────────────────────────────────
// LLM calls take ~10-20s. Under concurrent load they can pile up and surface as
// 502 gateway timeouts / blank cards. Three guards prevent that:
//   1. a hard per-call timeout that aborts a hung request so it degrades to the
//      caller's deterministic fallback instead of hanging forever,
//   2. a short-lived cache keyed by the caller's cacheKey so repeat asks are
//      instant,
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
// caller-supplied fallback.
function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

export type NarrationSource = "llm" | "template";

export interface Narration {
  text: string;
  source: NarrationSource;
  // True when the text was served from the in-memory cache rather than freshly
  // generated this call. Undefined for the deterministic fallback path.
  cached?: boolean;
  // When the narration was generated (epoch ms). Present on the LLM path only.
  generatedAt?: number;
}

// Optional explanation depth. Threaded into the prompt and the cache key so a
// beginner and an advanced ask for the same lesson don't share a cached answer.
export type CoachLevel = "beginner" | "advanced";

export function levelInstruction(level?: CoachLevel): string {
  if (level === "beginner")
    return " Explain at a BEGINNER depth: assume little prior knowledge, define any jargon you use, and keep it simple and encouraging.";
  if (level === "advanced")
    return " Explain at an ADVANCED depth: assume the reader already knows the basics; be concise, precise, and focus on the nuanced trade-offs.";
  return "";
}

export function levelKey(level?: CoachLevel): string {
  return level ? `:${level}` : "";
}

// Callback that receives incremental text chunks as the model streams them.
export type TokenSink = (chunk: string) => void;

export interface CompleteOpts {
  json?: boolean;
  onWarn?: WarnHandler;
}

// Unified single-shot completion across providers. Returns null on any failure
// so callers fall back to their own deterministic template.
export async function complete(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  opts: CompleteOpts = {},
): Promise<string | null> {
  init(opts.onWarn);
  const { signal, done } = withTimeout(LLM_TIMEOUT_MS);
  try {
    if (provider === "anthropic" && anthropicClient) {
      const sys = opts.json
        ? `${systemPrompt}\n\nRespond ONLY with a single valid JSON object, no prose or code fences.`
        : systemPrompt;
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
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        },
        { signal },
      );
      return resp.choices[0]?.message?.content?.trim() ?? null;
    }
    return null;
  } catch (err) {
    opts.onWarn?.({ err, provider }, "AI completion failed; using fallback");
    return null;
  } finally {
    done();
  }
}

export interface NarrateOpts {
  systemPrompt: string;
  disclaimer: string;
  cacheKey?: string;
  bustCache?: boolean;
  onWarn?: WarnHandler;
}

function applyDisclaimer(text: string, disclaimer: string): string {
  return text.includes(disclaimer) ? text : `${text}\n\n${disclaimer}`;
}

export async function narrate(
  userPrompt: string,
  data: unknown,
  fallback: string,
  opts: NarrateOpts,
): Promise<Narration> {
  const { systemPrompt, disclaimer, cacheKey, bustCache = false, onWarn } = opts;
  if (!llmAvailable(onWarn)) return { text: applyDisclaimer(fallback, disclaimer), source: "template" };
  // Explicit refresh: drop any cached narration (and skip joining an in-flight
  // pre-refresh call) so a brand-new LLM call runs and re-populates the cache.
  if (cacheKey && bustCache) narrationCache.delete(cacheKey);
  if (cacheKey && !bustCache) {
    const cached = cacheGet(cacheKey);
    if (cached) return { text: cached.text, source: "llm", cached: true, generatedAt: cached.createdAt };
  }
  const content = `${userPrompt}\n\nDATA (authoritative — use these exact numbers, do not invent others):\n${JSON.stringify(data)}`;
  const run = async (): Promise<string | null> => {
    const text = await complete(systemPrompt, content, 900, { onWarn });
    if (!text) return null;
    const withDisclaimer = applyDisclaimer(text, disclaimer);
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
  if (!finalText) return { text: applyDisclaimer(fallback, disclaimer), source: "template" };
  return { text: finalText, source: "llm", cached: false, generatedAt: Date.now() };
}

// Streaming counterpart of complete(). Pushes text chunks through onToken as the
// model produces them and resolves with the full text, or null on any failure
// so callers fall back to their own deterministic template.
async function completeStream(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  onToken: TokenSink,
  onWarn?: WarnHandler,
): Promise<string | null> {
  init(onWarn);
  const { signal, done } = withTimeout(LLM_TIMEOUT_MS);
  try {
    if (provider === "anthropic" && anthropicClient) {
      const stream = anthropicClient.messages.stream(
        {
          model: ANTHROPIC_MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
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
            { role: "system", content: systemPrompt },
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
    onWarn?.({ err, provider }, "AI stream failed; using fallback");
    return null;
  } finally {
    done();
  }
}

// Streaming counterpart of narrate(). When the LLM is unavailable it emits the
// caller's deterministic fallback in one shot (no streaming) and returns
// source:template. On the LLM path it streams tokens live and enforces the
// same disclaimer invariant as narrate(). If the stream errors before
// producing any text, it degrades to the fallback; if it errors mid-stream, it
// finalizes whatever was already emitted (so the caller never double-renders).
export async function narrateStream(
  userPrompt: string,
  data: unknown,
  fallback: string,
  onToken: TokenSink,
  opts: NarrateOpts,
): Promise<Narration> {
  const { systemPrompt, disclaimer, cacheKey, bustCache = false, onWarn } = opts;
  if (!llmAvailable(onWarn)) {
    const fb = applyDisclaimer(fallback, disclaimer);
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
      const fb = applyDisclaimer(fallback, disclaimer);
      onToken(fb);
      return { text: fb, source: "template" };
    }
  }
  const content = `${userPrompt}\n\nDATA (authoritative — use these exact numbers, do not invent others):\n${JSON.stringify(data)}`;
  let streamed = "";
  // The leader streams tokens live to its own client and resolves the shared
  // promise with the final (disclaimer-enforced) text for any followers.
  const leader = (async (): Promise<string | null> => {
    const text = await completeStream(
      systemPrompt,
      content,
      900,
      (t) => {
        streamed += t;
        onToken(t);
      },
      onWarn,
    );
    if (!text) return null;
    const withDisclaimer = applyDisclaimer(text, disclaimer);
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
      const fb = applyDisclaimer(fallback, disclaimer);
      onToken(fb);
      return { text: fb, source: "template" };
    }
    const partial = applyDisclaimer(streamed, disclaimer);
    return { text: partial.trim(), source: "llm", cached: false, generatedAt: Date.now() };
  }
  return { text, source: "llm", cached: false, generatedAt: Date.now() };
}

// Models sometimes wrap JSON in ```json fences or surrounding prose. Pull out
// the first balanced {...} object so JSON.parse has a clean target.
export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

