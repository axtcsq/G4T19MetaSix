<script setup>
import { computed, ref } from 'vue'

// A compact summary of what each quiz and the Spotify data said about the
// four MetaFor traits, and what they add up to.
const props = defineProps({
  personality: { type: Object, required: true },
})

// Scores this close to 0 don't lean either way, so they aren't shown.
const BALANCED = 0.05

const showInfo = ref(false)
const quizPercent = computed(() => Math.round((props.personality.weights?.quizzes ?? 0.7) * 100))

function leanings(scores) {
  return props.personality.traits
    .filter((trait) => typeof scores[trait.id] === 'number' && Math.abs(scores[trait.id]) >= BALANCED)
    .map((trait) => ({
      id: trait.id,
      name: scores[trait.id] >= 0 ? trait.firstPoleName : trait.secondPoleName,
      strong: Math.abs(scores[trait.id]) >= 0.5,
    }))
}

const rows = computed(() =>
  props.personality.sources.map((source) => ({ ...source, leanings: leanings(source.traits) })),
)
</script>

<template>
  <div class="breakdown">
    <div class="breakdown-heading">
      <h3 class="breakdown-title">How it adds up</h3>
      <span class="info" @mouseenter="showInfo = true" @mouseleave="showInfo = false">
        <button
          type="button"
          class="info-button"
          aria-label="How your personality is worked out"
          aria-describedby="breakdown-info"
          :aria-expanded="showInfo"
          @click="showInfo = !showInfo"
          @focus="showInfo = true"
          @blur="showInfo = false"
        >
          i
        </button>
        <span id="breakdown-info" role="tooltip" class="info-tip" :class="{ 'is-open': showInfo }">
          Each quiz nudges you along the four MetaFor traits. We blend your quizzes
          ({{ quizPercent }}%) with your Spotify listening ({{ 100 - quizPercent }}%) and match you
          to the closest MetaFor type.
        </span>
      </span>
    </div>

    <ul class="source-list">
      <li v-for="row in rows" :key="row.id" class="source-row">
        <p class="source-name">
          {{ row.label }}
          <RouterLink
            v-if="row.kind === 'quiz'"
            class="source-result"
            :to="{ name: 'personality-result', params: { quizId: row.id } }"
          >
            {{ row.result }}
          </RouterLink>
        </p>
        <p class="chips">
          <span
            v-for="lean in row.leanings"
            :key="lean.id"
            class="chip"
            :class="{ 'is-strong': lean.strong }"
          >
            {{ lean.name }}
          </span>
          <span v-if="row.leanings.length === 0" class="chip is-empty">No strong lean</span>
        </p>
      </li>
      <li class="source-row is-total">
        <p class="source-name">All together</p>
        <p class="chips">
          <span
            v-for="trait in personality.traits"
            :key="trait.id"
            class="chip is-strong"
          >
            {{ trait.poleName }}
          </span>
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.breakdown-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.breakdown-title {
  font-family: var(--font-sans);
  font-size: 1.25rem;
  font-weight: 600;
}

.info {
  position: relative;
  display: inline-flex;
}

.info-button {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #665f78;
  border-radius: 50%;
  color: #665f78;
  background: #fff;
  font-family: var(--font-serif);
  font-size: 0.85rem;
  font-style: italic;
  font-weight: 700;
  cursor: help;
}

.info-button:focus-visible {
  outline: 3px solid rgba(206, 91, 75, 0.45);
  outline-offset: 2px;
}

.info-tip {
  position: absolute;
  z-index: 5;
  top: calc(100% + 8px);
  left: 50%;
  width: min(280px, 70vw);
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  color: #fff;
  background: #3b3446;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  line-height: 1.4;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -4px);
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.info-tip.is-open {
  opacity: 1;
  transform: translate(-50%, 0);
}

.source-list {
  margin-top: 0.75rem;
}

.source-row {
  display: grid;
  grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
  align-items: center;
  gap: 0.35rem 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid rgba(118, 62, 50, 0.12);
}

.source-row.is-total {
  border-bottom: 0;
}

.source-name {
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 700;
}

.source-result {
  display: block;
  color: #763e32;
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 400;
  text-decoration: none;
}

.source-result:hover {
  color: #ce5b4b;
  text-decoration: underline;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  color: #763e32;
  background: #ffe6d2;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
}

.chip.is-strong {
  color: #fff;
  background: #ce5b4b;
}

.chip.is-empty {
  color: #665f78;
  background: rgba(102, 95, 120, 0.1);
}

@media (max-width: 600px) {
  .source-row {
    grid-template-columns: 1fr;
  }
}
</style>
