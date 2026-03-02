/**
 * Sync linked remote Supabase data into local Supabase:
 * 1) dump remote public data
 * 2) reset local db (migrations only)
 * 3) import dump into local db
 * 4) sync shot-images storage objects remote -> local
 *
 * Usage:
 *   npm run sync:prod:local
 *   pnpm sync:prod:local
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process'

const TMP_ROOT = '/tmp/shot-db-prod-sync'
const DATA_DUMP_PATH = join(TMP_ROOT, 'prod_public_data.sql')
const STORAGE_SYNC_DIR = join(TMP_ROOT, 'storage')

function run(command: string, args: string[], options: SpawnSyncOptionsWithStringEncoding = {}) {
  const stdio =
    options.stdio ??
    (typeof options.input === 'string' ? ['pipe', 'inherit', 'inherit'] : 'inherit')

  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio,
    ...options,
  })

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(' ')}`)
  }
}

function readProjectIdFromConfig() {
  const config = readFileSync('supabase/config.toml', 'utf8')
  const match = config.match(/^\s*project_id\s*=\s*"([^"]+)"/m)
  if (!match) throw new Error('Could not read project_id from supabase/config.toml')
  return match[1]
}

function ensureDir(path: string) {
  mkdirSync(path, { recursive: true })
}

function syncStorageObjects() {
  rmSync(STORAGE_SYNC_DIR, { recursive: true, force: true })
  ensureDir(STORAGE_SYNC_DIR)

  // Clear local bucket so it mirrors remote state.
  const clearLocal = spawnSync(
    'npx',
    ['supabase', '--experimental', 'storage', 'rm', '-r', 'ss:///shot-images', '--local'],
    { encoding: 'utf8', stdio: 'inherit' }
  )
  if (clearLocal.status !== 0) {
    console.warn('Local shot-images bucket could not be fully cleared; continuing with upload.')
  }

  // Download remote bucket
  run('npx', ['supabase', '--experimental', 'storage', 'cp', '-r', 'ss:///shot-images', STORAGE_SYNC_DIR])

  const downloadedBucketRoot = join(STORAGE_SYNC_DIR, 'shot-images')
  if (!existsSync(downloadedBucketRoot)) {
    throw new Error(`Expected downloaded bucket folder not found: ${downloadedBucketRoot}`)
  }

  // Upload each top-level folder to local to preserve object paths
  for (const entry of readdirSync(downloadedBucketRoot, { withFileTypes: true })) {
    const sourcePath = join(downloadedBucketRoot, entry.name)
    if (entry.isDirectory()) {
      run('npx', [
        'supabase',
        '--experimental',
        'storage',
        'cp',
        '-r',
        sourcePath,
        'ss:///shot-images',
        '--local',
      ])
    } else if (entry.isFile()) {
      run('npx', [
        'supabase',
        '--experimental',
        'storage',
        'cp',
        sourcePath,
        `ss:///shot-images/${entry.name}`,
        '--local',
      ])
    }
  }
}

function main() {
  console.log('\n[1/6] Starting local Supabase API/DB services...')
  run('npx', [
    'supabase',
    'start',
    '-x',
    'studio,postgres-meta,edge-runtime,logflare,vector,supavisor,mailpit,imgproxy',
  ])

  console.log('\n[2/6] Dumping linked remote public data...')
  ensureDir(TMP_ROOT)
  run('npx', [
    'supabase',
    'db',
    'dump',
    '--linked',
    '--data-only',
    '--schema',
    'public',
    '--use-copy',
    '--file',
    DATA_DUMP_PATH,
  ])

  console.log('\n[3/6] Resetting local DB to latest migrations...')
  run('npx', ['supabase', 'db', 'reset', '--local', '--no-seed', '--yes'])

  console.log('\n[4/6] Importing remote public data into local DB...')
  const projectId = readProjectIdFromConfig()
  const dbContainer = `supabase_db_${projectId}`
  const dumpSql = readFileSync(DATA_DUMP_PATH, 'utf8')
  run('docker', ['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres'], {
    input: dumpSql,
  })

  console.log('\n[5/6] Ensuring local storage bucket exists...')
  run('docker', [
    'exec',
    dbContainer,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-c',
    "insert into storage.buckets (id, name, public) values ('shot-images','shot-images', true) on conflict (id) do nothing;",
  ])

  console.log('\n[6/6] Syncing shot-images storage objects (remote -> local)...')
  syncStorageObjects()

  console.log('\nLocal sync complete.')
  console.log(`Data dump cached at: ${DATA_DUMP_PATH}`)
}

main()
