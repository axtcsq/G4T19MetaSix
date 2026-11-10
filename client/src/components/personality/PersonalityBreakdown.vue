<script setup>
import { computed } from 'vue'

// A compact summary of what each quiz and the Spotify data said about the four MetaFor traits, and what they add up to.
const props = defineProps({
  personality: { type: Object, required: true },
})

// Scores this close to 0 don't lean either way, so they aren't shown.
const BALANCED = 0.05

const quizPercent = computed(() => Math.round((props.personality.weights?.quizzes ?? 0.7) * 100))
// Listening counts for less while there's only a little of it.
const listeningIsNew = computed(() => {
  const { spotify, full } = props.personality.weights ?? {}
  return typeof spotify === 'number' && typeof full === 'number' && spotify < full
})

function leanings(scores) {
  return props.personality.traits
    .filter((trait) => typeof scores[trait.id] === 'number' && Math.abs(scores[trait.id]) >= BALANCED)
    .map((trait) => ({
      id: trait.id,
      name: scores[trait.id] >= 0 ? trait.firstPoleName : trait.secondPoleName,
      strong: Math.abs(scores[trait.id]) >= 0.5,
    }))
}

// The blended result follows the same rules as the rows above it.
const totalLeanings = computed(() =>
  leanings(Object.fromEntries(props.personality.traits.map((trait) => [trait.id, trait.score]))),
)

const rows = computed(() =>
  props.personality.sources.map((source) => ({ ...source, leanings: leanings(source.traits) })),
)
</script>

<template>
  <div class="breakdown">
    <h3 class="breakdown-title">How It Adds Up</h3>
    <p class="breakdown-intro">
      Each row shows which traits that quiz or your listening points to. We blend them, with quizzes
      counting for {{ quizPercent }}% and listening for {{ 100 - quizPercent }}%, then match you to
      the closest MetaFor type.
      <template v-if="listeningIsNew">
        Your listening counts for less until MetaFor has about two weeks of it.
      </template>
    </p>
    <p class="legend">
      <span class="chip is-strong">Strong lean</span>
      <span class="chip">Slight lean</span>
    </p>

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
        <p class="source-name">
          All together
          <span class="source-total">You're closest to {{ personality.type.name }}</span>
        </p>
        <p class="chips">
          <span
            v-for="lean in totalLeanings"
            :key="lean.id"
            class="chip"
            :class="{ 'is-strong': lean.strong }"
          >
            {{ lean.name }}
          </span>
          <span v-if="totalLeanings.length === 0" class="chip is-empty">No strong lean</span>
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.breakdown-title {
  font-family: var(--font-sans);
  font-size: var(--text-lead);
  font-weight: 600;
}

.breakdown-intro {
  margin-top: 0.25rem;
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: var(--text-label);
  line-height: 1.4;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.source-list {
  margin-top: 0.5rem;
}

.source-row {
  display: grid;
  grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
  align-items: center;
  gap: 0.25rem 0.75rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--pq-line);
}

.source-row.is-total {
  border-bottom: 0;
}

.source-name {
  font-family: var(--font-sans);
  font-size: var(--text-label);
  font-weight: 700;
  line-height: 1.2;
}

.source-result {
  display: block;
  color: var(--pq-brown);
  font-family: var(--font-serif);
  font-size: var(--text-label);
  font-weight: 400;
  text-decoration: none;
}

.source-total {
  display: block;
  color: var(--pq-brown);
  font-family: var(--font-serif);
  font-size: var(--text-label);
  font-weight: 400;
}

.source-result:hover {
  color: var(--pq-accent);
  text-decoration: underline;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.chip {
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  color: var(--pq-brown);
  background: var(--pq-peach);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
}

.chip.is-strong {
  color: #fff;
  background: #ce5b4b;
}

.chip.is-empty {
  color: var(--pq-muted);
  background: var(--pq-tint);
}

@media (min-width: 1001px) {
  .source-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 2.5rem;
  }

  .source-row.is-total {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .source-row {
    grid-template-columns: 1fr;
  }
}
</style>
