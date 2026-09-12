-- Self-hosted leftover cleanup PR-03: community leaves the product.
-- Drop feed tables and related policies. Keep lesson_comments and
-- other lesson comment tables (comment_flags, comment_reactions).

DROP TABLE IF EXISTS public.community_poll_votes CASCADE;
DROP TABLE IF EXISTS public.community_poll_options CASCADE;
DROP TABLE IF EXISTS public.community_flags CASCADE;
DROP TABLE IF EXISTS public.community_reactions CASCADE;
DROP TABLE IF EXISTS public.community_comments CASCADE;
DROP TABLE IF EXISTS public.community_user_mutes CASCADE;
DROP TABLE IF EXISTS public.community_posts CASCADE;

DROP FUNCTION IF EXISTS public.update_community_post_comment_count();
DROP FUNCTION IF EXISTS public.update_community_post_reaction_count();
DROP FUNCTION IF EXISTS public.check_comment_depth();

DROP POLICY IF EXISTS "Public read access for community assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload community assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own community assets" ON storage.objects;
DROP POLICY IF EXISTS "Upload community assets" ON storage.objects;
DROP POLICY IF EXISTS "Upload community assets to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own community assets" ON storage.objects;
DROP POLICY IF EXISTS "Delete own community assets" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'community-assets';
DELETE FROM storage.buckets WHERE id = 'community-assets';
