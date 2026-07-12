import { describe, expect, it } from "vitest";
import {
  GUIDE,
  guideForSegment,
  requiredQuestionIds,
  isValidQuestionId,
} from "./guide";

describe("interview guide", () => {
  it("has unique question ids", () => {
    const ids = GUIDE.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks the intro as not required and everything else as required", () => {
    const intro = GUIDE.find((q) => q.id === "intro_ready")!;
    expect(intro.required).toBe(false);
    expect(GUIDE.filter((q) => q.id !== "intro_ready").every((q) => q.required)).toBe(
      true,
    );
  });

  it("builds the BMW customer guide: shared + 5 BMW questions, no potential questions", () => {
    const g = guideForSegment("bmw_customer");
    const ids = g.map((q) => q.id);
    expect(ids).toContain("intro_ready");
    expect(ids).toContain("core_satisfaction");
    expect(ids.filter((id) => id.startsWith("bmw_"))).toHaveLength(5);
    expect(ids.some((id) => id.startsWith("pot_"))).toBe(false);
    expect(ids).toContain("closing_anything_else");
  });

  it("builds the potential customer guide: shared + 5 potential questions, no BMW questions", () => {
    const g = guideForSegment("potential_customer");
    const ids = g.map((q) => q.id);
    expect(ids.filter((id) => id.startsWith("pot_"))).toHaveLength(5);
    expect(ids.some((id) => id.startsWith("bmw_"))).toBe(false);
  });

  it("required set excludes the intro and totals 11 per segment", () => {
    for (const seg of ["bmw_customer", "potential_customer"] as const) {
      const required = requiredQuestionIds(seg);
      expect(required).not.toContain("intro_ready");
      // 5 core + 5 segment + 1 closing
      expect(required).toHaveLength(11);
    }
  });

  it("validates question ids against the segment", () => {
    expect(isValidQuestionId("bmw_customer", "bmw_why_bmw")).toBe(true);
    expect(isValidQuestionId("bmw_customer", "pot_perceptions")).toBe(false);
    expect(isValidQuestionId("potential_customer", "pot_perceptions")).toBe(true);
    expect(isValidQuestionId("bmw_customer", "nonexistent")).toBe(false);
  });
});
