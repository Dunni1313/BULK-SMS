// v1.5.0 Sprint 5 — Coach Bootstrap & Validation.
//
// Pure, side-effect-free validation rules for a CoachConfig (or a full set
// of them). Every function here only ever COMPUTES a list of issues — none
// of them throw, log, or mutate anything. That is the entire safety
// contract this sprint's own instructions demand ("do not introduce a
// fragile production failure mode... do not make ordinary user requests
// fail because of new validation"): a genuinely broken future config would
// simply show up in the returned issue list, never crash a render or a
// coach's send/stream/error path. `assertNoValidationIssues()` (below) is
// the one function that DOES throw, and it is only ever called from test
// files (coachConfigValidator.test.ts, coachRegistry.test.ts) — never from
// any page, component, or hook.
//
// Every issue message is a purely STRUCTURAL statement about which coach
// id / field / rule was violated (e.g. "capability 'greeks' does not
// belong to coach 'trading'") — never includes prompt text (which lives
// entirely server-side, per Sprint 3's own decision, and this module never
// even has access to it), never includes a user's question/answer/account
// data (this module only ever inspects a CoachConfig object itself, never
// a live conversation), and never includes any secret/env value.

import type { CoachConfig } from "./types";
import { isCapabilityPermittedFor } from "./capabilityRegistry";

export interface CoachConfigValidationIssue {
  /** The coach id the issue was found on, or "<registry>" for a
   * cross-coach (registry-wide) issue such as a duplicate id/route. */
  coachId: string;
  /** The offending field/rule, e.g. "capabilities", "endpoint", "id". */
  field: string;
  /** A purely structural description — never prompt text, never user data,
   * never a secret. */
  message: string;
}

// AnyCoachConfig: a CoachConfig instantiated with an unknown, erased
// TParams. `any` is the standard, necessary choice here (not a shortcut) —
// CoachConfig<T>'s function fields are contravariant in T, so a real,
// heterogeneous mix of CoachConfig<TradingCoachParams> /
// CoachConfig<InvestingCoachParams> / CoachConfig<OptionsCoachParams>
// cannot be structurally unified under `unknown` without TypeScript
// rejecting the assignment; `any` is what every registry/DI-container
// pattern over a contravariant generic uses for exactly this reason. It
// only ever appears in this validator's and the registry's own type
// signatures — no page or component ever passes an `any`-typed value
// through `buildRequestBody` itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCoachConfig = CoachConfig<any>;

/**
 * Validates the invariants a single coach's own config must satisfy in
 * isolation (no comparison against any other coach). Never throws.
 */
export function validateCoachConfig(config: AnyCoachConfig): CoachConfigValidationIssue[] {
  const issues: CoachConfigValidationIssue[] = [];
  const coachId = config.id ?? "<unknown>";

  const requiredStringFields: Array<[string, unknown]> = [
    ["displayName", config.displayName],
    ["description", config.description],
    ["endpoint", config.endpoint],
  ];
  for (const [field, value] of requiredStringFields) {
    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push({ coachId, field, message: `"${field}" is required and must be a non-empty string.` });
    }
  }

  if (typeof config.endpoint === "string" && config.endpoint.length > 0 && !config.endpoint.startsWith("/")) {
    issues.push({
      coachId,
      field: "endpoint",
      message: `"endpoint" must be an absolute route path starting with "/" (route mapping is required).`,
    });
  }

  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    issues.push({
      coachId,
      field: "capabilities",
      message: `"capabilities" is required and must declare at least one capability.`,
    });
  } else {
    const seen = new Set<string>();
    for (const capability of config.capabilities) {
      if (seen.has(capability)) {
        issues.push({
          coachId,
          field: "capabilities",
          message: `capability "${capability}" is declared more than once.`,
        });
      }
      seen.add(capability);

      if (!isCapabilityPermittedFor(coachId as never, capability)) {
        issues.push({
          coachId,
          field: "capabilities",
          message: `capability "${capability}" is not registered as owned by coach "${coachId}" — tool access must not cross coach boundaries.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Validates the invariants that only make sense across the FULL set of
 * registered coaches (no two coaches may share an id or a route), plus
 * every individual coach's own `validateCoachConfig()` issues. Never
 * throws.
 */
export function validateCoachRegistry(configs: readonly AnyCoachConfig[]): CoachConfigValidationIssue[] {
  const issues: CoachConfigValidationIssue[] = [];

  for (const config of configs) {
    issues.push(...validateCoachConfig(config));
  }

  const idCounts = new Map<string, number>();
  const routeCounts = new Map<string, number>();
  for (const config of configs) {
    idCounts.set(config.id, (idCounts.get(config.id) ?? 0) + 1);
    routeCounts.set(config.endpoint, (routeCounts.get(config.endpoint) ?? 0) + 1);
  }

  for (const [id, count] of idCounts) {
    if (count > 1) {
      issues.push({
        coachId: "<registry>",
        field: "id",
        message: `coach id "${id}" is registered ${count} times — coach ids must be unique.`,
      });
    }
  }
  for (const [route, count] of routeCounts) {
    if (count > 1) {
      issues.push({
        coachId: "<registry>",
        field: "endpoint",
        message: `route "${route}" is declared by ${count} different coaches — routes must be unique per coach.`,
      });
    }
  }

  return issues;
}

/**
 * Throws a single, structural (never prompt/user/secret-carrying) error
 * summarizing every issue found. ONLY ever called from test files — no
 * page, component, or hook in this codebase calls this function, so it can
 * never turn a validation issue into a production failure.
 */
export function assertNoValidationIssues(issues: readonly CoachConfigValidationIssue[], context: string): void {
  if (issues.length === 0) return;
  const summary = issues.map((issue) => `  [${issue.coachId}] ${issue.field}: ${issue.message}`).join("\n");
  throw new Error(`${context}: ${issues.length} coach configuration issue(s) found:\n${summary}`);
}
