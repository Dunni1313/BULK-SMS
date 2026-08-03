// v1.5.0, Sprint 11 — Platform Integration.
//
// A pure, static lookup table connecting live platform pages/panels to the
// existing Learning Centre's own already-authored content (lib/learningPaths.ts,
// unmodified). This is NOT a new content system — it introduces zero new
// lessons; it only records which already-existing pathKey/topicKey pair is
// the closest, most relevant lesson for a given module, so
// ModuleLearnTrigger/ModuleLearnDrawer can open it in place. A 9th
// registry entry is a one-line addition here, never a schema change.
//
// Two entries deliberately point at the closest EXISTING lesson rather
// than a purpose-written one for the newest v1.5.0 AI-Coach-framework
// modules (Research Notebooks, Institutional Trade Planner), since those
// concepts predate this sprint's own scope and per the approved scope
// ("do NOT recreate existing learning content") no new lesson content was
// authored this sprint — see docs/v1.5.0-Sprint-11-Platform-Integration.md
// for the full disclosure of each mapping's honesty:
//   - "ai-trade-plan" points at "trading-trade-planning" (Engine 2's own,
//     pre-existing Trade Planning & Risk Studio lesson) — a genuinely
//     DIFFERENT feature from Sprint 10's Institutional Trade Planner, but
//     the closest existing lesson covering "what a trade plan is and why
//     you'd keep one." The drawer's own moduleLabel always names the
//     calling module correctly, so this is never presented as if it were
//     documentation of the AI-Coach Trade Planner specifically.
//   - "ai-strategy" points at "ai-team-overview" (the AI coaching-family
//     overview lesson), not the also-pre-existing but conceptually
//     unrelated Engine 2 "Institutional Strategy Framework" path.
export interface ModuleLearnEntry {
  id: string;
  label: string;
  pathKey: string;
  topicKey?: string;
}

export const MODULE_LEARN_REGISTRY: Record<string, ModuleLearnEntry> = {
  "research-investing": {
    id: "research-investing",
    label: "Institutional Research (Investing)",
    pathKey: "institutional-investing",
    topicKey: "investing-research-workflow",
  },
  "research-trading": {
    id: "research-trading",
    label: "Institutional Research (Trading)",
    pathKey: "trading-engine",
    topicKey: "trading-market-structure",
  },
  "ai-notebook": {
    id: "ai-notebook",
    label: "AI Research Notebooks",
    pathKey: "ai-academy",
    topicKey: "ai-research-workflow",
  },
  "ai-strategy": {
    id: "ai-strategy",
    label: "AI Strategy Builder",
    pathKey: "ai-academy",
    topicKey: "ai-team-overview",
  },
  "ai-trade-plan": {
    id: "ai-trade-plan",
    label: "Institutional Trade Planner",
    pathKey: "trading-engine",
    topicKey: "trading-trade-planning",
  },
  "trading-journal": {
    id: "trading-journal",
    label: "Trading Journal",
    pathKey: "trading-engine",
    topicKey: "trading-journal-review",
  },
  performance: {
    id: "performance",
    label: "Performance Review",
    pathKey: "performance",
  },
  portfolio: {
    id: "portfolio",
    label: "Portfolio Impact",
    pathKey: "portfolio",
  },
  // v1.6.0, Sprint 3 — UX Transformation. 5 new entries wiring Contextual
  // Help into golden-path pages that had none — every pathKey/topicKey
  // below already exists in lib/learningPaths.ts; none is a new lesson.
  "command-centre": {
    id: "command-centre",
    label: "Institutional Command Centre",
    pathKey: "platform-basics",
    topicKey: "command-centre-overview",
  },
  discover: {
    id: "discover",
    label: "Discover (Market Scanner)",
    pathKey: "professional-workflows",
    topicKey: "workflow-morning-preparation",
  },
  "decision-workflow": {
    id: "decision-workflow",
    label: "Decision & Risk Review",
    pathKey: "professional-workflows",
    topicKey: "workflow-professional-trade",
  },
  "execution-lifecycle": {
    id: "execution-lifecycle",
    label: "Execution Lifecycle Manager",
    pathKey: "professional-workflows",
    topicKey: "workflow-professional-trade",
  },
  "portfolio-review": {
    id: "portfolio-review",
    label: "Portfolio & Performance Review",
    pathKey: "professional-workflows",
    topicKey: "workflow-portfolio-review",
  },
};

export function getModuleLearnEntry(id: string): ModuleLearnEntry | undefined {
  return MODULE_LEARN_REGISTRY[id];
}
