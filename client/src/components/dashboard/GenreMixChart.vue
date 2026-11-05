<script setup>
import { computed, ref } from 'vue'
const props = defineProps({
  data: { type: Object, required: true },
  // Stops the disc turning, with the dashboard's Pause button.
  paused: Boolean,
})
const selected = ref(null)
const colors = ['#a65f46', '#827091', '#54766a', '#bd8b38', '#557f99', '#8b7770']
const label = (name) => name.charAt(0).toLocaleUpperCase() + name.slice(1)
const slices = computed(() => {
  let start = 0
  return props.data.genres.map((genre, index) => {
    const slice = { ...genre, label: label(genre.name), color: colors[index], offset: -start }
    start += genre.share
    return slice
  })
})
const active = computed(() => slices.value.find((slice) => slice.name === selected.value))
</script>
<template>
  <div
    v-if="slices.length"
    class="genre-mix"
    :class="{ 'is-paused': paused, 'has-selection': selected }"
  >
    <div class="genre-disc">
      <svg viewBox="0 0 120 120" role="img" aria-label="Genre mix; percentages listed alongside">
        <circle
          v-for="slice in slices"
          :key="slice.name"
          cx="60"
          cy="60"
          r="44"
          fill="none"
          :stroke="slice.color"
          :stroke-width="selected === slice.name ? 23 : 20"
          pathLength="100"
          :stroke-dasharray="`${slice.share} ${100 - slice.share}`"
          :stroke-dashoffset="slice.offset"
          :style="{ opacity: selected && selected !== slice.name ? 0.3 : 1 }"
          @pointerenter="selected = slice.name"
          @pointerleave="selected = null"
        />
      </svg>
      <div class="disc-label" aria-hidden="true">
        <strong>{{ active ? `${Math.round(active.share)}%` : slices.length }}</strong
        ><span>{{ active?.label ?? 'Genres' }}</span>
      </div>
    </div>
    <ul>
      <li v-for="slice in slices" :key="slice.name">
        <button
          type="button"
          :aria-pressed="selected === slice.name"
          @click="selected = selected === slice.name ? null : slice.name"
          @pointerenter="selected = slice.name"
          @pointerleave="selected = null"
          @focus="selected = slice.name"
          @blur="selected = null"
        >
          <span class="genre-dot" :style="{ background: slice.color }" />
          <span>{{ slice.label }}</span
          ><strong>{{ Math.round(slice.share) }}%</strong>
        </button>
      </li>
    </ul>
  </div>
  <div v-else class="genre-mix">
    <!-- An empty record until there are genres to put on it. -->
    <div class="genre-disc" aria-hidden="true" />
    <p class="genre-note">
      No genre tags available yet. Genres appear when your stored listening history has tagged
      artists.
    </p>
  </div>
</template>
<style scoped>
.genre-mix {
  position: relative;
  display: grid;
  grid-template-columns: minmax(140px, 220px) minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}
.genre-disc {
  position: relative;
  aspect-ratio: 1;
  padding: 7%;
}
.genre-disc::before {
  content: '';
  position: absolute;
  inset: 2%;
  border: 2px solid #4b3d32;
  border-radius: 50%;
  background:
    conic-gradient(from 0deg, transparent 0deg, rgb(238 218 194 / 12%) 22deg, transparent 48deg, transparent 190deg, rgb(238 218 194 / 7%) 215deg, transparent 250deg),
    repeating-radial-gradient(circle, rgb(197 176 152 / 13%) 0 1px, rgb(16 13 12 / 35%) 1px 3px, transparent 3px 4px),
    radial-gradient(circle, #171310 0 7%, #24201d 9% 52%, #342b24 54% 72%, #201b18 74% 94%, #4b3d32 96% 100%);
  box-shadow: inset 0 0 9px rgb(0 0 0 / 55%), 0 1px 3px rgb(0 0 0 / 30%);
  animation: genre-record-turn 36s linear infinite;
}
@keyframes genre-record-turn {
  to { transform: rotate(360deg); }
}
svg {
  position: relative;
  z-index: 1;
  width: 100%;
  transform: rotate(-90deg);
}
.is-paused .genre-disc::before,
.has-selection .genre-disc::before {
  animation-play-state: paused;
}
circle {
  transition:
    opacity 180ms,
    stroke-dasharray 450ms,
    stroke-width 180ms;
  animation: genre-reveal 500ms ease-out;
}
@keyframes genre-reveal {
  from {
    opacity: 0.25;
  }
  to {
    opacity: 1;
  }
}
.disc-label {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  pointer-events: none;
}
.disc-label strong {
  font: 600 var(--text-subheader) var(--font-serif);
}
.disc-label span {
  font: var(--text-caption) var(--font-sans);
  max-width: 85px;
  overflow-wrap: anywhere;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 6px;
  text-align: left;
  font: var(--text-label) var(--font-sans);
  cursor: pointer;
  border-radius: 6px;
}
button:hover,
button:focus-visible,
button[aria-pressed='true'] {
  background: var(--dash-hover);
}
button strong {
  flex: 0 0 auto;
}
.genre-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.genre-note {
  grid-column: 1/-1;
  color: var(--dash-muted);
  font: var(--text-label)/1.5 var(--font-sans);
}
@media (prefers-reduced-motion: reduce) {
  .genre-disc::before {
    animation: none;
  }
  circle {
    transition: none;
    animation: none;
  }
}
</style>
