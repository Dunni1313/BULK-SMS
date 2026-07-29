// v1.5.0 Sprint 8 — AI Research Notebooks. A single notebook's summary
// card — title, description, tags, pinned/archived state, note count,
// version — with pin/archive/delete quick actions, mirroring
// WorkspaceCard.tsx's own established shape (Sprint 7) so the two card
// families feel consistent. Reused by NotebookList's own rendering; kept
// as its own component so any future notebook-browsing surface can reuse
// the exact same card.

import { Pin, Archive, Trash2, StickyNote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AiNotebook } from "./notebooksApi";

export interface NotebookCardProps {
  notebook: AiNotebook;
  isActive?: boolean;
  noteCount?: number;
  onSelect: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDelete?: (id: number) => void;
  testId?: string;
}

export function NotebookCard({
  notebook,
  isActive = false,
  noteCount,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onDelete,
  testId = `notebook-card-${notebook.id}`,
}: NotebookCardProps) {
  return (
    <div
      className={`group rounded-md border px-3 py-2 transition-colors ${
        isActive ? "border-indigo-500/50 bg-indigo-500/10" : "border-border/60 hover:border-border"
      }`}
      data-testid={testId}
      data-active={isActive ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(notebook.id)} data-testid={`${testId}-select`}>
          <div className="flex items-center gap-1.5">
            {notebook.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" data-testid={`${testId}-pinned-icon`} />}
            <span className="truncate text-sm font-medium text-foreground/90">{notebook.title}</span>
            {notebook.archived && (
              <span className="shrink-0 rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground" data-testid={`${testId}-archived-badge`}>
                Archived
              </span>
            )}
          </div>
          {notebook.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{notebook.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {notebook.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground" data-testid={`${testId}-tag-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            {typeof noteCount === "number" && (
              <span className="flex items-center gap-0.5" data-testid={`${testId}-note-count`}>
                <StickyNote className="h-2.5 w-2.5" />
                {noteCount}
              </span>
            )}
            <span data-testid={`${testId}-version`}>v{notebook.version}</span>
            <span>{formatDistanceToNow(new Date(notebook.updatedAt), { addSuffix: true })}</span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(notebook.id, !notebook.pinned)}
              aria-label={notebook.pinned ? "Unpin notebook" : "Favourite notebook"}
              data-testid={`${testId}-pin-toggle`}
            >
              <Pin className={`h-3 w-3 ${notebook.pinned ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`} />
            </button>
          )}
          {onToggleArchive && (
            <button
              type="button"
              onClick={() => onToggleArchive(notebook.id, !notebook.archived)}
              aria-label={notebook.archived ? "Restore notebook" : "Archive notebook"}
              data-testid={`${testId}-archive-toggle`}
            >
              <Archive className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(notebook.id)} aria-label="Delete notebook" data-testid={`${testId}-delete`}>
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
