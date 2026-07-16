// Phase 4, Sprint 52 — Platform Hardening. Unit tests for the request-volume
// baseline logic, independent of any real interval timer or the shared app
// instance.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordRequest,
  flushRequestMetricsWindow,
  resetRequestMetricsForTest,
} from "./requestMetrics.js";
import { logger } from "./logger.js";

describe("requestMetrics", () => {
  beforeEach(() => {
    resetRequestMetricsForTest();
  });

  it("counts requests by status-code class", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => undefined as never);
    recordRequest(200);
    recordRequest(201);
    recordRequest(301);
    recordRequest(404);
    recordRequest(500);
    flushRequestMetricsWindow();

    expect(spy).toHaveBeenCalledTimes(1);
    const [payload] = spy.mock.calls[0];
    expect(payload).toMatchObject({
      total: 5,
      byStatusClass: { "2xx": 2, "3xx": 1, "4xx": 1, "5xx": 1, other: 0 },
    });
    spy.mockRestore();
  });

  it("classifies an out-of-range status code as 'other', never fabricating a class", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => undefined as never);
    recordRequest(101); // informational, below the 2xx band
    flushRequestMetricsWindow();
    const [payload] = spy.mock.calls[0] as [{ byStatusClass: Record<string, number> }];
    expect(payload.byStatusClass.other).toBe(1);
    spy.mockRestore();
  });

  it("never logs an empty window — a zero-traffic period produces no log line", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => undefined as never);
    flushRequestMetricsWindow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("resets the window after flushing, so the next flush starts from zero", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => undefined as never);
    recordRequest(200);
    flushRequestMetricsWindow();
    recordRequest(200);
    recordRequest(200);
    flushRequestMetricsWindow();

    expect(spy).toHaveBeenCalledTimes(2);
    const [secondPayload] = spy.mock.calls[1];
    expect(secondPayload).toMatchObject({ total: 2 });
    spy.mockRestore();
  });
});
