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

// jsdom doesn't implement the Pointer Events capture API or scrollIntoView,
// which Radix UI's <Select> (and other Radix primitives) call internally
// during a real pointer-driven open/select interaction — first needed by
// TradeHistory.test.tsx (Trade History, Performance Analytics & Trading
// Journal sprint), the first test in this codebase to drive a Radix
// <Select> dropdown via userEvent.click() rather than only asserting its
// initial rendered value. No-op stubs, matching the same minimal
// jsdom-gap-stub precedent as ResizeObserverStub/matchMedia above.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
});
