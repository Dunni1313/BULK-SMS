// Phase 26 — Institutional Market Structure Workbench.
//
// A small, self-contained fetch helper for the handful of real, already-
// shipped server-side query-param overrides (?interval=&lookback= on
// GET /trading/structure/:symbol and GET /trading/structure-timeline/:symbol;
// ?timeframes= on GET /trading/multi-timeframe/:symbol) that no generated
// hook can expose — documenting a path parameter and a query parameter
// together on the same OpenAPI operation triggers a known Orval
// zod+split-types codegen collision (first disclosed at Phase 3 Sprint 40),
// so these overrides are deliberately kept outside the formal typed
// contract, exactly as every prior sprint touching this exact limitation
// has done. This is the first frontend consumer that actually needs one of
// these overrides, so a plain fetch()-based useQuery is the correct,
// minimal fix — not a change to the generated client or its exports.
import { useQuery } from "@tanstack/react-query";
import type {
  TradingStructureAnalysis,
  TradingMultiTimeframeAnalysis,
  TradingStructureShiftTimeline,
} from "@workspace/api-client-react";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request to ${url} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export function useTradingStructureWithParams(symbol: string, interval: string, lookback: number) {
  return useQuery({
    queryKey: ["trading-structure-params", symbol, interval, lookback],
    queryFn: () =>
      fetchJson<TradingStructureAnalysis>(
        `/api/trading/structure/${encodeURIComponent(symbol)}?interval=${interval}&lookback=${lookback}`,
      ),
    enabled: !!symbol,
  });
}

export function useTradingMultiTimeframeWithParams(symbol: string, timeframes: string[]) {
  return useQuery({
    queryKey: ["trading-multi-timeframe-params", symbol, timeframes.join(",")],
    queryFn: () =>
      fetchJson<TradingMultiTimeframeAnalysis>(
        `/api/trading/multi-timeframe/${encodeURIComponent(symbol)}?timeframes=${timeframes.join(",")}`,
      ),
    enabled: !!symbol && timeframes.length > 0,
  });
}

export function useTradingStructureTimeline(symbol: string, interval: string, lookback: number) {
  return useQuery({
    queryKey: ["trading-structure-timeline", symbol, interval, lookback],
    queryFn: () =>
      fetchJson<TradingStructureShiftTimeline>(
        `/api/trading/structure-timeline/${encodeURIComponent(symbol)}?interval=${interval}&lookback=${lookback}`,
      ),
    enabled: !!symbol,
  });
}
