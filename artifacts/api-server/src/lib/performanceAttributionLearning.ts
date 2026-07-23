// Phase 38 — Institutional Performance & Attribution Engine.
//
// Connects each of the 5 Performance & Attribution Coach topics to
// relevant EXISTING Learning Centre content — never new lesson text. Every
// topic key referenced below is resolved live against
// lib/learningPaths.ts's own getLearningTopic(), so if that content ever
// changes, this module's own links automatically stay in sync — zero
// duplicated content, per the Phase 38 kickoff's explicit instruction. The
// same pattern lib/riskExposureLearning.ts already established (Phase 37).
//
// A genuine, disclosed content gap: no dedicated Sharpe/Sortino/risk-
// adjusted-return topic exists anywhere in the Learning Centre today — the
// risk_adjusted_returns bundle below links to the closest real, already-
// existing analogues (Expectancy and Drawdown, the platform's own
// established "does this actually work, and how painfully" topics) rather
// than inventing a new lesson, per the explicit "reuse, never duplicate"
// instruction.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";
import { PERFORMANCE_ATTRIBUTION_COACH_TOPICS, type PerformanceAttributionCoachTopic } from "./performanceAttributionCoach.js";

interface TopicRef {
  pathKey: string;
  topicKey: string;
  category: "metrics" | "attribution" | "capital" | "risk_adjusted" | "interpretation";
}

const PERFORMANCE_ATTRIBUTION_TOPIC_REFS: Record<PerformanceAttributionCoachTopic, TopicRef[]> = {
  performance_metrics: [
    { pathKey: "performance", topicKey: "performance-win-rate", category: "metrics" },
    { pathKey: "performance", topicKey: "performance-expectancy", category: "metrics" },
    { pathKey: "performance", topicKey: "performance-premium-collected", category: "metrics" },
  ],
  attribution: [
    { pathKey: "performance", topicKey: "performance-return-on-capital", category: "attribution" },
    { pathKey: "institutional", topicKey: "institutional-risk-contribution", category: "attribution" },
  ],
  capital_efficiency: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation", category: "capital" },
    { pathKey: "performance", topicKey: "performance-return-on-capital", category: "capital" },
  ],
  risk_adjusted_returns: [
    { pathKey: "performance", topicKey: "performance-expectancy", category: "risk_adjusted" },
    { pathKey: "performance", topicKey: "performance-drawdown", category: "risk_adjusted" },
  ],
  portfolio_interpretation: [
    { pathKey: "portfolio", topicKey: "portfolio-diversification", category: "interpretation" },
    { pathKey: "portfolio", topicKey: "portfolio-correlation", category: "interpretation" },
    { pathKey: "institutional", topicKey: "institutional-decision-quality", category: "interpretation" },
  ],
};

export interface PerformanceAttributionLearningLink {
  pathKey: string;
  topicKey: string;
  category: TopicRef["category"];
  title: string;
  summary: string;
  href: string;
}

export interface PerformanceAttributionTopicLearning {
  topic: PerformanceAttributionCoachTopic;
  links: PerformanceAttributionLearningLink[];
}

function resolveRef(ref: TopicRef): PerformanceAttributionLearningLink | null {
  const topic: LearningTopic | null = getLearningTopic(ref.pathKey, ref.topicKey);
  if (!topic) return null;
  return {
    pathKey: ref.pathKey,
    topicKey: ref.topicKey,
    category: ref.category,
    title: topic.title,
    summary: topic.summary,
    href: `/learn/paths/${ref.pathKey}/${ref.topicKey}`,
  };
}

export function getPerformanceAttributionLearning(topic: string): PerformanceAttributionTopicLearning | null {
  if (!(PERFORMANCE_ATTRIBUTION_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as PerformanceAttributionCoachTopic;
  const links = PERFORMANCE_ATTRIBUTION_TOPIC_REFS[t].map(resolveRef).filter((l): l is PerformanceAttributionLearningLink => l !== null);
  return { topic: t, links };
}

export function allPerformanceAttributionLearning(): PerformanceAttributionTopicLearning[] {
  return PERFORMANCE_ATTRIBUTION_COACH_TOPICS.map((t) => getPerformanceAttributionLearning(t)!);
}
