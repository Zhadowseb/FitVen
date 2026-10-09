package expo.modules.liveworkout

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import kotlin.math.max
import kotlin.math.roundToInt

// The filled part of a ring, as a bitmap for RemoteViews: an arc with round
// caps from 12 o'clock, clockwise. The track under it is the ImageView's XML
// background (live_workout_ring_track), because its colour follows the
// notification's light or dark theme, which this process cannot know. Both
// use the same stroke, inset by half of it, so they line up exactly.
internal object RingBitmap {
  fun draw(context: Context, sizeDp: Float, strokeDp: Float, fraction: Float, color: Int): Bitmap {
    val density = context.resources.displayMetrics.density
    val size = max(1, (sizeDp * density).roundToInt())
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val sweep = 360f * fraction.coerceIn(0f, 1f)

    if (sweep <= 0f) {
      return bitmap
    }

    val stroke = strokeDp * density
    val inset = stroke / 2f
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = stroke
      strokeCap = Paint.Cap.ROUND
      this.color = color
    }

    Canvas(bitmap).drawArc(RectF(inset, inset, size - inset, size - inset), -90f, sweep, false, paint)

    return bitmap
  }
}
