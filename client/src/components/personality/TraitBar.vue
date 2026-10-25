<script setup>
import { computed } from 'vue'

// A trait or scale from the server, scored from -1 (second pole) to 1 (first pole).
const props = defineProps({
  trait: { type: Object, required: true },
  // A slimmer bar for tight layouts such as the Patterns card.
  compact: { type: Boolean, default: false },
})

// The fill grows from the side the user leans towards, so a 100% lean either
// way is a full bar.
const leansSecond = computed(() => props.trait.score < 0)
const leanName = computed(() => (leansSecond.value ? props.trait.secondPoleName : props.trait.firstPoleName))
const fillPercent = computed(() => Math.round(((Math.abs(props.trait.score) + 1) / 2) * 100))
</script>

<template>
  <div class="trait-bar" :class="{ 'is-compact': compact }">
    <div class="trait-labels">
      <span>{{ trait.firstPoleName }}</span>
      <span>{{ trait.secondPoleName }}</span>
    </div>
    <div
      class="trait-track"
      role="meter"
      :aria-label="`${trait.label}: ${fillPercent}% ${leanName}`"
      :aria-valuenow="fillPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="trait-rail" :class="{ 'is-second': leansSecond }">
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
  color: var(--pq-on-surface);
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
}

.trait-track {
  margin-top: 0.15rem;
  padding: 10px 13px;
  border: 1px solid var(--pq-border-strong);
  border-radius: 40px;
}

.trait-rail {
  height: 33px;
  overflow: hidden;
  border-radius: 40px;
  background: var(--pq-rail);
}

.trait-rail.is-second {
  display: flex;
  justify-content: flex-end;
}

.trait-fill {
  height: 100%;
  border-radius: 40px;
  background: var(--pq-accent);
  transition: width 320ms ease;
}

.is-compact .trait-labels {
  font-size: 1.05rem;
}

.is-compact .trait-track {
  padding: 6px 9px;
}

.is-compact .trait-rail {
  height: 20px;
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
