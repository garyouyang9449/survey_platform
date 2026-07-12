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
  // DIAGNOSTIC: live audio levels (0–1) for the on-screen meters.
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);

  // Guards against treating an intentional disconnect (finish) as a drop.
  const finishingRef = useRef(false);

  // DIAGNOSTIC: rolling audio-flow counters, logged once per second.
  const audioInChunksRef = useRef(0); // agent audio chunks received (IN)
  const lastVadRef = useRef(0); // latest server VAD score on your mic (OUT)

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      console.log("[interview] onConnect", conversationId);
      void recordConnection(conversationId);
      setPhase("active");
    },
    onDisconnect: (details) => {
      console.log("[interview] onDisconnect", details);
      if (finishingRef.current) return;
      // Any unexpected drop should surface — previously non-"error" reasons
      // were swallowed, leaving the UI stuck on "Listening…" with no feedback.
      if (details.reason === "error") {
        setError(`Interview connection error: ${details.message}`);
        setPhase("reconnect");
      } else if (details.reason === "agent") {
        setError(
          `The interviewer ended the session (${
            details.closeReason ?? "no reason given"
          }).`,
        );
        setPhase("reconnect");
      }
      // reason === "user": an intentional client-side close; nothing to do.
    },
    onError: (message, context) => {
      console.error("[interview] onError", message, context);
      setError(message);
      setPhase("error");
    },
    onDebug: (info) => {
      console.log("[interview] onDebug", info);
    },
    onStatusChange: ({ status }) => {
      console.log("[interview] status", status);
    },
    onModeChange: ({ mode }) => {
      console.log("[interview] mode", mode);
    },
    // DIAGNOSTIC: agent audio arriving (audio IN). Counted; summarised each
    // second by the polling effect below to avoid console spam.
    onAudio: () => {
      audioInChunksRef.current += 1;
    },
    // DIAGNOSTIC: server voice-activity score on YOUR mic (audio OUT). > 0
    // means the agent's ASR is actually receiving your speech.
    onVadScore: ({ vadScore }) => {
      lastVadRef.current = vadScore;
    },
    onMessage: ({ message, role }) => {
      console.log("[interview] onMessage", role, message);
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

  // DIAGNOSTIC: while connected, poll the SDK's captured audio levels so we can
  // tell whether the mic is feeding audio in (OUT) and the agent audio is
  // coming back (IN). Also emits a compact console summary once per second.
  useEffect(() => {
    if (phase !== "active") return;
    let ticks = 0;
    const id = window.setInterval(() => {
      try {
        setInputLevel(conversation.getInputVolume());
        setOutputLevel(conversation.getOutputVolume());
      } catch {
        /* not available yet */
      }
      ticks += 1;
      if (ticks % 5 === 0) {
        // ~ once per second (200ms * 5)
        console.log("[interview] audio", {
          out_micVolume: Number(conversation.getInputVolume().toFixed(3)),
          out_vadScore: Number(lastVadRef.current.toFixed(3)),
          in_agentVolume: Number(conversation.getOutputVolume().toFixed(3)),
          in_agentChunksPerSec: audioInChunksRef.current,
          isSpeaking: conversation.isSpeaking,
          muted: conversation.isMuted,
        });
        audioInChunksRef.current = 0;
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, conversation]);

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

        {phase === "active" && (
          <AudioMeters
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            muted={conversation.isMuted}
          />
        )}

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

          {error && (phase === "error" || phase === "reconnect") && (
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

function AudioMeters({
  inputLevel,
  outputLevel,
  muted,
}: {
  inputLevel: number;
  outputLevel: number;
  muted: boolean;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-white/50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
      <Meter
        label={`Mic → agent (OUT)${muted ? " · MUTED" : ""}`}
        level={inputLevel}
        tone={muted ? "muted" : "in"}
      />
      <Meter label="Agent → you (IN)" level={outputLevel} tone="out" />
      <p className="text-[11px] leading-snug text-neutral-400">
        Speak: the OUT bar should move. When the interviewer talks, the IN bar
        should move. If a bar stays flat, that direction of audio isn&apos;t
        flowing.
      </p>
    </div>
  );
}

function Meter({
  label,
  level,
  tone,
}: {
  label: string;
  level: number;
  tone: "in" | "out" | "muted";
}) {
  const pct = Math.min(100, Math.round(level * 100 * 3)); // amplify for visibility
  const color =
    tone === "muted"
      ? "bg-red-500"
      : pct <= 3
        ? "bg-neutral-400"
        : tone === "in"
          ? "bg-green-500"
          : "bg-blue-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-neutral-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] duration-150 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
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
