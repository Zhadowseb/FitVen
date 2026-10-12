package expo.modules.stepsensor

/**
 * One reading of the phone's step counter: when it was taken (ms since 1970),
 * how many steps the counter says since the phone was last started, and when
 * that start was (ms since 1970, worked out from the clock). The counter only
 * goes back to zero when the phone restarts, and a different `bootTime` is how
 * JS tells.
 */
internal data class StepSnapshot(
  val time: Long,
  val counter: Double,
  val bootTime: Long
)
