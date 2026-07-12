# State, Sessions & Resumption

A deep-dive on how this platform stores state, identifies respondents, and
resumes both the survey and the voice interview. This is the technical heart of
the project; almost every reliability, security, and UX property traces back to
the one idea below.

## The core idea

> **A "session" is nothing but an anonymous cookie pointing at Postgres rows.
> The browser and ElevenLabs are both stateless and disposable. On every load
> they rehydrate by re-fetching server-computed state. The server is the only
> thing that ever writes derived state.**

There is no session store, no JWT, and no in-memory server session object. This
removes an entire class of infrastructure (no Redis, no sticky sessions) and
makes the system crash-, tab-close-, and network-drop-safe: there is no
in-memory state to lose because the database is always current.

Three layers cooperate:

```
Layer 1  IDENTITY    respondent_id cookie          ──►  Respondent row
Layer 2  STATE       SurveySession + Interview rows (keyed by respondent_id)
Layer 3  TRANSPORT   stateless clients that re-fetch state on every load
```

---

## Layer 1 — Identity: establishing a session

Identity is a single anonymous cookie, `respondent_id`, issued in **two places**
for robustness.

### a) The Proxy (Next 16's renamed Middleware) — `proxy.ts`

```
Every page request → if no respondent_id cookie → set one (random UUID)
```

- Runs on page routes only; skips static assets and API routes (`proxy.ts:33`).
- **Deliberately does not touch the database.** The proxy must stay fast, so it
  only *issues* the id (`proxy.ts:11-12`).
- Cookie is `httpOnly`, `sameSite: lax`, `secure` in production, with a
  **1-year** max-age (`respondent-shared.ts:8`) so respondents can resume weeks
  later.

### b) `getOrCreateRespondentId()` in API routes — `lib/respondent.ts:25`

```
Read cookie → if missing, create UUID + set cookie
Then: prisma.respondent.upsert({ where:{id}, create:{id}, update:{} })
```

- This is the **lazy row creation**: the `Respondent` row is only born on the
  first API call, not on page visit.
- The `upsert` with an empty `update:{}` makes it **idempotent** — called any
  number of times it returns the same id and never duplicates the row.

**Why split it?** The proxy handles the common case (cookie already exists) with
zero DB cost. The API layer is the fallback that also guarantees the row exists
before any state is written. Constants live in `respondent-shared.ts`,
dependency-free, so both the edge runtime (proxy) and node runtime (routes) can
import them.

---

## Layer 2 — State: storing the sessions

Two child rows hang off each `Respondent`, both 1:1, both keyed by
`respondentId` (`prisma/schema.prisma`).

| Session | Row | Persists |
|---|---|---|
| Survey | `SurveySession` | `answers`, `currentStep`, `status`, `segment` |
| Interview | `Interview` | `progress`, `status`, `conversationIds[]`, `transcript` |

Two invariants hold everywhere:

1. **Server-authoritative.** The client only ever posts raw inputs (an answer, a
   question-answered signal). All *derived* fields — `status`, `segment`,
   completion — are computed by pure server functions and persisted. The client
   can never write a status directly, so outcomes cannot be spoofed.
2. **Idempotent writes.** Re-submitting the same answer does not double-advance
   (`logic.ts:109` uses `Math.max` on the cursor); resolving identity twice does
   not duplicate rows.

`onDelete: Cascade` means deleting a `Respondent` wipes both sessions, and
"Start over" explicitly deletes both child rows (`survey/session.ts:136`).

---

## Layer 3 — Resume & Rehydration: restoring the sessions

Both parts use the identical pattern: **the client mounts empty, then calls a
`state` endpoint to rehydrate.**

```
Component mounts (no state)
  → client.ts fetch("/api/.../state", { cache: "no-store" })   ← never cache
  → route: getOrCreateRespondentId()  resolves the cookie
  → session.ts: read the row from DB
  → build a serializable "View" object
  → return { ok:true, data: view }
  → component renders exactly where the user left off
```

`cache: "no-store"` on every state fetch (`survey/client.ts:17`) guarantees
resume always reflects the live DB, never a stale cache.

### Survey rehydration — `getSurveyView` (`survey/session.ts:62`)

The DB row is mapped `rowToState` → `toView`, returning:

- `answers` → the client **prefills** previously chosen options.
- `currentStep` → `nextQuestion()` returns `QUESTIONS[currentStep]`, the exact
  question to present.
- `status` → if `terminated`/`qualified`, `question` is `null` and the survey is
  locked.

Resume is therefore just "read the row, hand back the next question plus all
prior answers." No client memory is involved. Back (`goBack`) decrements the
cursor while preserving answers; Start Over (`resetSurvey`) clears both rows.

### Interview rehydration — `buildInitiation` (`interview/resume.ts`)

This is the deeper case because the session spans two systems: our DB **and**
ElevenLabs. ElevenLabs holds no durable session and is treated as disposable, so
rehydration means **rebuilding a fresh voice conversation from our DB progress.**

```
POST /api/interview/init
  → beginInterview() reads Interview.progress from DB
  → buildInitiation(segment, progress):
       - answered_questions  → tells the fresh agent what to SKIP
       - remaining_questions → what's left to cover
       - resume_summary      → "already answered N; don't repeat"
       - firstMessage        → "Welcome back! We were just discussing {topic}…"
  → mint a NEW ~10-min WebRTC token (API key stays server-side)
  → client.startSession({ token, firstMessage, dynamicVariables })
  → onConnect → recordConnection(newId) → append to conversationIds[]
```

Each resume is a **brand-new ElevenLabs conversation re-hydrated with our
server-held progress**. That is exactly why `conversationIds` is an array
(`schema.prisma:49`) rather than a single id, and why the transcript is
**stitched across all conversations** on completion (`interview/session.ts:191`):
every id is fetched (polling briefly while ElevenLabs is still `processing`) and
concatenated in order into one continuous transcript.

This survives tab-close, days-later returns, and mid-call WebRTC drops — a drop
flips the UI to a `reconnect` phase (`Interview.tsx:52`) that simply re-runs the
same init flow. An intentional Finish is guarded by `finishingRef` so it is not
mistaken for a drop.

---

## The symmetry

Once you understand one part, you understand both — they share the same shape.

| | Survey | Interview |
|---|---|---|
| State home | `SurveySession` row | `Interview` row + ElevenLabs |
| Client | stateless renderer | stateless voice UI |
| Resume | re-fetch row → next question | re-hydrate new conversation from `progress` |
| Source of truth | server reducer | server progress + completion gate |

## Why this design is strong

- **No session-store infrastructure** — scales trivially on serverless.
- **Failure-resilient** — no in-memory state to lose on crash, tab-close, or
  network drop; the DB is always the current truth.
- **Un-spoofable** — clients post inputs; the server computes and stores
  outcomes.
- **Symmetric** — one mental model ("stateless client + rehydrate from DB")
  covers survey and interview alike.

## The honest trade-off

Identity is **cookie-bound to a single browser**, so there is no cross-device
resume. That would require real authentication. For a frictionless anonymous
survey this is a deliberate and reasonable choice, not an oversight.
