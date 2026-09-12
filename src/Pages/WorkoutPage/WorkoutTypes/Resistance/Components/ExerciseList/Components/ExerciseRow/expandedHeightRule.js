/**
 * Whether a freshly measured height should replace the one the expand/collapse
 * animation is driving.
 *
 * The animation needs a fixed target to interpolate towards, so the row stores
 * the measured height of its expanded section. Deciding when to trust a new
 * measurement is the whole problem:
 *
 *   * Growing is always real - a set was added, a column was turned on.
 *   * Shrinking is real too, but only while the row is open. During a collapse
 *     the section is still mounted and reports its way down to nothing, and
 *     storing that would leave the target at zero, so the row could never open
 *     again.
 *
 * Kept out of the component and given a name because the rule is not obvious,
 * and because the first version of it - grow only, ever - looked correct and
 * left every card stuck at the tallest size it had ever been.
 */
export function shouldStoreExpandedHeight({
  measuredHeight,
  storedHeight,
  isExpanded,
}) {
  if (!(measuredHeight > 0)) {
    return false;
  }

  if (measuredHeight > storedHeight) {
    return true;
  }

  return Boolean(isExpanded);
}
