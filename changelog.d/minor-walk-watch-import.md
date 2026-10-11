### Added
- **Walks you start on your watch come into FitVen** (Android, through Health Connect). A switch on the Steps page - "Walks from your watch" - asks Health Connect for the exercise, distance and steps permissions, and from then on a walk started on a watch or in a health app shows up as a finished Walk, with its length, the distance and the steps in it. The first time it reads the last two weeks; after that, what is new.
- **Only walks somebody started.** A watch that finds strolls by itself is not what the person called a walk, so those are left out, and so are runs (the app has no Run yet) and anything under five minutes.
- **Never twice.** A session is remembered, also after you delete the walk, and a walk is found by its start as well, so one that came back from the cloud on a new phone, one tracked in FitVen itself and a walk the watch and the phone both wrote are not doubled. A session that overlaps a walk you tracked in FitVen is skipped: your own numbers are the ones.
- **The route is fetched when you ask.** Health Connect asks the person for each walk's route, so a finished walk from a watch has a "Show the route from your watch" button; the route is kept on the phone, with the walk, like the route of a walk tracked here.
- The walks go in the calendar and the statistics and sync like any workout. Their steps are inside the phone's own count already, so nothing is added to the day's steps.
- **Needs a new development build and a new store build:** `READ_EXERCISE` and `READ_DISTANCE` are declared for Health Connect.

### Changed
- **The privacy policy now says walks are read from Health Connect** (when they started and ended, how far, the steps and - only on request - the route; the route, distance and steps stay on the phone), and its version is raised, so everybody is asked to accept it once more; `web/privacy/index.html` is rebuilt.
- The Play Console's Health Connect permissions declaration needs the exercise and distance permissions added, with the reason (walks recorded on a watch), before this ships to Android. The Data safety form needs the same.
