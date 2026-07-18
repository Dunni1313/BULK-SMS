// Phase 11 — Live Market Operations & Production Validation. Unit tests for
// the US market calendar/clock: the static-approximation holiday formulas
// (verified against known, hand-checked 2026 dates), the live-Alpaca-first
// / static-fallback priority in getMarketClockStatus(), and the honest
// `source` labeling that never conflates the two.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { staticMarketHolidays, isStaticMarketHoliday, getMarketClockStatus } from "./marketCalendar.js";

let originalKey: string | undefined;
let originalSecret: string | undefined;

beforeEach(() => {
  originalKey = process.env.ALPACA_API_KEY;
  originalSecret = process.env.ALPACA_API_SECRET;
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ALPACA_API_KEY;
  else process.env.ALPACA_API_KEY = originalKey;
  if (originalSecret === undefined) delete process.env.ALPACA_API_SECRET;
  else process.env.ALPACA_API_SECRET = originalSecret;
});

function jsonResponse(status: number, data: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as unknown as Response;
}

describe("staticMarketHolidays", () => {
  it("computes the 10 standard 2026 NYSE/Nasdaq holidays exactly, including weekend-observed shifts", () => {
    const holidays = staticMarketHolidays(2026);
    const byName = Object.fromEntries(holidays.map((h) => [h.name, h.date]));
    expect(byName["New Year's Day"]).toBe("2026-01-01");
    expect(byName["Martin Luther King Jr. Day"]).toBe("2026-01-19");
    expect(byName["Washington's Birthday"]).toBe("2026-02-16");
    expect(byName["Good Friday"]).toBe("2026-04-03");
    expect(byName["Memorial Day"]).toBe("2026-05-25");
    expect(byName["Juneteenth"]).toBe("2026-06-19");
    // July 4, 2026 falls on a Saturday — observed the preceding Friday.
    expect(byName["Independence Day"]).toBe("2026-07-03");
    expect(byName["Labor Day"]).toBe("2026-09-07");
    expect(byName["Thanksgiving Day"]).toBe("2026-11-26");
    expect(byName["Christmas Day"]).toBe("2026-12-25");
    expect(holidays).toHaveLength(10);
  });

  it("returns a sorted, deterministic list across repeated calls", () => {
    const a = staticMarketHolidays(2027);
    const b = staticMarketHolidays(2027);
    expect(a).toEqual(b);
    const dates = a.map((h) => h.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe("isStaticMarketHoliday", () => {
  it("identifies a real holiday by date", () => {
    expect(isStaticMarketHoliday("2026-12-25")?.name).toBe("Christmas Day");
  });

  it("honestly returns null for an ordinary trading day", () => {
    expect(isStaticMarketHoliday("2026-07-15")).toBeNull();
  });
});

describe("getMarketClockStatus", () => {
  it("falls back to the static approximation honestly when Alpaca has no credentials", async () => {
    const status = await getMarketClockStatus(null);
    expect(status.source).toBe("static_approximation");
    expect(status.nextOpen).toBeNull();
    expect(status.nextClose).toBeNull();
    expect(status.currentTimeEt).toMatch(/^\d{2}:\d{2}$/);
  });

  it("reports Alpaca's own live clock when configured and reachable, never mixed with the static path", async () => {
    process.env.ALPACA_API_KEY = "k";
    process.env.ALPACA_API_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, {
        timestamp: "2026-07-17T12:00:00-04:00",
        is_open: true,
        next_open: "2026-07-18T09:30:00-04:00",
        next_close: "2026-07-17T16:00:00-04:00",
      }),
    );

    const status = await getMarketClockStatus(null);
    expect(status.source).toBe("alpaca");
    expect(status.isOpen).toBe(true);
    expect(status.nextOpen).toBe("2026-07-18T09:30:00-04:00");
    expect(status.nextClose).toBe("2026-07-17T16:00:00-04:00");
  });

  it("honestly flags a static holiday as closed, with a reason naming it", async () => {
    vi.useFakeTimers();
    // 2026-12-25 12:00 UTC is safely within Christmas Day in America/New_York.
    vi.setSystemTime(new Date("2026-12-25T17:00:00Z"));
    const status = await getMarketClockStatus(null);
    expect(status.source).toBe("static_approximation");
    expect(status.isOpen).toBe(false);
    expect(status.reason).toMatch(/Christmas Day/);
    vi.useRealTimers();
  });

  it("honestly flags a weekend as closed", async () => {
    vi.useFakeTimers();
    // 2026-07-18 is a Saturday.
    vi.setSystemTime(new Date("2026-07-18T17:00:00Z"));
    const status = await getMarketClockStatus(null);
    expect(status.isOpen).toBe(false);
    expect(status.reason).toMatch(/weekend/);
    vi.useRealTimers();
  });

  it("honestly reports open during standard weekday trading hours on a non-holiday", async () => {
    vi.useFakeTimers();
    // 2026-07-15 is a Wednesday; 17:00 UTC is 13:00 ET (within 9:30-16:00).
    vi.setSystemTime(new Date("2026-07-15T17:00:00Z"));
    const status = await getMarketClockStatus(null);
    expect(status.isOpen).toBe(true);
    vi.useRealTimers();
  });
});
