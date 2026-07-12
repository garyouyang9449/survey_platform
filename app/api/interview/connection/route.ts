import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { recordConnection, NotQualifiedError } from "@/lib/interview/session";

const bodySchema = z.object({ conversationId: z.string().min(1) });

/**
 * POST /api/interview/connection
 * Records the ElevenLabs conversation id when a session connects, so it can be
 * included when stitching the final transcript across resumed sessions.
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
      { ok: false, error: { code: "invalid_body", message: "conversationId required" } },
      { status: 400 },
    );
  }

  try {
    await recordConnection(respondentId, parsed.data.conversationId);
    return NextResponse.json({ ok: true, data: { recorded: true } });
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
