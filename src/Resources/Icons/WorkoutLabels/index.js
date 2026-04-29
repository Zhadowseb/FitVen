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
    short: "Resist...",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "Legs",
    short: "Resist...",
    Icon: Resistance,
    selectable: false,
  },
  {
    id: "StrengthTraining",
    short: "Resist...",
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
