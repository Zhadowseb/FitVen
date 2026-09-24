/**
 * The colour a set type is drawn in: its badge, its row's stripe, the sheet.
 *
 * A working set has none of its own - it is the default and stays the app's
 * primary, so only the sets that are something else stand out.
 */
export function setTypeColor(type, theme) {
  if (type === "warmup") {
    return theme.warmup;
  }

  if (type === "drop") {
    return theme.dropSet;
  }

  if (type === "amrap") {
    return theme.amrap;
  }

  return theme.primary;
}

/** Whether a row gets the stripe and tint: everything but a working set. */
export function isToneRow(type) {
  return type === "warmup" || type === "drop" || type === "amrap";
}
