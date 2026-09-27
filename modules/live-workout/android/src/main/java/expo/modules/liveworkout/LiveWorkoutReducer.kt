package expo.modules.liveworkout

import kotlin.math.max

// A tap on the card, as it is queued for JS.
internal data class LiveAction(
  val type: String,
  val setId: String? = null,
  val seconds: Double? = null,
  /** Unix seconds when it was tapped. */
  val at: Double
) {
  companion object {
    const val COMPLETE_SET = "completeSet"
    const val PREV = "prev"
    const val NEXT = "next"
    const val ADJUST_REST = "adjustRest"
    const val SKIP_REST = "skipRest"

    val TYPES = setOf(COMPLETE_SET, PREV, NEXT, ADJUST_REST, SKIP_REST)
  }
}

// Reducer: what a tap does to the stored state before JS knows about it. This
// mirrors applyLiveWorkoutAction in src/Utils/liveWorkout.js rule by rule; when
// they differ, the JS file is right and this is wrong. It returns the same
// instance when nothing changes. Forrige / Næste never change anything.
internal object LiveWorkoutReducer {
  fun apply(state: LiveWorkoutState, action: LiveAction, now: Double): LiveWorkoutState {
    val at = action.at

    return when (action.type) {
      LiveAction.COMPLETE_SET -> completeSet(state, action, at, now)

      LiveAction.SKIP_REST -> if (state.rest != null) state.copy(rest = null) else state

      LiveAction.ADJUST_REST -> {
        val rest = state.rest ?: return state
        val seconds = (action.seconds ?: 0.0).let { if (it.isNaN()) 0.0 else it.toLong().toDouble() }
        val endsAt = rest.endsAt + seconds

        if (endsAt <= now) {
          state.copy(rest = null)
        } else {
          state.copy(rest = rest.copy(endsAt = endsAt, duration = max(1.0, rest.duration + seconds)))
        }
      }

      else -> state
    }
  }

  private fun completeSet(
    state: LiveWorkoutState,
    action: LiveAction,
    at: Double,
    now: Double
  ): LiveWorkoutState {
    val view = LiveWorkoutDerive.derive(state, now)

    if (view.mode != LiveMode.SET || action.setId != view.nowSetId) {
      return state
    }

    // The exercise the card really shows: after an earlier tap it can be
    // `next` standing in for a finished one.
    var exercise = state.exercise ?: return state
    var next = state.next
    var canPrev = state.canPrev
    var canNext = state.canNext

    if (exercise.firstToDo() < 0) {
      exercise = next ?: return state
      next = null
      canPrev = false
      canNext = false
    }

    val nowIndex = exercise.firstToDo()

    if (nowIndex < 0) {
      return state
    }

    val nowSet = exercise.sets[nowIndex]
    val sets = exercise.sets.mapIndexed { index, set -> if (index == nowIndex) set.copy(done = true) else set }
    val finishedExercise = sets.all { it.done }
    val running = state.pausedElapsed == null
    val rest = if (running && nowSet.rest > 0) {
      LiveRest(startedAt = at, endsAt = at + nowSet.rest, duration = nowSet.rest)
    } else {
      null
    }
    var shown: LiveExercise? = exercise.copy(sets = sets)

    if (finishedExercise) {
      val upcoming = next
      shown = if (upcoming != null && upcoming.firstToDo() >= 0) upcoming else null
      next = null
      canPrev = false
      canNext = false
    }

    return state.copy(
      exercise = shown,
      next = next,
      canPrev = canPrev,
      canNext = canNext,
      rest = rest,
      totals = state.totals.copy(
        done = state.totals.done + 1,
        exercisesDone = state.totals.exercisesDone + (if (finishedExercise) 1 else 0)
      )
    )
  }
}
