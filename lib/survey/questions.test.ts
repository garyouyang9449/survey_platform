import { describe, expect, it } from "vitest";
import { QUESTIONS, getQuestion, TOTAL_QUESTIONS } from "./questions";

describe("survey questions", () => {
  it("defines exactly the four screening questions in order", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      "age",
      "income",
      "owns_car",
      "brand",
    ]);
    expect(TOTAL_QUESTIONS).toBe(4);
  });

  it("marks Under 18 as terminate on the age question", () => {
    const age = getQuestion("age")!;
    expect(age.options.find((o) => o.value === "under_18")?.effect).toEqual({
      kind: "terminate",
    });
    // All other age brackets are neutral.
    expect(
      age.options.filter((o) => o.value !== "under_18").every((o) => !o.effect),
    ).toBe(true);
  });

  it("has no branching effects on the income question", () => {
    const income = getQuestion("income")!;
    expect(income.options.every((o) => !o.effect)).toBe(true);
    expect(income.options).toHaveLength(6);
  });

  it("terminates when the respondent does not own a car", () => {
    const owns = getQuestion("owns_car")!;
    expect(owns.options.find((o) => o.value === "no")?.effect).toEqual({
      kind: "terminate",
    });
    expect(owns.options.find((o) => o.value === "yes")?.effect).toBeUndefined();
  });

  it("encodes brand qualify/terminate rules per the spec", () => {
    const brand = getQuestion("brand")!;
    expect(brand.type).toBe("multi");
    expect(brand.options.find((o) => o.value === "bmw")?.effect).toEqual({
      kind: "qualify",
      segment: "bmw_customer",
    });
    for (const v of ["mercedes", "audi"]) {
      expect(brand.options.find((o) => o.value === v)?.effect).toEqual({
        kind: "qualify",
        segment: "potential_customer",
      });
    }
    for (const v of ["toyota", "honda", "ford", "tesla", "other"]) {
      expect(brand.options.find((o) => o.value === v)?.effect).toEqual({
        kind: "terminate",
      });
    }
  });
});
