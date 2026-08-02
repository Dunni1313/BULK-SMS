// Phase 10 — Institutional Platform Polish & Control Center. The Global
// Command Palette (⌘K / Ctrl+K) — and, per the deliberate design decision
// documented in docs/Institutional-Control-Center.md, ALSO the platform's
// Global Search: rather than building a second, nearly-identical full-page
// search UI, this one dialog serves both asks. "Unify, simplify" is this
// phase's own stated goal; two search surfaces for the same platform would
// violate it.
//
// Every dynamic data source below is fetched lazily (enabled: open) only
// once the palette is actually opened — never eagerly on every page load
// — matching this codebase's established "enabled-gated generated hook"
// pattern (Sprint 19 precedent). cmdk (via components/ui/command.tsx)
// provides fuzzy text filtering and full keyboard navigation (arrow keys,
// Enter, Escape) out of the box — no bespoke keyboard handling was written
// here.
//
// Zero new trading, execution, pricing, portfolio, or risk calculations —
// every item below is a navigation, a read of already-fetched data, or
// (Export Portfolio) a client-side CSV download of already-fetched trades.

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useListTrades,
  getListTradesQueryKey,
  useListJournalEntries,
  getListJournalEntriesQueryKey,
  useGetGlossary,
  getGetGlossaryQueryKey,
  useGetStrategyAcademy,
  getGetStrategyAcademyQueryKey,
  useGetLearningPaths,
  getGetLearningPathsQueryKey,
  useGetInstitutionalIntelligence,
  getGetInstitutionalIntelligenceQueryKey,
  useGetValueWatchlist,
  getGetValueWatchlistQueryKey,
  useGetPortfolios,
  getGetPortfoliosQueryKey,
  // v1.4.0, Sprint L1 — Learning Centre Foundation.
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
} from "@workspace/api-client-react";
import { resolveItemHref } from "@/lib/learning-item-href";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ToastAction } from "@/components/ui/toast";
import { ALL_NAV_ITEMS } from "@/lib/nav-items";
import { QUICK_ACTIONS } from "@/lib/quick-actions";
import { downloadPortfolioCsv } from "@/lib/portfolio-export";
import { WORKFLOWS, type Workflow } from "@/lib/workflows";
import { useToast } from "@/hooks/use-toast";
import { listNotebooks, type AiNotebook } from "@/lib/ai-coach/notebooksApi";
import { listStrategies, type AiStrategy } from "@/lib/ai-coach/strategiesApi";
import { listTradePlans, type TradePlan } from "@/lib/ai-coach/tradePlansApi";
import type { CoachId } from "@/lib/ai-coach/capabilityRegistry";
import { Compass, Zap, Briefcase, BookOpen, Library, GraduationCap, Map, Sparkles, ListChecks, Building2, Bookmark, Network, Route } from "lucide-react";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  // Every dynamic list below is fetched only once the palette is open —
  // never on initial page load.
  const { data: openTrades } = useListTrades(
    { status: "open" },
    { query: { queryKey: getListTradesQueryKey({ status: "open" }), enabled: open } },
  );
  const { data: journalEntries } = useListJournalEntries({
    query: { queryKey: getListJournalEntriesQueryKey(), enabled: open },
  });
  const { data: glossaryTerms } = useGetGlossary({
    query: { queryKey: getGetGlossaryQueryKey(), enabled: open },
  });
  const { data: strategies } = useGetStrategyAcademy({
    query: { queryKey: getGetStrategyAcademyQueryKey(), enabled: open },
  });
  const { data: learningPaths } = useGetLearningPaths({
    query: { queryKey: getGetLearningPathsQueryKey(), enabled: open },
  });
  const { data: intelligence } = useGetInstitutionalIntelligence({
    query: { queryKey: getGetInstitutionalIntelligenceQueryKey(), enabled: open },
  });
  // Phase 12 — Institutional Investing Engine Consolidation & Integration.
  const { data: watchlist } = useGetValueWatchlist(undefined, {
    query: { queryKey: getGetValueWatchlistQueryKey(), enabled: open },
  });
  // Phase 13 — Institutional Portfolio Manager.
  const { data: portfolios } = useGetPortfolios({
    query: { queryKey: getGetPortfoliosQueryKey(), enabled: open },
  });
  // v1.4.0, Sprint L1 — Learning Centre Foundation. Search integration:
  // extends this same palette's existing data sources rather than
  // building a second search engine, per the approved architecture.
  const { data: progress } = useGetLearningProgress({
    query: { queryKey: getGetLearningProgressQueryKey(), enabled: open },
  });

  // v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
  // "Extend the existing search" — Research Notebooks (Sprint 8), My
  // Strategies (Sprint 9), and Trade Plans (Sprint 10) join this same
  // palette rather than a second search surface, matching this file's own
  // "fetched lazily... only once the palette is actually opened" rule:
  // notebooksApi.ts/strategiesApi.ts/tradePlansApi.ts are still plain-fetch
  // (Sprint 8/9/10's own established shape, not generated hooks), so this
  // effect gates on `open` itself instead of a generated `enabled` flag.
  const [notebooks, setNotebooks] = useState<AiNotebook[]>([]);
  const [myStrategies, setMyStrategies] = useState<AiStrategy[]>([]);
  const [tradePlans, setTradePlans] = useState<TradePlan[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all(COACH_IDS.map((c) => listNotebooks(c).catch((): AiNotebook[] => []))).then((r) => {
      if (!cancelled) setNotebooks(r.flat());
    });
    Promise.all(COACH_IDS.map((c) => listStrategies(c).catch((): AiStrategy[] => []))).then((r) => {
      if (!cancelled) setMyStrategies(r.flat());
    });
    Promise.all(COACH_IDS.map((c) => listTradePlans(c).catch((): TradePlan[] => []))).then((r) => {
      if (!cancelled) setTradePlans(r.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function go(href: string) {
    setLocation(href);
    onOpenChange(false);
    setQuery("");
  }

  function runQuickAction(actionId: string, href: string) {
    if (actionId === "export-portfolio") {
      if (!openTrades || openTrades.length === 0) {
        toast({ title: "Nothing to export", description: "No open positions to export yet." });
      } else {
        downloadPortfolioCsv(openTrades);
        toast({ title: "Portfolio exported", description: `${openTrades.length} open position(s) downloaded as CSV.` });
      }
      onOpenChange(false);
      setQuery("");
      return;
    }
    go(href);
  }

  // The Workflow Engine (see lib/workflows.ts's own header comment for
  // the deliberate scope decision): navigates to a workflow's first
  // step, then shows a toast naming the remaining steps with a "Next"
  // action to advance through them one at a time. No new persisted
  // state — the in-progress step index lives only in this closure.
  function runWorkflow(workflow: Workflow) {
    let stepIndex = 0;
    const advance = () => {
      const step = workflow.steps[stepIndex];
      if (!step) return;
      setLocation(step.href);
      const isLast = stepIndex === workflow.steps.length - 1;
      toast({
        title: workflow.label,
        description: `Step ${stepIndex + 1} of ${workflow.steps.length}: ${step.label}`,
        action: isLast ? undefined : (
          <ToastAction
            altText="Next step"
            data-testid={`workflow-next-${workflow.id}`}
            onClick={() => {
              stepIndex += 1;
              advance();
            }}
          >
            Next
          </ToastAction>
        ),
      });
    };
    advance();
    onOpenChange(false);
    setQuery("");
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} data-testid="command-palette">
      <CommandInput
        placeholder="Search pages, positions, lessons, strategies, glossary…"
        value={query}
        onValueChange={setQuery}
        data-testid="command-palette-input"
      />
      <CommandList data-testid="command-palette-list">
        <CommandEmpty data-testid="command-palette-empty">No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          {QUICK_ACTIONS.map((action) => (
            <CommandItem
              key={action.id}
              value={`quick action ${action.label}`}
              onSelect={() => runQuickAction(action.id, action.href)}
              data-testid={`command-item-quick-${action.id}`}
            >
              <action.icon className="h-4 w-4" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Workflows">
          {WORKFLOWS.map((workflow) => (
            <CommandItem
              key={workflow.id}
              value={`workflow ${workflow.label} ${workflow.description}`}
              onSelect={() => runWorkflow(workflow)}
              data-testid={`command-item-workflow-${workflow.id}`}
            >
              <ListChecks className="h-4 w-4" />
              <span>{workflow.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {ALL_NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={`navigate ${item.title}`}
              onSelect={() => go(item.href)}
              data-testid={`command-item-nav-${item.href}`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {openTrades && openTrades.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Positions">
              {openTrades.slice(0, 25).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`position ${t.symbol} ${t.strategy}`}
                  onSelect={() => go(`/ticket/adjust/${t.id}`)}
                  data-testid={`command-item-position-${t.id}`}
                >
                  <Briefcase className="h-4 w-4" />
                  <span>
                    {t.symbol} — {t.strategy.replace(/_/g, " ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {watchlist && watchlist.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Watchlist">
              {watchlist.slice(0, 25).map((w) => (
                <CommandItem
                  key={w.id}
                  value={`watchlist ${w.symbol} ${w.category}`}
                  onSelect={() => go(`/stock-analyst?symbol=${w.symbol}`)}
                  data-testid={`command-item-watchlist-${w.symbol}`}
                >
                  <Building2 className="h-4 w-4" />
                  <span>
                    {w.symbol} — {w.currentDecision}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {portfolios && portfolios.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Portfolios">
              {portfolios.slice(0, 25).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`portfolio ${p.name}`}
                  onSelect={() => go(`/stock-analyst/portfolio-construction?portfolioId=${p.id}`)}
                  data-testid={`command-item-portfolio-${p.id}`}
                >
                  <Briefcase className="h-4 w-4" />
                  <span>
                    {p.name} — {p.holdingsCount} holding{p.holdingsCount === 1 ? "" : "s"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {journalEntries && journalEntries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Journal">
              {journalEntries.slice(0, 25).map((j) => (
                <CommandItem
                  key={j.id}
                  value={`journal ${j.title}`}
                  onSelect={() => go("/journal")}
                  data-testid={`command-item-journal-${j.id}`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>{j.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {learningPaths && learningPaths.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Lessons">
              {learningPaths.map((p) => (
                <CommandItem
                  key={p.key}
                  value={`lesson ${p.title}`}
                  onSelect={() => go(`/learn/paths/${p.key}`)}
                  data-testid={`command-item-lesson-${p.key}`}
                >
                  <Map className="h-4 w-4" />
                  <span>{p.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {strategies && strategies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Strategies">
              {strategies.map((s) => (
                <CommandItem
                  key={s.key}
                  value={`strategy ${s.label}`}
                  onSelect={() => go(`/learn/strategy-academy/${s.key}`)}
                  data-testid={`command-item-strategy-${s.key}`}
                >
                  <GraduationCap className="h-4 w-4" />
                  <span>{s.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {glossaryTerms && glossaryTerms.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Glossary">
              {glossaryTerms.slice(0, 40).map((g) => (
                <CommandItem
                  key={g.key}
                  value={`glossary ${g.term}`}
                  onSelect={() => go(`/learn/glossary/${g.key}`)}
                  data-testid={`command-item-glossary-${g.key}`}
                >
                  <Library className="h-4 w-4" />
                  <span>{g.term}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {(() => {
          // Never fabricate a link: resolve every bookmark's real href up
          // front and skip the whole group (not just individual items,
          // which would otherwise leave a heading with nothing under it)
          // when none can be resolved (e.g. a bookmarked "coach" item,
          // which has no dedicated detail page of its own).
          const resolvedBookmarks = (progress?.bookmarks ?? [])
            .map((b) => ({ ...b, href: resolveItemHref(b.itemType, b.itemKey, learningPaths) }))
            .filter((b): b is typeof b & { href: string } => Boolean(b.href))
            .slice(0, 25);
          if (resolvedBookmarks.length === 0) return null;
          return (
            <>
              <CommandSeparator />
              <CommandGroup heading="Bookmarks">
                {resolvedBookmarks.map((b, i) => (
                  <CommandItem
                    key={`${b.itemType}-${b.itemKey}-${i}`}
                    value={`bookmark ${b.itemType} ${b.itemKey}`}
                    onSelect={() => go(b.href)}
                    data-testid={`command-item-bookmark-${b.itemType}-${b.itemKey}`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span className="capitalize">
                      {b.itemType}: {b.itemKey}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          );
        })()}

        {intelligence && intelligence.observations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="AI Observations">
              {intelligence.observations.slice(0, 15).map((o) => (
                <CommandItem
                  key={o.code}
                  value={`observation ${o.title} ${o.explanation}`}
                  onSelect={() => go("/institutional-intelligence")}
                  data-testid={`command-item-observation-${o.code}`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{o.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {notebooks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Research">
              {notebooks.slice(0, 25).map((n) => (
                <CommandItem
                  key={n.id}
                  value={`research notebook ${n.title} ${n.tags.join(" ")}`}
                  onSelect={() => go("/institutional-ai-coach")}
                  data-testid={`command-item-notebook-${n.id}`}
                >
                  <Network className="h-4 w-4" />
                  <span>{n.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {myStrategies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="My Strategies">
              {myStrategies.slice(0, 25).map((s) => (
                <CommandItem
                  key={s.id}
                  value={`my strategy ${s.title} ${s.tags.join(" ")}`}
                  onSelect={() => go("/institutional-ai-coach")}
                  data-testid={`command-item-my-strategy-${s.id}`}
                >
                  <Route className="h-4 w-4" />
                  <span>{s.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tradePlans.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Trade Plans">
              {tradePlans.slice(0, 25).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`trade plan ${p.title} ${p.plannedAsset ?? ""} ${p.tags.join(" ")}`}
                  onSelect={() => go(`/execution-lifecycle-manager?planId=${p.id}`)}
                  data-testid={`command-item-trade-plan-${p.id}`}
                >
                  <Briefcase className="h-4 w-4" />
                  <span>
                    {p.title} {p.plannedAsset ? `(${p.plannedAsset})` : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Other">
          <CommandItem value="workspace institutional home" onSelect={() => go("/")} data-testid="command-item-home">
            <Compass className="h-4 w-4" />
            <span>Go to Institutional Home</span>
          </CommandItem>
          <CommandItem value="notifications alerts" onSelect={() => go("/notifications")} data-testid="command-item-notifications">
            <Zap className="h-4 w-4" />
            <span>Open Notification Centre</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
