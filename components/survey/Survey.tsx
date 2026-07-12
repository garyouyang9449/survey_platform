"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchSurveyState, postAnswer, resetSurvey } from "@/lib/survey/client";
import type { SurveyView } from "@/lib/survey/session";
import { ProgressBar } from "./ProgressBar";
import { QuestionCard } from "./QuestionCard";
import { Disqualified } from "./Disqualified";
import { Qualified } from "./Qualified";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; view: SurveyView };

export function Survey() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSurveyState()
      .then((view) => active && setState({ phase: "ready", view }))
      .catch(
        (err) =>
          active &&
          setState({ phase: "error", message: (err as Error).message }),
      );
    return () => {
      active = false;
    };
  }, []);

  async function handleAnswer(values: string[]) {
    if (state.phase !== "ready") return;
    const questionId = state.view.question?.id;
    if (!questionId) return;
    setSubmitting(true);
    try {
      const view = await postAnswer(questionId, values);
      setState({ phase: "ready", view });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestart() {
    setSubmitting(true);
    try {
      const view = await resetSurvey();
      setState({ phase: "ready", view });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (state.phase === "loading") {
    return <CenteredMessage>Loading your survey…</CenteredMessage>;
  }

  if (state.phase === "error") {
    return (
      <CenteredMessage>
        <p className="mb-2 font-medium text-red-600">Something went wrong</p>
        <p className="text-sm text-neutral-500">{state.message}</p>
      </CenteredMessage>
    );
  }

  const { view } = state;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8 sm:py-16">
      {view.status === "in_progress" && (
        <div className="mb-10">
          <ProgressBar current={view.currentStep} total={view.totalQuestions} />
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          {view.status === "in_progress" && view.question && (
            <QuestionCard
              key={view.question.id}
              question={view.question}
              initialValues={view.answers[view.question.id] ?? []}
              submitting={submitting}
              onSubmit={handleAnswer}
            />
          )}

          {view.status === "terminated" && (
            <Disqualified
              key="disqualified"
              onRestart={handleRestart}
              restarting={submitting}
            />
          )}

          {view.status === "qualified" && view.segment && (
            <Qualified
              key="qualified"
              segment={view.segment}
              onContinue={() => {
                // Interview route is wired up in a later phase.
                window.location.href = "/interview";
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-5 text-center text-neutral-500"
    >
      {children}
    </motion.div>
  );
}
