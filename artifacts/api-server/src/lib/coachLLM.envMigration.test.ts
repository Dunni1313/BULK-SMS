// Sprint 2 — env var migration for coachLLM's provider selection.
//
// coachLLM.ts historically read a single OPENAI_API_KEY variable that could
// hold either an OpenAI key or (prefix-sniffed via "sk-ant-") an Anthropic
// key. This adds a correctly-separated ANTHROPIC_API_KEY while keeping the
// legacy OPENAI_API_KEY overload working (with a startup warning), so
// existing deployments aren't broken by the rename.
//
// coachLLM.ts caches its provider selection at module scope (`initialized`),
// so each scenario below resets the module registry and re-imports it fresh.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = {
      completions: {
        create: () =>
          Promise.resolve({ choices: [{ message: { content: "openai response" } }] }),
      },
    };
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = {
      create: () =>
        Promise.resolve({ content: [{ type: "text", text: "anthropic response" }] }),
    };
  },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("coachLLM provider selection — env var migration", () => {
  it("selects Anthropic when the new ANTHROPIC_API_KEY is set", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    const { llmAvailable, narrateFreeform } = await import("./coachLLM.js");
    expect(llmAvailable()).toBe(true);
    const n = await narrateFreeform("What is delta?", {}, "fallback text");
    expect(n.source).toBe("llm");
    expect(n.text).toContain("anthropic response");
  });

  it("selects OpenAI when OPENAI_API_KEY holds a correctly-named OpenAI key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-openai-key";
    const { llmAvailable, narrateFreeform } = await import("./coachLLM.js");
    expect(llmAvailable()).toBe(true);
    const n = await narrateFreeform("What is delta?", {}, "fallback text");
    expect(n.source).toBe("llm");
    expect(n.text).toContain("openai response");
  });

  it("legacy path: OPENAI_API_KEY holding an sk-ant- key still selects Anthropic, and logs a deprecation warning", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "sk-ant-legacy-test-key";
    const { logger } = await import("./logger.js");
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    const { llmAvailable, narrateFreeform } = await import("./coachLLM.js");
    expect(llmAvailable()).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    const n = await narrateFreeform("What is delta?", {}, "fallback text");
    expect(n.source).toBe("llm");
    expect(n.text).toContain("anthropic response");
    warnSpy.mockRestore();
  });

  it("no key set at all: provider stays unavailable, template fallback used", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { llmAvailable, narrateFreeform } = await import("./coachLLM.js");
    expect(llmAvailable()).toBe(false);
    const n = await narrateFreeform("What is delta?", {}, "fallback text");
    expect(n.source).toBe("template");
    expect(n.text).toContain("fallback text");
  });
});
