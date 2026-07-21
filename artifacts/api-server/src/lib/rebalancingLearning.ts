// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine.
//
// Connects each of the 6 kickoff-named Learning Centre topics to relevant
// EXISTING Learning Centre content — never new lesson text. Every topic
// key referenced below is resolved live against lib/learningPaths.ts's
// own getLearningTopic(), so if that content ever changes, this module's
// own links automatically stay in sync — zero duplicated content, per the
// Phase 41 kickoff's explicit instruction. The same pattern
// lib/decisionSupportLearning.ts (Phase 40), lib/scenarioLearning.ts
// (Phase 39), lib/performanceAttributionLearning.ts (Phase 38), and
// lib/riskExposureLearning.ts (Phase 37) already established. Deliberately
// a distinct topic list from rebalancingCoach.ts's own 5 AI Coach topics —
// the kickoff names two different lists for the two different sections.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";

export const REBALANCING_LEARNING_TOPICS = ["asset_allocation", "portfolio_construction", "diversification", "capital_allocation", "institutional_rebalancing", "risk_management"] as const;
export type RebalancingLearningTopic = (typeof REBALANCING_LEARNING_TOPICS)[number];

interface TopicRef {
  pathKey: string;
  topicKey: string;
}

const TOPIC_REFS: Record<RebalancingLearningTopic, TopicRef[]> = {
  asset_allocation: [
    { pathKey: "portfolio", topicKey: "portfolio-diversification" },
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
  ],
  portfolio_construction: [
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
    { pathKey: "institutional", topicKey: "institutional-position-management" },
  ],
  diversification: [{ pathKey: "portfolio", topicKey: "portfolio-diversification" }, { pathKey: "portfolio", topicKey: "portfolio-correlation" }],
  capital_allocation: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power" },
  ],
  institutional_rebalancing: [
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
    { pathKey: "institutional-investing", topicKey: "investing-monitoring" },
  ],
  risk_management: [
    { pathKey: "institutional", topicKey: "institutional-risk-contribution" },
    { pathKey: "portfolio", topicKey: "portfolio-health" },
    { pathKey: "portfolio", topicKey: "portfolio-concentration" },
  ],
};

export interface RebalancingLearningLink {
  pathKey: string;
  topicKey: string;
  title: string;
  summary: string;
  href: string;
}

export interface RebalancingTopicLearning {
  topic: RebalancingLearningTopic;
  links: RebalancingLearningLink[];
}

function resolveRef(ref: TopicRef): RebalancingLearningLink | null {
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

export function getRebalancingLearning(topic: string): RebalancingTopicLearning | null {
  if (!(REBALANCING_LEARNING_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as RebalancingLearningTopic;
  const links = TOPIC_REFS[t].map(resolveRef).filter((l): l is RebalancingLearningLink => l !== null);
  return { topic: t, links };
}

export function allRebalancingLearning(): RebalancingTopicLearning[] {
  return REBALANCING_LEARNING_TOPICS.map((t) => getRebalancingLearning(t)!);
}
