<script setup>
// The MetaFor butterfly: just its open line wings, drawn in
// currentColor so its parent sets the colour for light and dark mode.
// The right half mirrors the left. Lines get thicker at small sizes so the
// wings stay visible.
import { computed } from 'vue'

const props = defineProps({
  size: { type: Number, default: 32 },
})

const isSmall = computed(() => props.size < 48)
</script>

<template>
  <svg
    class="butterfly-mark"
    viewBox="-2 0 68 60"
    :width="size * (68 / 60)"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="isSmall ? 2.8 : 1.6"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <g>
      <path
        d="M30.5 27.5C27.5 17 19 5 6 3C1 2.5 -1 7 0 13C1.5 21 8 29 17 31C23 32 28 31.5 30.5 30.5Z"
      />
      <path
        d="M30.5 33C26 33 18.5 33.5 14.5 37.5C10.5 41.5 11.5 48.5 16.5 50.5C21.5 52.5 27 47 29.5 40.5C30.5 38 30.8 35.5 30.5 33Z"
      />
    </g>
    <g transform="translate(64 0) scale(-1 1)">
      <path
        d="M30.5 27.5C27.5 17 19 5 6 3C1 2.5 -1 7 0 13C1.5 21 8 29 17 31C23 32 28 31.5 30.5 30.5Z"
      />
      <path
        d="M30.5 33C26 33 18.5 33.5 14.5 37.5C10.5 41.5 11.5 48.5 16.5 50.5C21.5 52.5 27 47 29.5 40.5C30.5 38 30.8 35.5 30.5 33Z"
      />
    </g>
  </svg>
</template>
