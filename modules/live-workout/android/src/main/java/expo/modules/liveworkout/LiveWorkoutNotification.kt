package expo.modules.liveworkout

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlin.math.max
import kotlin.math.roundToInt

// The card as an ongoing notification (spec §4, 1e and 1f, as changed by
// "Låseskærm Android runde 2"): the system draws the header, and these
// RemoteViews draw the rest. Every word comes from `state.strings`.
//
// SystemUI can reapply a new RemoteViews onto the views it already inflated
// for the same layout, so every post sets every view's text, visibility and
// children again rather than relying on the layout's defaults.
internal object LiveWorkoutNotification {
  const val CHANNEL_ID = "workout_live"
  const val NOTIFICATION_ID = 0x4C57

  private const val ORANGE = 0xFFF7742E.toInt()
  private const val MAX_WORKOUT_SECONDS = 8 * 60 * 60.0
  private const val MIN_TIMEOUT_MS = 60_000L
  private const val ADJUST_SECONDS = 15

  // A distinct request code per PendingIntent, so no two share extras.
  private const val REQUEST_OPEN = 0x4C50
  private const val REQUEST_COMPLETE = REQUEST_OPEN + 1
  private const val REQUEST_MINUS = REQUEST_OPEN + 4
  private const val REQUEST_PLUS = REQUEST_OPEN + 5
  private const val REQUEST_SKIP = REQUEST_OPEN + 6
  // Not the 2 and 3 Forrige / Næste had: a card posted by an older build
  // still carries those.
  private const val REQUEST_WEIGHT_MINUS = REQUEST_OPEN + 7
  private const val REQUEST_WEIGHT_PLUS = REQUEST_OPEN + 8

  // U+2212, the typographic minus, not a hyphen.
  private const val MINUS_SIGN = "\u2212"

  private const val RING_DP = 52f
  private const val RING_STROKE_DP = 4f
  private const val BAR_MAX = 1000

  /**
   * Creates the channel, or renames it to `strings.channelName`. `rename`
   * false only creates it when it is missing.
   */
  fun ensureChannel(context: Context, state: LiveWorkoutState, rename: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = context.getSystemService(NotificationManager::class.java) ?: return

    if (!rename && manager.getNotificationChannel(CHANNEL_ID) != null) {
      return
    }

    val name = state.string("channelName").ifBlank {
      context.applicationInfo.loadLabel(context.packageManager).toString()
    }
    val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      enableLights(false)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }

    manager.createNotificationChannel(channel)
  }

  /** Whether a post will be shown: the permission, the app's switch and the channel's. */
  fun canPost(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return false
    }

    val compat = NotificationManagerCompat.from(context)

    if (!compat.areNotificationsEnabled()) {
      return false
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = context.getSystemService(NotificationManager::class.java)?.getNotificationChannel(CHANNEL_ID)

      if (channel != null && channel.importance == NotificationManager.IMPORTANCE_NONE) {
        return false
      }
    }

    return true
  }

  /** Whether the card is on screen, i.e. not swiped away and not timed out. */
  fun isShowing(context: Context): Boolean {
    return try {
      context.getSystemService(NotificationManager::class.java)
        ?.activeNotifications
        ?.any { it.id == NOTIFICATION_ID }
        ?: true
    } catch (error: RuntimeException) {
      true
    }
  }

  fun build(context: Context, state: LiveWorkoutState, view: LiveWorkoutView, now: Double): Notification {
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setColor(ORANGE)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setAutoCancel(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      // What a screen reader, a watch or a phone without custom views gets.
      .setContentTitle(view.title)
      .setContentText(view.subtitle)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(collapsed(context, state, view))
      .setCustomBigContentView(expanded(context, state, view))
      .setTimeoutAfter(
        max(MIN_TIMEOUT_MS, ((state.startedAt + MAX_WORKOUT_SECONDS - now) * 1000).toLong())
      )

    openApp(context)?.let(builder::setContentIntent)

    val rest = view.rest

    when {
      view.mode == LiveMode.REST && rest != null -> builder
        .setSubText(state.string("restSub"))
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setWhen(millis(rest.endsAt))

      state.pausedElapsed == null -> builder
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(false)
        .setWhen(millis(state.startedAt))

      // A paused workout clock stands still: no chronometer and no time of
      // day, only the time it stopped at.
      else -> builder
        .setShowWhen(false)
        .setUsesChronometer(false)
        .setSubText(LiveWorkoutDerive.clock(state.pausedElapsed))
    }

    return builder.build()
  }

  // ---- Collapsed (48 dp): ring, two lines, one round button ----

  private fun collapsed(context: Context, state: LiveWorkoutState, view: LiveWorkoutView): RemoteViews {
    val rest = view.rest?.takeIf { view.mode == LiveMode.REST }

    if (rest != null) {
      // 1f: the content area is orange for what is left of the rest.
      val views = RemoteViews(context.packageName, R.layout.live_workout_collapsed_rest)
      views.setProgressBar(
        R.id.live_workout_rest_fill,
        BAR_MAX,
        if (animationsOff(context)) BAR_MAX else (rest.fraction * BAR_MAX).roundToInt(),
        false
      )
      views.setChronometer(
        R.id.live_workout_rest_clock,
        elapsedRealtimeOf(rest.endsAt),
        chronometerFormat(state.string("restClock")),
        true
      )
      views.setChronometerCountDown(R.id.live_workout_rest_clock, true)
      views.setTextViewText(R.id.live_workout_subtitle, view.title)
      views.setOnClickPendingIntent(R.id.live_workout_primary, action(context, state, REQUEST_SKIP, LiveAction.SKIP_REST))
      views.setContentDescription(R.id.live_workout_primary, state.string("skip"))
      return views
    }

    // 1e: no ring; the set, where it is, and Sæt færdigt.
    val views = RemoteViews(context.packageName, R.layout.live_workout_collapsed)
    val active = view.mode == LiveMode.SET

    views.setViewVisibility(R.id.live_workout_subtitle, visibleIf(active))
    views.setViewVisibility(R.id.live_workout_primary, visibleIf(active))
    views.setTextViewText(R.id.live_workout_title, if (active) view.nowText else view.title)
    views.setTextViewText(R.id.live_workout_subtitle, view.subtitleShort)

    if (active) {
      views.setOnClickPendingIntent(
        R.id.live_workout_primary,
        action(context, state, REQUEST_COMPLETE, LiveAction.COMPLETE_SET, setId = view.nowSetId)
      )
      views.setContentDescription(R.id.live_workout_primary, state.string("complete"))
    }

    return views
  }

  // ---- Expanded (under 252 dp): content row, two rows, buttons ----

  /**
   * One layout for 1e and 1f. A post of one can be reapplied onto the views
   * inflated for the other, so every part of both modes is shown, hidden or
   * stopped here.
   */
  private fun expanded(context: Context, state: LiveWorkoutState, view: LiveWorkoutView): RemoteViews {
    val rest = view.rest?.takeIf { view.mode == LiveMode.REST }
    val resting = rest != null
    val setting = view.mode == LiveMode.SET
    val active = setting || resting
    val views = RemoteViews(context.packageName, R.layout.live_workout_expanded)

    // Content row: the eyebrow, the set (in 1f the one after the rest), its
    // exercise, and the rings SÆT and ØVELSE.
    views.setViewVisibility(R.id.live_workout_eyebrow, visibleIf(active))
    views.setViewVisibility(R.id.live_workout_subtitle, visibleIf(active))
    views.setViewVisibility(R.id.live_workout_rings, visibleIf(active))
    views.setTextViewText(R.id.live_workout_eyebrow, view.eyebrow)
    views.setTextViewText(R.id.live_workout_title, if (active) view.nowText else view.title)
    views.setTextViewText(R.id.live_workout_subtitle, view.exerciseName)

    view.setsRing?.let {
      bindRing(
        context,
        views,
        R.id.live_workout_ring_sets_fill,
        R.id.live_workout_ring_sets_text,
        R.id.live_workout_ring_sets_label,
        it,
        it.currentText ?: it.text
      )
    }
    view.exerciseRing?.let {
      bindRing(
        context,
        views,
        R.id.live_workout_ring_exercise_fill,
        R.id.live_workout_ring_exercise_text,
        R.id.live_workout_ring_exercise_label,
        it,
        it.text
      )
    }

    // Row 1, 1e: the current exercise's sets.
    views.setViewVisibility(R.id.live_workout_row_current, visibleIf(setting))
    views.setTextViewText(R.id.live_workout_row_current_label, view.exerciseName)
    bindChips(context, views, R.id.live_workout_chips_current, if (setting) view.chips else emptyList())

    // Row 1, 1f: the rest. Its countdown is stopped while it is hidden.
    views.setViewVisibility(R.id.live_workout_row_rest, visibleIf(resting))
    views.setTextViewText(R.id.live_workout_rest_label, state.string("pause"))
    views.setTextViewText(R.id.live_workout_rest_of, rest?.of ?: "")
    views.setChronometer(
      R.id.live_workout_rest_clock,
      rest?.let { elapsedRealtimeOf(it.endsAt) } ?: SystemClock.elapsedRealtime(),
      null,
      resting
    )
    views.setChronometerCountDown(R.id.live_workout_rest_clock, true)
    views.setProgressBar(
      R.id.live_workout_rest_bar,
      BAR_MAX,
      rest?.let { (it.fraction * BAR_MAX).roundToInt() } ?: 0,
      false
    )

    // Row 2: the next exercise, in both modes.
    val nextRow = view.nextRow
    views.setViewVisibility(R.id.live_workout_row_next, visibleIf(active && nextRow != null))
    views.setTextViewText(R.id.live_workout_row_next_label, nextRow?.label ?: "")
    bindChips(context, views, R.id.live_workout_chips_next, if (active) nextRow?.chips.orEmpty() else emptyList())

    bindSetButtons(context, state, view, views, setting)
    bindRestButtons(context, state, views, resting)

    return views
  }

  /**
   * 1e: −step · Sæt færdigt · +step. A set without a weight has no weight
   * buttons, and Sæt færdigt takes the row.
   */
  private fun bindSetButtons(
    context: Context,
    state: LiveWorkoutState,
    view: LiveWorkoutView,
    views: RemoteViews,
    shown: Boolean
  ) {
    val weight = view.weightButtons?.takeIf { shown }

    views.setViewVisibility(R.id.live_workout_buttons, visibleIf(shown))
    views.setViewVisibility(R.id.live_workout_weight_minus, visibleIf(weight != null && weight.minusEnabled))
    views.setViewVisibility(R.id.live_workout_weight_minus_off, visibleIf(weight != null && !weight.minusEnabled))
    views.setViewVisibility(R.id.live_workout_weight_plus, visibleIf(weight != null))
    views.setTextViewText(R.id.live_workout_complete_text, state.string("complete"))

    for (id in intArrayOf(R.id.live_workout_weight_minus_sign, R.id.live_workout_weight_minus_off_sign)) {
      views.setTextViewText(id, MINUS_SIGN)
    }
    views.setTextViewText(R.id.live_workout_weight_plus_sign, "+")

    for (id in intArrayOf(
      R.id.live_workout_weight_minus_text,
      R.id.live_workout_weight_minus_off_text,
      R.id.live_workout_weight_plus_text
    )) {
      views.setTextViewText(id, weight?.label ?: "")
    }

    views.setContentDescription(R.id.live_workout_weight_minus, weight?.a11yMinus ?: "")
    views.setContentDescription(R.id.live_workout_weight_minus_off, weight?.a11yMinus ?: "")
    views.setContentDescription(R.id.live_workout_weight_plus, weight?.a11yPlus ?: "")

    if (shown) {
      views.setOnClickPendingIntent(
        R.id.live_workout_complete,
        action(context, state, REQUEST_COMPLETE, LiveAction.COMPLETE_SET, setId = view.nowSetId)
      )
    }

    if (weight != null) {
      // Each its own request code: with one, Android would hand minus the
      // plus intent's extras.
      views.setOnClickPendingIntent(
        R.id.live_workout_weight_minus,
        action(context, state, REQUEST_WEIGHT_MINUS, LiveAction.ADJUST_WEIGHT, setId = view.nowSetId, delta = -weight.step)
      )
      views.setOnClickPendingIntent(
        R.id.live_workout_weight_plus,
        action(context, state, REQUEST_WEIGHT_PLUS, LiveAction.ADJUST_WEIGHT, setId = view.nowSetId, delta = weight.step)
      )
    }
  }

  /** 1f: −15 s · Spring over · +15 s. */
  private fun bindRestButtons(context: Context, state: LiveWorkoutState, views: RemoteViews, shown: Boolean) {
    views.setViewVisibility(R.id.live_workout_rest_buttons, visibleIf(shown))
    views.setTextViewText(R.id.live_workout_minus_text, "${MINUS_SIGN}15 s")
    views.setTextViewText(R.id.live_workout_skip_text, state.string("skip"))
    views.setTextViewText(R.id.live_workout_plus_text, "+15 s")

    if (shown) {
      views.setOnClickPendingIntent(
        R.id.live_workout_minus,
        action(context, state, REQUEST_MINUS, LiveAction.ADJUST_REST, seconds = -ADJUST_SECONDS)
      )
      views.setOnClickPendingIntent(R.id.live_workout_skip, action(context, state, REQUEST_SKIP, LiveAction.SKIP_REST))
      views.setOnClickPendingIntent(
        R.id.live_workout_plus,
        action(context, state, REQUEST_PLUS, LiveAction.ADJUST_REST, seconds = ADJUST_SECONDS)
      )
    }
  }

  private fun bindRing(
    context: Context,
    views: RemoteViews,
    fillId: Int,
    textId: Int,
    labelId: Int,
    ring: LiveRing,
    text: String
  ) {
    views.setImageViewBitmap(fillId, RingBitmap.draw(context, RING_DP, RING_STROKE_DP, ring.fraction, ORANGE))
    views.setTextViewText(textId, text)
    views.setTextViewText(labelId, ring.label)
  }

  private fun bindChips(context: Context, views: RemoteViews, containerId: Int, chips: List<LiveChip>) {
    views.removeAllViews(containerId)

    for (chip in chips) {
      val layout = when (chip.state) {
        ChipState.DONE -> R.layout.live_workout_chip_done
        ChipState.NOW -> R.layout.live_workout_chip_now
        ChipState.TODO -> R.layout.live_workout_chip_todo
      }
      val chipViews = RemoteViews(context.packageName, layout)
      chipViews.setTextViewText(R.id.live_workout_chip_text, chip.text)
      views.addView(containerId, chipViews)
    }
  }

  // ---- Intents ----

  private fun action(
    context: Context,
    state: LiveWorkoutState,
    requestCode: Int,
    type: String,
    setId: String? = null,
    seconds: Int? = null,
    delta: Double? = null
  ): PendingIntent {
    val intent = Intent(context, LiveWorkoutActionReceiver::class.java)
      .setAction(LiveWorkoutActionReceiver.ACTION)
      .putExtra(LiveWorkoutActionReceiver.EXTRA_TYPE, type)
      .putExtra(LiveWorkoutActionReceiver.EXTRA_WORKOUT_ID, state.workoutId)

    setId?.let { intent.putExtra(LiveWorkoutActionReceiver.EXTRA_SET_ID, it) }
    seconds?.let { intent.putExtra(LiveWorkoutActionReceiver.EXTRA_SECONDS, it) }
    delta?.let { intent.putExtra(LiveWorkoutActionReceiver.EXTRA_DELTA, it) }

    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  /** The card body opens the app where it was, as its launcher icon does. */
  private fun openApp(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null

    return PendingIntent.getActivity(
      context,
      REQUEST_OPEN,
      launch,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  // ---- Helpers ----

  /** The icon the expo-notifications plugin generates, or the app's own. */
  private fun smallIcon(context: Context): Int {
    val generated = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)

    return if (generated != 0) generated else context.applicationInfo.icon
  }

  /** A Chronometer's base is on the elapsedRealtime clock, not the wall clock. */
  private fun elapsedRealtimeOf(unixSeconds: Double): Long =
    SystemClock.elapsedRealtime() + (millis(unixSeconds) - System.currentTimeMillis())

  /**
   * Whether the phone asks for no animation: then the collapsed rest stays
   * full orange instead of drawing back.
   */
  private fun animationsOff(context: Context): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

  /** "Pause · {time}" as a Chronometer format, "Pause · %s". */
  private fun chronometerFormat(template: String): String? =
    if (template.contains("{time}")) template.replace("%", "%%").replace("{time}", "%s") else null

  private fun millis(unixSeconds: Double): Long = (unixSeconds * 1000).toLong()

  private fun visibleIf(visible: Boolean): Int = if (visible) View.VISIBLE else View.GONE
}
