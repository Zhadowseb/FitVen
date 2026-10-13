### Added
- **Cheer a friend on from their "has started a push!" notification.** Press and hold the notification (iPhone) or expand it (Android) and pick 💪 Good workout!, 🔥 Let's go! or 👏 Crush it!, or write a message of up to 140 characters. The friend gets "{name} cheered you on" with your words, as a push and in their notifications.
- **The same replies in the app,** under a workout-started row in your notifications for six hours after it arrived; after you have cheered the row says "You cheered · 💪 Good workout!". One cheer per person per workout - a second is ignored quietly.
- **"When someone cheers you on" in Notification settings,** next to the likes switch, on unless you turn it off. With it off you are not told, and your friends get no reply buttons on your workout notifications.
- **Danish and English strings** (`cheers.*`): God træning! / Kom så! / Giv den gas!. The buttons are registered again when the language changes.

### Changed
- **For now a reply button opens the app,** which then sends the cheer and says "Cheer sent". The installed expo-notifications does not call the app for a button that does not open it when the app is closed, so this is the reliable choice; `CHEER_ACTIONS_OPEN_APP` in `notificationService.js` flips it once a real iPhone and Android phone have shown a cheer sent from a closed app.
- **The workout-started push carries its workout's event id** (`eventId`), and `categoryId: "workout_started"` and `cheers: true` when the athlete takes cheers. The replies under a row in the app need that flag too, so a row from before this, or about someone with cheers off, offers none.
- **The privacy policy now says cheers and their messages are stored with your account and shown to the friend - and that a copy stays in the friend's notifications until they delete it,** and its version is raised, so everybody is asked to accept it once more; `web/privacy/index.html` is rebuilt.

### Database
- `supabase/migrations/20261012090000_cheers-from-a-notification.sql` - **has to be run, then `send-cheer-notification` deployed, its webhook on `workout_cheer` created, and `send-workout-started-notification` redeployed** (the steps are at the end of the file). It adds `notification_preferences.cheer_notifications`, `workout_cheer` (row level security, one per person per workout, six hours, no blocks, the sender must have been notified, the server writes who it is for) and the trigger that writes the history row. Until it has run the reply buttons cannot save a cheer and the switch is shown on and cannot be saved; nothing else changes.
