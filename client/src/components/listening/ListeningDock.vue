<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useListeningRoom } from '@/composables/useListeningRoom'
const route = useRoute()
const room = useListeningRoom()
const { connected, ready, track, paused, busy, duration } = room
// Where the song is up to (the dock's own `position` is where it sits on screen).
const playPosition = room.position
const formatTime = (ms) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
// How far through the song, for the slider's filled part.
const progress = computed(() =>
  duration.value ? `${Math.min(100, (playPosition.value / duration.value) * 100)}%` : '0%',
)
// Without Spotify Premium the player never becomes ready, so the dock keeps to
// the simple version: the song, a link back to the room, and Disconnect.
const canPlay = computed(() => ready.value)
// Hidden in the listening room, which has its own player, and on the landing page.
const HIDDEN_ON = ['/', '/listen']
const visible = computed(() => connected.value && !HIDDEN_ON.includes(route.path))

// The dock floats over the page, so while it shows, the page keeps space for
// it at the bottom and it never covers the footer.
watch(visible, (shown) => document.documentElement.classList.toggle('has-dock', shown), {
  immediate: true,
})
onBeforeUnmount(() => document.documentElement.classList.remove('has-dock'))

// The user can drag the dock by its grip. Where they leave it is remembered in
// this browser, as a distance from the nearest corner, so it stays in that
// corner when the window changes size. Double-clicking the grip puts it back.
const STORAGE_KEY = 'metafor-dock-position'
const EDGE = 8
const KEY_STEP = 24
const dock = ref(null)
// { h: 'left' | 'right', x, v: 'top' | 'bottom', y }, or null for the default corner.
const position = ref(loadPosition())
// The dock's own size, so its position can be kept on screen.
const size = ref({ width: 0, height: 0 })
let drag = null

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const valid =
      ['left', 'right'].includes(saved?.h) &&
      ['top', 'bottom'].includes(saved?.v) &&
      Number.isFinite(saved?.x) &&
      Number.isFinite(saved?.y)
    return valid ? saved : null
  } catch {
    return null
  }
}

function savePosition() {
  try {
    if (position.value) localStorage.setItem(STORAGE_KEY, JSON.stringify(position.value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private windows can block storage; the dock still moves for this visit.
  }
}

// Turns a top-left point into a distance from the nearest corner, keeping the
// whole dock on screen.
function anchorAt(left, top) {
  const { width, height } = dock.value.getBoundingClientRect()
  const screenWidth = document.documentElement.clientWidth
  const screenHeight = document.documentElement.clientHeight
  const x = Math.min(Math.max(left, EDGE), screenWidth - width - EDGE)
  const y = Math.min(Math.max(top, EDGE), screenHeight - height - EDGE)
  const h = x + width / 2 > screenWidth / 2 ? 'right' : 'left'
  const v = y + height / 2 > screenHeight / 2 ? 'bottom' : 'top'

  return {
    h,
    x: Math.round(h === 'left' ? x : screenWidth - x - width),
    v,
    y: Math.round(v === 'top' ? y : screenHeight - y - height),
  }
}

function startDrag(event) {
  if (event.button !== 0) return
  const rect = dock.value.getBoundingClientRect()
  drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
  event.currentTarget.setPointerCapture(event.pointerId)
}

function moveDrag(event) {
  if (!drag) return
  position.value = anchorAt(event.clientX - drag.dx, event.clientY - drag.dy)
}

function endDrag() {
  if (!drag) return
  drag = null
  savePosition()
}

function moveByKey(event) {
  const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const step = steps[event.key]
  if (!step) return
  event.preventDefault()
  const rect = dock.value.getBoundingClientRect()
  position.value = anchorAt(rect.left + step[0] * KEY_STEP, rect.top + step[1] * KEY_STEP)
  savePosition()
}

function resetPosition() {
  position.value = null
  savePosition()
}

// The browser keeps the dock on screen as the window resizes: never further
// from its corner than the window has room for.
const dockStyle = computed(() => {
  if (!position.value) return {}
  const { h, x, v, y } = position.value
  const across = `max(${EDGE}px, min(${x}px, calc(100% - ${size.value.width + EDGE}px)))`
  const down = `max(${EDGE}px, min(${y}px, calc(100% - ${size.value.height + EDGE}px)))`
  return {
    left: h === 'left' ? across : 'auto',
    right: h === 'right' ? across : 'auto',
    top: v === 'top' ? down : 'auto',
    bottom: v === 'bottom' ? down : 'auto',
  }
})

function measure() {
  if (!dock.value) return
  const { width, height } = dock.value.getBoundingClientRect()
  size.value = { width: Math.round(width), height: Math.round(height) }
}
// Measured straight after it appears or is minimised, and again whenever its
// size changes for any other reason.
const sizeObserver = new ResizeObserver(measure)
watch(dock, (element, old) => {
  if (old) sizeObserver.unobserve(old)
  if (element) sizeObserver.observe(element)
})
onBeforeUnmount(() => sizeObserver.disconnect())

// Minimised, the dock shrinks to the grip, the album art and play/pause. It
// shrinks towards the corner it is kept in, so it stays on the nearer side.
const MINIMISED_KEY = 'metafor-dock-minimised'
const minimised = ref(loadMinimised())

function loadMinimised() {
  try {
    return localStorage.getItem(MINIMISED_KEY) === 'true'
  } catch {
    return false
  }
}

function toggleMinimised() {
  minimised.value = !minimised.value
  try {
    localStorage.setItem(MINIMISED_KEY, String(minimised.value))
  } catch {
    // Storage blocked; it stays minimised for this visit only.
  }
}

watch([dock, minimised], measure, { flush: 'post' })
</script>
<template>
  <aside
    v-if="visible"
    ref="dock"
    class="listening-dock"
    :class="{ 'is-minimised': minimised }"
    :style="dockStyle"
    aria-label="Current Spotify playback"
  >
    <button
      type="button"
      class="dock-grip"
      aria-label="Move player. Drag, or use the arrow keys. Double-click to put it back."
      title="Drag to move. Double-click to put it back."
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @keydown="moveByKey"
      @dblclick="resetPosition"
    >
      <svg viewBox="0 0 10 16" aria-hidden="true">
        <circle cx="2.5" cy="3" r="1.4" /><circle cx="7.5" cy="3" r="1.4" />
        <circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" />
        <circle cx="2.5" cy="13" r="1.4" /><circle cx="7.5" cy="13" r="1.4" />
      </svg>
    </button>
    <img v-if="track.album?.images?.length" :src="track.album.images[0].url" alt="" />
    <template v-if="!minimised">
      <RouterLink to="/listen"
        ><strong>{{ track.name || 'Spotify connected' }}</strong
        ><span>{{ canPlay ? 'Back to your listening room ↗' : 'Spotify Premium needed to play ↗' }}</span></RouterLink
      >
      <template v-if="canPlay">
        <button
          type="button"
          class="dock-icon glass-icon"
          aria-label="Previous track"
          title="Previous"
          :disabled="!ready || busy"
          @click="room.skip(-1)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h2v11H3zM13.5 2.5v11L6 8z" /></svg>
        </button>
        <button
          type="button"
          class="dock-icon glass-icon"
          :aria-label="paused ? `Play ${track.name}` : `Pause ${track.name}`"
          :title="paused ? 'Play' : 'Pause'"
          :disabled="!ready || !track.id || busy"
          @click="room.toggle"
        >
          <svg v-if="paused" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
          <svg v-else viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" />
          </svg>
        </button>
        <button
          type="button"
          class="dock-icon glass-icon"
          aria-label="Next track"
          title="Next"
          :disabled="!ready || busy"
          @click="room.skip(1)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2.5h2v11h-2zM2.5 2.5v11L10 8z" /></svg>
        </button>
      </template>
      <button
        type="button"
        class="dock-text glass-secondary"
        :class="{ 'is-kept': !canPlay }"
        :disabled="busy"
        @click="room.disconnect"
      >
        Disconnect
      </button>
    </template>
    <button
      v-else
      class="dock-icon glass-icon"
      :disabled="!ready || !track.id || busy"
      :aria-label="paused ? `Play ${track.name}` : `Pause ${track.name}`"
      :title="paused ? 'Play' : 'Pause'"
      @click="room.toggle"
    >
      <svg v-if="paused" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
      <svg v-else viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" />
      </svg>
    </button>
    <button
      type="button"
      class="dock-icon glass-icon"
      :aria-label="minimised ? 'Expand player' : 'Minimise player'"
      :aria-expanded="!minimised"
      :title="minimised ? 'Expand' : 'Minimise'"
      @click="toggleMinimised"
    >
      <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path v-if="minimised" d="M3 10l5-5 5 5" />
        <path v-else d="M3 6l5 5 5-5" />
      </svg>
    </button>
    <!-- Its own row under the controls, the full width of the dock. -->
    <div v-if="!minimised && canPlay" class="dock-seek">
      <span aria-hidden="true">{{ formatTime(playPosition) }}</span>
      <input
        type="range"
        min="0"
        :max="duration || 1"
        step="1000"
        :value="playPosition"
        :style="{ '--progress': progress }"
        aria-label="Playback position"
        :aria-valuetext="formatTime(playPosition)"
        :disabled="!ready || !track.id || busy"
        @change="room.seek($event.target.value)"
      />
      <span aria-hidden="true">{{ formatTime(duration) }}</span>
    </div>
  </aside>
</template>
<style>
/* The dock's height plus its gap from the edge. The footer, or the page when
   it has no footer, adds this much space at the bottom. */
html.has-dock {
  --dock-space: 96px;
  scroll-padding-bottom: var(--dock-space);
}
html.has-dock body:not(:has(.site-footer)) {
  padding-bottom: var(--dock-space);
}
</style>
<style scoped>
.listening-dock {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 15;
  display: flex;
  width: min(440px, calc(100% - 32px));
  flex-wrap: wrap;
  gap: 2px 8px;
  align-items: center;
  padding: 6px 10px 4px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  /* Frosted glass, like the sticky navbar. */
  background: rgba(250, 248, 246, 0.62);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  backdrop-filter: blur(18px) saturate(1.3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  color: var(--ui-text);
  font-size: 13px;
}
:global(.dark .listening-dock) {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(23, 27, 39, 0.6);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}
@media (prefers-reduced-transparency: reduce) {
  .listening-dock {
    background: #faf8f6;
  }
  :global(.dark .listening-dock) {
    background: #171b27;
  }
}
img {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  object-fit: cover;
}
a {
  flex: 1;
  min-width: 0;
  text-decoration: none;
}
strong,
span {
  display: block;
}
strong,
span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
span {
  margin-top: 4px;
  font-size: 11px;
}
button {
  min-height: 44px;
  flex-shrink: 0;
  padding: 8px;
  cursor: pointer;
}
.listening-dock.is-minimised {
  width: auto;
  padding-bottom: 6px;
}
.dock-text {
  border: 0;
  border-radius: 10px;
  color: inherit;
  background: transparent;
  font-size: 12px;
}
.dock-text:hover:not(:disabled) {
  background: rgba(127, 127, 127, 0.16);
}
/* On phones the song title needs the room; Disconnect stays in the
   Listening Room, which the title links to. */
@media (max-width: 600px) {
  .dock-text:not(.is-kept) {
    display: none;
  }
}
.dock-seek {
  display: flex;
  flex-basis: 100%;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.dock-seek span {
  margin: 0;
  opacity: 0.75;
}
/* A thin rounded track, filled in terracotta up to where the song is, with a
   small white thumb that grows while you hover or drag. */
.dock-seek input {
  --track: rgba(127, 127, 127, 0.3);
  --fill: var(--color-brand-500);
  flex: 1;
  min-width: 0;
  height: 20px;
  margin: 0;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.dock-seek input:disabled {
  cursor: not-allowed;
}
.dock-seek input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--fill) var(--progress), var(--track) var(--progress));
}
.dock-seek input::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: var(--track);
}
.dock-seek input::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--fill);
}
.dock-seek input::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -4px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition: transform 140ms ease;
  -webkit-appearance: none;
  appearance: none;
}
.dock-seek input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition: transform 140ms ease;
}
.dock-seek input:hover:not(:disabled)::-webkit-slider-thumb,
.dock-seek input:active::-webkit-slider-thumb {
  transform: scale(1.25);
}
.dock-seek input:hover:not(:disabled)::-moz-range-thumb,
.dock-seek input:active::-moz-range-thumb {
  transform: scale(1.25);
}
.dock-seek input:focus-visible {
  outline-offset: 2px;
}
/* Each browser drops a rule naming the other's thumb, so they stay apart. */
@media (prefers-reduced-motion: reduce) {
  .dock-seek input::-webkit-slider-thumb {
    transition: none;
  }
  .dock-seek input::-moz-range-thumb {
    transition: none;
  }
}
.dock-icon {
  display: inline-flex;
  width: 36px;
  min-height: 36px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 10px;
  color: inherit;
  background: transparent;
}
.dock-icon:hover:not(:disabled) {
  background: rgba(127, 127, 127, 0.16);
}
.dock-icon svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
.dock-icon .chevron {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dock-grip {
  display: inline-flex;
  width: 24px;
  margin-right: -4px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  color: inherit;
  background: transparent;
  opacity: 0.55;
  cursor: grab;
  touch-action: none;
}
.dock-grip:active {
  cursor: grabbing;
}
.dock-grip:hover {
  opacity: 1;
}
.dock-grip svg {
  width: 10px;
  height: 16px;
  fill: currentColor;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 3px solid var(--color-brand-700);
  outline-offset: 3px;
}
</style>
