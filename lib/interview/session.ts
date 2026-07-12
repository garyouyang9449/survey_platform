import { prisma } from "@/lib/db";
import type { Segment } from "@/lib/survey/questions";
import { getConversation, type ElevenLabsConversation, type TranscriptTurn } from "@/lib/elevenlabs";
import {
  guideForSegment,
  isValidQuestionId,
  requiredQuestionIds,
} from "./guide";
import { buildInitiation, type InterviewInitiation, type Progress } from "./resume";

export type InterviewStatus = "not_started" | "in_progress" | "completed";

export class NotQualifiedError extends Error {
  constructor() {
    super("Respondent has not qualified for an interview");
    this.name = "NotQualifiedError";
  }
}

export class AlreadyCompletedError extends Error {
  constructor() {
    super("Interview already completed");
    this.name = "AlreadyCompletedError";
  }
}

export class InterviewNotCompleteError extends Error {
  constructor() {
    super("Not all required questions have been answered");
    this.name = "InterviewNotCompleteError";
  }
}

export interface GuideItemView {
  id: string;
  text: string;
  topic: string;
  required: boolean;
  answered: boolean;
}

export interface InterviewView {
  status: InterviewStatus;
  segment: Segment;
  guide: GuideItemView[];
  answeredRequiredCount: number;
  requiredCount: number;
  allRequiredDone: boolean;
  hasPriorConversation: boolean;
  transcript: TranscriptTurn[] | null;
}

interface InterviewRow {
  segment: string;
  status: string;
  progress: unknown;
  conversationIds: unknown;
  transcript: unknown;
}

/** Resolve the respondent's segment, enforcing that they qualified. */
async function requireSegment(respondentId: string): Promise<Segment> {
  const survey = await prisma.surveySession.findUnique({
    where: { respondentId },
  });
  if (!survey || survey.status !== "qualified" || !survey.segment) {
    throw new NotQualifiedError();
  }
  return survey.segment as Segment;
}

function progressOf(row: InterviewRow | null): Progress {
  return (row?.progress as Progress) ?? {};
}

function conversationIdsOf(row: InterviewRow | null): string[] {
  return (row?.conversationIds as string[]) ?? [];
}

function buildView(segment: Segment, row: InterviewRow | null): InterviewView {
  const progress = progressOf(row);
  const guide = guideForSegment(segment).map((q) => ({
    id: q.id,
    text: q.text,
    topic: q.topic,
    required: q.required,
    answered: Boolean(progress[q.id]),
  }));
  const required = requiredQuestionIds(segment);
  const answeredRequired = required.filter((id) => progress[id]);
  return {
    status: (row?.status as InterviewStatus) ?? "not_started",
    segment,
    guide,
    answeredRequiredCount: answeredRequired.length,
    requiredCount: required.length,
    allRequiredDone: answeredRequired.length === required.length,
    hasPriorConversation: conversationIdsOf(row).length > 0,
    transcript: (row?.transcript as TranscriptTurn[] | null) ?? null,
  };
}

/** Read-only interview view (used for resume / progress polling). */
export async function getInterviewView(
  respondentId: string,
): Promise<InterviewView> {
  const segment = await requireSegment(respondentId);
  const row = await prisma.interview.findUnique({ where: { respondentId } });
  return buildView(segment, row);
}

/**
 * Begin or resume the interview. Creates the Interview row on first call,
 * marks it in_progress, and returns the initiation payload (dynamic variables
 * + first message) for the ElevenLabs session. Throws if the respondent hasn't
 * qualified or the interview is already completed.
 */
export async function beginInterview(
  respondentId: string,
): Promise<{ view: InterviewView; initiation: InterviewInitiation }> {
  const segment = await requireSegment(respondentId);
  const existing = await prisma.interview.findUnique({
    where: { respondentId },
  });

  if (existing?.status === "completed") {
    throw new AlreadyCompletedError();
  }

  const row = await prisma.interview.upsert({
    where: { respondentId },
    create: { respondentId, segment, status: "in_progress" },
    update: { status: "in_progress" },
  });

  const initiation = buildInitiation(segment, progressOf(row));
  return { view: buildView(segment, row), initiation };
}

/** Record a new ElevenLabs conversation id when a session connects. */
export async function recordConnection(
  respondentId: string,
  conversationId: string,
): Promise<void> {
  const row = await prisma.interview.findUnique({ where: { respondentId } });
  if (!row) return;
  const ids = conversationIdsOf(row);
  if (ids.includes(conversationId)) return;
  await prisma.interview.update({
    where: { respondentId },
    data: {
      conversationIds: [...ids, conversationId],
      status: "in_progress",
    },
  });
}

/** Mark a guide question answered (driven by the agent's client tool). */
export async function markAnswered(
  respondentId: string,
  questionId: string,
): Promise<InterviewView> {
  const segment = await requireSegment(respondentId);
  if (!isValidQuestionId(segment, questionId)) {
    throw new Error(`Invalid question id "${questionId}" for segment ${segment}`);
  }
  const row = await prisma.interview.findUnique({ where: { respondentId } });
  const progress = { ...progressOf(row), [questionId]: true };
  const updated = await prisma.interview.upsert({
    where: { respondentId },
    create: { respondentId, segment, status: "in_progress", progress },
    update: { progress },
  });
  return buildView(segment, updated);
}

/** Concatenate the transcripts of every conversation in order. */
export function stitchTranscript(
  conversations: ElevenLabsConversation[],
): TranscriptTurn[] {
  return conversations.flatMap((c) =>
    (c.transcript ?? []).filter((t) => t.message != null),
  );
}

/**
 * Finalize the interview: verify all required questions are answered, fetch and
 * stitch the transcript across all conversation segments, persist it, and mark
 * the interview completed. Polls briefly while ElevenLabs is still processing.
 */
export async function completeInterview(
  respondentId: string,
): Promise<InterviewView> {
  const segment = await requireSegment(respondentId);
  const row = await prisma.interview.findUnique({ where: { respondentId } });
  const view = buildView(segment, row);

  if (!view.allRequiredDone) {
    throw new InterviewNotCompleteError();
  }

  const ids = conversationIdsOf(row);
  const conversations: ElevenLabsConversation[] = [];
  for (const id of ids) {
    conversations.push(await fetchWhenReady(id));
  }
  const transcript = stitchTranscript(conversations);

  const updated = await prisma.interview.update({
    where: { respondentId },
    data: { transcript: transcript as unknown as object[], status: "completed" },
  });
  return buildView(segment, updated);
}

/** Fetch a conversation, retrying briefly while it is still processing. */
async function fetchWhenReady(
  conversationId: string,
  attempts = 4,
  delayMs = 1500,
): Promise<ElevenLabsConversation> {
  let last: ElevenLabsConversation | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await getConversation(conversationId);
    if (last.status !== "processing") return last;
    if (i < attempts - 1) await sleep(delayMs);
  }
  // Return whatever we have; a still-processing transcript is better than none.
  return last as ElevenLabsConversation;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
