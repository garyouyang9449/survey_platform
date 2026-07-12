"use client";

import { motion } from "framer-motion";
import type { Segment } from "@/lib/survey/questions";

const COPY: Record<Segment, string> = {
  bmw_customer: "As a BMW owner, we'd love to hear about your experience.",
  potential_customer:
    "We'd love to hear your perspective on the luxury car market.",
};

/**
 * Success bridge shown after qualification, before handing off to the voice
 * interview (Phase 4). For now it confirms the segment and offers a manual
 * continue; the automatic transition is wired up when the interview route lands.
 */
export function Qualified({
  segment,
  onContinue,
  onRestart,
  restarting,
}: {
  segment: Segment;
  onContinue?: () => void;
  onRestart?: () => void;
  restarting?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full text-center"
    >
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl dark:bg-green-950/50">
        🎉
      </div>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50">
        You&apos;re in!
      </h1>
      <p className="mx-auto mb-8 max-w-md text-neutral-500">
        {COPY[segment]} Next up is a short voice interview — about 10–15 minutes.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Start voice interview
        <span aria-hidden>→</span>
      </button>
      <p className="mt-4 text-xs text-neutral-400">
        You&apos;ll be asked to allow microphone access.
      </p>
      {onRestart && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onRestart}
            disabled={restarting}
            className="text-sm font-medium text-neutral-400 underline-offset-4 transition-colors hover:text-neutral-600 hover:underline disabled:opacity-50 dark:hover:text-neutral-300"
          >
            {restarting ? "Restarting…" : "Restart survey"}
          </button>
        </div>
      )}
    </motion.div>
  );
}
