# Write-up

A single Next.js app that takes a respondent from a Typeform-style screening
survey into an ElevenLabs voice interview and stores the transcript — as one
cohesive product. See `docs/architecture.md` for the full technical detail.

## Technology choices and why

- **Next.js 16 (App Router), one app, one deploy.** Survey and interview share
  identity, state, and session logic, so a single full-stack app removes an
  integration seam and deploys to Vercel with no extra infra.
- **Server is the source of truth.** Screening outcome, segment, interview
  progress, completion, and transcript are all computed server-side — outcomes
  can't be spoofed and resume is deterministic. Survey branching is a pure,
  fully unit-tested reducer.
- **Postgres + Prisma** for typed relational state keyed by respondent, with
  pooled + direct connections that fit Vercel/Neon serverless.
- **Anonymous cookie identity** (`proxy.ts` issues an httpOnly `respondent_id`)
  gives resume-without-login across both parts — the right trade-off for a survey.
- **ElevenLabs over WebRTC** (prescribed): a short-lived token is minted
  server-side so the API key never reaches the browser.
- **Tailwind + Framer Motion** for a polished one-question-at-a-time UI; **Vitest**
  for ~60 unit + DB-backed tests.

## Challenges faced and how I solved them

- **Conversation resumption.** ElevenLabs won't natively continue a dropped
  session with memory, so I treat the agent as stateless and re-hydrate a *fresh*
  conversation from our DB each time (segment, answered/remaining questions,
  "Welcome back…" first message). Every conversation id is stored and transcripts
  are **stitched** in order — surviving tab-close, mid-call drops, and later returns.
- **Deterministic completion.** The agent calls a client tool
  `mark_question_answered(id)`, validated server-side against the segment guide;
  it drives a live checklist and gates Finish (re-checked on submit).
- **Single-agent routing.** One agent + one guide-as-data, with both question
  blocks gated on a `{{segment}}` variable — no second agent to keep in sync.
- **Serverless quirks.** Fixed a Vercel P1012 by removing build-time migrations,
  and added a `/api/health` endpoint to debug deploys.

## What I'd improve with more time

Encode conversations when storing into the DB and decode on rehydration, to be privacy compilant.

## Estimated time spent

Roughly **8-10 hours** over two days — survey engine + UI, the ElevenLabs
integration, and tests/deploy/docs.
