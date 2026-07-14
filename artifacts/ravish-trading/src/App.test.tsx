// Phase 4, Sprint 53 — Frontend Bundle Code-Splitting. The first test in
// this codebase to exercise the real router end-to-end (every other page
// test imports and renders its own page component directly, bypassing
// App.tsx/wouter entirely — those tests are completely unaffected by this
// sprint's change, since a direct static import in a test file is
// independent of how App.tsx itself loads a page). This file proves the
// new React.lazy() + <Suspense> mechanism itself: navigating to a route
// shows PageLoadingFallback while that route's own chunk is still
// resolving, then the correct page's content mounts — regression
// protection for the router that didn't exist before this sprint added
// genuinely new App-level behavior (a Suspense boundary).
//
// Follows this codebase's own established reliable test pattern (see
// src/test/page-test-pattern.guardrail.test.ts and its reference,
// pages/Trades.test.tsx): a hoisted state object via vi.hoisted(), top-level
// vi.mock(...) calls, and a STATIC import of App — never vi.resetModules()
// combined with a dynamic import, which this codebase's own guardrail test
// forbids as a source of repeated flakiness under parallel CPU load.
//
// Navigation is driven by window.history.pushState() before each fresh
// render() call — wouter's own browser-location hook reads window.location
// on mount, so no module reset is needed to control which route a given
// render starts on.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render, waitForElementToBeRemoved } from "@testing-library/react";

// AppLayout itself (not any individual page) polls useListTradeAdjustments
// for its own attention-badge count — every other page test in this
// codebase bypasses AppLayout entirely by rendering its own page directly,
// so none of them needed this mock; App.test.tsx is the first to render
// AppLayout, so it's the first to need it, following the same
// "override just the specific hooks a component needs, spread the rest"
// pattern every other page test already establishes.
vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTradeAdjustments: () => ({ data: [] }),
  };
});

// Both AppLayout and Login itself call useSession() (Better-Auth's own
// client hook, a separate library from @workspace/api-client-react above)
// — stubbed to an honest "no session" rather than trying to shape a fake
// fetch response that satisfies Better-Auth's own internal parsing.
vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return {
    ...actual,
    useSession: () => ({ data: null }),
  };
});

const fetchStub = vi.hoisted(() => vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));

import App from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", fetchStub);
  window.history.pushState(null, "", "/");
});

function renderAppAt(path: string) {
  window.history.pushState(null, "", path);
  return render(<App />);
}

describe("App — router + lazy-loaded pages (Sprint 53)", () => {
  it("shows the loading fallback while a route's chunk is still resolving, then the real page content", async () => {
    renderAppAt("/login");
    // The fallback is present immediately (the lazy import is always
    // asynchronous, even for a local module) — proven by the fact this
    // query succeeds without needing an async findBy*.
    const fallback = screen.queryByTestId("page-loading-fallback");
    if (fallback) {
      await waitForElementToBeRemoved(fallback);
    }
    // Login page's own CardDescription — deliberately not just "Sign in",
    // since AppLayout's own persistent sidebar footer also has a "Sign in"
    // link on every page when there's no session, which would collide.
    expect(await screen.findByText("Sign in to your account.")).toBeInTheDocument();
  });

  it("navigates to the Settings page and mounts its real content", async () => {
    renderAppAt("/settings");
    expect(await screen.findByText("System Settings")).toBeInTheDocument();
  });

  it("navigates to an unknown path and renders the NotFound page, never a fabricated route", async () => {
    renderAppAt("/this-route-does-not-exist");
    expect(await screen.findByText(/404/i)).toBeInTheDocument();
  });

  it("navigating between two different routes mounts two different pages' own content", async () => {
    const { unmount } = renderAppAt("/login");
    await screen.findByText("Sign in to your account.");
    unmount();

    renderAppAt("/settings");
    expect(await screen.findByText("System Settings")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to your account.")).not.toBeInTheDocument();
  });
});
