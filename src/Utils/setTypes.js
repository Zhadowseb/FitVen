// What kind of set a set is, and what follows from it.
//
// `set_type` is the one truth. `amrap` came first - a boolean on every set,
// synced, read in forty places - and it is kept as a mirror rather than
// removed, because older app versions in the field still read and write it
// and know nothing about `set_type`.
//
// That mirror is the one subtle part. An older client that marks a set AMRAP
// writes `amrap = 1` and never touches `set_type`, which therefore arrives as
// its default, 'working'. "set_type wins" would throw that AMRAP away. So a
// working set with the flag up is an AMRAP set: that combination can only have
// come from something that did not know set_type existed.

export const SET_TYPES = ["warmup", "working", "drop", "amrap"];

/** Anything not recognised is a working set - what every set was before this. */
export function normalizeSetType(value) {
  return typeof value === "string" && SET_TYPES.includes(value) ? value : "working";
}

/** The type of a stored row, honouring what an older client wrote. */
export function resolveSetType(row) {
  const type = normalizeSetType(row?.set_type);

  if (type === "working" && Number(row?.amrap) === 1) {
    return "amrap";
  }

  return type;
}

/** The mirror written alongside every set_type, for clients that read only it. */
export function amrapFlagFor(setType) {
  return normalizeSetType(setType) === "amrap" ? 1 : 0;
}

/** A warm-up is preparation, not work: it adds nothing to volume. */
export function countsTowardVolume(setType) {
  return normalizeSetType(setType) !== "warmup";
}

/**
 * Whether a set can hold a personal record.
 *
 * A warm-up cannot: it is deliberately below what you can do. A drop set
 * cannot either: it is the same effort continued at a lighter weight, and
 * recording its weight-for-reps as a best would put a record on the easier
 * half of one set.
 */
export function canBePersonalRecord(setType) {
  const type = normalizeSetType(setType);

  return type === "working" || type === "amrap";
}

/**
 * The label each set carries in its badge, in the order the sets are shown.
 *
 * Warm-ups count on their own - W1, W2 - so that adding one does not renumber
 * the work. Working and AMRAP sets share the main count, 1, 2, 3, because an
 * AMRAP set is a working set you took to failure. A drop set belongs to the
 * set above it, so it counts from that parent - D1, D2 - and starts again
 * under the next one.
 *
 * `sets` must already be in display order. Returns one label per set.
 */
export function labelSets(sets = []) {
  let warmupCount = 0;
  let workingCount = 0;
  let dropCount = 0;

  return sets.map((set) => {
    const type = resolveSetType(set);

    if (type === "warmup") {
      warmupCount += 1;
      return { type, label: `W${warmupCount}`, index: warmupCount };
    }

    if (type === "drop") {
      dropCount += 1;
      return { type, label: `D${dropCount}`, index: dropCount };
    }

    workingCount += 1;
    dropCount = 0;

    return { type, label: String(workingCount), index: workingCount };
  });
}

/**
 * Display order: warm-ups first, everything else as it was.
 *
 * Stable, so two warm-ups keep their order relative to each other, and the
 * working sets keep theirs - a drop set stays directly under its parent.
 */
export function orderSetsForDisplay(sets = []) {
  return sets
    .map((set, position) => ({ set, position, warmup: resolveSetType(set) === "warmup" }))
    .sort((left, right) => {
      if (left.warmup !== right.warmup) {
        return left.warmup ? -1 : 1;
      }

      return left.position - right.position;
    })
    .map((entry) => entry.set);
}

/**
 * For a drop set, the weight of the set it drops from: the nearest working or
 * AMRAP set above it. Null when there is none, and for every other type.
 */
export function dropParentWeight(sets, index) {
  if (resolveSetType(sets[index]) !== "drop") {
    return null;
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const type = resolveSetType(sets[cursor]);

    if (type === "working" || type === "amrap") {
      const weight = Number(sets[cursor]?.weight);

      return Number.isFinite(weight) ? weight : null;
    }

    if (type === "warmup") {
      return null;
    }
  }

  return null;
}
