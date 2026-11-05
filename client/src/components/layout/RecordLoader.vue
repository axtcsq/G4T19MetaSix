<script setup>
// A spinning record, for pages waiting on a song or a result.
defineOptions({ name: 'RecordLoader' })
defineProps({
  label: { type: String, default: 'Loading…' },
})
</script>

<template>
  <div class="record-loader" role="status" aria-live="polite">
    <span class="record" aria-hidden="true"><span class="record-label" /></span>
    <p class="record-text">{{ label }}</p>
  </div>
</template>

<style scoped>
/* Fades in after a moment, so a quick load doesn't flash it. */
.record-loader {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding-block: 48px;
  animation: record-appear 240ms ease 160ms both;
}
.record {
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  border-radius: 50%;
  /* Two wedges of light show the turning; the rings are the grooves. */
  background:
    conic-gradient(
      rgb(255 255 255 / 16%) 0deg 36deg,
      transparent 36deg 180deg,
      rgb(255 255 255 / 16%) 180deg 216deg,
      transparent 216deg
    ),
    repeating-radial-gradient(circle, #292321 0 3px, #3a312d 3px 4px);
  animation: record-spin 1.8s linear infinite;
}
.record-label {
  width: 34px;
  height: 34px;
  border: 12px solid var(--ui-primary);
  border-radius: 50%;
  background: var(--ui-bg);
}
.record-text {
  margin: 0;
  color: var(--ui-text-muted);
  font: var(--text-small) / 1.4 var(--font-sans);
  text-align: center;
}
:global(.dark) .record {
  box-shadow: 0 0 0 1px rgb(255 255 255 / 14%);
}
@keyframes record-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes record-appear {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .record-loader,
  .record {
    animation: none;
  }
}
</style>
