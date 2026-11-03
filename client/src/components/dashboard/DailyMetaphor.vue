<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { metaphorFor } from '@/data/dailyMetaphors'

// Today's metaphor. If the page is left open past midnight, the new day's
// line shows the next time the tab comes back into view.
const line = ref(metaphorFor())
const refresh = () => {
  if (!document.hidden) line.value = metaphorFor()
}
onMounted(() => document.addEventListener('visibilitychange', refresh))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', refresh))
</script>

<template>
  <figure class="daily-metaphor">
    <figcaption class="metaphor-kicker">Today’s metaphor</figcaption>
    <blockquote class="metaphor-line">{{ line }}</blockquote>
  </figure>
</template>

<style scoped>
.daily-metaphor {
  margin: 0 0 24px;
  padding: 2px 0 2px 18px;
  border-left: 3px solid var(--color-brand-400);
}
.metaphor-kicker {
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.metaphor-line {
  margin: 4px 0 0;
  color: var(--ui-text);
  font-family: var(--font-serif);
  font-size: var(--text-quote);
  font-style: italic;
  line-height: 1.4;
}
@media (max-width: 600px) {
  .metaphor-line {
    font-size: 1.25rem;
  }
}
</style>
