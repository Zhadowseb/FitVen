export function calculateBrzyckiOneRepMax(weight, reps) {
  const denominator = 1.0278 - 0.0278 * reps;

  if (denominator <= 0) {
    return null;
  }

  return weight / denominator;
}

export function roundToNearestWeightIncrement(weight, increment = 0.5) {
  const numericWeight = Number(weight);
  const numericIncrement = Number(increment);

  if (
    !Number.isFinite(numericWeight) ||
    !Number.isFinite(numericIncrement) ||
    numericIncrement <= 0
  ) {
    return null;
  }

  return Math.round(numericWeight / numericIncrement) * numericIncrement;
}
