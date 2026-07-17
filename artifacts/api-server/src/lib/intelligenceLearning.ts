// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Learning Engine.
//
// A small, static, disclosed catalog mapping each Observation category
// to the existing platform page(s) that explain the underlying
// calculation — never a fabricated URL, never a generated explanation.
// Every href below already exists as a real route in this codebase
// (confirmed by direct inspection of App.tsx before writing this file).
//
// "AI Teacher" is explicitly named in this sprint's own request as a
// FUTURE module this engine lays the foundation for — it does not exist
// yet, so it is represented honestly as a comingSoon entry with a null
// href, never a fabricated link, appended to every category's own list.

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

const AI_TEACHER_COMING_SOON: LearningLink = {
  label: "AI Teacher",
  href: null,
  comingSoon: true,
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

export function learningLinksFor(category: LearningCategory): LearningLink[] {
  return [...CATALOG[category], AI_TEACHER_COMING_SOON];
}
