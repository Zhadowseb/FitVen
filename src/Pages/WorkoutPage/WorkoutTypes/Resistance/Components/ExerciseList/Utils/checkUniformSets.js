function normalizeSetValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatSetValue(value) {
  return value === null ? "-" : Number(value).toString();
}

function formatMetricSummary(sets, field, suffix) {
  const values = sets.map((set) => normalizeSetValue(set[field]));
  const definedValues = values.filter((value) => value !== null);

  if (definedValues.length === 0) {
    return null;
  }

  const firstValue = definedValues[0];
  const allSame =
    definedValues.length === values.length &&
    definedValues.every((value) => value === firstValue);

  if (allSame) {
    return `${formatSetValue(firstValue)} ${suffix}`;
  }

  return values.map(formatSetValue).join(" / ");
}

export function formatExerciseSetSummary(sets, setCount) {
  if (!sets || sets.length === 0) {
    return "No sets added yet";
  }

  const numericSetCount = Number(setCount);
  const resolvedSetCount =
    Number.isFinite(numericSetCount) && numericSetCount > 0
      ? numericSetCount
      : sets.length;

  const summaryParts = [
    `${resolvedSetCount} ${resolvedSetCount === 1 ? "set" : "sets"}`,
  ];

  const repsSummary = formatMetricSummary(sets, "reps", "reps");
  const weightSummary = formatMetricSummary(sets, "weight", "kg");

  if (repsSummary) {
    summaryParts.push(repsSummary);
  }

  if (weightSummary) {
    summaryParts.push(weightSummary);
  }

  return summaryParts.join(" - ");
}
