// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only — see
// docs/v1.5.0-Sprint-01-AI-Coach-Consolidation.md), Frontend UI. The
// input row (send / stop) plus
// a "Clear conversation" action with a confirmation dialog. "Clear" is
// deliberately a LOCAL, view-only reset — Sprint 1's backend contract has
// no delete/clear endpoint for trading_coach_messages (only ask/ask-stream/
// GET messages), and this UI-only sprint does not add one. The confirmation
// copy says so explicitly, so no user is misled into thinking their
// server-persisted history was deleted.

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Square, Eraser } from "lucide-react";

export function TradingCoachComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  onClearConversation,
  isStreaming,
  hasHistory,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  onClearConversation: () => void;
  isStreaming: boolean;
  hasHistory: boolean;
}) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask the AI Trading Assistant…"
          disabled={isStreaming}
          className="flex-1"
          data-testid="input-trading-coach-composer"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            title="Stop generating"
            onClick={onStop}
            data-testid="button-trading-coach-stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!value.trim()} aria-label="Send message" data-testid="button-trading-coach-send">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>

      {hasHistory && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setConfirmClearOpen(true)}
          data-testid="button-trading-coach-clear-conversation"
        >
          <Eraser className="h-3 w-3" />
          Clear conversation
        </Button>
      )}

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent data-testid="dialog-trading-coach-clear-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this conversation view?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the conversation from this view only — your message history remains saved and will
              reappear the next time you open the AI Trading Assistant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-trading-coach-clear-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onClearConversation();
                setConfirmClearOpen(false);
              }}
              data-testid="button-trading-coach-clear-confirm"
            >
              Clear view
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
