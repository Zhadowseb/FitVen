### Fixed
- **One exercise the cloud's catalogue does not know no longer stops everything behind it from syncing.** The cloud refuses an exercise whose name is not in its catalogue with a foreign-key error, and that one answer used to throw out of the upload: no other exercise and no set of that workout or any later one was sent, so the cloud held workouts with nothing in them (for one account nothing after 17 June). The refused exercise now stays on the phone, marked for the next pass, and the rest goes up; the log says which name it was. Any other error still stops the pass as before.

### Known
- The first launch after this uploads everything that was held back, row by row, through the same queue as every other sync, so it can take a while.
- A refused exercise still makes the set level repair its parent with a full exercise sync on every pass (two requests per pass in the test). A follow-up should remember the refusal for a while.
- Which exercise the cloud refuses for that account is not known yet; the log line now names it.
