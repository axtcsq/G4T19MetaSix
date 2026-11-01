<script setup>
// A soft light in the top-left corner, in the colour of today's main mood.
// Turned on and off on the profile page.
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'

const auth = useAuthStore()
const today = useTodayMoodStore()

const enabled = computed(() => Boolean(auth.user) && auth.user.preferences?.moodGlow !== false)

const color = computed(() =>
  today.mainMood ? `var(--color-mood-${today.mainMood.toLowerCase()}-500)` : null,
)
</script>

<template>
  <Transition name="mood-glow">
    <div v-if="enabled && color" class="mood-glow" :style="{ '--glow-color': color }" aria-hidden="true" />
  </Transition>
</template>

<style scoped>
/* Sits over the page, just under the navbar, and blends in so text stays readable. */
.mood-glow {
  position: fixed;
  z-index: 39;
  top: 0;
  left: 0;
  /* A lighter tint of the mood colour, so it reads as a clear wash of colour
     on the light page rather than a grey smudge. */
  --glow-tone: color-mix(in srgb, var(--glow-color) 60%, white);
  width: min(80vmax, 820px);
  height: min(80vmax, 820px);
  background: radial-gradient(
    circle at 0 0,
    color-mix(in srgb, var(--glow-tone) 85%, transparent) 0%,
    color-mix(in srgb, var(--glow-tone) 60%, transparent) 20%,
    color-mix(in srgb, var(--glow-tone) 30%, transparent) 40%,
    color-mix(in srgb, var(--glow-tone) 10%, transparent) 58%,
    transparent 75%
  );
  mix-blend-mode: multiply;
  pointer-events: none;
  transition: background 600ms ease;
}

:global(.dark .mood-glow) {
  width: min(70vmax, 720px);
  height: min(70vmax, 720px);
  background: radial-gradient(
    circle at 0 0,
    color-mix(in srgb, var(--glow-color) 70%, transparent) 0%,
    color-mix(in srgb, var(--glow-color) 35%, transparent) 30%,
    color-mix(in srgb, var(--glow-color) 12%, transparent) 50%,
    transparent 70%
  );
  mix-blend-mode: screen;
  opacity: 0.3;
}

.mood-glow-enter-active,
.mood-glow-leave-active {
  transition: opacity 600ms ease;
}

.mood-glow-enter-from,
.mood-glow-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .mood-glow,
  .mood-glow-enter-active,
  .mood-glow-leave-active {
    transition: none;
  }
}
</style>
