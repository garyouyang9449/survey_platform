import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getSurveyView, submitAnswer, resetSurvey, goBack } from "./session";

async function newRespondent(): Promise<string> {
  const r = await prisma.respondent.create({ data: {} });
  return r.id;
}

beforeEach(async () => {
  await prisma.surveySession.deleteMany();
  await prisma.respondent.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getSurveyView", () => {
  it("returns a fresh survey for a new respondent", async () => {
    const id = await newRespondent();
    const view = await getSurveyView(id);
    expect(view.status).toBe("in_progress");
    expect(view.currentStep).toBe(0);
    expect(view.answers).toEqual({});
    expect(view.question?.id).toBe("age");
    expect(view.totalQuestions).toBe(4);
  });
});

describe("submitAnswer", () => {
  it("persists an answer and advances to the next question", async () => {
    const id = await newRespondent();
    const view = await submitAnswer(id, "age", ["25_34"]);
    expect(view.answers.age).toEqual(["25_34"]);
    expect(view.currentStep).toBe(1);
    expect(view.question?.id).toBe("income");

    // Reloading returns the persisted progress (resume).
    const reloaded = await getSurveyView(id);
    expect(reloaded.answers.age).toEqual(["25_34"]);
    expect(reloaded.question?.id).toBe("income");
  });

  it("drives a BMW owner to a qualified bmw_customer outcome", async () => {
    const id = await newRespondent();
    await submitAnswer(id, "age", ["35_44"]);
    await submitAnswer(id, "income", ["100k_149k"]);
    await submitAnswer(id, "owns_car", ["yes"]);
    const view = await submitAnswer(id, "brand", ["bmw"]);
    expect(view.status).toBe("qualified");
    expect(view.segment).toBe("bmw_customer");
    expect(view.question).toBeNull();
  });

  it("locks the session once terminated", async () => {
    const id = await newRespondent();
    const view = await submitAnswer(id, "age", ["under_18"]);
    expect(view.status).toBe("terminated");
    expect(view.question).toBeNull();
  });

  it("is idempotent: re-answering the same step does not double-advance", async () => {
    const id = await newRespondent();
    await submitAnswer(id, "age", ["25_34"]);
    const view = await submitAnswer(id, "age", ["35_44"]);
    expect(view.answers.age).toEqual(["35_44"]);
    expect(view.currentStep).toBe(1);
  });

  it("rejects an invalid option", async () => {
    const id = await newRespondent();
    await expect(submitAnswer(id, "age", ["bogus"])).rejects.toThrow();
  });
});

describe("goBack", () => {
  it("returns to the previous question with the prior answer intact", async () => {
    const id = await newRespondent();
    await submitAnswer(id, "age", ["25_34"]); // now on income (step 1)
    await submitAnswer(id, "income", ["50k_74k"]); // now on owns_car (step 2)

    const back = await goBack(id);
    expect(back.currentStep).toBe(1);
    expect(back.question?.id).toBe("income");
    expect(back.answers.income).toEqual(["50k_74k"]);

    // Persisted, so a reload also lands on the previous question.
    const reloaded = await getSurveyView(id);
    expect(reloaded.currentStep).toBe(1);
    expect(reloaded.question?.id).toBe("income");
  });

  it("lets the respondent change an earlier answer and move forward again", async () => {
    const id = await newRespondent();
    await submitAnswer(id, "age", ["25_34"]);
    await submitAnswer(id, "income", ["50k_74k"]); // on owns_car (step 2)
    await goBack(id); // back to income (step 1)

    const changed = await submitAnswer(id, "income", ["150k_plus"]);
    expect(changed.answers.income).toEqual(["150k_plus"]);
    expect(changed.currentStep).toBe(2);
    expect(changed.question?.id).toBe("owns_car");
  });

  it("is a no-op on the first question", async () => {
    const id = await newRespondent();
    await getSurveyView(id);
    const back = await goBack(id);
    expect(back.currentStep).toBe(0);
    expect(back.question?.id).toBe("age");
  });

  it("is a no-op once the survey has ended", async () => {
    const id = await newRespondent();
    await submitAnswer(id, "age", ["under_18"]); // terminated
    const back = await goBack(id);
    expect(back.status).toBe("terminated");
    expect(back.question).toBeNull();
  });
});

describe("resetSurvey", () => {
  it("clears a terminated session back to a fresh survey", async () => {
    const id = await newRespondent();
    await submitAnswer(id, "age", ["under_18"]);

    const view = await resetSurvey(id);
    expect(view.status).toBe("in_progress");
    expect(view.currentStep).toBe(0);
    expect(view.answers).toEqual({});
    expect(view.question?.id).toBe("age");

    // Persisted state is gone, so reloading also shows a fresh survey.
    const reloaded = await getSurveyView(id);
    expect(reloaded.status).toBe("in_progress");
    expect(reloaded.answers).toEqual({});
  });

  it("is safe to call when no session exists", async () => {
    const id = await newRespondent();
    const view = await resetSurvey(id);
    expect(view.status).toBe("in_progress");
  });
});
