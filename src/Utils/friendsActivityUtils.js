// Pure helpers for the Friends activity tiles: the text on the status row,
// the tile order, the music band state, and whether the band should scroll.
import { t } from "@localization";

const ACTIVITY_TILE_ORDER = {
  live: 0,
  done: 1,
  planned: 2,
  rest: 3,
};

/** live -> done -> planned -> rest, and inside a group the most recent first. */
export function sortActivityTiles(people) {
  return [...(people ?? [])].sort((left, right) => {
    const orderDelta =
      (ACTIVITY_TILE_ORDER[left?.activityState] ?? 3) -
      (ACTIVITY_TILE_ORDER[right?.activityState] ?? 3);

    if (orderDelta !== 0) {
      return orderDelta;
    }

    const leftAt = toTimestamp(left?.activityAt);
    const rightAt = toTimestamp(right?.activityAt);

    return rightAt - leftAt;
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
    default:
      return t("friends.status.noActivity");
  }
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
