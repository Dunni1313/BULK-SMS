// Phase 4, Sprint 56 — Alerts & Notifications (approved Phase 4 plan,
// Sprint 56; see docs/Phase-4-Master-Execution-Plan.md's Sprint 56
// as-built note). In-app notification center — the project owner's own
// explicit kickoff decision on delivery channel (email/push both need
// real credentials/infrastructure this session doesn't have and can't
// verify end-to-end).
//
// Visible on every page (mounted once in AppLayout), since alerts are
// cross-engine: watchlist target-crossing is Engine 1's own detection
// (Phase 2, Sprint 27), risk hard-cap breach is Engine 2's own detection
// (Phase 3, Sprint 38/44) — neither belongs to one engine's own page.
//
// Polls GET /notifications (same 20s cadence as AppLayout's own existing
// trade-adjustments poll) so the unread badge stays current from any page,
// mirroring that exact established pattern. The "Check now" button is an
// explicit, user-triggered POST /notifications/check — the same
// "never a side effect of a plain read" discipline Sprint 27's own
// "Check Targets" button established — since a background scheduler
// (index.ts's startAlertsScheduler, 5-minute interval) already generates
// alerts independently; this button exists for a user who doesn't want to
// wait for the next tick.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  getListNotificationsQueryKey,
  useCheckNotifications,
  useUpdateNotification,
  type PlatformNotification,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function fmtRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 20000 },
  });
  const items = notifications ?? [];
  const unreadCount = items.filter((n) => !n.isRead).length;

  const checkNow = useCheckNotifications();
  const markRead = useUpdateNotification();

  function handleCheckNow() {
    checkNow.mutate(undefined, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        toast({
          title: created.length > 0 ? `${created.length} new alert${created.length === 1 ? "" : "s"}` : "No new alerts",
          description: created.length > 0 ? created.map((n) => n.title).join(", ") : "Watchlist targets and risk caps are all clear.",
        });
      },
    });
  }

  function handleMarkRead(n: PlatformNotification) {
    markRead.mutate(
      { id: n.id, data: { isRead: true } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" data-testid="button-notification-bell">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="outline"
              className="absolute -right-1 -top-1 h-4 min-w-4 justify-center border-amber-500/40 bg-amber-500/15 px-1 text-[10px] text-amber-400"
              data-testid="badge-notification-unread-count"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-card border-border p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleCheckNow}
            disabled={checkNow.isPending}
            data-testid="button-check-notifications-now"
          >
            <RefreshCw className={`h-3 w-3 ${checkNow.isPending ? "animate-spin" : ""}`} />
            Check now
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground" data-testid="text-notifications-empty">
            No notifications yet.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-border px-3 py-2 last:border-b-0 ${n.isRead ? "opacity-60" : ""}`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground border-border">
                      {n.dataSource}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{fmtRelativeTime(n.createdAt)}</span>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n)}
                        className="text-[10px] font-medium text-primary hover:underline"
                        data-testid={`button-mark-read-${n.id}`}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
