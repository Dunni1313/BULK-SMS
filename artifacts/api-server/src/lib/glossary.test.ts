// AI Teacher & Learning Centre sprint — Glossary. Pure unit coverage, no
// database, no network: the glossary is a plain, deterministic
// TypeScript literal.

import { describe, it, expect } from "vitest";
import { GLOSSARY_TERMS, searchGlossary, getGlossaryTerm, glossaryCategories, type GlossaryCategory } from "./glossary.js";

describe("glossary content", () => {
  it("every term has a unique key", () => {
    const keys = GLOSSARY_TERMS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every term's relatedTermKeys reference real, existing glossary keys — never a dangling cross-reference", () => {
    const allKeys = new Set(GLOSSARY_TERMS.map((t) => t.key));
    for (const term of GLOSSARY_TERMS) {
      for (const relatedKey of term.relatedTermKeys) {
        expect(allKeys.has(relatedKey)).toBe(true);
      }
      expect(term.relatedTermKeys.includes(term.key)).toBe(false);
    }
  });

  it("every term has a non-empty definition and a valid category", () => {
    const categories = glossaryCategories();
    for (const term of GLOSSARY_TERMS) {
      expect(term.definition.length).toBeGreaterThan(10);
      expect(categories).toContain(term.category);
    }
  });

  it("covers at least one term per requested category", () => {
    const requested: GlossaryCategory[] = [
      "foundations",
      "greeks",
      "volatility",
      "strategies",
      "portfolio",
      "performance",
      "institutional",
    ];
    for (const category of requested) {
      expect(GLOSSARY_TERMS.some((t) => t.category === category)).toBe(true);
    }
  });
});

describe("getGlossaryTerm", () => {
  it("resolves a known term by key", () => {
    const term = getGlossaryTerm("delta");
    expect(term).not.toBeNull();
    expect(term!.term).toBe("Delta");
  });

  it("honestly returns null for an unknown key — never a fabricated term", () => {
    expect(getGlossaryTerm("not-a-real-term")).toBeNull();
  });
});

describe("searchGlossary", () => {
  it("with no arguments returns every term", () => {
    expect(searchGlossary()).toHaveLength(GLOSSARY_TERMS.length);
  });

  it("filters by category", () => {
    const results = searchGlossary(undefined, "greeks");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((t) => t.category === "greeks")).toBe(true);
  });

  it("filters by a case-insensitive free-text query against term and definition", () => {
    const byTerm = searchGlossary("delta");
    expect(byTerm.some((t) => t.key === "delta")).toBe(true);
    const byTermUpper = searchGlossary("DELTA");
    expect(byTermUpper).toEqual(byTerm);
  });

  it("combines a query and a category filter", () => {
    const results = searchGlossary("premium", "foundations");
    expect(results.every((t) => t.category === "foundations")).toBe(true);
    expect(results.every((t) => t.term.toLowerCase().includes("premium") || t.definition.toLowerCase().includes("premium"))).toBe(true);
  });

  it("returns an honestly-empty array for a query matching nothing — never a fabricated result", () => {
    expect(searchGlossary("this-term-does-not-exist-anywhere")).toEqual([]);
  });
});
