// v1.5.0 Sprint 5 — Coach Bootstrap & Validation.
//
// The one authoritative enumeration of this codebase's conversational AI
// Coaches. Before this sprint, "the 3 coaches" was tribal knowledge —
// Sprint 3's useSpecialistCoach.test.ts and Sprint 4's
// capabilityRegistry.test.ts each independently hand-built their own local
// `[tradingCoachConfig, investingCoachConfig, optionsCoachConfig]` array.
// CoachRegistry is that list, written once.
//
// Deliberately exposes NO new production-facing API: no page or component
// in this codebase is changed to consume CoachRegistry — every specialist
// coach page still imports its own concrete config directly and calls
// useSpecialistCoach(config, params) exactly as it did before this sprint
// (confirmed by a zero-line diff on every page file). CoachRegistry exists
// for test/tooling enumeration and for the registration-time validation
// below — an internal bookkeeping surface, not a new consumer-facing
// pattern coaches are expected to route through.
//
// Portfolio is, and remains, absent from this registry — there is no
// conversational Portfolio coach anywhere in this codebase (Sprint 3's own
// exhaustive finding, unchanged), so there is nothing Portfolio-shaped to
// register. CoachId itself (capabilityRegistry.ts) has no "portfolio"
// member, so a 4th registry entry claiming that id would be a compile-time
// error, not just a missing runtime registration.

import { tradingCoachConfig } from "./coaches/tradingCoach.config";
import { investingCoachConfig } from "./coaches/investingCoach.config";
import { optionsCoachConfig } from "./coaches/optionsCoach.config";
import type { CoachId } from "./capabilityRegistry";
import {
  validateCoachRegistry,
  type AnyCoachConfig,
  type CoachConfigValidationIssue,
} from "./coachConfigValidator";

/** The complete, ordered list of registered conversational coaches — only
 * Trading, Investing, and Options. Each entry is the exact same config
 * object its own page already imports and passes to useSpecialistCoach();
 * nothing here is copied, cloned, or re-derived. */
const REGISTERED_COACHES: readonly AnyCoachConfig[] = [tradingCoachConfig, investingCoachConfig, optionsCoachConfig];

const COACH_BY_ID = new Map<CoachId, AnyCoachConfig>(REGISTERED_COACHES.map((coach) => [coach.id, coach]));

export const CoachRegistry = {
  /** Every registered coach, in registration order. */
  all(): readonly AnyCoachConfig[] {
    return REGISTERED_COACHES;
  },
  /** Typed lookup by coach id — `undefined` for an id that was never
   * registered (there is no "unknown coach" fallback object; a caller must
   * handle the honest `undefined` case itself). */
  get(id: CoachId): AnyCoachConfig | undefined {
    return COACH_BY_ID.get(id);
  },
};

// Computed exactly once, at module load. This NEVER throws — it only
// records whatever structural issues (if any) validateCoachRegistry()
// finds in the real, shipped coach configs. For today's 3 real coaches
// this is always an empty array (proven by coachRegistry.test.ts); a
// future coach edit that genuinely broke an invariant (a duplicate
// capability, a route collision, a capability claimed by the wrong coach,
// ...) would show up here without ever crashing a page load, a render, or
// a single conversation — only a future test file that calls
// assertNoValidationIssues(coachRegistrationIssues, ...) would fail, which
// is the whole point: catch it in development/CI, never in production.
export const coachRegistrationIssues: CoachConfigValidationIssue[] = validateCoachRegistry(REGISTERED_COACHES);
