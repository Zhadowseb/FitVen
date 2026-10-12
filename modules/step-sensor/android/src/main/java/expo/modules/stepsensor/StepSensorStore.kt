package expo.modules.stepsensor

import android.content.Context
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

// The readings the worker took while the app was closed, waiting for JS to turn
// them into steps for each day. A small list in SharedPreferences, written with
// commit() so a reading survives the process being killed straight after.
internal object StepSensorStore {
  private const val PREFERENCES = "step_sensor"
  private const val KEY_SNAPSHOTS = "snapshots"

  // Fifteen minutes apart that is about a month, and JS drains it far more often.
  private const val MAX_SNAPSHOTS = 3000

  // A counter that has not moved is only worth another entry after this long: it
  // says nothing new, and a night of them would push the day out of the list.
  private const val SKIP_UNCHANGED_MS = 2L * 60 * 60 * 1000

  private val lock = Any()

  private fun preferences(context: Context) =
    context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  private fun parse(json: String?): MutableList<StepSnapshot> {
    val list = mutableListOf<StepSnapshot>()

    if (json.isNullOrEmpty()) {
      return list
    }

    try {
      val array = JSONArray(json)

      for (index in 0 until array.length()) {
        val entry = array.getJSONObject(index)

        list.add(
          StepSnapshot(
            time = entry.getLong("t"),
            counter = entry.getDouble("c"),
            bootTime = entry.getLong("b")
          )
        )
      }
    } catch (error: JSONException) {
      // A damaged list is an empty one: the steps it held are lost, the app is not.
      list.clear()
    }

    return list
  }

  private fun write(context: Context, list: List<StepSnapshot>) {
    val array = JSONArray()

    for (snapshot in list) {
      array.put(
        JSONObject()
          .put("t", snapshot.time)
          .put("c", snapshot.counter)
          .put("b", snapshot.bootTime)
      )
    }

    preferences(context).edit().putString(KEY_SNAPSHOTS, array.toString()).commit()
  }

  fun append(context: Context, snapshot: StepSnapshot) {
    synchronized(lock) {
      val list = parse(preferences(context).getString(KEY_SNAPSHOTS, null))
      val last = list.lastOrNull()
      val outOfOrder = last != null && snapshot.time <= last.time
      val nothingNew = last != null &&
        last.counter == snapshot.counter &&
        Math.abs(last.bootTime - snapshot.bootTime) < 60_000L &&
        snapshot.time - last.time < SKIP_UNCHANGED_MS

      if (!outOfOrder && !nothingNew) {
        list.add(snapshot)

        while (list.size > MAX_SNAPSHOTS) {
          list.removeAt(0)
        }

        write(context, list)
      }
    }
  }

  /** The readings taken after [afterTime], oldest first, as the JSON JS parses. */
  fun readAfter(context: Context, afterTime: Long): String = synchronized(lock) {
    val array = JSONArray()

    for (snapshot in parse(preferences(context).getString(KEY_SNAPSHOTS, null))) {
      if (snapshot.time > afterTime) {
        array.put(
          JSONObject()
            .put("time", snapshot.time)
            .put("counter", snapshot.counter)
            .put("bootTime", snapshot.bootTime)
        )
      }
    }

    array.toString()
  }

  /** Forgets the readings older than [beforeTime]; the one JS still counts from is kept by JS. */
  fun trimBefore(context: Context, beforeTime: Long) {
    synchronized(lock) {
      val list = parse(preferences(context).getString(KEY_SNAPSHOTS, null))
      val kept = list.filter { it.time >= beforeTime }

      if (kept.size != list.size) {
        write(context, kept)
      }
    }
  }
}
