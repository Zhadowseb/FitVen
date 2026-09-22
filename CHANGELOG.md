# Changelog

## [2.1.1] - Unreleased
### Fixed
- **The review agents run again.** Moving them to master was built on a `push` trigger, and `claude-code-action` refuses that event outright - "Unsupported event type: push". All eight agents died in under a second, every step is `continue-on-error` so the run still went green, and the aggregate then wrote its "kunne ikke fuldfoeres" over the finished twenty-finding report on the pull request. The report was only recoverable from the earlier run's artifact. The trigger is now `pull_request: closed`, which fires at the same moment, carries the pull request the merge came from, and is an event the action accepts. `npm test` fails if the push trigger comes back.
- **A run with nothing to say no longer speaks.** With no report the aggregate leaves the comment alone, writes the failure to the run summary and goes red, instead of replacing whatever was there. `npm test` holds that too.

---
## [2.1.0] - Unreleased
### Added
- **A feedback message can be triaged, not just read.** Each one carries one of four states - `new`, `planned`, `fixed`, `not_fixed` - set from a chip row on the message itself, one tap per decision. `read_at` said the message had been looked at and nothing about what was decided, and an inbox where everything is "read" is the same inbox as one where nothing is. Setting a state marks the message read too. A trigger forces every new row to `new`: the insert policy lets any signed-in account write its own row, and column grants cannot stop it - Postgres ignores a column-level revoke when the role holds the privilege on the table. **Needs `20260922090000_a-feedback-message-has-a-status.sql`.**
- **Home leads with what is already open today.** An unfinished workout dated today - planned this morning, or left half-done at lunch - now takes the top button as "Continue", ahead of the split's suggestion. Offering to start a second session beside one already going is almost never what was meant. The empty workout stays there either way, and with neither it is the only button. The eyebrow stays QUICK START throughout - it names the block, and the button under it already says which workout.
- **Home is built for the person with no programme.** She runs the same two or three sessions on a loop and wants the next one open, so that is what the screen is now: how many days since she last trained, the session that is due with a button that opens it, the rest of her split as cards, her friends, and whether last month moved anything. No calendar strip and no posts.
- **The split is read out of the history, not typed in.** Sixty days of finished strength workouts, grouped by name after normalisation or by a 60% overlap in exercises, kept when a group has happened three times. Whose turn it is is whoever has waited longest. The card with the orange edge and the quick-start button are the same session, and both open it directly - the exercises and the set structure from last time, with last time's numbers as placeholders. Fewer than two repeating groups and there is no split: Home offers an empty workout and leaves the row out, because half a guess fills the row somebody taps without reading.
- **Weekdays under a session** when at least half of it lands on the same day over eight weeks. Nothing qualifies, the line goes, and the cards stay the same height.
- **"Last month"**, one bar per muscle group: the best estimated one-rep max over the last 30 days against the 30 before. Brzycki, the app's one formula - the design document asked for Epley "the same as Records", and Records is not Epley. Going backwards reads as 0% and a grey bar; Home is not where somebody is told they have lost ground. Too few sets in either window is a dash and a low bar, never an empty column. The whole block opens Records.
- **Feed is its own tab**, carrying the posts that used to sit under Home along with the post menu, the report action and the rest of it. It moved whole rather than being rewritten.
- **There is something to look at on the first day.** Both new blocks used to disappear for an account with nothing logged, which left a new person a Home with two holes in it - and a block that only turns up weeks later cannot be looked forward to. "Last month" now draws five named muscle groups at 0%, and the split says "Start training to have your split shown here." under its own heading. The labels come from `EXERCISE_MUSCLE_GROUPS` rather than being written into the empty state, so the block does not change vocabulary the moment somebody starts training. A zero reads as `0%`, not `+0%`: the plus is a claim.
- The one case that stays blank is sets that exist under an exercise catalog that has not synced. Drawing 0% there would tell somebody who has been training all month that they gained nothing, which is worse than saying nothing. `npm run test:home-quick-start` holds that line apart from the first-day one.
- **A dev dashboard, for one account.** Profile -> Dev, shown only when `profile_private.is_admin` is set by hand in the database. Three things on one read-only screen: downloads per store with the week-by-week chart, three numbers saying whether the app is running, and the feedback people have sent from inside it. The period picker (7 dage / 90 dage / Alt) moves the boxes, the chart and the numbers; the feedback list stays newest-first whatever it is set to, because a list that reorders itself as it is read cannot be worked through. Tapping a message marks it read in place - it does not jump.
- **Feedback can be read, and it says what kind it is.** The messages were already being sent and stored; nothing could look at them. `Feedback` gains `kind`, `read_at` and a `created_at`, RLS, and the form gains a Fejl / Idé / Ros picker above the field. The kinds the app writes and the kinds the column accepts are checked against each other by `npm run test:dev-dashboard`, because a fifth one added on one side only fails the insert in production, on the screen somebody reaches when something has already gone wrong for them.
- `store_stats`, a table a scheduled server function fills from the App Store Connect and Google Play APIs. **Nothing here is built yet** - the function, the cron and the keys are still to come, and the keys never go in the bundle. Until then every store number on the screen is an em dash and the chart says why. An em dash and a zero are different answers and the dashboard keeps them apart.

### Changed
- **The quick start block lost its box.** Every button inside it draws its own border, so the card's outline was a border around a border, and it made the screen's main action read as a widget sitting on the page rather than as part of it.
- **Appearance stacks its labels over its controls.** "System · Dansk · English" and a label competing for one row left the word Language squeezed to nothing. Theme and Language are stacked now, the way the colour picker under them already was, so the card reads as one thing.
- **Personal Records shows what it already knew.** The page opened on a radar chart with nothing in it, given its full 300 points of height, so four tenths of the screen was an empty box and the records started below the fold. With nothing to plot the muscle load card is now one line instead. In its place at the top is a strip of three numbers — exercises tracked, records filled out of the slots there are, and the heaviest lift with the exercise it belongs to.
- **Exercise rows lead with the weight.** A row used to end in a set count, which says how much was logged rather than how much of the exercise is mapped out. It now ends in the heaviest lift, and carries a bar showing how many of the rep ranges have a record in them. Every value here was already on the summary the page fetches; none of it reached the screen. The row icon went to make space, since the same arrow on every row said nothing.
- **The review agents read master, not every push to a branch.** They used to run on every push to a pull request: a review of a branch somebody is still pushing to is read by nobody, and it costs real money each time. `pr-review.yml` now triggers on a push to `master`, reads what that push brought in, and posts its report as a comment on the pull request the merge commit came from - found through the commits API, and falling back to the run summary when there is no pull request. `/qa` on a pull request and a manual dispatch still work, for when you want them to look before you merge. `qa-gate.yml` is deleted with the check run it posted: a gate that blocks a merge until the agents have run makes no sense once they run after the merge. `ci.yml` is untouched and still runs `npm test` on both pull requests and master - that is the gate against a broken commit, and it always was.
- **The bottom bar is Home, Train, +, Feed, Social.** Profile leaves it: the avatar in the header opens it, as do the You tile, your own row on a leaderboard and your name on a post. The active tab is the theme's own ink with a 2 dp orange rule above the icon - two oranges on one bar meant the plus stopped reading as the thing that does something - and the rule holds its space when transparent, so the icons stay on one line. The plus is 48 dp and sits in the line instead of cutting a notch in it. The notification dot moves to Feed.
- The greeting is two lines and the date line is gone: the phone already shows the date, and the row it took was the one thing on the screen nobody needed.
- `WeekStrip` and `TodayHeroCard` are deleted. A week of empty squares is not what somebody without a programme needs to look at.

### Security
- **A `/qa` comment could only ever come from somebody with write access.** The trigger added on this branch asked whether a comment started with `/qa` and nothing about who wrote it. `issue_comment` is not covered by GitHub's fork protection the way `pull_request` is: it always runs in the base repository's context with full secrets, and the job then checks out the commented-on PR's own head and runs `npm ci` on it. This repository is public, so a stranger's `postinstall` script would have been code execution on the runner with `ANTHROPIC_API_KEY` in the environment. The agents also read their mandates from the ref they were reviewing, which a branch could rewrite to tell the reviewer what to conclude about it; they now come from `master`. Never live - master's copy of the workflow has no `/qa` trigger, and an `issue_comment` event always runs master's copy - but it would have been the moment this merged. `npm test` fails if either guard goes. Found by the review agents.
- **`is_admin` is not writable from the app.** `profile_private` already carried an update policy and an insert policy scoped to the row's owner, and neither says anything about columns - so putting the flag on that table would otherwise have handed every signed-in account a way to make itself an admin with one PATCH. The migration revokes the two column privileges and adds a trigger that refuses the write a second time, in case a later migration re-runs the blanket grant from `20260628211540`. `npm run test:dev-dashboard` fails if either guard goes. Reading feedback and the store numbers is refused by policy, not by the row being hidden in the profile.

### Fixed
- **The running timer keeps the plus's shape.** Starting a workout turned the rounded square back into a circle with a circular ring around it, which read as a different control appearing mid-session. Button, pulse and ring are all the rounded square now; the rest countdown depletes the rounded rect's outline - four straight runs plus four corner quarters - instead of a circumference, so it still empties exactly as the rest ends. The plus also sits a few points above the middle of the bar rather than below it, and the timer sits where the plus sits instead of 31 points clear of the bar.
- **The NOTE column stops coming back on new exercises.** `20260916210000` turned the three opt-in columns off in `exercise_column_preferences` and stopped there - `exercise_instance` was never touched, and still held 26 rows with note on. That was enough on its own, because `cloneWorkoutContents` carries `visible_columns` across verbatim: copying a session from before the default changed put the NOTE column in a brand new exercise, and the copy became another legacy row that synced back up. Six months on it still looked like the default had never changed. The fix is the data rather than the copy - a copy should look like what it came from, and turning NOTE on for an exercise still sticks and still travels. The device's own pass runs under `opt_in_visible_columns_v2` so it goes once more instead of staying shut behind a flag set before any of this was true, and `npm test` now fails if that key is ever frozen again. **Needs `20260922100000_the-note-column-leaves-the-old-exercises.sql`.** Anybody who deliberately switched one of these on loses it once.
- **Home stopped scrolling past its own end.** The scroll view kept 120 points of bottom padding, which is clearance for a bar that floats over the content. The bottom bar is a sibling in the layout and never covered anything, so that was about ninety points of empty scroll under the last block. 28, the same as the feed.
- **The flame on the days-since box is visible.** `Fire.js` hardcoded `stroke="#141B34"`, so the `color` it was handed only reached the SVG's own `color` attribute and the icon drew near-black on a dark card - it read as missing rather than as wrong. `RunSetList` had already worked around it by passing `stroke` as well.
- **The month grid lost the row of dots under each date.** Six colours with no legend and a "+2" when there were more; nobody could tell what they meant. The date number already carries the day's state. The week view keeps its icon cards, where there is room to say what each one is.
- **Train no longer says "Every session this week is done."** The stats above it already carry the same number.
- **The quick-start button showed no text for a session nobody had named.** `SplitCards` got the fallback and `QuickStartCard` did not, so it printed `null`, React dropped the child, and the main action on Home drew an empty button - while the accessibility label kept its placeholder and a screen reader read out "Start {name}". Found by the review agents.
- **The dev dashboard could not page past the first twenty messages.** `created_at` was added to a table that already had rows, and Postgres evaluates that default once for the whole `alter table`, so every message sent before the migration carries the same instant. A cursor on the timestamp alone matched nothing on page two, because the rest are equal to it rather than less than it. The cursor is `(created_at, id)` now, and the total is counted over the table instead of over the page's own filter - which used to turn "47 in all" into "0 in all" on the second page. Found by the review agents.
- **The split guess stopped putting every unnamed session in one group.** A workout started from the quick-start button carries no label, and the insert falls back to the workout type - so it was stored as the literal string `"Resistance"`. `belongsToGroup` matched on that name at the very first check and never reached the exercise overlap, so an upper-body day and a leg day became one card and "up next" always pointed at the same session. It broke the split for exactly the person Home was rebuilt for, and it applied to history recorded before any of this. A label that is only the workout type is no longer read as a name, which repairs the stored history too; a group nobody named is drawn as "Session 1", numbered by its place in the history so the cards do not renumber when the row re-sorts. Found by the review agents.
- **A failed load of Home no longer reads as an empty account.** `loadHome` caught the error, wrote it to the console and set `hasLoadedHome` either way, and the three reads sat in one `Promise.all` - so one rejection emptied all three fields at once and told somebody with months of history that she had never trained, in the same words a genuinely new account gets. The reads are settled independently now, whatever succeeded is shown, and a failure puts a line on the screen with a way to try again. Found by the review agents.
- **Confirming an email landed on "Site not found".** `signUp` passed no `emailRedirectTo`, so Supabase fell back to the project's Site URL - and that field still pointed at `fitven.netlify.app` after the pages moved to `fitven.dk`. Everybody who confirmed an address was thrown onto a Netlify 404 and reasonably concluded that signing up had failed. It had not: Supabase spends the token and confirms the account *before* it redirects, so those accounts exist and can sign in. The signup now names `https://fitven.dk/confirmed/` itself, `web/confirmed/index.html` is the page that says so in a sentence, and `npm test` fails if the constant goes, stops pointing at that page, or points at a page that is not there. **Supabase must list the address under Authentication -> URL Configuration -> Redirect URLs**, or it refuses it and falls back to the Site URL again, which is the whole failure.
- **Exercises that never left the device now go up.** An upload pass skips an exercise whose workout cannot be given a cloud id at that moment, and the only code that recovers from that sits behind `allowParentRepair` - which the pass `SetSync` mounts turned off. One skipped pass and the row stayed on the phone for good, while its workout went on syncing as an empty shell: on one install three months of training exists only where it was typed, and every other device shows the workouts with no exercises in them. The hierarchy push now re-marks exercises and sets that have no cloud id under a parent that does (`markUnsyncedStrengthDataForRetry`), and lets the two lowest levels repair their parent instead of giving up. The pass asks about both cloud id columns and leaves deleted rows alone, so an install that has finished syncing is not touched again - `npm run test:stuck-strength` holds both halves of that.
- This is what was behind the split cards not appearing, a quick start that carried no values, and a workout copied in the calendar arriving without its exercises: none of them were about the screens, they were about data that was never there. **The rows only exist on the install that holds them**, so the account with the missing history has to run a build with this fix on *that* phone before anything can be recovered.
- The guard on `is_admin` asked whether the caller was `pg_catalog.current_user`. That is a keyword, not a function in a schema, so the parser read it as a column on a table called `pg_catalog` and the trigger failed on every write to the column it guards - including the one that grants the flag. It failed closed: the flag could not be set by anybody rather than by everybody. `20260921230000` is the follow-up.
- `admin_active_users` compared `last_updated`, a `timestamptz`, against `timezone('utc', now())`, a `timestamp`. Postgres casts the plain one using the session's own time zone, so the same query answered differently depending on who asked and from where.

### Notes
- **Home.** Three things in its design document do not match the code, and the code won each time. The Feed icon is `UI-icons/Note.js`, not `WorkoutLabels/Note.js`. The muscle-group mapping is not a `muscle_group` column on the exercise - it comes from the synced exercise catalog's body-map keys through `EXERCISE_MUSCLE_GROUPS`, which `getRecordsSourceData` already assembles, so Home and Records cannot disagree. And the split cannot be grouped on `exercise_id`: `Exercise_Instance` has no reference to the catalog, so the exercise name is the only identity two workouts share.
- **Feed has only the Following segment.** "My gym" needs a `security definer` function that does not exist yet; it follows.
- **Home needs no migration.** Both of its new questions are answered from the device's own SQLite. The two migrations on this branch belong to the dev dashboard.
- **Dev dashboard.** Two things in its design document were not followed, and both were decisions already taken in this repository.
- **No `os` or `device` on a feedback row.** The document asks the client to fill them from `expo-device`. `feedbackService` removed exactly those fields once already because together they fingerprint a device, and the published privacy policy does not list them - adding a data category means raising `PRIVACY_POLICY_VERSION`, which asks every user to accept again on their next launch. The columns exist so the decision can be revisited without another migration; the client leaves them empty and the meta line shows the app version alone.
- **No crash-free percentage.** The document offers Sentry or Crashlytics. The privacy policy says in as many words that there is no crash reporting, so the box shows an em dash - which is what the document itself asks for when the number does not exist.
- The feedback lives in the `Feedback` table the app has always written to rather than the new `app_feedback` the document describes. A second table would have left every message sent so far unreadable on the screen built to read them.
- The screen is not translated. It is reached by one account, and a key in `locales/` is two languages for everybody who edits it afterwards. The row in the profile that opens it goes through `t()` like the rest of that screen.

---
## [2.0.0] - Unreleased
### Added
- **Centres.** A public fitness centre is now a thing the app knows: chain, name, address, coordinates and a hero photograph, 365 of them across PureGym, LOOP Fitness, Fit&Sund, FitnessX and SATS. The source is `data/gyms/` - the scraped folder that used to sit on the desktop, moved into the repository with its five Python scrapers and JSON, the photographs gitignored - and `npm run gyms:import` puts it in Supabase: rows to `public.gym`, photographs to the public `gym-images` bucket. Run it with `--dry-run` first; it prints the short name every centre will carry on the tiles, and the rule that derives them is a guess about five chains' naming habits.
- **A workout knows which centre it happened in.** One position fix at the first start of the timer and, if that gave nothing, another at the finish, matched against the centre list within each centre's radius (120 m by default) by the `match_gym` function. Only the foreground permission is asked for; refused, or no centre in range, the workout simply has no centre and nothing complains. The result lives on `Workout_Type_Instance` as `gym_id` and the start coordinates, all eleven steps of the sync checklist.
- **Centre leaderboards.** Finishing a strength workout inside a centre sends the best set per exercise - heaviest weight, most reps on a tie - to `gym_lift`, one row per person per exercise per centre, written only when it is at least as heavy as what is there. The Centres screen (Social tab) shows a map, the nearest centres and the strongest verified lifts in Denmark; a centre's page shows bench, squat and deadlift with the top lifter and your own standing, then every other exercise; an exercise's page shows a podium, the list, and your row pinned when it is out of view. Centre / Friends and kg / ×BW toggles as designed. Your centre is where you trained most in 90 days, or the one you pick under Change centre.
- **Video verification.** A lift takes a video (record or pick, up to 30 s, 50 MB, private bucket, your own folder only). Members of the same centre watch it in a bottom sheet and approve or reject with a reason; three approvals verify it, two rejections remove it from the ranking and show it as rejected to the lifter alone. Across centres only verified lifts count. Up to ten recent members get an inbox notification asking for a verdict, and the bell opens the sheet.
- **Friends activity tiles.** Each friend is a 148 dp tile instead of an avatar: a music band on top, the avatar breaking its lower edge, name, and two aligned fact rows - status, and the centre the workout is at, in the accent when it is your own centre and tappable into its leaderboard. Order is live, done, planned, rest; the strip snaps tile by tile and ends in an Add friends tile. The old hairline after You is gone.
- **Music on the tiles.** Profile -> Settings -> Music connects Spotify (OAuth with PKCE; the login stays on the phone) and offers "Share music with friends", off by default. On, and only while a workout is running, the track that is playing is written to `workout_music` every 30 s and followers see it on your tile - an animated equalizer and a scrolling title while it plays, a quiet "last played" band after. Off deletes what was shared. Apple Music has no Expo module and is not connected; the table and the provider field are ready for it.
- **Danish.** The app follows the phone's language, Danish or English, and Profile -> Appearance -> Language overrides it (System / Dansk / English). Translations live in `src/Localization/locales/en` and `locales/da`, one file per area, read through `t()` and `useTranslation()`; the words for relative time ("2 days ago") and dates follow the chosen language too. A small module of our own rather than `expo-localization`, which is a native module and would have meant another development build. `scripts/test-localization.js` fails on a key in one language and not the other, on mismatched placeholders, and on a `t("...")` whose key exists in neither. The screens converted first are the ones opened most: navigation and the start sheet, Home, Social and the Friends activity tiles, Profile, sign in and registration, notifications, and the new centre screens; the rest still read English in both languages and follow area by area (see Notes).
- **The map shows which chain is which, and where you are.** Every pin carries its chain's colour - PureGym cyan, SATS red, LOOP purple, FitnessX yellow, Fit&Sund pink - with a key under the map, your own position as its own marker, and a button that brings the map back to you. Tapping a pin opens a card over the pin with the chain, the name, the city, the distance and how many members train there, and a button into the centre; the first tap no longer leaves the map.
- **The centres you train in, above the nearest ones.** A card on the Centres screen lists the centres you have actually trained in over the last 90 days, most-used first, so the one you want is at the top of the screen rather than whichever happens to be nearest right now.
- **A friend's tile says when, not whether.** A tile with nothing today now says how long ago that person last trained, or "Next workout" and the date when something is already planned, instead of "No activity". The strip sorts by today first, then whoever trains soonest, then whoever trained most recently.

### Changed
- `getCirclePreview` returns `gym` and `music` per person from the same request as before (two embedded joins), and falls back to the old select when the centre migration has not been run, so Home keeps working in the meantime. It also reads the viewer's own centre once, to mark friends' centre lines.
- Reduced motion turns off the pulse, the blink, the equalizer and the ticker; the layout does not change. Every loop also pauses when the screen is not focused or the app is in the background.
- New palette tokens `music`, `musicText`, `musicBandFrom`, `musicBandTo` in both schemes. Purple on purpose: a track must not read as a status.
- `app.json` gains `scheme: "fitven"` (the OAuth redirect needs a stable one) and camera and microphone permission strings for recording a lift. `expo-video`, `expo-auth-session`, `expo-web-browser` and `expo-crypto` are new native dependencies - **a new development build is required.**
- The chain colours are the chains' own rather than a palette: SATS red, PureGym cyan, FitnessX yellow.
- **The tiles' fallback state machine moved to `src/Utils/cloudActivityUtils.js`.** `buildCloudActivityPreview` and the four functions under it decide live, done, planned or rest, and parse a workout's start time; they sat in `socialService`, which imports the Supabase client and therefore react-native, so no test could load them. They are pure functions over a row, the same as `gymUtils` and `friendsActivityUtils`, and `npm test` now drives them: the order of the four states, a workout that is live only because it has a start time, `dd.mm.yyyy` plus `HH:MM` resolving to the right instant, and `25:00` reading as no time rather than as a time somewhere else. This is the path every client sees until its database has the 2.0 migrations.

### Fixed
- **A set value survives the keyboard being put away.** Typing a weight or a number of reps and then pressing the keyboard's checkmark, or its hide-keyboard button, dropped what had just been typed: neither moves focus, and the cell only committed on blur. The cell now commits when the keyboard hides and when the done key is pressed, once per distinct value, so the three ways of leaving a field all save.
- **A workout that could not find its centre gets another chance.** A basement with no position fix and no network meant no centre and no leaderboard entry, permanently. `GymMatchSync` looks over the last week of finished workouts on launch and on return to the foreground, matches the ones that stored coordinates but no centre, and re-sends lifts that may never have arrived. It matches from the stored coordinates only - it never takes a fresh position fix, so a workout is never attributed to where the phone happens to be days later.
- The bottom navigation keeps SOCIAL selected on the centre and music screens. They sit under Social but were showing Home.
- The Spotify and video native modules load on demand. A development build without them failed at startup (`Cannot find native module 'ExpoWebBrowser'`); now the features that need them report themselves unavailable and the rest of the app runs.
- `npm run gyms:import` peels its naming rules in turn, and appends the city when two centres in the same chain would otherwise carry the same short name.
- A failed video upload says so in the dialog it leaves open. The error went to the page's notice, which is drawn behind the modal's overlay, so the buttons came back enabled with nothing explaining why.
- The centre-match retry no longer reads twenty workouts on every launch to throw most of them away. Workouts with no centre and no coordinates, and the types that record a route rather than a place, are filtered in SQL instead of in JavaScript afterwards.
- The now-playing poll stops asking Supabase every minute for people with no music service connected. Connecting, disconnecting and the sharing toggle all clear the cache by hand, so nothing else can change that answer from this device.
- The play, camera, back and locate buttons take a tap at the edge. All four are under 44 pt on purpose and now carry the hit slop to match.
- The last hardcoded English string in the verification sheet is a translation key.
- **An exercise's leaderboard is a `FlatList`.** It was a `ScrollView` with every row mapped into it, 50 at a time - on the national list that meant hundreds of rows, each with its own avatar, mounted and never recycled. The card around them is drawn by the rows themselves now, because a recycling list cannot have one View holding all of them.

- **Nine things the agents' first pass found, which the second pass overwrote.** The report is one comment updated in place, so a later run replaces an earlier one's findings rather than adding to them; these had been sitting unread since. `deriveVideoStatus` hardcoded the two numbers its own exported constants hold, two lines below it - and the test asserted the same literals, so it would have kept passing through a change to the rule. `matchWorkoutToGymInBackground` was an export nothing called. `SearchPage` kept a second copy of the five report-reason keys. The debounced centre search existed twice, once per screen, and is now `useGymSearch`. The empty leaderboard's four wordings were nested ternaries; they are a lookup, and the friends case sharing the empty case's body is written down as deliberate rather than looking like drift. `formatClock` in the verification sheet was `formatCountdownTime` rewritten. `sortCirclePreviewPeople` wrapped one call and added nothing. The Change centre sheet borrowed a round 32 px icon style and squared it off with an override. And `searchGyms` cleaned its input with a denylist one file from where the same pull request uses an allowlist - not exploitable today, but a list of what breaks the filter stops covering it the moment the filter gains a field.

- **A workout's start coordinates never reach the cloud.** The centre migration put `start_latitude` and `start_longitude` on `workout_type_instance` without touching its row-level security, which is row-based - so the follower policy that shows yesterday, today and tomorrow was handing them over too, and following needs no approval. Six decimals is about ten centimetres; for somebody who starts the timer at home that is their address. The app never read them from the cloud. They stay in the device's own SQLite, where the retry that needs them reads them, and `supabase/migrations/20260921150000_drop-workout-start-coordinates.sql`, run on 2026-09-21, takes the columns out of the cloud. The centre id still travels - it is the derived answer, and it is the one the leaderboards need.
- The Centres screen and Change centre threw on every render. Extracting the shared `useGymSearch` put the call two lines above the `setErrorMessage` it takes, which is a temporal dead zone throw - the tab could not be opened at all. Nothing in `npm test` renders a screen, so it passed; a check that reads the two files for the order now sits in `scripts/test-gym-leaderboard.js`.

- **A friend's tile can say how long ago they trained.** It could not before: the tiles asked `workout_type_instance` for 180 days of history, and the follower policy on that table only lets a follower see yesterday, today and tomorrow - so the answer was always empty, every friend landed in the "no activity" band, and the relative-day wording the tiles were built for was unreachable. Widening the policy would have handed a follower the whole training history to produce two dates. `supabase/migrations/20260921160000_friends-surrounding-activity.sql`, run on 2026-09-21, is a `security definer` function that returns the last and next date and nothing else, for people the viewer actually follows, with blocks dropped.
- The accent is `primaryText` where it is ink. Eleven places on the new screens used `primary`, which the light palette deliberately darkens for text and icons - so "You", the centre badge and the chevrons read faintly on three of the four accents, invisibly on the default one. The two on the hero image's scrim keep `primary`: that surface is dark in both themes.
- The close cross and the "N to go" line in the verification sheet follow the theme. Both were fixed at the dark-theme grey while sitting on the sheet's ordinary background, so the close button was almost invisible in light mode.
- The centre search cannot show stale results. The debounce cancelled a search that had not started but not one already sent, so a slow answer for "puregym" could overwrite the right answer for "puregym aarhus" with the field untouched. Every search takes a number and only the newest may write.
- `calendarDaysBetween` answers nothing for a missing date. `new Date(null)` is the epoch rather than an invalid date, so a null read as 1970 and came back as "674 months ago".
- `mutedStrong` is a palette token. `isLight ? "#3F4550" : "#C4C7CF"` was written out in four files, which is three copies too many to survive the next palette change.
- The new screens import through the aliases. 64 deep imports across thirteen files, which `src/AGENTS.md` asks for in new code and which the review found nowhere except `@localization`.
- `npm test` covers what it did not: the day boundaries in `formatRelativeDay` and `formatTimeAgo` (0, 1, 6, 7, 30, 31 days - the comment above them names the bug that lived at one of those edges), the centre search's allowlist against the characters that delimit a PostgREST filter, and `imageObjectPath`, where a wrong slug is an image that never appears and nothing says so.

- **A blocked member cannot watch the other's verification video.** `private.can_watch_lift_video` was the one function in the video clean-up that did not ask about blocks - `ranked_lifts`, the vote trigger and the queue all drop a blocked pair. A leaderboard row carries the lifter's id and the lift id, and the object path is `<user_id>/<lift_id>.<ext>`, so somebody who had seen a row before blocking could still ask for a signed URL and get one. `supabase/migrations/20260921170000_blocked-members-cannot-watch.sql`, run on 2026-09-21, is that function with one clause added.
- An exercise's leaderboard threw on every render. The row renderer that replaced the `ScrollView` names `openReview` in its dependency array, and that array is evaluated as the component body runs, so a `const` declared further down is a temporal dead zone throw - the whole centre-to-exercise flow, including the verification sheet, was unreachable. The second of its kind in this branch, both in freshly refactored code, both green in `npm test` because nothing there renders a screen. `scripts/test-gym-leaderboard.js` now reads for the ordering.

- **The centre's name is readable in light mode.** The hero's lower gradient fades `theme.background` - near white in light mode - to full opacity over the bottom 150 px, and the heading sits inside it in white, at about 1.6:1. The colours were written for the photograph rather than for what covers it. Title, meta line and eyebrow now use the theme's own ink, which reads on the surface that is actually there in both modes.
- **The rejection red follows the theme.** `#FF7A7A` was the dark-mode red written out by hand with no light branch, at 2.5:1 on a white card - on the badge that tells a lifter why their lift was rejected, and on the button somebody else has to press. `theme.danger` is already darkened for light mode, for the reason the comment above `record` gives. `RejectedBadge` did not have the theme in scope at all, which would have thrown at render; `npm test` now fails when a component in those files reads `theme` without declaring it.

- **Sharing music is opt-in in the database too.** The insert policy on `workout_music` asked whether the row was yours and whether the workout was yours, not whether you had turned sharing on - only the client did, and the select policy shows the table to every follower. A rule that lives only in the app is a suggestion, because the same API answers an HTTP client holding the anon key. In `supabase/migrations/20260921180000_music-opt-in.sql`, run on 2026-09-21, with the index `gym_lift.video_path` never had in `20260921180100_lift-video-index.sql` beside it - one table each, because the two together deadlocked against a live app session. The index is `create index concurrently` and has to be run on its own.  It is what the read policy behind the video bucket filters on: the client signs a whole verification queue at once.
- The centre-match retry runs in batches of four instead of one workout at a time. It runs on every return to the foreground, and a week of training was up to twenty round trips taken one after another.
- The map waits for a pan to finish before it asks again, and only the newest answer may draw. Every small movement was a request.
- `matchWorkoutToGym` goes through the sync queue at all three call sites. `GymMatchSync` did it and said why - it writes local workout rows the workout sync then uploads - and the two calls at workout start and finish did not.
- Four exports nothing called are gone, the wall-clock parser exists once instead of twice, the tiles are sorted in one place instead of two, and `chevron` and `raisedSurface` are palette tokens rather than the same conditional hex in four files.
- `npm test` reaches further: the fallback that decides whether Home drops back to the flat select (it reads Supabase's error text, which is Supabase's to change), the music band's playing branch, and - after `RejectedBadge` turned out to read `theme` without declaring it - a check that a component in those files cannot.

- **Signing out forgets the music session.** The now-playing track, the last row written, the settings cache and the Spotify tokens all live in module and secure-store state, and signing out of Supabase touched none of it. The next person to sign in on that phone saw the previous one's track on their own tile - and inherited their Spotify connection, so switching sharing on would have written somebody else's account into their `workout_music`.
- **One verification request per lift per ten minutes, decided by the index.** The limit added yesterday was a select followed by an insert, and two calls a second apart both passed the select - neither sees the other's uncommitted row - so both filled ten inboxes. The unique key carried the epoch second, so it only caught calls inside the same second. The key now names a ten-minute bucket and the insert is `on conflict do nothing`: nothing sits between deciding and writing. `supabase/migrations/20260921190000_one-verification-request-per-window.sql`, run on 2026-09-21.
- The fallback select carries `last_updated`. It is what breaks a tie inside the tiles' "today" band, it has nothing to do with the centre migration, and without it the order on every not-yet-migrated database was whatever `getFollowing` happened to return - the path the feature spends its first weeks on.
- A leaderboard row is memoised, its data array and its handlers are stable, and opening the review sheet no longer re-renders every row on screen with its avatar and pill.

### Security
- **A verification video is for the centre it was lifted in.** `gym_lift_verification_queue` worked out centre membership, put it in the payload as `can_vote`, and handed `video_path` to everybody anyway; the storage policy on `lift-videos` was `bucket_id = 'lift-videos'` and nothing else. Centres are public and searchable, so any signed-in user could open any centre's leaderboard and watch strangers' videos. The queue now answers an empty list to somebody who does not train there, and the bucket goes through a `security definer` membership check.
- **A lift video has to be your own upload.** `video_path` accepted any string. The client always writes `<user_id>/<lift_id>.<ext>`, but PostgREST does not have to, so a lift could be pointed at somebody else's real video and voted through. Both the insert and the update now refuse a path outside the lifter's own folder - the rule the upload policy already enforced.
- **`request_lift_verification` answers once per lift per ten minutes.** The epoch second in its event key made every call a new event, so a loop could fill ten inboxes as fast as it ran.
- All three were found by the review agents on the pull request, and all three are fixed in `supabase/migrations/20260921140000_lift-videos-stay-in-the-centre.sql`, **run on 2026-09-21** - a follow-up, because the migration that carried them was already applied. The three functions in it are copied from the original verbatim with one change each.

### Notes
- **Both migrations are applied to the live project**, on 2026-09-17, and `npm run gyms:import` has run for real: 365 centres and their photographs are in Supabase, recorded in the ledger. Any other environment has to run them first, in order: `supabase/migrations/20260917120000_gyms-and-lift-verification.sql` and `supabase/migrations/20260917120100_workout-music.sql`. The first adds the three columns every 2.0 workout upload now carries; a 2.0 client against a database without them fails every workout sync. Then `npm run gyms:import`. Details in `supabase/migrations/README.md`.
- **Spotify needs a client id** in `expo.extra.spotifyClientId` (or `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`) and `fitven://spotify-auth` registered as a redirect URI in the Spotify developer dashboard. Without it the Music settings screen says so and the Connect button is disabled; nothing else is affected.
- Two deliberate departures from the design documents. `gym_lift` does not have a select-for-everyone policy: a block check cannot live in a policy (`src/AGENTS.md`), so every ranked read is a `security definer` function that filters blocks, and the table itself only answers for your own rows. And the review sheet is a component opened from the lists, not a stack route, because that is what a bottom sheet is in this app. The UI is in English like the rest of the app; the documents' Danish strings were translated.
- The `×BW` unit ranks weight over bodyweight and shows an explanatory empty state, because nothing in the app records bodyweight yet; the column and the ranking are there for when something does.
- **Not yet in Danish:** the workout screens themselves (Resistance, Run and the workout page), the calendar and workout library, the exercise library and catalog, programs and microcycles, personal records, workout type and social post settings, the 1RM calculator, sickness, and the privacy policy and terms texts (legal wording is not translated by a developer). A string in those screens is still an English literal; `src/AGENTS.md` says how to move one.
- **What has been on a device**, on a local development build: the centre screens, the map and its pins, the centres-you-train-in list, the friends tiles and the centre matching. **What has not:** Spotify, which still has no client id, and video verification, which needs a second account in the same centre. `npm test` covers the pure rules (best set, upsert, vote status, matching, short names over all 365 folders, tile order, music freshness) and the SQL invariants the app relies on.

---
## [1.1.6] - Unreleased
### Fixed
- **`npm test` has been failing in CI, and the run said it passed.** Two things hid it. The workflow ran Node 20, which has no `node:sqlite`, so the seventh test script died and the twenty-two after it never ran. And the step was written as `npm test | tee npm-test.log`, which makes the exit code `tee`'s, and `tee` never fails. The step therefore reported success on every pull request, and the eight review agents were handed "npm test: success" as a fact each time.
- The Node version is pinned in `.nvmrc` and read from there by both workflows, so it cannot drift from the one the tests are written for again. `engines` says the same thing to anyone installing.

### Added
- **A blocking test gate.** `.github/workflows/ci.yml` runs `npm ci && npm test` on every pull request and push to `master` and `release/*`, with no pipe and no `continue-on-error`. It is a required status check, so a red suite stops the merge. The existing review workflow keeps its own non-blocking run, because a failed test is exactly where a review has most to say, but it now reports the real outcome.

- **A tag per platform for what is actually in the store**, `ios/1.1.2` and `android/1.0.2`, on the commits those builds came from. The repository had no tags at all, so nothing recorded which code users were running, and a hotfix had nowhere to branch from except `master` - which is several versions ahead and has not been through review. `docs/VERSIONING.md` says to tag at submission, and how to recover a missing one from `eas build:list`.

### Changed
- **EAS owns the build numbers, and `app.json` no longer pretends to.** `eas.json` has said `appVersionSource: "remote"` for a while, which means EAS keeps `versionCode` and `buildNumber` on its side and ignores the ones in the app config. The release script kept incrementing the ignored copies anyway, so they drifted: `app.json` reached 18 while EAS was at 24 for iOS and 49 for Android. The fields are gone from `app.json`, the release script no longer writes them, and `docs/VERSIONING.md` says which number has which owner.
- **Feedback reports the build the phone is actually running.** It read the build number out of `app.json`, so a report from a build 24 device said "build 18". It comes from `expo-constants` now, which reads it from the binary.

---
## [1.1.5] - Unreleased
### Added
- **Report a post from the feed.** The menu on a workout post used to open only on your own; it now opens on everybody's, and on somebody else's it offers **Report post** instead of Edit and Delete. Same five reasons and the same optional note as reporting an account, and it writes the same `user_reports` row - `reported_post_id` has been there since 1.0.2 with nothing filling it in. Your own post keeps Edit and Delete exactly as before.
- **A post two different people report leaves the feed straight away**, and is read by a person afterwards. `social_post.hidden_at` is set by a trigger on the second report from a different account, and the read policy drops a hidden post for everyone except its author - a post that vanishes for the person who wrote it reads as a bug, and they are the one person the hiding is not protecting. Distinct reporters, not reports: reporting the same post five times is still one person's opinion.
- **Only report review sets `hidden_at`.** A `before update of hidden_at` trigger refuses any change that does not come from the hide itself, which announces itself through a setting the way the lift recount does. Without it the feature was decoration: `social_post` grants `update` on the whole table to signed-in users and the update policy only asks whether the row is yours, so the author of a reported post could have sent `hidden_at: null` from their own session. The one person the hiding is aimed at was the one person who could undo it.
- **A report has to name a post its own author wrote.** `reported_post_id` is deliberately not a foreign key - a report about a post that has since been taken down is the one worth keeping - so nothing checked that it belonged to `reported_user_id`, and two accounts could have hidden any post by anyone: one row each, their own reporter id, somebody else's post. A quiet censorship button. The insert now refuses a mismatched pair, and the hide counts only reports where the two line up, so rows written before this cannot act either.
- Reporting waits for the options sheet to leave the screen before the dialog opens. Setting both flags in one render puts two native modals up at once, and iOS drops the second without an error, so the button reads as dead. `ThemedBottomSheet` now says when it has gone, and it does not hang that on `Modal.onDismiss` - React Native fires that on iOS only, and this sheet returns null before its `Modal` anyway, so the subtree unmounts rather than dismissing. It watches its own `visible` flag instead and waits out the fade on iOS, which is why **Report post** works on Android as well. `ThemedConfirmModal` takes `confirmDisabled`, so **Send report** is greyed out until a reason is picked.
- The support page answers "Reporting a post or an account": where the two ways in are, that reports are read within a day, that two reports withdraw a post immediately, and that the person reported is never told who reported them.

### Changed
- **The review agents get far enough to write something.** 40 turns and 25 minutes were set against an ordinary pull request. Against the 2.0 branch - a hundred code files behind a 700 kB diff - seven of the eight agents ran out of turns and left nothing behind, twice, and the run reported success because the step is `continue-on-error`. Silence that reads as approval is the one failure this thing exists to prevent. Now 120 turns and 45 minutes, and the diff is cut at 400 kB rather than 700: an agent that dies halfway through a complete diff is worth less than one that reads a trimmed diff and opens the files it needs. It was not the token - `security` came through on the same one in the same matrix, all three times.

### Notes
- **`supabase/migrations/20260921120000_hide-a-reported-post.sql` was run on 2026-09-21**, so everything above is live in the database and waiting for the client that uses it.
- This is the part of the abandoned `major/content-moderation` branch that never reached master. The rest of that branch - the reports table, the term filter, the triggers - shipped in 1.0.2 as `20260912220000_ugc-safety.sql` under different names, so only these three pieces were missing.

---
## [1.1.4] - Unreleased
### Added
- **Eight review agents on every pull request.** `.github/workflows/pr-review.yml` fans a PR out to eight parallel Claude Code jobs - quality assurance, testing, security, architecture, code design, performance, UI usability and design - and a ninth agent merges their reports into one comment on the PR, updated in place on every push. Nothing has to be running locally.
  - Each agent's brief is a markdown file in `.github/review-agents/`, written against this repo rather than against code in general: the cloud-sync field checklist, the schema living in two files, the layer-aliasing rule, and the reason a colour must never sit in a `*Style.js`. Change what an agent looks for by editing its brief; the workflow only needs touching to add or remove an agent.
  - Every brief ends with what is *not* its job. Eight agents all looking for "problems" find the same three and write them eight times, so the mandates are deliberately disjoint and the aggregating agent drops duplicates on top of that.
  - The aggregator verifies a finding against the file before it reports it as blocking, and says so when an agent filed nothing rather than reading silence as approval.
  - `npm ci && npm test` runs alongside as the deterministic half, and its result is stated in the report.
  - The briefs carry what the five consultant reviews in `docs/` already found, so an agent starts where the last review stopped rather than from general practice: the per-second work during a workout and the sequential round trips from the performance audit, the personal data that once shipped inside the bundle from the security review, the seven recurring design patterns - 35 text sizes, 36 corner radii, five top bars - and the keyboard handling that was globally ineffective on Android. Each brief says what was checked and deliberately cleared, so a settled question is not reopened on every PR.
  - Findings carry an id per agent (`SEC-1`, `PERF-2`), and confidence is `Bekraeftet` or `Mistanke` rather than a vague scale: an agent may only write `Bekraeftet` about something it opened the file and saw. A report also lists what it examined and found sound, which is the half that tells you the silence was checked.
  - Authentication is either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` as a repository secret. With neither set the review jobs skip instead of failing, so the workflow is safe to merge before the secret exists. Setup is in `.github/review-agents/README.md`.
  - **The briefs say which text is an instruction and which is data.** The prompt from the workflow and `.github/review-agents/*.md` are instructions; everything about the pull request - the diff, the description, the commit messages, the code comments - is data, written by whoever opened it. Text in there addressed to an agent is a finding to quote, not an order to obey. The agents found this missing when they reviewed themselves: without it a pull request can dictate its own approval, and that report looks exactly like a real one.
  - **A failed lookup of the existing comment stops the run instead of posting a second one.** `|| true` sat on the `gh api` call itself, so a rate limit or a 5xx read as "no comment yet" and the run answered by creating another comment and reporting success - breaking the single comment, updated in place, that this entry promises.

---
## [1.1.3] - Unreleased
### Changed
- `eas submit --platform ios` carries the App Store Connect app id in `eas.json`. Without it the command stops and asks, which a non-interactive run cannot answer, so every submission had to be driven by hand.

---
## [1.1.2] - Unreleased
### Fixed
- Posting a workout no longer waits for a full workout sync. Only a missing source workout is repaired, inside the shared sync queue, so another workout's invalid type cannot block an existing summary or a new workout upload.
- A failed post after finishing a workout keeps the dialog and note open, shows the error, and offers Try again.
- Published status survives unrelated profile/settings lookup failures. An unavailable post lookup shows an unknown status instead of falsely marking workouts unposted; newly posted cards retain the returned post id for editing.
- Supabase permission and constraint errors retain their real messages instead of being reported as missing social tables.
- Applied a separate, repeatable Supabase migration to restore missing built-in and legacy workout types, preserving existing catalog settings and read-only client access. The live catalog contained only Resistance and Run; Walk, Upperbody, Legs and StrengthTraining were added on 2026-09-15.

---
## [1.1.1] - Unreleased
### Changed
- **Run and Walk are gone from every list that offers a workout type**, rather than shown greyed out under a COMING SOON stamp. App Store review guideline 2.1 treats a control that announces a feature and then refuses it as an unfinished app, and it was not a control anyone could use in the meantime. Three places: the cards in the start sheet, the type list in Workout types settings, and the type filter in Your workouts.
- **Workouts already recorded as Run or Walk are untouched.** They are the user's history, not an offer - this account has twenty of them - so those rows still appear in the calendar and the workout library, still carry the badge and still refuse to open.
- `filterReleasedWorkoutTypes` in `workoutTypeAvailability.js` is the one way a list drops them, so shipping Run means editing `COMING_SOON_TYPES` and nothing else. The Run settings block in Workout types settings stays where it is for that day; it is simply unreachable until then.

### Notes
- Not verified on a device: the phone was disconnected when this was written. In particular the start sheet now has a single fresh-start card where it had three, and `freshCard` has `flex: 1`, so Resistance will stretch to the full width of the row. That is the layout doing what it was told, but nobody has looked at it.

---
## [1.1.0] - 2026-09-16
### Added
- **Terms of use, agreed to before an account can be created.** App Review rejected the app under guideline 1.2 with filtering, reporting, blocking and a published contact address all already in place, and named the missing piece: *"require that users agree to terms (EULA) and these terms must make it clear that there is no tolerance for objectionable content or abusive users"*. The zero-tolerance wording is therefore load-bearing, not decoration.
- The register screen carries a required, unticked checkbox and a link to the full terms; the form refuses to submit without it. A pre-ticked box is not an agreement.
- The consent gate now asks for both documents on one screen and records both in one write. Both or neither — somebody who has accepted one and not the other is a state nothing downstream knows how to read.
- `web/terms/index.html` is generated from `src/Resources/Legal/termsOfUse.js` the same way the privacy page is, and `npm test` fails if the two have drifted. Two copies of an agreement drift, and which one a user accepted then becomes an open question.
- **Blocking now tells the developer.** Apple asked for that too: a block raises an automatic report, marked `source = 'block'` so it can be told from one somebody actually tapped. Removing the blocked account from the feed instantly was already true — the block severs the follow in both directions, and everything a follower sees is gated on that row.
- `scripts/test-terms-of-use.js` holds the clause in place: the no-tolerance wording in both the full text and the one line beside the checkbox, the register screen refusing to submit, the checkbox starting unticked, the gate comparing versions, and the block notification being wrapped so a failure cannot roll the block back.

### Notes
- **`supabase/migrations/20260916140000_terms-of-use.sql` has to be run before the next submission.** Without the two columns the gate cannot record an answer and asks again on every launch.
- The block notification is wrapped in its own exception handler. An `after insert` trigger that raises rolls the statement back with it, and somebody asking to be left alone must not be refused because a notification failed — the lost notification is the smaller harm, and the block is still on record.
- Apple reviewed on an iPad Air 11-inch (M3) despite `supportsTablet: false`. It drew no comment, but it is worth knowing that the declaration does not stop them.

---
## [1.0.2] - 2026-09-13
### Added
- **Reporting.** A Report action beside Block on the followers and following lists, with five reasons and an optional note. Reports land in `public.user_reports`, readable only by the person who filed them — the reported account cannot learn that it was reported or by whom, which is the difference between a report and the next round of the argument. There is no update or delete policy: a report is a record.
- **A term filter on everything a user can type that someone else reads** — a post's title and body, and a profile's display name and bio. It runs as a `before insert or update` trigger, not in the app: a rule that only runs in the client is a suggestion, because the same API answers an HTTP client holding the anon key.
- The list lives in `public.blocked_terms` with row-level security on and no policy at all, so only the security definer function reads it. Publishing the list would hand every user the exact set of strings to route around. Terms can be added with the service role without shipping an app release, which on iOS means without waiting for review.
- Matching is lowercased, whole-word, and collapses non-letters first, so "s p a m" and "s.p.a.m" do not walk past a list holding "spam" — while "assessment" and "Scunthorpe" still get through. A filter that fires on ordinary words gets worked around rather than respected.
- `scripts/test-ugc-safety.js` guards the seam nothing else does: the reasons the client offers and the reasons the column accepts, the note length on both sides, that the select policy is still scoped to the reporter, that no update or delete policy appeared, and that the filter still watches every free-text column. Add a reason to one side only and the insert fails in production, on the path a user reaches when something has already gone wrong for them.

### Fixed
- **An exercise card grew when a set was added and never came back down when it was deleted**, leaving an empty strip under the last row until the card was collapsed and reopened. On both platforms — this one was never a modal problem.
- The expand animation interpolates towards a stored height, and the rule for replacing it only ever let it grow. That was guarding something real: during a collapse the section is still mounted and reports its way down to nothing, and storing that would leave the target at zero so the row could never open again. It guarded too much — the stored value became a high-water mark. Shrinking is now accepted while the row is open and ignored while it is closing, which is the same protection without the side effect.
- The rule moved out of the component into `expandedHeightRule.js` with `scripts/test-expanded-height.js` on it. It is four lines that look obviously right in two different ways, and the first version shipped.
- **Deleting a set, deleting an exercise, and the rest-unit picker were dead on iPhone**, for the same reason blocking was: each opens a second modal while the first is still up, and UIKit drops the presentation without an error. React Native leaves a full-screen view behind when that happens, so every touch afterwards went nowhere — the symptom reported from the device was "nothing happened, then no button worked".
- The set confirmation is now nested inside the options sheet, where the sheet presents it. The exercise panel could not nest: the rest-unit modal lives in a different component, so the panel closes first and the intent runs from `onDismiss`, which is the callback iOS fires once the dismissal has finished. `ThemedModal` forwards `onDismiss` for this.
- **Blocking worked on Android and did nothing on iPhone.** The followers list is a modal, the confirmation was a sibling of it, and both were visible at once. Android renders a Modal as a view and shows both; iOS presents one at a time and silently drops the second, so the button looked dead. The confirmations now sit inside the list modal, where the outer one presents them. This was not cosmetic: blocking is one of the four things Apple's guideline 1.2 requires of an app with user-generated content.

### Notes
- `supabase/migrations/20260912220000_ugc-safety.sql` was run on 2026-09-12. Verified over the REST API with the anon key: `user_reports` answers with an empty array, and `blocked_terms` answers `42501 permission denied` — the second is the one worth checking, because an empty array there would have meant the app could read the word list.
- Guideline 1.2 asks for four things. Blocking and published contact information were already there; this adds reporting and filtering. The fourth part of the reporting requirement is "timely responses to concerns", which is a process, not code — reports are read with the service role, and `supabase/migrations/README.md` carries the query.
- The same bug turned out to be live in three more places, all now fixed: deleting a set, deleting an exercise, and the rest-unit picker. The pattern still exists wherever a modal opens another one, and the durable repair is a shared overlay host rather than a patch per site - but the four flows that were actually broken are closed.
- The filter does not cover `username_base`. Usernames are claimed through `public.claim_username_code`, which is a different path with its own rules, and reaching into it from here would have split the validation across two places.

---
## [1.0.1] - Released with 1.0.2
### Changed
- **The Train summary says what it is again.** Its title is "Your training this week" rather than a count that changed as the week went, and the first stat is labelled Workouts rather than "This week" - the title carries the period, so the number under it does not have to repeat it.

### Removed
- **The summary bar on Personal Records.** It was a fourth thing to read before the screen's own first section, on a screen that already opens with Biggest movers and a Statistics block of its own. Its data went with it; nothing else used it.

---
## [1.0.0] - 2026-09-12
The first release. Everything below this line shipped in it; the sections under
it are the work it is made of, kept as they were written.

### What 1.0 is
- Resistance training, end to end: programs built from blocks, weeks and days; workouts with sets, reps, weight, RPE and %1RM; rest timers; personal records kept per rep count from 1 to 12 on the Brzycki estimate.
- A calendar of every day trained, planned or lost to illness, a 1RM calculator, an exercise library of 89 exercises with a body map you can filter by, and a sickness log.
- A social side: follow other people, see who is training now, share a workout summary, block an account. Blocks cut the follow in both directions, which is what gates everything one account can see of another.
- Push notifications when someone you follow starts a workout, with an inbox that keeps them.

### Not in 1.0
- **Run and Walk are switched off.** The types are in the app and refuse to start, marked COMING SOON, because the tracking side is not finished. `COMING_SOON_TYPES` in `workoutTypeAvailability.js` is the only thing to change when they ship.
- **iOS.** The bundle identifier, the App Store listing and the privacy answers are prepared, but there is no Apple build, so there are no APNs credentials and push notifications cannot work there yet.
- **The workout-start database webhook** is not enabled in the Supabase dashboard. The app sends the notification itself, so notifications work; the webhook is the second path, and the dedupe that makes the two safe together is in place waiting for it.

### Known before shipping
- An external QA pass over the app the day before this release found 20 defects and asked 12 questions. All of them are answered in 0.24.3, and all but one were verified against a running app on a device.
- Left undone from that pass: button capitalisation is inconsistent - "Keep going" and "Post it" against "CANCEL" and "DELETE WORKOUT". The labels are already title case; the capitals come from `textTransform` in a dozen style files, so picking one convention is a design decision rather than a fix.
- Not covered by any test or device pass: whether one account can see another's data. It needs a second account and is the most important gap before the app is in front of strangers.

### Build
- Android versionCode comes from EAS, not from `app.json`: `eas.json` sets `appVersionSource: "remote"`, so the value written here by `release:prepare` is what `expo-constants` reports, not what the store sees.

---
## [0.25.0] - Released with 1.0.0
### Added
- **A summary bar at the top of Train, Calendar and Personal Records.** `PageSummary` is one component in three places, so the three screens open the same way: what this screen covers, one sentence of where you stand, and two or three numbers. It is never tappable, so it cannot compete with the cards under it for the first tap, and a value that has not loaded yet renders an em dash rather than a confident `0` that is replaced a moment later.
  - Train: sessions left this week, `done/planned` for the week, workouts completed, records, and the name of the next planned session.
  - Calendar: planned, completed and sick days for the month on screen, following the swipe.
  - Personal records: records, exercises, heaviest lift, and when the last record was set.

### Changed
- **The calendar is a hero card at the top of Train**, the same size and style as "Manage your programs" and "Your workouts", with its own cover image. It was a one-line row in the middle of the tools list, which is not where the app's own calendar belongs. The page order is now summary, calendar, the remaining tools, then programs and workouts.
- The cover image is 1024x329 JPEG at 32 KB - narrower than the card needs at 3x density, and smaller than either of the two covers already in the app. The source PNG was 2210x711 and 1.5 MB; shipping it would have cost the bundle a megabyte and a half for a strip 110 dp tall. All three hero cards now share one `coverImage` style and pass `fadeDuration={0}`, because a local JPEG decodes before the first paint and the cross-fade only shows as a flash of card background.
- `addDays` and `getCurrentWeekRange` moved from HomePage into `dateUtils`. Train needs the same Monday-to-Sunday week Home uses, and two screens disagreeing about where a week starts is the kind of thing that is only found months later.

### Fixed
- **Personal records and Train disagreed about how many records you have** - 14 against 11 for the same data. A set keeps its `personal_record` flag after a heavier set takes its rep slot, so counting flagged sets counts sets while `completedRecordCount` counts filled ladder slots. Both screens read the latter now.

### Notes
- Checked on a Galaxy A34 in dark mode: all three bars, the calendar card against the two it sits with, and the record count matching Train. Light mode is unverified - the component reads theme tokens throughout and defines no colour of its own, but that is an argument, not a check.

---
## [0.24.3] - Released with 1.0.0
### Fixed
- **A typed number is checked for sense, not just for format** (BUG-1, pattern D). 999999 kg went straight through to the personal records, the Brzycki estimate, the weekly volume and every chart built on them; one slipped keypress rewrote the user's history permanently. `src/Utils/setValueLimits.js` caps weight, reps, RPE, %1RM and rest, applied in the service - the only path a set takes to the database - and in the set row, so the correction is visible immediately rather than appearing after a reload. The weight keyboard offers `-` and `,`: a comma is a decimal separator, a minus sign is a stray keypress and is dropped.
- **The 1RM calculator stops at twelve reps, not thirty-six** (SPM-7). Thirty-six is where the Brzycki denominator turns negative - where the arithmetic breaks, not where the answer stops meaning anything: 100 kg for 36 reps returned 3703.5 kg with no qualification. Twelve is the length of the record ladder, and all three callers now read it from one constant. The placeholders read "e.g. 100" rather than looking like filled-in values on a form that then rejects them (SPM-11).
- **Personal Records is in English** (BUG-2). A whole screen was in Danish inside an English app.
- **"Yesterday" means yesterday** (BUG-9). A record set at 21:42 today read "i gaar", because its age was elapsed milliseconds measured against a date stored at midnight. Relative days are counted as calendar days by one shared formatter with plural agreement, and `formatTimeAgo` defers to it past a day so the same event is not "1d ago" on one screen and "Yesterday" on another (BUG-17, BUG-20).
- **A program's volume says "not logged" rather than "0 kg"** (BUG-3). The query was right - I pulled the device database: those programs have 31 workouts, 25 done and no exercise instances at all. "TOTAL VOLUME 0 kg" beside "12 of 12 workouts completed" reads as a broken counter when what it means is that nothing was recorded. Absent and zero are now different.
- **A draft's progress follows its workouts** (BUG-7, SPM-9). It was pinned at 0%, so a card read "5/5 workouts" next to "Progress 0%".
- **The blocked list counts what it lists** (BUG-6). Its title fell through to the followers count, so an empty list was headed "Blocked (1)".
- **Screens say "not known yet" instead of "nothing"** (BUG-8, pattern A). Personal Records painted "nothing to measure yet" and 0 records while its query ran; Friends activity asked an existing user to "Set up profile" while their profile was being fetched.
- **The back button closes bottom sheets** (BUG-4). `ThemedBottomSheet` passed no `onRequestClose`, which is what Android's back gesture calls, so every sheet built on it ignored the system back button. The calendar's day sheet has no close button of its own, so the only way out was to find the backdrop.
- **The tab bar stops lying, and its tabs stop dying** (BUG-5). The handlers no-opped whenever their tab was highlighted rather than when the user was already on its root screen, so from notification settings the PROFILE tab did nothing. Notification settings is reached both from the Home bell and from Profile, so no fixed route table can be right for both: those routes keep whichever tab the user was already on.
- **Notification rows go somewhere** (BUG-15). They looked openable and were not. There is no screen for another user's profile, but every notification here is someone starting a workout, which is what Social shows.
- **One timer question at a time** (BUG-12). Completing the only set of a workout that was never started raised both prompts back to back, and they contradicted each other: "Stop the timer and finish the workout?" and then "the workout timer has not been started".
- **Finishing a workout says what was recorded** (BUG-13). Nothing changed on screen except the play button disappearing.
- **An empty workout cannot be posted** (SPM-12). The feed already held "1 hour 6 min - 0 sets across 0 exercises".
- **The muscle filter is OR** (SPM-6). Requiring every chosen muscle reads well with two and is useless with more: chest, traps, abs and lower back together matched nothing, because no exercise trains all four.
- **The exercise catalog stays open** (SPM-2). It closed after the first exercise, so a workout with six meant six trips through it and six searches - on a list whose every row carries its own + button. It marks what has gone in and has a Done button that counts.
- **"No matches" is visible and has a way out** (BUG-16). It was centred inside a viewport-height box, so it sat below the fold and the screen looked blank; the only reset was inside the filter sheet.
- **One program runs at a time** (SPM-3). The home screen says "the active program", in the singular, and there were two. Starting a second while one is genuinely still running is refused, naming the one in the way - and all three call sites swallowed `startProgram` errors into the console, so the button would otherwise have done nothing at all.
- **A program past its end date finishes itself** (SPM-4). One whose last day was 75 days ago was still ACTIVE, and still what the home screen linked to.
- **One percentage, one meaning** (SPM-5). The detail page showed weeks elapsed beside "Week 5 of 5", so a program with six workouts left read 100% there and 81% on the card it was opened from.
- **An empty program day is not a dead end** (BUG-10). It was a blank screen, and a finished one was worse: the add buttons hide when a workout is done, so a day ticked off by mistake had nothing on it and no way to put anything there.
- **Unsaved profile edits survive leaving the screen** (BUG-11). Coming back discarded them without a word. An edited field keeps what the user wrote; untouched ones still refresh.
- **Every completed workout can be shared** (SPM-8). The posts page stopped at the most recent 20 without saying so, beside a Train tab reporting 50 completed.
- **A calendar count is not a bare number** (SPM-10). The 2nd with three workouts read "3"; the cell beside it read "3" because it was the 3rd. The count carries a dumbbell.
- **The auto-rename explains itself** (SPM-1). A strength workout names itself after the exercises put into it - intended, and now said under the title, only for the rename the app did itself.
- **Accessible names** (BUG-18) on the shared header's back arrow, the checkbox that completes a set, the exercise filter, block options and Profile's bare "Clear". The first two are shared components, so they cover most of the screens named.
- **Run and Walk read as unavailable** (BUG-19). They already refused the tap and carried a COMING SOON badge, but only the icon was dimmed.
- **One program date format** (BUG-20). Two local copies of the same function meant the list said "25 MAY - 28 JUN 2026" and the page it opened said "25.05.2026 - 28.06.2026".
- **The nested-list warning** (BUG-14). It is about a list handed unlimited height, which this one is not: it has a fixed viewport and owns its scrolling, and the parent ScrollView has to stay because making it a list froze the inner one on its first ten rows. `VirtualizedListContextResetter` is React Native's own escape hatch for that case - `Modal` uses it for the same reason.

### Notes
- All of the above were verified on a Galaxy A34 against a live database, and three of them only turned out to be wrong when they were. `VirtualizedListContextResetter` alone made BUG-14 worse rather than better; the first BUG-11 attempt emptied every profile field and could not have worked anyway, because leaving the screen unmounts it; and SPM-1's note was added to a header a resistance workout does not draw. BUG-2 also looked unfixed for half an hour: Metro was serving the English strings while the device rendered the Danish ones, which `expo start -c` resolved. Anything not checked against a running app on this branch should be assumed unfinished rather than done.
- Test data: two workouts were created on 12.09.2026 to exercise the weight limit, the timer prompts, the finish receipt and the catalog picker. Both were deleted through the calendar and the personal records confirmed back at Bench Press 169 kg. Nothing was posted.
- Not done: the button-casing half of BUG-20 ("Keep going"/"Post it" against "CANCEL"/"DELETE WORKOUT"). The labels are already title case; the uppercase comes from `textTransform` in a dozen style files. Picking one convention is a design decision across the whole app rather than a defect fix, and it cannot be judged without a device.

---
## [0.24.2] - Released with 1.0.0
### Fixed
- **The new notification test only passed on a working copy with LF line endings.** It finds the Edge Function's helpers by looking for a closing brace on its own line, and git checks the file out with CRLF here, so the test went green on the branch that wrote it and red on master the moment it was merged. It normalises the source before searching it now.


---
## [0.24.1] - Released with 1.0.0
### Fixed
- **The two paths into the workout-start notification could not dedupe against each other.** The app calls the Edge Function the moment a timer starts; the database webhook calls it again when that row reaches the cloud minutes later. Both paths are supposed to land on the same `notification_events` key, and none of the three keys in use collided: the stored row id when the client's workout had already synced, `actor:sync_id` when it had not, and a bare `sync_id` from the webhook. Enabling the webhook described in `20260609112712_workout-start-notifications.sql` would therefore have sent every follower two identical pushes for every workout. The key is now `workout_started:<actor>:<sync_id>` on both paths — `sync_id` is the only identity both hold, because the row id does not exist until the workout has synced. The actor prefix stays: it is what stops a caller from registering a key in somebody else's name to suppress their notification, and `actorId` is trusted on both paths. When the client's workout is matched to a stored row, the key uses the *stored* `sync_id`, so a caller sending a real row id under a wrong `sync_id` cannot get a second key out of it.
- **Opening the notification list from a notification did not clear the unread badge.** The tap handler passed `markNotificationsRead: false`, so only the bell on Home could ever mark anything read and the badge kept counting notifications the user had already been shown.
- **The unread badge went stale while the app was in the background.** A notification that arrives then never reaches the in-app listener, and screen focus does not change when the app is brought back, so Home kept its old number until the user navigated away and back. It now refreshes on `AppState` becoming active.
- **A device registered to a second account said nothing about being switched off.** `manage-push-token` stores the row disabled while another account is still active on the same push token — deliberately, so a device is not silently taken — and returns `blockedByActiveOwner`. Nothing read it back, so notification settings reported a saved choice on a device registered to receive nothing. The settings screen now says so, and says what clears it.

### Notes
- Checked and found correct, so they are not changed here: blocks sever follows in both directions before any notification is sent; account deletion clears `push_tokens`, `notification_events`, `notification_inbox` and the custom source list; `POST_NOTIFICATIONS` comes from `expo-notifications`' own manifest through the merger, so its absence from `app.json`'s explicit Android permission array is not a gap; the actor's own devices are excluded from the push both by user id and by token, so a shared device does not notify the person who started the workout.
- Not verified on a device: the delivery itself. It needs a second account to follow this one and start a workout, and on iOS it needs APNs credentials that do not exist until the first Apple build.

---
## [0.24.0] - Released with 1.0.0
### Changed
- **A personal record is gold, everywhere.** `record` was `#4BA3DB` blue and the new Records design wanted gold, which would have left one thing wearing two colours depending on the screen. The token changed instead of the screen, so the PR badge in a social post, the marker in SetList, the calendar and the workout library all moved together.
- Light mode darkens the gold to `#8A6410`. `#E8B44A` reads at 1.9:1 on white; the design proposed `#B8860B`, which is 3.25:1 and still under the 4.5:1 a text colour needs.
- **The Records overview is rebuilt from the spec.** The weekly muscle-load radar is gone; the same question is answered further down by logged sets per muscle group, from what was trained rather than what a program planned. In its place: biggest movers measured against each exercise's best before the window, statistics as rates against the preceding window rather than totals, weekly volume with a four-week average, the newest records, and sets per muscle group.
- Biggest movers draws from a zero line, so an exercise that went backwards is shown going backwards instead of being dropped. Both directions share one kilo scale. The selection is named underneath — four biggest gains and the single biggest decline — because otherwise a drop among five looks like a broken sort.
- **The exercise page is rebuilt too** (spec section 5). The 1RM chart has a real time axis: points sit on their dates, so gaps in training are visible instead of being smoothed away. Runs more than 14 days apart are drawn as separate curves joined by a dashed grey line, with the break shaded and its length named. A tick under the baseline marks every session, and the best estimate carries a gold dot and a dashed line down to the baseline.
- The rep table became a grid, one tile per rep count. An untrained rep count keeps its tile with a dashed border rather than disappearing — the hole is the information. A record set inside the period is gold.
- **The rep ladder runs to twelve, not ten.** A rep block commonly goes to twelve, and stopping at ten meant an eleven- or twelve-rep set could never be counted as a record at all. `PERSONAL_RECORD_REPS` moved with it, so the ladder and what the app treats as a record agree.

- Added "Næste skridt", phrased forward rather than as a comparison across rep counts, and "Seneste sæt" with the sets from the last three sessions.

- The plain exercise list is gone. "Vis alle N øvelser" expands the movers instead, which keeps one list rather than two that disagree about ordering.

- `recordLight` in light mode was a pale tint that `ExerciseRow` uses as the *title colour* for a record exercise — unreadable before and unreadable in gold, so it now matches `record`.

### Removed
- **The Exercise Map screen and the Train entry that opened it.** The map is in Exercise Library now, above the list it filters, so the separate screen was a second place to do the same thing. Gone: the tool row, the `ExerciseMapPage` route and its screen file, and the route name from the bottom navigation's library group. The figure, its outlines and its touch handling stay where they are — `src/Pages/ExerciseMapPage/` still holds them, and Exercise Library imports them. `docs/EXERCISE_MAP.md` describes what the folder is now.
- `normalizeMapExercise` and `filterMapExercises` went with it — the screen was their only caller, and Exercise Library filters the catalog rows directly rather than adapting them first. `exerciseMapUtils.js` is now `REGION_LABELS` and nothing else, and `test-exercise-map.js` lost the assertions that covered them. What it still checks is the part that matters to the figure: that every region it can draw has a name, that the back trapezius is the full group, and the whole of the touch handling.

---
## [0.23.38] - Released with 1.0.0
### Fixed
- **The CMake pin is Windows-only now, and the first cloud build is what found it.** `withDevAppVariant` pinned CMake to 3.31.6 for every build. That version exists on this machine because it was installed by hand: the ninja in 3.22.1 is not long-path aware and the C++ codegen breaks on Windows once object paths pass 260 characters. EAS builds on Linux, has 3.22.1, and has no reason to carry 3.31.6 — so the first production AAB failed outright with `[CXX1300] CMake '3.31.6' was not found in SDK, PATH, or by cmake.dir property` after five minutes of Gradle. The pin is gated on `process.platform === "win32"`, which ties it to the reason it exists rather than to a build environment, so a local Windows build is unchanged and a Linux one stops asking for a CMake it does not need.

### Notes
- Nothing had ever been built for release through EAS before, so the plugin had only ever run on Windows. A workaround that is correct locally and wrong everywhere else is invisible until something else builds it.

---
## [0.23.37] - Released with 1.0.0
### Added
- Exercise Map directly below Exercise Library in Train: a native, themed screen with the real exercise catalog, search, multi-muscle filtering, primary/secondary roles, front/back views, body crops and surface/contour styles.
- Full trapezius contour on the new map and accessible muscle-name selection. Existing exercise previews and database/sync schemas are unchanged.
- Regression checks for catalog muscle metadata, both body views, missing mappings and AND/OR filtering.

### Fixed
- Muscle taps now tolerate small finger movements on Android; scrolling across the figure cancels selection.
- **Removing a selected muscle was slow.** The row, the separator and `keyExtractor` are now defined once at module scope instead of inside the component. `ItemSeparatorComponent` was an arrow function rebuilt on every render, which React reads as a new component *type* — so every separator was unmounted and remounted rather than left alone — and an inline `renderItem` re-rendered every visible row. `renderItem` now depends on `mode`, `selectedName` and the theme, not on the muscle selection or the result set, so rows that survive a toggle are not asked to draw again, and the row itself is `memo`'d.
- Removal is the expensive direction and stays that way by design: `filterMapExercises` returns everything when nothing is selected, so clearing the last muscle widens the list from a handful of rows to the whole library. Measured at 0.5–2 ms for 200–2000 exercises, so the filter was never the cost — the re-render around it was.
- **Exercise Library: `selectedMuscleFilters` is memoised.** It was rebuilt on every render, which made the `highlightedRegionKeys` memo below it miss every time and handed `ExerciseMapBody` a new `selected` array — so both figures re-rendered on every keystroke and every filter change for as long as any muscle was selected. `EMPTY_REGION_KEYS` already guarded the nothing-selected case; this is the other half of it.

- **The catalog list is a `FlatList` instead of a `ScrollView` with a plain `.map()`.** Every row mounts a body figure — an image plus an SVG region overlay — and all 89 were built in one commit whenever the filter widened. The row moved into a memoised `CatalogExerciseRow`, and `toggleFavourite` reaches it through a ref so the memo is not undone by a callback that changes identity on every render.

### Notes
- **Measured on a Galaxy A34 (Android 16, dev build), removing a selected muscle in Exercise Library.** Frame time from `dumpsys gfxinfo framestats`:

  | | Frame |
  |---|---|
  | before | **645 ms** |
  | memoising `selectedMuscleFilters` | **521 ms** |
  | `FlatList` | **74 ms** |

- Selecting a muscle already cost 77 ms before any of this. Both directions redraw the same two figures, so that 77 ms was the floor and everything above it was the list. Removal now costs the same as selection, which is what says the asymmetry is gone rather than reduced.
- The remaining ~74 ms is the two large figures. Splitting that SVG was the other candidate fix and would have been mostly wasted: it can win at most those 74 ms, and only part of them.
- **No `getItemLayout`.** The rows measured 174–177 px at density 450 through `uiautomator dump`, so the height is not the clean constant `EXERCISE_ROW_HEIGHT` implies, and a wrong value there drifts the scroll position.
- **React Native warns that the catalog list is a VirtualizedList nested inside a plain ScrollView, and the warning stays.** Its suggested fix — making the page scroll a `FlatList` that carries the page in `ListHeaderComponent` — was tried and reverted: it silences the warning but the inner list then stops scrolling entirely, sitting frozen on its first ten rows, because a VirtualizedList nested in another one hands its scrolling to the parent. Verified on the device both ways. The warning is a false alarm here — `styles.listScroll` gives the inner list a fixed height and so a real viewport — and it lives inside `if (__DEV__)`, so it never reaches a production build. `ExerciseCatalogPage` carries the reasoning so the next person does not retry it.
- Numbers are from a **dev build**; production will be faster. The ratios are the finding, not the absolute values.
- **Drawing the map's figure in every row was tried and rejected.** Same measurement, state verified before and after each run: 71 ms with `BodyMapPreview`, **420 ms** with `ExerciseMapBody` once per visible row. Flat fills were tried as a cheaper variant and came out at **952 ms**, worse — so the number of shapes is the cost, not the gradients. Tinting the existing preview gets the same look for the original price.
- **The gradient fix costs nothing measurable.** A single reading of 288 ms suggested it had made the map four times more expensive; that turned out to be a bad measurement taken while the phone was losing its adb connection. Ten verified runs on a healthy device put the current screen at **64–86 ms**, with selecting and removing costing the same. The figures do render differently now — lighter and properly shaded, because the four-stop gradients are finally being applied — but not more slowly.
- **Rejecting `ExerciseMapBody` in the rows was right, and was re-checked.** Because one number from that session proved unreliable, the comparison was run again on a healthy device: **340–437 ms** with the map's figure per row against **64–86 ms** with the tinted preview, four verified runs each. Same conclusion, sound data this time.
- Every measurement here checks that the tap actually changed the screen before the frame time is counted. Three earlier readings were discarded for failing that: two captured idle frames, one measured the wrong screen after a stray tap opened a modal.

### Fixed
- **`ExerciseMapBody`'s gradient stops were strings with a leading dot** — `offset=".36"` — which `react-native-svg` rejects with `".36" is not a valid number or percentage string`. They are numbers now. The bug was always there; it only became visible when the figure started appearing once per catalog row instead of twice per screen, and then it filled the Metro log.

### Changed
- **Catalog rows look like the muscle map.** The body artwork in `BodyMapPreview` is tinted down to a quiet silhouette the way `ExerciseMapBody` tints it, instead of showing as orange line art. The green highlights already used the map's `#60DAAC` and `#18A06C`, so the tint was the whole difference; the muscle shapes are in the PNG itself, which is why this gets the map's look without drawing 33 shapes per row.
- `ExerciseMapBody` gained two options while this was being tried the expensive way: no `onSelect` means no touch handlers, no button role and taps passing through to whatever the figure sits in, and `showLabel={false}` drops the FRONT/BACK caption. Nothing uses them now, but they are what makes the figure usable as decoration.
- **iPad support off, and background location gone**, both ahead of the App Store submission.
  - `ios.supportsTablet` is `false`. With it on, App Store Connect requires iPad screenshots at 2064 × 2752 for a layout nobody has run on an iPad. Turning it back on brings both the screenshots and the iPad keyboard case back — `docs/tastatur-gennemgang.md` records that.
  - `UIBackgroundModes` and the two `NSLocationAlways*` strings are out of `infoPlist`, `isIosBackgroundLocationEnabled` and `isAndroidBackgroundLocationEnabled` are `false`, and `ACCESS_BACKGROUND_LOCATION` is off the Android permission list. Apple's guideline 5.1.5 wants location used only where it is directly relevant to a shipped feature, and the run workout — the only caller — is unfinished and not in the first release. Asking for background location for a feature a reviewer cannot find is a rejection.

### Added
- **`web/support/index.html`** — the Support URL App Store Connect requires. Apple wants that address to lead to a page that actually offers support, and `netlify.toml` redirects `/` to the privacy policy, so nothing here could double as one. Contact route, seven answers covering password reset, offline use, who can see a workout, blocking, deletion and price. No login, same rules as the deletion page.
- `check-agent-docs.js` now requires the support page to exist, requires it and the deletion page to name FitVen, and requires both to carry the contact address `privacyPolicy.js` publishes. Three store-facing pages naming three different addresses is something a reviewer asks about, so the policy is the single source. Writing the check found its own bug first — the address regex swallowed a sentence-final period, so nothing could ever match it.

### Changed
- **AI-provenance metadata out of the two body-map figures.** `Front_body.svg` and `Back_body.svg` carried a `data-name="ChatGPT Image …"` attribute and C2PA provenance chunks inside the base64 PNG. Apple asks you to confirm the rights to all content in the app, and that is a question worth answering knowingly rather than by accident. The PNGs were decoded, re-saved without ancillary chunks and re-encoded, with the pixels compared before and after — identical, and ~155 KB smaller each.

### Notes
- `assets/Find Friends.png` and `assets/social posts edit.png` carry the same metadata but no code references either one, so they are 3.2 MB of leftover mockups rather than shipped art. Left alone — deleting them is a call for whoever put them there.
- **The run workout can no longer start.** `locationService.ensureBackgroundLocationPermission` throws "Background location is not available on this device." and `Run.js` is its only caller, so the screen fails with that message instead of tracking. It fails cleanly rather than crashing, but the screen is still reachable and should be hidden before anyone outside the team sees it.
- Dropping `ACCESS_BACKGROUND_LOCATION` also removes Play's background-location declaration form from the list of things to fill in.
- `isAndroidForegroundServiceEnabled` is deliberately left `true`. A foreground service is not background location, and switching it off is a separate decision about the run workout.
- The Android permission list still holds the same five permissions twice. Android merges duplicates, so it is harmless; it was left alone rather than tidied as a side effect of this change.

---
## [0.23.36] - Released with 1.0.0
### Added
- **Favourite exercises.** A star on every row of the exercise catalog and of the mid-workout picker, a filter for showing only starred ones, and starred exercises sorted to the top of whatever list is on screen. The star flips before the write finishes and goes back if the write fails, so the screen never shows something it did not manage to store.
- Favourites follow the user. They are stored per user with a dirty flag and synced both ways, shaped on `exercise_column_preferences`: local table, cloud table keyed on the shared exercise id, RLS so a row is readable only by the user it belongs to. Un-starring keeps the row with the flag at 0 rather than deleting it — a missing row means "never starred here", which is not the same thing as "starred and then un-starred", and only the row can carry that across devices.
- **Two buttons at the bottom of a strength workout, instead of one bare plus.** One opens the whole catalog; the other opens it filtered to the exercises used in the last four workouts. An exercise used in all four is listed once — the question being answered is what you have been training, not how often. The workout being added to does not count as one of the four, so the exercises already in it do not crowd out the ones before it.

### Changed
- The exercise catalog no longer marks an exercise "OFFICIAL". Everything in the catalog is official, so saying so on almost every row said nothing; only the ones the user made themselves are marked, as "CUSTOM".

### Added
- `scripts/test-recent-exercises.js` runs the recent-exercises query, read out of the repository, against a fixture that mixes both stored date formats — "dd.mm.yyyy" and ISO, with February and March both present so a plain text sort gets the order wrong. It checks one entry per exercise, that the look-back is four workouts rather than four exercises, and that the open workout, deleted workouts, deleted exercises and workouts with nothing in them are all left out.

### Notes
- **`supabase/migrations/20260907110000_exercise-favourites.sql` has to be applied before favourites can sync.** Until it is, the app stars exercises locally and logs a warning each time it tries to push them; nothing is lost, and the first sync after the migration carries them up.

---
## [0.23.35] - Released with 1.0.0
### Changed
- **PERF-18.** `eas-cli` and `supabase` are build tools and now sit in `devDependencies` where they belong. They never reached the JS bundle, so this changes nothing at runtime — it takes 26 MB out of what a production install has to fetch. `npx eas` and `npx supabase` still resolve.
- Removed `@expo/ui`, which nothing imported.
- Removed `fitven-run-walk-fix.patch` from the repo root. Git has it.

### Notes
- The rest of PERF-18 was already done. A reachability scan from `App.js` finds **no dead files** under `src/` — the ~1,000 lines the report listed (`StopWatch.js`, `CircularProgression.js`, five unmounted sync components, `theme.js`) have all gone since it was written.
- The nine unused icons in `Resources/Icons/WorkoutLabels` stay. The barrel's own comment says they are placeholders for workout types still to come, which is a decision already recorded in the repo rather than something to clean up.
- `detailed new FitVen ER diagram.drawio.png` is still in the repo root. The report only suggested removing the patch file, and the diagram looks like something worth keeping.

---
## [0.23.34] - Released with 1.0.0
### Performance
- **PERF-11.** Measured first, as the report asked: `initializeDatabase` took a median of **1,674 ms** over five cold starts on the device, on a database with only 168 days and 48 sets in it. That is the app's most expensive startup cost, and it is paid before the first frame — the user is looking at "Restoring session…" for all of it. It is now a median of **~425 ms**.
- The cost was not where the report expected. It was `ensureTableColumns`, which asked the table what columns it had **once per column** — 126 round trips across the bridge at startup, measured at 40–85 ms per table. It asks once per table and keeps track of what it adds.
- The repairs that ran over a whole table at every start now carry a `WHERE` that skips rows already holding the right value. SQLite writes a row to the WAL even when the new value equals the old one, so on a full history these were tens of thousands of pointless writes. The worst was the `visible_columns` reset, whose condition treated an empty string as junk — and a column that was already NULL counts as an empty string, so it wrote NULL over NULL for every exercise, every start.
- Deleted the four commented-out migration blocks at the end of `db.js`, including a "drop all tables" one. They were inert, and one of them had been closed with `/*` instead of `*/`, so it silently swallowed the block after it.

### Added
- `scripts/test-database-repairs.js` runs the repair statements, read out of `db.js`, against a fixture covering every state the columns are known to reach: 72 exercises, 24 workouts (run-backed and strength-backed, with the stored flag right, wrong and missing) and the twelve spellings the run types have arrived in. It checks two things — that after one pass every row holds what the test computed for it in JavaScript rather than what the SQL says, and that a second pass writes nothing at all, which is the property the new `WHERE` clauses exist to provide.

### Notes
- **PERF-9 and PERF-10 were already gone.** The 13 MB of PNGs the report found are now 677 kB of JPGs — a bundled asset payload of 1.4 MB in total — and the one-time import payload and its service have been deleted. Both were fixed by other work since the report was written.
- What is left of PERF-9 is repo weight, not app weight: `src/Resources/BodyMap` holds 6.5 MB, of which two 3 MB source SVGs and about seventy muscle-mask files are referenced by nothing. The overlays inline their paths. Nothing unreferenced reaches the bundle.

---
## [0.23.33] - Released with 1.0.0
### Fixed
- **A deleted exercise came back.** Delete one that had already synced, wait for the next sync, and it returned — with its old cloud id, marked as needing upload, sometimes carrying every cloud set still pointing at it including sets it never had. Once back, the upload cleared the tombstone in the cloud and the delete was undone for good.
- The cause, read off the device: a sync pass fetches the cloud rows first and writes what it found after, and the two steps straddled the delete. The local row was gone at 01:41:15, a pass holding a snapshot from before that wrote it back at 01:41:16, and the tombstone only reached the cloud at 01:41:19. Nothing in between asked whether the row had just been deleted.
- Every path that writes cloud rows back — both reconciles and the hydration that fills a workout when you open it — now reads the delete queue **inside the transaction it writes in**, and skips anything the user has removed. It matches on cloud id, sync id and local id, because a queued delete may only know one of them: a row created on this device has a local id long before the cloud gives it one.
- Deleting an exercise also records its sets as deleted, and deleting a workout records its exercises and sets. They used to be removed from the device while their cloud copies stayed live under a parent that no longer existed — which is where the borrowed sets came from.

### Added
- `scripts/test-delete-stays-deleted.js` runs the pending-delete index against what the queue actually holds — a row the cloud knows by id, one only this device has seen, one known by sync id — and checks it does not swallow rows nobody deleted. It also checks the invariants that broke: that each reconcile reads its queue after opening its transaction rather than alongside the fetch, and that deleting an exercise or a workout records its children before removing them, while their sync ids can still be read.

### Notes
- Verified on the device, before and after: on the old code, adding an exercise, syncing, deleting it and syncing brought it straight back every time, and the log showed the row being re-created four milliseconds after the delete. On the fixed code the same cycle leaves the workout empty, and it is still empty after two restarts with a full sync each.

---
## [0.23.32] - Released with 1.0.0
### Performance
- **PERF-6.** Uploading read the whole table across the bridge and dropped the clean rows in JavaScript — on a full history, every row read to find the handful that changed. The seven `get*ForCloudSync` queries take a `dirtyOnly` flag and the upload paths pass it. Reconcile still asks for everything; it matches cloud rows against local ones and would start duplicating them if it could not see them.
- Each dirty row asked the cloud for its parent's identity, once per row rather than once per parent — twenty-five sets over five exercises made twenty-five requests where five would do. All six upload loops now share one cache per run. It is thrown away when the run ends, so the repair pass that follows a missing parent looks that parent up again rather than trusting a stale answer.
- **Not done: the batch upsert.** That is the rest of PERF-6 and the report's own advice is to do these two first. It replaces the per-row read-then-write with one request, but the conflict handling that lets the cloud win on a higher `sync_version` lives in that per-row path, and getting it wrong overwrites newer data from another device.
- **PERF-17.** The sync claimed a watcher row for every record in the download, every sync. A watcher row is what marks an entity as still held by this device — `last_seen_at` is written and never read — and every upsert fires a per-row trigger that recounts the watchers and writes the total back onto the entity. On a full history that was tens of thousands of writes per table per sync, restating rows that already said the same thing. It reads what the device already watches and claims only the rest, a page at a time. The rows afterwards are the same; in the steady state nothing is written at all.

### Added
- `scripts/test-cloud-sync-upload-batching.js` runs each of the seven queries for real, both ways, and checks that `dirtyOnly` returns only the rows waiting to upload — NULL counts as clean, as it did in JavaScript — while the plain call still returns every row. It also drives the parent cache: one lookup per parent, a missing parent remembered so its other children do not re-ask, a parent with no key never cached, and a fresh cache per run.
- `scripts/test-cloud-watcher-claims.js` runs the claim against a fake Supabase over eight kinds of download and checks the watcher rows afterwards against the old rule — every live record in the download is watched. It covers a fresh device, the steady state, deleted records, unidentifiable rows, duplicates, another device's rows, the same id in another table, and a 2,500-record history that must be read across pages and written to zero times.

### Notes
- Verified on the device: adding an exercise mid-workout uploads through the changed path — the new exercise and its set came back with cloud ids and a clear `needs_sync`, and all seven tables held zero rows waiting to upload afterwards. Backgrounding and reopening the app ran a full reconcile with no errors.
- **Found while testing, and not caused by this work: deleting an exercise does not stick.** Delete an exercise that has already synced, let the app sync again, and it comes back — same cloud id, marked as needing upload, sometimes carrying sets that were never in it. Reproduced on the commit before these changes, so it predates them. The local delete drains its queue, but the cloud row survives and the next reconcile pulls it back down.

---
## [0.23.31] - Released with 1.0.0
### Fixed
- Corrects 0.23.30: the exercise **catalog** list is back to a plain map. On the device it printed "VirtualizedLists should never be nested" — the catalog list is a fixed-height window inside the page's scroll view, and a list nested in a scroll view of the same direction is exactly what that warning is about. Making it virtualise for real means giving the list the page's scroll and moving the card chrome above it into a list header, which is a layout change and not one to make unasked.
- The **picker** keeps its virtualised list. That is the one that matters: it is opened mid-workout, holds all 89 exercises, and re-filters on every keystroke.

### Notes
- Verified on the device: the microcycle screen still separates a completed day from a planned one, a day with no workouts from a weekday with no day at all, and shows the right icon per workout (0.23.28). The picker scrolls, filters to six on "bench", shows "No matches" on a miss, and adding an exercise still creates its first set carried over from last time (0.23.30).

---
## [0.23.30] - Released with 1.0.0
### Performance
- **PERF-13.** The exercise library rendered every row it had — each one a body-map image with an SVG muscle overlay on top — and rebuilt the whole set on every keystroke in the search field. Both lists are virtualised now, so only the rows near the screen exist.
- The picker scrolls its own list rather than sitting inside the page's scroll view. A list inside a scroll view is handed unlimited height and renders everything, so it had to own the scrolling for virtualisation to mean anything. The catalog keeps the page scroll: its list is already a fixed-height window with the rest of the card above it.

---
## [0.23.29] - Released with 1.0.0
### Performance
- **PERF-7.** Home built today's snapshot twice on every visit. The activity ring asked for it through `getTodayActivitySummary` and the hero card asked for it directly, both in the same focus pass, neither knowing about the other — and building it is most of the work Home does. Overlapping calls now share one fetch. Anything that starts after it settles still gets fresh data, so nothing is cached stale.
- The "up next" card fetched every workout from tomorrow to 180 days out, ran the personal-record subquery on each row, and kept the first unfinished one. It asks for that row instead. The ordering came along with it: on a shared date the program name decides which workout you are told about next.
- `getTodayProgramSnapshot` re-read the program's status, once per program, to check what its only caller had already filtered on. It takes the status it is given.

### Added
- `scripts/test-next-unfinished-workout.js` runs the new single-row query against the old scan-and-filter — the SQL read out of the repository rather than copied — over six date windows. The fixture covers what the two could disagree about: a `done` of NULL, a `done` stored as text, a finished workout ahead of an unfinished one, two programs sharing a date with the id order and the name order deliberately in conflict, a standalone workout, and a workout on a program that never started.

---
## [0.23.28] - Released with 1.0.0
### Performance
- **PERF-12.** The microcycle list asked the database once per weekday per microcycle, and each of those answers then fetched its own workouts, and each workout its own exercises — around 135 sequential queries to draw one screen. `programService.getMicrocycleDayDetails` does the same work in three: the days of every visible microcycle, their workouts, and those workouts' exercises, regrouped in memory.
- The batched workout query orders by day and then by workout id, so the per-day order the screen relied on is the order it gets. Where a weekday has no row at all the screen still sees nothing rather than an empty day, which is what decides between a placeholder and a card.

### Added
- `scripts/test-microcycle-day-details.js` runs both paths — the old per-day queries and the new batched ones, read out of the repository files rather than copied — against the same fixture and compares the assembled days field for field. The fixture is deliberately uneven: a weekday with no row, a day with no workouts, a day with two, and a workout carrying a personal record.

---
## [0.23.27] - Released with 1.0.0
### Performance
- **PERF-15.** The calendar fetched the visible month, set its state, then immediately fetched all three months and overwrote the same state — six queries per swipe with three of them thrown away as the second pair landed. It fetches the wider range once. Rows are indexed by date and looked up per day, so holding three months costs nothing to show one.
- Sickness periods are no longer part of that fetch. They do not vary by the month on screen and were being re-read on every swipe.
- Loading is driven by the range changing rather than by the focus callback changing identity, which fired for other reasons too. The first focus no longer reloads on top of the mount load.

### Notes
- Verified on the device: markers show in the visible month and in the adjacent months either side of it, before and after swiping — which is the thing the double fetch existed to guarantee.

---
## [0.23.26] - Released with 1.0.0
### Performance
- **PERF-2.** A running strength workout no longer re-reads every exercise and every set from the database once a second. The clock advanced by bumping the same counter that tells the exercise list to reload itself, so moving one digit re-loaded the whole list, rebuilt every row with new object identities, and re-rendered the entire subtree — around thirty components with number fields and icons, once a second, for the length of the workout, while the user is trying to tap and type in them. The clock has its own tick; the list reloads when something actually changes.
- The two set counters in the header came from two loaders that each asked the same query and kept one field of the answer, so every refresh ran it twice. One query, both counters.
- `ExerciseRow` was handed a `refreshing` prop it never read. All it did was change on every bump.

### Notes
- Verified on the device with a running workout: ticking a set updates the counter and the progress bar at once, adding a set updates the list, and backgrounding mid-workout returns with the right time and data.
- Not re-tested here, and untouched by this change: the personal-record badge and the rest countdown, which has always had its own separate tick.
- The report also suggests `React.memo` on the rows and preserving object identity across reloads. Neither is in this version — with the per-second reload gone there is much less left for them to save, and both are changes to how the screen renders rather than to how often.

---
## [0.23.25] - Released with 1.0.0
### Fixed
- Past one hour, the workout clock pushed the pause and finish buttons off the right edge of the screen. "59:59" becomes "1:00:00" — two characters wider at 52 px — and nothing in that row could shrink, so somebody who left a workout running had no way to end it. The clock steps down in size with the length and the buttons cannot be moved or squeezed.

---
## [0.23.24] - Released with 1.0.0
### Performance
- **PERF-1.** Looking up who is signed in no longer makes an HTTP request. `supabase.auth.getUser()` sends `GET /auth/v1/user` and takes a process lock on the way, and it sat on a path that runs once a second for the whole of a strength workout — roughly 3,600 calls an hour, on a code path that is otherwise entirely offline, competing with the token refresh for the same lock and retried up to three times each on a bad connection. It reads the stored session instead, cached and kept current by one auth subscription.
- The same call in `socialPostService` is gone too. It was the same disagreement between two files about the same question, just not inside a loop.
- **PERF-14.** The bottom bar's one-second interval only ticks while a workout or rest timer is actually running. It is mounted for the entire signed-in session and used to run a database query and a state update — re-rendering the bar and everything under it — sixty times a minute with nothing running, so the app never went idle. With nothing running it now checks every ten seconds and does not tick at all, and it refreshes whenever the screen changes, which is how a workout usually starts or ends.

### Notes
- `getSession()` does not revalidate the token with the server. That is the right trade here: the id decides which local preference rows to read, and everything that matters is enforced by row-level security on each request anyway.

---
## [0.23.23] - Released with 1.0.0
### Performance
- **PERF-5.** An index on `Exercise_Instance(exercise_name, exercise_instance_id)`. Ticking a set off recalculates that exercise's personal record, and both queries behind it were scanning the user's entire exercise history on every tap — 22.9 ms over 50,000 sets when the review measured it, 23× faster with the index, and getting worse for as long as somebody uses the app.
- **PERF-8.** The second cloud reconcile only runs when the first pass actually uploaded something. It exists to collect the ids the cloud assigns to rows we just sent; with nothing sent it downloaded the user's whole table to learn nothing. Four tables did this on every sync: days, workouts, exercises and sets.
- **PERF-16.** The navigator is keyed on the accent theme, and the stored accent arrives a tick after the first render — so the whole screen tree was thrown away and rebuilt at every cold start, running every home screen loader twice. The app waits for the theme the same way it already waits for auth.

### Added
- `scripts/test-personal-record-index.js`, which reads the query plan and fails if the personal record lookup goes back to scanning. An index makes no difference anyone can see except in time, and time that grows with use is exactly what nobody notices.

### Notes
- The delta filter on reconcile — downloading only rows changed since the last sync — is the other half of PERF-8 and is not in this version.

---
## [0.23.22] - Released with 1.0.0
### Changed
- Logging out asks first. It was one stray tap, in a list people scroll past to reach the settings under it.
- The email address appeared twice on the profile: once under Public profile — where it is not public — and again under Account. It is in Account, once.
- Settings and Appearance are separate cards. Rows that navigate somewhere and rows you work in place looked identical, and the only way to tell them apart was to press one.
- The theme control is about 40 px tall with 13 px labels, up from 26 px and 11 px. It relied on hitSlop for the rest of the target, which serves the finger and not the eye: something that small does not read as pressable.
- Change photo is 44 px.
- The log out button took its border and fill from two fixed rgba values tuned for the dark theme, so in light mode it wore a colour from the other one. It uses the theme's danger token.

### Notes
- Two items in the review no longer applied: the decorative `⋯` at the top right is gone, and there is only one segmented control in the app now — the second was removed in 0.21.x.

---
## [0.23.21] - Released with 1.0.0
### Fixed
- The set counter in the workout header only refreshed when the screen regained focus, so adding a set left it saying 0 / 1 with two sets on the screen below it. It follows the sets now. Pre-existing, and easier to see since a new exercise arrives with a set already in it.
- Both counters come from one query on that path instead of asking the same question twice.

---
## [0.23.20] - Released with 1.0.0
### Fixed
- **Workout sync stopped working** the moment `20260905190000_rpc-hardening.sql` was run. That migration moved the sync watcher functions into the `private` schema and left them as security invoker, so the body ran as `authenticated` — which has no access to that schema, by design. Every write to `sync_local_watchers` failed with `42501: permission denied for schema private`, and that is on the path of ordinary workout sync.
- The functions are security definer now, which is safe for the reason the original change was arguing about: the user id comes from a row the watcher table's own policy has already pinned to `auth.uid()`, so the updates cannot reach another user's rows.

### Notes
- Requires `supabase/migrations/20260906091500_fix-watcher-trigger-permissions.sql`. **If `20260905190000` has been run, this has to be run too** — nothing was exposed, but syncing does not resume without it.

---
## [0.23.19] - Released with 1.0.0
### Changed
- Adding an exercise to a strength workout gives it its first set straight away. Adding the exercise and then adding a set to it were always the same intention, and the empty exercise in between was a state nobody wanted to be in.
- That first set starts with the rest, reps and weight from the last time you did the exercise, so the ordinary case — same as last week — needs no typing at all. An exercise you have never done still starts empty.
- Adding set two, three and so on copies rest, reps and weight from the set above it.

### Added
- `scripts/test-set-carry-over.js`, which runs the two queries behind this against a real SQLite database built by the test. They fail quietly — the fields simply hold numbers from the wrong session, which looks like the right answer until somebody notices they are lifting last month's weight — so the test covers ordering across both date formats in this schema, deleted sets and exercises, blank rows, and case-insensitive names.

### Notes
- RPE, AMRAP and the note are deliberately not carried over. They describe what happened on one particular set, and copying them would put a claim in the row that nobody made.

---
## [0.23.18] - Released with 1.0.0
### Changed
- The deletion page says how to delete part of your data without losing the account. That has always been true — a program, a workout, a set, a tracked run and its route, a sickness entry, a post can each go on their own — but the page only described deleting everything, which is the answer Play asks about separately and checks at that address.

---
## [0.23.17] - Released with 1.0.0
### Added
- `web/delete-account/`, the account deletion page Google Play requires and links to from the store page. It exists separately from the Delete account button in the app because the people most likely to need it are the ones who have already uninstalled: it names the app, needs no sign-in, and offers an email route as well as the in-app steps.
- `npm test` fails if either page Play links to is missing, or if the deletion page stops naming the app. A 404 on those is a policy violation on a page nobody using the app would notice had gone.

---
## [0.23.16] - Released with 1.0.0
### Changed
- The privacy policy and the password reset page are served from `https://fitven.dk/` instead of the netlify.app subdomain. Both hostnames answer, so nothing breaks in either direction.

### Notes
- Supabase must keep `https://fitven.netlify.app/reset-password/` on the redirect allowlist alongside the new one. Somebody on an older build who forgets their password asks the server for the old address; dropping it locks them out with no way back in.
- The Play Console listing carries the policy address and has to be updated with it.

---
## [0.23.15] - Released with 1.0.0
### Added
- `supabase/templates/` holds the auth emails — confirm signup, reset password, magic link, change email. They were only ever in the dashboard, which has no history, no review, and nothing to recover from. They still have to be pasted in by hand; the repo is the record of what was pasted.
- `npm test` fails if a template links to `{{ .RedirectTo }}` or leaves a stray quote after an `href`. Those are the two faults that were in the reset template, and neither points at itself: the stray quote makes Go's html/template refuse to render, which surfaces as "Error sending recovery email" and reads like a mail server fault, and the wrong variable produces a link with no token that the reset page reports as expired.

---
## [0.23.14] - Released with 1.0.0
### Changed
- Creating an account ends somewhere. It used to print a line of text, empty the form, and leave you on the screen you had just finished with, no way onwards. There is a panel now that says whether the address needs confirming, and a Go to login button.
- The password rule is written under the field from the start instead of appearing as an error once it has been broken.
- The top bar says Create account. It was a back arrow alone in an empty band.
- Field labels are 13 px in the text colour, helper text 12 px in the quiet one. Labels were 11 px uppercase quiet and the helper text below them was larger, which put the hierarchy upside down. Changed on the login screen too, or two screens one tap apart disagree.
- One heading, not three. "Register", "New account" and "Account details" all said the same thing above the same four fields.
- The Create account button no longer greys out until four separate rules pass. Same as the login screen: it is pressable, and pressing it marks whichever field is not right yet.

### Added
- A show/hide toggle on the password fields, matching the login screen.

---
## [0.23.13] - Released with 1.0.0
### Fixed
- The password reset page asked Supabase for the PKCE flow, which could never have worked. PKCE keeps a code verifier in the storage of whatever requested the reset — the phone — and the link is opened in a browser that has never seen it. The app does not use PKCE either, so the link arrives as a URL fragment and the page reads that instead.
- The page decided whether the link was valid by calling `getSession()` once, racing the client's own parse of the fragment. It listens for the session and falls back to a delayed check, so a valid link cannot be reported as expired.

---
## [0.23.12] - Released with 1.0.0
### Changed
- Forgot password is quiet grey with an underline instead of accent orange. It is the way out for the few people who need it, not something that should pull the eye off the field they were about to fill in.

---
## [0.23.11] - Released with 1.0.0
### Added
- Forgot password, under the Login button. It sends a link to set a new one, and says the same thing whether or not the address has an account — anything else turns the login screen into a way to ask which email addresses are registered.
- `web/reset-password/` is where that link lands. A web page rather than a screen in the app: the link has to work from whatever the person opens their mail in, on a phone that may not have FitVen on it any more, and a deep link would need the scheme registered, the app installed and the right build — three ways to leave somebody locked out of their own account.
- `npm test` fails if the reset page points at a different Supabase project or anon key than the app. Nothing else connects the two, and a mismatch would break only for people who are already locked out and cannot report it from inside the app.

### Notes
- **Supabase has to allow the address.** Authentication → URL Configuration → Redirect URLs must list `https://fitven.netlify.app/reset-password/`, or the link in the email refuses to go there.
- Untested end to end: sending a real reset email needs that allowlist entry first.

---
## [0.23.10] - Released with 1.0.0
### Changed
- The login screen had two identical orange full-width buttons stacked on each other, so nothing said which one you came here to do. Create account is an outline under a `New here?` label; Login keeps the fill.
- Three headings for two fields — a 42 px "Login", an "Account" label and a 24 px "Sign in" inside the card — are one. The card is fields.
- The Login button no longer greys out until both fields are filled. It stayed at 40% opacity with nothing saying why, which reads as broken rather than as waiting. It is always pressable and marks the fields that are empty.
- An error used to sit between the two buttons, pushing the lower one down and easy to miss. A missing field is now marked on that field, and a failed sign-in sits directly under the Login button with an icon.
- The eyebrow says "FitVen" rather than "FitVen Cloud". There is no cloud from where the user is standing.

### Added
- A show/hide toggle in the password field.
- `ThemedTextInput` takes an `action`: a control inside the field, right of the value. Separate from `suffix`, which is `pointerEvents="none"` on purpose — a unit is not something you tap, and making it tappable would swallow taps meant for the field.

---
## [0.23.9] - Released with 1.0.0
### Changed
- `PRIVACY_POLICY_URL` points at https://fitven.netlify.app/privacy/, which serves the generated page and nothing else — the repository root, `docs/` and `google-services.json` all return 404 there.
- The policy check turns from a warning into a hard failure now that a URL claims the policy is published: an unfinished section fails `npm test` outright.
- The header of `privacyPolicy.js` said the text must not ship. It says what actually has to be kept in step instead: the generated page, and the Play Console listing, which Google rejects if its minimum age or policy address disagrees with this file.

---
## [0.23.8] - Released with 1.0.0
### Added
- `npm test` fails if `netlify.toml` is missing or publishes anything other than `web/`. Widening it to the repository root would put the security review, the structure audit, the performance audit, an export query and `google-services.json` on the open internet, and nothing would have said so until somebody found them.

---
## [0.23.7] - Released with 1.0.0
### Changed
- The privacy policy is finished. The last outstanding statement, the name and postal address of the person responsible, is filled in.
- The public page moved from `docs/privacy-policy.html` to `web/privacy/index.html`, with `netlify.toml` publishing `web/` and nothing else. `docs/` holds the security review, the structure audit, the performance audit and an export query — a static host pointed at that folder would have published all of them next to the policy.

### Fixed
- A single line break inside a paragraph was collapsed by the generated page, so a four-line postal address read as one run-on line on the web while the app showed it correctly. The two copies exist to say the same thing.

### Notes
- `PRIVACY_POLICY_URL` is still empty and is the last step: host `web/`, then set it here and the same address in the Play Console listing.

---
## [0.23.6] - Released with 1.0.0
### Changed
- The privacy policy names a contact address (zhadowseb@gmail.com), states that FitVen is run by a private individual with no CVR number, and sets the minimum age at 13 — the age Danish law lets somebody consent to their own data being processed, and the lowest the app can set without a way to ask a parent.
- The section on your rights says plainly that a copy of your data is put together by hand, because there is no export button.

### Fixed
- The policy check counted the marker everywhere in the file, including the comment that explains it and the code that looks for it, so it could never have reached zero and setting `PRIVACY_POLICY_URL` would have failed forever. It counts unfinished sections now.
- A placeholder that named what was missing — `[SKAL UDFYLDES: postadresse]` — read as finished, because the check matched the closing bracket too. It matches the opening.

### Notes
- One statement is left: the full name and postal address of the person responsible. A private individual has to be reachable at a real address, and it will be public on the hosted page.

---
## [0.23.5] - Released with 1.0.0
### Added
- `docs/privacy-policy.html`, the public copy Google Play requires, generated from the same file the in-app screen reads. `npm test` fails if it drifts — two hand-maintained copies of a legal document end with nobody able to say which one a user agreed to.

### Changed
- Five of the eight unwritten sections in the privacy policy are filled in from what the code actually does: the third parties (Supabase, Expo, Google Maps, and nothing else — no analytics, no advertising, no crash reporting), that the map request tells Google roughly where a run happened, that there are no backups today, that the dashboard gives direct access to the database, and the one-month deadline for answering a request.

### Notes
- Three statements are still outstanding and are decisions rather than facts about the code: who the data controller is, the contact address for data requests, and the minimum age.

---
## [0.23.4] - Released with 1.0.0
### Security
- The sign-in session moved from AsyncStorage to `expo-secure-store`, behind the Android Keystore and the iOS Keychain. What was sitting there in the clear is a refresh token — a working key to the account until it rotates — in a file that is readable on a rooted phone and in a full-device backup.
- **Everyone is signed out once by this update and has to enter their password again.** That is the point rather than a side effect: the old tokens have been readable on disk, so they are treated as spent, and the plaintext copy is deleted on first launch instead of being carried across.

### Added
- `scripts/test-secure-session-storage.js`. Secure storage holds small values — over 2048 bytes may not store at all on Android — and a session is several times that, so it is split across numbered entries. The test drives that against a fake store that enforces the real key charset and byte ceiling: round trips at the chunk boundaries, multi-byte characters, a session that shrinks, one that has lost a piece, and a device with no keystore.
- `loadAppModule.stubModule`, so a test can hand a module a fake package instead of the throwing stub. That is what made the storage adapter testable at all.

### Notes
- If secure storage is unavailable on a device, the session falls back to the old unencrypted storage with a warning rather than failing to sign in.

---
## [0.23.3] - Released with 1.0.0
### Security
- `refresh_sync_local_watchers_count` was a callable REST endpoint that took the user id as a parameter and ran without a fixed `search_path`. It is only ever used by a trigger, so it moved to the `private` schema and the endpoint is gone rather than hardened. Row-level security had kept it from touching another user's rows, so nothing was exposed by it.
- A new account no longer takes its public username and display name from the part of the email address before the @. For most people that is their real name, published to every user of the app, from a field they only entered in order to sign in. Existing names are left alone — silently renaming live accounts is worse — and the migration carries the query for finding them.

### Fixed
- Claiming a username tag went through the database's own allocator instead of the client picking one. The client used to read every profile sharing the base and pick a code that was not among them; 0.23.0 stopped profiles answering to strangers, so that read came back empty and the check became a guess. The database has done this under an advisory lock all along.

### Notes
- Requires `supabase/migrations/20260905190000_rpc-hardening.sql`, which has to be run together with `20260905143000_user-blocks.sql`.

---
## [0.23.2] - Released with 1.0.0
### Added
- A privacy policy screen, reachable from the profile and from the register screen, and a consent gate that stands in front of the app until the current version has been accepted. Which version was accepted, and when, is stored — a boolean would not survive the policy text changing.
- `scripts/check-privacy-policy.js` in `npm test`. It prints a loud warning while the policy is a draft, and fails outright once `PRIVACY_POLICY_URL` is filled in but placeholders remain, so a published policy cannot keep them.

### Notes
- **The policy text is a skeleton and must not ship as it stands.** Eight statements in `src/Resources/Legal/privacyPolicy.js` are marked `[SKAL UDFYLDES]` and are legal facts nobody but the controller can supply: who is responsible, the contact address, third parties that receive data, retention after backups, and the minimum age.
- Google Play separately requires the policy at a public URL. `PRIVACY_POLICY_URL` is empty.
- Requires `supabase/migrations/20260905174500_privacy-consent.sql`. Without it the gate fails open and nobody is asked, which means no consent is being collected at all.
- The gate also fails open on a network error. Being locked out of your own training data because Supabase is unreachable is the worse failure.

---
## [0.23.1] - Released with 1.0.0
### Added
- Delete account, at the bottom of the account card in your profile. It removes your programs, workouts, records, posts, follows, notifications, profile and photo from the cloud, deletes the sign-in itself, and removes this phone's copy of the database. You type DELETE to confirm; there is no undo and no grace period.

### Notes
- Requires `supabase/migrations/20260905161500_delete-account.sql` **and** the `delete-account` Edge Function deployed. Without both, the button fails with a function error and nothing is removed.
- The tables to erase are discovered from the schema, not listed in the code: every table in `public` with a column that names a user. A table added later is covered without anyone remembering to add it. If a foreign key still refuses after three passes the function raises, so a half-erased account reports as a failure rather than a success.

---
## [0.23.0] - Released with 1.0.0
### Added
- You can block someone. Tap followers or following on the social page, then Block on their row; Blocked accounts at the bottom of that list is where you undo it. A block removes the follow in both directions, stops them following you again, and takes you out of each other's search results. They are not told.

### Security
- The follow graph was readable in full by any signed-in user. `user_follows` now only answers for rows you are part of.
- The profile table was readable in full, so a client could list the entire user base with one request. Reading a profile now needs a relationship — yours, someone you follow, or someone who follows you — and finding a stranger goes through a search function that caps the result set and hides blocked people.
- User search needs at least two characters. Under that, the old query returned every account in the app in name order, which is the enumeration this closes.
- `profiles` had no DELETE policy, so a user could not remove their own row. Needed for account deletion, and wrong without it.

### Notes
- Requires `supabase/migrations/20260905143000_user-blocks.sql`. Until it is run, user search fails with a message saying so.

---
## [0.22.6] - Released with 1.0.0
### Added
- `scripts/check-undeclared.js`, run as part of `npm test`: Babel's own scope analysis over all 310 source files, reporting any name a file uses but never declares or imports. There is no linter and no type checking here, so those failed at runtime, only on the code path that used them.
- `scripts/test-run-display-utils.js`, the first automated coverage the run screen has had: pace and clock formatting, section counts and labels, route splitting and thinning, and the two chart path builders.

### Changed
- `Run.js` drops from 5,172 lines to 4,502. The pure maths moved beside it into `runDisplayUtils.js`, `runFormatUtils.js`, `runEnduranceStats.js` and `runFlowOptions.js`, and `DraggablePriorityRow` into its own component folder. The GPS and Bluetooth hooks stay in the screen; they are wired into its state and cannot move without a device to test against.

### Fixed
- `programService.js` lost its `workoutService` import when the sync engine was split in 0.22.4. Four calls in it would have thrown as soon as a workout hierarchy was refreshed.
- `HeartRateDeviceModal.js` used `StyleSheet.absoluteFill` after its `StyleSheet` import was removed.
- The workout library's option sheet read a colour that is declared in the screen below it, and would have crashed when opened.
- An exercise row measured its layout into a handler that was never written, and drew a wrap arrow from an index that was never computed. Both dated back to the row's introduction and are removed.

---
## [0.22.5] - Released with 1.0.0
### Added
- `SYNCED_FIELDS` in `src/Services/cloudSync/cloudSyncFields.js`: one row per synced column, with the snapshot, the comparison and the cloud payload all derived from it. Adding a field to a synced table is now one row instead of three edits that have to agree.
- `scripts/test-cloud-sync-fields.js`, the first automated coverage the sync engine has had. It fails if a field is compared but never uploaded, compared but missing from the snapshot, or not stable under a second normalisation.
- `scripts/lib/loadAppModule.js`, which compiles a real application module through the project's own Babel setup so a test can exercise it. The existing scripts could only read a file as text, which is why anything with an import had no coverage.

### Fixed
- A workout's `timer_start` and `original_start_time` are normalised differently for the comparison and for the upload. The asymmetry is preserved and now documented rather than hidden in two separate function bodies.

---
## [0.22.4] - Released with 1.0.0
### Changed
- The cloud sync engine moved out of `programService.js` into `src/Services/cloudSync/`, one module per entity over a shared base. `programService.js` drops from 7,424 lines to 2,164, and the largest sync module is 601. Everything is re-exported, so no caller changed.

---
## [0.22.3] - Released with 1.0.0
### Added
- Path aliases `@contexts`, `@database`, `@repository`, `@resources`, `@services` and `@utils`, defined in `babel.config.js` and mirrored in `tsconfig.json`.
- `npm test` now resolves aliased imports too, catches an alias that is neither a package nor defined, and fails if the babel and tsconfig maps disagree.

### Changed
- The five files in the exercise row tree, which had the deepest imports in the project at eight and nine levels of `../`, use aliases. The remaining 149 deep imports were left alone on purpose.

---
## [0.22.2] - Released with 1.0.0
### Changed
- The 19 cloud schema files moved from loose `docs/*.sql` into `supabase/migrations/`, timestamped so they carry the order they were applied in.
- `supabase/migrations/README.md` records which migrations have been run. `npm test` fails if a migration is not in that table, so the ledger cannot fall behind.

### Fixed
- `docs/export-user-programs.sql` had a real user's UUID committed in it. It takes a placeholder now.

---
## [0.22.1] - Released with 1.0.0
### Added
- `scripts/check-imports.js`, which resolves every relative import with the exact casing on disk and runs as part of `npm test`. Windows is case-insensitive and Android is not, so a wrong-case path used to work locally and fail only in a build.

### Changed
- `PickWorkoutModal` moved from five levels down inside `WeekPage` to `Resources/Components/`. It is used by the microcycle screen, so a cleanup of the "unused" WeekPage folder would have taken a live screen with it.
- The background GPS task moved out of `App.js` into `Services/locationBackgroundTask.js`. `App.js` drops from 487 to 382 lines.
- The muscle mask folders are `MuscleMasks`, matching every other folder in the project.

### Fixed
- The pick-a-workout dialog referenced two style keys that were never defined and coloured a completed workout with a hardcoded green that ignored the theme.

---
## [0.22.0] - Released with 1.0.0
### Added
- `npm test` — one command that runs every check, including a new drift check over the agent guides.
- `scripts/check-agent-docs.js`, which fails when a guide names a path that no longer exists, tells you to run a script that is gone, or promises an invariant the code has stopped holding.
- `src/Services/AGENTS.md` with the checklist for adding a field to a synced table, and `src/Sync/AGENTS.md` with the table of which sync components actually run.
- A `scrimSoft` colour token for a tap-catcher that dims rather than darkens.

### Changed
- Thirteen files no longer import a service under a repository's name. 45 function names exist in both layers with the same signature, so the alias sent readers to the wrong file.
- The agent guides now cover what the code depends on and cannot be read from it: the sync field checklist, the two schema files, the theming rule, the layering, and what the five names for "exercise" mean.
- README no longer reproduces the folder tree, no longer claims the app has no backend, and no longer says WeekPage is unused without mentioning that a live screen depends on a component inside it.

---
## [0.21.12] - 2026-09-05
### Security
- Profile pictures are read through short-lived signed URLs instead of permanent public links, so an avatar can no longer be collected once and kept, and deleting one actually takes it away. Requires `docs/supabase-avatar-private-bucket.sql` and, once this version has shipped, the `avatars` bucket set to Private.

### Changed
- The three copies of the avatar URL builder are one shared module that signs a whole list in a single request and caches the result.

---
## [0.21.11] - Released with 0.21.12
### Security
- `console.log`, `.info` and `.debug` are stripped from production bundles. `error` and `warn` stay.
- `LocationDebugLog` is gone. It kept every GPS point the tracker saw, accepted or rejected, with speed and accuracy and no cleanup — a home address sitting unencrypted on the device forever. Existing installs drop the table on the next launch.
- Feedback no longer sends the device's brand, model and OS version.
- Only the birth year is stored. `docs/supabase-birth-year-only.sql` truncates the rows written before this.
- The user search filter allows a known-good set of characters instead of removing a known-bad one.

---
## [0.21.10] - Released with 0.21.12
### Security
- A workout start notification now takes its text from the stored workout row, not from the caller's request, so a sender can no longer put their own wording on every follower's lock screen. A label is capped at 40 characters and stripped to a charset that cannot form a link, and a workout type has to exist in the catalog.
- The notification function is rate limited to 12 events per account per hour.
- The deduplication key is now the database's own row id, or the sender's own id plus their workout id when the row has not synced yet, so nobody can register a key ahead of somebody else and swallow their notification.
- The webhook secret is compared in constant time.
- Registering a push token no longer switches off another account's row on demand. The token is only released once the other account has gone quiet for seven days; until then the new device is registered but left disabled.

---
## [0.21.9] - Released with 0.21.12
### Security
- Removed the one-time program import, which carried a named user's email address, Supabase user id and full training history in the app bundle of every installation.

### Added
- `docs/SIKKERHED-DINE-OPGAVER.md`, the steps for the parts of the security review that live in the Supabase and Google dashboards.

---
## [0.21.8] - Released with 0.21.12
### Removed
- The five unmounted sync components for programs, blocks, weeks, days and exercise instances. `SetSync` already pushes that whole hierarchy in parent-first order, which is what the sync rules now ask for.

### Changed
- The workout-label icon list says which of its icons are placeholders for workout types still to come, so a dead-code sweep does not offer to delete them again.

---
## [0.21.7] - Released with 0.21.12
### Added
- `ThemedText` takes a `type` naming a step on the typography scale, the way `ThemedTitle` already does, plus an `overline` step for the small uppercase label above a page or section title. Existing call sites are untouched.
- `Services/authService`, so the login, register and profile screens no longer reach into `src/Database` directly.

### Changed
- The `rm_list` folder and its two files are PascalCase like the rest of the codebase.
- The padlock and chat-bubble icons moved from the profile screen's own folder into the shared `UI-icons`.
- Five components had their inline `StyleSheet.create` moved to a sibling `Style.js`, matching the other 53 screens.

### Removed
- 16 files nothing imported, including two whole components whose only caller was itself dead.

---
## [0.21.6] - Released with 0.21.12
### Changed
- The last 71 raw `Text` elements are now `ThemedText`, so a line without an explicit colour falls back to the theme's text colour instead of the platform default.

---
## [0.21.5] - Released with 0.21.12
### Changed
- `ThemedCard` is a surface only. It used to bake in 10 px of margin and padding, which every single call site then had to undo, so 69 reset declarations are gone with it.
- `ThemedButton` passes unknown props through to its `Pressable`, so `accessibilityLabel`, `testID` and `onLongPress` reach it, and it announces itself as a button by default.

### Removed
- 93 dead colour fallbacks. Every one sat behind a token that is always defined, and most held a pre-redesign colour — `#f7742e`, `#60daac`, `#0E0F12`, `#ba0000ff` — that read as a valid value to anyone editing the line. Fourteen of them fell back to the dark palette, which would have been the wrong scheme in the light theme.

---
## [0.21.4] - Released with 0.21.12
### Fixed
- The set summary under an exercise no longer draws white on white in the light theme: the compact table's surface, its gridlines, the set bubbles' borders and the connector between them now come from the palette.
- The set cell's status tints are derived from the status colours themselves, so they follow the accent theme.
- The run screen's start button shadow followed a fixed orange under every accent; it now follows the accent.
- Seven bottom-sheet headings used a near-black divider from the pre-redesign palette, which read as a hard black line in the light theme. They use the hairline token now.
- The heart-rate marker ring and the endurance progress track no longer use a fixed white and grey.
- The exercise dropdown's border was a fixed light grey.

### Removed
- 67 style keys nothing referenced, across 13 style files, most of them left behind by the redesign.

---
## [0.21.3] - Released with 0.21.12
### Added
- `ThemedStateBlock`, one component for a screen's loading, empty and error state. Thirteen screens used to spell it out by hand.
- `ThemedSegmentedControl`, which takes any number of options, replacing the two-option `ThemedSegmentedToggle` that had no call sites. The appearance setting is its first user.

### Removed
- `ThemedSegmentedToggle`, `ThemedWorkoutModal` (a pass-through wrapper around `ThemedModal`) and `AppearanceSegmentedControl`, plus 30 style keys the state blocks no longer need.

### Changed
- The appearance segments now carry a 44 px touch target through hitSlop, without the row getting taller.

---
## [0.21.2] - Released with 0.21.12
### Added
- `ThemedSheetHandle`, one grab handle for every bottom sheet. Eight sheets drew their own across three sizes, four radii and seven colours, four of which were hardcoded white and invisible in the light theme.

### Fixed
- The exercise filter sheet and the exercise library no longer tint their selected chips and cards Ember orange regardless of the chosen accent theme; the same applies to the library's green highlights.
- Both sheet palettes fell back to the dark palette when a token was missing, which would have been the wrong scheme in the light theme.
- The accent now reads as text through `primaryText` and as a fill through `primary` in the start-workout sheet and the filter sheet, instead of one colour doing both.

### Changed
- The start-workout sheet and the exercise filter sheet build their styles from the theme directly; the intermediate colour-alias object each of them carried is gone.

---
## [0.21.1] - Released with 0.21.12
### Changed
- The relative timestamp on the feed card and the notification list now comes from one `formatTimeAgo` in `Utils/dateUtils`, in place of two identical copies.
- Number display formatting is now one `formatDisplayNumber` in `Utils/numberUtils`, shared by the RM list, the estimated-set dialogs, the 1RM calculator and the program service. The program service no longer throws on a missing value; it shows the same placeholder as the screens do.
- The suggested program-best weight is now one helper in `Utils/oneRepMaxUtils` instead of a copy in each estimated-set dialog.
- The heart-rate zone colours now come from `Utils/heartRateUtils` through a shared 1-based accessor, in place of a colour map of its own in the run screen and the run set list.
- The four local `colorWithAlpha` helpers are gone; every caller uses `withAlpha` from the colour tokens.

---
## [0.21.0] - Released with 0.21.12
### Added
- Colour tokens for the surfaces that components used to build with a light/dark ternary of their own: table surfaces, gridlines and alternating rows, the record highlight, three neutral overlays, the ink on a danger fill and the two scrim strengths.
- `Spacing`, `Radius` and `Elevation` constants in `GlobalStyling/spacing.js`, for new code and for files another change touches anyway.

### Removed
- Seven palette tokens nothing referenced: `third`, `textMuted`, `plannedLight`, `libraryMetricBackground` and the `NOT_STARTED`/`ACTIVE`/`COMPLETE` status aliases, the last two also from all four accent themes.

---
## [0.20.0] - Released with 0.21.12
### Changed
- Every gesture on a calendar day now opens one day sheet, which holds the day's workouts, its programs and the add, copy and delete actions.
- Calendar month cells now carry the date plus one coloured dot per workout instead of icon cards, the today/sick stamp and the program dot.
- Calendar month cells now show the program span through the date number's colour, in place of the removed program dot.
- Calendar load failures now use the same error pattern as the notification screen: a heading, the explanation and a Try again action.
- Merged the calendar's workout-count pill into the month title's subtext, dropped the header spinner and gave the month arrows a 44 px touch target.
- The workout library's sort and type panels now use the app's shared bottom sheet instead of a panel of their own.
- The workout library's filter pills now read exactly like the option they select, so "Newest first" is no longer shortened to "Newest".
- An empty filter result in the workout library now offers a Reset filters action, and an empty library says so instead of blaming the filters.
- The workout calendar now has the app's standard header with a back arrow.
- Pickers now carry a downward chevron, so a field that opens a list no longer looks like a link onwards.
- Personal records now uses four text sizes, with the record value set well above its label.
- Personal records now shows an en dash for missing values in number columns, explained in a footnote under the table.
- Replaced the personal-record Hide empty / Show all button with a switch labelled Hide empty rep ranges.
- The notification screen now has a single title, Notifications, matching the settings screen, and readable timestamps.
- A failed program load now shows a heading, the reason and a Try again action instead of only reaching the console.
- The program list can now be pulled down to refresh.
- Reworded the No notifications option to describe the setting rather than sell it.
- Renamed the Custom notification option to Pick specific people, and the chosen people now appear as removable chips instead of only a count.
- Lifted the notification settings group labels to 12 px so they are no longer smaller than the body text they head.
- Followers and following on the social screen are now full 44 px buttons on their own row below the activity rail, instead of 30 px chips beside the heading.
- Secondary buttons are now outlined with text-coloured labels, so a Cancel or Close no longer reads as the screen's main action. The filled green fill moved to a new success variant, used by Start workout.
- Renamed the social screen's Stories section to Today's activity, which is what it shows.
- Following now reads as a state with a checkmark, and unfollowing asks for confirmation first.
- Shortened the Find Friends search placeholder, and split its two empty states so the search case repeats the term that found nothing.
- Every page-header eyebrow is now 12 px, so the label above a page title is no longer smaller than the body text on the page.
- The sickness log now shows its history first, with New sickness period as a fixed footer button in the app's primary colour.
- The sickness log uses the app's shared page header and its spinner for loading, and names the flow the same way in the button and the dialog.
- No text on the workout-types screen is under 11 px any more; the 7 px Available label is now just its check icon.
- The exercise-card layout options now preview themselves with the real renderers instead of describing the result in a sentence.
- Split the max heart rate dialog into how it is worked out and a manual value that only appears when it has a part to play.
- Both social post settings screens now open with a line saying what the settings cover, so the two are no longer indistinguishable.
- The posting modes now show a sample of the post a reader would see, instead of describing it.
- Visibility choices are now bare labels with one explanation under the group.
- The 1RM calculator now opens on its two fields; the formula explanation moved below the result, and the units sit inside the fields.
- The 1RM result now appears above the calculate button, and calculating closes the keyboard that used to cover it.
- ThemedTextInput takes a suffix, for a unit shown inside the field to the right of the value.
- Editing a post note now opens a panel over the post instead of a whole screen, so the post stays visible while writing. The SocialPostEditPage screen and its route are gone.
- No text outside the run screens is under 11 px any more, and the app's text sizes are down from 33 values to 12.
- The muted grey used for labels and metadata is now #868C99, which clears 4.5:1 in dark mode where the old #676B76 sat at 3.4:1.
- Added a primaryText accent token, darkened in light mode, and pointed all 95 accent text and icon usages at it; fills keep primary.
- Corner radii for rectangular shapes now snap to a 2/6/10/14/18/22 ladder; circles and pills keep their derived radius.
- The programs and program overview screens now use the shared header, leaving no page with a top bar of its own.
- Touch targets: 25 standalone icon buttons grew to at least 40 px, and the ones in dense rows gained a hit area instead.
- The week overview now has all four states: loading, a failure with Try again, an empty week, and pull to refresh.
- Deleted two stale copies of the colour palette (GlobalStyling/theme.js and spacing.js), neither of which was imported.
- The block screen's weeks are now one grid with a shared, sticky weekday header instead of a card per week, and a day with several workouts shows a count with a dot each and opens them in a dropdown anchored to its cell.
- Each week in the block grid now opens with a filled band and shows a date above every day, so the weeks read as separate groups and each day says which date it is.
- The workout calendar keeps its month grid and lists the month's weeks underneath it in the week-grid style; each month is one page that scrolls as a whole, and the month name and the month arrows live in the header.
- The week lines dropped their workout counter, the date range moved to the right in its place, and a day with no workout shows its date faintly inside the cell.
- The month calendar's workout dots are now 3 px and sit inside the date badge, and the date is 15 px rather than 17.
- The week list under the calendar dropped its week headings: it is now the same grid as the month above it, read the other way round, with the workouts in the cells.
- The month grid now uses the same seven-column geometry as the week grid under it, so the two line up and the gaps between days are even.
- The calendar has a layout pill beside the month heading: Block keeps the two grids, and the new Week layout shows one week as a row per day, with every workout its own tile. In Week the swipe moves a week at a time, and the month follows the week on show, so switching back to Block lands on that week's month.

### Fixed
- Saving a workout-start notification mode no longer rolls the choice back when this device cannot register for push notifications; the preference is already stored, and the screen now says the device may not receive pushes yet.
- The manage-push-token function now answers with the underlying error and its Postgres code instead of an opaque 500, and the client reads that body into the thrown error.
---
## [0.19.1] - Released with 0.21.12
### Changed
- Finish on a strength-workout timer now atomically marks the workout complete, even when planned exercises or sets remain unfinished.
---
## [0.18.12] - Released with 0.21.12
### Changed
- Removed the redundant completed-workout message panel from the home card.
- Show the next planned workout in place of the completed-workout summary action.
- Open the completed workout when tapping anywhere on its home card.

---
## [0.18.11] - Released with 0.21.12
### Changed
- Moved exercise card display settings to Settings > Workout Types > Strength Training.
- Persisted the selected collapsed exercise card view on the device.
- Added standard, compact, and progress-only collapsed exercise card views with a preview.
- Reduced spacing between exercise names and collapsed set summaries.
- Added a Sets toolbar toggle; set summaries are hidden by default and can be shown on demand.
- Moved the expand arrow next to the progress dots and aligned the dots with the exercise title.
- Added a clearer outline to pending set progress dots.
- Added a selectable classic collapsed exercise card layout with the previous rounded set bubbles.
- Tightened vertical alignment inside classic set bubbles.
- Added mandatory branch, version, changelog, and validation preflight checks to the repository guide.

---
## [0.19.0] - Released with 0.21.12
### Added
- Added direct Bluetooth Low Energy pairing for Garmin HRM-Pro and other standard heart-rate monitors.
- Added a remembered heart-rate sensor, automatic workout reconnection, live BPM and heart-rate zone display.
- Feed live heart-rate measurements into run metrics and the existing actual-versus-planned heart-rate charts.
- Added Android nearby-device and iOS Bluetooth configuration through the Expo BLE plugin.

### Changed
- Show a distinct completed-workout card on the home page, with finished time, duration, summary access, and the next planned workout.

---
## [0.18.10] - Released with 0.21.12
### Changed
- Rename the front-page workout action from "Start workout" to "Open workout" to make it clear that the workout opens before it begins.
- Mark the active auto-advance target directly on each Speed & Structure interval and allow Time, Distance, or Automatic selection from the set options.
- Count workouts on past sickness-marked days as completed in program, block, and home progress displays, without changing `Day.done` or its sync state.
- Let Speed & Structure intervals with a distance but no TIME field progress from GPS distance instead of being skipped. When the target is reached, save and show the actual time, distance, and pace without replacing the planned pace.
- Improve Run and Walk distance tracking for phones carried in pockets by accepting moderately degraded GPS accuracy and retaining plausible segments across short background-delivery gaps.
- Populate `LocationDebugLog` when a tracked workout pauses or finishes, including per-point acceptance decisions and rejection reasons for easier device-specific GPS troubleshooting.
- Redesign the Add exercise workout picker with a custom header, body-map exercise rows, primary/secondary muscle labels, a custom-exercise footer, and an exercise detail popup with muscle-group chips and an add action.
- Add an exercise filter bottom sheet with training focus, grouped muscle filters, built-in/custom type filtering, live result counts, and filter badges for both picker and catalog views.
- Redesign the Start workout sheet so planned workouts, fresh starts, and repeated workouts have distinct visual treatments, with dashed plus cards for new workouts and solid replay rows for copied workouts.

---
## [0.18.9] - Released with 0.21.12
### Changed
- Fix the crash when opening a completed Run or Walk workout on Android by configuring the Google Maps Android API key and only mounting the route map when the key is available, with a clear fallback card otherwise.
- Stop losing GPS points during Run and Walk tracking: the background location task now keeps one cached database connection with a busy timeout and writes each GPS batch in a single retried transaction instead of opening, migrating, and closing a new connection per batch.
- Recover automatically when the OS silently stops background location delivery while the phone is locked: returning to a live workout with stale tracking restarts the location provider.
- Harden route-map helpers for long workouts (no argument-spread over thousands of points, clamped map regions, simplified polylines) and remove the duplicated iOS location background mode.

---
## [0.18.8] - Released with 0.21.12
### Changed
- Add the first Walk workout draft with direct GPS tracking, timer controls, distance, pace, heart-rate zones, and completed-workout insights.
- Register Walk as an active local and Supabase workout type.
- Show Walk as a Start fresh option and recognize it in planned and recent workout cards.

---
## [0.18.7] - Released with 0.21.12
### Changed
- Add planned-set and progress cards for the single main Endurance & Base set, including duration, pace, zone, distance, and completion progress.
- Add a persisted drag-and-drop priority list for populated Endurance & Base plan stats.
- Open Custom runs directly on a graph-free workout dashboard with a manual start, live pace metrics, and a transparent, swipeable close-up view of colored heart-rate zones with BPM boundary labels.
- Follow the live pulse in the Custom heart-rate viewport until the user swipes, then preserve manual browsing with a fixed pulse dot and a Recenter action.
- Place the Custom run controls inside the upper metrics card.
- Hide the Workout plan heading and section from completed Custom and legacy blank runs.
- Correct the shared heart-rate boundaries so zone 2 spans 66–81% HRmax and is wider than zone 3 at 82–89% HRmax.
- Keep Endurance & Base plans continuous by omitting automatic rest rows from their workflow.

---
## [0.18.6] - Released with 0.21.12
### Changed
- Remove dashed grid lines from the Run completion charts.

---
## [0.18.5] - Released with 0.21.12
### Changed
- Add selectable max-heart-rate sources and calculate Run chart zones from the resolved profile value.

---
## [0.18.4] - Released with 0.21.12
### Changed
- Keep public profiles and social circles available when private profile settings are missing or using an older Supabase schema cache.
- Stabilize the birth date wheel so drag and momentum events cannot fight over the selected value.

---
## [0.18.3] - Released with 0.21.12
### Changed
- Simplify the completed Run summary and use the secondary color for its border and distance.

---
## [0.18.2] - Released with 0.21.12
### Changed
- Add shared private birth date and max heart rate settings to Public profile and Run settings, including calculated, manual, and measured max-pulse sources.

---
## [0.18.1] - Released with 0.21.12
### Changed
- Add a Workout Types entry under Personal settings with Strength Training and Run, and move Exercises under Strength Training.

---
## [0.18.0] - Released with 0.21.12
### Changed
- Add a fresh-run workout selection flow with persisted run focus choices and Endurance & base, Speed & Structure, Performance & Threshold, and Custom cards.
- Hide empty Speed & Structure warmup and cooldown sections from the run plan once the run starts.
- Add a focused Speed & Structure run timer with active action countdown, live pace, interval count, segment distance, and total progress.
- Show Run workout progress through Plan, Active, and Done stages with a tubelight-style indicator above the timer header.
- Allow tapping the Run workout status indicator to preview Plan, Active, and Done states while testing.
- Move the selected run focus into a centered title above the timer header and simplify the active timer heading.
- Show the Run plan mode start action outside the timer card and style the selected run focus as a centered badge.
- Use the global fields surface color for Run status and focus badge backgrounds.
- Use the global fields surface color for Run warmup and cooldown field controls.
- Automatically add a rest row before new Run interval sets when the previous interval row is not already a rest.
- Delete Run sets directly from the edit sheet without a confirmation alert.

---
## [0.17.35] - Released with 0.21.12
### Changed
- Add a weekly muscle load chart to Personal Records with program selection.

---
## [0.17.34] - Released with 0.21.12
### Changed
- Ask for confirmation before deleting strength sets, strength exercises, run sets, estimated 1RMs, calendar workouts, and before restarting workouts.

---
## [0.17.33] - Released
### Changed
- Auto-classify resistance workout labels from exercise muscle metadata and set volume.
- Speed up Workout Calendar by loading the visible month from local data before cloud sync and prefetching adjacent months afterward.
- Keep Workout Calendar swipe paging to one month at a time while recentering the pager.
- Add calendar database indexes for workout, day, sickness, exercise, and set lookups.
- Replace the registration username placeholder with a neutral example.
- Ask for confirmation before deleting mesocycles, weeks, and workouts from program and workout screens.

---
## [0.17.32] - Released
### Changed
- Redesign the week copy target picker with focused block, week, and day selection, and mark copied weeks with the primary label.

---
## [0.17.31] - Released
### Changed
- Move program import into the Program options menu and remove the standalone import action from the page body.

---
## [0.17.30] - Released
### Changed
- Add a block-level week call to action for adding new program weeks from the Program Overview flow.

---
## [0.17.29] - Released
### Changed
- Send workout-start notifications immediately when workouts start and manage push-token ownership through the `manage-push-token` Edge Function.

---
## [0.17.28] - Released
### Changed
- Ask before adding a standalone workout copy to a program day, while program workout copies automatically use a matching program day or fall back to the workout calendar.
- Add workout copy actions to the Workout Calendar day menu.
- Use field surfaces and focused Block/Week placement text in workout copy prompts, with standalone copies labeled as single workouts.
- Redesign workout copy conflicts as a Date Conflict decision modal with selectable program and standalone cards.

---
## [0.17.27] - Released
### Changed
- Open notification history when a push notification is tapped.
- Keep notification history unread until the user opens it from the Home bell.

---
## [0.17.26] - Released
### Changed
- Add a drawn-tab style indicator around the Rest set header to show it can be tapped.

---
## [0.17.25] - Released
### Changed
- Simplify the Profile About section to show only the FitVen app name and configured app version.

---
## [0.17.24] - Released
### Changed
- Add an About section at the bottom of Profile with app version, build, runtime, and platform details.

---
## [0.17.23] - Released
### Changed
- Add program export/import using FitApp program JSON files, including program structure, workouts, exercises, sets, run rows, estimated 1RMs, and program display settings.

---
## [0.17.22] - Released
### Changed
- Move set rest into an editable overlay pill inside the existing Rest column, tied to the previous set without adding spacing between sets.
- Default rest editing to minutes.
- Add a Rest modal mirror option so editing one rest value can update every set's rest value in the exercise.
- Use the field surface color for Rest modal setting backgrounds.
- Start a rest countdown from the completed set's rest value, including the final set, while the workout is running, and show it in the rest field and active workout menu circle; the rest field border turns primary while counting down and secondary when complete.

---
## [0.17.21] - Released
### Changed
- Move the expanded exercise history action back to the top-right of the exercise card.

---
## [0.17.20] - Released
### Changed
- Add a rest title unit picker for switching set rest entry between minutes and seconds.

---
## [0.17.19] - Released
### Changed
- Use the secondary color treatment for the paused run finish button and match its height to the continue button.

---
## [0.17.18] - Released
### Fixed
- Keep block week counts in sync when deleting a week so later added weeks use the next correct date.

---
## [0.17.17] - Released
### Changed
- Add an auto-push post-commit hook for work branches and document the commit-to-cloud workflow.

---
## [0.17.16] - Released
### Changed
- Add paginated "See all" loading for recent workouts in the quick start sheet.

---
## [0.17.15] - Released
### Changed
- Redesign the program overview header and streamline its stats.
- Create programs as drafts or start them immediately, with draft scheduling
  available from the overview header for both past and future weeks.
- Link the Today shortcut directly to the active program overview.
- Add a Train shortcut and manual estimated 1RM calculator using the existing
  Brzycki formula.
- Base program progress on completed workouts instead of elapsed calendar time.
- Match the Today workout shortcut border to its workout status color.
- Emphasize the Today schedule divider with the primary color.
- Use the primary color for the Home notification bell.

---
## [0.17.14] - Released
### Fixed
- Highlight incomplete workout totals on completed program cards.

---
## [0.17.13] - Released
### Fixed
- Keep valid run distance segments when locked phones deliver background locations less frequently.

---
## [0.17.12] - Released
### Changed
- Redesign program cards as image-backed covers with workout-type badges, schedule details, and progress.
- Use the Resistance Training cover image for programs containing resistance workouts.
- Use the Run cover image for running programs and split mixed-program covers into equal vertical sections.
- Add a soft white edge glow and deep drop shadow to program covers.
- Color completed program-card borders and glows with secondary, highlight cards active on today's date with primary, and stamp completed covers.
- Stamp active program covers and use the default workout-type image when a program has no workouts.
- Calculate program-card progress and completion solely from elapsed calendar days, independent of completed workouts.

---
## [0.17.11] - Released
### Changed
- Reorder the bottom navigation to place Home on the right beside Train.

---
## [0.17.10] - 2026-06-10
### Changed
- Open a durable notification history from the Home bell and store workout-start activity even when push delivery is unavailable.
- Reflect a currently running workout timer in the global center navigation button and reopen that workout when pressed.
- Use the shared fields theme color for Profile fields, actions, empty profile pictures, and expanded notification settings.

---
## [0.17.9] - Released with 0.17.10
### Changed
- Redesigned the empty workout card and replaced legacy add-workout modals with the shared workout starter.
- Add a one-tap first-set action to collapsed Resistance exercises with no sets.

---
## [0.17.8] - Released with 0.17.10
### Changed
- Refined collapsed and expanded resistance exercise cards, set summaries, and exercise actions.

---
## [0.17.7] - Released with 0.17.10
### Changed
- Apply the third accent color to Profile inputs and settings actions.

---
## [0.17.6] - Released with 0.17.10
### Changed
- Let users choose between multiple workouts planned for today from Home and the workout starter.
- Copy recent workouts into a fresh standalone workout with complete exercises and sets.

---
## [0.17.5] - Released with 0.17.10
### Changed
- Use English labels and descriptions for workout summary post visibility settings.

---
## [0.17.4] - Released with 0.17.10
### Changed
- Replace the empty home workout state with a ready-to-train card and Quick Start action.

---
## [0.17.3] - Released with 0.17.10
### Changed
- Show a ring loader while home social circle data is loading.

---
## [0.17.2] - Released with 0.17.10
### Changed
- Add workout-start notification preferences with custom followed-user selection.

---
## [0.17.1] - Released with 0.17.10
### Changed
- Move social user search to its own page opened from the Find Friends card.

---
## [0.17.0] - Released with 0.17.10
### Changed
- Add Expo notification dependencies and push token registration scaffolding.
- Add Supabase SQL for storing authenticated users' Expo push tokens.
- Add a workout-start Edge Function for sending Expo push notifications to followers.
- Show the workout type in workout-start notification copy and configure a FitVen Android notification icon.
- Configure the Android Firebase services file used for Expo push token registration.
- Retry push-token registration when the app becomes active and update registrations when the device push token rotates.
- Prevent workout owners from receiving their own workout-start notifications.
- Sync workout timer starts immediately so workout-start notifications are triggered without waiting for the next app resume.

---
## [0.16.3] - 2026-06-09
### Changed
- Let users long-press dates in the Workout Calendar to add or delete workouts.
- Replace the bottom-navigation plus menu with a start-workout sheet.
- Show today's planned workout, usual workouts, and recent workouts in the start-workout sheet.
- Let users start fresh Resistance and Run workouts from the start-workout sheet.

---
## [0.16.2] - Released with 0.16.3
### Changed
- Let users create custom exercises from the Exercise Catalog by naming them and selecting their targeted muscle groups.
- Label official catalog exercises and user-created custom exercises with color-coded badges.
- Automatically reactivate All muscles when the final muscle filter is deselected.
- Explain the difference between primary and secondary muscles in the Exercise Catalog.

---
## [0.16.1] - Released with 0.16.3
### Changed
- Show a Workout Calendar shortcut beside the compact Today card when no workouts are scheduled.

---
## [0.16.0] - Released with 0.16.3
### Changed
- Redesign the Run workout screen with a compact tracker card, warmup/cooldown cards, and an interval table.
- Improve run distance accuracy across GPS noise, background tracking, pauses, and resumes.

---
## [0.15.16] - Released with 0.16.3
### Changed
- Add a Social posts settings page from the Profile settings section.
- Add social post mode choices for full info, summary only, or automatic posting off.
- Add Supabase SQL for hiding specific exercises from generated social posts.
- Add exercise visibility settings under Social posts for hiding specific exercises from future social posts.
- Add social post audience visibility settings for everyone, followed profiles, or only the author.
- Show workout type beside the workout summary post timestamp again.

---
## [0.15.15] - Released with 0.16.3
### Changed
- Add a delete action for workout summary social posts without deleting the workout.

---
## [0.15.14] - Released with 0.16.3
### Changed
- Add a first Profile settings section with Exercises and Social posts actions.
- Show the EditSocialPost icon on the workout summary edit action.

---
## [0.15.13] - Released with 0.16.3
### Changed
- Add a dedicated edit screen for workout summary social post notes.
- Hide generic workout-type fallback text from workout summary cards when no note is set.

---
## [0.15.12] - Released with 0.16.3
### Changed
- Show Personal Records before Exercise Library on the Train page.

---
## [0.15.11] - Released with 0.16.3
### Changed
- Stop automatically backfilling social posts for every completed workout; workout summaries are only generated from Finish or manual Repost.
- Sort circle stories by activity state: live workouts first, then planned, done, and inactive profiles.

### Fixed
- Pause the Resistance timer when the final set is marked done.
- Add a Repost summary action to the Workout page options for manually regenerating a finished Resistance workout summary.
- Refresh existing workout summary posts when a manual repost has an equally complete or richer payload.

---
## [0.15.10] - Released with 0.16.3
### Changed
- Load Home workout summary posts with paginated infinite scrolling instead of a fixed three-post limit.

---
## [0.15.9] - Released with 0.16.3
### Changed
- Use the exercise catalog as the add-exercise picker inside Resistance workouts, with training-group and multi-select muscle-region filters.

---
## [0.15.8] - Released with 0.16.3
### Fixed
- Retry and backfill missing workout summary social posts for completed Resistance workouts.
- Include top sets from every completed exercise in workout summary posts.

---
## [0.15.7] - Released with 0.16.3
### Changed
- Move the Profile feedback card below Public profile and above Account logout.

---
## [0.15.6] - Released with 0.16.3
### Changed
- Replace Social people search cards with compact Instagram-style list rows.
- Remove bio text from Social people search results.
- Prevent the Social follow button label from wrapping when showing Following.

---
## [0.15.5] - Released with 0.16.3
### Changed
- Move follower and following counts from Profile to the Social header.
- Add compact Social header relationship stats that open the follower/following lists.

---
## [0.15.4] - Released with 0.16.3
### Changed
- Add a static workout summary preview card to Home.
- Show workout summary PR indicators inline with top set exercise names.
- Restyle workout summary top sets to match the workout set list table.
- Simplify workout summary top set columns and place reps before weight.
- Hide unfinished comment and share actions from the workout summary preview.
- Add Supabase setup SQL for workout summary social posts and likes.
- Create workout summary posts automatically after completed Resistance workouts.
- Load real workout summary feed cards on Home with like toggles.
- Soft-delete workout summary posts when completed workouts are reset.
- Keep Home workout summary feed cards below Today and friend stories.

---
## [0.15.3] - Released with 0.16.3
### Changed
- Add stories and a friend-search image card to the top of Social.

---
## [0.15.2] - Released with 0.16.3
### Changed
- Move Sickness Log and Workout Calendar shortcuts from Home to the top of Train.

---
## [0.15.1] - Released with 0.16.3
### Changed
- Move the Send Feedback card from Home to the top of Profile.

---
## [0.15.0] - Released with 0.16.3
### Changed
- Rename the bottom navigation search tab to Social and move it after the create button.
- Move the training tab into the former search tab position and label it Train.
- Use the upward graph icon for the Train tab.

---
## [0.14.15] - Released with 0.16.3
### Changed
- Move workout calendar weekday labels into a shared header row and simplify each day card to the date number.
- Compact workout calendar day cards and workout markers so dense weeks fit better.

---
## [0.14.14] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.14.13] - Released with 0.16.3
### Changed
- Add a Home screen body map preview test with a lightweight front muscle mask toggle.
- Replace exercise catalog row numbers with body map preview badges.
- Show exercise catalog body maps without circular frames.
- Load the front body map preview from a compressed PNG asset.
- Add Supabase setup SQL for body map muscle-region mappings.
- Highlight mapped primary and secondary muscles on exercise catalog body maps.
- Seed body map region mappings for the current shared muscle catalog.
- Show front or back body map previews per exercise catalog row.
- Render mapped back-view body map muscle overlays.
- Correct left and right muscle mask placement for back-view overlays.
- Open exercise catalog body maps in a full front and back detail modal.
- Keep cropped back muscle masks aligned in full body map previews.
- Stretch body map mask overlays with the same preview frame as the body image.
- Render back body map mask regions in the same full-frame coordinate system as the body preview.
- Align back body map overlays from the combined full-mask export paths.
- Hide secondary muscle badges when an exercise has no secondary muscles.
- Add upper/lower body section metadata to body map regions.
- Crop exercise catalog body map previews to upper or lower body from region metadata.

---
## [0.14.12] - Released with 0.16.3
### Changed
- Remove exercise catalog muscle activation percentages and the related detail modal.
- Show primary and secondary muscle count badges in the exercise catalog.

---
## [0.14.11] - Released with 0.16.3
### Changed
- Reorder workout exercises by long-pressing the exercise card instead of using the corner handle.

---
## [0.14.10] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.14.9] - Released with 0.16.3
### Changed
- Added day-level sickness marking from the week indicator context menu.
- Added the Sickness table foundation for dated sickness periods.
- Added a continuation prompt when marking sickness after an already sick day.
- Routed the home Sickness log shortcut to a dedicated Sickness screen.
- Added a draft Sickness screen layout for new entries and sickness history.
- Connected the Sickness screen history to local Sickness records.
- Fixed new sickness periods so choosing not to continue from yesterday does not leave overlapping history ranges.
- Added sickness type and note capture when marking a new sick day.
- Updated sick-day clearing so Sickness history removes, trims, or splits affected periods.
- Moved Sickness page registration into a modal opened from a Register new sickness button.
- Changed Sickness page registration dates to use a native calendar picker.
- Synced registered sickness periods into program days and Workout Calendar sick markers.
- Added edit and delete actions for Sickness history records.

---
## [0.14.8] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.14.7] - Released with 0.16.3
### Changed
- Added a home-screen sickness log card draft using the sickness dark artwork.

---
## [0.14.6] - Released with 0.16.3
### Changed
- Added record-color highlighting for PR sets, exercises, and completed workout indicators.

---
## [0.14.5] - Released with 0.16.3
### Changed
- Removed the one-time saved-program import action from the profile page.

---
## [0.14.4] - Released with 0.16.3
### Changed
- Simplified collapsed resistance set previews by removing the outer frame and moving repeat counts into corner badges.

---
## [0.14.3] - Released with 0.16.3
### Changed
- Added an expandable previous-set history panel behind the replay-history icon on resistance exercise cards.

---
## [0.14.2] - Released with 0.16.3
### Changed
- Redesigned program list cards with status badges, circular progress, completion marks, and workout type badges.

---
## [0.14.1] - Released with 0.16.3
### Changed
- Changed resistance set completion so tapping Done cycles through done, failed, and clear states.
- Colored failed resistance set progress blocks red in exercise headers.

---
## [0.14.0] - Released with 0.16.3
### Changed
- Added soft Run-style glow accents to the Resistance workout timer header.
- Added side-by-side local/cloud sync metadata and Supabase watcher migration support.

---
## [0.13.0] - Released with 0.16.3
### Changed
- Added estimated one-rep-max progression graphs to Personal Records exercise detail views.
- Added a one-time local program import button for the zhadowseb account.

---
## [0.12.3] - Released with 0.16.3
### Changed
- Describe pending changes here.

---
## [0.12.2] - Released with 0.16.3
### Changed
- Redesigned the Library Programs card with the generated program hero artwork and compact metric tiles.

---
## [0.12.1] - Released with 0.16.3
### Changed
- Added text labels under the bottom navigation buttons.

---
## [0.12.0] - Released with 0.16.3
### Changed
- Added a large bottom-navigation plus button for creating quick workouts on today's date.
- Added a Quick Workouts program container so quick workouts get real Day rows with dates.

---
## [0.11.1] - Released with 0.16.3
### Changed
- Added a workout calendar program-day modal with navigation to Program Overview.
- Limited workout calendar loading to the visible month plus adjacent months.

---
## [0.11.0] - Released with 0.16.3
### Changed
- Added a workout calendar test entry from Home with open-ended month paging, program-day dots, and workouts from all programs.

---
## [0.10.0] - Released with 0.16.3
### Changed
- Removed the header from the Library bottom-tab page.
- Added a Personal Records card and rep-record view under Library.
- Added a Personal Records toggle for hiding empty rep ranges.
- Updated the Personal Records exercise list to show the latest PR date.
- Redesigned the exercise catalog with search, group filters, and table-style rows.
- Added Supabase SQL for muscle group metadata used by exercise catalog filters.

---
## [0.9.14] - Released with 0.16.3
### Changed
- Refined the microcycle weekday indicator with a raised TODAY badge and month text labels.

---
## [0.9.13] - 2026-04-29
### Changed
- Added a Supabase `workout_type` catalog script with `type`, `display_name`, `is_active`, RLS, and a foreign key from `workout_type_instance.workout_type`.
- Synced active workout types from the cloud catalog into the local picker so visible workout options and display names can be controlled online.
- Added the workout type display name under the resistance workout header start status.
- Renamed the strength workout screen and icon files to `Resistance`.
- Added workout label editing from the workout header options menu.
- Reworked the Home page today shortcut into a compact start-card that opens the next workout directly.

---
## [0.9.12] - 2026-04-29
### Changed
- Redesigned program cards with compact status, progress, summary metrics and date range styling.

---
## [0.9.11] - 2026-04-29
### Fixed
- Fixed today's WeekIndicator workout badges so they use the same rounded-card shape and icon size as workout badges on other days.
- Fixed HomePage crew activity so it only shows followed users and can read today's workout activity for those users through Supabase follow-based access.

---
## [0.9.10] - 2026-04-29
### Added
- Added a Library tab to the bottom navigation that opens the exercise library with a dedicated Library icon.
- Moved the Programs and Exercise Library quick-access cards from the Home page to the Library page, with the Exercise Library card opening a dedicated Catalog screen.

---
## [0.9.9] - 2026-04-29
### Changed
- Redesigned the strength workout timer card with a compact status/header layout, linear set progress, and custom start, pause, continue, and finish actions.
- Refreshed strength exercise cards with Home-style top progress bars, set dividers, cleaner icon controls, and card-colored toolbar actions.
- Reworked collapsed exercise set summaries so matching sets are grouped with the repeat count outside the reps/weight badge and the expand control sits in its own side button.
- Updated the expanded strength set table with themed surfaces, tighter headers, focused edit pills, rest/reps/weight cell styling, and an inline add-set row.
- Reduced workout bottom safe-area spacing so strength and run workout screens no longer leave an empty black bar above the bottom navigation.

---
## [0.9.8] - 2026-04-29
### Changed
- Added drag-and-drop reordering for strength workout exercises with persisted local and cloud ordering.

---
## [0.9.7] - 2026-04-24
### Changed
- Updated the HomePage crew activity strip so your own circle now reflects real local workout states with planned, live, done, and rest styling plus status badges.

---
## [0.9.6] - 2026-04-24
### Changed
- Added profile photo upload backed by Supabase Storage, including avatar previews on the profile page, people search, relationship lists, and the HomePage social circle.

---
## [0.9.5] - 2026-04-24
### Changed
- Added a HomePage social circle strip inspired by the shared `FriendsActivity` reference, using static full rings and generic user icons instead of rotating avatar images or segmented activity rings.

---
## [0.9.4] - 2026-04-24
### Changed
- Added followers and following summary blocks on the profile page, including tappable lists that show which users follow you and which users you follow.

---
## [0.9.3] - 2026-04-24
### Changed
- Reworked social usernames to use an immutable `username_base#1234` format, including signup, profile display, search, and Supabase profile bootstrap logic.

---
## [0.9.2] - 2026-04-24
### Changed
- Added editable profile fields for `display_name` and `bio`, so users can update how they appear in people search directly from the profile page.

---
## [0.9.1] - 2026-04-24
### Changed
- Added a dedicated people search flow in the bottom navigation, including user search plus follow and unfollow actions backed by Supabase profiles and follow relationships.

---
## [0.9.0] - 2026-04-24
### Changed
- Replaced the HomePage top header with a global bottom navigation bar for authenticated screens, adding persistent Home and Profile actions across the app.

---
## [0.8.1] - Released with 0.9.0
### Changed
- Removed the unused local `Set.date` field and set cloud-sync mapping so set dates are derived from the owning workout/day instead of duplicated on each set.

---
## [0.8.0] - Released with 0.9.0
### Changed
- Refreshed the Create Program modal with themed inputs and a start-week picker that supports direct week selection and year navigation.

---
## [0.7.0] - 2026-04-21
### Changed
- Added overdue workout highlighting in the week indicator, so unfinished workouts from previous days now use the danger color.

---
## [0.6.8] - Released with 0.7.0
### Changed
- Restored the normal local-first `Set` sync flow so authenticated sync no longer treats cloud rows as the authoritative source for local SQLite state.
- Added local SQLite support for `sync_id`, `sync_version`, and `deleted_at` across the program hierarchy and strength workout entities, including safe local backfills for existing rows.
- Migrated `Program`, `Mesocycle`, `Microcycle`, `Day`, `workout_type_instance`, `exercise_instance`, and `set` sync to a versioned local-first model that resolves cloud matches by `sync_id` first, falls back to legacy local ids during migration, and uses cloud tombstones instead of hard deletes.
- Updated local edit flows so legacy rows that still lack a `sync_id` get one automatically on first local change, which lets older cloud-backed data enter the new sync model without manual repair.

---
## [0.6.7] - Released with 0.7.0
### Changed
- Temporarily made cloud `Set` rows authoritative during authenticated sync, so local SQLite now pulls cloud sets down, removes stray local-only set rows, and refreshes exercise set counts/completion from the downloaded data.

---
## [0.6.6] - Released with 0.7.0
### Changed
- Added a subtle swipe hint under the ProgramOverviewPage block carousel so it is easier to see that the mesocycle list scrolls horizontally.

---
## [0.6.5] - Released with 0.7.0
### Changed
- Fixed ProgramPage delete navigation so returning from a deleted program now replaces the route instead of leaving a broken overview screen in the stack.
- Hardened SQLite sync transactions to use savepoints, which avoids nested transaction failures during login and cloud sync startup.
- Repaired the Mesocycle cloud insert mapping so older synced programs no longer fail with a column/value mismatch.

---
## [0.6.4] - Released with 0.7.0
### Changed
- Describe pending changes here.

---
## [0.6.3] - Released with 0.7.0
### Changed
- Realigned the post-`0.5.10` development line to `0.6.x`, so new pending work no longer looks like extra `0.5.11+` patches after the `0.5.10` release.
- Updated the release workflow so older pending sections can be marked `Released with x.y.z` when one stable release bundles several earlier work branches.

---
## [0.6.2] - Released with 0.7.0
### Changed
- Refreshed ProgramPage cards with a larger hero section, cleaner metric panels, and automatic refresh when returning from Program Overview.

---
## [0.6.1] - Released with 0.7.0
### Changed
- HomePage quick access is being reshaped into a more informative dashboard layout so programs and exercise tools feel like overview surfaces instead of standalone buttons.

---
## [0.6.0] - Released with 0.7.0
### Changed
- Serialized shared SQLite transactions used by background sync and reconcile flows, so overlapping sync jobs no longer try to open nested transactions on the same connection.

---
## [0.5.10] - 2026-04-12
### Added
- Added the first `set` cloud sync flow with local cloud-id tracking, delete queueing, parent `exercise_instance(id)` repair, and an app-level sync runner that depends on `Exercise_Instance` sync.
### Changed
- Local set edits, set completion toggles, set deletions, and bulk set saves now mark `Set` rows as dirty and can sync in the background without waiting for app restart.
- Strength data sync now treats `Set` as the lowest cloud boundary, while still keeping derived `Exercise_Instance` fields such as set count and completion aligned and synced parent-first.

---
## [0.5.9] - Released with 0.5.10
### Added
- Added the first `exercise_instance` cloud sync flow with local cloud-id tracking, delete queueing, workout-parent repair, and an app-level sync runner that depends on `workout_type_instance` sync.
### Changed
- Local exercise updates now mark `Exercise_Instance` rows as dirty, and exercise creation, deletion, note changes, column changes, and set-derived completion or set-count changes can sync in the background without waiting for app restart.
- Strength workout copy flows now trigger both workout and exercise background sync, so copied exercise rows do not stay local-only after a successful workout copy.

---
## [0.5.8] - Released with 0.5.10
### Added
- Added the first `workout_type_instance` cloud sync flow with local cloud-id tracking, delete queueing, parent `Day.id` mapping, and an app-level sync runner.
### Changed
- Workout timer fields now sync through a safe local timestamp to cloud `time` conversion based on the workout date, so the existing local stopwatch logic can stay unchanged while cloud rows still match the Supabase schema.
- Local workout updates now mark `Workout_Type_Instance` rows as dirty, and finishing or resetting a workout triggers a background workout sync without making `Set` or `Exercise_Instance` write directly to cloud.
- Stale cached cloud ids in the `Program -> Mesocycle -> Microcycle -> Day -> workout_type_instance` sync chain now fall back to `upsert` instead of raw inserts, so parent rows can be repaired safely without duplicate-key failures.
- Local workout deletes now queue a tombstone by local workout sync-id, so deleting a newly created workout no longer waits on cloud sync and no longer risks being re-downloaded immediately after removal.

---
## [0.5.7] - Released with 0.5.10
### Added
- Added the first `Day` cloud sync flow with local cloud-id tracking, dirty-state sync flags, and an app-level sync runner that depends on `Microcycle` sync.
### Changed
- `Day` sync reconciles cloud rows before uploading local dirty rows, so locally generated placeholder days from downloaded microcycles can attach to existing cloud days instead of creating duplicates.
- Workout completion updates now mark the owning local `Day` row as dirty, so `done` can be synced later without making direct child-row cloud writes from `Set` or `Exercise_Instance`.

---
## [0.5.6] - Released with 0.5.10
### Added
- Added the first `Microcycle` cloud sync flow with local cloud-id tracking, dirty-state sync flags, remote delete queueing, and app-level sync triggers that depend on `Program` and `Mesocycle` sync.
### Changed
- Rebuilds missing local `Day` rows for cloud-downloaded microcycles so remote weeks remain usable locally until `Day` itself gets a dedicated sync layer.
- Aligned local `Program` and `Mesocycle` sync with the new cloud `Mesocycle.cloud_program_id -> Program.id` relationship while keeping local sync-key mappings so stale cloud ids can still be repaired safely.
- Aligned `Microcycle` cloud sync with the new `Microcycle.cloud_mesocycle_id -> Mesocycle.id` relationship, so parent references now use the real cloud mesocycle id instead of the old cloud-local key.
- Keeps local `remote_local_program_id` and `remote_local_mesocycle_id` as sync identities, while cloud relations now use real parent cloud ids.
- Added a one-time local repair that clears stale cached `cloud_program_id`, `cloud_mesocycle_id`, and `cloud_microcycle_id` values and marks the hierarchy dirty so sync can rebuild those ids safely after the cloud FK changes.
- Hardened mesocycle and microcycle uploads so they re-resolve parent cloud ids by sync key before writing children, which prevents stale cached parent ids from causing cloud FK failures.

---
## [0.5.5] - Released with 0.5.10
### Changed
- Switched the changelog workflow from a single global `Unreleased` bucket to versioned sections like `## [0.5.x] - Unreleased`, so pending releases are visible per version and `release:prepare` can convert the same section into a dated release entry.
### Added
- Added `npm run release:android -- <version>`, which prepares a stable release version and starts an Android EAS production build using the current EAS login or `EXPO_TOKEN`, with optional `--prebuild` support.

---

## [0.5.4] - Released with 0.5.10
### Changed
- Hardened program cloud deletes so a local program deletion only clears the local delete queue after the remote row is actually gone, and explicit program deletes now attempt cloud sync immediately while keeping failed deletes queued for retry.

---

## [0.5.3] - Released with 0.5.10
### Changed
- Scoped local SQLite storage to one database file per authenticated user, so logging into another profile no longer exposes the previous user's local programs on the device.

---

## [0.5.2] - Released with 0.5.10
### Added
- Added the first `Mesocycle` cloud sync flow with local cloud-id tracking, dirty-state sync flags, remote delete queueing, and app-level sync triggers that depend on `Program` sync.
### Changed
- Fixed `Mesocycle` cloud sync parent mapping so cloud writes use the canonical parent program identity instead of the device-local SQLite `program_id`, which avoids Supabase relationship failures across devices.

---

## [0.5.1] - Released with 0.5.10
### Changed
- Updated branch-driven versioning to support `major/...` and `minor/...` feature prefixes, where `minor/...` and `fix/...` both produce patch-level prerelease bumps.

---

## [0.5.0] - Released with 0.5.10
### Added
- Added the first `Program` cloud sync flow with local cloud-id tracking, dirty-state sync flags, remote delete queueing, and an app-level sync runner that uploads local program changes and pulls remote-only programs.
### Changed
- Normalized `Program.start_date` between local SQLite `dd.MM.yyyy` strings and cloud PostgreSQL `date` values to avoid sync failures and mixed local date formats.

---

## [0.4.2] - 2026-04-09
### Changed
- Renamed the local `Workout` table to `Workout_Type_Instance`, added a local `Workout_Type` table, and introduced a safe migration that preserves existing workout rows while backfilling `workout_type`.
- Aligned the local `Exercise` catalog with the cloud naming model, moved muscle-group counts to runtime calculation, and safely migrated `Exercise_Instance` to `exercise_instance_id` and `workout_type_instance_id` without breaking existing set relationships.
- Renamed the local `Sets` table to `Set` and safely migrated its `exercise_id` relation to `exercise_instance_id` without breaking existing set rows.

---

## [0.4.1] - 2026-04-09
### Changed
- Removed `program_id` from the local `Microcycle` table and added a safe migration that rebuilds the table without changing existing `microcycle_id` relationships.

---

## [0.4.0] - 2026-04-07
### Added
- Branch-based versioning scripts for branch, sync, status, and release workflows.
### Changed
- `CHANGELOG.md` now keeps versioned release entries in git history.

---

## [0.3.0] - 2026-03-25
### Added
- Login page

## [0.2.2.2] - 2026-03-25
### Fix
- Potential fix for location tracking again.
### Added
- Moving timer "restart" button to bottomsheet.
- "finish" timer button now sets workout as done.

---

## [0.2.2.1] - 2026-03-25
### Fix
- Fix bug that corrupted loading of all SQLite info.

---

## [0.2.2] - 2026-03-25
### Added
- Location tracking feature

## [0.2.1] - 2026-03-25
### Added
- Version 0.2 type styling for "Run" type workout.

---

## [0.2.0] - 2026-03-22
### Changed
- Full UI redesign (AI-assisted)

---

## [0.1.0] - 2026-03-XX
### Added
- Initial version
