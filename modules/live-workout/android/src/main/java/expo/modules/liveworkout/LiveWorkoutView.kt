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

/** COUNT_UP: the rest counted up after a set with none written, from 15 s after the tap. */
internal enum class LiveMode { EMPTY, ALL_DONE, SET, REST, COUNT_UP }

internal enum class ChipState { DONE, NOW, TODO }

internal data class LiveChip(val text: String, val state: ChipState, val more: Boolean = false)

internal data class LiveRing(
  val fraction: Float,
  /** Done / all ("2/4"), as iOS shows it. */
  val text: String,
  val label: String,
  /** The sets ring on Android: the set being done / all ("3/4"). */
  val currentText: String? = null
)

internal data class LiveRestView(
  val endsAt: Double,
  /** What is left of the rest, 0..1: the collapsed fill and the open bar. */
  val fraction: Float,
  /** "af 3:00". */
  val of: String
)

internal data class LiveNextRow(val label: String, val chips: List<LiveChip>)

/** The rest counted up, by a Chronometer from `startedAt`, and the set it is after. */
internal data class LiveCountUpView(val startedAt: Double, val setId: String)

/** −step · Sæt færdigt · +step on the open card, between sets. */
internal data class LiveWeightButtons(
  val step: Double,
  /** "2,5 kg", on both buttons; the − and + are drawn beside it. */
  val label: String,
  val a11yMinus: String,
  val a11yPlus: String,
  /** False at 0: nothing lighter than an empty bar. */
  val minusEnabled: Boolean
)

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
  /**
   * The exercise the card is about, after a finished one has made way: the
   * open card's subtitle, in both modes.
   */
  val exerciseName: String = "",
  val setsRing: LiveRing? = null,
  val exerciseRing: LiveRing? = null,
  val rest: LiveRestView? = null,
  /** COUNT_UP: the rest counting up. */
  val countUp: LiveCountUpView? = null,
  /** "Sæt 3 af 4 færdigt": the button, with the set it ticks off. */
  val completeLabel: String = "",
  /** The exercise's sets as dots: done, the one to do now, the ones after it. */
  val setDots: List<ChipState> = emptyList(),
  val canPrev: Boolean = false,
  val canNext: Boolean = false,
  val chips: List<LiveChip> = emptyList(),
  val nextRow: LiveNextRow? = null,
  /** Null while resting, and for a set without a weight (body weight, time). */
  val weightButtons: LiveWeightButtons? = null,
  /** allDone: "Afslut", the one button. */
  val finishLabel: String = "",
  /** allDone: where it takes you. Without one there is no button. */
  val finishUrl: String? = null
)

internal object LiveWorkoutDerive {
  const val MAX_CHIPS = 6
  const val WEIGHT_STEP_DEFAULT = 2.5
  /** As LIVE_REST_COUNT_UP_GRACE_SECONDS in src/Utils/liveWorkout.js. */
  const val COUNT_UP_GRACE_SECONDS = 15.0

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
      // Every set done: the card asks to finish, and its one button opens
      // the app on the workout to do it.
      return if (state.totals.all > 0) {
        LiveWorkoutView(
          mode = LiveMode.ALL_DONE,
          title = state.string("allDone"),
          subtitle = state.string("allDoneQuestion"),
          finishLabel = state.string("finish"),
          finishUrl = state.finishUrl
        )
      } else {
        LiveWorkoutView(mode = LiveMode.EMPTY, title = state.string("noSets"), subtitle = "")
      }
    }

    val rest = state.rest?.takeIf { it.endsAt > now }
    val resting = rest != null
    // The rest counted up, once 15 s have passed since the tap; never over a
    // rest counting down.
    val countUp = state.countUp?.takeIf { !resting && now - it.startedAt >= COUNT_UP_GRACE_SECONDS }
    val between = resting || countUp != null
    val sets = exercise.sets
    val nowIndex = exercise.firstToDo()
    val nowSet = sets[nowIndex]
    val done = sets.count { it.done }
    val position = listOf("n" to (nowIndex + 1).toString(), "total" to sets.size.toString())
    val total = exercise.total
    val completeTemplate = state.strings["completeSetOf"]?.takeIf { it.isNotEmpty() } ?: state.string("complete")

    return LiveWorkoutView(
      mode = when {
        resting -> LiveMode.REST
        countUp != null -> LiveMode.COUNT_UP
        else -> LiveMode.SET
      },
      title = if (between) fill(state.string("nextSet"), "set" to nowSet.text) else nowSet.text,
      subtitle = "${exercise.name} · ${fill(state.string("setOf"), position)}",
      subtitleShort = "${exercise.name} · ${fill(state.string("setShort"), position)}",
      eyebrow = state.string(if (between) "nextEyebrow" else "nowEyebrow"),
      nowSetId = nowSet.id,
      nowText = nowSet.text,
      exerciseName = exercise.name,
      setsRing = LiveRing(
        fraction = if (sets.isNotEmpty()) done.toFloat() / sets.size else 0f,
        text = "$done/${sets.size}",
        label = state.string("sets"),
        currentText = "${min(done + 1, sets.size)}/${sets.size}"
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
      countUp = countUp?.let { LiveCountUpView(startedAt = it.startedAt, setId = it.setId) },
      completeLabel = fill(completeTemplate, position),
      setDots = sets.mapIndexed { index, set ->
        when {
          set.done -> ChipState.DONE
          index == nowIndex -> ChipState.NOW
          else -> ChipState.TODO
        }
      },
      canPrev = canPrev,
      canNext = canNext,
      chips = chipsFor(sets, nowIndex),
      weightButtons = if (between) null else weightButtonsFor(state, exercise, nowSet),
      nextRow = next?.let { upcoming ->
        LiveNextRow(
          label = fill(state.string("nextExercise"), "name" to upcoming.name),
          chips = chipsFor(upcoming.sets.map { it.copy(done = false) }, -1)
            .map { if (it.more) it else it.copy(state = ChipState.TODO) }
        )
      }
    )
  }

  private fun weightButtonsFor(
    state: LiveWorkoutState,
    exercise: LiveExercise,
    nowSet: LiveSet
  ): LiveWeightButtons? {
    val weight = nowSet.weight ?: return null
    val step = exercise.weightStep?.takeIf { it != 0.0 } ?: WEIGHT_STEP_DEFAULT
    val values = listOf(
      "step" to (exercise.weightStepText ?: weightText(step, state.decimal ?: ".")),
      "unit" to (state.unit ?: "kg")
    )

    return LiveWeightButtons(
      step = step,
      label = fill(state.string("weightStep"), values),
      a11yMinus = fill(state.string("a11yWeightMinus"), values),
      a11yPlus = fill(state.string("a11yWeightPlus"), values),
      minusEnabled = weight > 0
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

  /**
   * A weight as the card writes it, as formatLiveWeight does: at most two
   * decimals, no trailing zeros, no grouping, and the language's decimal
   * sign - "102,5", "100". Written from whole hundredths, so no Double ever
   * turns into "102.49999".
   */
  fun weightText(weight: Double, decimal: String): String {
    // java.lang.Math.round rounds a half up, as JS Math.round does;
    // kotlin.math.round would round it to even.
    val hundredths = Math.round(weight * 100)
    val magnitude = kotlin.math.abs(hundredths)
    val whole = (magnitude / 100).toString()
    val fraction = (magnitude % 100).toString().padStart(2, '0').trimEnd('0')
    val sign = if (hundredths < 0) "-" else ""

    return if (fraction.isEmpty()) "$sign$whole" else "$sign$whole$decimal$fraction"
  }

  /** A set's text and chip text from its weight and reps, as composeLiveSetText does. */
  fun setText(weight: Double?, repsText: String?, decimal: String, unit: String): Pair<String, String> {
    val kilos = weight?.let { weightText(it, decimal) }
    val reps = repsText?.takeIf { it.isNotEmpty() }

    return when {
      kilos != null && reps != null -> "$kilos $unit × $reps" to "$kilos×$reps"
      reps != null -> "× $reps" to "×$reps"
      kilos != null -> "$kilos $unit" to kilos
      else -> "–" to "–"
    }
  }

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
