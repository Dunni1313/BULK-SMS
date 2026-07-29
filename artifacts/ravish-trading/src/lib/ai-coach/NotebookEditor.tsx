// v1.5.0 Sprint 8 — AI Research Notebooks. The notebook's own content
// editor: notes (honestly plain-text — this codebase has no rich-text/
// WYSIWYG editor library, confirmed before building this component; a
// "rich-text notes" feature is delivered here as clearly-labelled,
// kind-tagged plain text rather than a fabricated rich-text experience),
// plus linked conversations and linked uploaded-file references (both
// reference-only — nothing here duplicates conversation or file storage,
// per the approved scope). Mirrors WorkspaceHeader.tsx's own established
// note/file form shape (Sprint 7) so the two content-editing surfaces feel
// like the same family of component.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyNote, X, MessageSquare, FileText, Link2 } from "lucide-react";
import type { AiNotebookDetail, NotebookNoteKind } from "./notebooksApi";

const NOTE_KIND_LABELS: Record<NotebookNoteKind, string> = {
  note: "Note",
  summary: "AI summary",
  finding: "Key finding",
  action_item: "Action item",
  reference: "Reference",
  saved_response: "Saved AI response",
};

export interface LinkableConversation {
  id: number;
  title: string;
}

export interface LinkableFile {
  id: number;
  fileName: string;
}

export interface NotebookEditorProps {
  notebook: AiNotebookDetail;
  onAddNote: (kind: NotebookNoteKind, content: string) => void | Promise<void>;
  onDeleteNote: (noteId: number) => void | Promise<void>;
  onLinkConversation?: (conversationId: number) => void | Promise<void>;
  onLinkFile?: (fileId: number) => void | Promise<void>;
  onRemoveLink?: (linkId: number) => void | Promise<void>;
  /** Conversations the caller's own page knows about and can offer to
   * link — this component never fetches its own conversation list. */
  linkableConversations?: LinkableConversation[];
  /** Uploaded-file references the caller's own page knows about (e.g. from
   * an associated workspace) — this component never fetches its own file
   * list. */
  linkableFiles?: LinkableFile[];
  testId?: string;
}

export function NotebookEditor({
  notebook,
  onAddNote,
  onDeleteNote,
  onLinkConversation,
  onLinkFile,
  onRemoveLink,
  linkableConversations,
  linkableFiles,
  testId = "notebook-editor",
}: NotebookEditorProps) {
  const [noteKind, setNoteKind] = useState<NotebookNoteKind>("note");
  const [noteDraft, setNoteDraft] = useState("");

  async function submitNote() {
    const content = noteDraft.trim();
    if (content.length === 0) return;
    await onAddNote(noteKind, content);
    setNoteDraft("");
  }

  const conversationLinks = notebook.links.filter((l) => l.linkType === "conversation");
  const fileLinks = notebook.links.filter((l) => l.linkType === "file");
  const alreadyLinkedConversationIds = new Set(conversationLinks.map((l) => l.conversation?.id));
  const alreadyLinkedFileIds = new Set(fileLinks.map((l) => l.file?.id));
  const availableConversations = (linkableConversations ?? []).filter((c) => !alreadyLinkedConversationIds.has(c.id));
  const availableFiles = (linkableFiles ?? []).filter((f) => !alreadyLinkedFileIds.has(f.id));

  return (
    <div className="space-y-3" data-testid={testId}>
      {/* Rich-text notes (honestly plain text) / AI summaries / findings / action items / references / saved AI responses */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground/80">Notes &amp; research</p>
        <div className="space-y-1">
          {notebook.notes.length === 0 && (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-notes-empty`}>
              No notes saved yet.
            </p>
          )}
          {notebook.notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-note-${note.id}`}>
              <div className="min-w-0 flex-1">
                <span className="mr-1 rounded bg-indigo-500/10 px-1 text-[9px] uppercase text-indigo-400">{NOTE_KIND_LABELS[note.kind]}</span>
                <p className="whitespace-pre-wrap text-xs text-foreground/90">{note.content}</p>
              </div>
              <button type="button" onClick={() => onDeleteNote(note.id)} aria-label="Delete note" data-testid={`${testId}-note-delete-${note.id}`}>
                <X className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <Select value={noteKind} onValueChange={(v) => setNoteKind(v as NotebookNoteKind)}>
            <SelectTrigger className="h-8 w-40 text-xs" data-testid={`${testId}-note-kind`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(NOTE_KIND_LABELS) as NotebookNoteKind[]).map((kind) => (
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

      {/* Linked conversations */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground/80">Linked conversations</p>
        <div className="space-y-1">
          {conversationLinks.length === 0 && (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-conversations-empty`}>
              No conversations linked yet.
            </p>
          )}
          {conversationLinks.map((link) => (
            <div key={link.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-conversation-link-${link.id}`}>
              <span className="flex min-w-0 items-center gap-1 truncate text-xs text-foreground/90">
                <MessageSquare className="h-3 w-3 shrink-0 text-indigo-400" />
                <span className="truncate">{link.conversation?.title}</span>
              </span>
              {onRemoveLink && (
                <button type="button" onClick={() => onRemoveLink(link.id)} aria-label="Unlink conversation" data-testid={`${testId}-conversation-unlink-${link.id}`}>
                  <X className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
        {onLinkConversation && availableConversations.length > 0 && (
          <Select onValueChange={(v) => onLinkConversation(Number(v))}>
            <SelectTrigger className="mt-2 h-8 text-xs" data-testid={`${testId}-link-conversation-select`}>
              <Link2 className="mr-1 h-3 w-3" />
              <SelectValue placeholder="Link a conversation…" />
            </SelectTrigger>
            <SelectContent>
              {availableConversations.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Linked uploaded files (references only) */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground/80">Linked files (references)</p>
        <div className="space-y-1">
          {fileLinks.length === 0 && (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-files-empty`}>
              No files linked yet.
            </p>
          )}
          {fileLinks.map((link) => (
            <div key={link.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-file-link-${link.id}`}>
              <a
                href={link.file?.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1 truncate text-xs text-indigo-400 hover:underline"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{link.file?.fileName}</span>
              </a>
              {onRemoveLink && (
                <button type="button" onClick={() => onRemoveLink(link.id)} aria-label="Unlink file" data-testid={`${testId}-file-unlink-${link.id}`}>
                  <X className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
        {onLinkFile && availableFiles.length > 0 && (
          <Select onValueChange={(v) => onLinkFile(Number(v))}>
            <SelectTrigger className="mt-2 h-8 text-xs" data-testid={`${testId}-link-file-select`}>
              <Link2 className="mr-1 h-3 w-3" />
              <SelectValue placeholder="Link a file…" />
            </SelectTrigger>
            <SelectContent>
              {availableFiles.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>
                  {f.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
