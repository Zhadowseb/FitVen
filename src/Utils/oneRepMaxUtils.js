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

// The weight to pre-fill an estimated-set field with: an estimated program best
// is rounded to a whole number, a measured one is used as it stands.
export function getSuggestedProgramBestWeight(programBest) {
  if (!programBest) {
    return null;
  }

  if (programBest.isEstimated) {
    const estimatedValue = Number(programBest.estimatedOneRepMax);

    if (!Number.isFinite(estimatedValue)) {
      return null;
    }

    return Math.round(estimatedValue);
  }

  const weightValue = Number(programBest.weight);

  return Number.isFinite(weightValue) ? weightValue : null;
}
