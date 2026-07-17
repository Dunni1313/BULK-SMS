// Phase 10 — Institutional Platform Polish & Control Center.
//
// Notification Centre — a full-page aggregation of already-existing
// observations, per the explicit instruction: "Reuse existing
// observations... No recommendations." Every category below is a
// factual, informational statement sourced from an already-existing,
// already-tested engine — never a suggested action, never a new
// detection pipeline, never a new backend alert-generation path. This is
// deliberately a client-side READ composition, not a new server-side
// notification-writer, to stay well clear of the existing, protected
// automation/alerts scheduler (index.ts's startAlertsScheduler,
// lib/notifications.ts) — nothing here persists a new row anywhere.
//
// Categories and their real source:
//   - Watchlist / Risk Cap alerts  → GET /notifications (Phase 4 Sprint 56,
//     unmodified — this page is a superset view, not a replacement for
//     the header NotificationBell).
//   - Health changes               → Institutional Intelligence's own
//     health.healthTrend/healthTrendDetail (already computed).
//   - Risk alerts                  → Portfolio Dashboard's own elevated
//     guidance codes (the same filter CommandCenter.tsx and Home.tsx's
//     own Risk widget already use).
//   - Learning reminders           → Learning Progress's own
//     lessonsCompleted count (a factual figure, not a nudge to act).
//   - Journal reminders            → closed trades with no linked journal
//     entry (a client-side diff of two already-fetched lists).
//   - Upcoming earnings            → Portfolio Event Risk's own
//     primaryEvent, filtered to type === "earnings".
//   - Expirations                  → open trades' own `expiration` field,
//     filtered to within 14 days (a plain client-side date comparison).

import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListNotifications,
  getListNotificationsQueryKey,
  useGetInstitutionalIntelligence,
  useGetPortfolioDashboard,
  useGetLearningProgress,
  useListJournalEntries,
  useListTrades,
  useGetPortfolioEventRisk,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Activity, ShieldAlert, GraduationCap, BookOpen, TrendingUp, CalendarClock } from "lucide-react";

const ELEVATED_GUIDANCE_CODES = new Set([
  "elevated_risk",
  "high_risk",
  "elevated_concentration",
  "elevated_event_risk",
  "diversification_recommended",
  "review_large_positions",
]);

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

interface CentreItem {
  key: string;
  category: string;
  icon: typeof Bell;
  text: string;
  detail?: string;
  href?: string;
}

function CategorySection({
  title,
  icon: Icon,
  items,
  emptyText,
  testId,
}: {
  title: string;
  icon: typeof Bell;
  items: CentreItem[];
  emptyText: string;
  testId: string;
}) {
  return (
    <Card className="bg-card border-border" data-testid={`section-${testId}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid={`text-${testId}-empty`}>
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-2" data-testid={`list-${testId}`}>
            {items.map((i) => (
              <li key={i.key} data-testid={`item-${i.key}`}>
                {i.href ? (
                  <Link href={i.href} className="text-sm font-medium hover:underline">
                    {i.text}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{i.text}</span>
                )}
                {i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function NotificationCentre() {
  const { data: notifications, isLoading: notificationsLoading } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey() },
  });
  const { data: intelligence } = useGetInstitutionalIntelligence();
  const { data: dashboard } = useGetPortfolioDashboard();
  const { data: learningProgress } = useGetLearningProgress();
  const { data: journalEntries } = useListJournalEntries();
  const { data: closedTrades } = useListTrades({ status: "closed" });
  const { data: openTrades } = useListTrades({ status: "open" });
  const { data: eventRisk } = useGetPortfolioEventRisk();

  const alertItems: CentreItem[] = useMemo(
    () =>
      (notifications ?? [])
        .filter((n) => !n.isRead)
        .map((n) => ({ key: `alert-${n.id}`, category: "alert", icon: Bell, text: n.title, detail: n.message })),
    [notifications],
  );

  const healthItems: CentreItem[] = useMemo(() => {
    if (!intelligence) return [];
    if (intelligence.health.healthTrend === "stable" || !intelligence.health.healthTrend) return [];
    return [
      {
        key: "health-trend",
        category: "health",
        icon: Activity,
        text: `Portfolio health is ${intelligence.health.healthTrend}`,
        detail: intelligence.health.healthTrendDetail,
        href: "/institutional-intelligence",
      },
    ];
  }, [intelligence]);

  const riskItems: CentreItem[] = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.guidance
      .filter((g) => ELEVATED_GUIDANCE_CODES.has(g.code))
      .map((g) => ({ key: `risk-${g.code}`, category: "risk", icon: ShieldAlert, text: g.label, detail: g.detail, href: "/portfolio-dashboard" }));
  }, [dashboard]);

  const learningItems: CentreItem[] = useMemo(() => {
    if (!learningProgress) return [];
    if (learningProgress.lessonsCompleted >= 3) return [];
    return [
      {
        key: "learning-reminder",
        category: "learning",
        icon: GraduationCap,
        text: `${learningProgress.lessonsCompleted} lesson(s) completed so far`,
        detail: "The Learning Centre has structured paths covering foundations through institutional-level analysis.",
        href: "/learn",
      },
    ];
  }, [learningProgress]);

  const journalItems: CentreItem[] = useMemo(() => {
    if (!closedTrades || !journalEntries) return [];
    const linkedTradeIds = new Set(journalEntries.map((j) => j.tradeId).filter((id): id is number => id !== null));
    const unlinked = closedTrades.filter((t) => !linkedTradeIds.has(t.id));
    return unlinked.slice(0, 8).map((t) => ({
      key: `journal-reminder-${t.id}`,
      category: "journal",
      icon: BookOpen,
      text: `${t.symbol} (${t.strategy.replace(/_/g, " ")}) closed with no linked journal entry`,
      href: "/journal",
    }));
  }, [closedTrades, journalEntries]);

  const earningsItems: CentreItem[] = useMemo(() => {
    if (!eventRisk) return [];
    return eventRisk.positions
      .filter((p) => p.primaryEvent?.type === "earnings")
      .map((p) => ({
        key: `earnings-${p.tradeId}`,
        category: "earnings",
        icon: TrendingUp,
        text: `${p.symbol} — earnings in ${p.primaryEvent!.daysAway}d`,
        detail: p.primaryEvent!.date,
        href: "/event-risk",
      }));
  }, [eventRisk]);

  const expirationItems: CentreItem[] = useMemo(() => {
    if (!openTrades) return [];
    return openTrades
      .map((t) => ({ t, days: daysUntil(t.expiration) }))
      .filter((x): x is { t: typeof openTrades[number]; days: number } => x.days !== null && x.days <= 14 && x.days >= 0)
      .sort((a, b) => a.days - b.days)
      .map((x) => ({
        key: `expiration-${x.t.id}`,
        category: "expiration",
        icon: CalendarClock,
        text: `${x.t.symbol} (${x.t.strategy.replace(/_/g, " ")}) expires in ${x.days}d`,
        detail: x.t.expiration ?? undefined,
        href: `/ticket/adjust/${x.t.id}`,
      }));
  }, [openTrades]);

  return (
    <div className="space-y-6 max-w-5xl" data-testid="page-notification-centre">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Notification Centre</h1>
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30" data-testid="badge-informational-only">
            Informational Only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Every item below reuses an already-existing engine's own output. Purely informational — nothing
          here is a recommendation, and nothing here places, closes, or modifies an order or position.
        </p>
      </div>

      {notificationsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="notification-centre-loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!notificationsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategorySection title="Alerts" icon={Bell} items={alertItems} emptyText="No unread alerts." testId="alerts" />
          <CategorySection title="Health Changes" icon={Activity} items={healthItems} emptyText="Portfolio health is stable." testId="health" />
          <CategorySection title="Risk" icon={ShieldAlert} items={riskItems} emptyText="No elevated risk conditions." testId="risk" />
          <CategorySection title="Learning" icon={GraduationCap} items={learningItems} emptyText="No learning reminders." testId="learning" />
          <CategorySection title="Journal" icon={BookOpen} items={journalItems} emptyText="Every closed trade has a linked journal entry." testId="journal" />
          <CategorySection title="Upcoming Earnings" icon={TrendingUp} items={earningsItems} emptyText="No known upcoming earnings across your open positions." testId="earnings" />
          <CategorySection title="Expirations (next 14 days)" icon={CalendarClock} items={expirationItems} emptyText="No positions expiring in the next 14 days." testId="expirations" />
        </div>
      )}

      <Card className="bg-card border-border" data-testid="card-daily-report-link">
        <CardContent className="pt-6">
          <CardDescription>
            For a fuller, AI-narrated summary across all 3 engines, see the{" "}
            <Link href="/daily-report" className="underline">
              Cross-Engine Daily Report
            </Link>
            .
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
