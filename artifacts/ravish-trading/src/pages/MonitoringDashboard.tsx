// Phase 16 — Institutional Monitoring & Alerts Engine.
//
// The dedicated UI for the new Monitoring & Alerts Engine (lib/monitoringEngine.ts,
// routes/monitoringEngine.ts) — distinct from NotificationCentre.tsx (Phase 10's
// broader, purely-informational cross-engine aggregation view). This page is
// specifically about the alert lifecycle: Active Alerts, Alert History, a
// Timeline, Filters, per-alert Details (reason/evidence/previous/current/
// severity/recommended action/timestamp — every field the Phase 16 brief
// requires), and Alert Notes.
//
// Reuses GET /notifications (already-enriched by this phase's own backend
// work) as the single source of data for all three tabs — no new read
// endpoint was needed since /notifications already returns every field this
// page displays. "Run Full Check" is the one explicit, user-triggered action
// this page adds beyond NotificationBell's own existing "Check now" button:
// it additionally runs Opportunity Alerts (on-demand only, per
// lib/monitoringEngine.ts's own disclosed cost-control design), via the new
// POST /monitoring-engine/check.
//
// Permanent labels, per the Phase 16 brief: Institutional Monitoring,
// Educational, Deterministic, Evidence Based.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  getListNotificationsQueryKey,
  useFullMonitoringCheck,
  useUpdateNotification,
  useGetAlertNotes,
  getGetAlertNotesQueryKey,
  useAddAlertNote,
  useDeleteAlertNote,
  type PlatformNotification,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Bell, RefreshCw, StickyNote, Trash2 } from "lucide-react";
import { CoachDrawer } from "@/components/coach/CoachDrawer";

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "warning":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    default:
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  }
}

function typeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const ALL_TYPES = [
  "watchlist_target_crossed",
  "risk_cap_breached",
  "decision_change",
  "valuation_change",
  "quality_change",
  "committee_change",
  "tomnash_change",
  "financial_deterioration",
  "dividend_change",
  "earnings_alert",
  "portfolio_drift",
  "sector_concentration_breach",
  "position_sizing_breach",
  "opportunity_match",
];

interface Filters {
  severity: string;
  type: string;
  symbol: string;
}

function matchesFilters(n: PlatformNotification, filters: Filters): boolean {
  if (filters.severity !== "all" && n.severity !== filters.severity) return false;
  if (filters.type !== "all" && n.type !== filters.type) return false;
  if (filters.symbol.trim() && n.relatedSymbol?.toUpperCase() !== filters.symbol.trim().toUpperCase()) return false;
  return true;
}

function AlertNotesDialog({ notificationId, onOpenChange }: { notificationId: number | null; onOpenChange: (open: boolean) => void }) {
  const [draft, setDraft] = useState("");
  const params = notificationId != null ? { notificationId } : undefined;
  const { data: notes, isLoading } = useGetAlertNotes(params, {
    query: { queryKey: getGetAlertNotesQueryKey(params), enabled: notificationId != null },
  });
  const queryClient = useQueryClient();
  const addNote = useAddAlertNote({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAlertNotesQueryKey(params) }) },
  });
  const deleteNote = useDeleteAlertNote({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAlertNotesQueryKey(params) }) },
  });

  return (
    <Dialog open={notificationId != null} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-alert-notes">
        <DialogHeader>
          <DialogTitle>Alert Notes</DialogTitle>
          <DialogDescription>Your own notes on this alert — never shared, never used by any detection logic.</DialogDescription>
        </DialogHeader>

        {isLoading && <Skeleton className="h-16 w-full" />}
        {!isLoading && (
          <div className="space-y-2 max-h-64 overflow-y-auto" data-testid="list-alert-notes">
            {(notes ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-alert-notes-empty">
                No notes yet.
              </p>
            )}
            {(notes ?? []).map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2" data-testid={`note-${n.id}`}>
                <p className="text-sm">{n.note}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-delete-note-${n.id}`}
                  onClick={() => deleteNote.mutate({ id: n.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note..."
            data-testid="input-new-note"
          />
          <Button
            data-testid="button-add-note"
            disabled={!draft.trim() || notificationId == null}
            onClick={() => {
              if (notificationId == null) return;
              addNote.mutate({ data: { notificationId, note: draft.trim() } }, { onSuccess: () => setDraft("") });
            }}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AlertCard({
  alert,
  onToggleRead,
  onOpenNotes,
}: {
  alert: PlatformNotification;
  onToggleRead: (n: PlatformNotification) => void;
  onOpenNotes: (id: number) => void;
}) {
  return (
    <Card className="bg-card border-border" data-testid={`alert-${alert.id}`}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{alert.title}</p>
              <Badge className={severityBadgeClass(alert.severity)} data-testid={`badge-severity-${alert.id}`}>
                {alert.severity}
              </Badge>
              <Badge variant="outline">{typeLabel(alert.type)}</Badge>
              <Badge variant="outline">{alert.dataSource}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
          </div>
          <p className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-timestamp-${alert.id}`}>
            {new Date(alert.createdAt).toLocaleString()}
          </p>
        </div>

        {(alert.previousValue != null || alert.currentValue != null) && (
          <p className="text-xs text-muted-foreground" data-testid={`text-previous-current-${alert.id}`}>
            {alert.previousValue ?? "n/a"} &rarr; {alert.currentValue ?? "n/a"}
          </p>
        )}

        {alert.evidence.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc list-inside" data-testid={`list-evidence-${alert.id}`}>
            {alert.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {alert.recommendedAction && (
          <p className="text-xs italic text-muted-foreground" data-testid={`text-recommended-action-${alert.id}`}>
            Recommended: {alert.recommendedAction}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" data-testid={`button-toggle-read-${alert.id}`} onClick={() => onToggleRead(alert)}>
            {alert.isRead ? "Mark unread" : "Mark read"}
          </Button>
          <Button size="sm" variant="ghost" data-testid={`button-notes-${alert.id}`} onClick={() => onOpenNotes(alert.id)}>
            <StickyNote className="h-4 w-4 mr-1" />
            Notes
          </Button>
          {alert.relatedSymbol && (
            <>
              <Link
                href={`/stock-analyst/investment-committee?symbol=${alert.relatedSymbol}`}
                className="text-xs text-primary hover:underline"
                data-testid={`link-committee-${alert.id}`}
              >
                Review in Committee →
              </Link>
              <Link
                href={`/research-terminal?symbol=${alert.relatedSymbol}`}
                className="text-xs text-primary hover:underline"
                data-testid={`link-terminal-${alert.id}`}
              >
                Open in Terminal →
              </Link>
              <CoachDrawer
                symbol={alert.relatedSymbol}
                coach="monitoring"
                trigger={
                  <span className="text-xs text-primary hover:underline cursor-pointer" data-testid={`ask-coach-${alert.id}`}>
                    Ask the AI Coach →
                  </span>
                }
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonitoringDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ severity: "all", type: "all", symbol: "" });
  const [notesFor, setNotesFor] = useState<number | null>(null);

  const { data: notifications, isLoading } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() },
  });

  const fullCheck = useFullMonitoringCheck({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        toast({ title: `Full check complete — ${created.length} new alert(s)` });
      },
      onError: () => toast({ title: "Full check failed", variant: "destructive" }),
    },
  });

  const toggleRead = useUpdateNotification({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) },
  });

  const filtered = useMemo(() => (notifications ?? []).filter((n) => matchesFilters(n, filters)), [notifications, filters]);
  const active = useMemo(() => filtered.filter((n) => !n.isRead), [filtered]);
  const history = useMemo(() => filtered.filter((n) => n.isRead), [filtered]);
  const timeline = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  );

  return (
    <div className="space-y-6 max-w-5xl" data-testid="page-monitoring-dashboard">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Institutional Monitoring
          </h1>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-institutional-monitoring">
            Institutional Monitoring
          </Badge>
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" data-testid="badge-educational">
            Educational
          </Badge>
          <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30" data-testid="badge-deterministic">
            Deterministic
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30" data-testid="badge-evidence-based">
            Evidence Based
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Continuously evaluates your watchlist, portfolios, and saved opportunity screens using the platform's
          existing engines — never a new scoring model. Every alert states its reason, evidence, previous value,
          current value, severity, and a recommended action.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Select value={filters.severity} onValueChange={(v) => setFilters((f) => ({ ...f, severity: v }))}>
            <SelectTrigger className="w-[160px]" data-testid="select-filter-severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
            <SelectTrigger className="w-[220px]" data-testid="select-filter-type">
              <SelectValue placeholder="Alert Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ALL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {typeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="w-[160px]"
            placeholder="Symbol (e.g. AAPL)"
            value={filters.symbol}
            onChange={(e) => setFilters((f) => ({ ...f, symbol: e.target.value }))}
            data-testid="input-filter-symbol"
          />

          <Button
            variant="secondary"
            data-testid="button-run-full-check"
            disabled={fullCheck.isPending}
            onClick={() => fullCheck.mutate()}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${fullCheck.isPending ? "animate-spin" : ""}`} />
            Run Full Check
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-3" data-testid="monitoring-dashboard-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active-alerts">
              Active Alerts ({active.length})
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-alert-history">
              Alert History ({history.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-active-empty">
                No active alerts match the current filters.
              </p>
            ) : (
              active.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  onToggleRead={(n) => toggleRead.mutate({ id: n.id, data: { isRead: !n.isRead } })}
                  onOpenNotes={setNotesFor}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-history-empty">
                No read alerts match the current filters.
              </p>
            ) : (
              history.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  onToggleRead={(n) => toggleRead.mutate({ id: n.id, data: { isRead: !n.isRead } })}
                  onOpenNotes={setNotesFor}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-timeline-empty">
                No alerts match the current filters.
              </p>
            ) : (
              timeline.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  onToggleRead={(n) => toggleRead.mutate({ id: n.id, data: { isRead: !n.isRead } })}
                  onOpenNotes={setNotesFor}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertNotesDialog notificationId={notesFor} onOpenChange={(open) => !open && setNotesFor(null)} />
    </div>
  );
}
