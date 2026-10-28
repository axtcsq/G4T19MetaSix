<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
defineProps({ playing: Boolean })
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
// Decorative rhythm, not audio analysis: Spotify does not expose the audio stream.
const bars = Array.from({ length: 64 }, (_, i) => ({
  height: 12 + Math.abs(Math.sin(i * 0.63) * Math.cos(i * 0.21)) * 78,
  delay: `${-(i % 11) * 0.19}s`,
  duration: `${1.2 + (i % 7) * 0.17}s`,
}))
</script>

<template>
  <div
    ref="element"
    class="ambient-wave"
    :class="{ 'is-playing': playing && visible && active }"
    aria-hidden="true"
  >
    <i
      v-for="(bar, i) in bars"
      :key="i"
      :style="{ height: `${bar.height}%`, '--delay': bar.delay, '--duration': bar.duration }"
    />
  </div>
</template>

<style scoped>
.ambient-wave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  height: 52px;
  color: var(--room-dark);
  opacity: 0.22;
  transition: opacity 250ms ease;
}
i {
  flex: 1;
  max-width: 4px;
  border-radius: 4px;
  background: linear-gradient(to top, currentColor, var(--record-color));
  transform: scaleY(0.18);
  animation: breathe var(--duration) ease-in-out var(--delay) infinite alternate paused;
}
.is-playing {
  opacity: 0.7;
}
.is-playing i {
  animation-play-state: running;
}
@keyframes breathe {
  from {
    transform: scaleY(0.25);
  }
  to {
    transform: scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  i {
    animation: none;
    transform: scaleY(0.35);
  }
}
</style>
