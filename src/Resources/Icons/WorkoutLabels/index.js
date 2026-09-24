import { t } from "@localization";

import Run from "./Run";
import Resistance from "./Resistance";

// Only Resistance and Run have an entry below. The other nine icons in this
// folder - ArmMuscle, BoxingGlove, Dumbbell, LegMuscle, MultipleWorkouts,
// Rest, RunningShoes, SkippingRope and Treadmil - are placeholders for
// workout types still to come, not dead code. Leave them where they are.

export const WORKOUT_ICONS = [
  {
    id: "Resistance",
    shortKey: "calendar.workoutShort.resistance",
    Icon: Resistance,
    selectable: true,
  },
  {
    id: "Upperbody",
    shortKey: "calendar.workoutShort.upperbody",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Legs",
    shortKey: "calendar.workoutShort.legs",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "StrengthTraining",
    shortKey: "calendar.workoutShort.resistance",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Push",
    shortKey: "calendar.workoutShort.push",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Pull",
    shortKey: "calendar.workoutShort.pull",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Core",
    shortKey: "calendar.workoutShort.core",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Mobility",
    shortKey: "calendar.workoutShort.mobility",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Lowerbody",
    shortKey: "calendar.workoutShort.lowerbody",
    Icon: Resistance,
    selectable: false,
  },
  { id: "Run",
    shortKey: "calendar.workoutShort.run",
    Icon: Run,
    selectable: true,
  },
];

export const SELECTABLE_WORKOUT_ICONS = WORKOUT_ICONS.filter(
  (workoutIcon) => workoutIcon.selectable !== false
);

export function getWorkoutIconConfig(label) {
  return WORKOUT_ICONS.find((workoutIcon) => workoutIcon.id === label) ?? null;
}

/** The short name under a workout's icon, in the app's language. */
export function getWorkoutIconShortLabel(config) {
  return config?.shortKey ? t(config.shortKey) : null;
}
