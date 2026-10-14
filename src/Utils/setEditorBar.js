// What the bar over the keyboard holds while a weight is being edited: the
// minus and plus buttons and the step field (Resources/Components/
// SetEditorBar). A small store, so the one bar the app mounts - inside the
// global keyboard toolbar in App.js, outside every set list and its database -
// can be driven by whichever set list owns the field that has focus.
//
// The set list registers what the bar needs: the weight and its label, the step,
// and what a press and a typed step do. The bar never touches the database.
//
// When it goes away is decided here and by its callers, and not by the weight
// cell's blur: tapping the step field blurs the weight cell, and a bar that
// followed the cell would be gone before the step field got focus. It is closed
//  - when the keyboard goes away (the toolbar host calls close()),
//  - when focus goes to another kind of cell (reps, RPE) in any set list,
//  - when the set it is about is ticked off, or its set list goes away,
//  - when another set's weight is opened: that one replaces it.
// A close that names an owner only closes that owner's bar: several set lists
// are on the screen at once, and one's cleanup must not close another's bar.
// Pure, so scripts/test-set-editor-bar.js loads it.

export function createSetEditorBarStore() {
  let bar = null;
  const listeners = new Set();

  const emit = () => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  return {
    /** The bar as it is now, the same object until it changes. */
    get() {
      return bar;
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    /** A weight field got focus: its set list's bar replaces any other. */
    open(next) {
      bar = { ...next };
      emit();
    },

    /** The owner's bar with new values, if it is still the one showing. */
    update(ownerId, setId, patch) {
      if (!bar || bar.ownerId !== ownerId || bar.setId !== setId) {
        return;
      }

      bar = { ...bar, ...patch };
      emit();
    },

    /**
     * Closed. With an owner, only that owner's bar (and, with a set, only its
     * bar for that set); without one, whatever is showing.
     */
    close(ownerId = null, setId = null) {
      if (!bar) {
        return;
      }

      if (ownerId !== null && bar.ownerId !== ownerId) {
        return;
      }

      if (setId !== null && bar.setId !== setId) {
        return;
      }

      bar = null;
      emit();
    },
  };
}

export const setEditorBar = createSetEditorBarStore();

let nextOwnerId = 1;

/** One id for each set list, so a close can tell whose bar it is. */
export function newSetEditorOwnerId() {
  nextOwnerId += 1;

  return nextOwnerId;
}

/** A step as the field writes it: "2", "1.25" - the language's decimal sign. */
export function formatStepForField(step, decimal = ".") {
  const rounded = Math.round(Number(step) * 100) / 100;

  if (!Number.isFinite(rounded)) {
    return "";
  }

  return String(rounded).replace(".", decimal);
}
