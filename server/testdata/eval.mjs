// Scores both readings of a mood.js against the labelled dataset. Usage: node eval.mjs <dataset.json> <mood.js> [--list]
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const [dataPath, moodPath, flag] = process.argv.slice(2)
const { readMoods } = await import(pathToFileURL(resolve(moodPath)).href)
const data = JSON.parse(readFileSync(dataPath, 'utf8'))

// Which listener family each mood name belongs to.
const FAMILY = {
  Euphoric: 'happy', Uplifting: 'happy', Breezy: 'calm', Serene: 'calm',
  Aggressive: 'angry', 'Dark and driving': 'angry', Bittersweet: 'sad', Melancholic: 'sad', Cathartic: 'sad',
}
const familyOf = (m) => FAMILY[m.name] ?? m.family ?? `contrast:${m.name}`
// Happy and calm are both positive: calling a calm song happy is a near miss, not a failure.
const close = (label, fam) => fam === label || (['happy', 'calm'].includes(label) && ['happy', 'calm'].includes(fam))

const labels = ['sad', 'happy', 'calm', 'angry']
// A pending lyrics reading falls back to the sound reading, as the charts do.
const READINGS = { lyrics: (r) => r.lyrics ?? r.sound, sound: (r) => r.sound }

const results = Object.fromEntries(Object.keys(READINGS).map((k) => [k, { matrix: {}, exact: 0, near: 0, rows: [] }]))
let differ = 0
for (const s of data) {
  const r = readMoods(s.features, s.lyrics)
  if ((r.lyrics ?? r.sound).name !== r.sound.name) differ++
  for (const [k, pick] of Object.entries(READINGS)) {
    const res = results[k]
    const m = pick(r)
    const fam = familyOf(m)
    res.matrix[s.label] ??= {}
    res.matrix[s.label][fam] = (res.matrix[s.label][fam] ?? 0) + 1
    if (fam === s.label) res.exact++
    if (close(s.label, fam)) res.near++
    res.rows.push({ ok: close(s.label, fam), s, m, b: r.blend })
  }
}

const pctOf = (n) => Math.round((100 * n) / data.length)
for (const [k, { matrix, exact, near, rows }] of Object.entries(results)) {
  console.log(`\n== ${k === 'lyrics' ? 'Sound + lyrics' : 'Sound only'}`)
  for (const l of labels) {
    const r = matrix[l] ?? {}
    const n = Object.values(r).reduce((a, b) => a + b, 0)
    if (!n) continue
    console.log(`${l.padEnd(6)} (${String(n).padStart(2)}) →`, Object.entries(r).sort((a, b) => b[1] - a[1]).map(([f, v]) => `${f} ${v}`).join(', '))
  }
  console.log(`exact family: ${exact}/${data.length} (${pctOf(exact)}%)   happy≈calm: ${near}/${data.length} (${pctOf(near)}%)`)
  if (flag === '--list') {
    console.log('Misses:')
    for (const { s, m, b } of rows.filter((r) => !r.ok)) {
      const top = Object.entries(s.lyrics.emotions ?? {}).filter(([e]) => e !== 'neutral').sort((a, b) => b[1] - a[1]).slice(0, 2).map(([e, p]) => `${e} ${p.toFixed(2)}`).join(' ')
      console.log(`  ${s.label.padEnd(5)} ${s.name.slice(0, 26).padEnd(26)} → ${m.name.padEnd(19)} a.val ${s.features.valence.toFixed(2)} en ${s.features.energy.toFixed(2)} dn ${s.features.danceability.toFixed(2)} ac ${s.features.acousticness.toFixed(2)} ld ${s.features.loudness.toFixed(1)} | lyr ${b.lyrics?.toFixed(2) ?? ' -- '} ${top}`)
    }
  }
}
console.log(`\nThe two readings give a different mood for ${differ}/${data.length} songs.`)
