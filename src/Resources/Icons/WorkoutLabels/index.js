import Run from "./Run";
import Resistance from "./Resistance";

export const WORKOUT_ICONS = [
  {
    id: "Resistance",
    short: "Resist...",
    Icon: Resistance,
    selectable: true,
  },
  {
    id: "Upperbody",
    short: "Upper",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Legs",
    short: "Legs",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "StrengthTraining",
    short: "Resist...",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Push",
    short: "Push",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Pull",
    short: "Pull",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Core",
    short: "Core",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Mobility",
    short: "Mobility",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Lowerbody",
    short: "Lower",
    Icon: Resistance,
    selectable: false,
  },
  { id: "Run",
    short: "Run",
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
