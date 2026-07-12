# Restart survey from the completion screen — Design

## Summary

On the qualified/completion screen (shown after a respondent passes the survey
and is offered the voice interview), add a de-emphasized secondary **"Restart
survey"** control below the primary **"Start voice interview"** button. Clicking
it immediately resets the respondent's survey and interview data and returns
them to the first survey question — identical mechanics to the existing
screen-out "Start over" flow.

## Motivation

Currently the completion screen (`components/survey/Qualified.tsx`) offers only
"Start voice interview" with no way back. A respondent who wants to redo the
survey has no path to do so from this screen. The screen-out screen already has
a working "Start over"; we extend the same capability to the qualified screen.

## Requirements

- A "Restart survey" control appears on the qualified/completion screen.
- It is visually secondary to "Start voice interview" (which remains the primary
  action).
- Clicking it resets **immediately**, with **no confirmation dialog** (matches
  the existing "Start over" behavior).
- Reset wipes the respondent's survey answers/state **and** their interview data,
  then returns them to question 1 (`in_progress`).
- The control is disabled while a reset request is in flight (prevents
  double-submit).

## Non-goals

- No confirmation/undo step.
- No "survey-only" reset that preserves interview data. Reset is full, matching
  the existing behavior. (Explicitly rejected during design.)
- No backend, API, or database schema changes.

## Design

Purely a UI-wiring change that reuses proven, existing plumbing. No new reset
logic is introduced.

### Components / changes

1. **`components/survey/Qualified.tsx`**
   - Add optional props `onRestart?: () => void` and `restarting?: boolean`
     (mirroring `components/survey/Disqualified.tsx:6-12`).
   - Render a secondary "Restart survey" button beneath the existing "Start
     voice interview" CTA, only when `onRestart` is provided.
   - Style it de-emphasized (bordered/ghost secondary button, matching the
     visual weight of the existing "Start over" button in
     `Disqualified.tsx:31-41`), disabled while `restarting`, with label
     `Restarting…` during the in-flight request.

2. **`components/survey/Survey.tsx`** (qualified branch, currently lines 127-136)
   - Pass `onRestart={handleRestart}` and `restarting={submitting}` into
     `<Qualified>`.
   - `handleRestart` already exists (`Survey.tsx:50-60`) and is already used by
     the `Disqualified` branch; no change to it.

3. **Backend: none.** `resetSurvey` (`lib/survey/session.ts:135-138`) already
   deletes the `Interview` row then the `SurveySession` row and returns a fresh
   `initialState()` view. `POST /api/survey/reset` and `resetSurvey()` in
   `lib/survey/client.ts:35-38` are already wired.

### Data flow

click "Restart survey"
→ `handleRestart` (`Survey.tsx:50`)
→ `resetSurvey()` client wrapper (`lib/survey/client.ts:35`)
→ `POST /api/survey/reset` (`app/api/survey/reset/route.ts`)
→ `resetSurvey(respondentId)` deletes `Interview` + `SurveySession` rows
  (`lib/survey/session.ts:135`)
→ returns fresh `in_progress` `SurveyView`
→ `setState({ phase: "ready", view })` replaces React state
→ survey re-renders at question 1.

The respondent identity (`respondent_id` cookie / `Respondent` row) is
preserved; only survey and interview data are wiped.

### Error handling

Reuse the existing `handleRestart` behavior: it toggles `submitting`, and on
failure sets `{ phase: "error", message }` which renders the shared error view
(`Survey.tsx:79-85`). The restart button is disabled while `submitting` is true.

## Testing

- Unit test `Qualified`:
  - Renders the "Restart survey" control only when `onRestart` is provided.
  - Calls `onRestart` on click.
  - Shows the disabled/"Restarting…" state when `restarting` is true.
- The reset backend (`resetSurvey`) is already covered by existing tests; no new
  backend tests required.

## Risks / considerations

- **Destructive:** restarting from the completion screen deletes any interview
  progress/transcript/ElevenLabs conversation ids for the respondent. This is
  intended and matches the chosen "reset immediately" behavior.
