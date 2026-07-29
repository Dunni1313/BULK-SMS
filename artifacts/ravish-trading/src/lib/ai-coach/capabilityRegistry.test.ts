// v1.5.0 Sprint 4 — AI Context & Tools Consolidation. Proves the "Tool
// Registry" / "Capability Flags" module (capabilityRegistry.ts) actually
// enforces what it claims: every capability any real coach config declares
// is registered, owned correctly, and a coach can never claim another
// coach's capability or an unregistered/typo'd string.

import { describe, it, expect } from "vitest";
import {
  CAPABILITY_REGISTRY,
  isCapabilityPermittedFor,
  capabilitiesOwnedBy,
  type CoachId,
} from "./capabilityRegistry";
import { tradingCoachConfig } from "./coaches/tradingCoach.config";
import { investingCoachConfig } from "./coaches/investingCoach.config";
import { optionsCoachConfig } from "./coaches/optionsCoach.config";

const CONFIGS: Record<CoachId, readonly string[]> = {
  trading: tradingCoachConfig.capabilities,
  investing: investingCoachConfig.capabilities,
  options: optionsCoachConfig.capabilities,
};

describe("Tool Registry — exposes only permitted tools", () => {
  it("permits each coach's own registered capabilities", () => {
    for (const [coachId, capabilities] of Object.entries(CONFIGS) as [CoachId, readonly string[]][]) {
      for (const capability of capabilities) {
        expect(isCapabilityPermittedFor(coachId, capability)).toBe(true);
      }
    }
  });

  it("rejects a coach claiming another coach's capability", () => {
    expect(isCapabilityPermittedFor("trading", "greeks")).toBe(false);
    expect(isCapabilityPermittedFor("trading", "company-research")).toBe(false);
    expect(isCapabilityPermittedFor("investing", "market-structure")).toBe(false);
    expect(isCapabilityPermittedFor("investing", "expected-value")).toBe(false);
    expect(isCapabilityPermittedFor("options", "regime")).toBe(false);
    expect(isCapabilityPermittedFor("options", "investment-committee")).toBe(false);
  });

  it("rejects an unregistered/typo'd capability string for every coach", () => {
    expect(isCapabilityPermittedFor("trading", "market-structur")).toBe(false);
    expect(isCapabilityPermittedFor("investing", "not-a-real-capability")).toBe(false);
    expect(isCapabilityPermittedFor("options", "")).toBe(false);
  });

  it("capabilitiesOwnedBy(coachId) returns exactly the capabilities that coach's real config declares", () => {
    for (const [coachId, capabilities] of Object.entries(CONFIGS) as [CoachId, readonly string[]][]) {
      const owned = capabilitiesOwnedBy(coachId);
      expect(new Set(owned)).toEqual(new Set(capabilities));
    }
  });

  it("every registered capability has exactly one owning coach (no shared ownership)", () => {
    for (const entry of Object.values(CAPABILITY_REGISTRY)) {
      expect(entry.owners.length).toBe(1);
    }
  });

  it("the registry's total capability count exactly matches the sum of all 3 coaches' own declared capabilities", () => {
    const totalDeclared = Object.values(CONFIGS).reduce((sum, caps) => sum + caps.length, 0);
    expect(Object.keys(CAPABILITY_REGISTRY).length).toBe(totalDeclared);
  });
});

describe("Capability Flags — each coach's declared capabilities are exactly what the registry says it owns", () => {
  it("Trading AI Coach", () => {
    expect(new Set(tradingCoachConfig.capabilities)).toEqual(new Set(capabilitiesOwnedBy("trading")));
  });

  it("Investing AI Coach", () => {
    expect(new Set(investingCoachConfig.capabilities)).toEqual(new Set(capabilitiesOwnedBy("investing")));
  });

  it("Options AI Coach", () => {
    expect(new Set(optionsCoachConfig.capabilities)).toEqual(new Set(capabilitiesOwnedBy("options")));
  });
});
