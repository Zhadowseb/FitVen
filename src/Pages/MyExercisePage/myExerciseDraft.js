// What the form on your own exercise holds, and how it is compared with what
// is saved. Pure, so the page stays about the screen.
//
// Steps carry an id of their own, because they can be added and removed in
// the middle of typing: keyed by position, removing step 2 would hand step
// 3's text - and its focus - to a different input.
import {
  normalizeDescription,
  normalizeEquipment,
  normalizeSteps,
  normalizeWeightMode,
} from "@utils/customExercises";

let lastStepId = 0;

function nextStepId() {
  lastStepId += 1;

  return `step-${lastStepId}`;
}

export function newDraftStep(text = "") {
  return { id: nextStepId(), text };
}

/** The form, filled in from a MyCustomExercise (or empty for none). */
export function draftFromExercise(exercise) {
  return {
    description: exercise?.description ?? "",
    steps: normalizeSteps(exercise?.steps).map((text) => newDraftStep(text)),
    equipment: normalizeEquipment(exercise?.equipment),
    weightMode: normalizeWeightMode(exercise?.weightMode),
  };
}

/**
 * The form as it would be saved: blank steps dropped, whitespace collapsed.
 * This is also what "changed" is measured on, so a step added and left empty
 * is not a change that has to be saved or discarded.
 */
export function savedValuesFromDraft(draft) {
  return {
    description: normalizeDescription(draft?.description),
    steps: normalizeSteps((draft?.steps ?? []).map((step) => step.text)),
    equipment: normalizeEquipment(draft?.equipment),
    weightMode: normalizeWeightMode(draft?.weightMode),
  };
}

export function savedValuesFromExercise(exercise) {
  return {
    description: normalizeDescription(exercise?.description),
    steps: normalizeSteps(exercise?.steps),
    equipment: normalizeEquipment(exercise?.equipment),
    weightMode: normalizeWeightMode(exercise?.weightMode),
  };
}

export function sameSavedValues(left, right) {
  return (
    left.description === right.description &&
    left.equipment === right.equipment &&
    left.weightMode === right.weightMode &&
    left.steps.length === right.steps.length &&
    left.steps.every((step, index) => step === right.steps[index])
  );
}

export function draftHasChanges(draft, exercise) {
  return !sameSavedValues(
    savedValuesFromDraft(draft),
    savedValuesFromExercise(exercise)
  );
}
