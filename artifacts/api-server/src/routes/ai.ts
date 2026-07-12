import { Router, type IRouter } from "express";
import { db, aiMessagesTable, tradesTable, scannerResultsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { AiChatResponse, AiChatBody, GetAiMessagesResponse } from "@workspace/api-zod";
import { getSnapshot } from "../lib/optionsMath.js";
import { computeTradeGreeks, ensureSeedTrades, getAccountValue, getSettingsRow } from "../lib/serverState.js";
import { previewOptionOrder, TicketError } from "../lib/execution.js";
import { getAutoExecutionStatus } from "../lib/autoExecution.js";
import { explainSymbolStrategy, teachGreek, type GreekName } from "../lib/coach.js";
import {
  narrateTradeExplanation,
  narrateTradeExplanationStream,
  narrateGreekLesson,
  narrateGreekLessonStream,
  narrateValueResearch,
  narrateValueResearchStream,
  type TokenSink,
  type CoachLevel,
} from "../lib/coachLLM.js";
import { buildValueResearchReport, type ValueResearchReport } from "../lib/valueReport.js";
import { getLegacyOwnerUserId } from "../lib/legacyOwner.js";
import { UNIVERSE } from "../lib/optionsMath.js";
import { openSse } from "../lib/sse.js";

const router: IRouter = Router();

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const label = (s: string) => s.replace(/_/g, " ");

async function topCandidate() {
  const rows = await db
    .select()
    .from(scannerResultsTable)
    .orderBy(desc(scannerResultsTable.ravishScore))
    .limit(1);
  return rows[0] ?? null;
}

async function bestByStrategy(strategy: string) {
  const rows = await db
    .select()
    .from(scannerResultsTable)
    .where(eq(scannerResultsTable.strategy, strategy))
    .orderBy(desc(scannerResultsTable.ravishScore))
    .limit(1);
  return rows[0] ?? null;
}

async function bestByEv() {
  const rows = await db
    .select()
    .from(scannerResultsTable)
    .orderBy(desc(scannerResultsTable.ev))
    .limit(1);
  return rows[0] ?? null;
}

async function portfolioGreeks() {
  await ensureSeedTrades();
  const trades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.status, "open"));
  let delta = 0;
  let theta = 0;
  let vega = 0;
  let directional = 0;
  let unrealized = 0;
  for (const t of trades) {
    const g = computeTradeGreeks(t);
    delta += g.delta;
    theta += g.theta;
    vega += g.vega;
    unrealized += g.unrealizedPnl;
    const snap = getSnapshot(t.symbol);
    if (snap) directional += g.delta * snap.price;
  }
  return {
    trades,
    delta: Math.round(delta * 100) / 100,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
    directional: Math.round(directional),
    unrealized: Math.round(unrealized),
  };
}

// Detect which Greek (if any) a message refers to.
function detectGreek(lower: string): GreekName | null {
  return lower.includes("delta")
    ? "delta"
    : lower.includes("theta")
      ? "theta"
      : lower.includes("gamma")
        ? "gamma"
        : lower.includes("vega")
          ? "vega"
          : null;
}

// ── Shared coach helpers (used by both the keyword auto-detect path and the
// explicit-mode path). All are read-only; none ever previews or submits an order.

async function explainTopCandidate(level?: CoachLevel, onToken?: TokenSink): Promise<string> {
  const r = await topCandidate();
  if (!r) return "No scanner candidates yet — run the scanner first, then I can explain one in detail.";
  try {
    const explanation = explainSymbolStrategy(r.symbol, r.strategy);
    const n = onToken
      ? await narrateTradeExplanationStream(explanation, onToken, level)
      : await narrateTradeExplanation(explanation, level);
    return n.text;
  } catch {
    return `I couldn't build an explanation for ${r.symbol} ${label(r.strategy)} right now.`;
  }
}

async function teachGreekResponse(
  greek: GreekName,
  level?: CoachLevel,
  onToken?: TokenSink,
): Promise<string> {
  const lesson = teachGreek(greek);
  const n = onToken
    ? await narrateGreekLessonStream(lesson, onToken, level)
    : await narrateGreekLesson(lesson, level);
  return n.text;
}

async function portfolioRiskResponse(): Promise<string> {
  const p = await portfolioGreeks();
  const account = await getAccountValue();
  const riskDollars = p.trades.reduce((s, t) => s + Math.max(0, t.maxLoss), 0);
  const pct = account > 0 ? (riskDollars / account) * 100 : 0;
  const largest = [...p.trades].sort((a, b) => b.maxLoss - a.maxLoss)[0];
  return `Portfolio risk: ${p.trades.length} open positions using ${money(riskDollars)} of max risk = ${pct.toFixed(1)}% of account (cap 10%). ${largest ? `Largest single risk: ${largest.symbol} ${label(largest.strategy)} at ${((largest.maxLoss / account) * 100).toFixed(1)}%.` : ""} Portfolio theta ${money(p.theta)}/day. ${pct <= 10 ? "All within limits." : "Over the portfolio cap — reduce exposure."}`;
}

// Ravish Strategy Coach — narrates the framework + today's top-ranked setups.
async function strategyCoachResponse(): Promise<string> {
  const rows = await db
    .select()
    .from(scannerResultsTable)
    .orderBy(desc(scannerResultsTable.ravishScore))
    .limit(3);
  if (rows.length === 0)
    return "No scanner results yet — run the scanner first, then I can coach you through today's best Ravish setups.";
  const list = rows
    .map(
      (r) =>
        `${r.symbol} ${label(r.strategy)} ${r.ravishScore.toFixed(1)} (${label(r.ravishTier)}, POP ${r.pop.toFixed(0)}%, EV ${r.ev >= 0 ? "+" : ""}${money(r.ev)})`,
    )
    .join("; ");
  return `Ravish strategy coaching — every setup is ranked by a weighted score (30% POP, 25% EV, 15% theta, 15% win rate, 10% liquidity, 5% IV rank), favoring high-probability, defined-risk premium selling. Today's top setups: ${list}. Open any with "Review Trade" to see the full pre-trade risk breakdown — I never place orders from chat. Educational only.`;
}

function quizPointer(): string {
  return "Open the Greeks Tutor from the sidebar to take an interactive quiz — I'll generate Greeks, strategy, and risk questions and grade them instantly with explanations. Educational only; I never place trades.";
}

// Company-name → ticker aliases so natural-language requests ("research Apple")
// resolve to a universe symbol even when no ticker is typed.
const COMPANY_ALIASES: Record<string, string> = {
  apple: "AAPL",
  microsoft: "MSFT",
  nvidia: "NVDA",
  meta: "META",
  facebook: "META",
  amazon: "AMZN",
  alphabet: "GOOGL",
  google: "GOOGL",
  tesla: "TSLA",
  "s&p 500": "SPY",
  "s&p": "SPY",
  nasdaq: "QQQ",
  "russell 2000": "IWM",
  russell: "IWM",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Detect which universe symbol (if any) a message mentions. Word-boundary match so
// "is" doesn't catch IWM etc.; uppercased symbols are matched case-insensitively.
// Falls back to a company-name alias ("Apple" → AAPL) when no ticker is present.
function detectSymbol(lower: string): string | null {
  for (const u of UNIVERSE) {
    const sym = u.symbol.toLowerCase();
    if (new RegExp(`\\b${sym}\\b`).test(lower)) return u.symbol;
  }
  for (const [alias, symbol] of Object.entries(COMPANY_ALIASES)) {
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(lower)) return symbol;
  }
  return null;
}

// Value-investing research narration — read-only, advisory/education only. Builds
// the deterministic SIMULATED report (never fabricates fair value) and lets the
// LLM narrate the thesis around it. Defaults to the highest-quality name when the
// message names no symbol.
async function valueResearchResponse(
  lower: string,
  level?: CoachLevel,
  onToken?: TokenSink,
): Promise<string> {
  const symbol = detectSymbol(lower);
  let report: ValueResearchReport | null = symbol ? await buildValueResearchReport(symbol) : null;
  if (!report) {
    const reports = await Promise.all(UNIVERSE.map((u) => buildValueResearchReport(u.symbol)));
    report = reports
      .filter((r): r is ValueResearchReport => r !== null)
      .sort((a, b) => b.businessQuality.score - a.businessQuality.score)[0] ?? null;
  }
  if (!report) {
    return "I couldn't build a value-investing report right now. Open the Stock Research page to run one.";
  }
  const dataLabel = report.dataSource === "SIMULATED" ? "SIMULATED" : "live";
  const val = report.valuation.available
    ? `fair value is estimated near $${report.valuation.fairValue.toFixed(2)} (${Math.round(report.valuation.marginOfSafety * 100)}% margin of safety, ${report.valuation.rating})`
    : `fair value is unavailable from the current ${dataLabel} inputs, so no margin of safety can be judged`;
  const fallback =
    `${report.name} (${report.symbol}) scores ${report.businessQuality.score}/100 on business quality ` +
    `with a ${report.moat.rating.toLowerCase()} moat and ${report.financialStrength.rating.toLowerCase()} balance sheet. ` +
    `At $${report.price.toFixed(2)}, ${val}. The value-investor read is ${report.decision.verdict}.`;
  const context = {
    symbol: report.symbol,
    name: report.name,
    kind: report.kind,
    dataSource: report.dataSource,
    price: report.price,
    businessQuality: { score: report.businessQuality.score, rating: report.businessQuality.rating },
    moat: { rating: report.moat.rating, durabilityYears: report.moat.durabilityYears },
    financialStrength: report.financialStrength.rating,
    valuation: report.valuation.available
      ? {
          available: true,
          fairValue: report.valuation.fairValue,
          marginOfSafety: report.valuation.marginOfSafety,
          rating: report.valuation.rating,
        }
      : { available: false, reason: report.valuation.reason },
    decision: { verdict: report.decision.verdict, conviction: report.decision.conviction },
    stockVsOptions: report.stockVsOptions.verdict,
  };
  const n = onToken
    ? await narrateValueResearchStream(context, fallback, onToken, `value:${report.symbol}`)
    : await narrateValueResearch(context, fallback, `value:${report.symbol}`);
  return n.text;
}

interface AiResponseOpts {
  mode?: "explain_trade" | "teach_greeks" | "risk_coach" | "strategy_coach" | "quiz" | "value_research";
  level?: CoachLevel;
  onToken?: TokenSink;
}

// When onToken is provided, the coach narration branches stream their tokens
// through it as they generate. All other branches are deterministic and return
// their full text instantly without streaming. The function always returns the
// complete text; the streaming caller detects whether any token was emitted (via
// its own onToken wrapper) and only re-emits the full text when nothing streamed.
//
// When opts.mode is set, the assistant routes deterministically into that coach
// mode instead of relying on keyword auto-detect. opts.level threads the desired
// explanation depth into the narration. Both are optional and backward compatible.
export async function generateAiResponse(
  message: string,
  opts: AiResponseOpts = {},
): Promise<string> {
  const { mode, level, onToken } = opts;
  const lower = message.toLowerCase();

  // Explicit mode wins over keyword auto-detect.
  if (mode === "explain_trade") return explainTopCandidate(level, onToken);
  if (mode === "teach_greeks") return teachGreekResponse(detectGreek(lower) ?? "delta", level, onToken);
  if (mode === "risk_coach") return portfolioRiskResponse();
  if (mode === "strategy_coach") return strategyCoachResponse();
  if (mode === "quiz") return quizPointer();
  if (mode === "value_research") return valueResearchResponse(lower, level, onToken);

  // Phase 5 — execution intents (checked first so they win over generic keywords).

  // Pending orders
  if (lower.includes("pending")) {
    const pending = await db
      .select()
      .from(tradesTable)
      .where(eq(tradesTable.status, "pending"));
    if (pending.length === 0) return "You have no pending orders awaiting fill.";
    const lines = pending
      .map(
        (t) =>
          `${t.symbol} ${label(t.strategy)} (order ${t.alpacaOrderId ?? "—"}, max risk ${money(t.maxLoss)})`,
      )
      .join(", ");
    return `You have ${pending.length} pending order(s): ${lines}. They will move to "open" once filled.`;
  }

  // Full-Auto status / autopilot — read-only. The chat never arms or disarms the
  // master switch; it only reports state and points to the AutoPilot/Settings UI.
  if (
    lower.includes("autopilot") ||
    lower.includes("auto pilot") ||
    lower.includes("auto-execute") ||
    lower.includes("auto execute") ||
    lower.includes("full auto") ||
    lower.includes("full-auto") ||
    lower.includes("kill switch") ||
    (lower.includes("auto") && (lower.includes("status") || lower.includes("halt") || lower.includes("stop")))
  ) {
    const s = await getAutoExecutionStatus();
    if (lower.includes("halt") || lower.includes("stop") || lower.includes("kill")) {
      return `To halt all auto-execution immediately, turn the master Auto-Execute switch OFF on the AutoPilot page (or set mode away from Full-Auto in Settings). I won't toggle it from chat — that's a deliberate manual control. Current state: ${s.armed ? "ARMED 🔴" : "disarmed"}.`;
    }
    if (!s.armed) {
      const why =
        s.executionMode !== "full_auto"
          ? `mode is ${label(s.executionMode)}, not Full-Auto`
          : "the master Auto-Execute switch is OFF (kill switch)";
      return `AutoPilot is disarmed — ${why}. No trades will be auto-submitted. Guardrails when armed: max ${s.guardrails.maxTradesPerDay} trades/day, ${s.guardrails.maxConcurrentPositions} concurrent, min Ravish Score ${s.guardrails.minRavishScore}, ${s.guardrails.maxDailyLossPct}% daily-loss breaker.`;
    }
    return `AutoPilot is ARMED 🔴 — Full-Auto with the master switch on. Today: ${s.today.tradesToday}/${s.guardrails.maxTradesPerDay} trades used, ${s.today.concurrentPositions}/${s.guardrails.maxConcurrentPositions} concurrent, ${s.today.remainingCapacity} slot(s) left. Realized P&L today ${money(s.today.dailyRealizedPnl)} vs ${money(s.today.dailyLossLimit)} loss limit. ${s.blockReason ? `Currently blocked: ${s.blockReason}.` : "Scanning and auto-submitting qualifying trades."}`;
  }

  // Submit / execute / place — never auto-submit; direct the user to the Trade Ticket.
  if (
    lower.includes("submit") ||
    lower.includes("execute") ||
    lower.includes("place order") ||
    lower.includes("place the order") ||
    lower.includes("place a trade") ||
    lower.includes("buy it") ||
    lower.includes("send the order")
  ) {
    const r = await topCandidate();
    const settings = await getSettingsRow();
    const where = r ? `the Trade Ticket for ${r.symbol} ${label(r.strategy)}` : "the Trade Ticket";
    const modeNote =
      settings.executionMode === "semi_auto"
        ? "You're in Semi-Auto, so you can review and confirm there."
        : settings.executionMode === "manual"
          ? "You're in Manual mode — switch to Semi-Auto in Settings to enable one-click submission."
          : "You're in Full-Auto — the engine auto-submits qualifying trades when the master switch is armed; check the AutoPilot page.";
    return `I never place orders automatically from chat. Open ${where}, review the pre-trade risk checks, and confirm the order yourself. ${modeNote}`;
  }

  // Review / can I take / should I take / why rejected — run a live pre-trade preview.
  if (
    lower.includes("review") ||
    lower.includes("can i take") ||
    lower.includes("can i trade") ||
    lower.includes("should i take") ||
    lower.includes("why was") ||
    lower.includes("why rejected") ||
    lower.includes("why is it rejected") ||
    lower.includes("rejected")
  ) {
    const r = await topCandidate();
    if (!r) return "No scanner candidates yet — run the scanner first, then I can review one for you.";
    try {
      const ticket = await previewOptionOrder({
        symbol: r.symbol,
        strategy: r.strategy,
        quantity: 1,
      });
      const v = ticket.validation;
      if (v.valid) {
        return `${r.symbol} ${label(r.strategy)} passes all pre-trade checks ✓ — Ravish Score ${ticket.ravishScore.toFixed(1)} (${label(ticket.ravishTier)}), POP ${ticket.pop.toFixed(0)}%, EV ${ticket.ev >= 0 ? "+" : ""}${money(ticket.ev)}, max risk ${money(ticket.maxLoss)} (${ticket.riskPct}% of account), portfolio risk ${ticket.portfolioRiskBeforePct}% → ${ticket.portfolioRiskAfterPct}% after entry. ${ticket.canSubmit ? "Open the Trade Ticket and confirm to submit." : "Switch to Semi-Auto in Settings to enable submission."}`;
      }
      return `${r.symbol} ${label(r.strategy)} would be rejected: ${v.violations.join("; ")}. (Ravish Score ${ticket.ravishScore.toFixed(1)}, EV ${ticket.ev >= 0 ? "+" : ""}${money(ticket.ev)}, max risk ${ticket.riskPct}% of account.)`;
    } catch (err) {
      if (err instanceof TicketError) return `I couldn't build that ticket: ${err.message}`;
      throw err;
    }
  }

  // Value-investing research intent — checked before the generic teaching/data
  // lookups so "what is the intrinsic value of AAPL" routes to the value engine
  // (not portfolio delta or a Greek lesson). Read-only, advisory/education only.
  if (
    lower.includes("buffett") ||
    lower.includes("intrinsic value") ||
    lower.includes("fair value") ||
    lower.includes("margin of safety") ||
    lower.includes("moat") ||
    lower.includes("value invest") ||
    lower.includes("undervalued") ||
    lower.includes("overvalued") ||
    lower.includes("long-term") ||
    lower.includes("long term hold") ||
    lower.includes("buy and hold") ||
    lower.includes("business quality") ||
    (lower.includes("should i buy") && detectSymbol(lower) !== null) ||
    // Quality question about a named company — "is TSLA a wonderful business?".
    // Symbol-gated so a generic "wonderful trade" can't hijack core coach flows.
    (detectSymbol(lower) !== null && lower.includes("wonderful")) ||
    // Stock-suitability questions about a named company — "is NVDA better for
    // stock investing or options?", "should I buy AAPL shares or use options?".
    // Require a detected symbol AND both a stock/share word AND an option word so
    // the app's core options flows ("best iron condor", "teach options") are
    // never captured.
    (detectSymbol(lower) !== null &&
      (lower.includes("stock") || lower.includes("share")) &&
      lower.includes("option")) ||
    // "is TSLA a wonderful business or too risky?" — quality/risk question about a
    // named company. Scoped to a detected symbol so "what is my portfolio risk?"
    // (no symbol) still routes to the portfolio-risk handler.
    (detectSymbol(lower) !== null && lower.includes("risky"))
  ) {
    return valueResearchResponse(lower, level, onToken);
  }

  // ── Coach / teaching intents (checked before the data lookups so "what is
  // delta" teaches the concept instead of reporting portfolio delta). The coach
  // is a read-only teaching layer and never executes anything.
  const teachVerb =
    lower.includes("what is") ||
    lower.includes("what's") ||
    lower.includes("whats ") ||
    lower.includes("teach") ||
    lower.includes("explain") ||
    lower.includes("tutor") ||
    lower.includes("how does") ||
    lower.includes("define") ||
    lower.includes("tell me about") ||
    lower.includes("learn");

  // Quiz me — interactive grading lives on the Greeks Tutor page.
  if (lower.includes("quiz") || lower.includes("test me")) {
    return quizPointer();
  }

  // Explain a specific trade/candidate in teaching detail.
  if (
    (lower.includes("explain") || lower.includes("walk me through") || lower.includes("break down")) &&
    (lower.includes("trade") ||
      lower.includes("condor") ||
      lower.includes("candidate") ||
      lower.includes("top") ||
      lower.includes("this"))
  ) {
    return explainTopCandidate(level, onToken);
  }

  // Teach one of the four Greeks.
  if (teachVerb) {
    const greek = detectGreek(lower);
    if (greek) {
      return teachGreekResponse(greek, level, onToken);
    }
  }

  // 1. Best iron condor
  if (lower.includes("iron condor") || (lower.includes("condor") && lower.includes("best"))) {
    const r = await bestByStrategy("iron_condor");
    if (!r) return "No iron condor candidates yet — run the scanner first.";
    return `Best iron condor today: ${r.symbol} ${r.shortPutStrike}/${r.shortCallStrike} short strikes, ${r.daysToExpiry} DTE. Ravish Score ${r.ravishScore.toFixed(1)} (${label(r.ravishTier)}). Credit ${money(r.credit ?? 0)}, POP ${r.pop.toFixed(0)}%, EV ${r.ev >= 0 ? "+" : ""}${money(r.ev)}, max risk ${money(r.maxLoss)}.`;
  }

  // 2. Best calendar spread
  if (lower.includes("calendar")) {
    const r = await bestByStrategy("calendar_spread");
    if (!r) return "No calendar spread candidates yet — run the scanner first.";
    return `Best calendar spread: ${r.symbol} ${r.shortCallStrike}-strike, ${r.daysToExpiry} DTE. Ravish Score ${r.ravishScore.toFixed(1)} (${label(r.ravishTier)}). Net debit ${money(Math.abs(r.credit ?? 0))}, POP ${r.pop.toFixed(0)}%, daily theta ${r.theta.toFixed(1)}, max risk ${money(r.maxLoss)}.`;
  }

  // 3. Delta neutral / portfolio greeks
  if (lower.includes("delta") || lower.includes("neutral")) {
    const p = await portfolioGreeks();
    const status =
      Math.abs(p.delta) < 0.1 ? "effectively delta neutral" : p.delta > 0 ? "net bullish" : "net bearish";
    return `Your portfolio delta is ${p.delta >= 0 ? "+" : ""}${p.delta} across ${p.trades.length} open positions — ${status}. Directional exposure ≈ ${money(Math.abs(p.directional))} per 1% underlying move. ${Math.abs(p.delta) < 0.1 ? "No adjustment needed." : "Consider an offsetting position to re-center."}`;
  }

  // 4. Portfolio risk
  if (lower.includes("risk")) {
    return portfolioRiskResponse();
  }

  // 5. Highest expected value
  if (lower.includes("expected value") || lower.includes(" ev") || lower.includes("highest ev")) {
    const r = await bestByEv();
    if (!r) return "No scanner results yet — run the scanner to rank by expected value.";
    return `Highest EV trade today: ${r.symbol} ${label(r.strategy)} at ${r.ev >= 0 ? "+" : ""}${money(r.ev)} EV per contract (${r.pop.toFixed(0)}% POP × ${money(r.maxProfit)} max profit − ${(100 - r.pop).toFixed(0)}% × ${money(r.maxLoss)} max loss). Ravish Score ${r.ravishScore.toFixed(1)}.`;
  }

  // Extra: theta income
  if (lower.includes("theta")) {
    const p = await portfolioGreeks();
    return `Your portfolio generates ${money(p.theta)}/day in theta income, projecting ~${money(p.theta * 30)}/month across ${p.trades.length} open positions.`;
  }

  // Extra: vega
  if (lower.includes("vega") || lower.includes("volatility") || lower.includes(" iv")) {
    const p = await portfolioGreeks();
    return `Portfolio vega is ${p.vega} — you ${p.vega < 0 ? "benefit from falling IV (healthy short-vega premium-selling posture)" : "benefit from rising IV"}. A 1-point IV move shifts P&L by about ${money(Math.abs(p.vega))}.`;
  }

  // Extra: open positions
  if (lower.includes("position") || lower.includes("open") || lower.includes("unrealized")) {
    const p = await portfolioGreeks();
    const lines = p.trades
      .map((t) => {
        const g = computeTradeGreeks(t);
        return `${t.symbol} ${label(t.strategy)} (${g.unrealizedPnl >= 0 ? "+" : ""}${money(g.unrealizedPnl)})`;
      })
      .join(", ");
    return `You have ${p.trades.length} open positions: ${lines}. Total unrealized P&L: ${p.unrealized >= 0 ? "+" : ""}${money(p.unrealized)}.`;
  }

  // Extra: ravish score / leaderboard
  if (lower.includes("score") || lower.includes("ravish") || lower.includes("top")) {
    const rows = await db
      .select()
      .from(scannerResultsTable)
      .orderBy(desc(scannerResultsTable.ravishScore))
      .limit(3);
    if (rows.length === 0) return "No scanner results yet — run the scanner to see top Ravish Scores.";
    const list = rows
      .map((r) => `${r.symbol} ${label(r.strategy)} ${r.ravishScore.toFixed(1)} (${label(r.ravishTier)})`)
      .join(", ");
    return `Today's top Ravish Scores: ${list}.`;
  }

  return "I can help with trade analysis, portfolio Greeks, scanner results, and risk. Try: 'Show best iron condor today', 'Best calendar spread', 'Am I delta neutral?', 'What is my portfolio risk?', or 'Find highest EV trade'.";
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, mode, level } = parsed.data;
  const userId = await getLegacyOwnerUserId();

  await db.insert(aiMessagesTable).values({ userId, role: "user", message });

  const aiResponse = await generateAiResponse(message, { mode, level });

  const [aiMsg] = await db
    .insert(aiMessagesTable)
    .values({ userId, role: "assistant", message: aiResponse })
    .returning();

  res.json(
    AiChatResponse.parse({
      id: aiMsg.id,
      message: aiResponse,
      createdAt: aiMsg.createdAt.toISOString(),
    }),
  );
});

// POST /ai/chat/stream — SSE variant of /ai/chat. Persists the user message,
// streams assistant tokens as `delta` events (only the coach teaching branches
// actually stream; deterministic answers are emitted as a single delta), then
// persists the assistant message and sends `done` with the saved row.
router.post("/ai/chat/stream", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, mode, level } = parsed.data;
  const userId = await getLegacyOwnerUserId();

  await db.insert(aiMessagesTable).values({ userId, role: "user", message });

  const sse = openSse(res);
  let streamed = false;
  try {
    const aiResponse = await generateAiResponse(message, {
      mode,
      level,
      onToken: (t) => {
        streamed = true;
        sse.send("delta", { text: t });
      },
    });

    // Deterministic (non-coach) answers never call onToken — emit the full text
    // as a single delta so the client renders identically to the streaming path.
    if (!streamed) {
      sse.send("delta", { text: aiResponse });
    }

    const [aiMsg] = await db
      .insert(aiMessagesTable)
      .values({ userId, role: "assistant", message: aiResponse })
      .returning();

    sse.send("done", {
      id: aiMsg.id,
      message: aiResponse,
      createdAt: aiMsg.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "ai chat stream failed");
    sse.send("error", { error: "Failed to generate response" });
  } finally {
    sse.close();
  }
});

router.get("/ai/messages", async (_req, res): Promise<void> => {
  const messages = await db
    .select()
    .from(aiMessagesTable)
    .orderBy(desc(aiMessagesTable.createdAt))
    .limit(50);

  res.json(
    GetAiMessagesResponse.parse(
      messages.reverse().map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    ),
  );
});

export default router;
