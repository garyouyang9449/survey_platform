"use client";

import type { GuideItemView } from "@/lib/interview/session";

export function ProgressChecklist({
  guide,
  answeredRequiredCount,
  requiredCount,
}: {
  guide: GuideItemView[];
  answeredRequiredCount: number;
  requiredCount: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Interview progress
        </h2>
        <span className="text-xs font-medium text-neutral-500">
          {answeredRequiredCount}/{requiredCount} required
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {guide
          .filter((q) => q.required)
          .map((q) => (
            <li key={q.id} className="flex items-start gap-2.5">
              <span
                className={[
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  q.answered
                    ? "bg-green-600 text-white"
                    : "border border-neutral-300 text-transparent dark:border-neutral-700",
                ].join(" ")}
                aria-hidden
              >
                ✓
              </span>
              <span
                className={[
                  "text-sm capitalize",
                  q.answered
                    ? "text-neutral-400 line-through"
                    : "text-neutral-700 dark:text-neutral-300",
                ].join(" ")}
              >
                {q.topic}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
