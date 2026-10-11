### Added
- **An Android phone with no health app now counts steps itself.** The phone's own step counter is the last layer under Health Connect: FitVen reads it every 15 minutes while the app is closed (a job the system runs - no notification, no foreground service) and turns the readings into steps for each day, so nobody has to install Health Connect or Samsung Health. The days are kept as source `sensor`, one number a day like the others, and go to the cloud with them.
- **It is asked for once.** Allow on the steps card asks for Physical activity when no health app has anything this week, and nothing is read before the person has said yes. The card and the Steps page say what is missing and open the app's settings when it was refused.
- **Never added to a health app's number.** A day the health app has a number for keeps that number; the sensor's only fills the days with nothing, and the Steps page says that those days are counted by FitVen and are an estimate.
- **A restart of the phone, or days without opening the app, do not lose steps:** a restart starts a new counter, and a long gap is spread over the days it covers (less at night) instead of landing on today.
- `android-native-check.yml` builds the Android app on pull requests that touch `modules/`, since Kotlin cannot be compiled on Windows.

### Changed
- **The privacy policy now says the step counter is read in the background** (about every 15 minutes, readings kept on the phone only until they are turned into the day's steps), and its version is raised, so everybody is asked to accept it once more; `web/privacy/index.html` is rebuilt.
- The Play Console's Data safety form and the "Physical activity" permission need the same sentence before this ships to Android.
