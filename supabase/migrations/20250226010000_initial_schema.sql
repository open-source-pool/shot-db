-- ShotDB initial schema
-- Run this in the Supabase SQL editor to create all tables

-- Shots: the core entity
create table if not exists shots (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  setup_text text,
  status text not null default 'active' check (status in ('active', 'pending')),
  frequency int not null default 2 check (frequency between 1 and 3),
  created_at timestamptz default now()
);

-- Tags
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

-- Shot-tag join table
create table if not exists shot_tags (
  shot_id uuid references shots(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (shot_id, tag_id)
);

-- Shot images (files stored in Supabase Storage, metadata here)
create table if not exists shot_images (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid references shots(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  side text default 'center',
  is_primary boolean default false,
  sort_order int default 0
);

-- Assessments: periodic skill evaluations per shot
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid references shots(id) on delete cascade,
  assessed_at timestamptz default now(),
  comfort_level int not null check (comfort_level between 1 and 4),
  visualization int not null check (visualization between 1 and 4),
  beautiful_stroke boolean not null,
  alignment_correct boolean not null,
  result int not null check (result between 1 and 2),
  aggregate_score int not null default 1,
  notes text
);

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  duration_minutes int not null default 90,
  notes text
);

-- Session blocks
create table if not exists session_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  shot_id uuid references shots(id),
  block_type text not null check (block_type in ('warmup', 'core', 'variant', 'reinforcement', 'cooldown')),
  duration_minutes int not null,
  attempts int default 0,
  successes int default 0,
  comfort_rating int check (comfort_rating between 1 and 4),
  notes text,
  sort_order int default 0
);

-- Indexes for common queries
create index if not exists idx_shots_slug on shots(slug);
create index if not exists idx_shots_status on shots(status);
create index if not exists idx_shot_images_shot on shot_images(shot_id);
create index if not exists idx_assessments_shot on assessments(shot_id);
create index if not exists idx_assessments_date on assessments(assessed_at desc);
create index if not exists idx_session_blocks_session on session_blocks(session_id);

-- Enable Row Level Security (permissive for now, no auth)
alter table shots enable row level security;
alter table tags enable row level security;
alter table shot_tags enable row level security;
alter table shot_images enable row level security;
alter table assessments enable row level security;
alter table sessions enable row level security;
alter table session_blocks enable row level security;

-- Allow all operations for anon (no auth yet)
create policy "anon_all_shots" on shots for all using (true) with check (true);
create policy "anon_all_tags" on tags for all using (true) with check (true);
create policy "anon_all_shot_tags" on shot_tags for all using (true) with check (true);
create policy "anon_all_shot_images" on shot_images for all using (true) with check (true);
create policy "anon_all_assessments" on assessments for all using (true) with check (true);
create policy "anon_all_sessions" on sessions for all using (true) with check (true);
create policy "anon_all_session_blocks" on session_blocks for all using (true) with check (true);

-- Create storage bucket for shot images (run in Storage settings or via API)
-- insert into storage.buckets (id, name, public) values ('shot-images', 'shot-images', true);
