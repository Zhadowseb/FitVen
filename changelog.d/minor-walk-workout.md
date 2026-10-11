### Added
- **Walk is a workout you can start.** It is the second tile in the start sheet, with its own walking-figure icon, and opens a screen of its own: a map that follows you and draws the route, the time, Pause / Resume, Finish and a Lock, distance, pace (and the pace right now), steps, cadence and steps per kilometre. A little figure walks in place at your cadence. Nothing is shown as a zero when the phone cannot measure it: no step counter hides the steps and the cadence, no location shows one line and a button to allow it.
- **Auto pause** stops the clock by itself when you have taken no step and gained no ground for about 10 seconds, and starts it when you walk again; the paused time is not counted. It is a switch in the header and remembers its last choice.
- **Lock** covers the whole screen, the navigation too, until the unlock button has been held, and keeps the screen on while it is on. A screen reader gets an Unlock action instead of the hold.
- **Steps** come from the phone's step counter (`expo-sensors`), asked for the first time a walk starts. **This needs a new development build and a new store build:** a build made before it does not have the module, and the walk simply goes without steps there.
- A walk's route, distance, moving time and steps are kept on the phone, in one `Run` segment (which the statistics already read for runs and walks) and `LocationLog`. They are not in the cloud, like everything of Run and Walk; the walk itself syncs like any workout. A walk is not posted to the feed yet.

### Changed
- **Walk tracks while the app is open, and the tracking is not part of the screen.** `src/Services/walkTrackerService.js` owns the position, the steps and the clock, so going to another tab does not stop the walk. Pausing, finishing and the app going to the background do: there is still no foreground service and no background location (`npm test` guards that), so a walk with the screen off loses its distance and, on Android, its steps, while the clock goes on. iOS counts the steps of the gap afterwards.
- **"Tom træning" / "Første træning" on Home opens the start sheet** instead of making a Resistance workout, since there are two types to choose between now.
- **The privacy policy says that a walk's route and steps are stored on the phone, and that location is read while a walk runs.** The version is raised, so everybody is asked to accept it again on their next launch; `web/privacy/index.html` is rebuilt. The location text in `app.json` names the walk, and the app declares `ACTIVITY_RECOGNITION` and Motion & Fitness.
- **Starting a walk no longer asks for location a second time:** the centre match at the first start and at the finish skips walks (it matched where the walk ended to a gym).

### Fixed
- **Deleting a workout, a week, a block or a program deletes the route that was stored with it.** `LocationLog` was never cleared with them, so the routes of deleted runs stayed on the phone.
