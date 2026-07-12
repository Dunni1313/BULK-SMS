import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetValueUniverse,
  useGetValueWatchlist,
  useAddValueWatchlist,
  useGetSettings,
  getGetValueWatchlistQueryKey,
  ValueSummary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Radar, Search, Star, GitCompare, ArrowUpDown } from "lucide-react";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type FilterKey =
  | "all"
  | "long_term"
  | "undervalued"
  | "pullback"
  | "options"
  | "both"
  | "avoid";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "long_term", label: "Best long-term stocks" },
  { key: "undervalued", label: "Undervalued" },
  { key: "pullback", label: "Wonderful business — wait for pullback" },
  { key: "options", label: "Good for options income" },
  { key: "both", label: "Good for both" },
  { key: "avoid", label: "Avoid / too risky" },
];

function matchesFilter(u: ValueSummary, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "long_term":
      return u.useCase === "Stock" || u.decision === "LONG-TERM BUY";
    case "undervalued":
      return u.marginOfSafety != null && u.marginOfSafety > 0;
    case "pullback":
      return u.decision === "BUY ONLY ON PULLBACK";
    case "options":
      return u.useCase === "Options";
    case "both":
      return u.useCase === "Both";
    case "avoid":
      return u.useCase === "Avoid" || u.decision === "AVOID";
  }
}

function useCaseColor(useCase: string): string {
  switch (useCase) {
    case "Stock":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
    case "Options":
      return "bg-indigo-500/15 text-indigo-400 border-indigo-500/40";
    case "Both":
      return "bg-sky-500/15 text-sky-400 border-sky-500/40";
    case "Watchlist":
      return "bg-amber-500/15 text-amber-400 border-amber-500/40";
    case "Avoid":
      return "bg-rose-500/15 text-rose-400 border-rose-500/40";
    default:
      return "bg-secondary text-foreground border-border";
  }
}

function ratingColor(rating: string): string {
  switch (rating) {
    case "Wonderful":
    case "Wide":
    case "Strong":
    case "Cheap":
      return "text-emerald-400";
    case "Good":
    case "Medium":
    case "Acceptable":
    case "Fair":
      return "text-sky-400";
    case "Average":
    case "Narrow":
    case "Weak":
    case "Expensive":
      return "text-amber-400";
    default:
      return "text-rose-400";
  }
}

function scoreTone(score: number): string {
  return score >= 75
    ? "text-emerald-400"
    : score >= 55
      ? "text-sky-400"
      : score >= 40
        ? "text-amber-400"
        : "text-rose-400";
}

function DataSourceBadge({ u }: { u: ValueSummary }) {
  // The honest data-source label. Valuation that can't be anchored shows
  // "Unavailable"; otherwise we surface the provider's LIVE/SIMULATED flag.
  if (u.valuationRating === "Unavailable") {
    return (
      <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-slate-500/15 text-slate-400 border-slate-500/30">
        Unavailable
      </Badge>
    );
  }
  return u.simulated ? (
    <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/30">
      Simulated
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-success/15 text-success border-success/30">
      Live
    </Badge>
  );
}

type SortKey = "stockInvestmentScore" | "optionsSuitabilityScore" | "marginOfSafety";

export default function StockScanner() {
  const { data: universe, isLoading } = useGetValueUniverse();
  const { data: watchlist } = useGetValueWatchlist();
  const { data: settings } = useGetSettings();
  const addWatchlist = useAddValueWatchlist();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const fundamentalsLive = settings?.fundamentalsConnected ?? false;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("stockInvestmentScore");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const watchedSymbols = useMemo(
    () => new Set((watchlist ?? []).map((w) => w.symbol)),
    [watchlist],
  );

  const rows = useMemo(() => {
    const filtered = (universe ?? []).filter((u) => matchesFilter(u, filter));
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (bv as number) - (av as number);
    });
  }, [universe, filter, sortKey]);

  const selectedRows = useMemo(
    () => (universe ?? []).filter((u) => selected.has(u.symbol)),
    [universe, selected],
  );

  const toggleSelect = (symbol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const handleAddWatchlist = (symbol: string) => {
    addWatchlist.mutate(
      { data: { symbol } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetValueWatchlistQueryKey() });
          toast({ title: `${symbol} added to watchlist` });
        },
        onError: () => toast({ title: "Failed to add to watchlist", variant: "destructive" }),
      },
    );
  };

  const handleResearch = (symbol: string) => {
    navigate(`/stock-analyst?symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radar className="w-6 h-6 text-indigo-400" /> Stock Scanner
            {fundamentalsLive ? (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-success/15 text-success border-success/30">
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/30">
                Simulated
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Scans and ranks the coverage universe for long-term investing — reusing the value-research,
            suitability, and fundamentals engines. Education &amp; advisory only; it never places trades.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={selected.size < 2}
          onClick={() => setCompareOpen(true)}
          className="h-9 gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
          data-testid="compare-button"
        >
          <GitCompare className="w-4 h-4" />
          Compare{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            data-testid={`filter-${f.key}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === f.key
                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                : "border-border bg-background/40 text-muted-foreground hover:border-indigo-500/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" /> Ranked Results
              </CardTitle>
              <CardDescription className="text-[11px]">
                {isLoading ? "Scanning…" : `${rows.length} of ${(universe ?? []).length} symbols`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
              {(
                [
                  ["stockInvestmentScore", "Stock score"],
                  ["optionsSuitabilityScore", "Options score"],
                  ["marginOfSafety", "Margin of safety"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`rounded px-2 py-0.5 ${
                    sortKey === key ? "bg-indigo-500/15 text-indigo-300" : "hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No stocks match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Business Quality</TableHead>
                    <TableHead>Moat</TableHead>
                    <TableHead>Fin. Strength</TableHead>
                    <TableHead>Valuation</TableHead>
                    <TableHead className="text-right">Margin of Safety</TableHead>
                    <TableHead className="text-right">Stock Score</TableHead>
                    <TableHead className="text-right">Options Score</TableHead>
                    <TableHead>Use Case</TableHead>
                    <TableHead>Suggested Action</TableHead>
                    <TableHead>Data Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.symbol} data-testid={`scanner-row-${u.symbol}`}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(u.symbol)}
                          onCheckedChange={() => toggleSelect(u.symbol)}
                          aria-label={`Select ${u.symbol}`}
                          data-testid={`select-${u.symbol}`}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">{u.symbol}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[160px] truncate">{u.name}</TableCell>
                      <TableCell className={ratingColor(u.businessQualityRating)}>
                        {u.businessQualityRating}
                        <span className="text-muted-foreground/60 ml-1 font-mono text-[10px]">
                          {Math.round(u.businessQualityScore)}
                        </span>
                      </TableCell>
                      <TableCell className={ratingColor(u.moatRating)}>{u.moatRating}</TableCell>
                      <TableCell className={ratingColor(u.financialStrength)}>{u.financialStrength}</TableCell>
                      <TableCell className={ratingColor(u.valuationRating)}>{u.valuationRating}</TableCell>
                      <TableCell className="text-right font-mono">
                        {u.marginOfSafety != null ? (
                          <span className={u.marginOfSafety > 0 ? "text-emerald-400" : "text-rose-400"}>
                            {(u.marginOfSafety * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${scoreTone(u.stockInvestmentScore)}`}>
                        {Math.round(u.stockInvestmentScore)}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${scoreTone(u.optionsSuitabilityScore)}`}>
                        {Math.round(u.optionsSuitabilityScore)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${useCaseColor(u.useCase)}`}>
                          {u.useCase}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{u.suggestedAction}</TableCell>
                      <TableCell>
                        <DataSourceBadge u={u} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => handleResearch(u.symbol)}
                            data-testid={`research-${u.symbol}`}
                          >
                            Research
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-indigo-400 disabled:opacity-40"
                            disabled={watchedSymbols.has(u.symbol) || addWatchlist.isPending}
                            onClick={() => handleAddWatchlist(u.symbol)}
                            title={watchedSymbols.has(u.symbol) ? "On watchlist" : "Add to watchlist"}
                            data-testid={`watchlist-${u.symbol}`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${watchedSymbols.has(u.symbol) ? "fill-indigo-400 text-indigo-400" : ""}`}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground/80 border-t border-border pt-3">
        All figures are {fundamentalsLive ? "live where labelled, otherwise " : ""}SIMULATED and deterministic.
        This scanner is for education and research only — it never executes, sizes, or recommends placing a trade.
      </p>

      {/* Compare dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-400" /> Compare {selectedRows.length} stocks
            </DialogTitle>
            <DialogDescription>
              Side-by-side of the deterministic engine output. SIMULATED / advisory only.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Metric</TableHead>
                  {selectedRows.map((u) => (
                    <TableHead key={u.symbol} className="text-right font-semibold text-foreground">
                      {u.symbol}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ["Company", (u: ValueSummary) => u.name],
                    ["Price", (u: ValueSummary) => fmtUsd(u.price)],
                    ["Business Quality", (u: ValueSummary) => `${u.businessQualityRating} (${Math.round(u.businessQualityScore)})`],
                    ["Moat", (u: ValueSummary) => u.moatRating],
                    ["Financial Strength", (u: ValueSummary) => u.financialStrength],
                    ["Valuation", (u: ValueSummary) => u.valuationRating],
                    ["Margin of Safety", (u: ValueSummary) => (u.marginOfSafety != null ? `${(u.marginOfSafety * 100).toFixed(1)}%` : "—")],
                    ["Stock Score", (u: ValueSummary) => String(Math.round(u.stockInvestmentScore))],
                    ["Options Score", (u: ValueSummary) => String(Math.round(u.optionsSuitabilityScore))],
                    ["Use Case", (u: ValueSummary) => u.useCase],
                    ["Suggested Action", (u: ValueSummary) => u.suggestedAction],
                    ["Decision", (u: ValueSummary) => u.decision],
                  ] as [string, (u: ValueSummary) => string][]
                ).map(([label, get]) => (
                  <TableRow key={label}>
                    <TableCell className="text-muted-foreground">{label}</TableCell>
                    {selectedRows.map((u) => (
                      <TableCell key={u.symbol} className="text-right text-foreground/90">
                        {get(u)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
