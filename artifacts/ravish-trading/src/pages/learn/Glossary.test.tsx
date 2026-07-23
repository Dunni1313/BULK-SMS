// AI Teacher & Learning Centre sprint — frontend smoke tests for the
// Glossary page. Follows the established mocked-generated-hook +
// wouter useParams mocking pattern (see TradeTicket.test.tsx).

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const paramsMock = vi.hoisted(() => ({ current: {} as Record<string, string> }));
const viewedMock = vi.hoisted(() => ({ mutate: vi.fn() }));

const glossaryFixture = [
  { key: "delta", term: "Delta", category: "greeks", definition: "Measures how much an option's price moves per $1 move in the underlying.", relatedTermKeys: ["gamma"], relatedLessonKeys: [] },
  { key: "gamma", term: "Gamma", category: "greeks", definition: "The rate of change of delta.", relatedTermKeys: ["delta"], relatedLessonKeys: [] },
  { key: "premium", term: "Premium", category: "foundations", definition: "The price of the option itself.", relatedTermKeys: [], relatedLessonKeys: [] },
];

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetGlossary: () => ({ data: glossaryFixture, isLoading: false }),
    useRecordLearningItemViewed: () => viewedMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: () => paramsMock.current,
  };
});

import Glossary from "./Glossary";

describe("Glossary", () => {
  it("renders every glossary term in the list view", async () => {
    paramsMock.current = {};
    renderWithClient(<Glossary />);
    expect(await screen.findByTestId("list-glossary-terms")).toBeInTheDocument();
    expect(screen.getByTestId("link-glossary-term-delta")).toBeInTheDocument();
    expect(screen.getByTestId("link-glossary-term-gamma")).toBeInTheDocument();
    expect(screen.getByTestId("link-glossary-term-premium")).toBeInTheDocument();
  });

  it("filters terms by a free-text search query", async () => {
    paramsMock.current = {};
    renderWithClient(<Glossary />);
    const input = screen.getByTestId("input-glossary-search");
    await userEvent.type(input, "premium");
    expect(screen.queryByTestId("link-glossary-term-delta")).not.toBeInTheDocument();
    expect(screen.getByTestId("link-glossary-term-premium")).toBeInTheDocument();
  });

  it("shows an honest empty state when nothing matches the search", async () => {
    paramsMock.current = {};
    renderWithClient(<Glossary />);
    const input = screen.getByTestId("input-glossary-search");
    await userEvent.type(input, "this-does-not-exist-anywhere");
    expect(await screen.findByTestId("text-glossary-empty")).toBeInTheDocument();
  });

  it("a deep link to a known term (/learn/glossary/:key) shows the focused-term card and records it viewed", async () => {
    paramsMock.current = { key: "delta" };
    renderWithClient(<Glossary />);
    const card = await screen.findByTestId("card-glossary-focused");
    expect(within(card).getByText("Delta")).toBeInTheDocument();
    expect(viewedMock.mutate).toHaveBeenCalledWith({ data: { itemType: "glossary", itemKey: "delta" } });
  });

  it("a deep link to an unknown term honestly shows a not-found message, never a fabricated term", async () => {
    paramsMock.current = { key: "not-a-real-term" };
    renderWithClient(<Glossary />);
    expect(await screen.findByTestId("text-glossary-not-found")).toBeInTheDocument();
  });
});
