### Fixed
- **One exercise the cloud's catalogue does not know no longer stops everything behind it from syncing.** The cloud refuses an exercise whose name is not in its catalogue (a custom exercise, say) with a foreign-key error, and that one answer used to throw out of the upload: no other exercise and no set of that workout or any later one was sent, so the cloud held workouts with nothing in them (for one account nothing after 17 June), and the lifts and the post that wait behind the same upload were late or missing. The refused exercise now stays on the phone, marked for the next pass, and the rest goes up; the log says which name it was. Any other error still stops the pass as before.

### Known
- An exercise that is not in the catalogue - a custom one - and the sets in it still do not reach the cloud: the cloud has no place for them yet. They stay on the phone.
