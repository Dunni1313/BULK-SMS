// v1.5.0 Sprint 9 — AI Strategy Builder. The strategy's own content
// editor: the 14 qualitative playbook sections (Market Context through
// AI Notes), each an inline-editable text area upserted via a single
// shared kind-discriminated endpoint (see routes/aiStrategies.ts's own
// header comment for the exact section-kind design), plus the 3
// reference-kind sections (Attachments/Research Links/Notebook
// References) — both notebook/conversation reference lookups reuse
// already-fetched lists the caller's own page supplies, never a second
// fetch from inside this component, mirroring NotebookEditor.tsx's own
// "reference-only, caller supplies linkable options" established shape
// (Sprint 8).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Pencil, Trash2, Link2, Paperclip, MessageSquare, FileText, BookOpen } from "lucide-react";
import type { AiStrategyDetail, AiStrategySection, StrategySectionKind, UpsertSectionInput } from "./strategiesApi";
import { QUALITATIVE_SECTION_KINDS, SECTION_LABELS } from "./strategiesApi";

export interface LinkableNotebook {
  id: number;
  title: string;
}

export interface LinkableConversation {
  id: number;
  title: string;
}

export interface LinkableFile {
  id: number;
  fileName: string;
}

export interface StrategyEditorProps {
  strategy: AiStrategyDetail;
  onUpsertSection: (input: UpsertSectionInput) => void | Promise<void>;
  onDeleteSection: (sectionId: number) => void | Promise<void>;
  linkableNotebooks?: LinkableNotebook[];
  linkableConversations?: LinkableConversation[];
  linkableFiles?: LinkableFile[];
  testId?: string;
}

function QualitativeSectionRow({
  kind,
  section,
  onSave,
  testId,
}: {
  kind: StrategySectionKind;
  section: AiStrategySection | undefined;
  onSave: (content: string) => void | Promise<void>;
  testId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(section?.content ?? "");

  function beginEdit() {
    setDraft(section?.content ?? "");
    setIsEditing(true);
  }

  async function submit() {
    const content = draft.trim();
    if (content.length === 0) return;
    await onSave(content);
    setIsEditing(false);
  }

  return (
    <div className="rounded-md border border-border/60 p-2" data-testid={testId}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/80">{SECTION_LABELS[kind]}</span>
        {!isEditing && (
          <button type="button" onClick={beginEdit} aria-label={`Edit ${SECTION_LABELS[kind]}`} data-testid={`${testId}-edit-toggle`}>
            <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-1.5">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Describe ${SECTION_LABELS[kind].toLowerCase()}…`}
            className="min-h-16 text-xs"
            data-testid={`${testId}-input`}
          />
          <div className="flex gap-1.5">
            <Button type="button" size="sm" className="h-7 text-xs" onClick={submit} data-testid={`${testId}-save`}>
              <Check className="mr-1 h-3.5 w-3.5" />
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsEditing(false)} data-testid={`${testId}-cancel`}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : section?.content ? (
        <p className="whitespace-pre-wrap text-xs text-foreground/90" data-testid={`${testId}-content`}>
          {section.content}
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground" data-testid={`${testId}-empty`}>
          Not defined yet.
        </p>
      )}
    </div>
  );
}

export function StrategyEditor({
  strategy,
  onUpsertSection,
  onDeleteSection,
  linkableNotebooks,
  linkableConversations,
  linkableFiles,
  testId = "strategy-editor",
}: StrategyEditorProps) {
  const [linkDraft, setLinkDraft] = useState("");
  const [attachmentDraft, setAttachmentDraft] = useState("");

  const sectionByKind = new Map(strategy.sections.filter((s) => s.kind !== "attachment" && s.kind !== "research_link" && s.kind !== "notebook_reference").map((s) => [s.kind, s]));
  const attachments = strategy.sections.filter((s) => s.kind === "attachment");
  const researchLinks = strategy.sections.filter((s) => s.kind === "research_link");
  const notebookRefs = strategy.sections.filter((s) => s.kind === "notebook_reference");

  const alreadyLinkedNotebookIds = new Set(notebookRefs.map((s) => s.notebook?.id));
  const alreadyLinkedConversationIds = new Set(notebookRefs.map((s) => s.conversation?.id));
  const availableNotebooks = (linkableNotebooks ?? []).filter((n) => !alreadyLinkedNotebookIds.has(n.id));
  const availableConversations = (linkableConversations ?? []).filter((c) => !alreadyLinkedConversationIds.has(c.id));

  async function submitResearchLink() {
    const content = linkDraft.trim();
    if (content.length === 0) return;
    await onUpsertSection({ kind: "research_link", content });
    setLinkDraft("");
  }

  async function submitAttachment() {
    const content = attachmentDraft.trim();
    if (content.length === 0) return;
    await onUpsertSection({ kind: "attachment", content });
    setAttachmentDraft("");
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      {/* 14 qualitative playbook sections */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUALITATIVE_SECTION_KINDS.map((kind) => (
          <QualitativeSectionRow
            key={kind}
            kind={kind}
            section={sectionByKind.get(kind)}
            onSave={(content) => onUpsertSection({ kind, content })}
            testId={`${testId}-section-${kind}`}
          />
        ))}
      </div>

      {/* Attachments */}
      <div>
        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground/80">
          <Paperclip className="h-3 w-3" />
          Attachments
        </p>
        <div className="space-y-1">
          {attachments.length === 0 && (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-attachments-empty`}>
              No attachments referenced yet.
            </p>
          )}
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-attachment-${a.id}`}>
              <span className="flex min-w-0 items-center gap-1 truncate text-xs text-foreground/90">
                <FileText className="h-3 w-3 shrink-0 text-indigo-400" />
                {a.file ? <span className="truncate">{a.file.fileName}</span> : <span className="truncate">{a.content}</span>}
              </span>
              <button type="button" onClick={() => onDeleteSection(a.id)} aria-label="Remove attachment" data-testid={`${testId}-attachment-delete-${a.id}`}>
                <Trash2 className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <Input
            value={attachmentDraft}
            onChange={(e) => setAttachmentDraft(e.target.value)}
            placeholder="Attachment name or URL…"
            className="h-8 flex-1 text-xs"
            data-testid={`${testId}-attachment-input`}
          />
          <Button type="button" size="sm" className="h-8 shrink-0" onClick={submitAttachment} data-testid={`${testId}-attachment-save`}>
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
        </div>
        {linkableFiles && linkableFiles.length > 0 && (
          <Select onValueChange={(v) => onUpsertSection({ kind: "attachment", refFileId: Number(v) })}>
            <SelectTrigger className="mt-1.5 h-8 text-xs" data-testid={`${testId}-attachment-file-select`}>
              <Link2 className="mr-1 h-3 w-3" />
              <SelectValue placeholder="Or reference a workspace file…" />
            </SelectTrigger>
            <SelectContent>
              {linkableFiles.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>
                  {f.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Research links */}
      <div>
        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground/80">
          <Link2 className="h-3 w-3" />
          Research Links
        </p>
        <div className="space-y-1">
          {researchLinks.length === 0 && (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-research-links-empty`}>
              No research links added yet.
            </p>
          )}
          {researchLinks.map((link) => (
            <div key={link.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-research-link-${link.id}`}>
              <a href={link.content ?? undefined} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 truncate text-xs text-indigo-400 hover:underline">
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{link.content}</span>
              </a>
              <button type="button" onClick={() => onDeleteSection(link.id)} aria-label="Remove research link" data-testid={`${testId}-research-link-delete-${link.id}`}>
                <Trash2 className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <Input
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder="https://…"
            className="h-8 flex-1 text-xs"
            data-testid={`${testId}-research-link-input`}
          />
          <Button type="button" size="sm" className="h-8 shrink-0" onClick={submitResearchLink} data-testid={`${testId}-research-link-save`}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Notebook / conversation references */}
      <div>
        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground/80">
          <BookOpen className="h-3 w-3" />
          Notebook References
        </p>
        <div className="space-y-1">
          {notebookRefs.length === 0 && (
            <p className="text-xs text-muted-foreground" data-testid={`${testId}-notebook-refs-empty`}>
              No notebooks or conversations referenced yet.
            </p>
          )}
          {notebookRefs.map((ref) => (
            <div key={ref.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5" data-testid={`${testId}-notebook-ref-${ref.id}`}>
              <span className="flex min-w-0 items-center gap-1 truncate text-xs text-foreground/90">
                {ref.notebook ? <BookOpen className="h-3 w-3 shrink-0 text-indigo-400" /> : <MessageSquare className="h-3 w-3 shrink-0 text-indigo-400" />}
                <span className="truncate">{ref.notebook?.title ?? ref.conversation?.title}</span>
              </span>
              <button type="button" onClick={() => onDeleteSection(ref.id)} aria-label="Remove reference" data-testid={`${testId}-notebook-ref-delete-${ref.id}`}>
                <Trash2 className="h-3 w-3 shrink-0 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {availableNotebooks.length > 0 && (
            <Select onValueChange={(v) => onUpsertSection({ kind: "notebook_reference", refNotebookId: Number(v) })}>
              <SelectTrigger className="h-8 flex-1 text-xs" data-testid={`${testId}-link-notebook-select`}>
                <SelectValue placeholder="Link a notebook…" />
              </SelectTrigger>
              <SelectContent>
                {availableNotebooks.map((n) => (
                  <SelectItem key={n.id} value={String(n.id)}>
                    {n.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {availableConversations.length > 0 && (
            <Select onValueChange={(v) => onUpsertSection({ kind: "notebook_reference", refConversationId: Number(v) })}>
              <SelectTrigger className="h-8 flex-1 text-xs" data-testid={`${testId}-link-conversation-select`}>
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
      </div>
    </div>
  );
}
