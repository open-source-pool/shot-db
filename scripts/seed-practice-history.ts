/**
 * Seed historical practice data into Supabase.
 *
 * Groups practice dates into sessions (one session per date)
 * with core blocks for each shot practiced that day.
 *
 * Usage:
 *   npx tsx scripts/seed-practice-history.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or key in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const HISTORY_PATH = resolve(__dirname, '../docs/seed-data/practice-history.json')

interface PracticeHistory {
  practices: Record<string, string[]>
}

async function seedHistory() {
  console.log('Reading practice history...')
  const history: PracticeHistory = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'))

  // Fetch all shots to map slug -> id
  const { data: shots, error: shotsErr } = await supabase
    .from('shots')
    .select('id, slug')
  if (shotsErr || !shots) {
    console.error('Failed to fetch shots:', shotsErr?.message)
    process.exit(1)
  }
  const slugToId = new Map(shots.map((s) => [s.slug, s.id]))

  // Group practices by date
  const dateMap = new Map<string, string[]>() // date -> slug[]
  for (const [slug, dates] of Object.entries(history.practices)) {
    for (const date of dates) {
      if (!dateMap.has(date)) dateMap.set(date, [])
      dateMap.get(date)!.push(slug)
    }
  }

  // Sort dates chronologically
  const sortedDates = [...dateMap.keys()].sort()
  console.log(`Found ${sortedDates.length} practice dates\n`)

  let created = 0
  const skippedSlugs = new Set<string>()

  for (const date of sortedDates) {
    const slugs = dateMap.get(date)!

    // Resolve shot IDs, track missing slugs
    const shotIds: { slug: string; id: string }[] = []
    for (const slug of slugs) {
      const id = slugToId.get(slug)
      if (id) {
        shotIds.push({ slug, id })
      } else {
        skippedSlugs.add(slug)
      }
    }

    if (shotIds.length === 0) {
      console.log(`  ${date}: no matching shots, skipping`)
      continue
    }

    // Calculate duration: 20 min warmup/cooldown + 15 min per shot
    const durationMinutes = 20 + shotIds.length * 15

    // Create session
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .insert({
        started_at: `${date}T10:00:00Z`,
        duration_minutes: durationMinutes,
        notes: 'Imported from practice log',
      })
      .select('id')
      .single()

    if (sessionErr || !session) {
      console.error(`  ${date}: session create failed:`, sessionErr?.message)
      continue
    }

    // Create blocks: warmup + core per shot + cooldown
    const blocks: Record<string, unknown>[] = []
    let sortOrder = 0

    // Warmup
    blocks.push({
      session_id: session.id,
      shot_id: null,
      block_type: 'warmup',
      duration_minutes: 10,
      attempts: 0,
      successes: 0,
      sort_order: sortOrder++,
    })

    // Core block per shot
    for (const { id } of shotIds) {
      blocks.push({
        session_id: session.id,
        shot_id: id,
        block_type: 'core',
        duration_minutes: 15,
        attempts: 0,
        successes: 0,
        sort_order: sortOrder++,
      })
    }

    // Cooldown
    blocks.push({
      session_id: session.id,
      shot_id: null,
      block_type: 'cooldown',
      duration_minutes: 10,
      attempts: 0,
      successes: 0,
      sort_order: sortOrder++,
    })

    const { error: blockErr } = await supabase
      .from('session_blocks')
      .insert(blocks)

    if (blockErr) {
      console.error(`  ${date}: block insert failed:`, blockErr.message)
      continue
    }

    console.log(`  ✓ ${date}: ${shotIds.length} shots (${shotIds.map((s) => s.slug).join(', ')})`)
    created++
  }

  console.log(`\nDone! Created ${created} sessions.`)
  if (skippedSlugs.size > 0) {
    console.log(`\nSkipped slugs (not in database): ${[...skippedSlugs].join(', ')}`)
    console.log('You may need to add these shots first.')
  }
}

seedHistory().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
