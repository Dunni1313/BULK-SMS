// Polygon options provider — placeholder. The wiring is in place so the factory can
// select it once an implementation and credentials exist; until then it reports
// itself unavailable and returns no chains.

import type { OptionChainData, OptionsProvider } from "./types.js";

export class PolygonOptionsProvider implements OptionsProvider {
  readonly name = "polygon" as const;

  isAvailable(): boolean {
    // No implementation/credentials yet.
    return false;
  }

  async getChain(): Promise<OptionChainData | null> {
    return null;
  }
}
