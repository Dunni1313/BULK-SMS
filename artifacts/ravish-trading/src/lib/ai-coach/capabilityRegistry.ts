// v1.5.0 Sprint 4 — AI Context & Tools Consolidation.
//
// The "Tool Registry" / "Capability Flags" module for this codebase's
// specialist coaches. No coach performs LLM function-calling ("tools" in
// the OpenAI/Anthropic tool-use sense) — confirmed by Sprint 3's own
// investigation into every AI Coach surface in this codebase, and
// unchanged this sprint. What each coach's CoachConfig.capabilities array
// (Sprint 3) actually declares is a human-readable list of the specialist
// data/analysis its answers are grounded in.
//
// Sprint 3 left `capabilities` typed as a bare `readonly string[]` — any
// string was accepted, so a typo'd or copy-pasted capability could
// silently drift with nothing to catch it. This registry turns that into
// a single, validated vocabulary: every capability string any coach may
// ever declare is registered here exactly once, tagged with which coach
// owns it, so:
//   1. `RegisteredCapability` (a string-literal union derived from this
//      registry's own keys) is now the actual TYPE of CoachConfig.capabilities
//      — an unregistered string is a compile-time error, not a silent typo.
//   2. `isCapabilityPermittedFor(coachId, capability)` makes "does coach X
//      have access to capability Y" a real, directly testable question.
//
// Purely additive and declarative — this module is imported by the 3
// existing coach configs' own TYPE constraint and by tests; it introduces
// no new runtime code path into any existing coach's send/stream/error
// behavior (no call site invokes isCapabilityPermittedFor() at runtime),
// so no existing behavior changes.

export type CoachId = "trading" | "investing" | "options";

interface CapabilityRegistration {
  /** Human-readable description of what this capability actually grounds
   * a coach's answers in. */
  description: string;
  /** The coach(es) permitted to declare this capability. */
  owners: readonly CoachId[];
}

export const CAPABILITY_REGISTRY = {
  "market-structure": {
    description: "Engine 2 support/resistance and trend structure for the searched symbol",
    owners: ["trading"],
  },
  "multi-timeframe": {
    description: "Engine 2 cross-timeframe trend confluence",
    owners: ["trading"],
  },
  liquidity: {
    description: "Engine 2 volume profile / dollar-volume liquidity band",
    owners: ["trading"],
  },
  regime: {
    description: "Engine 2 market regime (trend + volatility) classification",
    owners: ["trading"],
  },
  probability: {
    description: "Engine 2 lognormal price-probability cone",
    owners: ["trading"],
  },
  "trading-risk": {
    description: "Engine 2 portfolio risk (position sizing, stop discipline, portfolio budget)",
    owners: ["trading"],
  },
  "company-research": {
    description: "Engine 1 company overview / business quality / moat",
    owners: ["investing"],
  },
  "valuation-fundamentals": {
    description: "Engine 1 Graham/DCF/Buffett valuation models and the consolidated margin of safety",
    owners: ["investing"],
  },
  "investment-committee": {
    description: "Engine 1 Investment Committee's consolidated verdict and votes",
    owners: ["investing"],
  },
  greeks: {
    description: "Options Engine Greeks (Delta/Theta/Gamma/Vega)",
    owners: ["options"],
  },
  "probability-of-profit": {
    description: "Options Engine probability-of-profit math",
    owners: ["options"],
  },
  "expected-value": {
    description: "Options Engine expected-value math",
    owners: ["options"],
  },
  "trade-explanation": {
    description: "Options Engine trade-explanation narration",
    owners: ["options"],
  },
  quiz: {
    description: "Options Engine quiz mode",
    owners: ["options"],
  },
} as const satisfies Record<string, CapabilityRegistration>;

/** The full, closed set of capability strings any coach may declare. */
export type RegisteredCapability = keyof typeof CAPABILITY_REGISTRY;

/** True when `capability` is both registered AND owned by `coachId`. */
export function isCapabilityPermittedFor(coachId: CoachId, capability: string): boolean {
  const entry = (CAPABILITY_REGISTRY as Record<string, CapabilityRegistration>)[capability];
  if (!entry) return false;
  return (entry.owners as readonly string[]).includes(coachId);
}

/** Every capability currently registered as owned by `coachId`. */
export function capabilitiesOwnedBy(coachId: CoachId): RegisteredCapability[] {
  return (Object.keys(CAPABILITY_REGISTRY) as RegisteredCapability[]).filter((capability) =>
    isCapabilityPermittedFor(coachId, capability),
  );
}
