// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored), the same pattern lib/watchlistsCoach.ts (Phase 43),
// lib/complianceCoach.ts (Phase 42), and every earlier engine's own coach
// module already established. Every explanation below is deterministic,
// template-based prose about CONCEPTS only — never a trade recommendation,
// never a buy/sell signal, never a market forecast. "Never recommend
// trades" is enforced structurally: no function here takes a symbol, a
// position, a live quote, or an account figure as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const WORKSPACE_COACH_TOPICS = ["portfolio_review_workflows", "institutional_operating_processes", "review_cycles", "governance", "reporting"] as const;
export type WorkspaceCoachTopic = (typeof WORKSPACE_COACH_TOPICS)[number];

export interface WorkspaceCoachExplanation {
  topic: WorkspaceCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<WorkspaceCoachTopic, { title: string; explanation: string[] }> = {
  portfolio_review_workflows: {
    title: "Portfolio Review Workflows",
    explanation: [
      "A portfolio review workflow is simply a checklist that guides you, in order, through the existing modules relevant to a specific kind of review — a Morning Review, a Monthly Review, a Risk Review, and so on.",
      "Starting a workflow creates one tracked instance of it; checking off a step never changes anything about your portfolio, positions, or trades — it only records that you, personally, reviewed that step.",
      "Every step's own link takes you to an already-shipped page — Risk & Exposure, Performance & Attribution, Compliance, and the rest — this workspace never duplicates their own analytics.",
    ],
  },
  institutional_operating_processes: {
    title: "Institutional Operating Processes",
    explanation: [
      "Institutional desks run on repeatable processes, not one-off glances at a dashboard — the same review happens the same way, on the same cadence, whoever is running it.",
      "The Workflow Center's own catalog (Morning, Weekly, Monthly, Quarterly, Risk, Compliance, Performance, and Scenario Review) is a starting set of such repeatable processes, each mapped to this platform's own existing engines.",
      "None of these workflows execute anything — they exist purely to make sure the right things get looked at, in the right order, on a predictable schedule you set for yourself.",
    ],
  },
  review_cycles: {
    title: "Review Cycles",
    explanation: [
      "A review cycle is the cadence at which a given kind of review happens — daily for a Morning Review, monthly for a full drift-and-compliance pass, quarterly for the most thorough sweep.",
      "Cadence here is descriptive metadata on each workflow definition, not a scheduler — this platform never runs a review automatically on your behalf; you start each instance yourself.",
      "Active Workflows on the Portfolio Workspace shows every review you've started but not yet completed, so a cycle in progress is never silently lost.",
    ],
  },
  governance: {
    title: "Governance",
    explanation: [
      "Governance, in this platform, means having a documented, repeatable process for reviewing your own portfolio — not a rules engine that blocks or auto-corrects anything.",
      "The Monitoring & Compliance Engine's own policy evaluations, the Rebalancing Engine's own drift detection, and the Workflow Center's own review checklists together form the governance layer: visibility and process, never automated enforcement.",
      "Generating an Institutional Review Report at the end of a completed workflow is the governance record — a durable, dated snapshot of what was reviewed and what was found.",
    ],
  },
  reporting: {
    title: "Reporting",
    explanation: [
      "The Reporting Centre is where every report this platform can generate — including the Portfolio Workspace Summary and the Institutional Review Report — is saved and can be revisited later.",
      "A report is always a reformat of already-computed figures at the moment it was generated; it never triggers a recomputation of anything beyond what the underlying dashboards already do.",
      "Recent Reports on the Portfolio Workspace surfaces the reports you've already generated, by type and by recency — a plain tally, never a ranked or scored list.",
    ],
  },
};

export function explainWorkspaceTopic(topic: string): WorkspaceCoachExplanation | null {
  if (!(WORKSPACE_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as WorkspaceCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allWorkspaceTopics(): WorkspaceCoachExplanation[] {
  return WORKSPACE_COACH_TOPICS.map((t) => explainWorkspaceTopic(t)!);
}
