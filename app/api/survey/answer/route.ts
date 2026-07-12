import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { submitAnswer } from "@/lib/survey/session";

const bodySchema = z.object({
  questionId: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
});

/**
 * POST /api/survey/answer
 * Body: { questionId, values }
 * Applies one answer server-side and returns the next survey view. Invalid
 * payloads or option values yield a 400; the survey outcome is authoritative.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Malformed JSON body" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_body", message: "questionId and values are required" },
      },
      { status: 400 },
    );
  }

  const respondentId = await getOrCreateRespondentId();

  try {
    const view = await submitAnswer(
      respondentId,
      parsed.data.questionId,
      parsed.data.values,
    );
    return NextResponse.json({ ok: true, data: view });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_answer",
          message: err instanceof Error ? err.message : "Invalid answer",
        },
      },
      { status: 400 },
    );
  }
}
