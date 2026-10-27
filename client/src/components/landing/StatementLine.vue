<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

// One oversized line near the end of the landing page, the only loud part of
// it. The words light up one at a time as it scrolls up the screen, over soft
// blurred colour that takes on the mood picked in the hero.
const WORDS = ['Your', 'music.', 'Your', 'words.', 'One', 'mirror.']
// A line break after each full stop.
const BREAKS = new Set([1, 3])

const section = ref(null)
const shown = ref(0)
let reduceMotion = false

function onScroll() {
  const top = section.value.getBoundingClientRect().top
  const view = window.innerHeight
  // All dim with its top at the bottom of the screen, all lit by the time it's
  // a fifth of the way down.
  const progress = Math.min(1, Math.max(0, (view * 0.85 - top) / (view * 0.65)))
  shown.value = Math.round(progress * WORDS.length)
}

onMounted(() => {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    shown.value = WORDS.length
    return
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <section ref="section" class="statement" aria-labelledby="statement-line">
    <div class="mood-light" aria-hidden="true"><span /><span /><span /></div>
    <h2 id="statement-line" class="statement-line">
      <template v-for="(word, index) in WORDS" :key="index">
        <span class="word" :class="{ 'is-lit': index < shown }">{{ word }}</span>
        <br v-if="BREAKS.has(index)" />
        <template v-else> </template>
      </template>
    </h2>
  </section>
</template>

<style scoped>
.statement {
  position: relative;
  display: grid;
  place-items: center;
  padding-block: clamp(80px, 12vw, 150px);
}
.statement-line {
  margin: 0;
  color: var(--color-brand-800);
  font-family: var(--font-serif);
  font-size: clamp(3rem, 10vw, 8.25rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 0.95;
  text-align: center;
}
:global(.dark) .statement-line {
  color: var(--color-brand-300);
}
.word {
  display: inline-block;
  opacity: 0.12;
  transform: translateY(0.12em);
  transition:
    opacity 450ms ease,
    transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.word.is-lit {
  opacity: 1;
  transform: none;
}

/* Three soft blobs: the picked mood (or the brand colour), lilac and blue,
   drifting slowly. */
.mood-light {
  position: absolute;
  z-index: -1;
  inset: 0;
  pointer-events: none;
}
.mood-light span {
  position: absolute;
  width: 42%;
  aspect-ratio: 3 / 2;
  border-radius: 50%;
  filter: blur(70px);
  animation: drift 18s ease-in-out infinite alternate;
}
.mood-light span:nth-child(1) {
  top: 18%;
  left: 8%;
  background: color-mix(in srgb, var(--mood-colour, var(--ui-primary)) 28%, transparent);
}
.mood-light span:nth-child(2) {
  top: 8%;
  left: 36%;
  background: color-mix(in srgb, #998ba1 30%, transparent);
  animation-duration: 22s;
  animation-delay: -6s;
}
.mood-light span:nth-child(3) {
  top: 34%;
  right: 6%;
  background: color-mix(in srgb, #4389d1 16%, transparent);
  animation-duration: 26s;
  animation-delay: -12s;
}
@keyframes drift {
  to {
    translate: 6% -8%;
    scale: 1.12;
  }
}

@media (prefers-reduced-motion: reduce) {
  .word,
  .mood-light span {
    animation: none;
    transition: none;
  }
}
</style>
