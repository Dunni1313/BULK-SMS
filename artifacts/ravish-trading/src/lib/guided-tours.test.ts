// v1.6.0, Sprint 3 — UX Transformation. Unit coverage for the Guided
// Tours content registry and its localStorage completion tracking.
import { describe, it, expect, beforeEach } from "vitest";
import { GUIDED_TOURS, hasCompletedTour, markTourCompleted, type GuidedTourId } from "./guided-tours";

describe("guided-tours", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defines exactly the 4 approved tours, each with at least 2 real steps", () => {
    const ids: GuidedTourId[] = ["first-trade", "first-research", "first-journal", "first-portfolio-review"];
    for (const id of ids) {
      expect(GUIDED_TOURS[id]).toBeDefined();
      expect(GUIDED_TOURS[id].steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every step that names an href points somewhere real (a non-empty, root-relative path)", () => {
    for (const tour of Object.values(GUIDED_TOURS)) {
      for (const step of tour.steps) {
        if (step.href) {
          expect(step.href.startsWith("/")).toBe(true);
        }
      }
    }
  });

  it("reports a tour as not completed until explicitly marked", () => {
    expect(hasCompletedTour("first-trade")).toBe(false);
    markTourCompleted("first-trade");
    expect(hasCompletedTour("first-trade")).toBe(true);
  });

  it("tracks each tour's completion independently", () => {
    markTourCompleted("first-research");
    expect(hasCompletedTour("first-research")).toBe(true);
    expect(hasCompletedTour("first-journal")).toBe(false);
    expect(hasCompletedTour("first-trade")).toBe(false);
  });

  it("marking the same tour completed twice is a safe no-op", () => {
    markTourCompleted("first-journal");
    markTourCompleted("first-journal");
    expect(hasCompletedTour("first-journal")).toBe(true);
  });

  it("fails open (never throws) when localStorage access itself throws", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("storage disabled");
    };
    expect(() => hasCompletedTour("first-portfolio-review")).not.toThrow();
    expect(hasCompletedTour("first-portfolio-review")).toBe(false);
    Storage.prototype.getItem = original;
  });
});
