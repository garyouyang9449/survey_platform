import { NextResponse } from "next/server";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { goBack } from "@/lib/survey/session";

/**
 * POST /api/survey/back
 * Moves the survey cursor to the previous question (no-op on the first question
 * or after the survey has ended). Returns the resulting survey view.
 */
export async function POST() {
  const respondentId = await getOrCreateRespondentId();
  const view = await goBack(respondentId);
  return NextResponse.json({ ok: true, data: view });
}
