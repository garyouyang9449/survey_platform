"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Question } from "@/lib/survey/questions";

export function QuestionCard({
  question,
  initialValues,
  submitting,
  onSubmit,
}: {
  question: Question;
  initialValues: string[];
  submitting: boolean;
  onSubmit: (values: string[]) => void;
}) {
  const isMulti = question.type === "multi";
  const [selected, setSelected] = useState<string[]>(initialValues);

  // Reset selection whenever we move to a different question.
  useEffect(() => {
    setSelected(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const choose = useCallback(
    (value: string) => {
      if (submitting) return;
      if (isMulti) {
        setSelected((prev) =>
          prev.includes(value)
            ? prev.filter((v) => v !== value)
            : [...prev, value],
        );
      } else {
        // Single-select commits immediately for a snappy, Typeform-like feel.
        setSelected([value]);
        onSubmit([value]);
      }
    },
    [isMulti, onSubmit, submitting],
  );

  const commitMulti = useCallback(() => {
    if (submitting || selected.length === 0) return;
    onSubmit(selected);
  }, [onSubmit, selected, submitting]);

  // Keyboard: number keys pick an option; Enter continues (multi-select).
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Enter" && isMulti) {
        commitMulti();
        return;
      }
      const n = Number(e.key);
      if (!Number.isNaN(n) && n >= 1 && n <= question.options.length) {
        choose(question.options[n - 1].value);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [choose, commitMulti, isMulti, question.options]);

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50">
        {question.prompt}
      </h1>
      {isMulti && (
        <p className="mb-6 text-sm text-neutral-500">Select all that apply.</p>
      )}
      {!isMulti && <div className="mb-6" />}

      <ul className="flex flex-col gap-3">
        {question.options.map((opt, i) => {
          const active = selected.includes(opt.value);
          return (
            <li key={opt.value}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => choose(opt.value)}
                aria-pressed={active}
                className={[
                  "group flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                  "disabled:cursor-not-allowed",
                  active
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                    : "border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-neutral-300 text-neutral-400 dark:border-neutral-700",
                  ].join(" ")}
                >
                  {active ? "✓" : i + 1}
                </span>
                <span className="text-base text-neutral-900 dark:text-neutral-100">
                  {opt.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {isMulti && (
        <button
          type="button"
          onClick={commitMulti}
          disabled={submitting || selected.length === 0}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          Continue
          <span className="text-xs opacity-70">↵</span>
        </button>
      )}
    </motion.div>
  );
}
