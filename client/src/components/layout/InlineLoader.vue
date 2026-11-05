<script setup>
// A small spinner beside some text, for waits inside a card or under a search box.
// RecordLoader is the bigger one, for a whole page or section.
defineOptions({ name: 'InlineLoader' })
defineProps({
  label: { type: String, default: 'Loading…' },
})
</script>

<template>
  <span class="inline-loader" role="status" aria-live="polite">
    <span class="spin-ring" aria-hidden="true" />{{ label }}
  </span>
</template>

<style scoped>
.inline-loader {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
