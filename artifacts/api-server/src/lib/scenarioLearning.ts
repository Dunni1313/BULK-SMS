// Phase 39 — Institutional Scenario & Stress Testing Engine.
//
// Connects each of the 5 Scenario Coach topics to relevant EXISTING
// Learning Centre content — never new lesson text. Every topic key
// referenced below is resolved live against lib/learningPaths.ts's own
// getLearningTopic(), so if that content ever changes, this module's own
// links automatically stay in sync — zero duplicated content, per the
// Phase 39 kickoff's explicit instruction. The same pattern
// lib/riskExposureLearning.ts (Phase 37) and
// lib/performanceAttributionLearning.ts (Phase 38) already established.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";
import { SCENARIO_COACH_TOPICS, type ScenarioCoachTopic } from "./scenarioCoach.js";

interface TopicRef {
  pathKey: string;
  topicKey: string;
  category: "scenario" | "stress" | "resilience" | "greeks" | "capital";
}

const SCENARIO_TOPIC_REFS: Record<ScenarioCoachTopic, TopicRef[]> = {
  scenario_analysis: [
    { pathKey: "portfolio", topicKey: "portfolio-stress-testing", category: "scenario" },
    { pathKey: "portfolio", topicKey: "portfolio-event-risk", category: "scenario" },
  ],
  stress_testing: [
    { pathKey: "portfolio", topicKey: "portfolio-stress-testing", category: "stress" },
    { pathKey: "institutional", topicKey: "institutional-risk-contribution", category: "stress" },
  ],
  portfolio_resilience: [
    { pathKey: "portfolio", topicKey: "portfolio-health", category: "resilience" },
    { pathKey: "institutional", topicKey: "institutional-risk-contribution", category: "resilience" },
  ],
  greeks_impact: [{ pathKey: "greeks", topicKey: "greeks-portfolio-greeks", category: "greeks" }],
  capital_impact: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation", category: "capital" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power", category: "capital" },
  ],
};

export interface ScenarioLearningLink {
  pathKey: string;
  topicKey: string;
  category: TopicRef["category"];
  title: string;
  summary: string;
  href: string;
}

export interface ScenarioTopicLearning {
  topic: ScenarioCoachTopic;
  links: ScenarioLearningLink[];
}

function resolveRef(ref: TopicRef): ScenarioLearningLink | null {
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

export function getScenarioLearning(topic: string): ScenarioTopicLearning | null {
  if (!(SCENARIO_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as ScenarioCoachTopic;
  const links = SCENARIO_TOPIC_REFS[t].map(resolveRef).filter((l): l is ScenarioLearningLink => l !== null);
  return { topic: t, links };
}

export function allScenarioLearning(): ScenarioTopicLearning[] {
  return SCENARIO_COACH_TOPICS.map((t) => getScenarioLearning(t)!);
}
