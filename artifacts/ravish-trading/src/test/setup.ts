import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom doesn't implement ResizeObserver; recharts' <ResponsiveContainer> (used by
// the Financial Ratios trend charts, Phase 2 Sprint 18) requires one to mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom doesn't implement window.matchMedia; AppLayout's useIsMobile hook
// (src/hooks/use-mobile.tsx) requires it to mount — first needed by
// App.test.tsx (Phase 4, Sprint 53), the first test to render AppLayout
// rather than a bare page component, but benefits any future test that
// does the same.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});
