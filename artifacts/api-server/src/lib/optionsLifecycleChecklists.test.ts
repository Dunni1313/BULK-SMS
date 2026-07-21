// Phase 36 — Institutional Position Lifecycle Manager.
import { describe, it, expect } from "vitest";
import { getChecklistTemplate, instantiateChecklistItems } from "./optionsLifecycleChecklists.js";
import { OPTIONS_STRATEGY_TEMPLATE_KEYS } from "./optionsStrategyLibrary.js";

describe("optionsLifecycleChecklists.ts", () => {
  it("has a real, non-empty checklist template for every one of the 9 Strategy Library keys", () => {
    for (const key of OPTIONS_STRATEGY_TEMPLATE_KEYS) {
      const template = getChecklistTemplate(key);
      expect(template).not.toBeNull();
      expect(template!.length).toBeGreaterThan(0);
      for (const item of template!) {
        expect(item.id.length).toBeGreaterThan(0);
        expect(item.label.length).toBeGreaterThan(0);
        expect(typeof item.required).toBe("boolean");
      }
    }
  });

  it("honestly returns null for a strategy key outside the 9-key catalog", () => {
    expect(getChecklistTemplate("not-a-real-strategy")).toBeNull();
  });

  it("every template item id is unique within its own template", () => {
    for (const key of OPTIONS_STRATEGY_TEMPLATE_KEYS) {
      const template = getChecklistTemplate(key)!;
      const ids = template.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("instantiateChecklistItems() copies every template item and adds checked:false, never checked:true", () => {
    const items = instantiateChecklistItems("iron_condor");
    expect(items).not.toBeNull();
    const template = getChecklistTemplate("iron_condor")!;
    expect(items!.length).toBe(template.length);
    for (const item of items!) {
      expect(item.checked).toBe(false);
    }
    expect(items!.map((i) => i.id)).toEqual(template.map((i) => i.id));
  });

  it("instantiateChecklistItems() honestly returns null for an unknown strategy key", () => {
    expect(instantiateChecklistItems("not-a-real-strategy")).toBeNull();
  });

  it("covered_call and cash_secured_put templates reflect their own distinct collateral requirements", () => {
    const cc = getChecklistTemplate("covered_call")!;
    const csp = getChecklistTemplate("cash_secured_put")!;
    expect(cc.some((i) => i.id === "shares-owned")).toBe(true);
    expect(csp.some((i) => i.id === "cash-reserved")).toBe(true);
    expect(csp.some((i) => i.id === "shares-owned")).toBe(false);
  });
});
