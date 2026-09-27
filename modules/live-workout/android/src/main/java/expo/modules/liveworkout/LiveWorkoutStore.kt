package expo.modules.liveworkout

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.util.UUID

// The store the module and the button receiver share: the current state, as
// the JSON last written, and the queue of taps JS has not drained yet. It
// writes with commit(), not apply(): a tap handled while the app is not
// running may be followed at once by the process being killed, and the tap
// must still be in the queue when the app next opens.
internal object LiveWorkoutStore {
  private const val PREFERENCES = "live_workout"
  private const val KEY_STATE = "state"
  private const val KEY_ACTIONS = "actions"
  private const val MAX_ACTIONS = 50

  /**
   * Held around every read-change-write of the store and the notification
   * posted from it, so a tap and a JS update can never interleave.
   */
  val lock = Any()

  private fun preferences(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  fun readState(context: Context): String? = synchronized(lock) {
    preferences(context).getString(KEY_STATE, null)
  }

  fun writeState(context: Context, json: String) {
    synchronized(lock) {
      preferences(context).edit().putString(KEY_STATE, json).commit()
    }
  }

  /** Adds a tap to the queue; see [withAction]. */
  fun enqueue(context: Context, action: LiveAction, weight: Double? = null) {
    synchronized(lock) {
      val preferences = preferences(context)
      val queue = withAction(
        queueOf(preferences.getString(KEY_ACTIONS, null)),
        action,
        weight,
        UUID.randomUUID().toString()
      )

      preferences.edit().putString(KEY_ACTIONS, queue.toString()).commit()
    }
  }

  /**
   * The queue with a tap added, dropping the oldest past 50. An adjustWeight
   * carries `weight`, the weight the set now has, not the step: when the
   * queue already holds one for the same set, that entry takes the new
   * weight and time where it stands, so taps in a row are one entry and
   * handling the queue twice gives the same set.
   */
  fun withAction(queue: JSONArray, action: LiveAction, weight: Double?, id: String): JSONArray {
    val weighing = action.type == LiveAction.ADJUST_WEIGHT
    val earlier = if (weighing && weight != null) {
      (0 until queue.length())
        .mapNotNull { queue.optJSONObject(it) }
        .firstOrNull { it.optString("type") == LiveAction.ADJUST_WEIGHT && it.optString("setId") == action.setId }
    } else {
      null
    }

    if (earlier != null && weight != null) {
      earlier.put("weight", weight).put("at", action.at)
      return queue
    }

    val entry = JSONObject()
      .put("id", id)
      .put("type", action.type)
      .put("at", action.at)

    if ((action.type == LiveAction.COMPLETE_SET || weighing) && action.setId != null) {
      entry.put("setId", action.setId)
    }

    if (action.type == LiveAction.ADJUST_REST && action.seconds != null) {
      entry.put("seconds", action.seconds.toLong())
    }

    if (weighing && weight != null) {
      entry.put("weight", weight)
    }

    queue.put(entry)

    val kept = JSONArray()

    for (index in maxOf(0, queue.length() - MAX_ACTIONS) until queue.length()) {
      kept.put(queue.get(index))
    }

    return kept
  }

  /** The queue as a JSON array, oldest first, emptied in the same step. */
  fun drainActions(context: Context): String = synchronized(lock) {
    val preferences = preferences(context)
    val queue = queueOf(preferences.getString(KEY_ACTIONS, null))
    preferences.edit().remove(KEY_ACTIONS).commit()
    queue.toString()
  }

  /** Forgets the state and the queue. */
  fun clear(context: Context) {
    synchronized(lock) {
      preferences(context).edit().remove(KEY_STATE).remove(KEY_ACTIONS).commit()
    }
  }

  private fun queueOf(json: String?): JSONArray {
    if (json.isNullOrBlank()) {
      return JSONArray()
    }

    return try {
      JSONArray(json)
    } catch (error: JSONException) {
      JSONArray()
    }
  }
}
