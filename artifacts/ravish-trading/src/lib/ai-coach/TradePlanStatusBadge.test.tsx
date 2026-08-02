// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering coverage for
// the standalone status badge — every one of the 6 lifecycle statuses
// renders its own correct label.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TradePlanStatusBadge } from "./TradePlanStatusBadge";
import type { TradePlanStatus } from "./tradePlansApi";

describe("TradePlanStatusBadge", () => {
  const cases: Array<[TradePlanStatus, string]> = [
    ["draft", "Draft"],
    ["ready", "Ready"],
    ["watching", "Watching"],
    ["executed", "Executed"],
    ["cancelled", "Cancelled"],
    ["archived", "Archived"],
  ];

  for (const [status, label] of cases) {
    it(`renders "${label}" for status "${status}"`, () => {
      render(<TradePlanStatusBadge status={status} testId="badge" />);
      expect(screen.getByTestId("badge")).toHaveTextContent(label);
    });
  }
});
