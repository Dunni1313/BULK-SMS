// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
//
// Connects each of the 6 kickoff-named Learning Centre topics to relevant
// EXISTING Learning Centre content — never new lesson text. Every topic
// key referenced below is resolved live against lib/learningPaths.ts's
// own getLearningTopic(), so if that content ever changes, this module's
// own links automatically stay in sync — zero duplicated content, per the
// Phase 42 kickoff's explicit instruction. The same pattern
// lib/rebalancingLearning.ts (Phase 41), lib/decisionSupportLearning.ts
// (Phase 40), lib/scenarioLearning.ts (Phase 39), and every earlier
// engine's own learning module already established. Deliberately a
// distinct topic list from lib/complianceCoach.ts's own 5 AI Coach
// topics — the kickoff names two different lists for the two different
// sections.
//
// No existing Learning Centre content is titled "governance" or
// "compliance" specifically — this codebase has never had a governance/
// compliance module before this phase. Per the established "link to the
// closest genuinely relevant existing content, never fabricate new lesson
// text" precedent (lib/rebalancingLearning.ts's own institutional_rebalancing
// topic), "Portfolio governance" and "Institutional compliance" are mapped
// to the closest real content: portfolio construction/decision-quality
// discipline for governance, and risk-contribution/process-over-prediction
// discipline for institutional compliance.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";

export const COMPLIANCE_LEARNING_TOPICS = ["portfolio_governance", "risk_policies", "institutional_compliance", "diversification", "capital_allocation", "portfolio_monitoring"] as const;
export type ComplianceLearningTopic = (typeof COMPLIANCE_LEARNING_TOPICS)[number];

interface TopicRef {
  pathKey: string;
  topicKey: string;
}

const TOPIC_REFS: Record<ComplianceLearningTopic, TopicRef[]> = {
  portfolio_governance: [
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
    { pathKey: "institutional", topicKey: "institutional-decision-quality" },
  ],
  risk_policies: [
    { pathKey: "institutional", topicKey: "institutional-risk-contribution" },
    { pathKey: "portfolio", topicKey: "portfolio-event-risk" },
  ],
  institutional_compliance: [
    { pathKey: "institutional", topicKey: "institutional-process-over-prediction" },
    { pathKey: "institutional", topicKey: "institutional-capital-allocation" },
  ],
  diversification: [
    { pathKey: "portfolio", topicKey: "portfolio-diversification" },
    { pathKey: "portfolio", topicKey: "portfolio-correlation" },
  ],
  capital_allocation: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power" },
  ],
  portfolio_monitoring: [
    { pathKey: "institutional-investing", topicKey: "investing-monitoring" },
    { pathKey: "portfolio", topicKey: "portfolio-health" },
  ],
};

export interface ComplianceLearningLink {
  pathKey: string;
  topicKey: string;
  title: string;
  summary: string;
  href: string;
}

export interface ComplianceTopicLearning {
  topic: ComplianceLearningTopic;
  links: ComplianceLearningLink[];
}

function resolveRef(ref: TopicRef): ComplianceLearningLink | null {
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

export function getComplianceLearning(topic: string): ComplianceTopicLearning | null {
  if (!(COMPLIANCE_LEARNING_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as ComplianceLearningTopic;
  const links = TOPIC_REFS[t].map(resolveRef).filter((l): l is ComplianceLearningLink => l !== null);
  return { topic: t, links };
}

export function allComplianceLearning(): ComplianceTopicLearning[] {
  return COMPLIANCE_LEARNING_TOPICS.map((t) => getComplianceLearning(t)!);
}
