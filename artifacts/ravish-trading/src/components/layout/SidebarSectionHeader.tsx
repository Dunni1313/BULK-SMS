// v1.3.1 — Sidebar Section Headers. A reusable, full-width coloured
// header bar for the sidebar's collapsible navigation sections, replacing
// SidebarNav.tsx's own previous plain-text GROUP_HEADER_CLASS string.
//
// Renders in two modes:
//   - interactive (the default): a <button> with aria-expanded, used as
//     the CollapsibleTrigger for each NAV_GROUPS section — wraps
//     React.forwardRef so Radix's asChild/Slot composition (which clones
//     this element with its own aria-expanded/data-state/onClick/ref) works
//     correctly, exactly like the plain <button> it replaces did.
//   - non-interactive (interactive={false}): a plain, non-focusable <div>,
//     used for the static "Frequently Used" pinned list, which has never
//     been collapsible and isn't becoming so here.
//
// Colour is chosen via the `theme` prop (see nav-items.ts's own
// NavigationGroup.theme field, the single source of truth for which
// group gets which theme) rather than hardcoded per group id here, so
// this component owns only presentation, never navigation data.

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarSectionTheme = "options" | "portfolio" | "investing" | "trading" | "neutral";

const THEME_CLASSES: Record<SidebarSectionTheme, string> = {
  options: "bg-sidebar-section-options text-sidebar-section-options-foreground",
  portfolio: "bg-sidebar-section-portfolio text-sidebar-section-portfolio-foreground",
  investing: "bg-sidebar-section-investing text-sidebar-section-investing-foreground",
  trading: "bg-sidebar-section-trading text-sidebar-section-trading-foreground",
  neutral: "bg-sidebar-section-neutral text-sidebar-section-neutral-foreground",
};

export interface SidebarSectionHeaderProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: LucideIcon;
  theme: SidebarSectionTheme;
  /** Whether this header renders as an interactive expand/collapse
   * trigger (aria-expanded + chevron) or a static, non-interactive
   * label. Defaults to true. */
  interactive?: boolean;
  /** The section's own current expanded state. Required when interactive;
   * ignored otherwise. */
  open?: boolean;
}

// Shared regardless of theme/mode: full-width bleed past the parent
// SidebarGroup's own p-2 padding (negative margin, no explicit width, so
// the box's default block auto-width naturally extends to fill the
// parent's full border box — see docs/v1.3.1-Sidebar-Section-Headers.md),
// bold uppercase text, a 10px radius (within the requested 8-12px range),
// consistent padding, and a smooth hover transition.
const BASE_CLASS =
  "-mx-2 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-xs font-bold tracking-wide uppercase outline-hidden transition-all duration-200 ease-out shadow-sm hover:brightness-110 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar group-data-[collapsible=icon]:hidden";

export const SidebarSectionHeader = React.forwardRef<HTMLButtonElement | HTMLDivElement, SidebarSectionHeaderProps>(
  ({ label, icon: Icon, theme, interactive = true, open, className, ...rest }, ref) => {
    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">{label}</span>
        {interactive ? (
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out", open && "rotate-90")}
            aria-hidden="true"
          />
        ) : null}
      </>
    );

    const sharedClassName = cn(BASE_CLASS, THEME_CLASSES[theme], className);

    if (!interactive) {
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          className={sharedClassName}
          {...(rest as React.HTMLAttributes<HTMLDivElement>)}
        >
          {content}
        </div>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={sharedClassName}
        aria-expanded={open}
        {...rest}
      >
        {content}
      </button>
    );
  },
);
SidebarSectionHeader.displayName = "SidebarSectionHeader";
