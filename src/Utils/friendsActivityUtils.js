// Pure helpers for the Friends activity tiles: the text on the status row,
// the tile order, the music band state, and whether the band should scroll.
import { formatDate, t } from "@localization";
import { calendarDaysBetween, formatRelativeDay } from "./dateUtils";

const ACTIVITY_TILE_ORDER = {
  live: 0,
  done: 1,
  planned: 2,
};

const TODAY_BAND = 0;
const UPCOMING_BAND = 1;
const PAST_BAND = 2;
const EMPTY_BAND = 3;

function getTileBand(person) {
  if (ACTIVITY_TILE_ORDER[person?.activityState] !== undefined) {
    return TODAY_BAND;
  }

  if (person?.nextWorkoutAt) {
    return UPCOMING_BAND;
  }

  if (person?.lastWorkoutAt) {
    return PAST_BAND;
  }

  return EMPTY_BAND;
}

/**
 * Today first, then what is coming, then what has been.
 *
 *   1. anyone with a workout today - live, then done, then planned, and
 *      inside each the most recent first
 *   2. anyone with one planned ahead, the soonest first
 *   3. everyone else by how recently they trained, the freshest first
 *   4. anyone with no workout either side of today
 *
 * The strip is read left to right and rarely past the third tile, so the
 * people worth a glance have to be the ones that fit on screen.
 */
export function sortActivityTiles(people) {
  return [...(people ?? [])].sort((left, right) => {
    const bandDelta = getTileBand(left) - getTileBand(right);

    if (bandDelta !== 0) {
      return bandDelta;
    }

    switch (getTileBand(left)) {
      case TODAY_BAND: {
        const stateDelta =
          ACTIVITY_TILE_ORDER[left.activityState] - ACTIVITY_TILE_ORDER[right.activityState];

        return stateDelta !== 0
          ? stateDelta
          : toTimestamp(right?.activityAt) - toTimestamp(left?.activityAt);
      }
      case UPCOMING_BAND:
        return toTimestamp(left.nextWorkoutAt) - toTimestamp(right.nextWorkoutAt);
      case PAST_BAND:
        return toTimestamp(right.lastWorkoutAt) - toTimestamp(left.lastWorkoutAt);
      default:
        return 0;
    }
  });
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** "2h" / "35m" / "3d" since a moment, for the done row. */
export function formatHoursAgo(value, now = Date.now()) {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return null;
  }

  const minutes = Math.max(0, Math.round((now - timestamp) / 60000));

  if (minutes < 60) {
    return t("time.minutesShort", { count: Math.max(1, minutes) });
  }

  const hours = Math.round(minutes / 60);

  if (hours < 48) {
    return t("time.hoursShort", { count: hours });
  }

  return t("time.daysShort", { count: Math.round(hours / 24) });
}

/**
 * The status row text per state. `isCurrentUser` because the viewer's own
 * live tile says "Training now" where a friend's says how far in they are.
 */
export function buildActivityStatusLabel(person, { isCurrentUser = false, now = Date.now() } = {}) {
  const state = person?.activityState ?? "rest";
  const label = person?.workoutLabel ?? null;

  switch (state) {
    case "live":
      return isCurrentUser
        ? t("friends.status.trainingNow")
        : person?.activityDetail ?? t("friends.status.trainingNow");
    case "done": {
      const ago = formatHoursAgo(person?.activityAt, now);

      if (label && ago) {
        return `${label} · ${ago}`;
      }

      return label ?? person?.activityDetail ?? t("friends.status.doneToday");
    }
    case "planned": {
      const time = person?.plannedTime ?? null;

      if (label && time) {
        return `${label} · ${time}`;
      }

      return label
        ? t("friends.status.labelPlanned", { label })
        : person?.activityDetail ?? t("friends.status.planned");
    }
    default: {
      // Resting. "No activity" says nothing anyone can use, so the tile
      // carries whichever workout is nearest in time: the one coming, if
      // there is one, otherwise the last one done.
      if (person?.nextWorkoutAt) {
        return t("friends.status.nextWorkout", {
          date: formatWorkoutDay(person.nextWorkoutAt, now),
        });
      }

      if (person?.lastWorkoutAt) {
        return formatRelativeDay(person.lastWorkoutAt, now);
      }

      return t("friends.status.noActivity");
    }
  }
}

/**
 * The day a planned workout falls on, as short as the tile allows: tomorrow
 * by name, anything further out as a date. A weekday name would be shorter
 * still, but "Tuesday" is ambiguous once it is more than a week away.
 */
export function formatWorkoutDay(value, now = Date.now()) {
  const days = calendarDaysBetween(now, value);

  if (days === null) {
    return "";
  }

  if (days <= 0) {
    return t("time.today");
  }

  if (days === 1) {
    return t("time.tomorrow");
  }

  return formatDate(value);
}

/**
 * playing -> the band lights up; last -> quiet band with the last track;
 * none -> empty band of the same height, so the avatars line up.
 */
export function resolveMusicBandState(music, activityState) {
  if (!music?.track) {
    return "none";
  }

  if (music.state === "playing" && activityState === "live") {
    return "playing";
  }

  return "last";
}

export function formatMusicLine(music) {
  if (!music?.track) {
    return "";
  }

  return music.artist ? `${music.track} · ${music.artist}` : music.track;
}

/** A newest row under `freshnessMs` old on a live workout is "playing". */
export function classifyMusicRow(row, { activityState, now = Date.now(), freshnessMs = 90000 } = {}) {
  if (!row?.track) {
    return null;
  }

  const playedAt = toTimestamp(row.played_at ?? row.playedAt);
  const isFresh = playedAt > 0 && now - playedAt <= freshnessMs;

  return {
    track: row.track,
    artist: row.artist ?? null,
    artUrl: row.art_url ?? row.artUrl ?? null,
    provider: row.provider ?? null,
    playedAt: playedAt ? new Date(playedAt).toISOString() : null,
    state: activityState === "live" && isFresh ? "playing" : "last",
  };
}

/** The ticker only runs when the text really is wider than its box. */
export function shouldTickerScroll(textWidth, containerWidth) {
  const text = Number(textWidth);
  const container = Number(containerWidth);

  if (!Number.isFinite(text) || !Number.isFinite(container) || container <= 0) {
    return false;
  }

  return text > container + 1;
}
