-- Lets a signed-in user read any avatar through the authenticated endpoint.
--
-- Until now the app read avatars with getPublicUrl(), which only works on a
-- public bucket - and a public bucket serves every object without
-- authentication, so the four policies below never applied to reads at all.
-- The path is `<user-uuid>/avatar`, every user id is readable by anyone with an
-- account, and the URL never expires.
--
-- The app now asks for signed URLs instead. Signing goes through the storage
-- policies, and the existing SELECT policy only lets a user read their own
-- folder - so without this, every avatar but your own would fail to load.
--
-- RUN THIS FIRST, BEFORE the bucket is made private. It has no effect while the
-- bucket is still public, so it is safe to run at any time.
--
--   1. Run this file.
--   2. Ship the app version that asks for signed URLs (0.21.12 or later).
--   3. Once that version is out, set the `avatars` bucket to Private in
--      Supabase -> Storage -> Buckets.
--
-- Doing step 3 first would break avatars in every installed copy of the app.

drop policy if exists "Authenticated users can read avatar objects" on storage.objects;
create policy "Authenticated users can read avatar objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
);

-- The own-folder policy is now redundant for reads, but writing is still
-- restricted to your own folder by the insert, update and delete policies in
-- supabase/migrations/20260424004053_social-search.sql. Left in place: it does no harm, and dropping
-- it is a separate decision.
