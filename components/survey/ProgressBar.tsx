"use client";

import { motion } from "framer-motion";

export function ProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-400">
        <span>
          Question {Math.min(current + 1, total)} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/60 dark:bg-neutral-800">
        <motion.div
          className="h-full rounded-full bg-blue-600"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
