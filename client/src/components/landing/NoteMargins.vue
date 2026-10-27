<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Wavy lines with music notes drifting up them, drawn in the empty space
// either side of the landing page. The notes jolt away from the mouse and the
// lines twang when it sweeps across them. Clicking a note, or plucking a line
// once sound is on, plays a soft tone.
const canvas = ref(null)

const GLYPHS = ['♪', '♫', '♩', '♬']
const LINE_SPOTS = [0.28, 0.5, 0.72] // across each side's empty space
const NOTES_PER_LINE = 3
const MIN_GUTTER = 70 // narrower than this and the notes would crowd the page
const REACH = 80 // how close the mouse has to be to bump a note
// Notes loop through a little more than the visible height, so they slide in
// and out past the edges. All move at one speed, so the gaps never close.
const LOOP = 1.08
const SPEED = 0.03
const HIT = 24 // how close a click has to be to play a note
// C major pentatonic over two octaves, so any mix of notes sounds pleasant.
// Each line gets its own run of the scale, lower on the left.
const SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880]

let context
let frame
let lastTime = 0
let clock = 0
let width = 0
let height = 0
let reduceMotion = false
const lines = []
const notes = []
let audio
let pointerShown = false

// Browsers only allow sound after a click or tap, so the audio starts on the
// first one anywhere on the page.
function startAudio() {
  if (audio) return audio.resume()
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  audio = new AudioContext()
}

// A short bell-like tone: a triangle wave with a quiet octave above it,
// fading out over about a second.
function playTone(frequency, volume = 0.12) {
  if (!audio || audio.state !== 'running') return
  const now = audio.currentTime
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(volume, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)
  gain.connect(audio.destination)
  for (const [type, multiple, level] of [
    ['triangle', 1, 1],
    ['sine', 2, 0.3],
  ]) {
    const oscillator = audio.createOscillator()
    const partial = audio.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency * multiple
    partial.gain.value = level
    oscillator.connect(partial).connect(gain)
    oscillator.start(now)
    oscillator.stop(now + 1.2)
  }
}

// Left lines are lower, right lines higher, and higher up the line is higher.
function pitchFor(line, y) {
  const lineIndex = lines.indexOf(line)
  const upward = 1 - Math.min(1, Math.max(0, y / height))
  return SCALE[Math.min(SCALE.length - 1, Math.floor(lineIndex * 1.2 + upward * 4))]
}

function setUp() {
  for (const side of [0, 1]) {
    LINE_SPOTS.forEach((spot, index) => {
      const line = {
        side,
        spot,
        phase: Math.random() * Math.PI * 2,
        pluck: 0,
        pluckSpeed: 0,
        pluckY: 0,
      }
      lines.push(line)
      for (let n = 0; n < NOTES_PER_LINE; n += 1) {
        notes.push({
          line,
          // Evenly spaced along the line, and staggered from the lines beside
          // it, so no two notes sit on top of each other.
          y: ((n + (index + side * 0.5) / LINE_SPOTS.length) / NOTES_PER_LINE) * LOOP - 0.04,
          glyph: GLYPHS[(index + n + side) % GLYPHS.length],
          size: 26 + Math.random() * 10,
          dx: 0,
          dy: 0,
          vx: 0,
          vy: 0,
          angle: 0,
          spin: 0,
          bump: 0,
        })
      }
    })
  }
}

function resize() {
  const ratio = window.devicePixelRatio || 1
  width = window.innerWidth
  height = window.innerHeight
  canvas.value.width = width * ratio
  canvas.value.height = height * ratio
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  if (reduceMotion) draw()
}

// The empty space beside the page, and the part of the screen between the nav
// and the footer, worked out fresh each frame since both move on scroll.
function layout() {
  const shell = document.querySelector('.landing-shell')
  if (!shell) return null
  const gutter = shell.getBoundingClientRect().left
  if (gutter < MIN_GUTTER) return null
  const top = Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom ?? 0)
  const bottom = Math.min(
    height,
    document.querySelector('.site-footer')?.getBoundingClientRect().top ?? height,
  )
  if (bottom <= top) return null
  // The lines start in the colour band under the hero and fade in across it,
  // so nothing crowds the top of the page.
  const band = document.querySelector('.pan-band')?.getBoundingClientRect()
  const fadeFrom = band ? band.top + band.height * 0.3 : -Infinity
  const fadeTo = band ? band.top + band.height * 0.7 : -Infinity
  if (fadeFrom >= bottom) return null
  return { gutter, top, bottom, fadeFrom, fadeTo }
}

function lineX(line, y, gutter) {
  const base = line.side ? width - gutter + line.spot * gutter : line.spot * gutter
  const wave =
    Math.sin(y * 0.008 + clock * 0.6 + line.phase + window.scrollY * 0.002) * gutter * 0.06
  const twang = line.pluck * Math.exp(-(((y - line.pluckY) / 90) ** 2))
  return base + wave + twang
}

function step(dt) {
  clock += dt
  for (const line of lines) {
    // A loose spring, so a plucked line wobbles a few times before settling.
    line.pluckSpeed += (-140 * line.pluck - 3 * line.pluckSpeed) * dt
    line.pluck += line.pluckSpeed * dt
  }
  for (const note of notes) {
    note.y -= SPEED * dt
    if (note.y < -0.04) note.y += LOOP
    // A stiffer spring pulls a bumped note back onto its line.
    note.vx += (-90 * note.dx - 9 * note.vx) * dt
    note.vy += (-90 * note.dy - 9 * note.vy) * dt
    note.dx += note.vx * dt
    note.dy += note.vy * dt
    note.spin += (-120 * note.angle - 7 * note.spin) * dt
    note.angle += note.spin * dt
    note.bump = Math.max(0, note.bump - dt * 2.5)
  }
}

function draw() {
  context.clearRect(0, 0, width, height)
  const area = layout()
  if (!area) return
  const { gutter, bottom, fadeFrom, fadeTo } = area
  const top = Math.max(area.top, fadeFrom)
  const styles = getComputedStyle(canvas.value)

  context.save()
  context.beginPath()
  context.rect(0, top, width, bottom - top)
  context.clip()

  context.strokeStyle = styles.borderTopColor
  context.lineWidth = 1.2
  context.globalAlpha = 0.35
  for (const line of lines) {
    context.beginPath()
    for (let y = top; y <= bottom; y += 8) {
      const x = lineX(line, y, gutter)
      if (y === top) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.stroke()
  }

  context.fillStyle = styles.color
  context.globalAlpha = 0.8
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const note of notes) {
    // Spaced over the whole screen, so they don't bunch up in the band.
    const y = area.top + note.y * (bottom - area.top)
    note.x = lineX(note.line, y, gutter) + note.dx
    note.screenY = y + note.dy
    context.save()
    context.translate(note.x, note.screenY)
    context.rotate(note.angle)
    const scale = 1 + Math.sin(note.bump * Math.PI) * 0.35
    context.scale(scale, scale)
    context.font = `${note.size}px serif`
    context.fillText(note.glyph, 0, 0)
    context.restore()
  }
  // Fade the start of the lines in, over the band.
  if (fadeTo > top) {
    const fade = context.createLinearGradient(0, fadeFrom, 0, fadeTo)
    fade.addColorStop(0, 'rgba(0,0,0,0)')
    fade.addColorStop(1, 'rgba(0,0,0,1)')
    context.globalCompositeOperation = 'destination-in'
    context.globalAlpha = 1
    context.fillStyle = fade
    context.fillRect(0, top, width, bottom - top)
  }
  context.restore()
}

function tick(time) {
  const dt = Math.min(0.05, (time - (lastTime || time)) / 1000)
  lastTime = time
  step(dt)
  draw()
  frame = requestAnimationFrame(tick)
}

// Only a moving mouse bumps things, so a resting one doesn't hold notes off
// their lines.
function onPointerMove(event) {
  const { clientX: px, clientY: py, movementX = 0 } = event
  for (const note of notes) {
    if (note.x === undefined) continue
    const ax = note.x - px
    const ay = note.screenY - py
    const distance = Math.hypot(ax, ay)
    if (distance > REACH) continue
    const push = (1 - distance / REACH) * 700
    note.vx += (ax / (distance || 1)) * push
    note.vy += (ay / (distance || 1)) * push
    if (note.bump === 0) {
      note.spin += (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 6)
      note.bump = 1
    }
  }
  // A pointer cursor over a note, so it's clear it can be clicked.
  const overNote = notes.some(
    (note) => note.x !== undefined && Math.hypot(note.x - px, note.screenY - py) < HIT,
  )
  if (overNote !== pointerShown) {
    document.documentElement.style.cursor = overNote ? 'pointer' : ''
    pointerShown = overNote
  }
  const area = layout()
  if (!area || !movementX) return
  const now = performance.now()
  for (const line of lines) {
    if (Math.abs(lineX(line, py, area.gutter) - px) > 10) continue
    line.pluckY = py
    line.pluckSpeed += Math.sign(movementX) * Math.min(260, Math.abs(movementX) * 40)
    // Quieter than a click, and not more than a few times a second per line.
    if (now - (line.lastSound ?? 0) > 180) {
      line.lastSound = now
      playTone(pitchFor(line, py), 0.06)
    }
  }
}

// A click near a note gives it a big bump and plays it; a click on a line
// plucks it hard.
function onPointerDown(event) {
  startAudio()
  const { clientX: px, clientY: py } = event
  const area = layout()
  if (!area) return
  const hit = notes.find(
    (note) => note.x !== undefined && Math.hypot(note.x - px, note.screenY - py) < HIT,
  )
  if (hit) {
    hit.vy -= 500
    hit.vx += (Math.random() - 0.5) * 400
    hit.spin += (Math.random() < 0.5 ? -1 : 1) * 16
    hit.bump = 1
    // Waits a moment for the audio to start on the very first click.
    window.setTimeout(
      () => playTone(pitchFor(hit.line, hit.screenY)),
      audio?.state === 'running' ? 0 : 60,
    )
    return
  }
  const line = lines.find((each) => Math.abs(lineX(each, py, area.gutter) - px) < 10)
  if (!line) return
  line.pluckY = py
  line.pluckSpeed += 300
  window.setTimeout(() => playTone(pitchFor(line, py), 0.09), audio?.state === 'running' ? 0 : 60)
}

onMounted(() => {
  context = canvas.value.getContext('2d')
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  setUp()
  resize()
  window.addEventListener('resize', resize)
  if (reduceMotion) {
    // Still lines and notes, redrawn only when the page moves.
    window.addEventListener('scroll', draw, { passive: true })
    draw()
  } else {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    frame = requestAnimationFrame(tick)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', resize)
  window.removeEventListener('scroll', draw)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onPointerDown)
  if (pointerShown) document.documentElement.style.cursor = ''
  audio?.close()
})
</script>

<template>
  <canvas ref="canvas" class="note-margins" aria-hidden="true" />
</template>

<style scoped>
/* Fixed behind everything and ignoring the mouse, so the page works as
   normal. The canvas reads its colours from here, so they follow the theme. */
.note-margins {
  position: fixed;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0 solid var(--ui-text-muted);
  /* The landing page sets --note-colour to the mood picked in the hero. */
  color: var(--note-colour, var(--ui-primary));
  pointer-events: none;
}
</style>
