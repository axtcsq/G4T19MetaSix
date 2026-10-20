import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const temp = resolve('node_modules/.cache/spotify-tests')
mkdirSync(temp, { recursive: true })
const result = spawnSync(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'src/__tests__/Spotify.spec.js',
    'src/__tests__/ListeningRoom.spec.js',
  ],
  { stdio: 'inherit', env: { ...process.env, TEMP: temp, TMP: temp } },
)
process.exit(result.status ?? 1)
