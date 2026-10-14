### Changed
- **The weight's minus and plus are on the keyboard, not in every row.** Tap a weight and a bar sits in the keyboard's toolbar: a red minus, the step (`± 2 kg`) and a green plus. Hold either to repeat. The rows show only the weight, like before the steppers came, and the header's "move every set" is gone. The bar is not there for a finished or failed set, a bodyweight exercise, or a table with note, RPE or 1RM % columns, as before. The Done button stays; the previous/next arrows make way while the bar shows.
- **A weight you have typed is saved before minus or plus steps from it,** so 102,5 + one step is 105, not the old weight plus one step.

### Added
- **A small carousel over the reps while you edit them** (the keyboard opens as it always did, and the carousel shows over the cell until you leave the field): the number before, the number now and the number after (7 · **8** · 9). Swipe it sideways and each number passed is one rep, with a light tap; it saves once when you stop, and never goes below 0. Typing in the field still works, and the carousel shows what you type. An AMRAP set keeps its target (`9/6+`) in the box. It is not there for a finished or failed set, or in a table with note, RPE or 1RM % columns. A screen reader adjusts it with swipe up and down and double-tap types.
- **The step is yours to set, per exercise.** Type it in the bar's field (`1,25` or `1.25`; 0.25 to 50, rounded to a quarter kilo) and every workout and the lock-screen card use it for that exercise from then on. Empty the field and the automatic step (2 for dumbbells, 5 for machines, cables, squats and deadlifts, 2.5 otherwise) is back.
- **The step follows you to a new phone** for catalogue exercises: `exercise_column_preferences.weight_step`, synced like the weight mode. A custom exercise's stays on the phone.

### Database
- `supabase/migrations/20261014090000_a-step-per-exercise.sql` - adds `exercise_column_preferences.weight_step` (null, 0 or 0.25-50). Until it has run the step is kept on the phone and nothing else stops syncing.
