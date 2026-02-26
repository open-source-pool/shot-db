/**
 * Seed script: reads docs/seed-data/ and populates Supabase.
 *
 * Usage:
 *   pnpm seed
 *
 * Requires .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * (or SUPABASE_SERVICE_ROLE_KEY for bypassing RLS).
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
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

const SEED_DIR = resolve(__dirname, '../docs/seed-data')
const ASSETS_DIR = join(SEED_DIR, 'assets')

interface SeedShot {
  seedId: string
  slug: string
  title: string
  description: string
  setupText: string
  status: 'active' | 'pending'
  frequency: number
  tags: string[]
  images: {
    fileName: string
    relativePath: string
    side: string
    isPrimary: boolean
  }[]
}

async function seed() {
  console.log('Reading seed data...')

  const shots: SeedShot[] = JSON.parse(
    readFileSync(join(SEED_DIR, 'shots.json'), 'utf-8')
  )
  const tags: string[] = JSON.parse(
    readFileSync(join(SEED_DIR, 'tags.json'), 'utf-8')
  )

  // 1. Ensure storage bucket exists
  console.log('Ensuring shot-images storage bucket...')
  const { error: bucketError } = await supabase.storage.createBucket(
    'shot-images',
    { public: true }
  )
  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error('Bucket error:', bucketError.message)
  }

  // 2. Insert tags
  console.log(`Inserting ${tags.length} tags...`)
  const cleanTags = tags.map((t) => t.replace(/"/g, '').replace('#', ''))
  const tagRows = cleanTags.map((name) => ({ name }))
  const { data: insertedTags, error: tagErr } = await supabase
    .from('tags')
    .upsert(tagRows, { onConflict: 'name' })
    .select()
  if (tagErr) console.error('Tag insert error:', tagErr.message)

  // Build tag name -> id map
  const { data: allTags } = await supabase.from('tags').select('id, name')
  const tagMap = new Map(allTags?.map((t) => [t.name, t.id]) ?? [])

  // 3. Insert shots
  console.log(`Inserting ${shots.length} shots...`)
  for (const shot of shots) {
    // Insert shot
    const { data: insertedShot, error: shotErr } = await supabase
      .from('shots')
      .upsert(
        {
          slug: shot.slug,
          title: shot.title,
          description: shot.description,
          setup_text: shot.setupText,
          status: shot.status,
          frequency: shot.frequency,
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .single()

    if (shotErr) {
      console.error(`Shot ${shot.slug} error:`, shotErr.message)
      continue
    }

    const shotId = insertedShot.id

    // Insert shot-tag links
    for (const rawTag of shot.tags) {
      const cleanTag = rawTag.replace(/"/g, '').replace('#', '')
      const tagId = tagMap.get(cleanTag)
      if (tagId) {
        await supabase
          .from('shot_tags')
          .upsert({ shot_id: shotId, tag_id: tagId })
      }
    }

    // Upload images and insert metadata
    for (let i = 0; i < shot.images.length; i++) {
      const img = shot.images[i]
      const localPath = join(ASSETS_DIR, img.fileName)

      if (!existsSync(localPath)) {
        console.warn(`  Image not found: ${localPath}`)
        continue
      }

      const storagePath = `${shot.slug}/${img.fileName}`
      const fileBuffer = readFileSync(localPath)

      const { error: uploadErr } = await supabase.storage
        .from('shot-images')
        .upload(storagePath, fileBuffer, {
          contentType: 'image/png',
          upsert: true,
        })

      if (uploadErr) {
        console.warn(
          `  Upload ${img.fileName}:`,
          uploadErr.message
        )
      }

      // Insert image metadata
      const { data: imgRow, error: imgErr } = await supabase.from('shot_images').upsert(
        {
          shot_id: shotId,
          file_name: img.fileName,
          storage_path: storagePath,
          side: img.side,
          is_primary: img.isPrimary,
          sort_order: i,
        },
        { onConflict: 'shot_id,file_name', ignoreDuplicates: true }
      ).select('id').single()

      let imageId: string | null = imgRow?.id ?? null

      if (imgErr) {
        // If upsert fails due to no unique constraint, try insert
        const { data: insertedImg } = await supabase.from('shot_images').insert({
          shot_id: shotId,
          file_name: img.fileName,
          storage_path: storagePath,
          side: img.side,
          is_primary: img.isPrimary,
          sort_order: i,
        }).select('id').single()
        imageId = insertedImg?.id ?? null
      }

      // Create a variation for this image
      const variationTitle = img.fileName
        .replace(/\.[^.]+$/, '')       // strip extension
        .replace(/[-_]/g, ' ')         // dashes/underscores → spaces
        .replace(/\b\w/g, (c) => c.toUpperCase()) // title case

      await supabase.from('shot_variations').insert({
        shot_id: shotId,
        title: variationTitle,
        image_id: imageId,
        is_default: img.isPrimary,
        sort_order: i,
      })
    }

    console.log(`  ✓ ${shot.slug} (${shot.images.length} images, ${shot.images.length} variations)`)
  }

  console.log('\nSeed complete!')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
