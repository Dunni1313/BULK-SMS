// Phase 3, Sprint 46 - Institutional Trading Engine, Trading Journal
// Frontend UI (approved Phase 3 plan section 16; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 46 as-built note).
// This closes the final outstanding item in the Route+UI backlog first
// disclosed in Sprint 40 (Structure/Multi-Timeframe/Regime/Probability/
// Risk/Liquidity all shipped their own Route+UI across Sprints 40-45).
//
// Reuses Sprint 39's own backend CRUD (routes/tradingJournal.ts) exactly,
// unmodified - GET/POST /trading/journal, GET/PATCH/DELETE
// /trading/journal/:id - via the already-generated
// useListTradingJournalEntries/useCreateTradingJournalEntry/
// useGetTradingJournalEntry/useUpdateTradingJournalEntry/
// useDeleteTradingJournalEntry hooks (Orval codegen from Sprint 39's own
// openapi.yaml addition; no schema or route change this sprint). Per
// section 16's own design note, this page adapts (not rewrites from
// scratch) Journal.tsx's established list/detail/mood-tag/new-entry-form
// pattern for trading_journal_entries' own field set (setupType/
// entryPrice/exitPrice/rMultiple/tradingPositionId in place of the
// options-specific strategy/entryCredit/maxProfit/pop/ev/ravishScore
// fields Journal.tsx shows). Unlike the options-side page (which has no
// update/delete route to build on), this page exposes full CRUD - basic
// edit and delete - since Sprint 39 shipped all four verbs.
//
// The optional "Related Position" field reuses Sprint 44's own
// useListTradingPositions() (already shipped, zero new logic) to let a
// user associate an entry with one of their own trading_positions rows by
// symbol, mirroring the backend's own loose, unenforced
// tradingPositionId reference (same precedent as journal_entries.trade_id).
//
// No SIMULATED labelling on this page: trading journal entries are
// user-authored text and user-entered prices/notes, never derived from
// SIMULATED market data (matching Sprint 39's own route-header
// disclosure) - unlike TradingResearch.tsx's cards, there is no
// dataSource field here to honestly label.
//
// No backend changes this sprint - the existing Sprint 39 API is reused
// exactly, per the explicit "do not modify the backend unless a genuine
// defect is discovered" instruction. None was discovered.

import { useState } from "react";
import {
  useListTradingJournalEntries,
  getListTradingJournalEntriesQueryKey,
  useCreateTradingJournalEntry,
  useUpdateTradingJournalEntry,
  useDeleteTradingJournalEntry,
  useListTradingPositions,
  TradingJournalEntryInputMood,
  type TradingJournalEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { NotebookPen, Pencil, Trash2, X, ExternalLink } from "lucide-react";

function moodBadgeClass(mood: string): string {
  switch (mood) {
    case "confident":
      return "border-emerald-500/40 text-emerald-400";
    case "cautious":
      return "border-amber-500/40 text-amber-400";
    case "frustrated":
      return "border-rose-500/40 text-rose-400";
    case "excited":
      return "border-primary/40 text-primary";
    default:
      return "border-border text-muted-foreground";
  }
}

interface EntryFormState {
  title: string;
  content: string;
  mood: TradingJournalEntryInputMood;
  lessonLearned: string;
  setupType: string;
  entryPrice: string;
  exitPrice: string;
  rMultiple: string;
  tradingPositionId: string;
}

const EMPTY_FORM: EntryFormState = {
  title: "",
  content: "",
  mood: "neutral",
  lessonLearned: "",
  setupType: "",
  entryPrice: "",
  exitPrice: "",
  rMultiple: "",
  tradingPositionId: "",
};

function toEntryPayload(form: EntryFormState) {
  return {
    title: form.title,
    content: form.content,
    mood: form.mood,
    lessonLearned: form.lessonLearned || undefined,
    setupType: form.setupType || undefined,
    entryPrice: form.entryPrice ? Number(form.entryPrice) : undefined,
    exitPrice: form.exitPrice ? Number(form.exitPrice) : undefined,
    rMultiple: form.rMultiple ? Number(form.rMultiple) : undefined,
    tradingPositionId: form.tradingPositionId ? Number(form.tradingPositionId) : undefined,
  };
}

function EntryFields({
  form,
  onChange,
  positions,
}: {
  form: EntryFormState;
  onChange: (next: EntryFormState) => void;
  positions: { id: number; symbol: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs uppercase text-muted-foreground">Title</label>
        <Input
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          required
          placeholder="E.g. AAPL breakout follow-through"
          data-testid="input-journal-title"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase text-muted-foreground">Mood</label>
        <Select value={form.mood} onValueChange={(v: TradingJournalEntryInputMood) => onChange({ ...form, mood: v })}>
          <SelectTrigger data-testid="select-journal-mood">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confident">Confident</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="cautious">Cautious</SelectItem>
            <SelectItem value="frustrated">Frustrated</SelectItem>
            <SelectItem value="excited">Excited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase text-muted-foreground">Notes</label>
        <Textarea
          value={form.content}
          onChange={(e) => onChange({ ...form, content: e.target.value })}
          required
          className="min-h-[120px]"
          placeholder="What happened? Why did you enter/exit?"
          data-testid="input-journal-content"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase text-muted-foreground">Lesson Learned (optional)</label>
        <Input
          value={form.lessonLearned}
          onChange={(e) => onChange({ ...form, lessonLearned: e.target.value })}
          data-testid="input-journal-lesson"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase text-muted-foreground">Related Position (optional)</label>
        <Select
          value={form.tradingPositionId || "none"}
          onValueChange={(v: string) => onChange({ ...form, tradingPositionId: v === "none" ? "" : v })}
        >
          <SelectTrigger data-testid="select-journal-position">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <label className="text-xs uppercase text-muted-foreground">Setup</label>
          <Input
            value={form.setupType}
            onChange={(e) => onChange({ ...form, setupType: e.target.value })}
            placeholder="Breakout"
            data-testid="input-journal-setup-type"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase text-muted-foreground">Entry Price</label>
          <Input
            type="number"
            value={form.entryPrice}
            onChange={(e) => onChange({ ...form, entryPrice: e.target.value })}
            data-testid="input-journal-entry-price"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase text-muted-foreground">Exit Price</label>
          <Input
            type="number"
            value={form.exitPrice}
            onChange={(e) => onChange({ ...form, exitPrice: e.target.value })}
            data-testid="input-journal-exit-price"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase text-muted-foreground">R-Multiple (optional)</label>
        <Input
          type="number"
          value={form.rMultiple}
          onChange={(e) => onChange({ ...form, rMultiple: e.target.value })}
          data-testid="input-journal-r-multiple"
        />
      </div>
    </div>
  );
}

export default function TradingJournal() {
  const { data: entries, isLoading, isError } = useListTradingJournalEntries({
    query: { queryKey: getListTradingJournalEntriesQueryKey() },
  });
  const { data: positions } = useListTradingPositions();
  const createEntry = useCreateTradingJournalEntry();
  const updateEntry = useUpdateTradingJournalEntry();
  const deleteEntry = useDeleteTradingJournalEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<EntryFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EntryFormState>(EMPTY_FORM);

  const positionOptions = (positions ?? []).map((p) => ({ id: p.id, symbol: p.symbol }));

  function invalidateEntries() {
    queryClient.invalidateQueries({ queryKey: getListTradingJournalEntriesQueryKey() });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.content) return;

    createEntry.mutate(
      { data: toEntryPayload(form) },
      {
        onSuccess: () => {
          invalidateEntries();
          setForm(EMPTY_FORM);
          toast({ title: "Journal entry added" });
        },
        onError: () => {
          toast({ title: "Failed to add entry", variant: "destructive" });
        },
      },
    );
  }

  function startEdit(entry: TradingJournalEntry) {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      content: entry.content,
      mood: entry.mood,
      lessonLearned: entry.lessonLearned ?? "",
      setupType: entry.setupType ?? "",
      entryPrice: entry.entryPrice != null ? String(entry.entryPrice) : "",
      exitPrice: entry.exitPrice != null ? String(entry.exitPrice) : "",
      rMultiple: entry.rMultiple != null ? String(entry.rMultiple) : "",
      tradingPositionId: entry.tradingPositionId != null ? String(entry.tradingPositionId) : "",
    });
  }

  function handleUpdate(e: React.FormEvent, id: number) {
    e.preventDefault();
    if (!editForm.title || !editForm.content) return;

    updateEntry.mutate(
      { id, data: toEntryPayload(editForm) },
      {
        onSuccess: () => {
          invalidateEntries();
          setEditingId(null);
          toast({ title: "Journal entry updated" });
        },
        onError: () => {
          toast({ title: "Failed to update entry", variant: "destructive" });
        },
      },
    );
  }

  function handleDelete(id: number) {
    deleteEntry.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateEntries();
          toast({ title: "Journal entry deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete entry", variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 pb-12 md:grid-cols-3" data-testid="page-trading-journal">
      <div className="space-y-6 md:col-span-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <NotebookPen className="h-6 w-6" />
            Trading Journal
          </h1>
          <p className="text-sm text-muted-foreground">
            Institutional Trading Engine (Engine 2) — reflections on your own trading positions. Never places an order.
          </p>
          <a
            href="/market-structure-workbench"
            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid="link-open-market-structure-workbench"
          >
            <ExternalLink className="h-3 w-3" /> Review structure in the Market Structure Workbench
          </a>
          <a
            href="/liquidity-workbench"
            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid="link-open-liquidity-workbench"
          >
            <ExternalLink className="h-3 w-3" /> Review liquidity &amp; sessions in the Liquidity &amp; Session Workbench
          </a>
          <a
            href="/trade-planning-studio"
            className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid="link-open-trade-planning-studio"
          >
            <ExternalLink className="h-3 w-3" /> Plan trades &amp; review risk in the Trade Planning &amp; Risk Studio
          </a>
        </div>

        <div className="space-y-4">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}

          {!isLoading && isError && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Could not load journal entries — try again later.
              </CardContent>
            </Card>
          )}

          {!isLoading && !isError && (entries?.length ?? 0) === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No journal entries yet — write your first log using the form.
              </CardContent>
            </Card>
          )}

          {!isLoading &&
            !isError &&
            entries?.map((entry) =>
              editingId === entry.id ? (
                <Card key={entry.id} data-testid={`card-journal-entry-${entry.id}-editing`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Editing entry</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel editing"
                        data-testid={`button-cancel-edit-${entry.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => handleUpdate(e, entry.id)} className="space-y-4">
                      <EntryFields form={editForm} onChange={setEditForm} positions={positionOptions} />
                      <Button type="submit" disabled={updateEntry.isPending} data-testid={`button-save-edit-${entry.id}`}>
                        {updateEntry.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card key={entry.id} data-testid={`card-journal-entry-${entry.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={moodBadgeClass(entry.mood)}>
                          {entry.mood}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(entry)}
                          data-testid={`button-edit-entry-${entry.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entry.id)}
                          data-testid={`button-delete-entry-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(entry.setupType || entry.entryPrice != null || entry.exitPrice != null || entry.rMultiple != null) && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {entry.setupType && (
                          <Badge variant="outline" className="border-primary/30 text-primary">
                            {entry.setupType}
                          </Badge>
                        )}
                        {entry.entryPrice != null && (
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            Entry ${entry.entryPrice.toFixed(2)}
                          </Badge>
                        )}
                        {entry.exitPrice != null && (
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            Exit ${entry.exitPrice.toFixed(2)}
                          </Badge>
                        )}
                        {entry.rMultiple != null && (
                          <Badge
                            variant="outline"
                            className={entry.rMultiple >= 0 ? "border-emerald-500/40 text-emerald-400" : "border-rose-500/40 text-rose-400"}
                          >
                            {entry.rMultiple >= 0 ? "+" : ""}
                            {entry.rMultiple}R
                          </Badge>
                        )}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap text-sm text-foreground/90">{entry.content}</p>

                    {entry.lessonLearned && (
                      <div className="mt-4 rounded-md border border-border bg-secondary/50 p-3">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">Lesson Learned</p>
                        <p className="text-sm italic">{entry.lessonLearned}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ),
            )}
        </div>
      </div>

      <div className="md:col-span-1">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle>New Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <EntryFields form={form} onChange={setForm} positions={positionOptions} />
              <Button type="submit" disabled={createEntry.isPending} className="w-full" data-testid="button-save-journal-entry">
                {createEntry.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
