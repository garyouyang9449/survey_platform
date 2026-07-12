"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { InterviewView } from "@/lib/interview/session";
import {
  completeInterview,
  fetchInterviewState,
  initInterview,
  markProgress,
  recordConnection,
} from "@/lib/interview/client";
import { ProgressChecklist } from "./ProgressChecklist";

type Phase =
  | "loading"
  | "not_qualified"
  | "ready"
  | "connecting"
  | "active"
  | "reconnect"
  | "finishing"
  | "error";

interface Turn {
  role: "user" | "agent";
  message: string;
}

export function Interview() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<InterviewView | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Guards against treating an intentional disconnect (finish) as a drop.
  const finishingRef = useRef(false);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      void recordConnection(conversationId);
      setPhase("active");
    },
    onDisconnect: (details) => {
      if (finishingRef.current) return;
      // Unexpected drop → offer resume with preserved context.
      if (details.reason === "error") {
        setPhase("reconnect");
      }
    },
    onError: (message) => {
      setError(message);
      setPhase("error");
    },
    onMessage: ({ message, role }) => {
      if (!message) return;
      setTranscript((prev) => [...prev, { role, message }]);
    },
    clientTools: {
      // The agent calls this after each guide question is answered.
      mark_question_answered: async ({
        question_id,
      }: {
        question_id: string;
      }) => {
        try {
          const updated = await markProgress(question_id);
          setView(updated);
          return "recorded";
        } catch {
          return "error";
        }
      },
    },
  });

  // Initial load: qualification + resume state.
  useEffect(() => {
    let active = true;
    fetchInterviewState()
      .then((v) => {
        if (!active) return;
        if (v.status === "completed") {
          window.location.href = "/results";
          return;
        }
        setView(v);
        setPhase("ready");
      })
      .catch((err) => {
        if (!active) return;
        const msg = (err as Error).message;
        if (/qualif/i.test(msg)) setPhase("not_qualified");
        else {
          setError(msg);
          setPhase("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    try {
      const init = await initInterview();
      setView(init.view);
      await conversation.startSession({
        conversationToken: init.conversationToken,
        connectionType: "webrtc",
        overrides: { agent: { firstMessage: init.firstMessage } },
        dynamicVariables: init.dynamicVariables,
      });
      // onConnect flips phase to "active".
    } catch (err) {
      setError(
        (err as Error).message ||
          "Could not start the interview. Please allow microphone access and try again.",
      );
      setPhase("error");
    }
  }, [conversation]);

  const finish = useCallback(async () => {
    finishingRef.current = true;
    setPhase("finishing");
    try {
      await conversation.endSession();
    } catch {
      /* ignore */
    }
    try {
      await completeInterview();
      window.location.href = "/results";
    } catch (err) {
      finishingRef.current = false;
      setError((err as Error).message);
      setPhase("error");
    }
  }, [conversation]);

  // ---- Render ----------------------------------------------------------

  if (phase === "loading") {
    return <Centered>Loading your interview…</Centered>;
  }

  if (phase === "not_qualified") {
    return (
      <Centered>
        <p className="mb-3 text-lg font-medium text-neutral-900 dark:text-neutral-100">
          Let&apos;s start with a few quick questions
        </p>
        <p className="mb-6 text-sm text-neutral-500">
          Please complete the screening survey first.
        </p>
        <a
          href="/"
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to survey
        </a>
      </Centered>
    );
  }

  const isConnected = conversation.status === "connected";
  const allRequiredDone = view?.allRequiredDone ?? false;

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-5xl gap-8 px-5 py-10 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col">
        <MicOrb
          speaking={conversation.isSpeaking}
          connected={isConnected}
          phase={phase}
        />

        <div className="mt-8 flex-1">
          <TranscriptView turns={transcript} />
        </div>

        <div className="mt-6 flex items-center gap-3">
          {(phase === "ready" || phase === "error") && (
            <button
              type="button"
              onClick={start}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {view?.hasPriorConversation ? "Resume interview" : "Start interview"}
            </button>
          )}

          {phase === "connecting" && (
            <span className="text-sm text-neutral-500">Connecting…</span>
          )}

          {phase === "reconnect" && (
            <button
              type="button"
              onClick={start}
              className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Reconnect &amp; resume
            </button>
          )}

          {phase === "active" && (
            <button
              type="button"
              onClick={finish}
              disabled={!allRequiredDone}
              title={
                allRequiredDone
                  ? "Finish and submit your interview"
                  : "Answer all questions before finishing"
              }
              className="rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Finish &amp; submit
            </button>
          )}

          {phase === "finishing" && (
            <span className="text-sm text-neutral-500">
              Saving your transcript…
            </span>
          )}

          {error && phase === "error" && (
            <span className="text-sm text-red-600">{error}</span>
          )}
        </div>

        {phase === "active" && !allRequiredDone && (
          <p className="mt-3 text-xs text-neutral-400">
            The interviewer will guide you through each question. Finish unlocks
            once all required questions are covered.
          </p>
        )}
      </div>

      <aside>
        {view && (
          <ProgressChecklist
            guide={view.guide}
            answeredRequiredCount={view.answeredRequiredCount}
            requiredCount={view.requiredCount}
          />
        )}
      </aside>
    </div>
  );
}

function MicOrb({
  speaking,
  connected,
  phase,
}: {
  speaking: boolean;
  connected: boolean;
  phase: Phase;
}) {
  const label = connected
    ? speaking
      ? "Interviewer is speaking…"
      : "Listening…"
    : phase === "connecting"
      ? "Connecting…"
      : "Ready when you are";
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50 py-16 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950">
      <div
        className={[
          "flex h-28 w-28 items-center justify-center rounded-full transition-all duration-300",
          connected
            ? speaking
              ? "scale-110 bg-blue-600 shadow-[0_0_0_16px_rgba(37,99,235,0.15)]"
              : "bg-blue-500 shadow-[0_0_0_10px_rgba(59,130,246,0.12)]"
            : "bg-neutral-300 dark:bg-neutral-700",
        ].join(" ")}
      >
        <span className="text-4xl" aria-hidden>
          🎙️
        </span>
      </div>
      <p className="mt-6 text-sm font-medium text-neutral-600 dark:text-neutral-300">
        {label}
      </p>
    </div>
  );
}

function TranscriptView({ turns }: { turns: Turn[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  if (turns.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        The live transcript will appear here as you talk.
      </p>
    );
  }

  return (
    <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
      {turns.map((t, i) => (
        <div
          key={i}
          className={t.role === "agent" ? "text-left" : "text-right"}
        >
          <span
            className={[
              "inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm",
              t.role === "agent"
                ? "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
                : "bg-blue-600 text-white",
            ].join(" ")}
          >
            {t.message}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-5 text-center text-neutral-500">
      {children}
    </div>
  );
}
