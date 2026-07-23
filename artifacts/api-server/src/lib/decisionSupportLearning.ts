// Phase 40 — Institutional Decision Support & Executive Insights Engine.
//
// Connects each of the 7 kickoff-named Learning Centre topics to relevant
// EXISTING Learning Centre content — never new lesson text. Every topic
// key referenced below is resolved live against lib/learningPaths.ts's
// own getLearningTopic(), so if that content ever changes, this module's
// own links automatically stay in sync — zero duplicated content, per the
// Phase 40 kickoff's explicit instruction. The same pattern
// lib/scenarioLearning.ts (Phase 39), lib/performanceAttributionLearning.ts
// (Phase 38), and lib/riskExposureLearning.ts (Phase 37) already
// established. Deliberately a distinct topic list from
// decisionSupportCoach.ts's own 8 AI Coach topics — the kickoff names two
// different lists for the two different sections.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";

export const DECISION_SUPPORT_LEARNING_TOPICS = [
  "portfolio_management",
  "risk_interpretation",
  "performance_interpretation",
  "scenario_analysis",
  "diversification",
  "capital_allocation",
  "institutional_portfolio_management",
] as const;
export type DecisionSupportLearningTopic = (typeof DECISION_SUPPORT_LEARNING_TOPICS)[number];

interface TopicRef {
  pathKey: string;
  topicKey: string;
}

const TOPIC_REFS: Record<DecisionSupportLearningTopic, TopicRef[]> = {
  portfolio_management: [
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
    { pathKey: "institutional", topicKey: "institutional-position-management" },
  ],
  risk_interpretation: [
    { pathKey: "institutional", topicKey: "institutional-risk-contribution" },
    { pathKey: "portfolio", topicKey: "portfolio-health" },
  ],
  performance_interpretation: [
    { pathKey: "performance", topicKey: "performance-expectancy" },
    { pathKey: "performance", topicKey: "performance-drawdown" },
  ],
  scenario_analysis: [
    { pathKey: "portfolio", topicKey: "portfolio-stress-testing" },
    { pathKey: "portfolio", topicKey: "portfolio-event-risk" },
  ],
  diversification: [{ pathKey: "portfolio", topicKey: "portfolio-diversification" }],
  capital_allocation: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power" },
  ],
  institutional_portfolio_management: [
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
    { pathKey: "institutional", topicKey: "institutional-decision-quality" },
    { pathKey: "institutional", topicKey: "institutional-process-over-prediction" },
  ],
};

export interface DecisionSupportLearningLink {
  pathKey: string;
  topicKey: string;
  title: string;
  summary: string;
  href: string;
}

export interface DecisionSupportTopicLearning {
  topic: DecisionSupportLearningTopic;
  links: DecisionSupportLearningLink[];
}

function resolveRef(ref: TopicRef): DecisionSupportLearningLink | null {
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

export function getDecisionSupportLearning(topic: string): DecisionSupportTopicLearning | null {
  if (!(DECISION_SUPPORT_LEARNING_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as DecisionSupportLearningTopic;
  const links = TOPIC_REFS[t].map(resolveRef).filter((l): l is DecisionSupportLearningLink => l !== null);
  return { topic: t, links };
}

export function allDecisionSupportLearning(): DecisionSupportTopicLearning[] {
  return DECISION_SUPPORT_LEARNING_TOPICS.map((t) => getDecisionSupportLearning(t)!);
}
