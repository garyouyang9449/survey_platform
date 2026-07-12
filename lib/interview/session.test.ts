import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { Segment } from "@/lib/survey/questions";
import { requiredQuestionIds } from "./guide";
import {
  beginInterview,
  completeInterview,
  getInterviewView,
  markAnswered,
  recordConnection,
  stitchTranscript,
  NotQualifiedError,
  InterviewNotCompleteError,
  AlreadyCompletedError,
} from "./session";

async function qualifiedRespondent(segment: Segment): Promise<string> {
  const r = await prisma.respondent.create({ data: {} });
  await prisma.surveySession.create({
    data: {
      respondentId: r.id,
      status: "qualified",
      segment,
      currentStep: 4,
      answers: {},
    },
  });
  return r.id;
}

async function answerAllRequired(id: string, segment: Segment) {
  for (const qid of requiredQuestionIds(segment)) {
    await markAnswered(id, qid);
  }
}

beforeEach(async () => {
  process.env.ELEVENLABS_API_KEY = "sk_test_key";
  await prisma.interview.deleteMany();
  await prisma.surveySession.deleteMany();
  await prisma.respondent.deleteMany();
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await prisma.$disconnect();
});

describe("qualification guard", () => {
  it("throws for a respondent who has not qualified", async () => {
    const r = await prisma.respondent.create({ data: {} });
    await expect(getInterviewView(r.id)).rejects.toBeInstanceOf(NotQualifiedError);
  });
});

describe("beginInterview", () => {
  it("creates an in_progress interview with the fresh intro", async () => {
    const id = await qualifiedRespondent("bmw_customer");
    const { view, initiation } = await beginInterview(id);
    expect(view.status).toBe("in_progress");
    expect(view.segment).toBe("bmw_customer");
    expect(view.requiredCount).toBe(11);
    expect(view.allRequiredDone).toBe(false);
    expect(initiation.firstMessage).toMatch(/Thank you for participating/);
  });

  it("resumes with a welcome-back message after prior progress", async () => {
    const id = await qualifiedRespondent("bmw_customer");
    await beginInterview(id);
    await markAnswered(id, "core_ownership_length");

    const { initiation, view } = await beginInterview(id);
    expect(initiation.firstMessage).toMatch(/^Welcome back!/);
    expect(view.hasPriorConversation).toBe(false); // no connection recorded yet
  });

  it("refuses to restart a completed interview", async () => {
    const id = await qualifiedRespondent("potential_customer");
    await beginInterview(id);
    await answerAllRequired(id, "potential_customer");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ conversation_id: "c", status: "done", transcript: [] }),
          { status: 200 },
        ),
      ),
    );
    await recordConnection(id, "c");
    await completeInterview(id);

    await expect(beginInterview(id)).rejects.toBeInstanceOf(AlreadyCompletedError);
  });
});

describe("recordConnection", () => {
  it("appends unique conversation ids", async () => {
    const id = await qualifiedRespondent("bmw_customer");
    await beginInterview(id);
    await recordConnection(id, "conv_1");
    await recordConnection(id, "conv_1"); // dedup
    await recordConnection(id, "conv_2");
    const row = await prisma.interview.findUnique({ where: { respondentId: id } });
    expect(row?.conversationIds).toEqual(["conv_1", "conv_2"]);
  });
});

describe("markAnswered", () => {
  it("tracks progress and flips allRequiredDone when complete", async () => {
    const id = await qualifiedRespondent("bmw_customer");
    await beginInterview(id);

    const partial = await markAnswered(id, "core_satisfaction");
    expect(partial.answeredRequiredCount).toBe(1);
    expect(partial.allRequiredDone).toBe(false);

    await answerAllRequired(id, "bmw_customer");
    const done = await getInterviewView(id);
    expect(done.allRequiredDone).toBe(true);
  });

  it("rejects a question id that is not in the segment guide", async () => {
    const id = await qualifiedRespondent("bmw_customer");
    await beginInterview(id);
    await expect(markAnswered(id, "pot_perceptions")).rejects.toThrow();
    await expect(markAnswered(id, "bogus")).rejects.toThrow();
  });
});

describe("stitchTranscript", () => {
  it("concatenates transcripts in order and drops null messages", () => {
    const stitched = stitchTranscript([
      {
        conversation_id: "a",
        status: "done",
        transcript: [
          { role: "agent", message: "Hi" },
          { role: "user", message: null },
        ],
      },
      {
        conversation_id: "b",
        status: "done",
        transcript: [{ role: "user", message: "Hello again" }],
      },
    ]);
    expect(stitched.map((t) => t.message)).toEqual(["Hi", "Hello again"]);
  });
});

describe("completeInterview", () => {
  it("blocks completion until all required questions are answered", async () => {
    const id = await qualifiedRespondent("bmw_customer");
    await beginInterview(id);
    await markAnswered(id, "core_satisfaction");
    await expect(completeInterview(id)).rejects.toBeInstanceOf(
      InterviewNotCompleteError,
    );
  });

  it("fetches + stitches the transcript across conversations and marks completed", async () => {
    const id = await qualifiedRespondent("bmw_customer");
    await beginInterview(id);
    await answerAllRequired(id, "bmw_customer");
    await recordConnection(id, "conv_1");
    await recordConnection(id, "conv_2");

    const fetchMock = vi.fn((url: string) => {
      const isFirst = url.includes("conv_1");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            conversation_id: isFirst ? "conv_1" : "conv_2",
            status: "done",
            transcript: [
              { role: "agent", message: isFirst ? "part one" : "part two" },
            ],
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = await completeInterview(id);
    expect(view.status).toBe("completed");
    expect(view.transcript?.map((t) => t.message)).toEqual([
      "part one",
      "part two",
    ]);
  });
});
