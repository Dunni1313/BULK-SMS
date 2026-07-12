import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Guardrail: keep page tests on the reliable hoisted-`vi.mock` + static-import
 * pattern (see `src/pages/Trades.test.tsx`).
 *
 * The fragile alternative — per-test `vi.resetModules()` combined with
 * `vi.doMock()` and/or a dynamic `import("./Page")` — has repeatedly broken
 * under parallel CPU load. This test scans every other test file and fails fast
 * the moment that pattern reappears, before it can flake in CI.
 */

const SRC_DIR = path.resolve(import.meta.dirname, "..");
const THIS_FILE = path.resolve(import.meta.filename);

const RELIABLE_PATTERN_HINT =
  "Use the reliable pattern instead: a hoisted state object via `vi.hoisted()`, " +
  "a top-level `vi.mock(...)` that reads from it, and a STATIC `import Page from \"./Page\"`. " +
  "See artifacts/ravish-trading/src/pages/Trades.test.tsx for the reference.";

function collectTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTestFiles(full));
    } else if (/\.test\.tsx?$/.test(entry) && path.resolve(full) !== THIS_FILE) {
      out.push(full);
    }
  }
  return out;
}

// Strip line and block comments so a commented-out example can't trip the scan.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const RESET_MODULES = /\bvi\s*\.\s*resetModules\s*\(/;
const DO_MOCK = /\bvi\s*\.\s*doMock\s*\(/;
// Dynamic import of a sibling/relative module, e.g. `await import("./Page")`.
const DYNAMIC_RELATIVE_IMPORT = /\bimport\s*\(\s*["'`]\.{1,2}\//;

describe("page test pattern guardrail", () => {
  const testFiles = collectTestFiles(SRC_DIR);

  it("finds the test files to scan", () => {
    expect(testFiles.length).toBeGreaterThan(0);
  });

  it.each(testFiles)("%s avoids the flaky resetModules + doMock/dynamic-import pattern", (file) => {
    const source = stripComments(readFileSync(file, "utf8"));

    const usesResetModules = RESET_MODULES.test(source);
    const usesDoMock = DO_MOCK.test(source);
    const usesDynamicImport = DYNAMIC_RELATIVE_IMPORT.test(source);

    const isFragile = usesResetModules && (usesDoMock || usesDynamicImport);

    expect(
      isFragile,
      `${path.relative(SRC_DIR, file)} uses the flaky test pattern ` +
        `(vi.resetModules() together with ${usesDoMock ? "vi.doMock()" : ""}` +
        `${usesDoMock && usesDynamicImport ? " and " : ""}` +
        `${usesDynamicImport ? "a dynamic relative import()" : ""}). ` +
        RELIABLE_PATTERN_HINT,
    ).toBe(false);
  });
});
