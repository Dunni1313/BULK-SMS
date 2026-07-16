// Task #66 — Value Investing School: deterministic lessons + server-authoritative
// quiz bank. Mirrors the coach.ts quiz design (the answer key never leaves the
// server; the quizId encodes the question ids in base64url). Education ONLY.

import { CoachError } from "./coach.js";
import { VALUE_DISCLAIMER } from "./valueReport.js";

export interface ValueLesson {
  id: string;
  title: string;
  level: "beginner" | "intermediate" | "advanced";
  summary: string;
  body: string[];
  takeaway: string;
}

const LESSONS: ValueLesson[] = [
  {
    id: "circle-of-competence",
    title: "Circle of Competence",
    level: "beginner",
    summary: "Only invest in businesses you can actually understand.",
    body: [
      "Buffett's first filter is not valuation — it is understanding. If you cannot explain how a business makes money, how it will still be making money in ten years, and what could destroy it, it sits outside your circle of competence.",
      "The size of the circle matters far less than knowing its edge. A small, well-defined circle beats a large, fuzzy one.",
    ],
    takeaway: "Stay inside what you understand; 'too hard' is a perfectly good answer.",
  },
  {
    id: "economic-moats",
    title: "Economic Moats",
    level: "beginner",
    summary: "A durable competitive advantage protects returns from competition.",
    body: [
      "A moat is what lets a business sustain high returns on capital for years without competitors arbitraging them away.",
      "The five classic sources: intangible assets (brands, patents), switching costs, the network effect, cost advantages (scale), and efficient scale. The financial fingerprint of a real moat is durable, high ROIC.",
    ],
    takeaway: "No moat, no durable returns — the moat is the business's defense.",
  },
  {
    id: "margin-of-safety",
    title: "Margin of Safety",
    level: "beginner",
    summary: "Buy well below your estimate of intrinsic value.",
    body: [
      "Graham's central idea: since every valuation is an estimate, only buy when price is far enough below intrinsic value that you can be wrong and still not lose much.",
      "A 30% margin of safety means paying $70 for something you think is worth $100. The discount is your protection against bad luck and bad estimates.",
    ],
    takeaway: "Price is what you pay; value is what you get. Insist on a discount.",
  },
  {
    id: "owner-earnings",
    title: "Owner Earnings & Free Cash Flow",
    level: "intermediate",
    summary: "What an owner could actually take out of the business.",
    body: [
      "Reported net income includes accounting choices; owner earnings approximate the cash a passive owner could withdraw without harming the business — roughly operating cash flow minus the maintenance capex needed to keep it competitive.",
      "Consistent, growing free cash flow is the lifeblood of a value compounder; erratic or negative FCF is a red flag.",
    ],
    takeaway: "Follow the cash, not the headline EPS.",
  },
  {
    id: "mr-market",
    title: "Mr. Market",
    level: "beginner",
    summary: "Use the market's mood swings; don't be ruled by them.",
    body: [
      "Graham's parable: imagine a manic-depressive business partner who quotes you a price every day. Some days he is euphoric and overpays; some days he is despondent and sells cheap.",
      "You are free to ignore him — or to take advantage when his prices are absurd. The market exists to serve you, not to instruct you.",
    ],
    takeaway: "Volatility is opportunity, not risk, for the patient owner.",
  },
  {
    id: "intrinsic-value",
    title: "Intrinsic Value",
    level: "advanced",
    summary: "The discounted value of all future owner earnings.",
    body: [
      "Intrinsic value is the cash a business will produce over its life, discounted back to today. It is an estimate, not a precise number — better to be approximately right than precisely wrong.",
      "When the inputs (durable earnings, predictable growth) are missing, the honest answer is that intrinsic value is not estimable — never fabricate one.",
    ],
    takeaway: "If you can't estimate value honestly, say 'unavailable' and move on.",
  },
  {
    id: "quality-vs-price",
    title: "Wonderful Business at a Fair Price",
    level: "intermediate",
    summary: "Buffett's evolution from Graham's cigar butts.",
    body: [
      "Early Graham-style investing bought mediocre businesses very cheaply. Buffett, influenced by Munger, shifted to buying wonderful businesses at fair prices and holding them.",
      "A great business compounds value over time, so even a fair entry price can produce excellent long-term returns — but quality first, then price.",
    ],
    takeaway: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",
  },
];

export interface ValueLessonsResponse {
  lessons: ValueLesson[];
  disclaimer: string;
}

export function getValueLessons(): ValueLessonsResponse {
  return { lessons: LESSONS, disclaimer: VALUE_DISCLAIMER };
}

export function getValueLesson(id: string): ValueLesson {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw new CoachError("Unknown lesson", 404);
  return lesson;
}

// ─── Quiz ────────────────────────────────────────────────────────────────────
export type ValueQuizTopic = "moats" | "valuation" | "philosophy";

interface ValueQuizBankItem {
  id: string;
  topic: ValueQuizTopic;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const VALUE_QUIZ_BANK: ValueQuizBankItem[] = [
  {
    id: "m1",
    topic: "moats",
    prompt: "Which of these is the financial fingerprint of a durable economic moat?",
    options: ["Rapid share-count growth", "Sustained high returns on invested capital", "A low stock price", "Frequent dividend cuts"],
    correctIndex: 1,
    explanation: "A real moat lets a business sustain high ROIC for years because competitors cannot easily erode its advantage.",
  },
  {
    id: "m2",
    topic: "moats",
    prompt: "A company whose customers face high costs to switch to a rival has which type of moat?",
    options: ["Network effect", "Switching costs", "Efficient scale", "No moat"],
    correctIndex: 1,
    explanation: "Switching costs (data, integration, retraining) lock customers in and protect pricing power.",
  },
  {
    id: "m3",
    topic: "moats",
    prompt: "The 'network effect' moat means a product becomes more valuable as:",
    options: ["Interest rates fall", "More people use it", "The company issues more shares", "Costs rise"],
    correctIndex: 1,
    explanation: "Each additional user makes the network more valuable to every other user, reinforcing dominance.",
  },
  {
    id: "v1",
    topic: "valuation",
    prompt: "A 30% margin of safety means buying a $100-intrinsic-value business at roughly:",
    options: ["$130", "$100", "$70", "$30"],
    correctIndex: 2,
    explanation: "Paying $70 for $100 of value is a 30% discount — your buffer against errors and bad luck.",
  },
  {
    id: "v2",
    topic: "valuation",
    prompt: "When a business has no durable earnings or cash flow to anchor a valuation, the right move is to:",
    options: ["Invent a fair value anyway", "Mark intrinsic value 'unavailable'", "Assume it is worth the current price", "Double the P/E"],
    correctIndex: 1,
    explanation: "Honest valuation refuses to fabricate a number; 'unavailable' is the correct answer when inputs are insufficient.",
  },
  {
    id: "v3",
    topic: "valuation",
    prompt: "'Owner earnings' is closest to:",
    options: ["Revenue", "Net income exactly", "Operating cash flow minus maintenance capex", "Market capitalization"],
    correctIndex: 2,
    explanation: "Owner earnings approximate the cash an owner could withdraw without impairing the business's competitiveness.",
  },
  {
    id: "p1",
    topic: "philosophy",
    prompt: "In Graham's parable, 'Mr. Market' represents:",
    options: ["A reliable price oracle", "A moody partner whose quotes you may accept or ignore", "The Federal Reserve", "A brokerage fee"],
    correctIndex: 1,
    explanation: "Mr. Market offers a price daily; the intelligent investor uses his mood swings rather than being ruled by them.",
  },
  {
    id: "p2",
    topic: "philosophy",
    prompt: "Buffett's refined philosophy favors:",
    options: ["A fair company at a wonderful price", "A wonderful company at a fair price", "Any company at any price", "The cheapest stock available"],
    correctIndex: 1,
    explanation: "Influenced by Munger, Buffett prefers wonderful businesses at fair prices because quality compounds over time.",
  },
  {
    id: "p3",
    topic: "philosophy",
    prompt: "The 'circle of competence' principle says you should:",
    options: ["Invest only in businesses you understand", "Always diversify into every sector", "Buy whatever is trending", "Avoid all technology stocks"],
    correctIndex: 0,
    explanation: "Knowing the edge of your circle — and staying inside it — matters more than its size.",
  },
];

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ValueQuizQuestionPublic {
  id: string;
  prompt: string;
  options: string[];
}
export interface GeneratedValueQuiz {
  quizId: string;
  topic: string;
  questions: ValueQuizQuestionPublic[];
  disclaimer: string;
}

export function generateValueQuiz(topic: string, count: number): GeneratedValueQuiz {
  const seed = Date.now() >>> 0;
  const pool =
    topic === "moats" || topic === "valuation" || topic === "philosophy"
      ? VALUE_QUIZ_BANK.filter((q) => q.topic === topic)
      : VALUE_QUIZ_BANK;
  const n = Math.max(1, Math.min(count || 5, pool.length));
  const picked = shuffle(pool, seed).slice(0, n);
  const ids = picked.map((q) => q.id);
  const quizId = Buffer.from(JSON.stringify({ topic, ids })).toString("base64url");
  return {
    quizId,
    topic,
    questions: picked.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
    disclaimer: VALUE_DISCLAIMER,
  };
}

export interface ValueQuizGradeItem {
  id: string;
  prompt: string;
  yourAnswer: number;
  correctAnswer: number;
  correct: boolean;
  explanation: string;
}
export interface ValueQuizGradeResult {
  topic: string;
  score: number;
  total: number;
  percent: number;
  message: string;
  results: ValueQuizGradeItem[];
  disclaimer: string;
}

export function gradeValueQuiz(quizId: string, answers: number[]): ValueQuizGradeResult {
  let decoded: { topic: string; ids: string[] };
  try {
    decoded = JSON.parse(Buffer.from(quizId, "base64url").toString("utf8"));
  } catch {
    throw new CoachError("Invalid quizId", 400);
  }
  if (!decoded || !Array.isArray(decoded.ids)) throw new CoachError("Invalid quizId", 400);
  const items: ValueQuizGradeItem[] = decoded.ids.map((id, i) => {
    const q = VALUE_QUIZ_BANK.find((b) => b.id === id);
    if (!q) throw new CoachError("Unknown quiz question", 400);
    const yourAnswer = answers[i] ?? -1;
    return {
      id: q.id,
      prompt: q.prompt,
      yourAnswer,
      correctAnswer: q.correctIndex,
      correct: yourAnswer === q.correctIndex,
      explanation: q.explanation,
    };
  });
  const score = items.filter((i) => i.correct).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
  const message =
    percent >= 80
      ? "Excellent — you're thinking like a value investor."
      : percent >= 50
        ? "Good start. Review the lessons on the ones you missed."
        : "Keep studying — work through the Value Investing School lessons, then retry.";
  return {
    topic: decoded.topic,
    score,
    total,
    percent,
    message,
    results: items,
    disclaimer: VALUE_DISCLAIMER,
  };
}
