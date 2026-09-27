package expo.modules.liveworkout

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationManagerCompat
import kotlin.math.max

// The one card: what start / update / end and a tap do to the store and the
// notification. Everything runs under LiveWorkoutStore.lock, so a tap and a
// JS update can never interleave.
//
// While resting, and while this process is alive, the card is posted again
// every 5 s so the ring and the bar move, and once when the rest ends so it
// leaves rest mode. The countdowns themselves are Chronometers and count
// without any of this.
internal object LiveWorkoutCard {
  private const val TICK_MS = 5_000L
  private const val REST_END_SLACK_MS = 100L

  private val handler = Handler(Looper.getMainLooper())
  private val tick = Runnable { onTick() }

  // The application context, only while a rest is being ticked.
  @Volatile
  private var tickContext: Context? = null

  /** Replaces any card with a new one. True if it is shown. */
  fun start(context: Context, stateJson: String): Boolean {
    val state = LiveWorkoutState.parse(stateJson) ?: return false

    synchronized(LiveWorkoutStore.lock) {
      stopTicking()
      NotificationManagerCompat.from(context).cancel(LiveWorkoutNotification.NOTIFICATION_ID)
      LiveWorkoutStore.writeState(context, stateJson)
      LiveWorkoutNotification.ensureChannel(context, state, rename = true)
      return post(context, state)
    }
  }

  /** Stores the state and posts the card again, also after a swipe. True if it is shown. */
  fun update(context: Context, stateJson: String): Boolean {
    val state = LiveWorkoutState.parse(stateJson) ?: return false

    synchronized(LiveWorkoutStore.lock) {
      LiveWorkoutStore.writeState(context, stateJson)
      LiveWorkoutNotification.ensureChannel(context, state, rename = false)
      return post(context, state)
    }
  }

  /** Removes the card at once and forgets the state and the queue. */
  fun end(context: Context) {
    synchronized(LiveWorkoutStore.lock) {
      stopTicking()
      NotificationManagerCompat.from(context).cancel(LiveWorkoutNotification.NOTIFICATION_ID)
      LiveWorkoutStore.clear(context)
    }
  }

  /**
   * A tap: the reducer changes the stored state, the card is posted again and
   * the tap is queued. False, and nothing is queued, when the tap belongs to
   * no card that is still there (the workout ended, or another one started).
   */
  fun handleAction(context: Context, action: LiveAction, workoutId: String?): Boolean {
    synchronized(LiveWorkoutStore.lock) {
      val stored = LiveWorkoutState.parse(LiveWorkoutStore.readState(context))

      if (stored == null) {
        NotificationManagerCompat.from(context).cancel(LiveWorkoutNotification.NOTIFICATION_ID)
        return false
      }

      if (workoutId != null && workoutId != stored.workoutId) {
        return false
      }

      val reduced = LiveWorkoutReducer.apply(stored, action, nowSeconds())

      if (reduced !== stored) {
        LiveWorkoutStore.writeState(context, reduced.toJson())
      }

      LiveWorkoutNotification.ensureChannel(context, reduced, rename = false)
      post(context, reduced)
      LiveWorkoutStore.enqueue(context, action)
      return true
    }
  }

  private fun post(context: Context, state: LiveWorkoutState): Boolean {
    val now = nowSeconds()
    val view = LiveWorkoutDerive.derive(state, now)

    if (!LiveWorkoutNotification.canPost(context)) {
      stopTicking()
      return false
    }

    val notification = LiveWorkoutNotification.build(context, state, view, now)

    try {
      NotificationManagerCompat.from(context).notify(LiveWorkoutNotification.NOTIFICATION_ID, notification)
    } catch (error: SecurityException) {
      stopTicking()
      return false
    }

    scheduleTick(context, view, now)
    return true
  }

  private fun scheduleTick(context: Context, view: LiveWorkoutView, now: Double) {
    handler.removeCallbacks(tick)

    val rest = view.rest

    if (view.mode != LiveMode.REST || rest == null) {
      tickContext = null
      return
    }

    val untilEnd = ((rest.endsAt - now) * 1000).toLong()
    tickContext = context.applicationContext
    handler.postDelayed(tick, if (untilEnd > TICK_MS) TICK_MS else max(0L, untilEnd) + REST_END_SLACK_MS)
  }

  private fun stopTicking() {
    handler.removeCallbacks(tick)
    tickContext = null
  }

  private fun onTick() {
    val context = tickContext ?: return

    synchronized(LiveWorkoutStore.lock) {
      // Swiped away or timed out: it comes back with the next update, not by
      // itself every five seconds.
      if (!LiveWorkoutNotification.isShowing(context)) {
        tickContext = null
        return
      }

      val state = LiveWorkoutState.parse(LiveWorkoutStore.readState(context)) ?: return
      post(context, state)
    }
  }

  private fun nowSeconds(): Double = System.currentTimeMillis() / 1000.0
}
