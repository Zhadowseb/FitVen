package expo.modules.liveworkout

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// A button on the card. It changes the card at once, without JS, queues the
// tap for JS and wakes the module if the app is running. It runs whether or
// not the app is; when it is not, JS drains the queue at the next start.
//
// The work happens on the card's own thread (LiveWorkoutCard.inBackground),
// not the main one. goAsync keeps the broadcast - and so the process - alive
// until the tap is written to the queue.
class LiveWorkoutActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION) {
      return
    }

    val type = intent.getStringExtra(EXTRA_TYPE) ?: return

    if (type !in LiveAction.TYPES) {
      return
    }

    // The time of the tap, not of when the thread gets to it.
    val action = LiveAction(
      type = type,
      setId = intent.getStringExtra(EXTRA_SET_ID),
      seconds = if (intent.hasExtra(EXTRA_SECONDS)) intent.getIntExtra(EXTRA_SECONDS, 0).toDouble() else null,
      delta = if (intent.hasExtra(EXTRA_DELTA)) intent.getDoubleExtra(EXTRA_DELTA, 0.0) else null,
      at = System.currentTimeMillis() / 1000.0
    )
    val workoutId = intent.getStringExtra(EXTRA_WORKOUT_ID)
    val appContext = context.applicationContext
    val pending = goAsync()

    LiveWorkoutCard.inBackground {
      try {
        if (LiveWorkoutCard.handleAction(appContext, action, workoutId)) {
          LiveWorkoutModule.emitAction(type)
        }
      } finally {
        pending.finish()
      }
    }
  }

  companion object {
    const val ACTION = "expo.modules.liveworkout.ACTION"
    const val EXTRA_TYPE = "type"
    const val EXTRA_SET_ID = "setId"
    const val EXTRA_SECONDS = "seconds"
    const val EXTRA_DELTA = "delta"
    const val EXTRA_WORKOUT_ID = "workoutId"
  }
}
