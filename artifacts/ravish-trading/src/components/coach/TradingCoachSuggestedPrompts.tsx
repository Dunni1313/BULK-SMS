// v1.3.1 — AI Trading Coach, Frontend UI. A row of clickable, pre-filled
// question chips. Content itself comes from lib/trading-coach-context.ts's
// getSuggestedPrompts() (context-aware, focus-derived) — this component
// only renders whatever list it's given, no prompt logic of its own.

import { Badge } from "@/components/ui/badge";

export function TradingCoachSuggestedPrompts({
  prompts,
  onSelect,
  disabled,
}: {
  prompts: string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (prompts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="trading-coach-suggested-prompts">
      {prompts.map((prompt) => (
        <Badge
          key={prompt}
          variant="outline"
          className={`cursor-pointer border-indigo-500/30 px-2.5 py-1 text-[11px] text-indigo-400 hover:bg-indigo-500/10 ${
            disabled ? "pointer-events-none opacity-50" : ""
          }`}
          onClick={() => !disabled && onSelect(prompt)}
          data-testid={`trading-coach-suggested-prompt-${prompt}`}
        >
          {prompt}
        </Badge>
      ))}
    </div>
  );
}
