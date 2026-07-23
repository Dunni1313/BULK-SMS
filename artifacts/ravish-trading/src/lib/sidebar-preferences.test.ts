// v1.1.0 — Sidebar Navigation Redesign. Persistence-layer unit tests.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SIDEBAR_STORAGE_KEY,
  defaultSidebarPreferences,
  loadSidebarPreferences,
  saveSidebarPreferences,
  type SidebarPreferences,
} from "./sidebar-preferences";
import { DEFAULT_PINNED_HREFS } from "./nav-items";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

describe("sidebar-preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(1280); // desktop by default across tests
  });

  describe("defaultSidebarPreferences", () => {
    it("starts with no explicitly-expanded groups and the suggested default pins", () => {
      const prefs = defaultSidebarPreferences();
      expect(prefs.expandedGroups).toEqual({});
      expect(prefs.pinnedHrefs).toEqual(DEFAULT_PINNED_HREFS);
    });

    it("defaults to full (non-compact) on a desktop-width viewport", () => {
      setViewportWidth(1280);
      expect(defaultSidebarPreferences().compact).toBe(false);
    });

    it("defaults to compact (a narrower sidebar) on a tablet-width viewport", () => {
      setViewportWidth(900);
      expect(defaultSidebarPreferences().compact).toBe(true);
    });

    it("defaults to full on a mobile-width viewport (the drawer takes over, not compact mode)", () => {
      setViewportWidth(400);
      expect(defaultSidebarPreferences().compact).toBe(false);
    });

    it("is exactly compact at 768px and exactly full again at 1024px (the two boundary values)", () => {
      setViewportWidth(768);
      expect(defaultSidebarPreferences().compact).toBe(true);
      setViewportWidth(1024);
      expect(defaultSidebarPreferences().compact).toBe(false);
    });
  });

  describe("loadSidebarPreferences / saveSidebarPreferences", () => {
    it("returns the default when nothing has ever been saved", () => {
      expect(loadSidebarPreferences()).toEqual(defaultSidebarPreferences());
    });

    it("round-trips a real saved preference exactly", () => {
      const prefs: SidebarPreferences = {
        expandedGroups: { "trading-workbench": true, "options-income-engine": false },
        compact: true,
        pinnedHrefs: ["/trades", "/journal"],
      };
      saveSidebarPreferences(prefs);
      expect(loadSidebarPreferences()).toEqual(prefs);
      expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe(JSON.stringify(prefs));
    });

    it("falls back to the default when the stored value is corrupt JSON", () => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "{not valid json");
      expect(loadSidebarPreferences()).toEqual(defaultSidebarPreferences());
    });

    it("falls back to the default when the stored value is valid JSON but the wrong shape", () => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ somethingElse: true }));
      expect(loadSidebarPreferences()).toEqual(defaultSidebarPreferences());
    });

    it("never throws when localStorage itself is unavailable (private browsing, quota)", () => {
      const getSpy = vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
        throw new Error("SecurityError: storage disabled");
      });
      const setSpy = vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => loadSidebarPreferences()).not.toThrow();
      expect(loadSidebarPreferences()).toEqual(defaultSidebarPreferences());
      expect(() => saveSidebarPreferences(defaultSidebarPreferences())).not.toThrow();
      getSpy.mockRestore();
      setSpy.mockRestore();
    });
  });
});
