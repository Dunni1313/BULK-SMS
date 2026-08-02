// v1.5.0, Sprint 10 — Institutional Trade Planner. A pure, static,
// read-only registry of coach-specific checklist templates — the
// approved scope's own explicit "Coach-specific checklist templates"
// requirement, satisfied here as a plain TypeScript array: a new
// template is a one-line addition, never a migration. Applying a
// template only seeds a plan's own trade_plan_checklist_items rows
// (each item independently editable/completable afterward) — it is
// never itself persisted or re-read from the database.

// Deliberately not importing CoachId from routes/aiCoachConversations.ts
// — lib/ stays a lower-level layer than routes/, never the reverse. Kept
// in sync by hand with COACH_IDS ("trading" | "investing" | "options"),
// the same convention lib/strategyTemplates.ts already established.
type ChecklistCoachId = "trading" | "investing" | "options";

export interface ChecklistTemplateItem {
  label: string;
  required: boolean;
}

export interface TradePlanChecklistTemplate {
  id: string;
  label: string;
  coachId: ChecklistCoachId;
  description: string;
  items: ChecklistTemplateItem[];
}

export const TRADE_PLAN_CHECKLIST_TEMPLATES: TradePlanChecklistTemplate[] = [
  {
    id: "trading-pre-trade",
    label: "Trading Pre-Trade Checklist",
    coachId: "trading",
    description: "A generic pre-trade readiness checklist for a directional or swing trade. Adjust items to fit your own process before relying on it.",
    items: [
      { label: "Higher-timeframe trend/structure has been reviewed", required: true },
      { label: "Entry zone and confirmation rule are both written down", required: true },
      { label: "Stop loss is set at a structurally sound invalidation level", required: true },
      { label: "Position size respects your maximum account risk per trade", required: true },
      { label: "At least one profit target is defined", required: true },
      { label: "Upcoming catalysts/news/earnings have been checked", required: false },
      { label: "Psychology check — no revenge trading or FOMO influencing this plan", required: false },
    ],
  },
  {
    id: "investing-pre-position",
    label: "Investing Pre-Position Checklist",
    coachId: "investing",
    description: "A generic checklist for initiating or adding to a longer-horizon position. Adjust items to fit your own process before relying on it.",
    items: [
      { label: "Investment thesis is written in one or two clear sentences", required: true },
      { label: "Valuation/margin of safety has been considered", required: true },
      { label: "Position size fits within your overall portfolio allocation limits", required: true },
      { label: "A clear invalidation condition for the thesis has been defined", required: true },
      { label: "Time horizon for this position is stated", required: false },
      { label: "Relevant research notes/filings have been linked", required: false },
    ],
  },
  {
    id: "options-pre-trade",
    label: "Options Pre-Trade Checklist",
    coachId: "options",
    description: "A generic pre-trade checklist for an options income or directional structure. Adjust items to fit your own process before relying on it.",
    items: [
      { label: "Strategy and strikes/expiration are fully specified", required: true },
      { label: "Maximum loss for the structure is known and acceptable", required: true },
      { label: "Implied volatility level/rank has been considered", required: true },
      { label: "Upcoming earnings/dividend/assignment risk has been checked", required: true },
      { label: "Exit/adjustment plan (profit target and/or roll rule) is written down", required: false },
    ],
  },
];

export function getTradePlanChecklistTemplate(id: string): TradePlanChecklistTemplate | null {
  return TRADE_PLAN_CHECKLIST_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function listTradePlanChecklistTemplates(coachId?: ChecklistCoachId): TradePlanChecklistTemplate[] {
  if (!coachId) return TRADE_PLAN_CHECKLIST_TEMPLATES;
  return TRADE_PLAN_CHECKLIST_TEMPLATES.filter((t) => t.coachId === coachId);
}
