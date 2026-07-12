import { describe, expect, it } from "vitest";
import { advance, initialState, type SurveyState } from "./logic";

// Helper to drive the survey through a sequence of answers.
function run(steps: Array<[string, string[]]>): SurveyState {
  let state = initialState();
  for (const [questionId, values] of steps) {
    state = advance(state, questionId, values);
  }
  return state;
}

describe("advance — terminate paths", () => {
  it("terminates immediately on Under 18", () => {
    const state = run([["age", ["under_18"]]]);
    expect(state.status).toBe("terminated");
    expect(state.segment).toBeNull();
  });

  it("terminates when the respondent does not own a car", () => {
    const state = run([
      ["age", ["25_34"]],
      ["income", ["50k_74k"]],
      ["owns_car", ["no"]],
    ]);
    expect(state.status).toBe("terminated");
  });

  it("terminates when only a terminate brand is selected", () => {
    const state = run([
      ["age", ["25_34"]],
      ["income", ["50k_74k"]],
      ["owns_car", ["yes"]],
      ["brand", ["toyota"]],
    ]);
    expect(state.status).toBe("terminated");
    expect(state.segment).toBeNull();
  });
});

describe("advance — qualification paths", () => {
  it("qualifies a BMW owner as bmw_customer", () => {
    const state = run([
      ["age", ["35_44"]],
      ["income", ["100k_149k"]],
      ["owns_car", ["yes"]],
      ["brand", ["bmw"]],
    ]);
    expect(state.status).toBe("qualified");
    expect(state.segment).toBe("bmw_customer");
  });

  it("qualifies a Mercedes owner as potential_customer", () => {
    const state = run([
      ["age", ["45_54"]],
      ["income", ["150k_plus"]],
      ["owns_car", ["yes"]],
      ["brand", ["mercedes"]],
    ]);
    expect(state.status).toBe("qualified");
    expect(state.segment).toBe("potential_customer");
  });

  it("qualifies an Audi owner as potential_customer", () => {
    const state = run([
      ["age", ["45_54"]],
      ["income", ["150k_plus"]],
      ["owns_car", ["yes"]],
      ["brand", ["audi"]],
    ]);
    expect(state.segment).toBe("potential_customer");
  });
});

describe("advance — mixed multi-select (BMW wins)", () => {
  it("BMW + Toyota qualifies as bmw_customer", () => {
    const state = run([
      ["age", ["25_34"]],
      ["income", ["50k_74k"]],
      ["owns_car", ["yes"]],
      ["brand", ["bmw", "toyota"]],
    ]);
    expect(state.status).toBe("qualified");
    expect(state.segment).toBe("bmw_customer");
  });

  it("Audi + Toyota qualifies as potential_customer", () => {
    const state = run([
      ["age", ["25_34"]],
      ["income", ["50k_74k"]],
      ["owns_car", ["yes"]],
      ["brand", ["audi", "toyota"]],
    ]);
    expect(state.status).toBe("qualified");
    expect(state.segment).toBe("potential_customer");
  });

  it("BMW takes precedence over Mercedes (bmw_customer)", () => {
    const state = run([
      ["age", ["25_34"]],
      ["income", ["50k_74k"]],
      ["owns_car", ["yes"]],
      ["brand", ["mercedes", "bmw"]],
    ]);
    expect(state.segment).toBe("bmw_customer");
  });
});

describe("advance — progression & bookkeeping", () => {
  it("records answers and advances the step on neutral answers", () => {
    const state = run([["age", ["25_34"]]]);
    expect(state.answers).toEqual({ age: ["25_34"] });
    expect(state.currentStep).toBe(1);
    expect(state.status).toBe("in_progress");
  });

  it("re-answering the same step overwrites without double-advancing", () => {
    let state = run([["age", ["25_34"]]]);
    expect(state.currentStep).toBe(1);
    state = advance(state, "age", ["35_44"]);
    expect(state.answers.age).toEqual(["35_44"]);
    expect(state.currentStep).toBe(1);
  });

  it("does not mutate the input state", () => {
    const before = initialState();
    const after = advance(before, "age", ["25_34"]);
    expect(before.answers).toEqual({});
    expect(after).not.toBe(before);
  });

  it("rejects an unknown question id", () => {
    expect(() => advance(initialState(), "nope", ["x"])).toThrowError();
  });

  it("rejects values not belonging to the question", () => {
    expect(() => advance(initialState(), "age", ["bogus"])).toThrowError();
  });

  it("rejects multiple values for a single-select question", () => {
    expect(() =>
      advance(initialState(), "age", ["25_34", "35_44"]),
    ).toThrowError();
  });
});
