// What a tap on a strength exercise card does while a keyboard is up.
//
// Folding or unfolding the card unmounts its set fields, and a field taken
// away mid-edit used to lose the number typed into it (the owner's video of
// 2026-10-03). So a tap that would fold the card, with a keyboard up, only
// puts the keyboard away - the field then saves on keyboardDidHide
// (ThemedEditableCell) - and a second tap folds it.
//
// Every other button on the card - the note, the history, adding the first
// set - leaves the set fields where they are, so it works on the first tap
// as it always has, whoever's keyboard is up.
//
// Pure, so scripts/test-workout-header.js runs it in Node.

/**
 * "dismiss" to only put the keyboard away, "run" to do what was tapped.
 * `folds`: the press would fold or unfold the card.
 */
export function cardPressAction({ keyboardVisible = false, folds = false } = {}) {
  return keyboardVisible && folds ? "dismiss" : "run";
}
