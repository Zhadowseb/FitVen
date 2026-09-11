# Exercise Map

The muscle map lives **inside Exercise Library**, above the exercise list. There
is no separate Exercise Map screen any more: it was a second place to do the
same thing, so the figure moved into the list it filters and the Train entry
that opened it was removed on 2026-09-11.

Tap a muscle on either figure to filter the list below it to exercises that use
that muscle. The tap sets the same key the filter sheet sets, so a muscle picked
on the figure shows as chosen in the sheet and the other way round. Picking two
muscles means exercises that use both. Tapping a chosen muscle again clears it.

Each row of the list carries its own small figure with that exercise's primary
and secondary muscles coloured, so the row and the map read the same way.

## What is left of this folder

`src/Pages/ExerciseMapPage/` no longer holds a page. What remains is the figure
and its data, used by Exercise Library:

- `ExerciseMapBody.js` — the figure. Draws one side, optionally cropped to the
  upper or lower body, with every muscle region shaded and the chosen ones
  coloured. Pass `onSelect` to make it tappable; leave it out and the figure is
  decoration that lets taps through, which is what a list row wants.
- `bodyData.json` — the region outlines, 33 paths for the front and 34 for the
  back. Derived from the standalone prototype. Its `upper_traps` key is kept for
  catalog compatibility, but the back contour covers the whole trapezius group;
  that is not a claim that an exercise activates every subdivision equally.
- `exerciseMapUtils.js` — `REGION_LABELS`, and nothing else. It also held a
  catalog adapter and a muscle filter, which the removed screen was the only
  caller of; both went with it, along with their half of the test.
- `exerciseMapTouch.js` — tap detection that survives small finger movements and
  gives up the gesture when the page scrolls underneath it.
- `ExerciseMapPageStyle.js` — only `figure`, `figureLabel` and `bodyFrame` are
  still used. The rest belonged to the screen.

The folder name is now wrong. Renaming it touches every import of the figure,
which is why it has not been done.

## Colours

Colours are categorical, not measured. Primary and secondary say which role a
muscle plays in the movement, not what share of the work it does.

## Validation

`npm run test:exercise-map` covers the catalog adaptation, the filter behaviour
and the touch handling; `npm test` includes it. Rendering, taps and performance
still need a device — see the CHANGELOG for what the list was measured at and
what was tried and rejected.
