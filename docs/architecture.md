# Architecture & Integration

A single Next.js (App Router) app on Vercel that takes a respondent from a
Typeform-style screening survey into an ElevenLabs voice interview and stores the
resulting transcript — as one cohesive product.

## Guiding principle: the server is the source of truth

Every consequential decision — screening outcome, segment, interview progress,
completion, transcript — is computed and stored server-side. ElevenLabs is
treated as a **stateless voice engine** that we re-hydrate on each connection.
This is what makes resumption reliable and keeps outcomes un-spoofable.

## Identity & session persistence

- On first visit, `proxy.ts` (Next 16's renamed Middleware) issues an httpOnly
  `respondent_id` cookie. The `Respondent` row is created lazily on the first API
  call (`lib/respondent.ts`).
- All state is keyed by `respondent_id`, so leaving and returning in the same
  browser resumes exactly where the user left off — across **both** the survey
  and the interview. (Resume is same-browser by design; no login.)

## Data model (Postgres via Prisma)

- `Respondent` — id + timestamps.
- `SurveySession` — `answers`, `currentStep` (cursor), `status`
  (`in_progress|terminated|qualified`), `segment`.
- `Interview` — `segment`, `status` (`not_started|in_progress|completed`),
  `progress` (`{questionId: true}`), `conversationIds` (array — see resumption),
  `transcript`.

## Part 1 — Survey

- Questions and branching are **data** (`lib/survey/questions.ts`) interpreted by
  a pure reducer (`lib/survey/logic.ts`): terminate/qualify effects, with BMW
  taking precedence (a BMW selection qualifies as `bmw_customer` even alongside a
  terminate brand). Fully unit-tested.
- The API (`/api/survey/*`) sends **one question at a time**; the client renders a
  Typeform-style card with transitions, progress, keyboard nav, Back, and Start
  Over. Idempotent writes; server computes the outcome.

## Part 2 — Voice interview

### Dynamic question routing
One agent, segment-driven. The system prompt contains both question blocks gated
on a `{{segment}}` dynamic variable; `lib/interview/guide.ts` is the single source
of the 12-item script (ids shared with the agent's client tool). No second agent
to keep in sync.

### Connection
`POST /api/interview/init` mints a short-lived **WebRTC conversation token**
server-side (API key never reaches the browser) and returns the initiation
payload. The client calls `useConversation().startSession({ conversationToken,
overrides, dynamicVariables, clientTools })`.

### Conversation resumption (stateless-agent + injected context)
ElevenLabs does not natively continue a dropped session with full memory, so on
every start/resume we re-hydrate a **fresh** conversation from our DB
(`lib/interview/resume.ts`):
- `dynamicVariables`: `segment`, `answered_questions`, `remaining_questions`,
  `resume_summary`.
- `overrides.agent.firstMessage`: the spec intro on a fresh start, or
  "Welcome back! We were just discussing {last topic}…" on resume.
Because each resume is a new ElevenLabs conversation, `Interview.conversationIds`
accumulates every conversation id so the final transcript can be stitched across
sessions. This survives tab-close, days-later returns, and mid-call drops (the UI
auto-offers Reconnect).

### Completion validation
Progress is deterministic: the agent calls the **client tool**
`mark_question_answered(question_id)` after each answered guide question →
`POST /api/interview/progress` (validated against the segment guide). The UI shows
a live checklist, and **Finish is blocked until all required questions are
answered** (`allRequiredDone`); `POST /api/interview/complete` re-checks the gate
server-side.

### Transcript management
On completion the server fetches each conversation via
`GET /v1/convai/conversations/{id}` (polling briefly while ElevenLabs is still
`processing`), stitches them in order, stores the result, and marks the interview
completed. `/results` displays it and offers JSON + plain-text download.

## End-to-end flow & cross-part resume

```
/ (survey) → qualify → /interview (Start → voice → progress) → Finish → /results
```
A returning user is routed to the right stage from their persisted state: an
in-progress survey resumes on its current question; a qualified user lands on the
interview (resuming with "Welcome back" if a session already started); a completed
interview shows the transcript.

## Reliability & edge cases

- Server-authoritative outcomes; idempotent writes.
- Screen-outs short-circuit before the interview; `/interview` returns 403 for
  unqualified respondents.
- Unexpected disconnects preserve state and surface a Reconnect/Resume action.
- Transcript fetch tolerates ElevenLabs `processing` latency with bounded polling.

## Testing

60 automated tests (Vitest): pure survey logic, interview guide/resume builders,
ElevenLabs client (mocked fetch), and DB-backed integration for survey + interview
services (progress gating, completion, transcript stitching). DB tests run
serially against a real Postgres.

## Notable trade-offs

- **Same-browser resume** (cookie) over cross-device login — frictionless for a
  survey; cross-device would need auth.
- **Stateless-agent resumption** over relying on ElevenLabs native continuation —
  more moving parts but robust and fully under our control.
- **Client-tool progress** over transcript parsing — real-time and deterministic,
  at the cost of depending on the agent to call the tool (mitigated by the
  server-side completion gate).
