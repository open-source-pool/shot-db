# Seed Data Bundle

This folder contains cleaned manual seed data extracted from Obsidian shot notes.

## Contents
- `manifest.json`: source metadata and record counts.
- `users.json`: seed users.
- `shots.json`: canonical shot records for import.
- `tags.json`: normalized tag list.
- `assets/`: shot image files referenced by `shots.json`.

## Notes
- `shots.json.images[].relativePath` points to files in `assets/`.
- `status` is normalized to `active` or `pending`.
- `frequency` is normalized to numeric values: `1=low`, `2=medium`, `3=high`.
