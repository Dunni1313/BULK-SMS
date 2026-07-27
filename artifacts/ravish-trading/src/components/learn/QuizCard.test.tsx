// v1.4.0, Sprint L2B — QuizCard was extracted, unmodified, out of
// DeltaMasterclass.tsx (which had zero dedicated test coverage of its own)
// so LessonRenderer's new Knowledge Check section could reuse it — this is
// the first dedicated test coverage this component has ever had.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizCard, type QuizCardQuestion } from "./QuizCard";

const question: QuizCardQuestion = {
  prompt: "What does Delta measure?",
  options: ["Time decay", "Directional exposure", "Implied volatility", "Interest rate sensitivity"],
  correctIndex: 1,
  explanation: "Delta measures how much an option's price moves per $1 move in the underlying.",
};

describe("QuizCard", () => {
  it("renders the prompt and every option, with no feedback shown before answering", () => {
    render(<QuizCard question={question} index={0} />);
    expect(screen.getByTestId("quiz-card-0")).toHaveTextContent("What does Delta measure?");
    expect(screen.getByTestId("quiz-card-0-option-0")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-card-0-option-1")).toBeInTheDocument();
    expect(screen.queryByTestId("quiz-card-0-explanation")).not.toBeInTheDocument();
  });

  it("selecting the correct option shows the explanation and disables further picks", async () => {
    render(<QuizCard question={question} index={0} />);
    await userEvent.click(screen.getByTestId("quiz-card-0-option-1"));
    expect(screen.getByTestId("quiz-card-0-explanation")).toHaveTextContent(question.explanation);
    expect(screen.getByTestId("quiz-card-0-option-0")).toBeDisabled();
  });

  it("selecting a wrong option still shows the explanation, never fabricating a correct pick", async () => {
    render(<QuizCard question={question} index={0} />);
    await userEvent.click(screen.getByTestId("quiz-card-0-option-0"));
    expect(screen.getByTestId("quiz-card-0-explanation")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-card-0-option-1")).toBeInTheDocument();
  });

  it("Try again resets the question so it can be answered a second time", async () => {
    render(<QuizCard question={question} index={0} />);
    await userEvent.click(screen.getByTestId("quiz-card-0-option-0"));
    await userEvent.click(screen.getByText("Try again"));
    expect(screen.queryByTestId("quiz-card-0-explanation")).not.toBeInTheDocument();
    expect(screen.getByTestId("quiz-card-0-option-1")).not.toBeDisabled();
  });

  it("calls onAnswered with the correctness of the picked option, once per answer", async () => {
    const onAnswered = vi.fn();
    render(<QuizCard question={question} index={2} onAnswered={onAnswered} />);
    await userEvent.click(screen.getByTestId("quiz-card-2-option-1"));
    expect(onAnswered).toHaveBeenCalledWith(true);
  });

  it("calls onAnswered(false) when the picked option is wrong", async () => {
    const onAnswered = vi.fn();
    render(<QuizCard question={question} index={3} onAnswered={onAnswered} />);
    await userEvent.click(screen.getByTestId("quiz-card-3-option-0"));
    expect(onAnswered).toHaveBeenCalledWith(false);
  });
});
