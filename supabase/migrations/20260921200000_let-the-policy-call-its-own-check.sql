-- The read policy on lift-videos has to be allowed to call its own check.
--
-- Run after 20260921190000_one-verification-request-per-window.sql.
--
-- 20260921140000 put `private.can_watch_lift_video` behind the select policy on
-- `storage.objects` and, in the same breath, revoked execute on it from
-- `authenticated`. A policy expression is evaluated as the querying user, not
-- as the policy's owner - `security definer` governs what the body may read,
-- not who may call it - so every signed-in read of `storage.objects` failed
-- with "permission denied for function can_watch_lift_video".
--
-- Not just lift videos. The policy is on the whole table, so avatar signing
-- went with it: the Friends tiles lost their pictures, `getCirclePreview`
-- failed, and every friend's tile said "no activity".
--
-- The revokes were copied from `private.contains_blocked_term`, which is
-- correct there because that one is called from a trigger, and a trigger does
-- not check execute. This one is called from a policy, which does.

begin;

grant execute on function private.can_watch_lift_video(text) to authenticated;

commit;
