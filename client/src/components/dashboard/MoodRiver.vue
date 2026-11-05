<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getMoodInsights } from '@/api/listens'
import RecordLoader from '@/components/layout/RecordLoader.vue'

// Draw daily music moods as animated streams with p5.
const props = defineProps({
  // The first and last dates shown, like 2026-10-19.
  from: { type: String, required: true },
  to: { type: String, required: true },
})

// Top to bottom in the river, and left to right in the legend.
const AXES = ['happy', 'relaxed', 'sad', 'angry', 'anxious']
const MOOD_NAME = {
  happy: 'Happy',
  relaxed: 'Relaxed',
  sad: 'Sad',
  anxious: 'Anxious',
  angry: 'Angry',
}
const HEIGHT = 190
let canvasHeight = HEIGHT
// Room under the streams, so the widest day doesn't touch the edge.
const MARGIN = 10

const host = ref(null)
const days = ref([])
const loading = ref(true)
const error = ref('')
const selectedIndex = ref(null)
const reduced = ref(false)
const inView = ref(true)

// Every date from `from` to `to`, so days without plays still have a place.
function datesBetween(from, to) {
  const dates = []
  const day = new Date(`${from}T00:00:00`)
  const last = new Date(`${to}T00:00:00`)
  while (day <= last) {
    dates.push(day.toLocaleDateString('en-CA'))
    day.setDate(day.getDate() + 1)
  }
  return dates
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const insights = await getMoodInsights(props.from, props.to)
    const byDate = new Map(insights.days.map((day) => [day.date, day]))
    days.value = datesBetween(props.from, props.to).map((date) => {
      const axes = byDate.get(date)?.axes ?? {}
      const values = AXES.map((axis) => axes[axis] ?? 0)
      return { date, values, total: values.reduce((sum, value) => sum + value, 0) }
    })
  } catch (failure) {
    error.value = failure.message
  } finally {
    loading.value = false
  }
}

const hasPlays = computed(() => days.value.some((day) => day.total > 0))

// The river starts at the middle of the first day's column, so the text under it is indented by half a column to line up with the river's edge.
const edgeInset = computed(() => ({
  paddingLeft: `calc(100% / ${Math.max(1, days.value.length) * 2})`,
}))

const dayLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// "Oct 24 · 14 plays: Sad 36%, Happy 29%, Angry 21%", biggest first.
function describeDay(day) {
  if (!day.total) return `${dayLabel(day.date)}: no analysed plays`
  const plays = Math.round(day.total)
  const mix = AXES.map((axis, stream) => ({
    name: MOOD_NAME[axis],
    share: Math.round((day.values[stream] / day.total) * 100),
  }))
    .filter((mood) => mood.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3)
    .map((mood) => `${mood.name} ${mood.share}%`)
    .join(', ')
  return `${dayLabel(day.date)} · ${plays} ${plays === 1 ? 'play' : 'plays'}: ${mix}`
}
const readout = computed(() =>
  selectedIndex.value === null
    ? 'Select a day to see its mix.'
    : describeDay(days.value[selectedIndex.value]),
)

// Calculate the stream boundaries for each canvas column.
let shape = null
function buildShape(width) {
  const count = days.value.length
  const columnWidth = width / Math.max(1, count)
  const dayX = (index) => columnWidth * (index + 0.5)
  const height = canvasHeight - MARGIN * 2
  const smooth = (t) => t * t * (3 - 2 * t)
  const shares = days.value.map((day) => day.values.map((value) => (day.total ? value / day.total : 0)))
  const played = days.value.map((day) => day.total > 0)
  for (let index = 0; index < count; index++) {
    if (played[index]) continue
    const nearest = [...Array(count).keys()]
      .filter((other) => played[other])
      .sort((a, b) => Math.abs(a - index) - Math.abs(b - index))[0]
    if (nearest !== undefined) shares[index] = shares[nearest]
  }
  // The most plays any mood had on one day, to scale how fast its water runs.
  const busiest = Math.max(1, ...days.value.flatMap((day) => day.values))
  const columns = []
  for (let x = dayX(0); x <= dayX(count - 1) + 0.01; x += 3) {
    const position = (x - dayX(0)) / columnWidth
    const left = Math.min(count - 1, Math.floor(position))
    const right = Math.min(count - 1, left + 1)
    const blend = smooth(Math.min(1, position - left))
    const mix = (list) => AXES.map((_, stream) => list[left][stream] + (list[right][stream] - list[left][stream]) * blend)
    const share = mix(shares)
    const plays = mix(days.value.map((day) => day.values))
    // 1 on days with plays, 0 on days without, blended between them.
    const water = (played[left] ? 1 : 0) + ((played[right] ? 1 : 0) - (played[left] ? 1 : 0)) * blend
    const total = share.reduce((sum, value) => sum + value, 0) || 1
    let edge = MARGIN
    const bands = share.map((value, stream) => {
      const top = edge
      edge += (value / total) * height
      return { top, bottom: edge, thickness: edge - top, flow: plays[stream] / busiest }
    })
    columns.push({ x, bands, water })
  }
  // Running totals of each stream's thickness, to place new water where the stream is widest. Days without plays get none.
  const weights = AXES.map((_, stream) => {
    let sum = 0
    return columns.map((column) => (sum += column.bands[stream].thickness * column.water))
  })
  const areas = weights.map((list) => list.at(-1) ?? 0)
  shape = {
    columns,
    weights,
    areas,
    totalArea: areas.reduce((sum, area) => sum + area, 0),
    dayX,
    columnWidth,
    emptyDays: played.map((wasPlayed, index) => (wasPlayed ? null : index)).filter((index) => index !== null),
    step: 3,
  }
}

function columnAt(x) {
  if (!shape?.columns.length) return null
  const index = Math.round((x - shape.columns[0].x) / shape.step)
  return shape.columns[Math.max(0, Math.min(shape.columns.length - 1, index))]
}

// Animate particles through each mood stream.
let particles = []
const MAX_PARTICLES = 650
function spawn(p) {
  if (!shape?.totalArea) return
  const budget = Math.min(10, MAX_PARTICLES - particles.length)
  for (let n = 0; n < budget; n++) {
    let pick = p.random(shape.totalArea)
    let stream = 0
    while (stream < AXES.length - 1 && pick > shape.areas[stream]) {
      pick -= shape.areas[stream]
      stream++
    }
    const weights = shape.weights[stream]
    const target = p.random(weights.at(-1))
    let low = 0
    let high = weights.length - 1
    while (low < high) {
      const middle = (low + high) >> 1
      if (weights[middle] < target) low = middle + 1
      else high = middle
    }
    const column = shape.columns[low]
    particles.push({
      stream,
      x: column.x,
      lane: p.random(0.15, 0.85),
      age: 0,
      life: p.random(55, 110),
      // More plays of this mood that day, faster water.
      speed: p.random(0.35, 0.6) + column.bands[stream].flow * 1.4,
    })
  }
}

let instance
let intersectionObserver
let resizeObserver
let media
let disposed = false
let colours = []
let background = '#faf8f6'

function readColours() {
  const styles = getComputedStyle(host.value)
  colours = AXES.map((axis) => styles.getPropertyValue(`--color-mood-${axis}-500`).trim() || '#cd6651')
  background = styles.getPropertyValue('--ui-bg').trim() || background
}

function syncPlayback() {
  if (!instance) return
  if (reduced.value || !inView.value || document.hidden) instance.noLoop()
  else instance.loop()
}

// Start with water already in the river, not an empty bed.
function fill(p) {
  particles = []
  for (let n = 0; n < 40; n++) spawn(p)
  particles.forEach((particle) => (particle.age = p.random(particle.life)))
}

async function draw() {
  // The drawing area only appears once the days have loaded.
  await nextTick()
  if (disposed || !host.value || !hasPlays.value) return
  readColours()
  if (instance) {
    buildShape(instance.width)
    fill(instance)
    instance.redraw()
    return
  }
  const { default: P5 } = await import('p5')
  if (disposed) return
  P5.disableFriendlyErrors = true
  instance = new P5((p) => {
    p.setup = () => {
      canvasHeight = Math.max(HEIGHT, host.value.clientHeight)
      const canvas = p.createCanvas(host.value.clientWidth, canvasHeight)
      canvas.attribute('role', 'img')
      canvas.attribute(
        'aria-label',
        `A river of your music's moods over ${days.value.length} days. Each coloured stream is a mood, and its width is that mood's share of the day's plays.`,
      )
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
      p.frameRate(30)
      buildShape(p.width)
      fill(p)
      syncPlayback()
    }
    p.draw = () => {
      p.clear()
      if (!shape) return
      p.noStroke()
      AXES.forEach((_, stream) => {
        p.fill(colours[stream])
        p.beginShape()
        shape.columns.forEach((column) => p.vertex(column.x, column.bands[stream].top))
        for (let i = shape.columns.length - 1; i >= 0; i--) {
          p.vertex(shape.columns[i].x, shape.columns[i].bands[stream].bottom)
        }
        p.endShape(p.CLOSE)
      })

      const moving = !reduced.value
      if (moving) spawn(p)
      particles = particles.filter((particle) => {
        if (moving) {
          particle.x += particle.speed
          particle.age += 1
        }
        const column = columnAt(particle.x)
        const band = column?.bands[particle.stream]
        if (!band || particle.age > particle.life || particle.x > shape.columns.at(-1).x) return false
        if (band.thickness < 1.5) return true
        // Fade in, then out, over the speck's life.
        const fade = Math.sin((particle.age / particle.life) * Math.PI) * column.water
        const colour = p.lerpColor(p.color(colours[particle.stream]), p.color('#ffffff'), 0.75)
        colour.setAlpha(200 * fade)
        p.fill(colour)
        p.circle(particle.x, band.top + band.thickness * particle.lane, 2.4)
        return true
      })

      // Days without plays are faded, so they don't read as real data.
      p.noStroke()
      shape.emptyDays.forEach((index) => {
        const veil = p.color(background)
        veil.setAlpha(200)
        p.fill(veil)
        // Whole pixels, so neighbouring days meet without a seam.
        const left = Math.round(shape.dayX(index) - shape.columnWidth / 2)
        const right = Math.round(shape.dayX(index) + shape.columnWidth / 2)
        p.rect(left, 0, right - left, canvasHeight)
      })

      if (selectedIndex.value !== null) {
        const x = shape.dayX(selectedIndex.value)
        p.stroke(255, 255, 255, 170)
        p.strokeWeight(1.5)
        p.line(x, 0, x, canvasHeight)
      }
    }
  }, host.value)

  intersectionObserver = new IntersectionObserver(([entry]) => {
    inView.value = entry.isIntersecting
    syncPlayback()
  })
  intersectionObserver.observe(host.value)
  resizeObserver = new ResizeObserver(() => {
    if (!instance || !host.value) return
    const width = host.value.clientWidth
    const height = Math.max(HEIGHT, host.value.clientHeight)
    if (width === instance.width && height === canvasHeight) return
    canvasHeight = height
    instance.resizeCanvas(width, height)
    buildShape(instance.width)
    fill(instance)
    instance.redraw()
  })
  resizeObserver.observe(host.value)
}

// Hovering anywhere over the river picks the nearest day.
function pointAt(event) {
  if (!shape) return
  const box = host.value.getBoundingClientRect()
  const index = Math.floor((event.clientX - box.left) / shape.columnWidth)
  selectedIndex.value = Math.max(0, Math.min(days.value.length - 1, index))
  instance?.redraw()
}

function selectDay(index) {
  selectedIndex.value = index
  instance?.redraw()
}

function clearSelection() {
  selectedIndex.value = null
  instance?.redraw()
}

function onPreference(event) {
  reduced.value = event.matches
  syncPlayback()
}

watch(
  () => [props.from, props.to],
  async () => {
    await load()
    draw()
  },
)

onMounted(async () => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced.value = media.matches
  media.addEventListener('change', onPreference)
  document.addEventListener('visibilitychange', syncPlayback)
  await load()
  draw()
})

onBeforeUnmount(() => {
  disposed = true
  intersectionObserver?.disconnect()
  resizeObserver?.disconnect()
  media?.removeEventListener('change', onPreference)
  document.removeEventListener('visibilitychange', syncPlayback)
  instance?.remove()
})
</script>

<template>
  <div class="mood-river">
    <RecordLoader v-if="loading" label="Filling the river…" />
    <p v-else-if="error" class="river-status" role="alert">
      {{ error }}
      <button type="button" class="river-retry" @click="load().then(draw)">Try again</button>
    </p>
    <p v-else-if="!hasPlays" class="river-status">
      Your river fills up once MetaFor has heard your songs, usually within a few minutes of a sync.
    </p>
    <template v-else>
      <div
        ref="host"
        class="river-canvas"
        @pointermove="pointAt"
        @pointerleave="clearSelection"
      />
      <div
        class="river-days"
        role="group"
        aria-label="Days in the river"
        :style="{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }"
      >
        <button
          v-for="(day, index) in days"
          :key="day.date"
          type="button"
          class="river-day"
          :class="{ selected: selectedIndex === index }"
          :aria-label="describeDay(day)"
          @focus="selectDay(index)"
          @click="selectDay(index)"
        >
          {{ Number(day.date.slice(-2)) }}
        </button>
      </div>
      <p class="river-readout" :style="edgeInset" aria-live="polite">{{ readout }}</p>
    </template>
  </div>
</template>

<style scoped>
.mood-river {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  font-family: var(--font-sans);
}
.river-retry {
  padding: 4px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  font: 600 var(--text-caption) var(--font-sans);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease;
}
.river-retry:hover {
  border-color: var(--ui-primary);
  color: var(--ui-primary);
}
.river-canvas {
  flex: 1;
  width: 100%;
  min-height: 190px;
  border-radius: 14px;
  overflow: hidden;
  cursor: crosshair;
  animation: river-fill 900ms ease-out;
}
.river-canvas :deep(canvas) {
  display: block;
}
.river-days {
  display: grid;
  margin-top: 6px;
}
.river-day {
  padding: 2px 0;
  border-radius: 6px;
  color: var(--ui-text-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  text-align: center;
  cursor: pointer;
}
.river-day.selected,
.river-day:hover {
  color: var(--ui-text);
  font-weight: 700;
}
.river-day:focus-visible,
.river-retry:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.river-readout,
.river-status {
  min-height: 24px;
  margin-top: 8px;
  color: var(--ui-text-muted);
  font: var(--text-label)/1.5 var(--font-sans);
}
/* The river runs in from the left when it first appears. */
@keyframes river-fill {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .river-canvas {
    animation: none;
  }
}
</style>
