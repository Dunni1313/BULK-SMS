// Phase 11 — Live Market Operations & Production Validation. A US equity
// market calendar/clock — genuinely new capability: no trading-calendar,
// market-holiday, or timezone awareness existed anywhere in this codebase
// before this module. Every other engine's "is the market open" question
// was previously either unanswered or approximated inline (none did) —
// this is the one, shared, honest answer.
//
// Two sources, in explicit priority order, exactly mirroring the
// live-with-fallback pattern every other provider in this codebase already
// follows (SimulatedFundamentalsProvider, SimulatedMarketDataProvider,
// PolygonOptionsProvider):
//   1. Alpaca's own /v2/clock and /v2/calendar (getAlpacaMarketClock()/
//      getAlpacaMarketCalendar(), lib/providers/alpacaBroker.ts) — live,
//      authoritative, used whenever ALPACA_API_KEY/ALPACA_API_SECRET (or
//      the settings-stored key) are configured and Alpaca is reachable.
//   2. A static, deterministic approximation — standard NYSE/Nasdaq
//      holidays (computed by formula for the requested year, never a
//      hardcoded literal-date table that silently goes stale) plus
//      9:30am-4:00pm America/New_York on a non-holiday weekday — used
//      whenever Alpaca is unavailable. Every result carries an honest
//      `source: "alpaca" | "static_approximation"` field; the static path
//      is NEVER presented as if it were live.
//
// Disclosed, deliberate limitation of the static approximation: it does
// not know about an early-close half-day (e.g. the day after Thanksgiving,
// Christmas Eve) or an exchange-declared unscheduled closure — only
// Alpaca's own live /v2/calendar captures those. This is a real gap,
// not a bug, and is called out in docs/Live-Market-Validation.md.

import { getAlpacaMarketClock, getAlpacaMarketCalendar } from "./providers/alpacaBroker.js";

export type MarketCalendarSource = "alpaca" | "static_approximation";

export interface MarketClockStatus {
  source: MarketCalendarSource;
  isOpen: boolean;
  currentTimeEt: string; // HH:MM, America/New_York
  nextOpen: string | null; // ISO timestamp when known (Alpaca only)
  nextClose: string | null; // ISO timestamp when known (Alpaca only)
  reason: string;
}

export interface MarketHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

const ET_TIME_ZONE = "America/New_York";

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // month is 1-12, weekday is 0=Sunday..6=Saturday, n is 1-based occurrence.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(Date.UTC(year, month - 1, day));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, lastDayOfMonth));
  const lastWeekday = last.getUTCDay();
  const offset = (lastWeekday - weekday + 7) % 7;
  return new Date(Date.UTC(year, month - 1, lastDayOfMonth - offset));
}

// Anonymous Gregorian algorithm — a standard, well-known closed-form
// computation for the date of Easter Sunday, used only to derive Good
// Friday (Easter Sunday minus 2 days), the one US market holiday whose
// date isn't a fixed weekday-of-month rule.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The standard 9 NYSE/Nasdaq full-day holidays. When a fixed-date holiday
// (New Year's Day, Juneteenth, Independence Day, Christmas) falls on a
// weekend, US exchanges observe it on the adjacent weekday (Friday if it
// falls on Saturday, Monday if it falls on Sunday) — applied here for those
// 4 fixed-date holidays; the other 5 are already defined by weekday rules.
function observedWeekday(d: Date): Date {
  const day = d.getUTCDay();
  if (day === 6) return new Date(d.getTime() - 86400000); // Saturday -> Friday
  if (day === 0) return new Date(d.getTime() + 86400000); // Sunday -> Monday
  return d;
}

export function staticMarketHolidays(year: number): MarketHoliday[] {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter.getTime() - 2 * 86400000);
  return [
    { date: toDateStr(observedWeekday(new Date(Date.UTC(year, 0, 1)))), name: "New Year's Day" },
    { date: toDateStr(nthWeekdayOfMonth(year, 1, 1, 3)), name: "Martin Luther King Jr. Day" },
    { date: toDateStr(nthWeekdayOfMonth(year, 2, 1, 3)), name: "Washington's Birthday" },
    { date: toDateStr(goodFriday), name: "Good Friday" },
    { date: toDateStr(lastWeekdayOfMonth(year, 5, 1)), name: "Memorial Day" },
    { date: toDateStr(observedWeekday(new Date(Date.UTC(year, 5, 19)))), name: "Juneteenth" },
    { date: toDateStr(observedWeekday(new Date(Date.UTC(year, 6, 4)))), name: "Independence Day" },
    { date: toDateStr(nthWeekdayOfMonth(year, 9, 1, 1)), name: "Labor Day" },
    { date: toDateStr(nthWeekdayOfMonth(year, 11, 4, 4)), name: "Thanksgiving Day" },
    { date: toDateStr(observedWeekday(new Date(Date.UTC(year, 11, 25)))), name: "Christmas Day" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function isStaticMarketHoliday(dateStr: string): MarketHoliday | null {
  const year = Number(dateStr.slice(0, 4));
  return staticMarketHolidays(year).find((h) => h.date === dateStr) ?? null;
}

function etParts(now: Date): { hour: number; minute: number; weekday: number; dateStr: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 0,
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

function staticMarketClock(now: Date): MarketClockStatus {
  const { hour, minute, weekday, dateStr } = etParts(now);
  const holiday = isStaticMarketHoliday(dateStr);
  const isWeekend = weekday === 0 || weekday === 6;
  const minutesOfDay = hour * 60 + minute;
  const withinHours = minutesOfDay >= 9 * 60 + 30 && minutesOfDay < 16 * 60;
  const isOpen = !isWeekend && !holiday && withinHours;

  let reason: string;
  if (holiday) reason = `Static approximation: closed for ${holiday.name}.`;
  else if (isWeekend) reason = "Static approximation: closed — weekend.";
  else if (!withinHours) reason = "Static approximation: outside standard 9:30am-4:00pm ET hours.";
  else reason = "Static approximation: within standard weekday trading hours.";

  return {
    source: "static_approximation",
    isOpen,
    currentTimeEt: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    nextOpen: null,
    nextClose: null,
    reason,
  };
}

// The one function every caller (liveMarketValidation.ts, the Operations
// Dashboard route) should use — resolves Alpaca first, falls back to the
// static approximation honestly, never silently mixing the two.
export async function getMarketClockStatus(settingsApiKey?: string | null): Promise<MarketClockStatus> {
  const live = await getAlpacaMarketClock(settingsApiKey);
  if (live.ok) {
    const { hour, minute } = etParts(new Date(live.data.timestamp));
    return {
      source: "alpaca",
      isOpen: live.data.isOpen,
      currentTimeEt: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      nextOpen: live.data.nextOpen,
      nextClose: live.data.nextClose,
      reason: live.data.isOpen ? "Alpaca reports the market is open." : "Alpaca reports the market is closed.",
    };
  }
  return staticMarketClock(new Date());
}

export { getAlpacaMarketCalendar };
