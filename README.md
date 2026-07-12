# Survey → Voice Interview Platform

A unified web app that screens respondents with a Typeform-style survey and
(in later phases) routes qualified respondents into an ElevenLabs voice
interview. Built with Next.js 16 (App Router), Prisma + Postgres, and Tailwind.

## Status

- **Phase 0** — Foundation: scaffold, env validation, Prisma data model,
  anonymous respondent identity (`proxy.ts`). ✅
- **Phase 1** — Server-authoritative survey engine (questions, reducer, API). ✅
- **Phase 2** — Typeform-style survey UI with resume, Back, and Start Over. ✅
- **Part 2** — Voice interview: guide + resume builder, ElevenLabs helpers,
  interview APIs, `/interview` UI, transcript stitching + `/results`. ✅
  (Live voice needs `ELEVENLABS_AGENT_ID` — see `docs/elevenlabs-setup.md`.)

See `docs/architecture.md` for the full integration write-up.

## Prerequisites

- Node 20.19+ or 22.13+ (repo developed on 22.10; jsdom-based tests are avoided
  for this reason — logic tests run in the Node environment).
- Docker (for the local Postgres) or any Postgres connection string.

## Setup

```bash
# 1. Install
npm install

# 2. Start a local Postgres (or point DATABASE_URL at your own)
docker run -d --name survey_pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=survey \
  -p 5433:5432 postgres:16

# 3. Configure env
cp .env.example .env.local   # adjust if needed
# DATABASE_URL is also read from .env by the Prisma CLI

# 4. Apply migrations + generate client
npm run db:migrate

# 5. Run
npm run dev        # http://localhost:3000
```

## Testing

```bash
npm test           # Vitest: unit + DB-backed integration tests
```

Integration tests (`lib/survey/session.test.ts`) run against the `DATABASE_URL`
Postgres and reset tables between cases.

## Architecture notes

- **Server is the source of truth.** Branching, terminate/qualify, and segment
  are computed server-side (`lib/survey/logic.ts`) so the client can't spoof
  outcomes. The pure reducer is fully unit-tested.
- **Anonymous identity.** `proxy.ts` (Next 16's renamed Middleware) issues an
  httpOnly `respondent_id` cookie; the Respondent row is created lazily on the
  first API call (`lib/respondent.ts`). This drives resume-without-re-answering.
- **Segment rule.** BMW wins over everything (qualifies as `bmw_customer` even
  alongside a terminate brand); Mercedes/Audi → `potential_customer`; a
  terminate brand alone → screen-out.

## Key paths

```
proxy.ts                     anonymous respondent cookie
lib/env.ts                   zod-validated server env
lib/db.ts                    Prisma client singleton
lib/respondent.ts            respondent identity helpers
lib/survey/questions.ts      survey definition (data)
lib/survey/logic.ts          pure survey reducer
lib/survey/session.ts        persistence + view service
app/api/survey/*             state + answer route handlers
components/survey/*           Typeform-style UI
prisma/schema.prisma         data model
```
