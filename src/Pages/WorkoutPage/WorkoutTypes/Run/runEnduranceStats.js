// Which stats the endurance dashboard shows, and in what order.
// Shared by the run screen and the row that reorders them.

export const DEFAULT_ENDURANCE_STAT_PRIORITY = [
  "time",
  "zone",
  "distance",
  "pace",
];
export const ENDURANCE_STAT_LABELS = {
  time: "Time",
  zone: "Zone",
  distance: "Distance",
  pace: "Pace",
};

export const normalizeEnduranceStatPriority = (value) => {
  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = [];
    }
  }

  const validValues = Array.isArray(parsedValue)
    ? parsedValue.filter((key) =>
        DEFAULT_ENDURANCE_STAT_PRIORITY.includes(key)
      )
    : [];

  return [
    ...new Set([
      ...validValues,
      ...DEFAULT_ENDURANCE_STAT_PRIORITY,
    ]),
  ];
};
