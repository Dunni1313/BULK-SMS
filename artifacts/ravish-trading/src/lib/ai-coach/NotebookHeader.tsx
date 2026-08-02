// v1.5.0 Sprint 8 — AI Research Notebooks. Shown above the notebook editor
// once a notebook is active: title/description (inline-editable), tags,
// pin/archive/delete actions, version badge, and a "search notebook
// contents" box (the dedicated GET /ai-notebooks/:id/search?q= endpoint —
// distinct from the sidebar's own title-only list search), mirroring
// WorkspaceHeader.tsx's own established shape (Sprint 7).

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pin, Archive, Trash2, Pencil, Check, X, Search, History } from "lucide-react";
import type { AiNotebookDetail } from "./notebooksApi";

export interface NotebookHeaderProps {
  notebook: AiNotebookDetail;
  onRename: (input: { title?: string; description?: string }) => void | Promise<void>;
  onTogglePin: (pinned: boolean) => void;
  onToggleArchive: (archived: boolean) => void;
  onDelete: () => void;
  onSearch?: (q: string) => void;
  testId?: string;
}

export function NotebookHeader({
  notebook,
  onRename,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onSearch,
  testId = "notebook-header",
}: NotebookHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(notebook.title);
  const [draftDescription, setDraftDescription] = useState(notebook.description ?? "");
  const [searchQuery, setSearchQuery] = useState("");

  function beginEdit() {
    setDraftTitle(notebook.title);
    setDraftDescription(notebook.description ?? "");
    setIsEditing(true);
  }

  async function submitEdit() {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    await onRename({ title, description: draftDescription.trim() || undefined });
    setIsEditing(false);
  }

  return (
    <div className="mb-2 rounded-md border border-border/60 bg-card/50" data-testid={testId}>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-1.5" data-testid={`${testId}-edit-form`}>
              <Input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="h-8 text-sm font-semibold"
                data-testid={`${testId}-edit-title`}
              />
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Description (optional)"
                className="min-h-14 text-xs"
                data-testid={`${testId}-edit-description`}
              />
              <div className="flex gap-1.5">
                <Button type="button" size="sm" className="h-7 text-xs" onClick={submitEdit} data-testid={`${testId}-edit-save`}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setIsEditing(false)}
                  data-testid={`${testId}-edit-cancel`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-foreground" data-testid={`${testId}-title`}>
                  {notebook.title}
                </span>
                {notebook.archived && <span className="rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">Archived</span>}
                <button type="button" onClick={beginEdit} aria-label="Edit notebook" data-testid={`${testId}-edit-toggle`}>
                  <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              {notebook.description && (
                <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`${testId}-description`}>
                  {notebook.description}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {notebook.tags.map((tag) => (
                  <span key={tag} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <History className="h-2.5 w-2.5" />
                <span data-testid={`${testId}-version`}>v{notebook.version}</span>
                <span>· Updated {formatDistanceToNow(new Date(notebook.updatedAt), { addSuffix: true })}</span>
                <span>
                  · {notebook.notes.length} item{notebook.notes.length === 1 ? "" : "s"}
                </span>
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onTogglePin(!notebook.pinned)}
            aria-label={notebook.pinned ? "Unpin notebook" : "Favourite notebook"}
            data-testid={`${testId}-pin-toggle`}
          >
            <Pin className={`h-3.5 w-3.5 ${notebook.pinned ? "text-amber-400" : "text-muted-foreground"}`} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggleArchive(!notebook.archived)}
            aria-label={notebook.archived ? "Restore notebook" : "Archive notebook"}
            data-testid={`${testId}-archive-toggle`}
          >
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} aria-label="Delete notebook" data-testid={`${testId}-delete`}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>

      {onSearch && (
        <div className="border-t border-border/60 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch(e.target.value);
              }}
              placeholder="Search this notebook's contents…"
              className="h-8 pl-7 text-xs"
              data-testid={`${testId}-content-search`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
