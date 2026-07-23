// Phase 24 — Institutional Trading Engine Foundation.
//
// Education service boundary. Genuinely unfilled today: the Learning
// Centre (lib/learningPaths.ts) has a full Institutional Investing path
// (Phase 21, 9 topics) but no Engine 2 (trading) path of any kind — this
// was confirmed by direct inspection before writing this file, not
// assumed. The Learning Centre's own content model (LearningPath/
// LearningItemType, including its existing "coach" item type) is
// reusable as-is once a Trading path is authored; nothing about it is
// Engine-1-specific by construction.
//
// No content is added here — writing a real Trading Investing learning
// path is education-content work, not architecture, and is explicitly
// out of this foundation phase's scope. This file only names the gap and
// the reuse plan for whoever picks it up next.

export const TRADING_LEARNING_PATH_STATUS = "not_yet_authored" as const;
