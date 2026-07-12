// Provider factory. Selects an options-data provider based on the scanner mode and
// requested provider in settings, falling back to the mock provider whenever a live
// provider is unavailable. The fallback is explicit: the returned selection records
// the active provider and a human-readable reason for the health panel.

import { AlpacaOptionsProvider } from "./alpacaProvider.js";
import { PolygonOptionsProvider } from "./polygonProvider.js";
import { MockOptionsProvider } from "./mockProvider.js";
import type { OptionsProvider, ProviderName, ProviderSelection } from "./types.js";

export * from "./types.js";
export { MockOptionsProvider } from "./mockProvider.js";
export { AlpacaOptionsProvider } from "./alpacaProvider.js";
export { PolygonOptionsProvider } from "./polygonProvider.js";

export interface ProviderSettings {
  scannerMode?: string | null;
  marketDataProvider?: string | null;
  alpacaApiKey?: string | null;
}

function makeLiveProvider(name: ProviderName, apiKey?: string | null): OptionsProvider {
  switch (name) {
    case "alpaca":
      return new AlpacaOptionsProvider(apiKey);
    case "polygon":
      return new PolygonOptionsProvider();
    default:
      return new MockOptionsProvider();
  }
}

export function selectProvider(settings: ProviderSettings): ProviderSelection {
  const mode = settings.scannerMode === "live" ? "live" : "mock";
  const requested = (settings.marketDataProvider as ProviderName) ?? "mock";
  const mock = new MockOptionsProvider();

  if (mode !== "live" || requested === "mock") {
    return {
      provider: mock,
      requested,
      active: "mock",
      mode,
      connected: false,
      reason:
        mode !== "live"
          ? "Scanner in mock mode — using deterministic simulated chains."
          : "Mock provider selected — using deterministic simulated chains.",
    };
  }

  const live = makeLiveProvider(requested, settings.alpacaApiKey);
  if (live.isAvailable()) {
    return {
      provider: live,
      requested,
      active: requested,
      mode,
      connected: true,
      reason: `Connected to ${requested} live options data.`,
    };
  }

  const label = requested === "alpaca" ? "Alpaca" : "Polygon";
  return {
    provider: mock,
    requested,
    active: "mock",
    mode,
    connected: false,
    reason: `${label} credentials not configured — falling back to mock data.`,
  };
}
