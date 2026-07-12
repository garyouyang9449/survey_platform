import {
  QUESTIONS,
  getQuestion,
  TOTAL_QUESTIONS,
  type Segment,
} from "./questions";

export type SurveyStatus = "in_progress" | "terminated" | "qualified";

export interface SurveyState {
  /** questionId -> selected option value(s). */
  answers: Record<string, string[]>;
  /** Index of the next question to present (0-based). */
  currentStep: number;
  status: SurveyStatus;
  segment: Segment | null;
}

export function initialState(): SurveyState {
  return { answers: {}, currentStep: 0, status: "in_progress", segment: null };
}

function questionIndex(questionId: string): number {
  return QUESTIONS.findIndex((q) => q.id === questionId);
}

/**
 * Validate a single answer against its question definition. Throws on any
 * malformed input so callers (API layer) can surface a 400.
 */
function validateAnswer(questionId: string, values: string[]): void {
  const question = getQuestion(questionId);
  if (!question) {
    throw new Error(`Unknown question: ${questionId}`);
  }
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`No selection provided for ${questionId}`);
  }
  if (question.type === "single" && values.length > 1) {
    throw new Error(`Question ${questionId} accepts a single selection`);
  }
  const allowed = new Set(question.options.map((o) => o.value));
  for (const v of values) {
    if (!allowed.has(v)) {
      throw new Error(`Invalid option "${v}" for ${questionId}`);
    }
  }
}

/**
 * Derive status + segment from the full set of answers. Evaluated in question
 * order so terminate short-circuits. Within the brand question, a qualifying
 * selection (BMW / Mercedes / Audi) overrides any terminate brand selected
 * alongside it, and BMW takes precedence over Mercedes/Audi.
 */
function evaluateOutcome(answers: Record<string, string[]>): {
  status: SurveyStatus;
  segment: Segment | null;
} {
  let segment: Segment | null = null;

  for (const question of QUESTIONS) {
    const selected = answers[question.id];
    if (!selected || selected.length === 0) {
      // Not yet answered — still in progress.
      return { status: "in_progress", segment };
    }

    const effects = question.options
      .filter((o) => selected.includes(o.value))
      .map((o) => o.effect)
      .filter((e): e is NonNullable<typeof e> => Boolean(e));

    const qualifies = effects.filter((e) => e.kind === "qualify");
    if (qualifies.length > 0) {
      // BMW precedence: bmw_customer wins over potential_customer.
      segment = qualifies.some((e) => e.segment === "bmw_customer")
        ? "bmw_customer"
        : "potential_customer";
      continue;
    }

    if (effects.some((e) => e.kind === "terminate")) {
      return { status: "terminated", segment: null };
    }
  }

  // Every question answered without terminating.
  const answeredAll = Object.keys(answers).length >= TOTAL_QUESTIONS;
  if (answeredAll && segment) {
    return { status: "qualified", segment };
  }
  return { status: "in_progress", segment };
}

/**
 * Pure survey reducer. Returns a new state; never mutates the input. Idempotent
 * with respect to re-answering an earlier question (does not double-advance).
 */
export function advance(
  state: SurveyState,
  questionId: string,
  values: string[],
): SurveyState {
  validateAnswer(questionId, values);

  const answers = { ...state.answers, [questionId]: [...values] };
  const idx = questionIndex(questionId);
  const currentStep = Math.max(state.currentStep, idx + 1);
  const { status, segment } = evaluateOutcome(answers);

  return { answers, currentStep, status, segment };
}
