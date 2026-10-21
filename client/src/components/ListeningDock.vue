<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useListeningRoom } from '@/composables/useListeningRoom'
const route = useRoute()
const room = useListeningRoom()
const { connected, ready, track, paused, busy } = room
const visible = computed(() => connected.value && route.path !== '/listen')

// The dock floats over the page, so while it shows, the page keeps space for
// it at the bottom and it never covers the footer.
watch(visible, (shown) => document.documentElement.classList.toggle('has-dock', shown), {
  immediate: true,
})
onBeforeUnmount(() => document.documentElement.classList.remove('has-dock'))

// The user can drag the dock by its grip. Where they leave it is remembered in
// this browser; double-clicking the grip puts it back in the corner.
const STORAGE_KEY = 'metafor-dock-position'
const EDGE = 8
const KEY_STEP = 24
const dock = ref(null)
const position = ref(loadPosition())
let drag = null

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null
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

// Keeps the whole dock on screen.
function clamp(x, y) {
  const { width, height } = dock.value.getBoundingClientRect()
  return {
    x: Math.min(Math.max(x, EDGE), window.innerWidth - width - EDGE),
    y: Math.min(Math.max(y, EDGE), window.innerHeight - height - EDGE),
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
  position.value = clamp(event.clientX - drag.dx, event.clientY - drag.dy)
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
  position.value = clamp(rect.left + step[0] * KEY_STEP, rect.top + step[1] * KEY_STEP)
  savePosition()
}

function resetPosition() {
  position.value = null
  savePosition()
}

const dockStyle = computed(() =>
  position.value
    ? { left: `${position.value.x}px`, top: `${position.value.y}px`, right: 'auto', bottom: 'auto' }
    : {},
)

// A smaller window could leave a saved position off screen.
function keepOnScreen() {
  if (position.value && dock.value) position.value = clamp(position.value.x, position.value.y)
}
watch(visible, (shown) => shown && nextTick(keepOnScreen))
onMounted(() => {
  window.addEventListener('resize', keepOnScreen)
  nextTick(keepOnScreen)
})
onBeforeUnmount(() => window.removeEventListener('resize', keepOnScreen))
</script>
<template>
  <aside
    v-if="visible"
    ref="dock"
    class="listening-dock"
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
    <RouterLink to="/listen"
      ><strong>{{ track.name }}</strong
      ><span>Back to your listening room ↗</span></RouterLink
    >
    <button :disabled="!ready || !track.id || busy" @click="room.toggle">
      {{ paused ? 'Play' : 'Pause' }}
    </button>
    <button :disabled="busy" @click="room.disconnect">Disconnect</button>
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
  width: min(400px, calc(100% - 32px));
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
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
strong {
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
a:focus-visible {
  outline: 3px solid var(--color-brand-700);
  outline-offset: 3px;
}
</style>
