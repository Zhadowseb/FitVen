# Ask FitVen: how it is built, and the contract between its three parts

The brief is `Claude outputs/AskFitVen/ASK_FITVEN.md` (kept beside its designs).
This file is what was decided from it and the one place the three parts - the
database (`supabase/migrations/20261026090000_ask-fitven.sql`), the edge function
(`supabase/functions/ask-fitven/`) and the app (`src/Pages/AskPage/`,
`src/Services/askService.js`) - agree on. Change it first, then the code.

## Decisions (the brief's open questions, answered by the owner)

1. **Models, in three tiers, with a monthly quota each** - not a daily one:
   | tier | model (env override) | questions a month |
   |---|---|---|
   | `haiku` | `claude-haiku-5-5` (`ASK_MODEL_HAIKU`) | 10 |
   | `sonnet` | `claude-sonnet-5-5` (`ASK_MODEL_SONNET`) | 5 |
   | `opus` | `claude-opus-5-5` (`ASK_MODEL_OPUS`) | 2 |
   The month is the calendar month in Copenhagen. The limits live in SQL
   (`public.ai_tier_limit`), so they change without a new app build.
2. **A recommendation first.** Before a question is sent, the app asks the edge
   function which tier it recommends for that question (a cheap Haiku call with
   no tools and no data; it does not use a question). The app shows the three
   tiers with how many questions are left and preselects the recommended one if
   it has any left, otherwise the next one down. The person can choose another.
3. **Sickness is not readable by the AI** in v1. No tool for it.
4. **The conversation lives on the device only.** Nothing is stored in the cloud.
5. **One entry point:** the bar on Home, under "Your split".
6. The provider is Anthropic's Messages API with tool use; the key is the
   Supabase secret `ANTHROPIC_API_KEY` (set by the owner, never in the app).

## Security model (the rules the code must keep)

- The model never sees SQL or table names: it calls the fixed tools below, each
  one Postgres function in schema `ai`.
- Every `ai.*` function filters on `(select auth.uid())` itself, takes no user id
  argument, runs as the caller (`security invoker`), `search_path = ''`, is
  executable by `authenticated` only (not `anon`, not `public`).
  `scripts/test-ask-fitven-sql.js` fails when a function breaks one of these.
- The edge function builds its data client from the anon key and the caller's
  `Authorization` header and verifies the JWT first. The service role key is
  used for exactly one thing: `public.ai_refund_question` when the provider
  failed after a question was counted. That client never reads user data.
- Tool results are data, never instructions; they are passed as tool results and
  never placed in the system prompt.
- Nothing about a question, a tool result or an answer is logged - request ids,
  token counts and error kinds only.
- The AI writes nothing. A suggested change is data the app applies after the
  person presses a button.

## The edge function: `POST /functions/v1/ask-fitven`

Headers: `Authorization: Bearer <user JWT>`, `apikey`, `content-type: application/json`.
Always answers JSON.

### Requests

```json
{ "action": "usage" }
{ "action": "recommend", "question": "Why is my bench stuck?", "language": "da" }
{ "action": "ask",
  "tier": "haiku" | "sonnet" | "opus",
  "messages": [ { "role": "user" | "assistant", "text": "..." } ],
  "context": { "localDate": "2026-10-26", "localTime": "19:42", "timeZone": "Europe/Copenhagen",
               "unit": "kg", "language": "da" } }
```

`messages` is text only (an assistant turn is its `text`, without its blocks),
at most the last 12 turns, the last one from the user, each at most 2,000
characters. `language` is one of `en da sv nb de fr es`.

### Responses

`usage`  -> `200 { "usage": Usage }`

`recommend` -> `200 { "tier": "haiku"|"sonnet"|"opus", "reason": "short English phrase", "usage": Usage }`.
If the router fails, a rule decides (short lookup -> haiku, a comparison or a
"why" over weeks -> sonnet, a plan or several steps of analysis -> opus); it never fails the request.

`ask` -> `200`:

```json
{
  "text": "Your bench has held at about 113 kg for 10 weeks...",
  "blocks": [
    { "type": "chart", "title": "Bench Press · estimated 1RM", "range": "last 10 weeks",
      "series": [ { "x": "2026-08-18", "y": 112 } ], "unit": "kg", "summary": "113 kg · no change" },
    { "type": "suggestion",
      "target": { "kind": "next_workout", "label": "Push A" },
      "change": { "exercise": "Bench Press",
                  "sets": [ { "reps": 5, "weight": 102.5, "count": 4 }, { "reps": 8, "weight": 90, "count": 1 } ] },
      "text": "Bench Press: 4 × 5 at 102.5 kg, then 1 × 8 at 90 kg" }
  ],
  "sources": { "label": "Based on 14 Bench Press sessions · Aug–Oct",
               "count": 14, "range": "Aug–Oct",
               "link": { "screen": "RecordsExercise", "exercise": "Bench Press" } },
  "tier": "sonnet",
  "usage": Usage
}
```

- `blocks` is `[]` when there is nothing to show, `sources` is `null` when the
  answer rests on no sessions. Unknown block types are dropped; a `chart`
  whose `y` values do not all appear in the tool results of the same turn is
  dropped; at most 3 blocks; at most 60 chart points; a `suggestion` needs a
  target label, an exercise name and 1-6 sets with reps 1-100, weight 0-1000
  and count 1-10.
- `text` is in `context.language`, short, grounded in the tool results.

`Usage` = `{ "month": "2026-10", "tiers": { "haiku": {"used":3,"limit":10}, "sonnet": {"used":0,"limit":5}, "opus": {"used":1,"limit":2} } }`

### Errors (always `{ "error": "<code>", ... }`)

| status | code | when |
|---|---|---|
| 401 | `unauthorized` | no or invalid JWT |
| 400 | `bad_request` | a malformed body, an unknown tier, no user message |
| 403 | `consent_required` | the person has not said yes (`public.ai_consent`) |
| 429 | `quota_exceeded` + `tier` + `usage` | that tier's month is used up |
| 502 | `provider_error` | the model call failed (the question is refunded) |
| 503 | `unavailable` | `ANTHROPIC_API_KEY` is not set, or the provider is down |
| 500 | `error` | anything else |

At most 6 tool calls per question, then it answers with what it has.

## The tools (Postgres functions in schema `ai`)

Called on the user client as `client.schema("ai").rpc("<function>", { p_... })`
(the schema has to be exposed in PostgREST - see the end of the migration; every
function is executable by `authenticated` only). Parameters are named `p_<name>`
and all but the workout id are optional.

The edge function maps each tool name to one function and nothing else; an
unknown name is rejected. Arguments are validated against the schema before the
call, ranges are capped (2 years of history, 60 rows) and a capped result
carries `"truncated": true`.

| tool (= function) | arguments | returns (jsonb) |
|---|---|---|
| `profile_summary` | `p_today date` (the app's local date) | `{first_workout, workouts_4w, workouts_12w, active_program, program_status, split_names[], unit:"kg", step_zone}` |
| `list_workouts` | `from date, to date, max int (<=60)` | `{truncated, workouts:[{id,date,label,type,minutes,sets_done,exercises[],pr_count}]}` newest first |
| `workout_detail` | `workout_id bigint` | `{id,date,label,type,minutes,exercises:[{name,weight_mode,note,sets:[{n,reps,weight,type,done,failed,rpe}]}]}` or `null` |
| `exercise_history` | `exercise_name text, from date, to date` | `{exercise,truncated,sessions:[{date,weight_mode,top_set:{reps,weight},est_1rm,volume,sets}]}` |
| `personal_records` | `exercise_name text default null` | `{records:[{exercise,reps,weight,date}]}` (the sets the app flagged as records) |
| `weekly_volume` | `from date, to date` | `{weeks:[{week,exercise_sets}]}` sets per week per exercise name (muscle groups are mapped by the app's catalogue, so the model gets exercise names) |
| `program_overview` | - | `{program, blocks:[{mesocycle,weeks,focus,microcycles:[{n,focus,days:[{weekday,date,workouts:[{label,exercises[]}]}]}]}]}` for the active program |
| `daily_steps` | `from date, to date` | `{days:[{day,steps,source}]}` |

`weight_mode` is `total` or `per_side` (how that workout's weights were entered; `total` when unset). Weights are returned as stored; a suggestion's weights must be written in the same mode.

Estimated 1RM is Brzycki, `weight × 36 / (37 − reps)`, only up to 12 reps - the
formula the app and the centre categories already use.

## Proving it

`scripts/test-ask-fitven-sql.js` reads the migration and holds every function
to the rules above, and - where PGlite can be loaded - runs the migration and the
isolation script against copies of the synced tables with a follower whose followed
person trained today. `scripts/ask-fitven-isolation.sql` is the same proof for the
real project: run it in the SQL editor after the migration, with an account id,
and it rolls back.

## Usage and consent (public functions, caller only)

- `public.ai_usage_summary()` -> the `Usage` object above.
- `public.ai_claim_question(p_tier text)` -> `{allowed, used, limit}`; counts one
  question for the caller in this month when under the limit.
- `public.ai_refund_question(p_user uuid, p_tier text)` - service role only.
- `public.ai_record_tokens(p_tier text, p_tokens bigint)` - optional: adds what a
  question cost to the caller's own usage row.
- `public.ai_get_consent()` -> timestamptz or null; `public.ai_set_consent(p_consent boolean)`.
- Tables `public.ai_usage (user_id, month, tier, questions, tokens)` and
  `public.ai_consent (user_id, consented_at)`: owner-only select, no direct writes.

## The app

- `src/Services/askService.js`: `getAskUsage()`, `recommendTier(question)`,
  `askQuestion({tier, messages})`, consent get/set, all through
  `supabase.functions.invoke("ask-fitven", ...)` with the shared timeout; errors
  come back as `{ code }` for the screen to say in words. It runs the normal
  sync once first (never longer than 3 s) and sends local date, time, time
  zone, unit and language.
- `src/Pages/AskPage/`: the chat (empty state, messages, chart block, suggestion
  block, source line, input, tier picker, states: typing, offline, quota,
  error with Retry), the "Only your data" sheet and the one-screen consent.
- Home: the bar under the split cards; hidden when consent was turned off in
  Settings → Privacy.
- The conversation is in memory (and local storage) on the phone; "New chat"
  clears it.
- Applying a suggestion changes the next planned workout of that name through
  the existing workout services, shows "Added to {workout}" with Undo, and Undo
  restores the sets as they were.
- Strings: `ask.*` in all seven languages. The privacy policy says what is sent.

### How the app settled what the contract left open

- **Settings → Privacy** is a switch in the account card of Profile
  (`AskFitvenSwitch`): there is no privacy settings screen, only the policy page.
  The cloud keeps a date or nothing, so "never asked" and "turned off" read the
  same there; Home hides the bar only on the phone's own note of a switch turned
  off (per person, in local storage). "Not now" on the consent screen changes
  nothing and leaves the bar.
- **Consent comes before anything is sent**, the recommendation included: the
  question is added to the chat, the consent is checked (asked of the cloud if
  the phone does not know it), and only then the recommendation and the question.
- **The tier**: the recommendation is asked for once the typing has rested, and
  again on send only if the text changed; a tier chosen by hand stops the asking.
  The rule only goes down from the recommended tier; a quota state offers every
  tier with questions left, above as well.
- **The chart** is `Resources/Components/Sparkline.js` (the one reusable line
  chart, moved there from the dev dashboard), drawn from `series[].y`.
- **The chat has no tab bar** under it (as in the designs); the input bar is its
  footer.
- **A suggestion's weights** are written as they are, through
  `updateSetWeights` (clamped, 1RM % worked out), because the AI reads them as
  they are stored: in the exercise's own mode (total or per side). The app does
  not convert. The next planned workout is the first strength workout of that
  label that is not done, has no set ticked off, and is dated today or later.
  The sets of the exercise are replaced as working sets (a rest is kept); an
  exercise the workout lacks is added at the end. Undo restores every value and
  the count, or removes the exercise it added.
