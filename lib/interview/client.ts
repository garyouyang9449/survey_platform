"use client";

import type { InterviewView } from "@/lib/interview/session";
import type { InterviewInitiation } from "@/lib/interview/resume";

export interface InitData {
  conversationToken: string;
  agentId: string;
  firstMessage: string;
  dynamicVariables: InterviewInitiation["dynamicVariables"];
  view: InterviewView;
}

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: { code: string; message: string } };

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as Ok<T> | Err;
  if (!json.ok) throw new Error(json.error.message);
  return json.data;
}

/** Begin or resume the interview; returns a fresh token + initiation payload. */
export async function initInterview(): Promise<InitData> {
  const res = await fetch("/api/interview/init", { method: "POST" });
  return parse<InitData>(res);
}

/** Read-only interview state (resume / progress). */
export async function fetchInterviewState(): Promise<InterviewView> {
  const res = await fetch("/api/interview/state", { cache: "no-store" });
  return parse<InterviewView>(res);
}

/** Record the ElevenLabs conversation id for the current session. */
export async function recordConnection(conversationId: string): Promise<void> {
  await fetch("/api/interview/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
}

/** Mark a guide question answered (called from the agent's client tool). */
export async function markProgress(questionId: string): Promise<InterviewView> {
  const res = await fetch("/api/interview/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId }),
  });
  return parse<InterviewView>(res);
}

/** Finalize the interview and fetch/stitch the transcript. */
export async function completeInterview(): Promise<InterviewView> {
  const res = await fetch("/api/interview/complete", { method: "POST" });
  return parse<InterviewView>(res);
}
