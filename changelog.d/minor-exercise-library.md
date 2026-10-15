### Changed
- **The exercise library is drawn on the background, not on a card.** The catalogue had one big card round its search, the muscle map and a list of ten rows that scrolled inside the page. The list is now the page itself: the search, filters, popular exercises and map are its header, and the rows run on the background with a hairline between them. The picker for "Add exercise" lost its card too.

### Added
- **Popular exercises at the top of the library**, in the catalogue and in the picker: the five exercises that the most people train regularly, each with how many ("12 lifters train it regularly"). They go while you search or filter.
- **What "regularly" means:** an exercise is popular for a person when it was in at least 3 of their finished workouts in the last 90 days *and* in at least 15 % of all of them - about one workout in seven. Trying an exercise once is a try, not a habit, and the bar is low on purpose. An exercise's score is the number of people it is popular for; one that fewer than two people do regularly is not listed. Only catalogue exercises count, so nobody's own exercise name is shown to strangers.
- **Run `supabase/migrations/20261016090000_popular-exercises.sql`** for it (`public.popular_exercises`: security definer, signed-in people only, returns just a name and two counts - nobody is named). Until it has run the section is simply not there.
- **Tests:** `npm run test:exercise-popularity` checks the rule, that the migration counts the same numbers, and the wiring.
