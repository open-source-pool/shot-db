-- Per-user shot activation state.
-- Shots stay globally shared, but each authenticated user has their own
-- active/pending practice subset.

create table if not exists user_shot_statuses (
  user_id uuid not null references auth.users(id) on delete cascade,
  shot_id uuid not null references shots(id) on delete cascade,
  status text not null default 'pending' check (status in ('active', 'pending')),
  updated_at timestamptz not null default now(),
  primary key (user_id, shot_id)
);

create index if not exists idx_user_shot_statuses_user_status
  on user_shot_statuses(user_id, status);
create index if not exists idx_user_shot_statuses_shot
  on user_shot_statuses(shot_id);

alter table user_shot_statuses enable row level security;

drop policy if exists "user_owns_user_shot_statuses" on user_shot_statuses;
create policy "user_owns_user_shot_statuses" on user_shot_statuses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Backfill existing users based on the current global shot status.
insert into user_shot_statuses (user_id, shot_id, status)
select u.id, s.id, s.status
from auth.users u
cross join shots s
on conflict (user_id, shot_id) do nothing;
