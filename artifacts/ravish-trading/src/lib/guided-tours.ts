// v1.6.0, Sprint 3 — UX Transformation. Guided Tours: "First Trade," "First
// Research," "First Journal," "First Portfolio Review" (the approved
// scope's own named examples). Investigation before writing any code
// (lib/learn/moduleLearnRegistry.ts's own header comment, LessonRenderer.tsx,
// package.json) found NO existing tour/walkthrough library anywhere in this
// codebase (no joyride/driver.js/intro.js/shepherd/reactour) and only a
// dead, unread `guidedTourRequired` boolean on LearningTopic — so this is
// new, but deliberately the thinnest possible implementation: a plain,
// static content registry plus a step-by-step Dialog (GuidedTourDialog.tsx)
// built entirely from existing shadcn/ui Dialog + Progress primitives, per
// the approved scope's own "no new AI systems... build entirely on the
// existing architecture" instruction. Each step is "learn by doing" — it
// links to a REAL, already-existing route rather than a fabricated one.
//
// Completion is tracked with the exact same localStorage idiom already
// established by AiTradingCoachPanel's own onboarding dismissal (Sprint 1/2)
// and lib/workflow-dismissals.ts (a single string constant key, a JSON
// array of ids, try/catch fail-open) — never a new persistence pattern.

const GUIDED_TOURS_STORAGE_KEY = "platform-guided-tours-completed";

export type GuidedTourId = "first-trade" | "first-research" | "first-journal" | "first-portfolio-review";

export interface GuidedTourStep {
  title: string;
  body: string;
  /** A real, already-existing route to visit for this step — "learn by
   * doing," never a fabricated destination. */
  href?: string;
  hrefLabel?: string;
}

export interface GuidedTour {
  id: GuidedTourId;
  label: string;
  description: string;
  steps: GuidedTourStep[];
}

export const GUIDED_TOURS: Record<GuidedTourId, GuidedTour> = {
  "first-trade": {
    id: "first-trade",
    label: "First Trade",
    description: "Walk the full daily workflow chain, from discovering an opportunity to logging it in your journal.",
    steps: [
      {
        title: "1. Discover",
        body: "Start at the Market Scanner — it ranks every eligible opportunity across the platform's own strategy universe right now.",
        href: "/scanner",
        hrefLabel: "Open Market Scanner",
      },
      {
        title: "2. Research",
        body: "Once something looks interesting, dig into it on Trading Research before committing to anything.",
        href: "/trading-research",
        hrefLabel: "Open Trading Research",
      },
      {
        title: "3. Decide & review risk",
        body: "Bring your Trade Plan into the Decision Workflow for a structured, evidence-driven read — guidance only, never a buy/sell instruction.",
        href: "/decision-workflow",
        hrefLabel: "Open Decision Workflow",
      },
      {
        title: "4. Track execution",
        body: "Execute manually at your own broker, then track the position's full lifecycle in the Execution & Lifecycle Manager. This platform never places an order for you.",
        href: "/execution-lifecycle",
        hrefLabel: "Open Execution & Lifecycle Manager",
      },
      {
        title: "5. Journal it",
        body: "Once the trade closes, write it up in the Trading Journal — the single best habit for improving over time.",
        href: "/trading-journal",
        hrefLabel: "Open Trading Journal",
      },
    ],
  },
  "first-research": {
    id: "first-research",
    label: "First Research",
    description: "Learn how to research a symbol using the platform's own research tools before building a trade around it.",
    steps: [
      {
        title: "1. Pick a symbol",
        body: "Trading Research and Stock Research both let you search any symbol and pull up its full analysis — trend, structure, liquidity, regime, and probability.",
        href: "/trading-research",
        hrefLabel: "Open Trading Research",
      },
      {
        title: "2. Read the signals, don't chase one number",
        body: "Each panel (structure, multi-timeframe, regime, liquidity, probability) is independent — a real read agrees across several of them, not just one.",
      },
      {
        title: "3. Save what matters",
        body: "Add real findings to a Trade Plan or your Watchlist so the work isn't lost — both are reachable from the same research pages.",
        href: "/assistant",
        hrefLabel: "Open Notebooks & Trade Plans",
      },
    ],
  },
  "first-journal": {
    id: "first-journal",
    label: "First Journal",
    description: "Learn the habit of writing up a trade after it closes — the fastest way to actually improve.",
    steps: [
      {
        title: "1. Open the Trading Journal",
        body: "Every closed trade deserves a short write-up: what happened, why, and what you'd do differently.",
        href: "/trading-journal",
        hrefLabel: "Open Trading Journal",
      },
      {
        title: "2. Write the thesis and the outcome",
        body: "A good entry names your original thesis, the actual outcome, and one honest lesson — not just a P&L number.",
      },
      {
        title: "3. Review the pattern over time",
        body: "Come back periodically and look for repeated mistakes or repeated strengths across several entries, not just one trade.",
      },
    ],
  },
  "first-portfolio-review": {
    id: "first-portfolio-review",
    label: "First Portfolio Review",
    description: "Learn how to step back and review your whole portfolio, not just one trade at a time.",
    steps: [
      {
        title: "1. Check portfolio health",
        body: "The Portfolio Risk Dashboard rolls up concentration, correlation, and overall health into one score.",
        href: "/portfolio-dashboard",
        hrefLabel: "Open Portfolio Risk Dashboard",
      },
      {
        title: "2. Get a professional-style review",
        body: "The Institutional Mentor teaches you how a professional portfolio manager would grade your own existing portfolio — deterministic, never a trade recommendation.",
        href: "/institutional-mentor",
        hrefLabel: "Open Institutional Mentor",
      },
      {
        title: "3. Make it a habit",
        body: "A periodic review (weekly, not per-trade) is what catches concentration risk and behavioural patterns before they become a real problem.",
      },
    ],
  },
};

function readCompletedTours(): GuidedTourId[] {
  try {
    const raw = localStorage.getItem(GUIDED_TOURS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasCompletedTour(id: GuidedTourId): boolean {
  return readCompletedTours().includes(id);
}

export function markTourCompleted(id: GuidedTourId): void {
  try {
    const existing = readCompletedTours();
    if (existing.includes(id)) return;
    localStorage.setItem(GUIDED_TOURS_STORAGE_KEY, JSON.stringify([...existing, id]));
  } catch {
    // Best-effort only — see readCompletedTours().
  }
}
