// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Plain-fetch client
// for GET/PATCH /ai-trading-coach/state and PATCH /ai-trading-coach/preferences
// (artifacts/api-server/src/routes/aiTradingCoachWorkflow.ts), mirroring
// tradePlansApi.ts's/strategiesApi.ts's own established plain-fetch pattern
// (Sprints 9-10) for the same reason: a small, additive, self-contained
// surface, not worth a full OpenAPI/orval regeneration.

const API_PREFIX = "/api";

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced", "institutional"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  institutional: "Institutional",
};

export interface AiTradingCoachPreferences {
  id: number;
  userId: string;
  experienceLevel: ExperienceLevel;
  beginnerModeEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiTradingCoachDailyState {
  id: number;
  userId: string;
  tradingDate: string;
  completedStepIds: string[];
  skippedStepIds: string[];
  noTradeReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MarketCalendarSource = "alpaca" | "static_approximation";

export interface MarketClockStatus {
  source: MarketCalendarSource;
  isOpen: boolean;
  currentTimeEt: string;
  nextOpen: string | null;
  nextClose: string | null;
  reason: string;
}

export interface AiTradingCoachStateResponse {
  preferences: AiTradingCoachPreferences;
  dailyState: AiTradingCoachDailyState;
  marketClock: MarketClockStatus;
  tradingDate: string;
}

export interface UpdateAiTradingCoachPreferencesInput {
  experienceLevel?: ExperienceLevel;
  beginnerModeEnabled?: boolean;
}

export interface UpdateAiTradingCoachDailyStateInput {
  tradingDate?: string;
  completedStepIds?: string[];
  skippedStepIds?: string[];
  noTradeReason?: string | null;
}

export class AiTradingCoachApiError extends Error {}

async function parseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiTradingCoachApiError(body.error ?? fallbackMessage);
  }
  return res.json();
}

export async function getAiTradingCoachState(): Promise<AiTradingCoachStateResponse> {
  const res = await fetch(`${API_PREFIX}/ai-trading-coach/state`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load AI Trading Coach state");
}

export async function updateAiTradingCoachPreferences(
  input: UpdateAiTradingCoachPreferencesInput,
): Promise<AiTradingCoachPreferences> {
  const res = await fetch(`${API_PREFIX}/ai-trading-coach/preferences`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to update AI Trading Coach preferences");
}

export async function updateAiTradingCoachDailyState(
  input: UpdateAiTradingCoachDailyStateInput,
): Promise<AiTradingCoachDailyState> {
  const res = await fetch(`${API_PREFIX}/ai-trading-coach/state`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to update AI Trading Coach daily state");
}
