<script setup>
import { computed, onMounted, onBeforeUnmount, ref, useId } from 'vue'

const props = defineProps({
  playing: Boolean,
  cover: { type: String, default: '' },
  tempo: { type: Number, default: null },
  progress: { type: Number, default: 0 },
})
const played = computed(
  () => `${Number.isFinite(props.progress) ? Math.max(0, Math.min(100, props.progress)) : 0}%`,
)
// One wavelength travels over two beats at the song's stored tempo.
const duration = computed(() =>
  Number.isFinite(props.tempo) && props.tempo > 0 ? `${120 / props.tempo}s` : '3s',
)
const id = useId()
const element = ref(null)
const visible = ref(false)
const active = ref(!document.hidden)
let observer
const visibility = () => {
  active.value = !document.hidden
}
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    visible.value = entry.isIntersecting
  })
  observer.observe(element.value)
  document.addEventListener('visibilitychange', visibility)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', visibility)
})
// One UI-style travelling line; tempo-paced decoration, not audio analysis.
const wave = Array.from({ length: 241 }, (_, i) => {
  const x = i * 5
  return `${i ? 'L' : 'M'}${x},${(50 + 18 * Math.sin((x * Math.PI) / 50)).toFixed(2)}`
}).join(' ')
</script>

<template>
  <div
    ref="element"
    class="ambient-wave"
    :class="{ 'is-playing': playing && visible && active }"
    :style="{ '--wave-duration': duration, '--played': played }"
    aria-hidden="true"
  >
    <div class="played-wave">
      <svg viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter :id="`${id}-blur`" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur stdDeviation="22" />
            <feColorMatrix type="saturate" values="1.6" />
          </filter>
          <linearGradient :id="`${id}-fallback`">
            <stop stop-color="var(--record-color)" />
            <stop offset="0.5" stop-color="var(--room-dark)" />
            <stop offset="1" stop-color="var(--record-color)" />
          </linearGradient>
          <pattern
            :id="`${id}-colors`"
            width="1"
            height="1"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
          >
            <rect width="1000" height="100" :fill="`url(#${id}-fallback)`" />
            <image
              v-if="cover"
              :href="cover"
              width="1000"
              height="100"
              preserveAspectRatio="none"
              :filter="`url(#${id}-blur)`"
            />
          </pattern>
        </defs>
        <path class="wave-line" :d="wave" :stroke="`url(#${id}-colors)`" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.ambient-wave {
  min-width: 0;
  position: relative;
  height: 28px;
  pointer-events: none;
}
.ambient-wave::before {
  content: '';
  position: absolute;
  inset: calc(50% - 1.5px) 0 auto var(--played);
  height: 3px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--room-ink) 18%, transparent);
}
.played-wave {
  position: absolute;
  inset: 0;
  clip-path: inset(0 calc(100% - var(--played)) 0 0);
}
svg {
  width: 120%;
  height: 100%;
  display: block;
  animation: travel var(--wave-duration) linear infinite paused;
}
.wave-line {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  transform-origin: center;
  transform: scaleY(0.08);
  transition: transform 220ms ease;
}
.is-playing svg {
  animation-play-state: running;
}
.is-playing .wave-line {
  transform: scaleY(1);
}
@keyframes travel {
  to {
    transform: translateX(-8.333333%);
  }
}
@media (forced-colors: active) {
  .ambient-wave {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  svg {
    animation: none;
  }
  .wave-line {
    transition: none;
  }
  .is-playing .wave-line {
    transform: scaleY(0.4);
  }
}
</style>
