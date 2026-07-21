// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
//
// Connects each of the 6 kickoff-named Learning Centre topics to relevant
// EXISTING Learning Centre content — never new lesson text. Every topic
// key referenced below is resolved live against lib/learningPaths.ts's own
// getLearningTopic(), so if that content ever changes, this module's own
// links automatically stay in sync — zero duplicated content, per the
// Phase 44 kickoff's explicit instruction. The same pattern
// lib/watchlistsLearning.ts (Phase 43), lib/complianceLearning.ts
// (Phase 42), and every earlier engine's own learning module already
// established. Deliberately a distinct topic list from
// lib/workspaceCoach.ts's own 5 AI Coach topics — the kickoff names two
// different lists for the two different sections.
//
// No existing Learning Centre content is titled "portfolio workflows,"
// "institutional review process," or "governance" specifically — the same
// gap lib/complianceLearning.ts (Phase 42) and lib/rebalancingLearning.ts
// (Phase 41) already disclosed for their own equivalent topics. Per the
// established "link to the closest genuinely relevant existing content,
// never fabricate new lesson text" precedent, these topics reuse the
// closest real content: portfolio construction/decision-quality discipline
// for workflows and governance, risk-contribution/process-over-prediction
// discipline for the institutional review process.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";

export const WORKSPACE_LEARNING_TOPICS = ["portfolio_workflows", "institutional_review_process", "governance", "monitoring", "performance_review", "risk_review"] as const;
export type WorkspaceLearningTopic = (typeof WORKSPACE_LEARNING_TOPICS)[number];

interface TopicRef {
  pathKey: string;
  topicKey: string;
}

const TOPIC_REFS: Record<WorkspaceLearningTopic, TopicRef[]> = {
  portfolio_workflows: [
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
    { pathKey: "institutional", topicKey: "institutional-position-management" },
  ],
  institutional_review_process: [
    { pathKey: "institutional", topicKey: "institutional-decision-quality" },
    { pathKey: "institutional", topicKey: "institutional-process-over-prediction" },
  ],
  governance: [
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
    { pathKey: "institutional", topicKey: "institutional-decision-quality" },
  ],
  monitoring: [
    { pathKey: "institutional-investing", topicKey: "investing-monitoring" },
    { pathKey: "portfolio", topicKey: "portfolio-health" },
  ],
  performance_review: [
    { pathKey: "performance", topicKey: "performance-expectancy" },
    { pathKey: "performance", topicKey: "performance-drawdown" },
  ],
  risk_review: [
    { pathKey: "institutional", topicKey: "institutional-risk-contribution" },
    { pathKey: "portfolio", topicKey: "portfolio-event-risk" },
  ],
};

export interface WorkspaceLearningLink {
  pathKey: string;
  topicKey: string;
  title: string;
  summary: string;
  href: string;
}

export interface WorkspaceLearningTopicResult {
  topic: WorkspaceLearningTopic;
  links: WorkspaceLearningLink[];
}

function resolveRef(ref: TopicRef): WorkspaceLearningLink | null {
  const topic: LearningTopic | null = getLearningTopic(ref.pathKey, ref.topicKey);
  if (!topic) return null;
  return {
    pathKey: ref.pathKey,
    topicKey: ref.topicKey,
    title: topic.title,
    summary: topic.summary,
    href: `/learn/paths/${ref.pathKey}/${ref.topicKey}`,
  };
}

export function getWorkspaceLearning(topic: string): WorkspaceLearningTopicResult | null {
  if (!(WORKSPACE_LEARNING_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as WorkspaceLearningTopic;
  const links = TOPIC_REFS[t].map(resolveRef).filter((l): l is WorkspaceLearningLink => l !== null);
  return { topic: t, links };
}

export function allWorkspaceLearning(): WorkspaceLearningTopicResult[] {
  return WORKSPACE_LEARNING_TOPICS.map((t) => getWorkspaceLearning(t)!);
}
