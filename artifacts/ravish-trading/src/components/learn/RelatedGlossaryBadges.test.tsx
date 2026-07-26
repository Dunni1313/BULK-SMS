// v1.4.0, Sprint L1 — Learning Centre Foundation. Unit coverage for the
// shared glossary-badge component now reused by LessonRenderer.tsx,
// LearningPaths.tsx's plain fallback, and ExplainButton.tsx (previously
// three copy-pasted implementations of the same markup).

import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";
import { RelatedGlossaryBadges } from "./RelatedGlossaryBadges";

describe("RelatedGlossaryBadges", () => {
  it("renders one link per key, each resolving to the real glossary route", () => {
    renderWithClient(<RelatedGlossaryBadges keys={["delta", "gamma"]} />);
    const delta = screen.getByTestId("link-glossary-delta");
    const gamma = screen.getByTestId("link-glossary-gamma");
    expect(delta).toHaveAttribute("href", "/learn/glossary/delta");
    expect(gamma).toHaveAttribute("href", "/learn/glossary/gamma");
  });

  it("renders nothing (not even an empty wrapper) for an empty key list", () => {
    const { container } = renderWithClient(<RelatedGlossaryBadges keys={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("honours a custom testIdPrefix, so two instances on the same page never collide", () => {
    renderWithClient(<RelatedGlossaryBadges keys={["theta"]} testIdPrefix="link-explain-glossary" />);
    expect(screen.getByTestId("link-explain-glossary-theta")).toBeInTheDocument();
    expect(screen.queryByTestId("link-glossary-theta")).not.toBeInTheDocument();
  });
});
