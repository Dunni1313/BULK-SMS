// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine.

import { describe, it, expect, beforeEach } from "vitest";
import { loadWorkflowDismissals, dismissWorkflowTask, undismissWorkflowTask } from "./workflow-dismissals";

const KEY = "dk-workflow-task-dismissals";

describe("workflow-dismissals", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty set when nothing has ever been dismissed", () => {
    expect(loadWorkflowDismissals().size).toBe(0);
  });

  it("persists a dismissal and reloads it", () => {
    dismissWorkflowTask("trade-closed-to-journal:1");
    expect(loadWorkflowDismissals().has("trade-closed-to-journal:1")).toBe(true);
  });

  it("keeps dismissals scoped to the exact task id, never a whole automation type", () => {
    dismissWorkflowTask("trade-closed-to-journal:1");
    const ids = loadWorkflowDismissals();
    expect(ids.has("trade-closed-to-journal:2")).toBe(false);
  });

  it("un-dismisses a specific task id without affecting others", () => {
    dismissWorkflowTask("trade-closed-to-journal:1");
    dismissWorkflowTask("trade-closed-to-journal:2");
    undismissWorkflowTask("trade-closed-to-journal:1");
    const ids = loadWorkflowDismissals();
    expect(ids.has("trade-closed-to-journal:1")).toBe(false);
    expect(ids.has("trade-closed-to-journal:2")).toBe(true);
  });

  it("degrades to an empty set, never throwing, when localStorage holds corrupt JSON", () => {
    window.localStorage.setItem(KEY, "{not valid json");
    expect(() => loadWorkflowDismissals()).not.toThrow();
    expect(loadWorkflowDismissals().size).toBe(0);
  });

  it("degrades to an empty set when localStorage holds a validly-parsed but wrong shape", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ not: "an array" }));
    expect(loadWorkflowDismissals().size).toBe(0);
  });
});
