-- Shot variations: user-defined variations of a shot, decoupled from images
create table if not exists shot_variations (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references shots(id) on delete cascade,
  title text not null,
  setup_note text,
  image_id uuid references shot_images(id) on delete set null,
  is_default boolean not null default false,
  sort_order int not null default 0
);

create index if not exists idx_shot_variations_shot on shot_variations(shot_id);
create index if not exists idx_shot_variations_image on shot_variations(image_id);

-- RLS: permissive for now (same pattern as other tables)
alter table shot_variations enable row level security;
create policy "anon_all_shot_variations" on shot_variations for all using (true) with check (true);

-- Migrate existing data: one variation per existing shot_image
insert into shot_variations (shot_id, title, image_id, is_default, sort_order)
select
  si.shot_id,
  regexp_replace(si.file_name, '\.[^.]+$', ''),  -- strip file extension for title
  si.id,
  si.is_primary,
  si.sort_order
from shot_images si;

-- Add shot_variation_id to session_blocks for tracking which variation was practiced
alter table session_blocks
  add column if not exists shot_variation_id uuid references shot_variations(id);

create index if not exists idx_session_blocks_variation on session_blocks(shot_variation_id);

-- Backfill shot_variation_id from existing shot_image_id
update session_blocks sb
set shot_variation_id = sv.id
from shot_variations sv
where sb.shot_image_id = sv.image_id
  and sb.shot_image_id is not null;
