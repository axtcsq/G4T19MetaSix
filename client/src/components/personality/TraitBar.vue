<script setup>
import { computed } from 'vue'

// A trait or scale from the server, scored from -1 (second pole) to 1 (first pole).
const props = defineProps({
  trait: { type: Object, required: true },
  // A slimmer bar for tight layouts such as the Patterns card.
  compact: { type: Boolean, default: false },
})

// Scores this close to 0 don't lean either way (the same as How It Adds Up).
const BALANCED = 0.05

const isBalanced = computed(() => Math.abs(props.trait.score) < BALANCED)
const leansFirst = computed(() => !isBalanced.value && props.trait.score > 0)
const leansSecond = computed(() => !isBalanced.value && props.trait.score < 0)
const leanName = computed(() => (leansSecond.value ? props.trait.secondPoleName : props.trait.firstPoleName))
// From 50 (balanced) to 100, the same number the share card shows.
const leanPercent = computed(() => Math.round(((Math.abs(props.trait.score) + 1) / 2) * 100))
const firstLabel = computed(() =>
  leansFirst.value ? `${props.trait.firstPoleName} ${leanPercent.value}%` : props.trait.firstPoleName,
)
const secondLabel = computed(() =>
  leansSecond.value ? `${leanPercent.value}% ${props.trait.secondPoleName}` : props.trait.secondPoleName,
)
const meterLabel = computed(() => {
  const name = props.trait.label ?? `${props.trait.firstPoleName} or ${props.trait.secondPoleName}`
  return isBalanced.value ? `${name}: balanced` : `${name}: ${leanPercent.value}% ${leanName.value}`
})
// The fill starts at the middle line and grows towards the side the user leans to, so half the rail is the strongest lean.
const fillWidth = computed(() => `${isBalanced.value ? 0 : Math.abs(props.trait.score) * 50}%`)
</script>

<template>
  <div class="trait-bar" :class="{ 'is-compact': compact }">
    <div class="trait-labels">
      <span :class="{ 'is-lean': leansFirst }">{{ firstLabel }}</span>
      <span v-if="isBalanced" class="trait-balanced">Balanced</span>
      <span :class="{ 'is-lean': leansSecond }">{{ secondLabel }}</span>
    </div>
    <div
      class="trait-track"
      role="meter"
      :aria-label="meterLabel"
      :aria-valuenow="leanPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="trait-rail">
        <div class="trait-fill" :class="{ 'is-second': leansSecond }" :style="{ width: fillWidth }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.trait-labels {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--pq-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  font-weight: 400;
}

/* The side the user leans to stands out from the other one. */
.is-lean {
  color: var(--pq-on-surface);
  font-weight: 700;
}

.trait-balanced {
  font-style: italic;
}

.trait-track {
  margin-top: 0.15rem;
  padding: 10px 13px;
  border: 1px solid var(--pq-border-strong);
  border-radius: 40px;
}

.trait-rail {
  position: relative;
  height: 33px;
  overflow: hidden;
  border-radius: 40px;
  background: var(--pq-rail);
}

/* The middle line: no lean either way. */
.trait-rail::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
  background: var(--pq-on-surface);
  content: '';
}

.trait-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  border-radius: 0 40px 40px 0;
  background: var(--pq-accent);
  transition: width 320ms ease;
}

.trait-fill.is-second {
  right: 50%;
  left: auto;
  border-radius: 40px 0 0 40px;
}

.is-compact .trait-labels {
  font-size: var(--text-small);
}

.is-compact .trait-track {
  padding: 6px 9px;
}

.is-compact .trait-rail {
  height: 20px;
}

@media (max-width: 600px) {
  .trait-labels {
    font-size: var(--text-small);
  }

  .trait-rail {
    height: 24px;
  }
}
</style>
