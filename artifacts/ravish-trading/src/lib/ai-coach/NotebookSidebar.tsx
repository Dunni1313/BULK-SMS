// v1.5.0 Sprint 8 — AI Research Notebooks. A reusable notebook list
// sidebar — New Notebook (inline create form: title + optional
// description), search, an "include archived" toggle, and NotebookList's
// own list rendering — mirroring WorkspaceSidebar.tsx's own established
// shape (Sprint 7) so the two sidebars feel like the same family of
// component. Every specialist coach page (Trading/Investing/Options) can
// mount this exact same component; nothing here is coach-specific.

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Search, X } from "lucide-react";
import type { AiNotebook } from "./notebooksApi";
import { NotebookList } from "./NotebookList";

export interface NotebookSidebarProps {
  notebooks: AiNotebook[];
  isLoading: boolean;
  activeNotebookId: number | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreateNotebook: (input: { title: string; description?: string }) => unknown;
  onSelectNotebook: (id: number) => void;
  onClearSelection: () => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleArchive?: (id: number, archived: boolean) => void;
  onDeleteNotebook?: (id: number) => void;
  noteCounts?: Record<number, number>;
  testId?: string;
}

export function NotebookSidebar({
  notebooks,
  isLoading,
  activeNotebookId,
  searchTerm,
  onSearchChange,
  onCreateNotebook,
  onSelectNotebook,
  onClearSelection,
  onTogglePin,
  onToggleArchive,
  onDeleteNotebook,
  noteCounts,
  testId = "notebook-sidebar",
}: NotebookSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  async function submitCreate() {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    await onCreateNotebook({ title, description: draftDescription.trim() || undefined });
    setDraftTitle("");
    setDraftDescription("");
    setIsCreating(false);
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 border-r border-border pr-3" data-testid={testId}>
      {isCreating ? (
        <div className="space-y-1.5 rounded-md border border-border/60 p-2" data-testid={`${testId}-create-form`}>
          <Input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Notebook title"
            className="h-8 text-xs"
            data-testid={`${testId}-create-title`}
          />
          <Textarea
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            placeholder="Description (optional)"
            className="min-h-14 text-xs"
            data-testid={`${testId}-create-description`}
          />
          <div className="flex gap-1.5">
            <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={submitCreate} data-testid={`${testId}-create-save`}>
              Create
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                setIsCreating(false);
                setDraftTitle("");
                setDraftDescription("");
              }}
              data-testid={`${testId}-create-cancel`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5"
          onClick={() => setIsCreating(true)}
          data-testid={`${testId}-new-notebook`}
        >
          <Plus className="h-3.5 w-3.5" />
          New Notebook
        </Button>
      )}

      {activeNotebookId !== null && (
        <button
          type="button"
          className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/50"
          onClick={onClearSelection}
          data-testid={`${testId}-clear-selection`}
        >
          ← All notebooks
        </button>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notebooks"
          className="h-8 pl-7 text-xs"
          data-testid={`${testId}-search`}
        />
      </div>

      <div className="flex-1 overflow-y-auto" data-testid={`${testId}-list-container`}>
        <NotebookList
          notebooks={notebooks}
          isLoading={isLoading}
          activeNotebookId={activeNotebookId}
          onSelectNotebook={onSelectNotebook}
          onTogglePin={onTogglePin}
          onToggleArchive={onToggleArchive}
          onDeleteNotebook={onDeleteNotebook}
          noteCounts={noteCounts}
          onCreateFirst={() => setIsCreating(true)}
          testId={`${testId}-list`}
        />
      </div>
    </div>
  );
}
