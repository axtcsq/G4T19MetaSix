<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Wavy lines with music notes drifting up them, drawn in the empty space
// either side of the landing page. The notes jolt away from the mouse and the
// lines twang when it sweeps across them.
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

let context
let frame
let lastTime = 0
let clock = 0
let width = 0
let height = 0
let reduceMotion = false
const lines = []
const notes = []

function setUp() {
  for (const side of [0, 1]) {
    LINE_SPOTS.forEach((spot, index) => {
      const line = { side, spot, phase: Math.random() * Math.PI * 2, pluck: 0, pluckSpeed: 0, pluckY: 0 }
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
  const bottom = Math.min(height, document.querySelector('.site-footer')?.getBoundingClientRect().top ?? height)
  if (bottom <= top) return null
  return { gutter, top, bottom }
}

function lineX(line, y, gutter) {
  const base = line.side ? width - gutter + line.spot * gutter : line.spot * gutter
  const wave = Math.sin(y * 0.008 + clock * 0.6 + line.phase + window.scrollY * 0.002) * gutter * 0.06
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
  const { gutter, top, bottom } = area
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
    const y = top + note.y * (bottom - top)
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
  const area = layout()
  if (!area || !movementX) return
  for (const line of lines) {
    if (Math.abs(lineX(line, py, area.gutter) - px) > 10) continue
    line.pluckY = py
    line.pluckSpeed += Math.sign(movementX) * Math.min(260, Math.abs(movementX) * 40)
  }
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
    frame = requestAnimationFrame(tick)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', resize)
  window.removeEventListener('scroll', draw)
  window.removeEventListener('pointermove', onPointerMove)
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
  color: var(--ui-primary);
  pointer-events: none;
}
</style>
