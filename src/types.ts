export interface Shot {
  id: string
  slug: string
  title: string
  description: string | null
  setup_text: string | null
  status: 'active' | 'pending'
  frequency: 1 | 2 | 3
  created_at: string
  images?: ShotImage[]
  tags?: Tag[]
  latest_assessment?: Assessment | null
}

export interface ShotImage {
  id: string
  shot_id: string
  file_name: string
  storage_path: string
  side: string
  is_primary: boolean
  sort_order: number
}

export interface Tag {
  id: string
  name: string
}

export interface Assessment {
  id: string
  shot_id: string
  assessed_at: string
  comfort_level: 1 | 2 | 3 | 4
  visualization: 1 | 2 | 3 | 4
  beautiful_stroke: boolean
  alignment_correct: boolean
  result: 1 | 2
  aggregate_score: 1 | 2 | 3
  notes: string | null
}

export interface Session {
  id: string
  started_at: string
  duration_minutes: number
  notes: string | null
  blocks?: SessionBlock[]
}

export interface SessionBlock {
  id: string
  session_id: string
  shot_id: string | null
  shot_image_id: string | null
  block_type: 'warmup' | 'core' | 'variant' | 'reinforcement' | 'cooldown'
  duration_minutes: number
  attempts: number
  successes: number
  comfort_rating: 1 | 2 | 3 | 4 | null
  notes: string | null
  sort_order: number
  shot?: Shot
  shot_image?: ShotImage
}

export type FrequencyLabel = 'Low' | 'Medium' | 'High'

export const FREQUENCY_LABELS: Record<1 | 2 | 3, FrequencyLabel> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

export const COMFORT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Unfamiliar',
  2: 'Somewhat unfamiliar',
  3: 'Somewhat familiar',
  4: 'Familiar',
}
