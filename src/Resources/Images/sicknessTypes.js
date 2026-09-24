// `value` is what is stored in the sickness_type column and synced, so it stays
// English. What is shown is t(labelKey). `label` is the same stored value, kept
// for callers that still compare and key on it.
const TYPES = [
  {
    value: "General Sickness",
    labelKey: "calendar.sickness.types.general",
    image: require("./DarkVersion/General Sickness.jpg"),
  },
  {
    value: "Injury",
    labelKey: "calendar.sickness.types.injury",
    image: require("./DarkVersion/Injury.jpg"),
  },
  {
    value: "Mental",
    labelKey: "calendar.sickness.types.mental",
    image: require("./DarkVersion/Mental.jpg"),
  },
  {
    value: "Fatigue",
    labelKey: "calendar.sickness.types.fatigue",
    image: require("./DarkVersion/Fatigue.jpg"),
  },
];

export const SICKNESS_TYPES = TYPES.map((type) => ({ ...type, label: type.value }));

export const DEFAULT_SICKNESS_TYPE = SICKNESS_TYPES[0].value;

/** The translation key for a stored sickness type, or null for an unknown one. */
export function getSicknessTypeLabelKey(value) {
  return SICKNESS_TYPES.find((type) => type.value === value)?.labelKey ?? null;
}
