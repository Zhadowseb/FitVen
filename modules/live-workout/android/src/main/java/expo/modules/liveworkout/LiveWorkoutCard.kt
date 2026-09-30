package expo.modules.liveworkout

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import androidx.core.app.NotificationManagerCompat
import kotlin.math.max

// The one card: what start / update / end and a tap do to the store and the
// notification. Everything runs under LiveWorkoutStore.lock, so a tap and a
// JS update can never interleave.
//
// While resting, and while this process is alive, the card is posted again
// every 5 s so the collapsed fill and the open bar move, and once when the
// rest ends so it leaves rest mode. A rest counted up (after a set with none
// written) is posted once more 15 s after the tap, when it starts to show.
// The countdowns and the count-up themselves are Chronometers and count
// without any of this.
//
// What the card does by itself - a tap, and those re-posts - runs on its own
// thread, never the main one: each is a parse, the reducer, two synchronous
// disk writes and the RemoteViews with their ring bitmaps, and the weight
// buttons are made to be tapped five times in a row. One thread, so taps are
// handled in the order they came in. start / update / end come on the Expo
// module's own background queue.
internal object LiveWorkoutCard {
  private const val TICK_MS = 5_000L
  private const val REST_END_SLACK_MS = 100L

  private val worker: Handler by lazy {
    Handler(HandlerThread("LiveWorkoutCard").apply { start() }.looper)
  }
  private val tick = Runnable { onTick() }

  // The application context, only while a rest is being ticked.
  @Volatile
  private var tickContext: Context? = null

  /** Runs [block] on the card's own thread, after whatever is already waiting there. */
  fun inBackground(block: () -> Unit) {
    worker.post(block)
  }

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
   * no card that is still there (the workout ended, or another one started),
   * and for a weight button that would not move the weight.
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
      val weighing = action.type == LiveAction.ADJUST_WEIGHT

      if (weighing && reduced === stored) {
        return false
      }

      if (reduced !== stored) {
        LiveWorkoutStore.writeState(context, reduced.toJson())
      }

      LiveWorkoutNotification.ensureChannel(context, reduced, rename = false)
      post(context, reduced)
      LiveWorkoutStore.enqueue(context, action, weight = if (weighing) weightOf(reduced, action.setId) else null)
      return true
    }
  }

  /** The weight the set now has, wherever it is on the card. */
  private fun weightOf(state: LiveWorkoutState, setId: String?): Double? =
    listOfNotNull(state.exercise, state.next)
      .flatMap { it.sets }
      .firstOrNull { it.id == setId }
      ?.weight

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

    scheduleTick(context, state, view, now)
    return true
  }

  private fun scheduleTick(context: Context, state: LiveWorkoutState, view: LiveWorkoutView, now: Double) {
    worker.removeCallbacks(tick)

    val rest = view.rest
    // A count-up that is not showing yet shows 15 s after the tap.
    val countUpShowsAt = state.countUp
      ?.takeIf { view.mode == LiveMode.SET }
      ?.let { it.startedAt + LiveWorkoutDerive.COUNT_UP_GRACE_SECONDS }
      ?.takeIf { it > now }

    if (countUpShowsAt != null) {
      tickContext = context.applicationContext
      worker.postDelayed(tick, ((countUpShowsAt - now) * 1000).toLong() + REST_END_SLACK_MS)
      return
    }

    if (view.mode != LiveMode.REST || rest == null) {
      tickContext = null
      return
    }

    val untilEnd = ((rest.endsAt - now) * 1000).toLong()
    tickContext = context.applicationContext
    worker.postDelayed(tick, if (untilEnd > TICK_MS) TICK_MS else max(0L, untilEnd) + REST_END_SLACK_MS)
  }

  private fun stopTicking() {
    worker.removeCallbacks(tick)
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
