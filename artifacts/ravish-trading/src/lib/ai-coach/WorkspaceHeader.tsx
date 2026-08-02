// v1.5.0 Sprint 7 — AI Workspaces. Shown above the conversation panel once
// a workspace is active: name/description, tags, pin/archive/delete
// actions, and a collapsible "Research" panel for the workspace's own
// research features — quick notes, saved AI summaries/conclusions/action
// items (one kind-discriminated list, matching aiWorkspaceNotesTable's own
// shape) and file references (name + external URL + optional note).

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pin, Archive, Trash2, ChevronDown, ChevronUp, Plus, FileText, StickyNote, X } from "lucide-react";
import type { AiWorkspaceDetail, WorkspaceNoteKind } from "./workspacesApi";

const NOTE_KIND_LABELS: Record<WorkspaceNoteKind, string> = {
  note: "Quick note",
  summary: "AI summary",
  conclusion: "Conclusion",
  action_item: "Action item",
};

export interface WorkspaceHeaderProps {
  workspace: AiWorkspaceDetail;
  onTogglePin: (pinned: boolean) => void;
  onToggleArchive: (archived: boolean) => void;
  onDelete: () => void;
  onAddNote: (kind: WorkspaceNoteKind, content: string) => void | Promise<void>;
  onDeleteNote: (noteId: number) => void | Promise<void>;
  onAddFile: (input: { fileName: string; fileUrl: string; note?: string }) => void | Promise<void>;
  onDeleteFile: (fileId: number) => void | Promise<void>;
  testId?: string;
}

export function WorkspaceHeader({
  workspace,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onAddNote,
  onDeleteNote,
  onAddFile,
  onDeleteFile,
  testId = "workspace-header",
}: WorkspaceHeaderProps) {
  const [researchOpen, setResearchOpen] = useState(false);
  const [noteKind, setNoteKind] = useState<WorkspaceNoteKind>("note");
  const [noteDraft, setNoteDraft] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  async function submitNote() {
    const content = noteDraft.trim();
    if (content.length === 0) return;
    await onAddNote(noteKind, content);
    setNoteDraft("");
  }

  async function submitFile() {
    const name = fileName.trim();
    const url = fileUrl.trim();
    if (name.length === 0 || url.length === 0) return;
    await onAddFile({ fileName: name, fileUrl: url });
    setFileName("");
    setFileUrl("");
  }

  return (
    <div className="mb-2 rounded-md border border-border/60 bg-card/50" data-testid={testId}>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground" data-testid={`${testId}-name`}>
              {workspace.name}
            </span>
            {workspace.archived && (
              <span className="rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">Archived</span>
            )}
          </div>
          {workspace.description && (
            <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`${testId}-description`}>
              {workspace.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {workspace.tags.map((tag) => (
              <span key={tag} className="rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Updated {formatDistanceToNow(new Date(workspace.updatedAt), { addSuffix: true })} · {workspace.conversations.length} conversation
            {workspace.conversations.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onTogglePin(!workspace.pinned)}
            aria-label={workspace.pinned ? "Unpin workspace" : "Pin workspace"}
            data-testid={`${testId}-pin-toggle`}
          >
            <Pin className={`h-3.5 w-3.5 ${workspace.pinned ? "text-amber-400" : "text-muted-foreground"}`} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggleArchive(!workspace.archived)}
            aria-label={workspace.archived ? "Unarchive workspace" : "Archive workspace"}
            data-testid={`${testId}-archive-toggle`}
          >
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} aria-label="Delete workspace" data-testid={`${testId}-delete`}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setResearchOpen((v) => !v)}
            data-testid={`${testId}-research-toggle`}
          >
            Research
            {researchOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {researchOpen && (
        <div className="space-y-3 border-t border-border/60 p-3" data-testid={`${testId}-research-panel`}>
          {/* Notes: quick notes / AI summaries / conclusions / action items */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground/80">Notes & research</p>
            <div className="space-y-1">
              {workspace.notes.length === 0 && (
                <p className="text-xs text-muted-foreground" data-testid={`${testId}-notes-empty`}>
                  No notes saved yet.
                </p>
              )}
              {workspace.notes.map((note) => (
                <div key={note.id} className="flex items-start justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-note-${note.id}`}>
                  <div className="min-w-0 flex-1">
                    <span className="mr-1 rounded bg-indigo-500/10 px-1 text-[9px] uppercase text-indigo-400">{NOTE_KIND_LABELS[note.kind]}</span>
                    <p className="text-xs text-foreground/90">{note.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.id)}
                    aria-label="Delete note"
                    data-testid={`${testId}-note-delete-${note.id}`}
                  >
                    <X className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Select value={noteKind} onValueChange={(v) => setNoteKind(v as WorkspaceNoteKind)}>
                <SelectTrigger className="h-8 w-36 text-xs" data-testid={`${testId}-note-kind`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NOTE_KIND_LABELS) as WorkspaceNoteKind[]).map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {NOTE_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write a note…"
                className="min-h-8 flex-1 text-xs"
                data-testid={`${testId}-note-input`}
              />
              <Button type="button" size="sm" className="h-8 shrink-0" onClick={submitNote} data-testid={`${testId}-note-save`}>
                <StickyNote className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Files: references only */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground/80">Files (references)</p>
            <div className="space-y-1">
              {workspace.files.length === 0 && (
                <p className="text-xs text-muted-foreground" data-testid={`${testId}-files-empty`}>
                  No files attached yet.
                </p>
              )}
              {workspace.files.map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-file-${file.id}`}>
                  <a href={file.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 truncate text-xs text-indigo-400 hover:underline">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{file.fileName}</span>
                  </a>
                  <button type="button" onClick={() => onDeleteFile(file.id)} aria-label="Delete file reference" data-testid={`${testId}-file-delete-${file.id}`}>
                    <X className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="File name"
                className="h-8 w-32 text-xs"
                data-testid={`${testId}-file-name-input`}
              />
              <Input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="URL"
                className="h-8 flex-1 text-xs"
                data-testid={`${testId}-file-url-input`}
              />
              <Button type="button" size="sm" className="h-8 shrink-0" onClick={submitFile} data-testid={`${testId}-file-save`}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
