// What a notification says and where tapping it goes - for a row on the
// notification page and for a push the phone was opened from.
//
// The server writes every title and body in English. The kinds this file has
// words for are shown in the reader's language instead; the rest are shown as
// the server wrote them. Pure, with `t` passed in, so
// scripts/test-post-like-notification.js runs it in Node.

import { workoutDisplayName } from "./workoutTypeLabel";

// Written by the server when three people have reported one of your shared
// exercises (supabase/migrations/20260928090000_custom-exercises-can-be-shared.sql).
export const CUSTOM_EXERCISE_HIDDEN = "custom_exercise_hidden";
// Written by the server when somebody likes one of your posts
// (supabase/migrations/20261009090000_a-like-notifies-the-poster.sql). The
// push from send-post-liked-notification carries the same fields as `data`,
// with this as its `type`.
export const SOCIAL_POST_LIKED = "social_post_liked";

function textOf(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dataOf(item) {
  const data = item?.data;

  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function hiddenExerciseName(item) {
  return item?.eventType === CUSTOM_EXERCISE_HIDDEN ? textOf(dataOf(item).exercise_name) : null;
}

// The post a like is about, and whose it is: the reader's own.
function likedPost(item) {
  if (item?.eventType !== SOCIAL_POST_LIKED) {
    return null;
  }

  const data = dataOf(item);
  const postId = Number(data.post_id);
  const authorId = textOf(data.author_id);

  return Number.isFinite(postId) && postId > 0 && authorId ? { postId, authorId } : null;
}

// The liker's name as the profile has it now, or as the server wrote it down
// when the author cannot read the liker's profile - somebody they do not
// follow, whose actor join comes back empty.
function likerName(item, t) {
  return (
    textOf(item?.actor?.displayName) ??
    textOf(dataOf(item).liker_name) ??
    t("notifications.postLiked.someone")
  );
}

export function describeNotification(item, t) {
  const exerciseName = hiddenExerciseName(item);

  if (exerciseName) {
    return {
      title: t("notifications.customExerciseHidden.title"),
      body: t("notifications.customExerciseHidden.body", { name: exerciseName }),
    };
  }

  if (item?.eventType === SOCIAL_POST_LIKED) {
    const data = dataOf(item);
    const postTitle = textOf(data.post_title);

    return {
      title: t("notifications.postLiked.title", { name: likerName(item, t) }),
      body: postTitle
        ? workoutDisplayName(postTitle, t, textOf(data.workout_type)) ?? postTitle
        : t("notifications.postLiked.bodyFallback"),
    };
  }

  return { title: item?.title ?? "", body: item?.body ?? "" };
}

// There is no screen for one post. A like opens your own posts with the liked
// one first - UserPostsPage, the list behind "See all" on a profile. One of
// your exercises being hidden goes to that exercise, and the rest -
// mostly somebody starting a workout - to Social, which shows that.
export function notificationTarget(item) {
  const exerciseName = hiddenExerciseName(item);

  if (exerciseName) {
    return { route: "MyExercisePage", params: { exerciseName } };
  }

  const post = likedPost(item);

  if (post) {
    return { route: "UserPostsPage", params: { userId: post.authorId, postId: post.postId } };
  }

  return { route: "SocialPage", params: undefined };
}

export function notificationHintKey(item) {
  if (hiddenExerciseName(item)) {
    return "notifications.hints.openExercise";
  }

  return likedPost(item) ? "notifications.hints.openPost" : "notifications.hints.openActivity";
}

// Where a tapped push goes beyond the notification page, which it always
// opens first. Only a like has a place of its own; every other push stops at
// the page, as before.
export function pushNotificationTarget(pushData) {
  const data = pushData && typeof pushData === "object" ? pushData : {};

  if (data.type !== SOCIAL_POST_LIKED) {
    return null;
  }

  const target = notificationTarget({ eventType: SOCIAL_POST_LIKED, data });

  return target.route === "UserPostsPage" ? target : null;
}
