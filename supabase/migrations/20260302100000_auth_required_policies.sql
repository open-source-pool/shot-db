-- Require authenticated users for application data.
-- Data remains shared across authenticated users; this migration only blocks anon access.

drop policy if exists "anon_all_shots" on shots;
drop policy if exists "anon_all_tags" on tags;
drop policy if exists "anon_all_shot_tags" on shot_tags;
drop policy if exists "anon_all_shot_images" on shot_images;
drop policy if exists "anon_all_assessments" on assessments;
drop policy if exists "anon_all_sessions" on sessions;
drop policy if exists "anon_all_session_blocks" on session_blocks;
drop policy if exists "anon_all_shot_variations" on shot_variations;

drop policy if exists "authenticated_all_shots" on shots;
drop policy if exists "authenticated_all_tags" on tags;
drop policy if exists "authenticated_all_shot_tags" on shot_tags;
drop policy if exists "authenticated_all_shot_images" on shot_images;
drop policy if exists "authenticated_all_assessments" on assessments;
drop policy if exists "authenticated_all_sessions" on sessions;
drop policy if exists "authenticated_all_session_blocks" on session_blocks;
drop policy if exists "authenticated_all_shot_variations" on shot_variations;

create policy "authenticated_all_shots" on shots
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_tags" on tags
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_shot_tags" on shot_tags
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_shot_images" on shot_images
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_assessments" on assessments
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_sessions" on sessions
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_session_blocks" on session_blocks
  for all to authenticated using (true) with check (true);
create policy "authenticated_all_shot_variations" on shot_variations
  for all to authenticated using (true) with check (true);

-- Storage writes for shot uploads in the public bucket.
drop policy if exists "authenticated_insert_shot_images" on storage.objects;
drop policy if exists "authenticated_update_shot_images" on storage.objects;
drop policy if exists "authenticated_delete_shot_images" on storage.objects;

create policy "authenticated_insert_shot_images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shot-images');

create policy "authenticated_update_shot_images" on storage.objects
  for update to authenticated
  using (bucket_id = 'shot-images')
  with check (bucket_id = 'shot-images');

create policy "authenticated_delete_shot_images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shot-images');
