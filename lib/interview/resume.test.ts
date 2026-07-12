import { describe, expect, it } from "vitest";
import { buildInitiation, INTRO_MESSAGE } from "./resume";

describe("buildInitiation — fresh start", () => {
  it("uses the spec intro and marks nothing answered", () => {
    const init = buildInitiation("bmw_customer", {});
    expect(init.firstMessage).toBe(INTRO_MESSAGE);
    expect(init.dynamicVariables.segment).toBe("bmw_customer");
    expect(init.dynamicVariables.answered_questions).toBe("(none)");
    expect(init.dynamicVariables.remaining_questions).toContain("BMW");
    expect(init.dynamicVariables.resume_summary).toMatch(/start of the interview/i);
  });
});

describe("buildInitiation — resume", () => {
  it("greets with a welcome-back message naming the last topic and next topic", () => {
    const progress = {
      core_ownership_length: true,
      core_purchase_factors: true,
      core_satisfaction: true,
    };
    const init = buildInitiation("bmw_customer", progress);

    expect(init.firstMessage).toMatch(/^Welcome back!/);
    // last answered topic (satisfaction) referenced
    expect(init.firstMessage).toMatch(/satisfaction/i);
    // answered list contains the covered questions, remaining excludes them
    expect(init.dynamicVariables.answered_questions).toMatch(/satisfied/i);
    expect(init.dynamicVariables.remaining_questions).not.toMatch(/how long have you owned/i);
    expect(init.dynamicVariables.resume_summary).toMatch(/already answered 3/);
  });

  it("handles the near-complete case with a wrap-up message", () => {
    // Answer every required question for the segment.
    const progress: Record<string, boolean> = {
      core_ownership_length: true,
      core_purchase_factors: true,
      core_satisfaction: true,
      core_valued_features: true,
      core_issues: true,
      bmw_why_bmw: true,
      bmw_service_rating: true,
      bmw_model_love: true,
      bmw_repurchase: true,
      bmw_improvements: true,
      closing_anything_else: true,
    };
    const init = buildInitiation("bmw_customer", progress);
    expect(init.firstMessage).toMatch(/almost done|wrap up/i);
    expect(init.dynamicVariables.remaining_questions).toBe("(none)");
  });
});
