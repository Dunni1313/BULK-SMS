// Phase 36 — Institutional Position Lifecycle Manager.
//
// Connects each of the 8 lifecycle stages to relevant EXISTING Learning
// Centre content — never new lesson text. Every topic key referenced
// below is resolved live against lib/learningPaths.ts's own
// getLearningTopic(), so if that content ever changes, this module's own
// links automatically stay in sync — zero duplicated content, per the
// Phase 36 kickoff's explicit instruction.

import { getLearningTopic, type LearningTopic } from "./learningPaths.js";
import { LIFECYCLE_STAGES, type LifecycleStage } from "./optionsLifecycle.js";

interface TopicRef {
  pathKey: string;
  topicKey: string;
  category: "lesson" | "strategy" | "risk" | "assignment";
}

// Curated, deliberately small per-stage bundles — each ref points at a
// topic already proven to exist by learningPaths.test.ts's own
// cross-reference discipline; a dedicated test in this module re-proves
// every ref here resolves to a real topic too, so the two can never
// silently drift apart.
const STAGE_TOPIC_REFS: Record<LifecycleStage, TopicRef[]> = {
  draft: [
    { pathKey: "strategies", topicKey: "strategies-covered-calls", category: "strategy" },
    { pathKey: "strategies", topicKey: "strategies-csp", category: "strategy" },
    { pathKey: "strategies", topicKey: "strategies-wheel", category: "strategy" },
    { pathKey: "strategies", topicKey: "strategies-iron-condor", category: "strategy" },
    { pathKey: "portfolio", topicKey: "portfolio-concentration", category: "risk" },
  ],
  planned: [
    { pathKey: "portfolio", topicKey: "portfolio-concentration", category: "risk" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power", category: "lesson" },
    { pathKey: "institutional", topicKey: "institutional-capital-allocation", category: "lesson" },
  ],
  open: [
    { pathKey: "institutional", topicKey: "institutional-capital-allocation", category: "lesson" },
    { pathKey: "portfolio", topicKey: "portfolio-buying-power", category: "lesson" },
    { pathKey: "performance", topicKey: "performance-theta-income", category: "lesson" },
  ],
  monitoring: [
    { pathKey: "institutional", topicKey: "institutional-position-management", category: "lesson" },
    { pathKey: "portfolio", topicKey: "portfolio-health", category: "risk" },
    { pathKey: "portfolio", topicKey: "portfolio-concentration", category: "risk" },
  ],
  near_expiration: [
    { pathKey: "foundations", topicKey: "foundations-assignment", category: "assignment" },
    { pathKey: "performance", topicKey: "performance-theta-income", category: "lesson" },
    { pathKey: "strategies", topicKey: "strategies-covered-calls", category: "strategy" },
    { pathKey: "strategies", topicKey: "strategies-csp", category: "strategy" },
  ],
  assignment_risk: [
    { pathKey: "foundations", topicKey: "foundations-assignment", category: "assignment" },
    { pathKey: "strategies", topicKey: "strategies-wheel", category: "strategy" },
    { pathKey: "strategies", topicKey: "strategies-covered-calls", category: "strategy" },
    { pathKey: "strategies", topicKey: "strategies-csp", category: "strategy" },
  ],
  closed: [
    { pathKey: "performance", topicKey: "performance-theta-income", category: "lesson" },
    { pathKey: "portfolio", topicKey: "portfolio-health", category: "risk" },
  ],
  archived: [
    { pathKey: "portfolio", topicKey: "portfolio-health", category: "risk" },
    { pathKey: "institutional", topicKey: "institutional-position-management", category: "lesson" },
  ],
};

export interface LifecycleLearningLink {
  pathKey: string;
  topicKey: string;
  category: "lesson" | "strategy" | "risk" | "assignment";
  title: string;
  summary: string;
  href: string;
}

export interface LifecycleStageLearning {
  stage: LifecycleStage;
  links: LifecycleLearningLink[];
}

function resolveRef(ref: TopicRef): LifecycleLearningLink | null {
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

export function getStageLearning(stage: string): LifecycleStageLearning | null {
  if (!(LIFECYCLE_STAGES as readonly string[]).includes(stage)) return null;
  const s = stage as LifecycleStage;
  const links = STAGE_TOPIC_REFS[s].map(resolveRef).filter((l): l is LifecycleLearningLink => l !== null);
  return { stage: s, links };
}

export function allStageLearning(): LifecycleStageLearning[] {
  return LIFECYCLE_STAGES.map((s) => getStageLearning(s)!);
}
