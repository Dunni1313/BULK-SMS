// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation), updated by the AI Teacher & Learning Centre sprint
// (Phase 8, Sprint 2) to resolve the "AI Teacher" placeholder this file
// originally disclosed as comingSoon into real links.
//
// A small, static, disclosed catalog mapping each Observation category
// to the existing platform page(s) that explain the underlying
// calculation — never a fabricated URL, never a generated explanation.
// Every href below is either an already-existing route (confirmed by
// direct inspection of App.tsx) or a route the Learning Centre sprint
// itself built and confirmed exists.
//
// Per the Learning Centre sprint's own explicit "every Intelligence
// observation should link to: Source module, Related lesson, Related
// glossary, Portfolio explanation" requirement: Source Module is already
// carried on the Observation itself (sourceModule); this file supplies
// the other three by reusing, never duplicating, lib/learningPaths.ts's
// and lib/glossary.ts's own already-defined topic/term keys — a lookup
// failure (a key that doesn't exist) is silently skipped rather than
// fabricating a link, confirmed by a dedicated cross-reference test.

import { getLearningTopic } from "./learningPaths.js";
import { getGlossaryTerm } from "./glossary.js";

export type LearningCategory =
  | "portfolio_health"
  | "buying_power"
  | "concentration"
  | "diversification"
  | "directional_exposure"
  | "greeks_exposure"
  | "event_risk"
  | "theta_income"
  | "broker_status"
  | "paper_trading_status"
  | "credentials_status";

export interface LearningLink {
  label: string;
  href: string | null;
  comingSoon: boolean;
}

// Resolved this sprint — the Learning Centre now exists, so this is a
// real link, never comingSoon:true. Kept as its own named constant
// (rather than inlined) so every category's link list ends with the
// same, single AI Teacher entry point.
const AI_TEACHER_LINK: LearningLink = {
  label: "AI Teacher & Learning Centre",
  href: "/learn",
  comingSoon: false,
};

// The Learning Centre's own Portfolio Learning Mode tab — reuses the
// same real, current-portfolio explanations this Observation itself is
// about, never a fabricated second explanation.
const PORTFOLIO_EXPLAINED_LINK: LearningLink = {
  label: "Your Portfolio, Explained",
  href: "/learn?tab=portfolio",
  comingSoon: false,
};

const CATALOG: Record<LearningCategory, LearningLink[]> = {
  portfolio_health: [
    { label: "Portfolio Dashboard", href: "/portfolio-dashboard", comingSoon: false },
    { label: "Stress Testing", href: "/stress-test", comingSoon: false },
  ],
  buying_power: [
    { label: "Portfolio Dashboard", href: "/portfolio-dashboard", comingSoon: false },
    { label: "Position Sizing", href: "/position-sizing", comingSoon: false },
  ],
  concentration: [{ label: "Correlation & Concentration", href: "/concentration-risk", comingSoon: false }],
  diversification: [{ label: "Correlation & Concentration", href: "/concentration-risk", comingSoon: false }],
  directional_exposure: [
    { label: "Correlation & Concentration", href: "/concentration-risk", comingSoon: false },
    { label: "Greeks", href: "/portfolio", comingSoon: false },
  ],
  greeks_exposure: [
    { label: "Greeks", href: "/portfolio", comingSoon: false },
    { label: "Correlation & Concentration", href: "/concentration-risk", comingSoon: false },
  ],
  event_risk: [{ label: "Event Risk", href: "/event-risk", comingSoon: false }],
  theta_income: [{ label: "Options Dashboard", href: "/options-dashboard", comingSoon: false }],
  broker_status: [{ label: "Broker Health (Settings)", href: "/settings", comingSoon: false }],
  paper_trading_status: [{ label: "Settings", href: "/settings", comingSoon: false }],
  credentials_status: [{ label: "Broker Health (Settings)", href: "/settings", comingSoon: false }],
};

// Reuses lib/learningPaths.ts's own real topic keys — never a
// fabricated URL. A category with no obviously-matching topic (the 3
// platform-status categories) is simply omitted, never guessed.
const CATEGORY_LESSON: Partial<Record<LearningCategory, { pathKey: string; topicKey: string }>> = {
  portfolio_health: { pathKey: "portfolio", topicKey: "portfolio-health" },
  buying_power: { pathKey: "portfolio", topicKey: "portfolio-buying-power" },
  concentration: { pathKey: "portfolio", topicKey: "portfolio-concentration" },
  diversification: { pathKey: "portfolio", topicKey: "portfolio-diversification" },
  directional_exposure: { pathKey: "portfolio", topicKey: "portfolio-concentration" },
  greeks_exposure: { pathKey: "greeks", topicKey: "greeks-portfolio-greeks" },
  event_risk: { pathKey: "portfolio", topicKey: "portfolio-event-risk" },
  theta_income: { pathKey: "performance", topicKey: "performance-theta-income" },
};

// Reuses lib/glossary.ts's own real term keys.
const CATEGORY_GLOSSARY: Partial<Record<LearningCategory, string[]>> = {
  portfolio_health: ["portfolio-health"],
  buying_power: ["buying-power"],
  concentration: ["concentration"],
  diversification: ["diversification"],
  directional_exposure: ["concentration"],
  greeks_exposure: ["delta", "portfolio-greeks"],
  event_risk: ["event-risk"],
  theta_income: ["theta-income"],
};

export function learningLinksFor(category: LearningCategory): LearningLink[] {
  const links: LearningLink[] = [...CATALOG[category]];

  const lesson = CATEGORY_LESSON[category];
  if (lesson) {
    const topic = getLearningTopic(lesson.pathKey, lesson.topicKey);
    if (topic) {
      links.push({ label: `Lesson: ${topic.title}`, href: `/learn/paths/${lesson.pathKey}/${lesson.topicKey}`, comingSoon: false });
    }
  }

  for (const key of CATEGORY_GLOSSARY[category] ?? []) {
    const term = getGlossaryTerm(key);
    if (term) {
      links.push({ label: `Glossary: ${term.term}`, href: `/learn/glossary/${key}`, comingSoon: false });
    }
  }

  links.push(PORTFOLIO_EXPLAINED_LINK, AI_TEACHER_LINK);
  return links;
}
