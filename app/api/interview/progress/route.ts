import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { markAnswered, NotQualifiedError } from "@/lib/interview/session";

const bodySchema = z.object({ questionId: z.string().min(1) });

/**
 * POST /api/interview/progress
 * Marks a guide question answered. Driven by the agent's mark_question_answered
 * client tool. Validates the id against the respondent's segment guide.
 */
export async function POST(request: Request) {
  const respondentId = await getOrCreateRespondentId();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Malformed body" } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_body", message: "questionId required" } },
      { status: 400 },
    );
  }

  try {
    const view = await markAnswered(respondentId, parsed.data.questionId);
    return NextResponse.json({ ok: true, data: view });
  } catch (err) {
    if (err instanceof NotQualifiedError) {
      return NextResponse.json(
        { ok: false, error: { code: "not_qualified", message: err.message } },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_question",
          message: err instanceof Error ? err.message : "Invalid question",
        },
      },
      { status: 400 },
    );
  }
}
