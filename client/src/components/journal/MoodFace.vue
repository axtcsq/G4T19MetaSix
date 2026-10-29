<script setup>
import { computed } from 'vue'

const props = defineProps({ mood: { type: String, required: true } })
const faces = {
  Happy: { eyes: 'M13 17v1m14-1v1', mouth: 'M12 23q8 8 16 0' },
  Sad: { eyes: 'M13 18v1m14-1v1', brows: 'M10 15l5-2m10 0 5 2', mouth: 'M13 27q7-8 14 0' },
  Relaxed: { eyes: 'M10 17q3 3 6 0m8 0q3 3 6 0', mouth: 'M14 24q6 5 12-1' },
  Anxious: {
    eyes: 'M12 17v2m15-2v2',
    brows: 'm10 13 5-2m10 0 5 2',
    mouth: 'M13 26l4-2 4 2 5-2',
    extra: 'M33 7q5 5 0 6-4 0 0-6Z',
  },
  Angry: { eyes: 'M13 18v1m14-1v1', brows: 'm10 12 6 3m8 0 6-3', mouth: 'M13 27q7-6 14 0' },
}
const face = computed(() => faces[props.mood] || faces.Relaxed)
</script>

<template>
  <svg viewBox="0 0 40 40" aria-hidden="true" class="mood-face">
    <path d="M35 21c1-9-5-16-14-17C12 3 5 9 4 18c-1 10 5 17 15 18 9 1 15-5 16-15Z" />
    <g class="face-rest">
      <path v-if="face.brows" :d="face.brows" />
      <path class="face-eyes" :d="face.eyes" />
      <path class="face-mouth" :d="face.mouth" />
      <path v-if="face.extra" :d="face.extra" />
    </g>

    <g class="face-expression">
      <g v-if="mood === 'Happy'">
        <path d="M11 17q2-3 4 0" />
        <path class="wink-eye" d="M25 17q2-3 4 0" />
        <path d="M12 23q8 9 16 0" />
      </g>
      <g v-else-if="mood === 'Sad'">
        <path d="m10 14 6-3m8 0 6 3M10 18q3 4 6 0m8 0q3 4 6 0M13 28q7-9 14 0" />
        <path class="sad-tear" d="M11 22q-5 6 0 6t0-6Z" />
      </g>
      <g v-else-if="mood === 'Relaxed'">
        <path d="M9 18q4 5 8 0m6 0q4 5 8 0M14 25q6 6 12-1" />
        <path class="calm-breath" d="m29 26 4 1m-3 3 3 2" />
      </g>
      <g v-else-if="mood === 'Anxious'">
        <path d="m9 12 7-3m8 0 7 3M16 27q4-4 8 0q-4 4-8 0Z" />
        <circle cx="13" cy="18" r="4" />
        <circle cx="27" cy="18" r="4" />
        <g class="anxious-pupils"><path d="M13 17v2m14-2v2" /></g>
        <path class="anxious-drop" d="M33 6q5 6 0 6t0-6Z" />
      </g>
      <g v-else-if="mood === 'Angry'">
        <g class="angry-brows"><path d="m9 11 8 5m6 0 8-5" /></g>
        <path d="M13 19v1m14-1v1M12 28q8-11 16 0ZM12 8l-2-3m18 3 2-3" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.mood-face {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.face-rest,
.face-expression {
  transition: opacity 140ms ease;
}
.face-expression {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .face-rest,
  .face-expression {
    transition: none;
  }
}
</style>
