// When an editable cell tells its parent about a new value.
//
// ThemedEditableCell commits from four places - blur, the keyboard's submit
// key, the keyboard going away (keyboardDidHide), and the cell unmounting -
// and most edits pass through more than one of them. Comparing against what
// was last committed keeps that to one write per distinct value, and makes
// leaving a field unchanged - or unmounting a cell nobody touched - write
// nothing.
//
// Pure, so scripts/test-workout-header.js runs it in Node.

/** Whether `local` is a value the parent has not been told yet. */
export function shouldCommitEdit(local, committed) {
  return local !== committed;
}
