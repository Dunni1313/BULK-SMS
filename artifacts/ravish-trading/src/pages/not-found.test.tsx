// Phase 6, Sprint 71 — Frontend Legacy Page Test Coverage, Slice 1.
// The simplest of the 14 pages left without a dedicated test file (Phase 5's
// own closure review, re-confirmed in the Phase 6 planning doc) — a static,
// data-free 404 page, no hooks, no mocking needed.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";
import NotFound from "./not-found";

describe("NotFound page", () => {
  it("renders the 404 heading and message", () => {
    renderWithClient(<NotFound />);
    expect(screen.getByText("404 Page Not Found")).toBeInTheDocument();
    expect(screen.getByText(/did you forget to add the page to the router/i)).toBeInTheDocument();
  });
});
