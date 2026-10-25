### Fixed
- **A workout post can no longer hang for ever.** The "Posting your workout in the background…" bar on Home could sit there for hours and never become "posted" or "failed". Every cloud call in the app is a React Native `fetch`, which has no timeout, and every upload, the centre match and every post run one after another in one queue (`syncScheduler`): a single stalled request - a phone changing from wifi to mobile data in a pocket, a tunnel, a permission dialog nobody could see - held up everything behind it for the rest of the session.
  - **Every request ends** (`Utils/fetchTimeout.js`): 30 seconds, 5 minutes for a file going up. A timeout counts as a bad connection and is tried once more.
  - **A task in the queue ends**: after 150 seconds the queue goes on without it, and whoever waited for it (a post) is told "The upload took too long. Try again." and shows "failed" with Try again.
- **A post survives the app being closed.** What is posting or has failed is kept on the phone; if the app was closed mid-post, Home opens with "failed - the post was interrupted when the app closed" and Try again, instead of the workout silently never being shared.
- **"Failed" says why.** The bar shows the reason under the message, so a failure on a phone can be told to somebody.
- Not changed: a post still waits behind uploads in the one queue, and a response whose body stalls after the headers arrived is not timed out.
- **Tests:** `test-social-post-reliability.js` runs a stalled request, a stalled task with a task behind it, and the kept post.
