# ShotDB

A pool/billiards training app for tracking shots, planning practice sessions with spaced repetition, and reviewing performance over time.

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Supabase** (Postgres, Storage, Row-Level Security)
- **React Router v7**
- Deployed to **GitHub Pages** at `/shot-db/`

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- A [Supabase](https://supabase.com/) project

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/shot-db.git
cd shot-db
pnpm install
```

### 2. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

| Variable | Required | Where to find it |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase Dashboard > Settings > API |
| `SUPABASE_ACCESS_TOKEN` | For CLI | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | For seeding | Supabase Dashboard > Settings > API |

### 3. Set up the database

Initialize the Supabase CLI link (one-time):

```bash
npx supabase link --project-ref <your-project-ref>
```

Push all migrations to your database:

```bash
pnpm db:push
```

### 4. Enable auth (GitHub OAuth)

In Supabase Dashboard:

1. Go to **Authentication > Providers** and enable **GitHub**.
2. Add your app URLs to **Authentication > URL Configuration** redirect allow list:
   - `http://localhost:5173/shot-db/`
   - `https://<your-gh-username>.github.io/shot-db/`
3. Run latest migrations so `sessions` and `assessments` are user-scoped via RLS.

### 5. Seed data (optional)

Place shot images in `docs/seed-data/assets/` and ensure `docs/seed-data/shots.json` and `docs/seed-data/tags.json` exist, then run in order:

```bash
pnpm seed                # Shots, tags, images, and variations
pnpm seed:assessments    # Assessment scores
pnpm seed:history        # Historical practice sessions
```

The history seed reads `docs/seed-data/practice-history.json` which maps shot slugs to dates practiced. It groups all shots on the same date into one session with core blocks. Slugs not found in the database are skipped and reported.

### 6. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:5173/shot-db/](http://localhost:5173/shot-db/)

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Push pending migrations to remote Supabase DB |
| `pnpm db:migrate <name>` | Create a new migration file |
| `pnpm db:status` | Show local vs remote migration status |
| `pnpm seed` | Seed shots, tags, and images |
| `pnpm seed:assessments` | Seed assessment scores |
| `pnpm seed:history` | Seed historical practice sessions |

## Database Migrations

Migrations live in `supabase/migrations/` using the Supabase CLI timestamp format (`YYYYMMDDHHMMSS_name.sql`).

To create a new migration:

```bash
pnpm db:migrate my_change_name
```

This creates an empty `.sql` file in `supabase/migrations/`. Write your SQL, then push:

```bash
pnpm db:push
```

To check which migrations have been applied:

```bash
pnpm db:status
```

## Project Structure

```
src/
  components/     # Reusable UI components (ShotCard, ImageUpload, etc.)
  hooks/          # React hooks for Supabase data (useShots, useSession, etc.)
  lib/            # Utilities (supabase client, scoring, session planner, variations)
  pages/          # Route-level page components
  types.ts        # TypeScript interfaces
supabase/
  config.toml     # Supabase CLI config
  migrations/     # SQL migration files
scripts/          # Seed scripts
docs/             # Specs and seed data
```
