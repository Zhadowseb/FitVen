package expo.modules.stepsensor

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

// One reading of the step counter, taken by the system on its own schedule while
// the app is closed. It never retries: a missed reading only makes the next
// interval longer, which JS already allows for.
class StepSensorWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    val snapshot = StepSensorReader.readOnce(applicationContext)

    if (snapshot != null) {
      StepSensorStore.append(applicationContext, snapshot)
    }

    return Result.success()
  }
}
