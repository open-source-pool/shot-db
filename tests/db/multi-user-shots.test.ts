import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type ShotStatus = 'active' | 'pending'

interface TestUserClient {
  client: SupabaseClient
  userId: string
}

const url = process.env.TEST_SUPABASE_URL
const anonKey = process.env.TEST_SUPABASE_ANON_KEY

const hasDbEnv = Boolean(url && anonKey)
const describeDb = hasDbEnv ? describe : describe.skip
const supabaseUrl = url ?? 'http://127.0.0.1:54321'
const supabaseAnonKey = anonKey ?? 'missing-anon-key'

function uniqueEmail(label: string): string {
  return `shotdb-${label}-${randomUUID()}@example.com`
}

async function signUpUser(label: string): Promise<TestUserClient> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await client.auth.signUp({
    email: uniqueEmail(label),
    password: 'shotdb-test-password-123',
  })

  if (error) {
    throw new Error(`Unable to create test user ${label}: ${error.message}`)
  }

  if (!data.session || !data.user?.id) {
    throw new Error(
      `User ${label} signup did not return a session. Check local auth confirmations in supabase/config.toml.`
    )
  }

  const { error: setSessionError } = await client.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
  if (setSessionError) {
    throw new Error(`Unable to set auth session for ${label}: ${setSessionError.message}`)
  }

  return { client, userId: data.user.id }
}

async function insertShot(client: SupabaseClient, suffix: string) {
  const slug = `vitest-${suffix}-${randomUUID().slice(0, 8)}`
  const { data, error } = await client
    .from('shots')
    .insert({
      slug,
      title: `Vitest ${suffix}`,
      description: null,
      setup_text: null,
      frequency: 2,
      status: 'pending',
    })
    .select('id, slug, title')
    .single()

  if (error || !data) {
    throw new Error(`Failed to insert test shot: ${error?.message ?? 'no data returned'}`)
  }

  return data
}

async function upsertUserShotStatus(
  client: SupabaseClient,
  userId: string,
  shotId: string,
  status: ShotStatus
) {
  const { error } = await client
    .from('user_shot_statuses')
    .upsert({ user_id: userId, shot_id: shotId, status })

  if (error) {
    if (error.code === '42P01') {
      throw new Error(
        'Missing `user_shot_statuses` table. Apply the feature migration before running `pnpm test:db`.'
      )
    }
    throw new Error(`Failed to upsert user_shot_statuses: ${error.message}`)
  }
}

let userA: TestUserClient
let userB: TestUserClient

beforeAll(async () => {
  if (!hasDbEnv) {
    throw new Error('Missing TEST_SUPABASE_URL/TEST_SUPABASE_ANON_KEY. Run with `pnpm test:db`.')
  }
  userA = await signUpUser('a')
  userB = await signUpUser('b')
})

afterAll(async () => {
  if (!hasDbEnv) return
  await userA.client.auth.signOut()
  await userB.client.auth.signOut()
})

describeDb('multi-user shot behavior with local Supabase', () => {
  it('keeps shots shared across users for visibility', async () => {
    const shot = await insertShot(userA.client, 'shared-visibility')

    const { data, error } = await userB.client
      .from('shots')
      .select('id, slug, title')
      .eq('id', shot.id)
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe(shot.id)
  })

  it('allows one user to edit a shot created by another user', async () => {
    const shot = await insertShot(userA.client, 'shared-edit')
    const updatedTitle = `Updated by user B ${randomUUID().slice(0, 8)}`

    const { error: updateError } = await userB.client
      .from('shots')
      .update({ title: updatedTitle })
      .eq('id', shot.id)

    expect(updateError).toBeNull()

    const { data, error } = await userA.client
      .from('shots')
      .select('id, title')
      .eq('id', shot.id)
      .single()

    expect(error).toBeNull()
    expect(data?.title).toBe(updatedTitle)
  })

  it('keeps per-user active/pending rows isolated', async () => {
    const shot = await insertShot(userA.client, 'status-isolation')

    await upsertUserShotStatus(userA.client, userA.userId, shot.id, 'active')
    await upsertUserShotStatus(userB.client, userB.userId, shot.id, 'pending')

    const { data: aRows, error: aErr } = await userA.client
      .from('user_shot_statuses')
      .select('user_id, shot_id, status')
      .eq('shot_id', shot.id)

    const { data: bRows, error: bErr } = await userB.client
      .from('user_shot_statuses')
      .select('user_id, shot_id, status')
      .eq('shot_id', shot.id)

    expect(aErr).toBeNull()
    expect(bErr).toBeNull()
    expect(aRows).toHaveLength(1)
    expect(bRows).toHaveLength(1)
    expect(aRows?.[0].user_id).toBe(userA.userId)
    expect(aRows?.[0].status).toBe('active')
    expect(bRows?.[0].user_id).toBe(userB.userId)
    expect(bRows?.[0].status).toBe('pending')
  })

  it('prevents cross-user reads and writes on user_shot_statuses', async () => {
    const shotWithBStatus = await insertShot(userA.client, 'cross-read')
    await upsertUserShotStatus(
      userB.client,
      userB.userId,
      shotWithBStatus.id,
      'active'
    )

    const { data: aViewOfB, error: aReadErr } = await userA.client
      .from('user_shot_statuses')
      .select('user_id, shot_id, status')
      .eq('user_id', userB.userId)
      .eq('shot_id', shotWithBStatus.id)

    expect(aReadErr).toBeNull()
    expect(aViewOfB).toHaveLength(0)

    const shotForUnauthorizedInsert = await insertShot(userA.client, 'cross-write')
    const { error: insertErr } = await userA.client
      .from('user_shot_statuses')
      .insert({
        user_id: userB.userId,
        shot_id: shotForUnauthorizedInsert.id,
        status: 'active',
      })

    expect(insertErr).not.toBeNull()
  })
})
