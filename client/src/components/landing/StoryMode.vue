<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { typeIcon } from '@/utils/typeIcons'

// A full-screen, tap-through story, like Spotify Wrapped. The landing page
// shows a made-up week ("See how it works"); Home passes its own slides for the
// user's day, and its own button through the trigger slot. Each slide moves on
// by itself after a few seconds; tap or press the arrow keys to go back and
// forward, space to pause, Esc to close.
const SLIDE_MS = 5000
const EXAMPLE_WEEK = [
  { kicker: 'A preview', title: 'This is what MetaFor could show you.', text: 'An example week, made up for this preview.', colour: '#7d4737' },
  { kicker: 'This week', big: '142', title: 'songs played', text: 'That’s about eight hours of music.', colour: '#cd6651' },
  { kicker: 'Your mood', big: '😌', title: 'Mostly Relaxed', text: 'Soft, acoustic and slow: 46% of your week.', colour: '#998ba1' },
  { kicker: 'On repeat', title: 'Sunlit Window', text: 'Your top song. Played 23 times, mostly after 10pm.', colour: '#4389d1' },
  { kicker: 'Your journal', title: 'Monday felt heavy.', text: 'You logged Sad and played your slowest songs. By Wednesday, things were looking up.', colour: '#665f78' },
  { kicker: 'You might be', title: 'The Daydreamer', text: 'Soft textures, headphones on, somewhere far away.', colour: '#763e32', type: 'daydreamer', last: true },
]

const props = defineProps({
  // { kicker, big, image, title, text, colour, type, link: { to, text }, last }
  // Leave out for the landing page's example week.
  slides: { type: Array, default: null },
  label: { type: String, default: 'How MetaFor works, an example week' },
  // The main button on the last slide.
  finish: { type: Object, default: () => ({ to: '/login', text: 'Get started' }) },
})

const slides = computed(() => props.slides ?? EXAMPLE_WEEK)
const open = ref(false)
const index = ref(0)
const paused = ref(false)
const elapsed = ref(0)
const dialog = ref(null)
const slide = computed(() => slides.value[index.value])
let opener
let frame
let lastTime

function tick(time) {
  frame = requestAnimationFrame(tick)
  if (lastTime === undefined) lastTime = time
  if (!paused.value) elapsed.value += time - lastTime
  lastTime = time
  if (elapsed.value >= SLIDE_MS && !slide.value.last) go(1)
}

function go(step) {
  const next = index.value + step
  if (next < 0) return
  if (next >= slides.value.length) return close()
  index.value = next
  elapsed.value = 0
}

function start() {
  // "Watch again" restarts it, so keep the button that first opened it.
  if (!open.value) opener = document.activeElement
  index.value = 0
  elapsed.value = 0
  paused.value = false
  open.value = true
}

function close() {
  open.value = false
}

function onKey(event) {
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowRight') go(1)
  else if (event.key === 'ArrowLeft') go(-1)
  else if (event.key === ' ') {
    event.preventDefault()
    paused.value = !paused.value
  }
}

// A tap on the left third goes back; anywhere else goes forward.
function onTap(event) {
  if (event.target.closest('button, a')) return
  const box = dialog.value.getBoundingClientRect()
  go(event.clientX - box.left < box.width / 3 ? -1 : 1)
}

watch(open, async (isOpen) => {
  document.documentElement.style.overflow = isOpen ? 'hidden' : ''
  cancelAnimationFrame(frame)
  if (isOpen) {
    window.addEventListener('keydown', onKey)
    lastTime = undefined
    frame = requestAnimationFrame(tick)
    await nextTick()
    dialog.value?.focus()
  } else {
    window.removeEventListener('keydown', onKey)
    opener?.focus?.()
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})

const fill = (position) => {
  if (position < index.value) return '100%'
  if (position > index.value) return '0%'
  return `${Math.min(100, (elapsed.value / SLIDE_MS) * 100)}%`
}
</script>

<template>
  <slot name="trigger" :open="start">
    <button type="button" class="story-open" @click="start">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
      See how it works
    </button>
  </slot>

  <Teleport to="body">
    <Transition name="story">
      <div
        v-if="open"
        ref="dialog"
        class="story"
        :style="{ '--slide': slide.colour }"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
        tabindex="-1"
        @click="onTap"
      >
        <div class="story-bars" aria-hidden="true">
          <span v-for="(_, position) in slides" :key="position"><i :style="{ width: fill(position) }" /></span>
        </div>
        <div class="story-tools">
          <button type="button" :aria-label="paused ? 'Play' : 'Pause'" @click="paused = !paused">
            <svg v-if="paused" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
            <svg v-else viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" />
            </svg>
          </button>
          <button type="button" aria-label="Close" @click="close">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" /></svg>
          </button>
        </div>

        <Transition name="slide" mode="out-in">
          <div :key="index" class="story-slide" aria-live="polite">
            <img v-if="slide.type" class="story-icon" :src="typeIcon(slide.type)" alt="" width="96" height="96" />
            <img v-else-if="slide.image" class="story-art" :src="slide.image" alt="" width="160" height="160" />
            <p class="story-kicker">{{ slide.kicker }}</p>
            <p v-if="slide.big" class="story-big">{{ slide.big }}</p>
            <h2>{{ slide.title }}</h2>
            <p class="story-text">{{ slide.text }}</p>
            <div v-if="slide.link && !slide.last" class="story-actions">
              <RouterLink class="story-cta" :to="slide.link.to" @click="close">{{ slide.link.text }}</RouterLink>
            </div>
            <div v-if="slide.last" class="story-actions">
              <RouterLink class="story-cta" :to="finish.to" @click="close">{{ finish.text }}</RouterLink>
              <button type="button" class="story-again" @click="start">Watch again</button>
            </div>
          </div>
        </Transition>

        <p class="story-hint" aria-hidden="true">Tap to go on · ← → keys · Esc to close</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.story-open {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: var(--ui-primary);
  box-shadow: 0 6px 16px rgba(118, 62, 50, 0.22);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 160ms ease;
}
.story-open:hover {
  transform: translateY(-1px);
}
.story-open:focus-visible {
  outline: 3px solid var(--color-brand-400);
  outline-offset: 3px;
}
.story-open svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

/* Full screen, in each slide's colour fading to near black. */
.story {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #fff;
  background: radial-gradient(ellipse at 50% 30%, var(--slide), #1b1517 75%);
  transition: background 500ms ease;
  cursor: pointer;
  outline: none;
  user-select: none;
}
.story-bars {
  position: absolute;
  top: 16px;
  right: 16px;
  left: 16px;
  display: flex;
  gap: 4px;
}
.story-bars span {
  height: 3px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
}
.story-bars i {
  display: block;
  height: 100%;
  background: #fff;
}
.story-tools {
  position: absolute;
  top: 30px;
  right: 16px;
  display: flex;
  gap: 4px;
}
.story-tools button {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
}
.story-tools svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.story button:focus-visible,
.story-cta:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}
.story-slide {
  max-width: 34rem;
  text-align: center;
}
.story-icon {
  display: block;
  margin: 0 auto 16px;
  filter: invert(1);
}
.story-art {
  display: block;
  margin: 0 auto 20px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}
.story-kicker {
  margin: 0 0 12px;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0.8;
}
.story-big {
  margin: 0;
  font-family: var(--font-sans);
  font-size: clamp(4rem, 14vw, 7rem);
  font-weight: 800;
  line-height: 1;
}
.story h2 {
  margin: 0 0 14px;
  font-family: var(--font-sans);
  font-size: clamp(2rem, 6vw, 3.4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.story-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(1.1rem, 2.4vw, 1.4rem);
  line-height: 1.45;
  opacity: 0.9;
}
.story-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  align-items: center;
  margin-top: 28px;
}
.story-cta {
  padding: 12px 22px;
  border-radius: 999px;
  color: #3d1f17;
  background: #fff;
  font-family: var(--font-sans);
  font-weight: 700;
  text-decoration: none;
}
.story-again {
  border: 0;
  color: #fff;
  background: transparent;
  font-family: var(--font-sans);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}
.story-hint {
  position: absolute;
  bottom: 20px;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  opacity: 0.6;
}

.story-enter-active,
.story-leave-active {
  transition: opacity 250ms ease;
}
.story-enter-from,
.story-leave-to {
  opacity: 0;
}
.slide-enter-active,
.slide-leave-active {
  transition:
    opacity 260ms ease,
    transform 260ms ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.98);
}
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .story,
  .story-open,
  .story-enter-active,
  .story-leave-active,
  .slide-enter-active,
  .slide-leave-active {
    transition: none;
  }
}
</style>
