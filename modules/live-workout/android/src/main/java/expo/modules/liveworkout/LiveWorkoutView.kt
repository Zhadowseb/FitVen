package expo.modules.liveworkout

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Derive: what the card draws from a state, at `now` (Unix seconds). This
// mirrors deriveLiveWorkoutView and chipsFor in src/Utils/liveWorkout.js rule
// by rule; when they differ, the JS file is right and this is wrong.
//
// Android draws no "11/18 sæt" (setsCount) and no seconds-left number: the
// notification's layout has no place for the first, and a Chronometer counts
// the second by itself.

internal enum class LiveMode { EMPTY, ALL_DONE, SET, REST }

internal enum class ChipState { DONE, NOW, TODO }

internal data class LiveChip(val text: String, val state: ChipState, val more: Boolean = false)

internal data class LiveRing(val fraction: Float, val text: String, val label: String)

internal data class LiveRestView(
  val endsAt: Double,
  /** What is left of the rest, 0..1: the collapsed ring and the bar. */
  val fraction: Float,
  /** "af 3:00". */
  val of: String
)

internal data class LiveNextRow(val label: String, val chips: List<LiveChip>)

internal data class LiveWorkoutView(
  val mode: LiveMode,
  /** `set`: the now set; `rest`: "Næste: {set}"; `empty` / `allDone`: the one line. */
  val title: String,
  /** "Bænkpres · sæt 3 af 4". */
  val subtitle: String,
  /** "Bænkpres · sæt 3/4", for the collapsed card. */
  val subtitleShort: String = "",
  val eyebrow: String = "",
  val nowSetId: String? = null,
  /** The now set's own text, "100 kg × 5". */
  val nowText: String = "",
  /** The exercise the card is about, after a finished one has made way. */
  val exerciseName: String = "",
  val setsRing: LiveRing? = null,
  val exerciseRing: LiveRing? = null,
  val rest: LiveRestView? = null,
  val canPrev: Boolean = false,
  val canNext: Boolean = false,
  val chips: List<LiveChip> = emptyList(),
  val nextRow: LiveNextRow? = null
)

internal object LiveWorkoutDerive {
  const val MAX_CHIPS = 6

  fun derive(state: LiveWorkoutState, now: Double): LiveWorkoutView {
    var exercise = state.exercise
    var next = state.next
    var canPrev = state.canPrev
    var canNext = state.canNext

    // After a tap without JS, the exercise can have nothing left to do: then
    // the next one takes its place, as it will once JS rebuilds the state.
    if (exercise != null && exercise.firstToDo() < 0) {
      exercise = if (next != null && next.firstToDo() >= 0) next else null
      next = null
      canPrev = false
      canNext = false
    }

    if (exercise == null) {
      val allDone = state.totals.all > 0

      return LiveWorkoutView(
        mode = if (allDone) LiveMode.ALL_DONE else LiveMode.EMPTY,
        title = state.string(if (allDone) "allDone" else "noSets"),
        subtitle = ""
      )
    }

    val rest = state.rest?.takeIf { it.endsAt > now }
    val resting = rest != null
    val sets = exercise.sets
    val nowIndex = exercise.firstToDo()
    val nowSet = sets[nowIndex]
    val done = sets.count { it.done }
    val position = listOf("n" to (nowIndex + 1).toString(), "total" to sets.size.toString())
    val total = exercise.total

    return LiveWorkoutView(
      mode = if (resting) LiveMode.REST else LiveMode.SET,
      title = if (resting) fill(state.string("nextSet"), "set" to nowSet.text) else nowSet.text,
      subtitle = "${exercise.name} · ${fill(state.string("setOf"), position)}",
      subtitleShort = "${exercise.name} · ${fill(state.string("setShort"), position)}",
      eyebrow = state.string(if (resting) "nextEyebrow" else "nowEyebrow"),
      nowSetId = nowSet.id,
      nowText = nowSet.text,
      exerciseName = exercise.name,
      setsRing = LiveRing(
        fraction = if (sets.isNotEmpty()) done.toFloat() / sets.size else 0f,
        text = "$done/${sets.size}",
        label = state.string("sets")
      ),
      exerciseRing = LiveRing(
        fraction = if (total > 0) min(1.0, state.totals.exercisesDone / total).toFloat() else 0f,
        text = "${exercise.index}/$total",
        label = state.string("exercise")
      ),
      rest = rest?.let {
        LiveRestView(
          endsAt = it.endsAt,
          fraction = min(1.0, max(0.0, (it.endsAt - now) / max(1.0, it.duration))).toFloat(),
          of = fill(state.string("of"), "duration" to clock(it.duration))
        )
      },
      canPrev = canPrev,
      canNext = canNext,
      chips = chipsFor(sets, nowIndex),
      nextRow = next?.let { upcoming ->
        LiveNextRow(
          label = fill(state.string("nextExercise"), "name" to upcoming.name),
          chips = chipsFor(upcoming.sets.map { it.copy(done = false) }, -1)
            .map { if (it.more) it else it.copy(state = ChipState.TODO) }
        )
      }
    )
  }

  /**
   * The chip row: every set when there are at most six, otherwise five
   * starting two before the one being done, and a "+n" for the rest.
   */
  fun chipsFor(sets: List<LiveSet>, nowIndex: Int): List<LiveChip> {
    fun stateOf(set: LiveSet, index: Int) = when {
      set.done -> ChipState.DONE
      index == nowIndex -> ChipState.NOW
      else -> ChipState.TODO
    }

    if (sets.size <= MAX_CHIPS) {
      return sets.mapIndexed { index, set -> LiveChip(set.short, stateOf(set, index)) }
    }

    val shown = MAX_CHIPS - 1
    val start = min(sets.size - shown, max(0, nowIndex - 2))

    return sets.subList(start, start + shown).mapIndexed { offset, set ->
      LiveChip(set.short, stateOf(set, start + offset))
    } + LiveChip("+${sets.size - shown}", ChipState.TODO, more = true)
  }

  /** Plain `{name}` substitution, in the order given, as fillTemplate does. */
  fun fill(template: String, vararg values: Pair<String, String>): String =
    fill(template, values.toList())

  private fun fill(template: String, values: List<Pair<String, String>>): String =
    values.fold(template) { text, (key, value) -> text.replace("{$key}", value) }

  /** "1:24", and "1:02:05" from an hour, as formatLiveClock does. */
  fun clock(totalSeconds: Double): String {
    val seconds = max(0L, floor(if (totalSeconds.isNaN()) 0.0 else totalSeconds).toLong())
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val rest = (seconds % 60).toString().padStart(2, '0')

    return if (hours > 0) {
      "$hours:${minutes.toString().padStart(2, '0')}:$rest"
    } else {
      "$minutes:$rest"
    }
  }
}
