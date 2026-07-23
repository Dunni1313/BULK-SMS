// Phase 37 — Institutional Risk & Exposure Intelligence Engine.
//
// Connects each of the 7 Risk & Exposure Coach topics to relevant
// EXISTING Learning Centre content — never new lesson text. Every topic
// key referenced below is resolved live against lib/learningPaths.ts's
// own getLearningTopic(), so if that content ever changes, this module's
// own links automatically stay in sync — zero duplicated content, per
// the Phase 37 kickoff's explicit instruction.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";
import { RISK_EXPOSURE_COACH_TOPICS, type RiskExposureCoachTopic } from "./riskExposureCoach.js";

interface TopicRef {
  pathKey: string;
  topicKey: string;
  category: "risk" | "exposure" | "diversification" | "concentration" | "sizing" | "capital" | "greeks";
}

// Curated, deliberately small per-topic bundles — each ref points at a
// topic already proven to exist by learningPaths.test.ts's own
// cross-reference discipline; a dedicated test in this module re-proves
// every ref here resolves to a real topic too, so the two can never
// silently drift apart.
const RISK_EXPOSURE_TOPIC_REFS: Record<RiskExposureCoachTopic, TopicRef[]> = {
  risk: [
    { pathKey: "trading-engine", topicKey: "trading-risk-management", category: "risk" },
    { pathKey: "institutional", topicKey: "institutional-risk-contribution", category: "risk" },
    { pathKey: "portfolio", topicKey: "portfolio-health", category: "risk" },
  ],
  exposure: [
    { pathKey: "portfolio", topicKey: "portfolio-buying-power", category: "exposure" },
    { pathKey: "greeks", topicKey: "greeks-portfolio-greeks", category: "exposure" },
  ],
  diversification: [
    { pathKey: "portfolio", topicKey: "portfolio-diversification", category: "diversification" },
    { pathKey: "portfolio", topicKey: "portfolio-correlation", category: "diversification" },
  ],
  concentration: [
    { pathKey: "portfolio", topicKey: "portfolio-concentration", category: "concentration" },
    { pathKey: "institutional", topicKey: "institutional-risk-contribution", category: "concentration" },
  ],
  position_sizing: [
    { pathKey: "portfolio", topicKey: "portfolio-position-sizing", category: "sizing" },
    { pathKey: "trading-engine", topicKey: "trading-risk-management", category: "sizing" },
  ],
  capital_allocation: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation", category: "capital" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power", category: "capital" },
  ],
  greeks: [{ pathKey: "greeks", topicKey: "greeks-portfolio-greeks", category: "greeks" }],
};

export interface RiskExposureLearningLink {
  pathKey: string;
  topicKey: string;
  category: TopicRef["category"];
  title: string;
  summary: string;
  href: string;
}

export interface RiskExposureTopicLearning {
  topic: RiskExposureCoachTopic;
  links: RiskExposureLearningLink[];
}

function resolveRef(ref: TopicRef): RiskExposureLearningLink | null {
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

export function getRiskExposureLearning(topic: string): RiskExposureTopicLearning | null {
  if (!(RISK_EXPOSURE_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as RiskExposureCoachTopic;
  const links = RISK_EXPOSURE_TOPIC_REFS[t].map(resolveRef).filter((l): l is RiskExposureLearningLink => l !== null);
  return { topic: t, links };
}

export function allRiskExposureLearning(): RiskExposureTopicLearning[] {
  return RISK_EXPOSURE_COACH_TOPICS.map((t) => getRiskExposureLearning(t)!);
}
