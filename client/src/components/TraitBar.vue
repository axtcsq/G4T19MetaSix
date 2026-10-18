<script setup>
import { computed } from 'vue'

// A trait or scale from the server, scored from -1 (second pole) to 1 (first pole).
const props = defineProps({
  trait: { type: Object, required: true },
})

// The fill grows from the left, towards the first pole.
const fillPercent = computed(() => Math.round(((props.trait.score + 1) / 2) * 100))
</script>

<template>
  <div class="trait-bar">
    <div class="trait-labels">
      <span>{{ trait.firstPoleName }}</span>
      <span>{{ trait.secondPoleName }}</span>
    </div>
    <div
      class="trait-track"
      role="meter"
      :aria-label="`${trait.label}: ${fillPercent}% ${trait.firstPoleName}`"
      :aria-valuenow="fillPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="trait-rail">
        <div class="trait-fill" :style="{ width: `${fillPercent}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.trait-labels {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #000;
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
}

.trait-track {
  margin-top: 0.15rem;
  padding: 10px 13px;
  border: 1px solid rgba(118, 62, 50, 0.4);
  border-radius: 40px;
}

.trait-rail {
  height: 33px;
  overflow: hidden;
  border-radius: 40px;
  background: #ffcda6;
}

.trait-fill {
  height: 100%;
  border-radius: 40px;
  background: #ce5b4b;
  transition: width 320ms ease;
}

@media (max-width: 600px) {
  .trait-labels {
    font-size: 1.05rem;
  }

  .trait-rail {
    height: 24px;
  }
}
</style>
