import { prisma } from "@/lib/db";
import {
  advance,
  initialState,
  type SurveyState,
  type SurveyStatus,
} from "./logic";
import { QUESTIONS, TOTAL_QUESTIONS, type Question, type Segment } from "./questions";

/**
 * Serializable view of a respondent's survey progress, safe to return to the
 * client. `question` is the next question to present (null when the survey is
 * terminated or complete).
 */
export interface SurveyView {
  currentStep: number;
  totalQuestions: number;
  answers: Record<string, string[]>;
  status: SurveyStatus;
  segment: Segment | null;
  question: Question | null;
}

function nextQuestion(state: SurveyState): Question | null {
  if (state.status !== "in_progress") return null;
  return QUESTIONS[state.currentStep] ?? null;
}

function toView(state: SurveyState): SurveyView {
  return {
    currentStep: state.currentStep,
    totalQuestions: TOTAL_QUESTIONS,
    answers: state.answers,
    status: state.status,
    segment: state.segment,
    question: nextQuestion(state),
  };
}

function rowToState(row: {
  answers: unknown;
  currentStep: number;
  status: string;
  segment: string | null;
}): SurveyState {
  return {
    answers: (row.answers as Record<string, string[]>) ?? {},
    currentStep: row.currentStep,
    status: row.status as SurveyStatus,
    segment: (row.segment as Segment | null) ?? null,
  };
}

async function loadState(respondentId: string): Promise<SurveyState> {
  const row = await prisma.surveySession.findUnique({
    where: { respondentId },
  });
  return row ? rowToState(row) : initialState();
}

/** Read-only survey view for the given respondent (used for resume). */
export async function getSurveyView(respondentId: string): Promise<SurveyView> {
  return toView(await loadState(respondentId));
}

/**
 * Apply one answer and persist. Server-authoritative: outcome (terminate /
 * qualify / segment) is computed here, never trusted from the client. Answers
 * submitted after the survey has ended are ignored (returns current state).
 */
export async function submitAnswer(
  respondentId: string,
  questionId: string,
  values: string[],
): Promise<SurveyView> {
  const current = await loadState(respondentId);

  // Once terminated or qualified, the survey is locked.
  if (current.status !== "in_progress") {
    return toView(current);
  }

  const next = advance(current, questionId, values);

  await prisma.surveySession.upsert({
    where: { respondentId },
    create: {
      respondentId,
      answers: next.answers,
      currentStep: next.currentStep,
      status: next.status,
      segment: next.segment,
    },
    update: {
      answers: next.answers,
      currentStep: next.currentStep,
      status: next.status,
      segment: next.segment,
    },
  });

  return toView(next);
}

/**
 * Move the cursor back to the previous question so the respondent can review or
 * change an earlier answer. Answers are preserved (prefilled on the client).
 * No-op when already on the first question or once the survey has ended.
 */
export async function goBack(respondentId: string): Promise<SurveyView> {
  const current = await loadState(respondentId);

  if (current.status !== "in_progress" || current.currentStep <= 0) {
    return toView(current);
  }

  const next: SurveyState = {
    ...current,
    currentStep: current.currentStep - 1,
  };

  await prisma.surveySession.update({
    where: { respondentId },
    data: { currentStep: next.currentStep },
  });

  return toView(next);
}

/**
 * Clear a respondent's survey (and any associated interview) so they can start
 * over from the first question. Used by the "Start over" action on the
 * screen-out page. Returns a fresh survey view.
 */
export async function resetSurvey(respondentId: string): Promise<SurveyView> {
  await prisma.interview.deleteMany({ where: { respondentId } });
  await prisma.surveySession.deleteMany({ where: { respondentId } });
  return toView(initialState());
}
