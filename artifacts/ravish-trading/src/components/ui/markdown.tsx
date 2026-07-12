import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

// Renders coach prose as markdown (bold, lists, headings, paragraphs, links,
// code, tables). Memoized so streaming re-renders only re-parse when the text
// actually grows — keeps token-by-token streaming smooth.
function MarkdownImpl({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-invert max-w-none",
        "prose-p:my-2 prose-p:leading-relaxed first:prose-p:mt-0 last:prose-p:mb-0",
        "prose-headings:font-semibold prose-headings:text-foreground prose-headings:mt-3 prose-headings:mb-1.5",
        "prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-h4:text-xs prose-h4:uppercase prose-h4:tracking-wider",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5 prose-li:my-0.5 prose-li:marker:text-indigo-400",
        "prose-a:text-indigo-400 prose-a:underline-offset-2 hover:prose-a:text-indigo-300",
        "prose-code:rounded prose-code:bg-secondary/60 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']",
        "prose-pre:rounded-md prose-pre:bg-secondary/60 prose-pre:border prose-pre:border-border",
        "prose-blockquote:border-l-2 prose-blockquote:border-indigo-500/50 prose-blockquote:pl-3 prose-blockquote:text-foreground/80 prose-blockquote:not-italic",
        "prose-hr:border-border prose-hr:my-3",
        "prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-th:border prose-td:border prose-th:border-border prose-td:border-border",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
