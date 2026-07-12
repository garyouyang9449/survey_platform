# Implementation Plan: Survey → Voice Interview Platform

> Written for AI-agent execution: self-contained tasks, explicit contracts,
> verifiable acceptance criteria, and per-phase checkpoints. Execute
> top-to-bottom.

## Locked decisions (from brainstorming)

- **Stack:** Next.js 16 (App Router, TS) full-stack, deployed to Vercel.
- **Persistence:** Postgres (Neon in prod; local Docker Postgres in dev).
- **Identity:** anonymous `respondent_id` in an httpOnly cookie + localStorage
  mirror; no login.
- **ElevenLabs:** account created before Phase 3 (lowest paid tier,
  reimbursable).
- **Priority:** reliability + resumption first, then polished UI.
- **Resumption model:** stateless-agent + injected-context (our DB is the source
  of truth; ElevenLabs is re-hydrated on each start/resume).
- **Progress tracking:** agent **client tool** `mark_question_answered`.

## Execution rules (read first)

- Work **one task at a time, in order**. Each task lists files, contract, steps,
  and **Done-when** acceptance checks. Do not start a task until its
  dependencies pass.
- **TDD**: for every `lib/` logic module and API route, write the test first
  (Vitest), watch it fail, implement, watch it pass.
- **Never expose `ELEVENLABS_API_KEY` to the client.** All ElevenLabs REST calls
  happen in route handlers.
- **Server is the source of truth** for survey answers, segment, and interview
  progress. Client never computes terminate/segment/completion.
- After each phase, run `npm test && npm run build` and stop if red.
- Commit at the end of each phase with a conventional-commit message.

## Global conventions

- Stack: Next.js (App Router, TS), Tailwind, Prisma + Postgres, Vitest,
  `@elevenlabs/react`.
- IDs: `respondent_id` = uuid v4. All state keyed by it.
- Error shape for all APIs: `{ ok: false, error: { code, message } }`; success:
  `{ ok: true, data }`.
- All API handlers read `respondent_id` from the httpOnly cookie server-side;
  never trust a client-supplied id in the body.

---

## Phase 0 — Foundation ✅ (complete)

### Task 0.1 — Scaffold project
- **Files:** whole repo.
- **Steps:** `create-next-app` (TS, Tailwind, App Router, ESLint, no src dir).
  Add deps: `prisma`, `@prisma/client`, `@elevenlabs/react`, `zod`,
  `framer-motion`, `vitest`, `@vitejs/plugin-react`.
- **Done-when:** `npm run dev` serves default page; `npm test` runs green.

### Task 0.2 — Env + config
- **Files:** `.env.example`, `.env.local` (gitignored), `lib/env.ts`.
- **Contract:** `lib/env.ts` exports a zod-validated object; throws at boot if
  `DATABASE_URL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` missing.
- **Done-when:** a missing var throws a clear error (unit test).

### Task 0.3 — Prisma schema + client
- **Files:** `prisma/schema.prisma`, `lib/db.ts` (singleton PrismaClient).
- **Models:** `Respondent`, `SurveySession`, `Interview` (see schema).
- **Done-when:** `prisma migrate dev` applies cleanly; `lib/db.ts` connects.

### Task 0.4 — Anonymous identity
- **Files:** `proxy.ts` (Next 16's renamed Middleware), `lib/respondent.ts`,
  `lib/respondent-shared.ts`.
- **Behavior:** proxy issues httpOnly + SameSite=Lax `respondent_id` cookie if
  absent; Respondent row created lazily on first API call, not in the proxy.
- **Done-when:** first request sets cookie; subsequent requests reuse it.

**Phase 0 checkpoint:** `npm run build` green; migration applied; commit
`chore: scaffold + data model`.

---

## Phase 1 — Survey engine (pure logic, server-authoritative) ✅ (complete)

### Task 1.1 — Question definitions
- **Files:** `lib/survey/questions.ts`.
- **Contract:** exported `QUESTIONS: Question[]` where
  ```ts
  type Question = { id: string; prompt: string; type: 'single'|'multi';
    options: { value: string; label: string;
      effect?: { kind:'terminate' } | { kind:'qualify'; segment:'bmw_customer'|'potential_customer' } }[] }
  ```
- Encode all 4 questions + effects exactly per spec.
- **Done-when:** unit test asserts counts and each option's effect.

### Task 1.2 — Survey reducer (pure)
- **Files:** `lib/survey/logic.ts` (+ test first).
- **Contract:** `advance(state, questionId, values) → { answers, currentStep, status, segment }`.
- **Rules (tested):**
  - Any selected option with `terminate` ⇒ `status='terminated'`.
  - Q4 multi-select: BMW selected ⇒ `bmw_customer` (BMW wins even with others).
    Else Mercedes/Audi (no BMW) ⇒ `potential_customer`. Terminate brand alone ⇒
    terminated. **BMW + Toyota ⇒ bmw_customer**; **Audi + Toyota ⇒
    potential_customer**; **only Toyota ⇒ terminated**.
  - All questions answered while qualified ⇒ `status='qualified'`.
- **Done-when:** table-driven tests cover every terminate path, both segments,
  mixed multi-select cases; reducer never mutates input.

### Task 1.3 — Survey service + API
- **Files:** `lib/survey/session.ts`, `app/api/survey/state/route.ts` (GET),
  `app/api/survey/answer/route.ts` (POST).
- **Contracts:**
  - `GET /api/survey/state` → `{ currentStep, totalQuestions, answers, status, segment, question }` (rehydrates UI on resume).
  - `POST /api/survey/answer { questionId, values }` → zod-validated, loads
    session, calls `advance`, upserts (idempotent; re-answering a step overwrites
    and never double-advances), returns next view. Locks once terminated/qualified.
- **Done-when:** DB-backed integration tests: fresh start, resume, terminate lock,
  idempotent re-POST, invalid option → error.

**Phase 1 checkpoint:** commit `feat: server-authoritative survey engine`.

---

## Phase 2 — Survey UI (Typeform-style) ✅ (complete)

### Task 2.1 — Survey shell + question card
- **Files:** `app/page.tsx`, `components/survey/{Survey,QuestionCard,ProgressBar}.tsx`,
  `lib/survey/client.ts`.
- **Behavior:** one question visible; Framer Motion enter/exit; single-select
  auto-advances, multi-select has a Continue button; keyboard (number keys pick,
  Enter continues); progress bar from `currentStep/total`.
- **Data flow:** on mount call `/api/survey/state`; on answer call
  `/api/survey/answer`; animate to returned next question.
- **Done-when:** happy path both segments; refresh mid-survey resumes on same
  question with prior selection.

### Task 2.2 — Outcome screens
- **Files:** `components/survey/{Disqualified,Qualified}.tsx`.
- **Behavior:** `terminated` ⇒ polite screen-out. `qualified` ⇒ success bridge
  with continue to `/interview`.
- **Done-when:** both outcomes reachable and correct per segment.

**Phase 2 checkpoint:** commit `feat: typeform-style survey UI`.

---

## Phase 3 — ElevenLabs agent setup (config + docs)

### Task 3.1 — Agent prompt template + tool
- **Files:** `docs/elevenlabs-setup.md`, `lib/interview/guide.ts`.
- **`lib/interview/guide.ts`:** interview guide as data:
  ```ts
  type GuideQ = { id: string; text: string; segment: 'all'|'bmw_customer'|'potential_customer'; required: boolean };
  ```
  Encode intro, 5 core, 5 segment-specific (both sets), closing — per spec, with
  stable ids.
- **Agent prompt (documented):** system prompt referencing `{{segment}}`,
  `{{answered_questions}}`, `{{remaining_questions}}`, `{{resume_summary}}`; both
  segment blocks gated on `{{segment}}`; instructs the agent to call client tool
  `mark_question_answered(question_id)` after each answered guide question and to
  skip already-answered questions on resume.
- **Client tool registration (documented):** name `mark_question_answered`, param
  `question_id: string`.
- **Done-when:** `docs/elevenlabs-setup.md` reproduces the agent from a fresh
  account; `guide.ts` ids match the tool's expected values (unit test).

### Task 3.2 — Verify SDK capabilities
- **Steps:** confirm installed `@elevenlabs/react` supports `useConversation`
  with client tools + overrides/dynamicVariables + signed-url token. Pin exact
  call signatures in `docs/elevenlabs-setup.md`.
- **Done-when:** doc note records the exact SDK calls to use.

**Phase 3 checkpoint:** commit `docs: elevenlabs agent config + interview guide`.

---

## Phase 4 — Interview integration

### Task 4.1 — Server helpers
- **Files:** `lib/elevenlabs.ts` — `getSignedUrl(agentId)`
  (`GET /v1/convai/conversation/get-signed-url`), `getConversation(id)`
  (`GET /v1/convai/conversations/{id}`). Server-only.
- **Done-when:** unit tests with mocked fetch assert URL, `xi-api-key` header,
  parsed shapes.

### Task 4.2 — Interview state + init API
- **Files:** `app/api/interview/state/route.ts` (GET),
  `app/api/interview/init/route.ts` (POST).
- **Contracts:**
  - `GET /api/interview/state` → `{ segment, status, progress, requiredQuestions, allRequiredDone, hasPriorConversation }`. Guard: blocked unless survey `qualified`.
  - `POST /api/interview/init` → creates/loads `Interview` (segment from survey),
    returns `{ signedUrl, initiation: { dynamicVariables, firstMessageOverride } }`.
- **Done-when:** integration tests: unqualified blocked; qualified gets signed
  url + correct dynamic vars.

### Task 4.3 — Interview UI
- **Files:** `app/interview/page.tsx`,
  `components/interview/{MicOrb,ProgressChecklist,TranscriptLive}.tsx`.
- **Behavior:** call `/api/interview/init`; connect via `useConversation` with
  signed url + overrides + dynamicVariables; register `mark_question_answered`
  client-tool handler → `POST /api/interview/progress`; live progress checklist;
  Finish disabled until `allRequiredDone`.
- **Done-when:** dry-run shows progress ticking and Finish gated.

### Task 4.4 — Progress API
- **Files:** `app/api/interview/progress/route.ts` (POST `{ questionId }`).
- **Behavior:** validate `questionId ∈ guide for segment`; set
  `progress[questionId]=true`; recompute `allRequiredDone`; idempotent.
- **Done-when:** tests: invalid id rejected; duplicate marks safe; completion
  flips only when all required done.

**Phase 4 checkpoint:** commit `feat: voice interview integration + progress tracking`.

---

## Phase 5 — Resumption

### Task 5.1 — Resume context builder
- **Files:** `lib/interview/resume.ts`.
- **Contract:** `buildInitiation(interview) → { dynamicVariables:{segment, answered_questions, remaining_questions, resume_summary}, firstMessageOverride }`.
  - Derive answered/remaining from `progress` + guide.
  - `resume_summary`: short recap of last answered topic.
  - `firstMessageOverride`: first start = spec intro; resume = "Welcome back! We
    were just discussing {lastTopic}…".
- **Done-when:** unit tests for fresh vs resume produce correct vars and message.

### Task 5.2 — Wire resume + persist conversation id
- **Behavior:** on connect capture `conversationId` → persist
  `elevenlabsConversationId`, status `in_progress`. On disconnect leave state
  intact. `/api/interview/init` uses `buildInitiation` whenever
  `status='in_progress'`.
- **Done-when:** start interview, answer 2 questions, hard-refresh/close tab,
  re-enter → welcome-back greeting, no repeated questions, progress retained.

**Phase 5 checkpoint:** commit `feat: conversation resumption with injected context`.

---

## Phase 6 — Transcript management

### Task 6.1 — Complete + fetch transcript
- **Files:** `app/api/interview/complete/route.ts` (POST), `app/results/page.tsx`.
- **Behavior:** guard `allRequiredDone`; poll `getConversation(id)` with
  exponential backoff until `status !== 'processing'` (cap retries); store
  `transcript`, set interview `completed`. Results page renders transcript +
  Download (JSON and plain-text).
- **Done-when:** tests: complete blocked if not done; backoff stops after cap;
  transcript persisted; results page renders + downloads.

**Phase 6 checkpoint:** commit `feat: transcript fetch, storage, and results page`.

---

## Phase 7 — Reliability, polish, deploy, write-up

### Task 7.1 — Edge cases & polish
- Global resume: landing route inspects `/api/survey/state` +
  `/api/interview/state` and routes the returning user to the correct stage.
- Loading, error, reconnect, mic-permission-denied states. Mobile responsiveness.
- **Done-when:** manual matrix passes (see below).

### Task 7.2 — Deploy + docs
- Deploy to Vercel with env vars; run migrations against prod Neon.
- **Files:** `README.md`, `docs/writeup.md` (tech choices, challenges,
  improvements-with-more-time, time spent), `docs/architecture.md` (integration +
  state + resumption approach — required deliverable).
- **Done-when:** live URL loads; full happy path works in prod; docs complete.

---

## Test matrix (must all pass before "done")

1. Under-18 → terminate.
2. No-car → terminate.
3. Only-terminate-brand → terminate.
4. BMW (+other) → bmw_customer interview.
5. Audi/Mercedes → potential_customer interview.
6. Refresh mid-survey → resume same question.
7. Refresh mid-interview → welcome-back, no repeats, progress retained.
8. Finish gated until all required answered.
9. Transcript fetched, viewable, downloadable.
10. Returning user routed to correct stage from landing.

## Assumptions

- **Mixed Q4 rule:** BMW always wins (qualifies as bmw_customer) even if a
  terminate brand is also selected. (Implemented + tested in Phase 1.)
- ElevenLabs account must exist before Phase 4; Phases 0–3 need no live agent.

## Progress

- ✅ Phase 0 — Foundation
- ✅ Phase 1 — Survey engine
- ✅ Phase 2 — Survey UI
- ✅ Phase 3 — ElevenLabs agent setup (guide data + docs/elevenlabs-setup.md)
- ✅ Phase 4 — Interview integration (server helpers, routes, /interview UI)
- ✅ Phase 5 — Resumption (stateless-agent + injected context)
- ✅ Phase 6 — Transcript management (stitch + /results)
- ◻️ Phase 7 — Live agent wiring (needs ELEVENLABS_AGENT_ID) + deploy verification
