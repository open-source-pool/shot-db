-- Remove 'variant' block type: reclassify existing variant blocks as reinforcement
update session_blocks set block_type = 'reinforcement' where block_type = 'variant';

-- Update check constraint to exclude 'variant'
alter table session_blocks drop constraint if exists session_blocks_block_type_check;
alter table session_blocks add constraint session_blocks_block_type_check
  check (block_type in ('warmup', 'core', 'reinforcement', 'cooldown'));
