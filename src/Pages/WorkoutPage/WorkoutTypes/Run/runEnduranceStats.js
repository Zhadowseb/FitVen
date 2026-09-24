// Which stats the endurance dashboard shows, and in what order.
// Shared by the run screen and the row that reorders them.

export const DEFAULT_ENDURANCE_STAT_PRIORITY = [
  "time",
  "zone",
  "distance",
  "pace",
];
// Translation keys, looked up when the row renders. The object keys are stored
// (stat_priority) and must stay as they are.
export const ENDURANCE_STAT_LABEL_KEYS = {
  time: "run.priority.stats.time",
  zone: "run.priority.stats.zone",
  distance: "run.priority.stats.distance",
  pace: "run.priority.stats.pace",
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
