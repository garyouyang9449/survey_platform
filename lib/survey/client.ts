"use client";

import type { SurveyView } from "@/lib/survey/session";

async function parse(res: Response): Promise<SurveyView> {
  const json = (await res.json()) as
    | { ok: true; data: SurveyView }
    | { ok: false; error: { code: string; message: string } };
  if (!json.ok) {
    throw new Error(json.error.message);
  }
  return json.data;
}

/** Fetch the current survey state (rehydrate / resume). */
export async function fetchSurveyState(): Promise<SurveyView> {
  const res = await fetch("/api/survey/state", { cache: "no-store" });
  return parse(res);
}

/** Submit an answer and receive the next survey view. */
export async function postAnswer(
  questionId: string,
  values: string[],
): Promise<SurveyView> {
  const res = await fetch("/api/survey/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, values }),
  });
  return parse(res);
}
