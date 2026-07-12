import { NextResponse } from "next/server";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { resetSurvey } from "@/lib/survey/session";

/**
 * POST /api/survey/reset
 * Clears the respondent's survey (and any interview) so they can start over.
 * Returns a fresh survey view.
 */
export async function POST() {
  const respondentId = await getOrCreateRespondentId();
  const view = await resetSurvey(respondentId);
  return NextResponse.json({ ok: true, data: view });
}
