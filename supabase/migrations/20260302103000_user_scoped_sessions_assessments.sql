-- Keep shots global, but scope sessions/assessments to each authenticated user.

alter table sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

alter table assessments
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_assessments_user_id on assessments(user_id);

drop policy if exists "anon_all_sessions" on sessions;
drop policy if exists "authenticated_all_sessions" on sessions;
drop policy if exists "user_owns_sessions" on sessions;

drop policy if exists "anon_all_assessments" on assessments;
drop policy if exists "authenticated_all_assessments" on assessments;
drop policy if exists "user_owns_assessments" on assessments;

drop policy if exists "anon_all_session_blocks" on session_blocks;
drop policy if exists "authenticated_all_session_blocks" on session_blocks;
drop policy if exists "user_owns_session_blocks" on session_blocks;

create policy "user_owns_sessions" on sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_owns_assessments" on assessments
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_owns_session_blocks" on session_blocks
  for all to authenticated
  using (
    exists (
      select 1
      from sessions s
      where s.id = session_blocks.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from sessions s
      where s.id = session_blocks.session_id
        and s.user_id = auth.uid()
    )
  );
