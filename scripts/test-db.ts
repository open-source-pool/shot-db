import { spawnSync, type SpawnSyncOptionsWithBufferEncoding } from 'node:child_process'
import process from 'node:process'

interface CliResult {
  status: number
  stdout: string
  stderr: string
}

function run(
  command: string,
  args: string[],
  options: SpawnSyncOptionsWithBufferEncoding = {}
): CliResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function parseEnvOutput(output: string): Record<string, string> {
  const parsed: Record<string, string> = {}

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const withoutExport = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length)
      : trimmed

    if (!withoutExport.includes('=')) continue
    const [key, ...rest] = withoutExport.split('=')
    let value = rest.join('=').trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }

  return parsed
}

function getLocalSupabaseEnv() {
  let status = run('npx', ['supabase', 'status', '-o', 'env'])

  if (status.status !== 0) {
    console.log('Local Supabase is not running. Starting it now...')
    const start = run('npx', ['supabase', 'start'], { stdio: 'inherit' })
    if (start.status !== 0) {
      throw new Error('Failed to start local Supabase. Ensure Docker is running.')
    }
    status = run('npx', ['supabase', 'status', '-o', 'env'])
  }

  if (status.status !== 0) {
    throw new Error(`Failed to read local Supabase status:\n${status.stderr || status.stdout}`)
  }

  return parseEnvOutput(status.stdout)
}

function assertSafeLocalApiUrl(rawApiUrl: string): void {
  const parsed = new URL(rawApiUrl)
  const allowedHosts = new Set(['127.0.0.1', 'localhost'])
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `Refusing to run DB tests against non-local host: ${parsed.hostname}. Expected localhost or 127.0.0.1.`
    )
  }

  if (parsed.port !== '54321') {
    throw new Error(
      `Refusing to run DB tests against unexpected API port: ${parsed.port}. Expected 54321 for local Supabase API.`
    )
  }
}

function main() {
  const envVars = getLocalSupabaseEnv()
  const apiUrl = envVars.API_URL
  const anonKey = envVars.ANON_KEY

  if (!apiUrl || !anonKey) {
    throw new Error('Missing API_URL or ANON_KEY from `supabase status -o env`.')
  }

  assertSafeLocalApiUrl(apiUrl)

  console.log('Resetting local Supabase database...')
  const reset = run('npx', ['supabase', 'db', 'reset', '--local', '--no-seed', '--yes'], {
    stdio: 'inherit',
  })
  if (reset.status !== 0) {
    throw new Error('Failed to reset local database before DB tests.')
  }

  console.log('Running DB integration tests...')
  const testRun = run(
    'npx',
    ['vitest', 'run', '--config', 'vitest.config.ts', 'tests/db/**/*.test.ts'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_SUPABASE_URL: apiUrl,
        TEST_SUPABASE_ANON_KEY: anonKey,
      },
    }
  )

  process.exit(testRun.status)
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}
