import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// .env.local provides DATABASE_URL for the integration tests (schema
// bootstrap, booking claim race). Without it those suites skip.
const env: Record<string, string> = {}
try {
  for (const line of readFileSync(new URL('./.env.local', import.meta.url), 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
} catch {
  // no .env.local — integration tests skip
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
