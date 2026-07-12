// Event Risk Filter: a deterministic, simulated economic/market event calendar plus a
// pure assessment that the scanner, execution gate, and AutoPilot all consult. Like
// earnings.ts, every function is deterministic (seeded RNG + real date math) so the
// analysis is unit-testable without a database, network, or wall-clock dependency.
//
// Rules enforced (advisory in the UI, hard server-side where noted):
//  - Do NOT open short-premium trades (iron_condor/iron_fly) before earnings  → blockShortPremium
//  - Warn if a trade's expiration crosses earnings / other high-impact events → warnings[]
//  - Lower the Ravish Score when major event risk exists                      → penalty
//  - Block AutoPilot when event risk is too high (level === "high")           → blockAuto

import {
  getSnapshot,
  makeRng,
  todayStr,
  type EventRiskEvent,
  type EventRiskLevel,
  type EventRiskType,
} from "./optionsMath.js";

const DAY_MS = 86_400_000;

// Short-premium structures the "no earnings inside the trade" rule applies to. The
// dedicated `earnings` strategy is designed to trade the event (IV-crush harvest) and
// `calendar_spread` is a net debit, so neither is hard-blocked (calendar still warns).
const SHORT_PREMIUM_STRATEGIES = new Set(["iron_condor", "iron_fly"]);

// Score penalty (Ravish points) contributed by one in-window event of each type.
const PENALTY: Record<EventRiskType, number> = {
  earnings: 12,
  fomc: 8,
  cpi: 5,
  jobs: 5,
  economic: 4,
  news: 4,
  dividend: 2,
};
const MAX_PENALTY = 25;

// FOMC meets 8×/yr. Approximate the standard months (0-indexed): Jan, Mar, May, Jun,
// Jul, Sep, Nov, Dec — decisions land on a Wednesday.
const FOMC_MONTHS = new Set([0, 2, 4, 5, 6, 8, 10, 11]);

// Symbols that pay a regular dividend (ETFs + dividend-paying mega-caps). Deterministic
// quarterly ex-dates are seeded per symbol.
const PAYS_DIVIDEND = new Set(["SPY", "QQQ", "IWM", "AAPL", "MSFT", "NVDA", "META"]);

export interface EventRiskAssessment {
  level: EventRiskLevel;
  penalty: number;
  blockShortPremium: boolean;
  blockAuto: boolean;
  events: EventRiskEvent[];
  warnings: string[];
}

const EMPTY_ASSESSMENT: EventRiskAssessment = {
  level: "none",
  penalty: 0,
  blockShortPremium: false,
  blockAuto: false,
  events: [],
  warnings: [],
};

// ─── Date helpers (all UTC, integer-day math) ────────────────────────────────
function ymd(ms: number): string {
  return new Date(ms).toISOString().split("T")[0];
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseYmd(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysAway(now: number, dateStr: string): number {
  return Math.round((parseYmd(dateStr) - startOfUtcDay(now)) / DAY_MS);
}

// Date of the nth weekday in a month (weekday: 0=Sun … 6=Sat; n=1 → first occurrence).
function dateOfNthWeekday(year: number, month0: number, weekday: number, n: number): string {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const day = 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7;
  return ymd(Date.UTC(year, month0, day));
}

function macroEvent(
  type: EventRiskType,
  label: string,
  date: string,
  impact: EventRiskEvent["impact"],
): EventRiskEvent {
  return { type, label, date, daysAway: 0, impact, scope: "market", symbol: null };
}

function pushIfInWindow(
  out: EventRiskEvent[],
  now: number,
  endMs: number,
  ev: EventRiskEvent,
): void {
  const da = daysAway(now, ev.date);
  if (da < 0 || parseYmd(ev.date) > endMs) return;
  out.push({ ...ev, daysAway: da });
}

// ─── Calendar generators ─────────────────────────────────────────────────────
// Market-wide macro events between now and endMs.
function macroEvents(now: number, endMs: number): EventRiskEvent[] {
  const out: EventRiskEvent[] = [];
  const start = new Date(startOfUtcDay(now));
  const end = new Date(endMs);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    pushIfInWindow(out, now, endMs, macroEvent("jobs", "Nonfarm payrolls (jobs report)", dateOfNthWeekday(y, m, 5, 1), "medium"));
    pushIfInWindow(out, now, endMs, macroEvent("cpi", "CPI inflation report", dateOfNthWeekday(y, m, 3, 2), "medium"));
    pushIfInWindow(out, now, endMs, macroEvent("economic", "PCE / retail sales", dateOfNthWeekday(y, m, 4, 4), "medium"));
    if (FOMC_MONTHS.has(m)) {
      pushIfInWindow(out, now, endMs, macroEvent("fomc", "FOMC rate decision", dateOfNthWeekday(y, m, 3, 3), "high"));
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

// Next quarterly ex-dividend date for a symbol, on/after `now`. Seeded per symbol.
function nextDividend(symbol: string, now: number): EventRiskEvent | null {
  if (!PAYS_DIVIDEND.has(symbol.toUpperCase())) return null;
  const rng = makeRng(`${symbol.toUpperCase()}|exdiv`);
  const offsetDays = Math.floor(rng() * 90);
  const year = new Date(startOfUtcDay(now)).getUTCFullYear();
  let exMs = Date.UTC(year, 0, 1) + offsetDays * DAY_MS;
  const start = startOfUtcDay(now);
  while (exMs < start) exMs += 91 * DAY_MS;
  const date = ymd(exMs);
  return {
    type: "dividend",
    label: `${symbol.toUpperCase()} ex-dividend`,
    date,
    daysAway: daysAway(now, date),
    impact: "low",
    scope: "symbol",
    symbol: symbol.toUpperCase(),
  };
}

function earningsEvent(symbol: string, earningsInDays: number | null, now: number): EventRiskEvent | null {
  if (earningsInDays === null) return null;
  const date = ymd(startOfUtcDay(now) + earningsInDays * DAY_MS);
  const da = daysAway(now, date);
  if (da < 0) return null;
  return {
    type: "earnings",
    label: `${symbol.toUpperCase()} earnings`,
    date,
    daysAway: da,
    impact: "high",
    scope: "symbol",
    symbol: symbol.toUpperCase(),
  };
}

// ─── Core assessment (pure) ──────────────────────────────────────────────────
export function assessEventRisk(input: {
  symbol: string;
  strategy: string;
  expiration: string;
  now: number;
  earningsInDays: number | null;
  enabled?: boolean;
}): EventRiskAssessment {
  if (input.enabled === false) return { ...EMPTY_ASSESSMENT, events: [], warnings: [] };
  const endMs = parseYmd(input.expiration);
  if (!Number.isFinite(endMs)) return { ...EMPTY_ASSESSMENT, events: [], warnings: [] };

  const events: EventRiskEvent[] = [];
  const earnings = earningsEvent(input.symbol, input.earningsInDays, input.now);
  if (earnings && parseYmd(earnings.date) <= endMs) events.push(earnings);
  const div = nextDividend(input.symbol, input.now);
  if (div && parseYmd(div.date) <= endMs) events.push(div);
  for (const ev of macroEvents(input.now, endMs)) events.push(ev);
  events.sort((a, b) => a.date.localeCompare(b.date));

  const isEarningsPlay = input.strategy === "earnings";
  const isShortPremium = SHORT_PREMIUM_STRATEGIES.has(input.strategy);

  let penalty = 0;
  let blockShortPremium = false;
  // A genuinely high-impact, exceptional event in the window (earnings we are NOT
  // deliberately trading, or an FOMC decision). This — not routine monthly macro —
  // is what escalates to "high" and blocks unattended AutoPilot execution. Recurring
  // medium macro (CPI/jobs/PCE) lands in nearly every 30-45 DTE window, so letting it
  // reach "high" on its own would block AutoPilot almost always; it only lowers score.
  let hasHighImpactEvent = false;
  const warnings: string[] = [];

  for (const ev of events) {
    if (ev.type === "earnings") {
      if (isEarningsPlay) continue; // intentionally trading the event
      penalty += PENALTY.earnings;
      hasHighImpactEvent = true;
      if (isShortPremium) {
        blockShortPremium = true;
        warnings.push(
          `${ev.symbol} earnings (${ev.date}, ${ev.daysAway}d away) lands before expiration — do not open short premium into earnings`,
        );
      } else {
        warnings.push(`Expiration crosses ${ev.symbol} earnings (${ev.date}, ${ev.daysAway}d away)`);
      }
      continue;
    }
    penalty += PENALTY[ev.type];
    if (ev.impact === "high") hasHighImpactEvent = true; // FOMC
    warnings.push(`${ev.label} (${ev.date}, ${ev.daysAway}d away) before expiration`);
  }

  penalty = Math.min(penalty, MAX_PENALTY);

  let level: EventRiskLevel = "none";
  if (blockShortPremium || hasHighImpactEvent || penalty >= MAX_PENALTY) level = "high";
  else if (penalty >= 6) level = "medium";
  else if (penalty > 0) level = "low";

  return {
    level,
    penalty,
    blockShortPremium,
    blockAuto: level === "high",
    events,
    warnings,
  };
}

// ─── Convenience wrappers (pull simulated earnings from the snapshot) ─────────
export function getEventRiskForSymbol(
  symbol: string,
  strategy: string,
  expiration: string,
  now: number = Date.now(),
  enabled: boolean = true,
): EventRiskAssessment {
  const snap = getSnapshot(symbol, todayStr(new Date(now)));
  return assessEventRisk({
    symbol,
    strategy,
    expiration,
    now,
    earningsInDays: snap?.earningsInDays ?? null,
    enabled,
  });
}

// Forward calendar across a set of symbols, used by the GET /events endpoint.
export function getUpcomingEvents(
  symbols: string[],
  now: number = Date.now(),
  horizonDays: number = 45,
): EventRiskEvent[] {
  const endMs = startOfUtcDay(now) + horizonDays * DAY_MS;
  const out: EventRiskEvent[] = [...macroEvents(now, endMs)];
  for (const sym of symbols) {
    const snap = getSnapshot(sym, todayStr(new Date(now)));
    const earnings = earningsEvent(sym, snap?.earningsInDays ?? null, now);
    if (earnings && parseYmd(earnings.date) <= endMs) out.push(earnings);
    const div = nextDividend(sym, now);
    if (div && parseYmd(div.date) <= endMs) out.push(div);
  }
  out.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.symbol ?? "").localeCompare(b.symbol ?? ""),
  );
  return out;
}
