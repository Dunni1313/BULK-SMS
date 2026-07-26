import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
// v1.3.1 — AI Trading Coach. TradingCoachProvider is now a permanent part
// of the real app shell (App.tsx wraps <AppLayout> with it, matching
// QueryClientProvider's own always-present role) — several pages
// (Scanner, TradeExecutionCenter, Dashboard, Portfolio, TradingResearch)
// call useTradingCoach() unconditionally via their new "Ask AI Trading
// Coach" triggers, and AppLayout itself renders TradingCoachLauncher/
// Panel. Wrapping it here, once, in the single shared test helper, is the
// correct fix — sprinkling a per-test-file provider wrapper around every
// affected page test would duplicate this exact same wiring many times
// over.
import { TradingCoachProvider } from "@/hooks/use-trading-coach";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function renderWithClient(
  ui: ReactElement,
  options?: { queryClient?: QueryClient } & Omit<RenderOptions, "wrapper">,
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TradingCoachProvider>{children}</TradingCoachProvider>
    </QueryClientProvider>
  );
  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}
