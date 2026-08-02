// v1.5.0, Sprint 11 — Platform Integration.
//
// A compact, shared workflow stepper connecting the major modules into one
// visible journey, per the approved scope's explicit example: "Research ->
// Notebook -> Strategy -> Trade Plan -> Execute (external broker) -> Trade
// Journal -> Performance Review -> Portfolio Impact -> Continuous
// Learning... the user should never wonder where they are in the
// process." This component introduces no new business logic or data — it
// is pure navigation, linking to already-existing routes.
//
// "Execute (external broker)" is deliberately rendered as a non-clickable,
// informational stage — this platform has no order-execution feature to
// link to (Trade Planner/Strategy Builder/Journal are all explicitly
// planning/reflection tools, never order placement), matching the same
// "never fabricate a capability that doesn't exist" discipline this
// codebase applies everywhere else.
//
// Notebook/Strategy/Trade Plan don't have their own dedicated routes —
// they're toggled panels living inside Assistant.tsx (Options),
// TradingResearch.tsx (Trading), and StockResearch.tsx (Investing) — so
// all three stages link to /assistant, the one page where all three panel
// families (Conversations/Notebooks/Strategies/Trade Plans) are reachable
// together. This is a disclosed, honest simplification, not a claim that
// those panels exist ONLY on that page.
import { Link } from "wouter";
import { CheckCircle2, Circle, Ban } from "lucide-react";

export type PlatformJourneyStageId =
  | "research"
  | "notebook"
  | "strategy"
  | "trade-plan"
  | "execute"
  | "trade-journal"
  | "performance"
  | "portfolio"
  | "learning";

export interface PlatformJourneyStage {
  id: PlatformJourneyStageId;
  label: string;
  href: string | null;
}

// v1.5.0, Sprint 12 — Institutional Command Centre. Exported (previously
// module-private) so the Command Centre's own richer per-stage Workflow
// Panel (status/progress/pending tasks/quick actions per stage) can reuse
// this exact same 9-stage id/label/href list rather than re-declaring it a
// second time — single source of truth for "what are the platform's
// stages and where do they link," this component's own compact stepper
// rendering is unchanged.
export const PLATFORM_JOURNEY_STAGES: PlatformJourneyStage[] = [
  { id: "research", label: "Research", href: "/stock-analyst" },
  { id: "notebook", label: "Notebook", href: "/assistant" },
  { id: "strategy", label: "Strategy", href: "/assistant" },
  { id: "trade-plan", label: "Trade Plan", href: "/assistant" },
  { id: "execute", label: "Execute (external broker)", href: null },
  { id: "trade-journal", label: "Trade Journal", href: "/trading-journal" },
  { id: "performance", label: "Performance Review", href: "/performance-attribution-engine" },
  { id: "portfolio", label: "Portfolio Impact", href: "/portfolio-dashboard" },
  { id: "learning", label: "Continuous Learning", href: "/learn" },
];

export function PlatformJourneyNav({ current }: { current: PlatformJourneyStageId }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-md border border-border bg-secondary/10 px-3 py-2"
      data-testid="nav-platform-journey"
    >
      {PLATFORM_JOURNEY_STAGES.map((stage, i) => {
        const isCurrent = stage.id === current;
        const isPast = PLATFORM_JOURNEY_STAGES.findIndex((s) => s.id === current) > i;
        const content = (
          <span
            data-testid={`journey-stage-content-${stage.id}`}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md whitespace-nowrap ${
              isCurrent
                ? "bg-indigo-500/20 text-indigo-400 font-semibold"
                : stage.href
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground/50"
            }`}
          >
            {stage.href === null ? (
              <Ban className="w-3 h-3" />
            ) : isPast ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
            {stage.label}
          </span>
        );
        return (
          <span key={stage.id} className="flex items-center gap-1" data-testid={`journey-stage-${stage.id}`}>
            {i > 0 && <span className="text-muted-foreground/30 text-xs">→</span>}
            {stage.href && !isCurrent ? <Link href={stage.href}>{content}</Link> : content}
          </span>
        );
      })}
    </div>
  );
}
