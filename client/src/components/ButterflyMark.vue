<script setup>
// The MetaFor butterfly: open line wings and a rounded body, drawn in
// currentColor so its parent sets the colour for light and dark mode.
// The right half mirrors the left. Antennae only show at larger sizes.
defineProps({
  size: { type: Number, default: 32 },
  antennae: { type: Boolean, default: false },
})
</script>

<template>
  <svg
    class="butterfly-mark"
    viewBox="-2 0 68 60"
    :width="size * (68 / 60)"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="antennae ? 1.6 : 2.8"
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
    <g fill="currentColor" stroke="none">
      <circle cx="32" cy="20.8" r="2.1" />
      <ellipse cx="32" cy="26.8" rx="2.6" ry="4" />
      <path
        d="M32 30.6C34.4 30.6 35 34 34.7 38.5C34.4 42.8 33.6 46.4 32 46.9C30.4 46.4 29.6 42.8 29.3 38.5C29 34 29.6 30.6 32 30.6Z"
      />
    </g>
    <g v-if="antennae" stroke-width="0.9">
      <path d="M31.3 19C30 13.5 27.5 9.5 24.5 8" />
      <path d="M32.7 19C34 13.5 36.5 9.5 39.5 8" />
      <circle cx="24.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="39.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </g>
  </svg>
</template>
