// v1.5.0, Sprint 12 — Institutional Command Centre. Direct unit coverage
// for the one genuinely new piece of glue logic this sprint introduces:
// counting across the 3 already-existing coachIds using the exact same
// fetch functions notebooksApi.ts/strategiesApi.ts/tradePlansApi.ts
// already export (Sprints 7-10) — never a re-implementation.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWorkflowSnapshot } from "./useWorkflowSnapshot";

const listNotebooksMock = vi.hoisted(() => vi.fn());
const listStrategiesMock = vi.hoisted(() => vi.fn());
const listTradePlansMock = vi.hoisted(() => vi.fn());

vi.mock("./ai-coach/notebooksApi", () => ({ listNotebooks: listNotebooksMock }));
vi.mock("./ai-coach/strategiesApi", () => ({ listStrategies: listStrategiesMock }));
vi.mock("./ai-coach/tradePlansApi", () => ({ listTradePlans: listTradePlansMock }));

describe("useWorkflowSnapshot", () => {
  beforeEach(() => {
    listNotebooksMock.mockReset();
    listStrategiesMock.mockReset();
    listTradePlansMock.mockReset();
  });

  it("sums notebook counts and counts only draft strategies / ready trade plans, across all 3 coachIds", async () => {
    listNotebooksMock.mockImplementation(async (coachId: string) =>
      coachId === "investing" ? [{ id: 1 }, { id: 2 }] : coachId === "trading" ? [{ id: 3 }] : [],
    );
    listStrategiesMock.mockImplementation(async (coachId: string) =>
      coachId === "investing"
        ? [{ id: 1, status: "draft" }, { id: 2, status: "active" }]
        : coachId === "options"
          ? [{ id: 3, status: "draft" }]
          : [],
    );
    listTradePlansMock.mockImplementation(async (coachId: string) =>
      coachId === "trading" ? [{ id: 1, status: "ready" }, { id: 2, status: "watching" }] : [],
    );

    const { result } = renderHook(() => useWorkflowSnapshot());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notebookCount).toBe(3);
    expect(result.current.strategiesDraftCount).toBe(2);
    expect(result.current.tradePlansReadyCount).toBe(1);
  });

  it("degrades honestly to zero counts, never a crash, if one coachId's fetch fails", async () => {
    listNotebooksMock.mockImplementation(async (coachId: string) => {
      if (coachId === "options") throw new Error("network error");
      return [{ id: 1 }];
    });
    listStrategiesMock.mockResolvedValue([]);
    listTradePlansMock.mockResolvedValue([]);

    const { result } = renderHook(() => useWorkflowSnapshot());

    await waitFor(() => expect(result.current.loading).toBe(false));
    // investing + trading each returned 1, options failed and honestly
    // contributed 0 — never a fabricated count, never an unhandled crash.
    expect(result.current.notebookCount).toBe(2);
  });
});
