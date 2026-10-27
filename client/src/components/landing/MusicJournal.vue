<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ButterflyMark from '@/components/layout/ButterflyMark.vue'
import LandingObject3D from './LandingObject3D.vue'

// "Spotify + journal" on the landing page. Scrolling down slides the Spotify
// tile into the journal and merges them into the MetaFor butterfly with a
// burst of notes; scrolling back up pulls them apart. Dragging the tile in
// works too, and the hint under them is a button that does the same, for
// keyboards.
const section = ref(null)
const tile = ref(null)
const journal = ref(null)
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)
const merging = ref(false)
const merged = ref(false)
// Set while the scroll is moving the tile, so it follows without the spring.
const scrolling = ref(false)
const tilt = ref(0)
// Merged by scrolling, so scrolling back up can undo it.
let scrollMerged = false
// After "Pull them apart", scrolling won't merge them again until the section
// has gone back down the screen.
let armed = true
const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let start = null
let mergeTimer

function onPointerDown(event) {
  if (merging.value) return
  // Stops the browser starting a text selection instead of the drag.
  event.preventDefault()
  scrolling.value = false
  tilt.value = 0
  dragging.value = true
  start = { x: event.clientX - offset.value.x, y: event.clientY - offset.value.y }
  tile.value.setPointerCapture(event.pointerId)
}

function onPointerMove(event) {
  if (!dragging.value) return
  offset.value = { x: event.clientX - start.x, y: event.clientY - start.y }
}

// Dropped over the journal merges them; anywhere else springs back.
function onPointerUp(event) {
  if (!dragging.value) return
  onPointerMove(event)
  dragging.value = false
  const box = tile.value.getBoundingClientRect()
  const target = journal.value.$el.getBoundingClientRect()
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  const inside =
    x > target.left - 20 && x < target.right + 20 && y > target.top - 20 && y < target.bottom + 20
  if (inside) merge()
  else offset.value = { x: 0, y: 0 }
}

// How far the journal's middle is from the tile's resting place. Layout
// positions ignore the tile's movement, so this is right even mid-slide.
function restDistance() {
  const from = tile.value
  const to = journal.value.$el
  return {
    x: to.offsetLeft + to.offsetWidth / 2 - (from.offsetLeft + from.offsetWidth / 2),
    y: to.offsetTop + to.offsetHeight / 2 - (from.offsetTop + from.offsetHeight / 2),
  }
}

function merge() {
  if (merging.value || merged.value) return
  if (reduceMotion) {
    merged.value = true
    return
  }
  // The tile flies into the middle of the journal and shrinks away first.
  offset.value = restDistance()
  merging.value = true
  mergeTimer = window.setTimeout(() => {
    merged.value = true
    merging.value = false
  }, 420)
}

function pullApart() {
  merged.value = false
  offset.value = { x: 0, y: 0 }
  tilt.value = 0
}

function pullApartByHand() {
  pullApart()
  armed = scrollMerged = false
}

// 0 while the section sits low on the screen, or at the top of the page, and
// 1 once its top is a third of the way down. On a tall screen the section can
// start high up, so the count starts from where it sits before any scrolling.
function scrollProgress() {
  const top = section.value.getBoundingClientRect().top
  const view = window.innerHeight
  const start = Math.min(view * 0.75, top + window.scrollY)
  const end = view * 0.3
  if (start <= end) return Math.min(1, window.scrollY / 200)
  return Math.min(1, Math.max(0, (start - top) / (start - end)))
}

function onScroll() {
  if (dragging.value || merging.value || !section.value) return
  const progress = scrollProgress()
  if (progress < 0.2) armed = true
  if (merged.value) {
    if (scrollMerged && progress < 0.5) {
      scrollMerged = false
      pullApart()
    }
    return
  }
  if (!armed) return
  if (progress >= 1) {
    scrollMerged = true
    merge()
    return
  }
  const { x, y } = restDistance()
  scrolling.value = true
  offset.value = { x: x * progress * 0.85, y: y * progress * 0.85 }
  tilt.value = -14 * progress
}

onMounted(() => {
  if (!reduceMotion) window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  window.clearTimeout(mergeTimer)
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <section ref="section" class="music-journal landing-shell" aria-label="Spotify and journal">
    <!-- v-show keeps the 3D canvases alive, so pulling them apart is instant. -->
    <div v-show="!merged" class="pair">
      <div
        ref="tile"
        class="tile"
        :class="{ 'is-dragging': dragging, 'is-merging': merging, 'is-scrolling': scrolling }"
        :style="{ transform: `translate(${offset.x}px, ${offset.y}px) rotate(${tilt}deg)` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <LandingObject3D class="spotify-image" object="spotify" :rotatable="false" />
      </div>
      <span class="plus-sign" aria-hidden="true">+</span>
      <LandingObject3D
        ref="journal"
        class="journal-image"
        :class="{ 'is-catching': merging }"
        object="journal"
      />
    </div>

    <div v-if="merged" class="merged" role="status">
      <div class="burst" aria-hidden="true">
        <span v-for="index in 8" :key="index" :style="{ '--angle': `${index * 45}deg` }">{{
          index % 2 ? '♪' : '♫'
        }}</span>
      </div>
      <ButterflyMark class="merged-mark" :size="120" />
      <p class="merged-text">Your music + your words = <strong>MetaFor</strong></p>
    </div>

    <button v-if="merged" type="button" class="hint" @click="pullApartByHand">
      Pull them apart
    </button>
    <button v-else type="button" class="hint" @click="merge">
      Scroll, or drag Spotify into your journal
    </button>
  </section>
</template>

<style scoped>
.music-journal {
  display: flex;
  min-height: 245px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-block: 24px 56px;
}
.pair {
  display: flex;
  user-select: none;
  align-items: center;
  justify-content: center;
  gap: clamp(24px, 5vw, 64px);
}
.tile {
  position: relative;
  z-index: 2;
  cursor: grab;
  touch-action: none;
  transition: transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tile.is-scrolling {
  transition: transform 120ms linear;
}
.tile.is-dragging {
  cursor: grabbing;
  transition: none;
}
.tile.is-merging {
  opacity: 0;
  scale: 0.25;
  transition:
    transform 400ms cubic-bezier(0.55, 0, 0.45, 1),
    scale 400ms ease-in,
    opacity 400ms ease-in;
}
.spotify-image {
  width: clamp(130px, 18vw, 190px);
  height: clamp(130px, 18vw, 190px);
}
.plus-sign {
  color: var(--ui-text);
  font-family: var(--font-sans);
  font-size: clamp(2.8rem, 6vw, 4.3rem);
  font-weight: 500;
  line-height: 1;
}
.journal-image {
  width: clamp(190px, 28vw, 300px);
  height: clamp(170px, 22vw, 230px);
}
/* A little squash as the tile lands in it. */
.journal-image.is-catching {
  animation: catch 420ms ease 200ms;
}

.merged {
  position: relative;
  display: flex;
  min-height: clamp(170px, 22vw, 230px);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--ui-primary);
}
.merged-mark {
  animation: grow 520ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.merged-text {
  margin: 0;
  color: var(--ui-text);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  animation: rise 500ms ease 200ms both;
}
.merged-text strong {
  color: var(--ui-primary);
  font-family: var(--font-sans);
}
/* Notes fly out in a ring from behind the butterfly. */
.burst {
  position: absolute;
  top: 40%;
  left: 50%;
  pointer-events: none;
}
.burst span {
  position: absolute;
  font-size: 1.6rem;
  opacity: 0;
  animation: burst 1100ms ease-out forwards;
}
.hint {
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  color: var(--ui-primary);
  background: transparent;
  font-family: var(--font-sans);
  font-size: 0.74rem;
  cursor: pointer;
}
.hint:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.hint:focus-visible {
  outline: 3px solid var(--color-brand-400);
}

@keyframes catch {
  40% {
    transform: scale(1.08, 0.94);
  }
}
@keyframes grow {
  from {
    opacity: 0;
    transform: scale(0.3) rotate(-12deg);
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@keyframes burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0)
      rotate(calc(-1 * var(--angle))) scale(0.6);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-130px)
      rotate(calc(-1 * var(--angle))) scale(1.1);
  }
}

@media (max-width: 768px) {
  .music-journal {
    min-height: 185px;
  }
  .pair {
    gap: 18px;
  }
  .spotify-image {
    width: min(27vw, 150px);
    height: min(27vw, 150px);
  }
  .plus-sign {
    font-size: 2.7rem;
  }
  .journal-image {
    width: min(46vw, 235px);
    height: min(38vw, 190px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile,
  .journal-image,
  .merged-mark,
  .merged-text,
  .burst {
    transition: none;
    animation: none;
  }
}
</style>
