// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
//
// Connects each of the 6 kickoff-named Learning Centre topics to relevant
// EXISTING Learning Centre content — never new lesson text. Every topic
// key referenced below is resolved live against lib/learningPaths.ts's own
// getLearningTopic(), so if that content ever changes, this module's own
// links automatically stay in sync — zero duplicated content, matching
// lib/complianceLearning.ts's (Phase 42), lib/rebalancingLearning.ts's
// (Phase 41), and every earlier engine's own learning module's established
// pattern. Deliberately a distinct topic list from lib/watchlistsCoach.ts's
// own 5 AI Coach topics — the kickoff names two different lists for the
// two different sections.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";

export const WATCHLISTS_LEARNING_TOPICS = ["watchlists", "portfolio_monitoring", "asset_research", "institutional_workflows", "diversification", "capital_allocation"] as const;
export type WatchlistsLearningTopic = (typeof WATCHLISTS_LEARNING_TOPICS)[number];

interface TopicRef {
  pathKey: string;
  topicKey: string;
}

const TOPIC_REFS: Record<WatchlistsLearningTopic, TopicRef[]> = {
  watchlists: [
    { pathKey: "institutional-investing", topicKey: "investing-monitoring" },
    { pathKey: "institutional-investing", topicKey: "investing-research-terminal" },
  ],
  portfolio_monitoring: [
    { pathKey: "institutional-investing", topicKey: "investing-monitoring" },
    { pathKey: "portfolio", topicKey: "portfolio-health" },
  ],
  asset_research: [
    { pathKey: "institutional-investing", topicKey: "investing-research-terminal" },
    { pathKey: "institutional-investing", topicKey: "investing-opportunity-discovery" },
  ],
  institutional_workflows: [
    { pathKey: "institutional", topicKey: "institutional-process-over-prediction" },
    { pathKey: "institutional", topicKey: "institutional-portfolio-construction" },
  ],
  diversification: [
    { pathKey: "portfolio", topicKey: "portfolio-diversification" },
    { pathKey: "portfolio", topicKey: "portfolio-correlation" },
  ],
  capital_allocation: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power" },
  ],
};

export interface WatchlistsLearningLink {
  pathKey: string;
  topicKey: string;
  title: string;
  summary: string;
  href: string;
}

export interface WatchlistsTopicLearning {
  topic: WatchlistsLearningTopic;
  links: WatchlistsLearningLink[];
}

function resolveRef(ref: TopicRef): WatchlistsLearningLink | null {
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

export function getWatchlistsLearning(topic: string): WatchlistsTopicLearning | null {
  if (!(WATCHLISTS_LEARNING_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as WatchlistsLearningTopic;
  const links = TOPIC_REFS[t].map(resolveRef).filter((l): l is WatchlistsLearningLink => l !== null);
  return { topic: t, links };
}

export function allWatchlistsLearning(): WatchlistsTopicLearning[] {
  return WATCHLISTS_LEARNING_TOPICS.map((t) => getWatchlistsLearning(t)!);
}
