import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import {
  makeValueLessonsResponse,
  makeGeneratedValueQuiz,
  makeValueQuizGradeResult,
} from "@/test/fixtures/valueQuiz";

const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

type Lessons = ReturnType<typeof makeValueLessonsResponse>;
type Quiz = ReturnType<typeof makeGeneratedValueQuiz>;
type Result = ReturnType<typeof makeValueQuizGradeResult>;

type MutateCallbacks = {
  onSuccess?: (d: unknown) => void;
  onError?: (e: unknown) => void;
};

// Mutable state driving the mocked hooks. The generate/grade mutate spies read
// the current state at call time so each test can flip success/error and supply
// its own quiz/result before rendering.
const mockState = vi.hoisted(() => {
  const state = {
    lessons: undefined as Lessons | undefined,
    lessonsLoading: false,
    quiz: undefined as Quiz | undefined,
    result: undefined as Result | undefined,
    generateError: false,
    gradeError: false,
    generateMutate: vi.fn(),
    gradeMutate: vi.fn(),
  };
  state.generateMutate = vi.fn((_vars: unknown, cbs?: MutateCallbacks) =>
    state.generateError
      ? cbs?.onError?.(new Error("generate failed"))
      : cbs?.onSuccess?.(state.quiz),
  );
  state.gradeMutate = vi.fn((_vars: unknown, cbs?: MutateCallbacks) =>
    state.gradeError
      ? cbs?.onError?.(new Error("grade failed"))
      : cbs?.onSuccess?.(state.result),
  );
  return state;
});

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/api-client-react")
  >("@workspace/api-client-react");
  return {
    ...actual,
    useGetValueLessons: () => ({
      data: mockState.lessonsLoading ? undefined : mockState.lessons,
      isLoading: mockState.lessonsLoading,
    }),
    useGenerateValueQuiz: () => ({
      mutate: mockState.generateMutate,
      isPending: false,
    }),
    useGradeValueQuiz: () => ({
      mutate: mockState.gradeMutate,
      isPending: false,
    }),
  };
});

import ValueInvestingSchool from "./ValueInvestingSchool";

type MockOptions = {
  lessons?: Lessons;
  lessonsLoading?: boolean;
  quiz?: Quiz;
  result?: Result;
  generateError?: boolean;
  gradeError?: boolean;
};

function loadPageWithMocks(opts: MockOptions = {}) {
  const lessons = opts.lessons ?? makeValueLessonsResponse();
  const quiz = opts.quiz ?? makeGeneratedValueQuiz();
  const result = opts.result ?? makeValueQuizGradeResult();

  mockState.lessons = lessons;
  mockState.lessonsLoading = !!opts.lessonsLoading;
  mockState.quiz = quiz;
  mockState.result = result;
  mockState.generateError = !!opts.generateError;
  mockState.gradeError = !!opts.gradeError;

  renderWithClient(<ValueInvestingSchool />);
  return {
    generateMutate: mockState.generateMutate,
    gradeMutate: mockState.gradeMutate,
    quiz,
    result,
    lessons,
  };
}

beforeEach(() => {
  mockState.lessons = undefined;
  mockState.lessonsLoading = false;
  mockState.quiz = undefined;
  mockState.result = undefined;
  mockState.generateError = false;
  mockState.gradeError = false;
  mockState.generateMutate.mockClear();
  mockState.gradeMutate.mockClear();
  toastSpy.mockClear();
});

describe("ValueInvestingSchool — lessons", () => {
  it("renders template-sourced lesson prose, takeaway, and disclaimer", async () => {
    const { lessons } = loadPageWithMocks();

    expect(
      await screen.findByText(lessons.lessons[0].title),
    ).toBeInTheDocument();
    expect(screen.getByText(lessons.lessons[0].summary)).toBeInTheDocument();

    await userEvent.click(screen.getByText(lessons.lessons[0].title));

    expect(screen.getByText(lessons.lessons[0].body[0])).toBeInTheDocument();
    expect(screen.getByText(lessons.lessons[0].takeaway)).toBeInTheDocument();
    expect(screen.getByText(lessons.disclaimer)).toBeInTheDocument();
  });

  it("shows skeleton placeholders while lessons are loading", async () => {
    loadPageWithMocks({ lessonsLoading: true });

    await screen.findByText("Value Investing School");

    expect(
      screen.queryByText("What Is an Economic Moat?"),
    ).not.toBeInTheDocument();
  });
});

describe("ValueInvestingSchool — quiz", () => {
  it("renders the generated quiz questions after starting", async () => {
    const { generateMutate, quiz } = loadPageWithMocks();

    await userEvent.click(screen.getByRole("tab", { name: /quiz/i }));
    await userEvent.click(screen.getByRole("button", { name: /start quiz/i }));

    expect(generateMutate).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(new RegExp(quiz.questions[0].prompt)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(quiz.questions[1].prompt)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit answers/i }),
    ).toBeDisabled();
  });

  it("renders graded feedback with score, correct, and incorrect states", async () => {
    const { gradeMutate, quiz, result } = loadPageWithMocks();

    await userEvent.click(screen.getByRole("tab", { name: /quiz/i }));
    await userEvent.click(screen.getByRole("button", { name: /start quiz/i }));

    for (const q of quiz.questions) {
      await userEvent.click(screen.getByLabelText(q.options[0]));
    }

    const submit = screen.getByRole("button", { name: /submit answers/i });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(gradeMutate).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(`${result.score}/${result.total}`),
    ).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(result.message)).toBeInTheDocument();
    expect(
      screen.getByText(result.results[0].explanation),
    ).toBeInTheDocument();
    expect(
      screen.getByText(result.results[1].explanation),
    ).toBeInTheDocument();
  });

  it("returns to the start screen via New Quiz reset", async () => {
    const { result } = loadPageWithMocks();

    await userEvent.click(screen.getByRole("tab", { name: /quiz/i }));
    await userEvent.click(screen.getByRole("button", { name: /start quiz/i }));

    expect(
      screen.queryByRole("button", { name: /start quiz/i }),
    ).not.toBeInTheDocument();

    const quiz = makeGeneratedValueQuiz();
    for (const q of quiz.questions) {
      await userEvent.click(screen.getByLabelText(q.options[0]));
    }
    await userEvent.click(
      screen.getByRole("button", { name: /submit answers/i }),
    );
    expect(
      screen.getByText(`${result.score}/${result.total}`),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /new quiz/i }));
    expect(
      screen.getByRole("button", { name: /start quiz/i }),
    ).toBeInTheDocument();
  });

  it("shows a destructive toast and stays on the start screen when generating fails", async () => {
    const { generateMutate } = loadPageWithMocks({ generateError: true });

    await userEvent.click(screen.getByRole("tab", { name: /quiz/i }));
    await userEvent.click(screen.getByRole("button", { name: /start quiz/i }));

    expect(generateMutate).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith({
      title: "Failed to generate quiz",
      variant: "destructive",
    });
    expect(
      screen.getByRole("button", { name: /start quiz/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit answers/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a destructive toast and stays on the answers screen when grading fails", async () => {
    const { gradeMutate, quiz, result } = loadPageWithMocks({
      gradeError: true,
    });

    await userEvent.click(screen.getByRole("tab", { name: /quiz/i }));
    await userEvent.click(screen.getByRole("button", { name: /start quiz/i }));

    for (const q of quiz.questions) {
      await userEvent.click(screen.getByLabelText(q.options[0]));
    }
    await userEvent.click(
      screen.getByRole("button", { name: /submit answers/i }),
    );

    expect(gradeMutate).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith({
      title: "Failed to grade quiz",
      variant: "destructive",
    });
    expect(
      screen.getByRole("button", { name: /submit answers/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`${result.score}/${result.total}`),
    ).not.toBeInTheDocument();
  });
});
