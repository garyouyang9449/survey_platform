"use client";

import { useEffect, useState } from "react";
import type { InterviewView } from "@/lib/interview/session";
import { fetchInterviewState } from "@/lib/interview/client";

type TranscriptTurn = { role: "user" | "agent"; message: string | null };

export function Results() {
  const [view, setView] = useState<InterviewView | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "none" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchInterviewState()
      .then((v) => {
        if (!active) return;
        if (v.status !== "completed") {
          setPhase("none");
          return;
        }
        setView(v);
        setPhase("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError((err as Error).message);
        setPhase("error");
      });
    return () => {
      active = false;
    };
  }, []);

  if (phase === "loading") return <Centered>Loading your transcript…</Centered>;
  if (phase === "error")
    return (
      <Centered>
        <p className="text-red-600">{error}</p>
      </Centered>
    );
  if (phase === "none" || !view)
    return (
      <Centered>
        <p className="mb-3 text-lg font-medium text-neutral-900 dark:text-neutral-100">
          No completed interview yet
        </p>
        <a
          href="/interview"
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to interview
        </a>
      </Centered>
    );

  const transcript = (view.transcript ?? []) as TranscriptTurn[];

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl dark:bg-green-950/50">
          ✅
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Interview complete — thank you!
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Your responses have been recorded. You can review or download your
          transcript below.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Transcript
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadJson(transcript)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => downloadText(transcript)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Download text
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        {transcript.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Transcript is still being processed. Refresh in a moment.
          </p>
        ) : (
          transcript.map((t, i) => (
            <div key={i}>
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {t.role === "agent" ? "Interviewer" : "You"}
              </p>
              <p className="text-sm text-neutral-800 dark:text-neutral-200">
                {t.message}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(transcript: TranscriptTurn[]) {
  downloadBlob(
    JSON.stringify(transcript, null, 2),
    "application/json",
    "interview-transcript.json",
  );
}

function downloadText(transcript: TranscriptTurn[]) {
  const text = transcript
    .map((t) => `${t.role === "agent" ? "Interviewer" : "You"}: ${t.message}`)
    .join("\n\n");
  downloadBlob(text, "text/plain", "interview-transcript.txt");
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-5 text-center text-neutral-500">
      {children}
    </div>
  );
}
