<script setup>
import { computed, onMounted, onBeforeUnmount, ref, useId } from 'vue'

const props = defineProps({
  playing: Boolean,
  cover: { type: String, default: '' },
  tempo: { type: Number, default: null },
})
// A full swell spans four beats; each alternating half spans two beats.
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
// Gentle decorative movement follows playback, not the song's audio samples.
const curves = [
  { center: 340, spread: 145, height: 34 },
  { center: 520, spread: 165, height: 44 },
  { center: 660, spread: 125, height: 30 },
].map(({ center, spread, height }) => {
  const points = Array.from({ length: 101 }, (_, i) => {
    const x = i * 10
    const y = 94 - height * Math.exp(-0.5 * ((x - center) / spread) ** 2)
    return x + ',' + y.toFixed(2)
  })
  return 'M0,94 L' + points.join(' L') + ' L1000,94Z'
})
</script>

<template>
  <div
    ref="element"
    class="ambient-wave"
    :class="{ 'is-playing': playing && visible && active }"
    :style="{ '--wave-duration': duration }"
  >
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
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
      <g :fill="`url(#${id}-colors)`">
        <path v-for="(curve, i) in curves" :key="i" class="bell-curve" :d="curve" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.ambient-wave {
  min-width: 0;
}
svg {
  width: 100%;
  height: 56px;
  display: block;
}
.bell-curve {
  opacity: 0.65;
  transform-origin: 50% 94%;
  animation: drift var(--wave-duration) ease-in-out infinite alternate paused;
}
.bell-curve:first-child {
  opacity: 0.4;
  animation-delay: calc(var(--wave-duration) * -0.65);
}
.bell-curve:last-child {
  opacity: 0.8;
  animation-delay: calc(var(--wave-duration) * -0.3);
}
.is-playing .bell-curve {
  animation-play-state: running;
}
@keyframes drift {
  from {
    transform: translateX(-12px) scaleY(0.7);
  }
  to {
    transform: translateX(12px) scaleY(1.1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bell-curve {
    animation: none;
  }
}
</style>
