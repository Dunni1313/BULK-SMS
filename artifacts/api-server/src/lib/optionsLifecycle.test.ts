// Phase 36 — Institutional Position Lifecycle Manager.
//
// Pure-function unit coverage only. Every other exported function in
// optionsLifecycle.ts touches the database directly (ownership-scoped
// reads/writes against trades/options_lifecycle_state/
// options_lifecycle_events/options_position_checklists) and is covered
// end-to-end, against a real Postgres connection and real signed-up
// users, by routes/optionsLifecycle.route.test.ts instead — the same
// split Phase 35 established between optionsIncomeAnalytics.test.ts
// (pure) and optionsIncome.route.test.ts (live).
import { describe, it, expect } from "vitest";
import { LIFECYCLE_STAGES, REVIEW_CADENCES, LIFECYCLE_EVENT_TYPES, defaultStageFor } from "./optionsLifecycle.js";

describe("LIFECYCLE_STAGES", () => {
  it("is exactly the 8 stages named in the Phase 36 kickoff, in order, with no automatic-transition stage implied", () => {
    expect(LIFECYCLE_STAGES).toEqual(["draft", "planned", "open", "monitoring", "near_expiration", "assignment_risk", "closed", "archived"]);
  });
});

describe("REVIEW_CADENCES", () => {
  it("is exactly the 5 cadences named in the Phase 36 kickoff", () => {
    expect(REVIEW_CADENCES).toEqual(["daily", "weekly", "monthly", "expiration", "manual"]);
  });
});

describe("LIFECYCLE_EVENT_TYPES", () => {
  it("is exactly the 4 event types backing Position Timeline/History, Adjustment Journal, and Assignment Tracker as one append-only log", () => {
    expect(LIFECYCLE_EVENT_TYPES).toEqual(["stage_change", "review", "adjustment_note", "assignment_note"]);
  });
});

describe("defaultStageFor", () => {
  it("honestly derives 'open' for a real, already-open (or pending/any-other-real-status) trade, never a fabricated 'draft'", () => {
    expect(defaultStageFor("open")).toBe("open");
    expect(defaultStageFor("pending")).toBe("open");
    expect(defaultStageFor("some-future-status")).toBe("open");
  });

  it("derives 'closed' directly from a real closed trade's own status", () => {
    expect(defaultStageFor("closed")).toBe("closed");
  });

  it("derives 'draft' only for a trade that was never actually opened (cancelled/rejected)", () => {
    expect(defaultStageFor("cancelled")).toBe("draft");
    expect(defaultStageFor("rejected")).toBe("draft");
  });
});
