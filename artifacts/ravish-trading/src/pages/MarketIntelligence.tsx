// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine.
//
// NOT another Research module. NOT another dashboard. Research remains
// user-created; this page is external market context — continuously
// gathered, classified, and prioritised, connected outward into every
// existing entity (Research, Portfolio, Knowledge Graph, Playbooks,
// Learning Centre) rather than duplicating any of them. See
// src/lib/marketIntelligence.ts (both the api-server composition layer and
// this frontend's own entity-linking layer) for the full reuse map, and
// docs/v1.5.0-Sprint-20-Market-Intelligence-Engine.md for the architecture.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMarketIntelligence } from "@/lib/useMarketIntelligence";
import {
  watchlistRelevantItems,
  priorityItems,
  todaysKeyEvents,
  upcomingEconomicReleases,
  buildMarketIntelligenceCoachNarrative,
  type MarketIntelligenceView,
} from "@/lib/marketIntelligence";
import type { MarketIntelligenceCategory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Bot, Eye, Flame, CalendarClock, Sparkles, Network, ShieldAlert } from "lucide-react";

function impactBadgeClass(impact: string): string {
  if (impact === "high") return "bg-destructive/15 text-destructive border-destructive/30";
  if (impact === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "border-border text-muted-foreground";
}

const CATEGORY_LABELS: Record<MarketIntelligenceCategory, string> = {
  macro: "Macro",
  economic_events: "Economic Events",
  central_banks: "Central Banks",
  earnings: "Earnings",
  corporate_actions: "Corporate Actions",
  sector_trends: "Sector Trends",
  commodities: "Commodities",
  currencies: "Currencies",
  indices: "Indices",
  volatility: "Volatility",
  options_activity: "Options Activity",
  market_breadth: "Market Breadth",
  sentiment: "Sentiment",
};

// ─── Item detail (list entry + expanded card) ───────────────────────────

function ItemCard({ item, expanded, onToggle }: { item: MarketIntelligenceView; expanded: boolean; onToggle: () => void }) {
  const narrative = useMemo(() => buildMarketIntelligenceCoachNarrative(item), [item]);

  return (
    <Card className="bg-card border-border" data-testid={`market-intelligence-item-${item.id}`}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={onToggle}>
          <div>
            <p className="text-sm font-medium">{item.headline}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CATEGORY_LABELS[item.category]} · {item.source} · {new Date(item.timestamp).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.isPriority && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30" data-testid={`market-intelligence-priority-${item.id}`}>
                <Flame className="h-3 w-3 mr-1" /> Priority
              </Badge>
            )}
            {item.isWatched && (
              <Badge variant="outline" className="border-sky-500/40 text-sky-400" data-testid={`market-intelligence-watched-${item.id}`}>
                <Eye className="h-3 w-3 mr-1" /> Watched
              </Badge>
            )}
            <Badge className={impactBadgeClass(item.impact)}>{item.impact}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{item.summary}</p>

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-1">Affected Assets</p>
                {item.affectedAssets.length === 0 ? (
                  <p data-testid={`market-intelligence-no-assets-${item.id}`}>Market-wide — no single symbol named.</p>
                ) : (
                  <p className="font-mono" data-testid={`market-intelligence-assets-${item.id}`}>
                    {item.affectedAssets.join(", ")}
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Affected Sectors</p>
                {item.affectedSectors.length === 0 ? <p>None named.</p> : <p>{item.affectedSectors.join(", ")}</p>}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Potential Risks</p>
                {item.potentialRisks.length === 0 ? (
                  <p>None flagged.</p>
                ) : (
                  <ul className="list-disc list-inside">
                    {item.potentialRisks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Potential Opportunities</p>
                {item.potentialOpportunities.length === 0 ? (
                  <p>None flagged.</p>
                ) : (
                  <ul className="list-disc list-inside">
                    {item.potentialOpportunities.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-1">Related Research</p>
                {item.relatedResearch.length === 0 ? (
                  <p data-testid={`market-intelligence-no-research-${item.id}`}>No related research on file.</p>
                ) : (
                  <ul className="list-disc list-inside">
                    {item.relatedResearch.map((r, i) => (
                      <li key={i}>{r.href ? <Link href={r.href} className="underline">{r.label}</Link> : r.label}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Related Strategies</p>
                {item.relatedStrategies.length === 0 ? (
                  <p>None linked.</p>
                ) : (
                  <ul className="list-disc list-inside">
                    {item.relatedStrategies.map((r, i) => (
                      <li key={i}>{r.href ? <Link href={r.href} className="underline">{r.label}</Link> : r.label}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Related Lessons (Journal)</p>
                {item.relatedLessons.length === 0 ? (
                  <p>None linked.</p>
                ) : (
                  <ul className="list-disc list-inside">
                    {item.relatedLessons.map((r, i) => (
                      <li key={i}>{r.href ? <Link href={r.href} className="underline">{r.label}</Link> : r.label}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <div>
                {item.relatedHoldings.length > 0 && (
                  <p data-testid={`market-intelligence-holdings-${item.id}`}>You hold: {item.relatedHoldings.join(", ")}</p>
                )}
                {item.relatedPlaybook && (
                  <Link href={item.relatedPlaybook.href} className="text-primary hover:underline">
                    Related Playbook: {item.relatedPlaybook.name} →
                  </Link>
                )}
                {item.learnMore && (
                  <Link href={`/learn/paths/${item.learnMore.pathKey}`} className="text-primary hover:underline block">
                    Learn: {item.learnMore.label} →
                  </Link>
                )}
              </div>
            </div>

            <div className="bg-muted/30 rounded p-3 space-y-1.5" data-testid={`market-intelligence-coach-${item.id}`}>
              <p className="text-xs font-medium flex items-center gap-1">
                <Bot className="h-3 w-3" /> AI Market Coach
              </p>
              <p className="text-xs text-muted-foreground">{narrative.whyThisMatters}</p>
              <p className="text-xs text-muted-foreground">{narrative.affectedAssets}</p>
              <p className="text-xs text-muted-foreground">{narrative.affectedHoldings}</p>
              <p className="text-xs text-muted-foreground">{narrative.researchToReview}</p>
              <p className="text-xs text-muted-foreground">{narrative.playbooksToConsider}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Portfolio Integration (reuses Portfolio & Risk Intelligence, Sprint 15) ─

function PortfolioIntegrationCard({ intelligence }: { intelligence: ReturnType<typeof useMarketIntelligence>["portfolioIntelligence"] }) {
  const signals = intelligence.risk?.signals ?? [];
  return (
    <Card className="bg-card border-border" data-testid="market-intelligence-portfolio-integration">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Portfolio Integration
        </CardTitle>
        <CardDescription>
          Reused directly from{" "}
          <Link href="/portfolio-risk-intelligence" className="underline">
            Portfolio &amp; Risk Intelligence
          </Link>
          . No duplicate risk calculation is performed here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs">
        {signals.length === 0 ? (
          <p data-testid="market-intelligence-portfolio-no-signals">No risk signals currently available.</p>
        ) : (
          signals.map((s) => (
            <div key={s.code} className="flex items-center justify-between gap-2">
              <span>{s.label}</span>
              <span className="text-muted-foreground text-right">{s.available ? s.headline : `${s.headline} — ${s.detail}`}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function MarketIntelligence() {
  const intel = useMarketIntelligence();
  const [categoryFilter, setCategoryFilter] = useState<MarketIntelligenceCategory | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const todayIso = new Date().toISOString();
  const priority = useMemo(() => priorityItems(intel.items), [intel.items]);
  const watchlistIntel = useMemo(() => watchlistRelevantItems(intel.items), [intel.items]);
  const todaysEvents = useMemo(() => todaysKeyEvents(intel.items, todayIso), [intel.items, todayIso]);
  const releases = useMemo(() => upcomingEconomicReleases(intel.items), [intel.items]);
  const emergingThemes = intel.emergingThemes;

  const filtered = categoryFilter === "all" ? intel.items : intel.items.filter((i) => i.category === categoryFilter);

  if (intel.loading) {
    return (
      <div className="space-y-4 max-w-6xl" data-testid="page-market-intelligence">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (intel.isError) {
    return (
      <div className="space-y-4 max-w-6xl" data-testid="page-market-intelligence">
        <p className="text-sm text-rose-400" data-testid="market-intelligence-error">
          Couldn't load Market Intelligence right now. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl" data-testid="page-market-intelligence">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Market Intelligence</h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
            <Globe className="h-3 w-3 mr-1" /> Market Intelligence Engine
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          External market context — never trading signals or price predictions. Research remains user-created; this
          is continuously gathered and prioritised context connected to your existing work.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border" data-testid="market-intelligence-todays-events">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Today's Key Events
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {todaysEvents.length === 0 ? (
              <p data-testid="market-intelligence-no-todays-events">No key events today.</p>
            ) : (
              todaysEvents.map((e) => <p key={e.id}>{e.headline}</p>)
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="market-intelligence-upcoming-releases">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Upcoming Economic Releases
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {releases.length === 0 ? (
              <p data-testid="market-intelligence-no-releases">None upcoming.</p>
            ) : (
              releases.slice(0, 5).map((e) => <p key={e.id}>{e.headline}</p>)
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="market-intelligence-emerging-themes">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Emerging Themes
            </CardTitle>
            <CardDescription>
              Reused from the{" "}
              <Link href="/knowledge-graph" className="underline">
                Knowledge Graph
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {emergingThemes.length === 0 ? (
              <p data-testid="market-intelligence-no-themes">No emerging themes detected yet.</p>
            ) : (
              emergingThemes.slice(0, 5).map((t) => <p key={t.node.id}>{t.node.label}</p>)
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border" data-testid="market-intelligence-priority-items">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4" /> Priority Items
            </CardTitle>
            <CardDescription>High impact AND relevant to something you watch or hold.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {priority.length === 0 ? (
              <p data-testid="market-intelligence-no-priority">Nothing currently flagged as priority.</p>
            ) : (
              priority.map((e) => <p key={e.id}>{e.headline}</p>)
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="market-intelligence-watchlist-intel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" /> Watchlist Intelligence
            </CardTitle>
            <CardDescription>Only intelligence relevant to symbols you're watching.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {watchlistIntel.length === 0 ? (
              <p data-testid="market-intelligence-no-watchlist-intel">No watchlist-relevant intelligence right now.</p>
            ) : (
              watchlistIntel.map((e) => <p key={e.id}>{e.headline}</p>)
            )}
          </CardContent>
        </Card>
      </div>

      <PortfolioIntegrationCard intelligence={intel.portfolioIntelligence} />

      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1">
            <Network className="h-4 w-4" /> All Intelligence
          </h2>
          <div className="flex flex-wrap gap-1" data-testid="market-intelligence-category-filter">
            <Button
              variant={categoryFilter === "all" ? "secondary" : "outline"}
              size="sm"
              className="h-6 text-xs"
              onClick={() => setCategoryFilter("all")}
              data-testid="market-intelligence-filter-all"
            >
              All
            </Button>
            {intel.categories.map((c) => (
              <Button
                key={c.category}
                variant={categoryFilter === c.category ? "secondary" : "outline"}
                size="sm"
                className="h-6 text-xs"
                disabled={!c.dataAvailable}
                title={c.dataAvailable ? undefined : (c.unavailableReason ?? undefined)}
                onClick={() => setCategoryFilter(c.category)}
                data-testid={`market-intelligence-filter-${c.category}`}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground" data-testid="market-intelligence-no-items">
                No intelligence items in this category right now.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="market-intelligence-item-list">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} expanded={expandedId === item.id} onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
