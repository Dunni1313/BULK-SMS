import {
  type ValueLesson,
  type ValueLessonsResponse,
  type GeneratedValueQuiz,
  type ValueQuizGradeResult,
  ValueLessonLevel,
} from "@workspace/api-client-react";

export function makeValueLesson(
  overrides: Partial<ValueLesson> = {},
): ValueLesson {
  return {
    id: "moats-101",
    title: "What Is an Economic Moat?",
    level: ValueLessonLevel.beginner,
    summary: "Durable competitive advantages that protect long-term returns.",
    body: [
      "A moat is the structural edge that lets a business fend off competitors for years.",
      "Common sources include switching costs, network effects, and intangible brands.",
    ],
    takeaway: "Buy businesses whose advantages widen over time, not erode.",
    ...overrides,
  };
}

export function makeValueLessonsResponse(
  overrides: Partial<ValueLessonsResponse> = {},
): ValueLessonsResponse {
  return {
    lessons: [
      makeValueLesson(),
      makeValueLesson({
        id: "valuation-201",
        title: "Estimating Intrinsic Value",
        level: ValueLessonLevel.intermediate,
        summary: "Anchor price to the cash a business can produce.",
        body: ["Discount future owner earnings back to today."],
        takeaway: "Pay clearly less than a conservative estimate of worth.",
      }),
    ],
    disclaimer: "SIMULATED — educational only. Not investment advice.",
    ...overrides,
  };
}

export function makeGeneratedValueQuiz(
  overrides: Partial<GeneratedValueQuiz> = {},
): GeneratedValueQuiz {
  return {
    quizId: "quiz-fixture-1",
    topic: "mixed",
    questions: [
      {
        id: "q1",
        prompt: "What best describes a wide economic moat?",
        options: [
          "A short-term price discount",
          "A durable structural advantage",
          "A high dividend yield",
          "A low P/E ratio",
        ],
      },
      {
        id: "q2",
        prompt: "Margin of safety primarily protects against what?",
        options: [
          "Estimation error and bad luck",
          "Short interest",
          "Index rebalancing",
          "Option assignment",
        ],
      },
    ],
    disclaimer: "SIMULATED — educational only. Not investment advice.",
    ...overrides,
  };
}

export function makeValueQuizGradeResult(
  overrides: Partial<ValueQuizGradeResult> = {},
): ValueQuizGradeResult {
  return {
    topic: "mixed",
    score: 1,
    total: 2,
    percent: 50,
    message: "Solid start — review the explanations below.",
    results: [
      {
        id: "q1",
        prompt: "What best describes a wide economic moat?",
        yourAnswer: 1,
        correctAnswer: 1,
        correct: true,
        explanation: "A moat is a durable structural advantage, not a temporary discount.",
      },
      {
        id: "q2",
        prompt: "Margin of safety primarily protects against what?",
        yourAnswer: 2,
        correctAnswer: 0,
        correct: false,
        explanation: "Margin of safety cushions estimation error and adverse outcomes.",
      },
    ],
    disclaimer: "SIMULATED — educational only. Not investment advice.",
    ...overrides,
  };
}
