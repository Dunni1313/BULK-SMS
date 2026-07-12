// In-memory cache of the most recent scan's health metrics. The server is a single
// instance, so a module-level value is sufficient to surface the last scan's counts
// in the market-data health panel between scans.

import type { ScanHealth } from "./liveScanner.js";

let last: ScanHealth | null = null;

export function setLastScanHealth(h: ScanHealth): void {
  last = h;
}

export function getLastScanHealth(): ScanHealth | null {
  return last;
}
