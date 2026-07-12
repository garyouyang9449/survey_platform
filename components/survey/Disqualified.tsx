"use client";

import { motion } from "framer-motion";

/** Polite screen-out shown when a respondent does not qualify. */
export function Disqualified() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full text-center"
    >
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-2xl dark:bg-neutral-800">
        🙏
      </div>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50">
        Thank you for your interest
      </h1>
      <p className="mx-auto max-w-md text-neutral-500">
        Based on your responses, you don&apos;t qualify for this particular
        study. We truly appreciate your time and hope to work with you on a
        future opportunity.
      </p>
    </motion.div>
  );
}
