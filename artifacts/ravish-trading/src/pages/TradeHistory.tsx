// Trade History, Performance Analytics & Trading Journal sprint. A
// dedicated historical-trade review page over the existing, unmodified
// GET /trades endpoint (up to 500 rows fetched once, sorted/filtered/
// searched/paginated client-side — this platform's own realistic Paper
// Trading volume comfortably fits one call; a future sprint can add real
// server-side pagination if trade volume ever outgrows this). Each row
// expands to show its own linked Trading Journal entries (editable via the
// existing, unmodified PATCH /journal/:id) and a broker reconciliation
// cross-reference, reusing GET /broker/reconciliation exactly as it already
// exists — no new broker endpoint of any kind.
//
// Broker reconciliation stays entirely manual/user-initiated (a "Check
// Reconciliation" button) — it never fetches automatically, matching the
// same discipline every other broker-touching page in this app already
// follows. Trade/journal data (purely local, never broker-derived) fetches
// on page load like every other list page in this app.

import { useMemo, useState } from "react";
import {
  useListTrades,
  useListJournalEntries,
  useUpdateJournalEntry,
  getListJournalEntriesQueryKey,
  useGetBrokerReconciliation,
  getGetBrokerReconciliationQueryKey,
  type Trade,
  type JournalEntry,
  type OrderReconciliationEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import {
  tradeDirection,
  derivedExitPrice,
  holdingPeriodDays,
  isMockOrderId,
  tradeSpreadQuantity,
} from "@/lib/tradeAnalytics";

const PAGE_SIZE = 10;

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

type SortField = "date" | "symbol" | "pnl";
type SortDir = "asc" | "desc";

export default function TradeHistory() {
  const { data: trades, isLoading: tradesLoading, isError: tradesError } = useListTrades({ limit: 500 });
  const { data: journalEntries } = useListJournalEntries();

  const {
    data: reconciliation,
    isFetching: reconciliationFetching,
    refetch: refetchReconciliation,
  } = useGetBrokerReconciliation({ query: { queryKey: getGetBrokerReconciliationQueryKey(), enabled: false } });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredSorted = useMemo(() => {
    if (!trades) return [];
    const filtered = trades.filter((t) => {
      if (search && !t.symbol.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (strategyFilter !== "all" && t.strategy !== strategyFilter) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = new Date(a.openDate).getTime() - new Date(b.openDate).getTime();
      else if (sortField === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else if (sortField === "pnl") cmp = (a.currentPnl ?? 0) - (b.currentPnl ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [trades, search, statusFilter, strategyFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageTrades = filteredSorted.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  const journalByTrade = useMemo(() => {
    const map = new Map<number, JournalEntry[]>();
    for (const e of journalEntries ?? []) {
      if (e.tradeId === null || e.tradeId === undefined) continue;
      const list = map.get(e.tradeId) ?? [];
      list.push(e);
      map.set(e.tradeId, list);
    }
    return map;
  }, [journalEntries]);

  function reconciliationFor(trade: Trade): { label: string; entry: OrderReconciliationEntry | null } {
    // A mock-originated order was never actually sent to Alpaca — this is
    // already known from the trade's own local data, independent of
    // whether a reconciliation check has ever been run.
    if (isMockOrderId(trade.alpacaOrderId)) return { label: "Simulated (no broker order)", entry: null };
    if (!reconciliation || !reconciliation.available) return { label: "Not yet checked", entry: null };
    const entry = reconciliation.orders.find((o) => o.tradeId === trade.id);
    if (!entry) return { label: "Not compared", entry: null };
    return { label: entry.issues.length === 0 ? "Matched" : "Mismatch", entry };
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Trade History</h1>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-paper-trading-mode">
            Paper Trading Mode
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetchReconciliation()}
          disabled={reconciliationFetching}
          data-testid="button-check-reconciliation"
        >
          {reconciliationFetching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" /> Check Reconciliation
            </>
          )}
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Search Symbol</label>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="e.g. AAPL"
              className="bg-background w-40"
              data-testid="input-search-symbol"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="bg-background w-36" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Strategy</label>
            <Select
              value={strategyFilter}
              onValueChange={(v) => {
                setStrategyFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="bg-background w-40" data-testid="select-strategy-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strategies</SelectItem>
                <SelectItem value="iron_condor">Iron Condor</SelectItem>
                <SelectItem value="iron_fly">Iron Fly</SelectItem>
                <SelectItem value="calendar_spread">Calendar Spread</SelectItem>
                <SelectItem value="earnings">Earnings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Sort By</label>
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="bg-background w-32" data-testid="select-sort-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="symbol">Symbol</SelectItem>
                <SelectItem value="pnl">P/L</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            data-testid="button-toggle-sort-direction"
          >
            {sortDir === "asc" ? "Ascending" : "Descending"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          {tradesLoading ? (
            <div className="space-y-2" data-testid="trade-history-loading">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : tradesError ? (
            <p className="text-sm text-destructive" data-testid="text-trade-history-error">
              Could not load trade history. Try again in a moment.
            </p>
          ) : filteredSorted.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-trades">
              {trades && trades.length > 0 ? "No trades match the current filters." : "No trades yet."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Exit Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reconciliation</TableHead>
                    <TableHead>Holding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTrades.map((t) => {
                    const recon = reconciliationFor(t);
                    const expanded = expandedId === t.id;
                    return (
                      <>
                        <TableRow key={t.id} data-testid={`row-trade-${t.id}`}>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedId(expanded ? null : t.id)}
                              data-testid={`button-expand-trade-${t.id}`}
                            >
                              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{fmtDate(t.openDate)}</TableCell>
                          <TableCell className="font-mono font-medium">{t.symbol}</TableCell>
                          <TableCell className="text-xs">{t.strategy.replace(/_/g, " ")}</TableCell>
                          <TableCell data-testid={`text-direction-${t.id}`}>{tradeDirection(t)}</TableCell>
                          <TableCell className="font-mono">{tradeSpreadQuantity(t) ?? "—"}</TableCell>
                          <TableCell className="font-mono">{fmtCurrency(t.credit)}</TableCell>
                          <TableCell className="font-mono" data-testid={`text-exit-price-${t.id}`}>
                            {fmtCurrency(derivedExitPrice(t))}
                          </TableCell>
                          <TableCell>
                            <Badge className="text-[10px]" variant="outline">
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                recon.label === "Matched"
                                  ? "bg-success/15 text-success border-success/30 text-[10px]"
                                  : recon.label === "Mismatch"
                                    ? "bg-destructive/15 text-destructive border-destructive/30 text-[10px]"
                                    : "bg-muted text-muted-foreground border-border text-[10px]"
                              }
                              data-testid={`badge-reconciliation-${t.id}`}
                            >
                              {recon.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{holdingPeriodDays(t).toFixed(1)}d</TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow>
                            <TableCell colSpan={11} className="bg-background">
                              <TradeDetailPanel
                                trade={t}
                                journalEntries={journalByTrade.get(t.id) ?? []}
                                reconciliationEntry={recon.entry}
                                reconciliationCheckedAt={reconciliation?.generatedAt ?? null}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground" data-testid="text-page-indicator">
                  Page {pageSafe + 1} of {totalPages} ({filteredSorted.length} trade{filteredSorted.length === 1 ? "" : "s"})
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={pageSafe === 0}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={pageSafe >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface TradeDetailPanelProps {
  trade: Trade;
  journalEntries: JournalEntry[];
  reconciliationEntry: OrderReconciliationEntry | null;
  reconciliationCheckedAt: string | null;
}

function TradeDetailPanel({ trade, journalEntries, reconciliationEntry, reconciliationCheckedAt }: TradeDetailPanelProps) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-1">Identifiers</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Local Trade ID: </span>
            <span className="font-mono" data-testid={`text-local-trade-id-${trade.id}`}>
              {trade.id}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Broker Order ID: </span>
            <span className="font-mono" data-testid={`text-broker-order-id-${trade.id}`}>
              {trade.alpacaOrderId
                ? isMockOrderId(trade.alpacaOrderId)
                  ? "Simulated (no broker order)"
                  : trade.alpacaOrderId
                : "—"}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-1">Broker Reconciliation</div>
        {!reconciliationEntry ? (
          <p className="text-xs text-muted-foreground" data-testid={`text-reconciliation-detail-${trade.id}`}>
            {reconciliationCheckedAt
              ? "No broker order comparison available for this trade."
              : "Not yet checked — click Check Reconciliation above."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs" data-testid={`text-reconciliation-detail-${trade.id}`}>
            <div>
              <span className="text-muted-foreground">Local Status: </span>
              {reconciliationEntry.localStatus ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Broker Status: </span>
              {reconciliationEntry.brokerStatus ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Fill Quantity: </span>
              {reconciliationEntry.filledQuantity ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Avg Fill Price: </span>
              {fmtCurrency(reconciliationEntry.averageFillPrice)}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Mismatches: </span>
              {reconciliationEntry.issues.length === 0 ? "None" : reconciliationEntry.issues.join(", ")}
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">
          Last reconciliation run: {reconciliationCheckedAt ? fmtDate(reconciliationCheckedAt) : "Never"}
        </p>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-1">Trading Journal</div>
        {journalEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid={`text-no-journal-${trade.id}`}>
            No journal entries linked to this trade.
          </p>
        ) : (
          <div className="space-y-3">
            {journalEntries.map((entry) => (
              <JournalEntryEditor key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-1">AI Review</div>
        <p className="text-xs text-muted-foreground italic" data-testid={`text-ai-review-placeholder-${trade.id}`}>
          AI-generated trade review is not available yet — coming in a future sprint.
        </p>
      </div>
    </div>
  );
}

function JournalEntryEditor({ entry }: { entry: JournalEntry }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateEntry = useUpdateJournalEntry();

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(entry.content);
  const [thesis, setThesis] = useState(entry.thesis ?? "");
  const [entryReasoning, setEntryReasoning] = useState(entry.entryReasoning ?? "");
  const [lessonLearned, setLessonLearned] = useState(entry.lessonLearned ?? "");

  function handleSave() {
    updateEntry.mutate(
      { id: entry.id, data: { content, thesis, entryReasoning, lessonLearned } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
          toast({ title: "Journal entry updated" });
          setEditing(false);
        },
        onError: () => {
          toast({ title: "Failed to update journal entry", variant: "destructive" });
        },
      },
    );
  }

  if (!editing) {
    return (
      <div className="p-3 border border-border rounded bg-card space-y-1" data-testid={`journal-entry-${entry.id}`}>
        <div className="text-xs font-medium">{entry.title}</div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold">Notes: </span>
          {entry.content}
        </div>
        {entry.thesis && (
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold">Thesis: </span>
            {entry.thesis}
          </div>
        )}
        {entry.entryReasoning && (
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold">Entry Reasoning: </span>
            {entry.entryReasoning}
          </div>
        )}
        {entry.exitReason && (
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold">Exit Reasoning: </span>
            {entry.exitReason}
          </div>
        )}
        {entry.lessonLearned && (
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold">Lessons Learned: </span>
            {entry.lessonLearned}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1"
          onClick={() => setEditing(true)}
          data-testid={`button-edit-journal-${entry.id}`}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 border border-border rounded bg-card space-y-2" data-testid={`journal-entry-editor-${entry.id}`}>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="bg-background text-xs"
          data-testid={`textarea-journal-content-${entry.id}`}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Thesis</label>
        <Textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          className="bg-background text-xs"
          data-testid={`textarea-journal-thesis-${entry.id}`}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Entry Reasoning</label>
        <Textarea
          value={entryReasoning}
          onChange={(e) => setEntryReasoning(e.target.value)}
          className="bg-background text-xs"
          data-testid={`textarea-journal-entry-reasoning-${entry.id}`}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Lessons Learned</label>
        <Textarea
          value={lessonLearned}
          onChange={(e) => setLessonLearned(e.target.value)}
          className="bg-background text-xs"
          data-testid={`textarea-journal-lesson-${entry.id}`}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={updateEntry.isPending}
          data-testid={`button-save-journal-${entry.id}`}
        >
          {updateEntry.isPending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} data-testid={`button-cancel-journal-${entry.id}`}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
