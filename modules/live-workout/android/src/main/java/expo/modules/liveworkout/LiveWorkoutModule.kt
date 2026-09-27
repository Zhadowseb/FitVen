package expo.modules.liveworkout

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

// The running strength workout on the lock screen, as an ongoing notification.
// JS reaches it as `LiveWorkout`; see modules/live-workout/index.js.
class LiveWorkoutModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LiveWorkout")

    Events(EVENT_ACTION)

    OnCreate {
      active = WeakReference(this@LiveWorkoutModule)
    }

    OnDestroy {
      if (active?.get() === this@LiveWorkoutModule) {
        active = null
      }
    }

    Function("isSupported") {
      true
    }

    AsyncFunction("start") { stateJson: String ->
      LiveWorkoutCard.start(context, stateJson)
    }

    AsyncFunction("update") { stateJson: String ->
      LiveWorkoutCard.update(context, stateJson)
    }

    AsyncFunction<Unit>("end") {
      LiveWorkoutCard.end(context)
    }

    AsyncFunction<String>("drainActions") {
      LiveWorkoutStore.drainActions(context)
    }
  }

  companion object {
    private const val EVENT_ACTION = "onLiveWorkoutAction"

    @Volatile
    private var active: WeakReference<LiveWorkoutModule>? = null

    /**
     * Wakes JS after a tap was queued, if the app is running. Only a wake-up:
     * JS processes what drainActions returns, never this payload.
     */
    internal fun emitAction(type: String) {
      val module = active?.get() ?: return

      try {
        module.sendEvent(EVENT_ACTION, mapOf("type" to type))
      } catch (error: RuntimeException) {
        // The JS runtime is going away; the tap stays queued for the next start.
      }
    }
  }
}
