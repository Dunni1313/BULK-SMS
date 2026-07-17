// Phase 10 — Institutional Platform Polish & Control Center. Tests for
// AppLayout's own new Command Palette wiring: the visible search trigger
// button and the global ⌘K / Ctrl+K keyboard shortcut. Follows the same
// required-hook-mocking set App.test.tsx already established for
// rendering AppLayout for the first time (Sprint 53) — CommandPalette's
// own data hooks are all enabled-gated (fetch only while open), so they
// need no additional mocking here, matching that established pattern.

import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTradeAdjustments: () => ({ data: [] }),
    useListNotifications: () => ({ data: [] }),
    useCheckNotifications: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateNotification: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return {
    ...actual,
    useSession: () => ({ data: null }),
  };
});

import { AppLayout } from "./AppLayout";

describe("AppLayout — Command Palette wiring", () => {
  it("shows a visible search trigger with the platform-appropriate keyboard hint", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    const button = screen.getByTestId("button-open-command-palette");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toMatch(/⌘K|Ctrl\+K/);
  });

  it("clicking the search trigger opens the Command Palette", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-open-command-palette"));
    // The Command Palette is lazy-loaded (kept out of AppLayout's own
    // eagerly-loaded bundle chunk, see AppLayout.tsx's own header comment
    // on the lazy() import) — its first open resolves an async chunk load,
    // so this assertion waits rather than checking synchronously.
    await waitFor(() => expect(screen.getByTestId("command-palette-input")).toBeInTheDocument());
  });

  it("pressing Ctrl+K opens the Command Palette from anywhere on the page", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId("command-palette-input")).toBeInTheDocument());
  });

  it("pressing Ctrl+K again toggles the palette closed", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId("command-palette-input")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();
  });

  it("the sidebar links to both Institutional Home and the Command Center at their own distinct routes", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Institutional Home").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Command Center").closest("a")).toHaveAttribute("href", "/command-center");
    expect(screen.getByText("Notifications").closest("a")).toHaveAttribute("href", "/notifications");
  });
});
