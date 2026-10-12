package expo.modules.stepsensor

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The phone's own step counter, for the days no health app has a number for.
// JS reaches it as `StepSensor`; see modules/step-sensor/index.js.
class StepSensorModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("StepSensor")

    Function("isAvailable") {
      StepSensorReader.hasSensor(context)
    }

    Function("hasPermission") {
      StepSensorReader.hasPermission(context)
    }

    // One reading now, kept with the others, or null when there is none to take.
    AsyncFunction("readNow") {
      val snapshot = StepSensorReader.readOnce(context)

      if (snapshot == null) {
        null
      } else {
        StepSensorStore.append(context, snapshot)

        mapOf(
          "time" to snapshot.time.toDouble(),
          "counter" to snapshot.counter,
          "bootTime" to snapshot.bootTime.toDouble()
        )
      }
    }

    AsyncFunction<Unit>("startRecording") {
      StepSensorWork.start(context)
    }

    AsyncFunction<Unit>("stopRecording") {
      StepSensorWork.stop(context)
    }

    AsyncFunction<Boolean>("isRecording") {
      StepSensorWork.isScheduled(context)
    }

    // The readings taken after a time (ms since 1970), as JSON, oldest first.
    AsyncFunction("readSnapshots") { afterTime: Double ->
      StepSensorStore.readAfter(context, afterTime.toLong())
    }

    AsyncFunction("trimSnapshots") { beforeTime: Double ->
      StepSensorStore.trimBefore(context, beforeTime.toLong())
    }
  }
}
