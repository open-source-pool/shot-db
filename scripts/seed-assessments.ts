/**
 * Seed assessment data from the 2025-11-11 assessment session.
 *
 * Usage:
 *   pnpm seed:assessments
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or key in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Compute the aggregate skill score from assessment dimensions.
 * Mirrors src/lib/scoring.ts computeAggregate().
 */
function computeAggregate(a: {
  comfort_level: number
  visualization: number
  beautiful_stroke: boolean
  alignment_correct: boolean
  result: number
}): 1 | 2 | 3 {
  if (a.comfort_level === 1 && a.visualization === 1) return 1
  if (!a.beautiful_stroke || !a.alignment_correct) return 2
  return a.result === 1 ? 2 : 3
}

// Comfort level mapping
const COMFORT: Record<string, number> = {
  'Unfamiliar': 1,
  'Somewhat unfamiliar': 2,
  'Somwhat unfamiliar': 2, // typo in source data
  'Somewhat familiar': 3,
  'Somwhat familiar': 3,   // typo variant
  'Familiar': 4,
}

// Result mapping
const RESULT: Record<string, number> = {
  'Good attempt': 2,
  'Not good attempt': 1,
}

interface AssessmentInput {
  slug: string
  comfort_level: string
  visualization: string
  beautiful_stroke: boolean
  alignment_correct: boolean
  result: string
  notes: string | null
  frequency: number | null // null means keep existing
}

// Assessment data from 2025-11-11
const assessmentData: AssessmentInput[] = [
  {
    slug: 'rail-blind-2-rails',
    comfort_level: 'Somwhat unfamiliar',
    visualization: 'Somwhat unfamiliar',
    beautiful_stroke: true,
    alignment_correct: true,
    result: 'Good attempt',
    notes: null,
    frequency: 1,
  },
  {
    slug: 'yoyo',
    comfort_level: 'Familiar',
    visualization: 'Somewhat familiar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Good attempt',
    notes: 'cutting to the left is fine, cutting to right alignment is wrong',
    frequency: 3,
  },
  {
    slug: 'off-angle-side',
    comfort_level: 'Unfamiliar',
    visualization: 'Unfamiliar',
    beautiful_stroke: false,  // N/A — result not applicable when comfort+viz = 1
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 2,
  },
  {
    slug: 'stun-to-center',
    comfort_level: 'Familiar',
    visualization: 'Familiar',
    beautiful_stroke: false,
    alignment_correct: true,
    result: 'Not good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'slow-roll',
    comfort_level: 'Familiar',
    visualization: 'Somwhat unfamiliar',
    beautiful_stroke: true,
    alignment_correct: true,
    result: 'Not good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'spin-off',
    comfort_level: 'Unfamiliar',
    visualization: 'Unfamiliar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 1,
  },
  {
    slug: 'thin-spin-opp-rail',
    comfort_level: 'Somewhat familiar',
    visualization: 'Somewhat familiar',
    beautiful_stroke: false,
    alignment_correct: true,
    result: 'Good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'thin-clip',
    comfort_level: 'Familiar',
    visualization: 'Familiar',
    beautiful_stroke: true,
    alignment_correct: true,
    result: 'Good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'pocket-hanger',
    comfort_level: 'Somewhat familiar',
    visualization: 'Somwhat unfamiliar',
    beautiful_stroke: true,
    alignment_correct: true,
    result: 'Not good attempt',
    notes: 'doesnt trust to hit thin enough',
    frequency: 2,
  },
  {
    slug: 'rail-clinger',
    comfort_level: 'Unfamiliar',
    visualization: 'Unfamiliar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'up-down-safe',
    comfort_level: 'Familiar',
    visualization: 'Somwhat unfamiliar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Good attempt',
    notes: 'good attempt column should appear only if previous 2 answers were a yes',
    frequency: 3,
  },
  {
    slug: 'drag-reverse-spin',
    comfort_level: 'Unfamiliar',
    visualization: 'Unfamiliar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 1,
  },
  {
    slug: 'blind-rolling-cut',
    comfort_level: 'Somwhat unfamiliar',
    visualization: 'Somewhat familiar',
    beautiful_stroke: true,
    alignment_correct: true,
    result: 'Good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: '3-rail-stun-draw',
    comfort_level: 'Familiar',
    visualization: 'Somewhat familiar',
    beautiful_stroke: true,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'follow-inside',
    comfort_level: 'Unfamiliar',
    visualization: 'Unfamiliar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'running-side-stun-center',
    comfort_level: 'Familiar',
    visualization: 'Familiar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 3,
  },
  {
    slug: 'check-side-stun-out',
    comfort_level: 'Unfamiliar',
    visualization: 'Unfamiliar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: null,
    frequency: 1,
  },
  {
    slug: 'straight-draw-extreme-side',
    comfort_level: 'Somewhat familiar',
    visualization: 'Somewhat familiar',
    beautiful_stroke: false,
    alignment_correct: false,
    result: 'Not good attempt',
    notes: 'for going up table',
    frequency: null, // not specified, keep existing
  },
]

async function seedAssessments() {
  console.log('Seeding assessment data from 2025-11-11...\n')

  // Fetch all shots to map slug -> id
  const { data: allShots, error: shotsErr } = await supabase
    .from('shots')
    .select('id, slug, frequency')

  if (shotsErr || !allShots) {
    console.error('Failed to fetch shots:', shotsErr?.message)
    process.exit(1)
  }

  const shotMap = new Map(allShots.map((s) => [s.slug, s]))

  const assessedAt = '2025-11-11T12:00:00Z'
  let inserted = 0
  let skipped = 0

  for (const entry of assessmentData) {
    const shot = shotMap.get(entry.slug)
    if (!shot) {
      console.warn(`  ⚠ Shot not found: ${entry.slug} — skipping`)
      skipped++
      continue
    }

    const comfortLevel = COMFORT[entry.comfort_level]
    const visualization = COMFORT[entry.visualization]
    const result = RESULT[entry.result]

    if (comfortLevel === undefined || visualization === undefined || result === undefined) {
      console.warn(`  ⚠ Invalid data for ${entry.slug}: comfort=${entry.comfort_level}, viz=${entry.visualization}, result=${entry.result}`)
      skipped++
      continue
    }

    const assessmentRow = {
      comfort_level: comfortLevel,
      visualization,
      beautiful_stroke: entry.beautiful_stroke,
      alignment_correct: entry.alignment_correct,
      result,
    }

    const aggregateScore = computeAggregate(assessmentRow)

    // Insert assessment
    const { error: insertErr } = await supabase.from('assessments').insert({
      shot_id: shot.id,
      assessed_at: assessedAt,
      ...assessmentRow,
      aggregate_score: aggregateScore,
      notes: entry.notes,
    })

    if (insertErr) {
      console.warn(`  ⚠ Insert error for ${entry.slug}:`, insertErr.message)
      skipped++
      continue
    }

    // Update frequency if specified
    if (entry.frequency !== null && entry.frequency !== shot.frequency) {
      await supabase
        .from('shots')
        .update({ frequency: entry.frequency })
        .eq('id', shot.id)
      console.log(`  ✓ ${entry.slug} — score ${aggregateScore}/3 (freq ${shot.frequency}→${entry.frequency})`)
    } else {
      console.log(`  ✓ ${entry.slug} — score ${aggregateScore}/3`)
    }

    inserted++
  }

  console.log(`\nDone! Inserted ${inserted} assessments, skipped ${skipped}.`)
}

seedAssessments().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
