// v1.6.0, Sprint 3 — UX Transformation.
//
// The ONE reusable page shell requested by the approved scope ("Create one
// reusable page shell... Replace duplicated header implementations").
// Investigation before writing any code found 66 of 89 top-level pages
// hand-roll the exact same header shape (icon + <h1 className="text-2xl
// font-bold ..."> + a badge row + a description paragraph) with zero
// shared component to extract from — this file IS that shared component,
// applied to the platform's "golden path" pages this sprint (the daily
// trading workflow chain), never a wholesale rewrite of all 89 pages in
// one pass (a disclosed, bounded first slice, matching this codebase's own
// established "first bounded slice" precedent — e.g. Sprint 40's own
// Route+UI backlog reduction).
//
// Deliberately builds NO new workflow/journey concept of its own — the
// "current workflow step" row below is nothing more than a thin wrapper
// around the EXISTING, unmodified PlatformJourneyNav (v1.5.0 Sprint 11-14)
// component, reused exactly as instructed ("Reuse the existing
// PlatformJourneyNav... do NOT create another workflow component"). The
// "next recommended action" is derived directly from
// PLATFORM_JOURNEY_STAGES' own already-existing stage/href list — never a
// fabricated suggestion. "Related modules" is derived directly from the
// existing NAV_GROUPS sidebar index (lib/nav-items.ts) — the sibling items
// in the same navigation group as the current route — never a second,
// separate "related content" registry invented for this sprint.
import { Link, useLocation } from "wouter";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ModuleLearnTrigger } from "@/components/learn/ModuleLearnTrigger";
import { getModuleLearnEntry } from "@/lib/learn/moduleLearnRegistry";
import { PlatformJourneyNav, PLATFORM_JOURNEY_STAGES, type PlatformJourneyStageId } from "./PlatformJourneyNav";
import { NAV_GROUPS } from "@/lib/nav-items";

export interface PageShellProps {
  icon: LucideIcon;
  title: string;
  /** What this page is. Shown always, never hidden behind progressive
   * disclosure — the whole point is a user should never have to click to
   * find out what a page is for. Accepts a ReactNode (not just a plain
   * string) since several existing pages' own descriptions carry real
   * cross-links to sibling pages that must be preserved exactly. */
  description?: React.ReactNode;
  /** One short sentence: why this page matters / when you'd use it.
   * Progressively disclosed (collapsed by default) per the approved
   * scope's "beginners should not see everything immediately" instruction
   * — a professional user who already knows the platform is never forced
   * to read it. */
  whyItMatters?: string;
  /** Which stage of the existing PLATFORM_JOURNEY_STAGES journey this page
   * represents, if any. Renders the existing PlatformJourneyNav plus a
   * "Next" link derived from the same stage list — omit entirely for a
   * page that isn't part of that journey (never fabricate a stage). */
  journeyStage?: PlatformJourneyStageId;
  /** A key into MODULE_LEARN_REGISTRY (lib/learn/moduleLearnRegistry.ts)
   * for this page's contextual "Learn" trigger — reuses the existing
   * Learning Centre content, never new lesson content. Omit if no
   * reasonably-close existing lesson exists yet. */
  learnEntryId?: string;
  /** Header-row action controls (a strategy filter, a "Run Scan" button,
   * etc.) — rendered to the right of the title, exactly where each page's
   * own hand-rolled header already put them. */
  actions?: React.ReactNode;
  /** A badge row under the title (data-source labels, status badges, ...).
   * Purely a rendering slot — no new badge logic lives here. */
  badges?: React.ReactNode;
}

const MAX_RELATED_MODULES = 3;

function deriveRelatedModules(currentHref: string): { title: string; href: string }[] {
  const group = NAV_GROUPS.find((g) => g.items.some((item) => item.href === currentHref));
  if (!group) return [];
  return group.items.filter((item) => item.href !== currentHref).slice(0, MAX_RELATED_MODULES);
}

function deriveNextAction(stageId: PlatformJourneyStageId): { label: string; href: string } | null {
  const index = PLATFORM_JOURNEY_STAGES.findIndex((s) => s.id === stageId);
  if (index === -1) return null;
  for (let i = index + 1; i < PLATFORM_JOURNEY_STAGES.length; i++) {
    const stage = PLATFORM_JOURNEY_STAGES[i];
    if (stage.href) return { label: stage.label, href: stage.href };
  }
  return null;
}

export function PageShell({ icon: Icon, title, description, whyItMatters, journeyStage, learnEntryId, actions, badges }: PageShellProps) {
  const [location] = useLocation();
  const [infoOpen, setInfoOpen] = useState(false);

  const learnEntry = learnEntryId ? getModuleLearnEntry(learnEntryId) : undefined;
  const nextAction = journeyStage ? deriveNextAction(journeyStage) : null;
  const relatedModules = deriveRelatedModules(location);
  const hasInfo = Boolean(whyItMatters || learnEntry || relatedModules.length > 0);

  return (
    <div className="space-y-3" data-testid="page-shell">
      {location !== "/" && (
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="link-page-shell-home">
          <HomeIcon className="h-3 w-3" /> Command Centre
        </Link>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="page-shell-title">
          <Icon className="h-6 w-6 text-indigo-400" aria-hidden="true" /> {title}
        </h1>
        {actions && <div className="flex gap-4 items-center flex-wrap">{actions}</div>}
      </div>

      {badges && <div className="flex flex-wrap gap-2" data-testid="page-shell-badges">{badges}</div>}

      {description && (
        <p className="text-sm text-muted-foreground" data-testid="page-shell-description">
          {description}
        </p>
      )}

      {journeyStage && (
        <div data-testid="page-shell-journey">
          <PlatformJourneyNav current={journeyStage} />
          {nextAction && (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="page-shell-next-action">
              Next:{" "}
              <Link href={nextAction.href} className="text-indigo-400 hover:underline">
                {nextAction.label} →
              </Link>
            </p>
          )}
        </div>
      )}

      {hasInfo && (
        <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground" data-testid="button-page-shell-info-toggle">
              {infoOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              About this page
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2" data-testid="page-shell-info-content">
            {whyItMatters && (
              <p className="text-xs text-muted-foreground" data-testid="page-shell-why-it-matters">
                {whyItMatters}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {learnEntry && <ModuleLearnTrigger moduleLabel={learnEntry.label} pathKey={learnEntry.pathKey} topicKey={learnEntry.topicKey} size="xs" />}
              {relatedModules.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid="page-shell-related-modules">
                  Related:{" "}
                  {relatedModules.map((m, i) => (
                    <span key={m.href}>
                      {i > 0 && ", "}
                      <Link href={m.href} className="text-indigo-400 hover:underline">
                        {m.title}
                      </Link>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
