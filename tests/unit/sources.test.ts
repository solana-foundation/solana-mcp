import { describe, expect, it } from "vitest";
import { ALL_SOURCES, getSourceById, sourcesForSection } from "../../lib/sources";

describe("sources catalogue", () => {
  it("loads all sources from the generated module", () => {
    expect(ALL_SOURCES.length).toBeGreaterThan(100);
    for (const s of ALL_SOURCES) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.use_cases.length).toBeGreaterThan(0);
      expect(s.sections.length).toBeGreaterThan(0);
    }
  });

  it("getSourceById finds and rejects ids", () => {
    const sample = ALL_SOURCES[0];
    expect(getSourceById(sample.id)?.id).toBe(sample.id);
    expect(getSourceById("definitely-not-a-real-source")).toBeUndefined();
  });

  it("sourcesForSection returns enabled sources tagged with the section", () => {
    const programs = sourcesForSection("programs");
    expect(programs.length).toBeGreaterThan(0);
    expect(programs.every(s => s.enabled && s.sections.includes("programs"))).toBe(true);
  });
});
