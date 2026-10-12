package expo.modules.stepsensor

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

// The periodic read: every fifteen minutes, which is the shortest WorkManager
// allows, at the system's convenience. It keeps its schedule across restarts.
internal object StepSensorWork {
  private const val NAME = "fitven-step-sensor"

  fun start(context: Context) {
    val request = PeriodicWorkRequest.Builder(
      StepSensorWorker::class.java,
      15,
      TimeUnit.MINUTES
    ).build()

    // KEEP: asking again while it is scheduled changes nothing.
    WorkManager.getInstance(context.applicationContext)
      .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
  }

  fun stop(context: Context) {
    WorkManager.getInstance(context.applicationContext).cancelUniqueWork(NAME)
  }

  fun isScheduled(context: Context): Boolean {
    val infos = WorkManager.getInstance(context.applicationContext)
      .getWorkInfosForUniqueWork(NAME)
      .get()

    return infos.any { it.state == WorkInfo.State.ENQUEUED || it.state == WorkInfo.State.RUNNING }
  }
}
