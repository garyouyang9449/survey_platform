import type { Segment } from "@/lib/survey/questions";
import { guideForSegment, type GuideQuestion } from "./guide";

/** The spec's verbatim introduction, used as the first message on a fresh start. */
export const INTRO_MESSAGE =
  "Thank you for participating in our survey. I'm going to ask you 10-15 questions about your car ownership experience. This should take about 10-15 minutes. Are you ready to begin?";

export interface InterviewInitiation {
  dynamicVariables: {
    segment: Segment;
    answered_questions: string;
    remaining_questions: string;
    resume_summary: string;
  };
  firstMessage: string;
}

export type Progress = Record<string, boolean>;

function answered(guide: GuideQuestion[], progress: Progress): GuideQuestion[] {
  return guide.filter((q) => progress[q.id]);
}

function remaining(guide: GuideQuestion[], progress: Progress): GuideQuestion[] {
  // Only substantive (required) questions count as "remaining" to cover.
  return guide.filter((q) => q.required && !progress[q.id]);
}

function list(questions: GuideQuestion[]): string {
  return questions.length
    ? questions.map((q) => `- ${q.text}`).join("\n")
    : "(none)";
}

/**
 * Build the ElevenLabs conversation initiation payload for a start or resume.
 *
 * On a fresh start the agent opens with the spec intro. On resume, we inject
 * what's already been covered (so the agent skips it) and open with a
 * "welcome back" message that names the last topic discussed — the stateless
 * agent is fully re-hydrated from our server-side progress each time.
 */
export function buildInitiation(
  segment: Segment,
  progress: Progress,
): InterviewInitiation {
  const guide = guideForSegment(segment);
  const done = answered(guide, progress);
  const todo = remaining(guide, progress);
  const isResume = done.length > 0;

  const dynamicVariables = {
    segment,
    answered_questions: list(done),
    remaining_questions: list(todo),
    resume_summary: isResume
      ? `The respondent has already answered ${done.length} question(s). Do not repeat them. Continue with the remaining questions.`
      : "This is the start of the interview.",
  };

  if (!isResume) {
    return { dynamicVariables, firstMessage: INTRO_MESSAGE };
  }

  const lastTopic = done[done.length - 1]?.topic ?? "your vehicle";
  const nextTopic = todo[0]?.topic;
  const firstMessage = nextTopic
    ? `Welcome back! We were just discussing ${lastTopic}. Let's continue where we left off — next I'd like to ask about ${nextTopic}.`
    : `Welcome back! We were just discussing ${lastTopic}. We're almost done — just a couple of final thoughts to wrap up.`;

  return { dynamicVariables, firstMessage };
}
