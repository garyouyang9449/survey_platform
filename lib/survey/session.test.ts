import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getSurveyView, submitAnswer } from "./session";

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
