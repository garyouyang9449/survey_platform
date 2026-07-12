import { NextResponse } from "next/server";
import { getOrCreateRespondentId } from "@/lib/respondent";
import {
  completeInterview,
  InterviewNotCompleteError,
  NotQualifiedError,
} from "@/lib/interview/session";

/**
 * POST /api/interview/complete
 * Finalizes the interview: verifies all required questions are answered, fetches
 * and stitches the transcript across sessions, stores it, and marks completed.
 */
export async function POST() {
  const respondentId = await getOrCreateRespondentId();
  try {
    const view = await completeInterview(respondentId);
    return NextResponse.json({ ok: true, data: view });
  } catch (err) {
    if (err instanceof NotQualifiedError) {
      return NextResponse.json(
        { ok: false, error: { code: "not_qualified", message: err.message } },
        { status: 403 },
      );
    }
    if (err instanceof InterviewNotCompleteError) {
      return NextResponse.json(
        { ok: false, error: { code: "not_complete", message: err.message } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "complete_failed",
          message: err instanceof Error ? err.message : "Failed to complete",
        },
      },
      { status: 500 },
    );
  }
}
