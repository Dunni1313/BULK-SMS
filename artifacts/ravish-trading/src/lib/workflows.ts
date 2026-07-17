// Phase 10 — Institutional Platform Polish & Control Center. The
// "Workflow Engine" item from the phase's BUILD list.
//
// Scoped deliberately narrow, consistent with the phase's own "unify,
// simplify, standardize... do NOT build major new trading functionality"
// instruction: a Workflow here is a named, ordered sequence of existing
// pages, launched from the Command Palette. Selecting a workflow
// navigates to its first step and shows a toast naming the remaining
// steps with a "Next" action to advance through them one at a time —
// there is no new persisted state, no new backend endpoint, and no new
// calculation of any kind. This is genuinely a navigation/organization
// feature (a curated, ordered version of the individually-existing Quick
// Actions and nav items), not a stateful business-process orchestrator —
// that heavier interpretation of "Workflow Engine" was judged out of
// scope for a polish phase and is disclosed as a scoping decision in
// docs/Institutional-Control-Center.md.

export interface WorkflowStep {
  label: string;
  href: string;
}

export interface Workflow {
  id: string;
  label: string;
  description: string;
  steps: WorkflowStep[];
}

export const WORKFLOWS: Workflow[] = [
  {
    id: "morning-review",
    label: "Morning Portfolio Review",
    description: "Health, risk, and today's events before the trading day starts.",
    steps: [
      { label: "Institutional Home", href: "/" },
      { label: "Portfolio Risk Dashboard", href: "/portfolio-dashboard" },
      { label: "Event Risk", href: "/event-risk" },
      { label: "Notification Centre", href: "/notifications" },
    ],
  },
  {
    id: "income-trading-session",
    label: "Income Trading Session",
    description: "Scan for new opportunities, size, preview, and place.",
    steps: [
      { label: "Scanner", href: "/scanner" },
      { label: "Position Sizing", href: "/position-sizing" },
      { label: "Order Preview", href: "/order-preview" },
      { label: "Trades", href: "/trades" },
    ],
  },
  {
    id: "risk-management-check",
    label: "Risk Management Check",
    description: "Concentration, stress test, and correlation in one pass.",
    steps: [
      { label: "Portfolio Dashboard", href: "/portfolio-dashboard" },
      { label: "Concentration Risk", href: "/concentration-risk" },
      { label: "Stress Test", href: "/stress-test" },
    ],
  },
  {
    id: "learning-session",
    label: "Learning Session",
    description: "Pick up where the Learning Centre left off, then check your progress.",
    steps: [
      { label: "AI Teacher & Learning Centre", href: "/learn" },
      { label: "Strategy Academy", href: "/learn/strategy-academy" },
      { label: "Glossary", href: "/learn/glossary" },
    ],
  },
  {
    id: "trade-review-and-journal",
    label: "Trade Review & Journal",
    description: "Review closed trades and the AI Trade Journal, then log lessons.",
    steps: [
      { label: "Trade History", href: "/trade-history" },
      { label: "AI Trade Journal", href: "/trade-journal-ai" },
      { label: "Journal", href: "/journal" },
    ],
  },
];
