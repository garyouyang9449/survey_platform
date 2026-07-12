import { NextResponse } from "next/server";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { getInterviewView, NotQualifiedError } from "@/lib/interview/session";

/**
 * GET /api/interview/state
 * Returns the interview view (segment, per-question progress, completion gate,
 * transcript) so the UI can rehydrate and resume.
 */
export async function GET() {
  const respondentId = await getOrCreateRespondentId();
  try {
    const view = await getInterviewView(respondentId);
    return NextResponse.json({ ok: true, data: view });
  } catch (err) {
    if (err instanceof NotQualifiedError) {
      return NextResponse.json(
        { ok: false, error: { code: "not_qualified", message: err.message } },
        { status: 403 },
      );
    }
    throw err;
  }
}
