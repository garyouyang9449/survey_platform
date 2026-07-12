import { NextResponse } from "next/server";
import { getOrCreateRespondentId } from "@/lib/respondent";
import { getServerEnv } from "@/lib/env";
import { getConversationToken } from "@/lib/elevenlabs";
import {
  beginInterview,
  AlreadyCompletedError,
  NotQualifiedError,
} from "@/lib/interview/session";

/**
 * POST /api/interview/init
 * Begins or resumes the interview: returns a fresh WebRTC conversation token
 * plus the initiation payload (dynamic variables + first-message override) the
 * client feeds to useConversation().startSession().
 */
export async function POST() {
  const respondentId = await getOrCreateRespondentId();

  try {
    const { view, initiation } = await beginInterview(respondentId);
    const env = getServerEnv();
    const conversationToken = await getConversationToken(env.ELEVENLABS_AGENT_ID);

    return NextResponse.json({
      ok: true,
      data: {
        conversationToken,
        agentId: env.ELEVENLABS_AGENT_ID,
        firstMessage: initiation.firstMessage,
        dynamicVariables: initiation.dynamicVariables,
        view,
      },
    });
  } catch (err) {
    if (err instanceof NotQualifiedError) {
      return NextResponse.json(
        { ok: false, error: { code: "not_qualified", message: err.message } },
        { status: 403 },
      );
    }
    if (err instanceof AlreadyCompletedError) {
      return NextResponse.json(
        { ok: false, error: { code: "already_completed", message: err.message } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "init_failed",
          message: err instanceof Error ? err.message : "Failed to start interview",
        },
      },
      { status: 500 },
    );
  }
}
