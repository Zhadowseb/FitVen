package expo.modules.liveworkout

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

// The state the card is drawn from (`LiveWorkoutState`, version 1), as JS
// sends it: see buildLiveWorkoutState in src/Utils/liveWorkout.js. Unknown keys
// are ignored and a missing optional key reads as null / false. Every time and
// count is a Double: JS sends whole numbers, but a tap on the card writes
// `rest.startedAt = at`, which has a fraction.

internal data class LiveSet(
  val id: String,
  val text: String,
  val short: String,
  val done: Boolean,
  val rest: Double,
  /** Kilos (or the user's unit); null for a body-weight or timed set. */
  val weight: Double? = null,
  /** "5", or "8+" for an AMRAP target; null when the set has no reps. */
  val repsText: String? = null
)

internal data class LiveExercise(
  val name: String,
  val index: Int,
  val total: Int,
  val sets: List<LiveSet>,
  /** What one tap on −/+ changes the weight by, e.g. 2.5. */
  val weightStep: Double? = null,
  /** The step as JS formatted it, e.g. "2,5". */
  val weightStepText: String? = null
) {
  /** The index of the first set to do, or -1. */
  fun firstToDo(): Int = sets.indexOfFirst { !it.done }
}

internal data class LiveRest(
  val startedAt: Double,
  val endsAt: Double,
  val duration: Double
)

internal data class LiveTotals(
  val done: Double,
  val all: Double,
  val exercisesDone: Double
)

internal data class LiveWorkoutState(
  val v: Int,
  val workoutId: String,
  val workoutType: String,
  val startedAt: Double,
  val pausedElapsed: Double?,
  val exercise: LiveExercise?,
  val next: LiveExercise?,
  val rest: LiveRest?,
  val totals: LiveTotals,
  val canPrev: Boolean,
  val canNext: Boolean,
  val strings: Map<String, String>,
  /** "kg". */
  val unit: String? = null,
  /** The language's decimal separator, "," or ".". */
  val decimal: String? = null
) {
  /** A translated string or template from JS; empty when it is missing. */
  fun string(key: String): String = strings[key] ?: ""

  fun toJson(): String {
    val json = JSONObject()
    json.put("v", v)
    json.put("workoutId", workoutId)
    json.put("workoutType", workoutType)
    json.put("startedAt", startedAt)
    json.put("pausedElapsed", pausedElapsed ?: JSONObject.NULL)
    json.put("exercise", exercise?.let { exerciseJson(it) } ?: JSONObject.NULL)
    json.put("next", next?.let { exerciseJson(it) } ?: JSONObject.NULL)
    json.put(
      "rest",
      rest?.let {
        JSONObject()
          .put("startedAt", it.startedAt)
          .put("endsAt", it.endsAt)
          .put("duration", it.duration)
      } ?: JSONObject.NULL
    )
    json.put(
      "totals",
      JSONObject()
        .put("done", totals.done)
        .put("all", totals.all)
        .put("exercisesDone", totals.exercisesDone)
    )
    json.put("canPrev", canPrev)
    json.put("canNext", canNext)
    json.put("strings", JSONObject(strings as Map<*, *>))
    json.put("unit", unit ?: JSONObject.NULL)
    json.put("decimal", decimal ?: JSONObject.NULL)
    return json.toString()
  }

  companion object {
    /** The state, or null when the JSON is not an object. */
    fun parse(json: String?): LiveWorkoutState? {
      if (json.isNullOrBlank()) {
        return null
      }

      return try {
        fromJson(JSONObject(json))
      } catch (error: JSONException) {
        null
      }
    }

    private fun fromJson(json: JSONObject): LiveWorkoutState {
      val totals = json.optJSONObject("totals")
      val rest = json.optJSONObject("rest")

      return LiveWorkoutState(
        v = json.optInt("v", 1),
        workoutId = json.text("workoutId"),
        workoutType = json.text("workoutType"),
        startedAt = json.number("startedAt") ?: 0.0,
        pausedElapsed = json.number("pausedElapsed"),
        exercise = json.optJSONObject("exercise")?.let { exerciseOf(it) },
        next = json.optJSONObject("next")?.let { exerciseOf(it) },
        rest = rest?.let {
          LiveRest(
            startedAt = it.number("startedAt") ?: 0.0,
            endsAt = it.number("endsAt") ?: 0.0,
            duration = it.number("duration") ?: 0.0
          )
        },
        totals = LiveTotals(
          done = totals?.number("done") ?: 0.0,
          all = totals?.number("all") ?: 0.0,
          exercisesDone = totals?.number("exercisesDone") ?: 0.0
        ),
        canPrev = json.optBoolean("canPrev", false),
        canNext = json.optBoolean("canNext", false),
        strings = stringsOf(json.optJSONObject("strings")),
        unit = json.textOrNull("unit"),
        decimal = json.textOrNull("decimal")
      )
    }

    private fun exerciseOf(json: JSONObject): LiveExercise {
      val sets = json.optJSONArray("sets") ?: JSONArray()

      return LiveExercise(
        name = json.text("name"),
        index = json.optInt("index", 0),
        total = json.optInt("total", 0),
        sets = (0 until sets.length()).mapNotNull { position ->
          sets.optJSONObject(position)?.let { set ->
            LiveSet(
              id = set.text("id"),
              text = set.text("text"),
              short = set.text("short"),
              done = set.optBoolean("done", false),
              rest = set.number("rest") ?: 0.0,
              weight = set.number("weight"),
              repsText = set.textOrNull("repsText")
            )
          }
        },
        weightStep = json.number("weightStep"),
        weightStepText = json.textOrNull("weightStepText")
      )
    }

    private fun exerciseJson(exercise: LiveExercise): JSONObject {
      val sets = JSONArray()

      for (set in exercise.sets) {
        sets.put(
          JSONObject()
            .put("id", set.id)
            .put("text", set.text)
            .put("short", set.short)
            .put("done", set.done)
            .put("rest", set.rest)
            .put("weight", set.weight ?: JSONObject.NULL)
            .put("repsText", set.repsText ?: JSONObject.NULL)
        )
      }

      return JSONObject()
        .put("name", exercise.name)
        .put("index", exercise.index)
        .put("total", exercise.total)
        .put("sets", sets)
        .put("weightStep", exercise.weightStep ?: JSONObject.NULL)
        .put("weightStepText", exercise.weightStepText ?: JSONObject.NULL)
    }

    private fun stringsOf(json: JSONObject?): Map<String, String> {
      if (json == null) {
        return emptyMap()
      }

      val strings = LinkedHashMap<String, String>()

      for (key in json.keys()) {
        if (!json.isNull(key)) {
          strings[key] = json.optString(key, "")
        }
      }

      return strings
    }

    // org.json's optString turns a JSON null into the text "null".
    private fun JSONObject.text(key: String): String =
      if (isNull(key)) "" else optString(key, "")

    private fun JSONObject.textOrNull(key: String): String? =
      if (isNull(key)) null else optString(key, "")

    private fun JSONObject.number(key: String): Double? {
      if (isNull(key)) {
        return null
      }

      val value = optDouble(key, Double.NaN)

      return if (value.isNaN() || value.isInfinite()) null else value
    }
  }
}
