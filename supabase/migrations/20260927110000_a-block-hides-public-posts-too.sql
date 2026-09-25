-- A block hides somebody's public posts too.
--
-- Run after 20260927100000_public-profiles.sql.
--
-- 20260905143000_user-blocks.sql made a block remove the follow rows both
-- ways, which hides everything a follower can see - including posts shared
-- with "following". A post shared with everyone never asked about follows, so
-- it stayed: a blocked person's public posts went on showing in the blocker's
-- feed and in the posts from centres, and the blocker's public posts in
-- theirs. The profile page does not have the gap - public_profile checks the
-- block before it reads anything - but the feed read the table directly.
--
-- The policy from 20260921120000_hide-a-reported-post.sql, unchanged except
-- for one clause: somebody else's post is not visible across a block, either
-- way. An author always sees their own. private.blocked_between is callable
-- from a policy (execute was never revoked from it), and it is one indexed
-- lookup on user_blocks.
--
-- Until this has run, public posts still cross a block, as before. Safe to
-- run twice.

begin;

drop policy if exists "Social posts are viewable by owners and allowed audience"
  on public.social_post;

create policy "Social posts are viewable by owners and allowed audience"
on public.social_post
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    author_id = (select auth.uid())
    or (
      deleted_at is null
      and hidden_at is null
      and not private.blocked_between((select auth.uid()), public.social_post.author_id)
      and (
        visibility = 'everyone'
        or (
          visibility = 'following'
          and exists (
            select 1
            from public.user_follows follow
            where follow.follower_id = public.social_post.author_id
              and follow.following_id = (select auth.uid())
          )
        )
      )
    )
  )
);

commit;
