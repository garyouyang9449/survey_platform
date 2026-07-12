import { NextResponse } from "next/server";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { getSurveyView } from "@/lib/survey/session";

/**
 * GET /api/survey/state
 * Returns the respondent's current survey progress so the UI can rehydrate on
 * load / resume. Creates the respondent (and cookie) on first call.
 */
export async function GET() {
  const respondentId = await getOrCreateRespondentId();
  const view = await getSurveyView(respondentId);
  return NextResponse.json({ ok: true, data: view });
}
