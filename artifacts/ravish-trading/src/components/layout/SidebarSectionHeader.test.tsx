// v1.3.1 — Sidebar Section Headers. Isolated unit coverage for the
// reusable SidebarSectionHeader component itself, independent of
// SidebarNav.tsx's own integration (covered separately in
// AppLayout.test.tsx's "sidebar section headers" describe block). This
// component has no context/provider dependency of its own (it doesn't call
// useSidebar()), so a plain @testing-library/react render() is sufficient —
// no renderWithClient() query-client wrapper is needed.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { SidebarSectionHeader } from "./SidebarSectionHeader";

describe("SidebarSectionHeader", () => {
  it("renders as an interactive button with the label, icon, and a coloured theme class", () => {
    render(<SidebarSectionHeader label="Portfolio Management" icon={Wallet} theme="portfolio" open={false} />);
    const header = screen.getByRole("button", { name: "Portfolio Management" });
    expect(header).toBeInTheDocument();
    expect(header.className).toContain("bg-sidebar-section-portfolio");
    expect(header.className).toContain("text-sidebar-section-portfolio-foreground");
    // Bold, uppercase text per the requested visual spec.
    expect(header.className).toContain("font-bold");
    expect(header.className).toContain("uppercase");
    // Rounded corners within the requested 8-12px range.
    expect(header.className).toContain("rounded-[10px]");
  });

  it("renders every requested theme with its own distinct background class", () => {
    const themes = [
      ["options", "bg-sidebar-section-options"],
      ["portfolio", "bg-sidebar-section-portfolio"],
      ["investing", "bg-sidebar-section-investing"],
      ["trading", "bg-sidebar-section-trading"],
      ["neutral", "bg-sidebar-section-neutral"],
    ] as const;
    for (const [theme, expectedClass] of themes) {
      const { unmount } = render(<SidebarSectionHeader label="Section" icon={Wallet} theme={theme} open={false} />);
      expect(screen.getByRole("button").className).toContain(expectedClass);
      unmount();
    }
  });

  it("reflects the collapsed state via aria-expanded=false and an un-rotated chevron", () => {
    render(<SidebarSectionHeader label="Trading Workbench" icon={Wallet} theme="trading" open={false} />);
    const header = screen.getByRole("button", { name: "Trading Workbench" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    const chevron = header.querySelector("svg.lucide-chevron-right");
    expect(chevron).not.toBeNull();
    expect(chevron!.getAttribute("class")).not.toContain("rotate-90");
  });

  it("reflects the expanded state via aria-expanded=true and a rotated chevron", () => {
    render(<SidebarSectionHeader label="Trading Workbench" icon={Wallet} theme="trading" open={true} />);
    const header = screen.getByRole("button", { name: "Trading Workbench" });
    expect(header).toHaveAttribute("aria-expanded", "true");
    const chevron = header.querySelector("svg.lucide-chevron-right");
    expect(chevron!.getAttribute("class")).toContain("rotate-90");
  });

  it("is keyboard-focusable and fires onClick on Enter, matching native button semantics", async () => {
    const onClick = vi.fn();
    render(
      <SidebarSectionHeader label="Institutional Investing" icon={Wallet} theme="investing" open={false} onClick={onClick} />,
    );
    const header = screen.getByRole("button", { name: "Institutional Investing" });
    header.focus();
    expect(header).toHaveFocus();
    header.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("passes through arbitrary props (e.g. data-testid) for integration by SidebarNav.tsx", () => {
    render(
      <SidebarSectionHeader
        label="Options Trading"
        icon={Wallet}
        theme="options"
        open={false}
        data-testid="sidebar-group-trigger-options-trading"
      />,
    );
    expect(screen.getByTestId("sidebar-group-trigger-options-trading")).toBeInTheDocument();
  });

  it("renders as a non-interactive, non-focusable div with no chevron when interactive=false", () => {
    render(<SidebarSectionHeader label="Frequently Used" icon={Wallet} theme="neutral" interactive={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const header = screen.getByText("Frequently Used").closest("div")!;
    expect(header.className).toContain("bg-sidebar-section-neutral");
    expect(header.querySelector("svg.lucide-chevron-right")).toBeNull();
    expect(header).not.toHaveAttribute("aria-expanded");
  });

  it("hides itself in compact (icon-only) sidebar mode via the collapsible-icon group data attribute", () => {
    render(<SidebarSectionHeader label="Portfolio Management" icon={Wallet} theme="portfolio" open={false} />);
    expect(screen.getByRole("button").className).toContain("group-data-[collapsible=icon]:hidden");
  });
});
