-- Track which shot variation (image) was practiced in each session block
-- Each shot can have multiple images representing different variations/setups

alter table session_blocks
  add column shot_image_id uuid references shot_images(id);

create index if not exists idx_session_blocks_image on session_blocks(shot_image_id);
