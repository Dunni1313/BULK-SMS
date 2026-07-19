// Phase 15 — Institutional Opportunity Discovery Engine. Advisory/education
// only — this page never previews, schedules, or submits any order, and
// never touches a real brokerage account (same discipline as Stock Research
// and the Institutional Decision Engine).
//
// Pure composition, zero new scoring on this page — every number/label
// rendered here comes straight from POST /opportunity-discovery/scan
// (lib/opportunityDiscovery.ts), which itself only reuses Business Quality/
// Investment Quality/Competitive Advantage/Financial Strength/Valuation/
// Margin of Safety/Investment Committee/Tom Nash/the Decision Engine's own
// synthesis score — already-shipped engines, never recomputed here.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useScanOpportunities,
  useCompareOpportunitiesRoute,
  useGetSavedScreens,
  useCreateSavedScreen,
  useDeleteSavedScreen,
  useAddValueWatchlist,
  useGetPortfolios,
} from "@workspace/api-client-react";
import type { OpportunityRow, OpportunityScreenerFilters, OpportunityBucket } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Telescope, Search, Plus, Trash2, X } from "lucide-react";

function recommendationBadgeClass(rec: string): string {
  if (rec === "Buy" || rec === "Accumulate") return "border-emerald-500/40 text-emerald-400";
  if (rec === "Hold") return "border-border text-muted-foreground";
  if (rec === "Reduce") return "border-amber-500/40 text-amber-400";
  return "border-rose-500/40 text-rose-400"; // Sell, Avoid
}

const fmtPct = (n: number | null) => (n == null ? "n/a" : `${(n * 100).toFixed(1)}%`);
const fmtScore = (n: number | null) => (n == null ? "n/a" : `${n}/100`);

interface FiltersState {
  sector: string;
  minRoic: string;
  minRevenueGrowth: string;
  minDividendYield: string;
  minMarginOfSafety: string;
  minBusinessQualityScore: string;
}

const EMPTY_FILTERS: FiltersState = {
  sector: "",
  minRoic: "",
  minRevenueGrowth: "",
  minDividendYield: "",
  minMarginOfSafety: "",
  minBusinessQualityScore: "",
};

function toApiFilters(f: FiltersState): OpportunityScreenerFilters {
  const out: OpportunityScreenerFilters = {};
  if (f.sector.trim()) out.sector = f.sector.trim();
  if (f.minRoic.trim()) out.minRoic = Number(f.minRoic) / 100;
  if (f.minRevenueGrowth.trim()) out.minRevenueGrowth = Number(f.minRevenueGrowth) / 100;
  if (f.minDividendYield.trim()) out.minDividendYield = Number(f.minDividendYield) / 100;
  if (f.minMarginOfSafety.trim()) out.minMarginOfSafety = Number(f.minMarginOfSafety) / 100;
  if (f.minBusinessQualityScore.trim()) out.minBusinessQualityScore = Number(f.minBusinessQualityScore);
  return out;
}

function OpportunityRowActions({ row }: { row: OpportunityRow }) {
  const { toast } = useToast();
  const addWatchlist = useAddValueWatchlist();
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/decision-engine?symbol=${row.symbol}`}>
        <Button size="sm" variant="outline" data-testid={`button-analyse-${row.symbol}`}>
          Analyse
        </Button>
      </Link>
      <Button
        size="sm"
        variant="outline"
        data-testid={`button-add-watchlist-${row.symbol}`}
        onClick={() =>
          addWatchlist.mutate(
            { data: { symbol: row.symbol } },
            {
              onSuccess: () => toast({ title: `${row.symbol} added to Watchlist` }),
              onError: () => toast({ title: `Could not add ${row.symbol} to Watchlist`, variant: "destructive" }),
            },
          )
        }
      >
        <Plus className="mr-1 h-3 w-3" /> Watchlist
      </Button>
    </div>
  );
}

function OpportunityRowTable({ rows }: { rows: OpportunityRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="text-no-opportunities">No opportunities match the current criteria.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="p-2">Symbol</th>
            <th className="p-2">Recommendation</th>
            <th className="p-2">Synthesis Score</th>
            <th className="p-2">Business Quality</th>
            <th className="p-2">Margin of Safety</th>
            <th className="p-2">Moat</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50" data-testid={`row-opportunity-${r.symbol}`}>
              <td className="p-2 font-medium">{r.symbol}</td>
              <td className="p-2">
                <Badge variant="outline" className={recommendationBadgeClass(r.decisionRecommendation)}>
                  {r.decisionRecommendation}
                </Badge>
              </td>
              <td className="p-2">{fmtScore(r.rankScore)}</td>
              <td className="p-2">{fmtScore(r.businessQualityScore)}</td>
              <td className="p-2">{fmtPct(r.marginOfSafety)}</td>
              <td className="p-2">{r.moatRating}</td>
              <td className="p-2">
                <OpportunityRowActions row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BucketCard({ bucket }: { bucket: OpportunityBucket }) {
  return (
    <Card data-testid={`card-bucket-${bucket.category}`}>
      <CardHeader>
        <CardTitle className="text-base">{bucket.label}</CardTitle>
        <CardDescription>{bucket.rule}</CardDescription>
      </CardHeader>
      <CardContent>
        <OpportunityRowTable rows={bucket.rows.slice(0, 5)} />
      </CardContent>
    </Card>
  );
}

export default function OpportunityDiscovery() {
  const { toast } = useToast();
  const [symbolsInput, setSymbolsInput] = useState("");
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [watchlistAware, setWatchlistAware] = useState(false);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [savedScreenName, setSavedScreenName] = useState("");

  const scan = useScanOpportunities();
  const { data: portfolios } = useGetPortfolios();
  const { data: savedScreens, refetch: refetchSavedScreens } = useGetSavedScreens();
  const createSavedScreen = useCreateSavedScreen();
  const deleteSavedScreen = useDeleteSavedScreen();

  function runScan() {
    const symbols = symbolsInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    scan.mutate({
      data: {
        symbols: symbols.length > 0 ? symbols : undefined,
        filters: toApiFilters(filters),
        watchlistAware,
        portfolioId: portfolioId ?? undefined,
      },
    });
  }

  const compareQuery = useQuery({
    queryKey: ["opportunity-discovery-compare", compareSymbols],
    queryFn: async () => {
      const res = await fetch(`/api/opportunity-discovery/compare?symbols=${encodeURIComponent(compareSymbols.join(","))}`);
      if (!res.ok) throw new Error("Comparison failed");
      return res.json();
    },
    enabled: compareSymbols.length >= 2,
  });

  const result = scan.data;
  const ranked = useMemo(() => result?.rows ?? [], [result]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Telescope className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Institutional Opportunity Discovery</h1>
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge variant="outline" data-testid="badge-label-educational">Educational</Badge>
          <Badge variant="outline" data-testid="badge-label-deterministic">Deterministic</Badge>
          <Badge variant="outline" data-testid="badge-label-evidence-based">Evidence Based</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Scans the Investing Engine's known-symbol universe and ranks opportunities using the existing Business
          Quality, Competitive Advantage, Valuation, Margin of Safety, Investment Committee, and Tom Nash
          engines — pure orchestration, no new scoring, no price forecasting.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Screener</CardTitle>
          <CardDescription>
            Leave the symbol list empty to scan the full universe. Country is intentionally not filterable — no
            provider (simulated or live) supplies a company's country anywhere in this codebase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            data-testid="input-symbols"
            placeholder="Optional: comma-separated symbols (e.g. AAPL, MSFT)"
            value={symbolsInput}
            onChange={(e) => setSymbolsInput(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Input data-testid="input-sector" placeholder="Sector" value={filters.sector} onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))} />
            <Input data-testid="input-min-roic" placeholder="Min ROIC %" value={filters.minRoic} onChange={(e) => setFilters((f) => ({ ...f, minRoic: e.target.value }))} />
            <Input data-testid="input-min-revenue-growth" placeholder="Min Rev Growth %" value={filters.minRevenueGrowth} onChange={(e) => setFilters((f) => ({ ...f, minRevenueGrowth: e.target.value }))} />
            <Input data-testid="input-min-dividend-yield" placeholder="Min Dividend Yield %" value={filters.minDividendYield} onChange={(e) => setFilters((f) => ({ ...f, minDividendYield: e.target.value }))} />
            <Input data-testid="input-min-margin-of-safety" placeholder="Min Margin of Safety %" value={filters.minMarginOfSafety} onChange={(e) => setFilters((f) => ({ ...f, minMarginOfSafety: e.target.value }))} />
            <Input data-testid="input-min-business-quality" placeholder="Min Business Quality" value={filters.minBusinessQualityScore} onChange={(e) => setFilters((f) => ({ ...f, minBusinessQualityScore: e.target.value }))} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="checkbox-watchlist-aware"
                checked={watchlistAware}
                onChange={(e) => setWatchlistAware(e.target.checked)}
              />
              Watchlist-aware (populate Watchlist Candidates)
            </label>
            <select
              data-testid="select-portfolio"
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={portfolioId ?? ""}
              onChange={(e) => setPortfolioId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No portfolio (Portfolio Upgrade Candidates unavailable)</option>
              {(portfolios ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {portfolioId && (
              <Link
                href={`/stock-analyst/portfolio-optimisation?portfolioId=${portfolioId}`}
                className="text-xs text-primary hover:underline self-center"
                data-testid="link-portfolio-optimisation"
              >
                Review Portfolio Optimisation →
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-run-scan" onClick={runScan} disabled={scan.isPending}>
              <Search className="mr-2 h-4 w-4" />
              {scan.isPending ? "Scanning…" : "Run Scan"}
            </Button>
            <Input
              data-testid="input-save-screen-name"
              placeholder="Save this screen as…"
              value={savedScreenName}
              onChange={(e) => setSavedScreenName(e.target.value)}
              className="max-w-[220px]"
            />
            <Button
              data-testid="button-save-screen"
              variant="outline"
              disabled={!savedScreenName.trim()}
              onClick={() =>
                createSavedScreen.mutate(
                  { data: { name: savedScreenName.trim(), filters: toApiFilters(filters) } },
                  {
                    onSuccess: () => {
                      toast({ title: "Screen saved" });
                      setSavedScreenName("");
                      refetchSavedScreens();
                    },
                  },
                )
              }
            >
              Save Screen
            </Button>
          </div>
          {scan.isError && <p className="text-sm text-destructive" data-testid="text-scan-error">Scan failed — please try again.</p>}
          {result && result.unavailableFilters.length > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-unavailable-filters">
              Not applied (no backing data): {result.unavailableFilters.join(", ")}.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="opportunities">
        <TabsList>
          <TabsTrigger value="opportunities" data-testid="tab-opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="rankings" data-testid="tab-rankings">Top Rankings</TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">Comparison View</TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved-screens">Saved Screens</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          {!result && <p className="text-sm text-muted-foreground">Run a scan to see opportunity buckets.</p>}
          {result && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {result.buckets.map((b) => (
                <BucketCard key={b.category} bucket={b} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rankings" className="space-y-4">
          {!result && <p className="text-sm text-muted-foreground">Run a scan to see ranked opportunities.</p>}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Ranked by Decision Engine Synthesis Score</CardTitle>
                <CardDescription>
                  {result.rows.length} of {result.totalBeforeFilter} scanned symbols match the current filters.
                  {result.unresolvedSymbols.length > 0 && ` ${result.unresolvedSymbols.length} symbol(s) could not be resolved.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {ranked.map((r) => (
                  <label key={r.symbol} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-testid={`checkbox-compare-${r.symbol}`}
                      checked={compareSymbols.includes(r.symbol)}
                      onChange={(e) =>
                        setCompareSymbols((cur) =>
                          e.target.checked ? [...cur, r.symbol] : cur.filter((s) => s !== r.symbol),
                        )
                      }
                    />
                    Compare {r.symbol}
                  </label>
                ))}
                <OpportunityRowTable rows={ranked} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {compareSymbols.map((s) => (
              <Badge key={s} variant="outline" className="flex items-center gap-1">
                {s}
                <button data-testid={`button-remove-compare-${s}`} onClick={() => setCompareSymbols((cur) => cur.filter((x) => x !== s))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {compareSymbols.length < 2 && (
            <p className="text-sm text-muted-foreground" data-testid="text-compare-instructions">
              Select at least 2 symbols from Top Rankings to compare them side by side.
            </p>
          )}
          {compareQuery.data && (
            <Card>
              <CardHeader>
                <CardTitle>Side-by-Side Comparison</CardTitle>
                <CardDescription>Highlights the best already-computed value per dimension — never a new score.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <OpportunityRowTable rows={compareQuery.data.rows} />
                <div className="space-y-1 text-sm">
                  {Object.entries(compareQuery.data.bestBy as Record<string, string>).map(([dimension, symbol]) => (
                    <div key={dimension} data-testid={`text-best-${dimension.replace(/\s+/g, "-").toLowerCase()}`}>
                      Best {dimension}: <span className="font-medium">{symbol}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-2">
          {(!savedScreens || savedScreens.length === 0) && (
            <p className="text-sm text-muted-foreground" data-testid="text-no-saved-screens">No saved screens yet.</p>
          )}
          {(savedScreens ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3" data-testid={`row-saved-screen-${s.id}`}>
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{JSON.stringify(s.filters)}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`button-apply-screen-${s.id}`}
                  onClick={() => {
                    const applied = s.filters as OpportunityScreenerFilters;
                    setFilters({
                      sector: applied.sector ?? "",
                      minRoic: applied.minRoic != null ? String(applied.minRoic * 100) : "",
                      minRevenueGrowth: applied.minRevenueGrowth != null ? String(applied.minRevenueGrowth * 100) : "",
                      minDividendYield: applied.minDividendYield != null ? String(applied.minDividendYield * 100) : "",
                      minMarginOfSafety: applied.minMarginOfSafety != null ? String(applied.minMarginOfSafety * 100) : "",
                      minBusinessQualityScore: applied.minBusinessQualityScore != null ? String(applied.minBusinessQualityScore) : "",
                    });
                  }}
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid={`button-delete-screen-${s.id}`}
                  onClick={() => deleteSavedScreen.mutate({ id: s.id }, { onSuccess: () => refetchSavedScreens() })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
