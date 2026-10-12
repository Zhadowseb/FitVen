package expo.modules.stepsensor

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.core.content.ContextCompat
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

// Reads the phone's own step counter. The counter is hardware: it keeps counting
// while the app is closed and reports the steps since the phone started, so one
// reading now and one later is all it takes to know the steps in between.
internal object StepSensorReader {
  private fun manager(context: Context): SensorManager? =
    context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  /** Whether this phone has a step counter at all. */
  fun hasSensor(context: Context): Boolean =
    manager(context)?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null

  /** The step counter needs ACTIVITY_RECOGNITION from Android 10; before that it needs nothing. */
  fun hasPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(
        context.applicationContext,
        Manifest.permission.ACTIVITY_RECOGNITION
      ) == PackageManager.PERMISSION_GRANTED

  /**
   * One reading, or null when there is no sensor, no permission or no answer
   * within [timeoutMs]. A step counter reports on change and hands over its
   * latest value when somebody starts listening, so this normally returns at
   * once. It waits for the answer, so it must not run on the main thread: the
   * answer is delivered there.
   */
  fun readOnce(context: Context, timeoutMs: Long = 4000L): StepSnapshot? {
    if (!hasPermission(context)) {
      return null
    }

    val sensorManager = manager(context) ?: return null
    val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return null
    val latch = CountDownLatch(1)
    val counter = AtomicReference<Float?>(null)

    val listener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        if (event.values.isNotEmpty() && counter.compareAndSet(null, event.values[0])) {
          latch.countDown()
        }
      }

      override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }

    val registered = sensorManager.registerListener(
      listener,
      sensor,
      SensorManager.SENSOR_DELAY_NORMAL,
      Handler(Looper.getMainLooper())
    )

    if (!registered) {
      return null
    }

    try {
      latch.await(timeoutMs, TimeUnit.MILLISECONDS)
    } catch (interrupted: InterruptedException) {
      Thread.currentThread().interrupt()
    } finally {
      sensorManager.unregisterListener(listener)
    }

    val value = counter.get() ?: return null
    val now = System.currentTimeMillis()

    return StepSnapshot(
      time = now,
      counter = value.toDouble(),
      bootTime = now - SystemClock.elapsedRealtime()
    )
  }
}
