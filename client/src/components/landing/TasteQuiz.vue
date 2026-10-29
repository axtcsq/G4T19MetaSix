<script setup>
import { computed, ref } from 'vue'
import { typeIcon } from '@/utils/typeIcons'

// A three-question taste test on the landing page, beside the song search.
// The landing page gives the pair its heading. Each answer leans towards
// one MetaFor personality, and the result is a teaser for the real quizzes.
const TYPES = {
  'storm-chaser': { name: 'The Storm Chaser', tagline: 'Loud, restless and always hunting the next big sound.' },
  'tide-keeper': { name: 'The Tide Keeper', tagline: 'Steady, calm and loyal to the songs that hold you.' },
  poet: { name: 'The Poet', tagline: 'You hear every word and keep the ones that matter.' },
  daydreamer: { name: 'The Daydreamer', tagline: 'Soft textures, headphones on, somewhere far away.' },
  spark: { name: 'The Spark', tagline: 'Hand you the aux and the room lights up.' },
  wanderer: { name: 'The Wanderer', tagline: 'No home genre, just the next interesting sound.' },
}

const QUESTIONS = [
  {
    text: 'It’s 1am and you can’t sleep. You put on…',
    answers: [
      ['Something loud to shake it off', 'storm-chaser'],
      ['A slow song where every word hits', 'poet'],
      ['Rain sounds and a soft playlist', 'daydreamer'],
      ['The same comfort song as always', 'tide-keeper'],
    ],
  },
  {
    text: 'A friend hands you the aux. You…',
    answers: [
      ['Play the one everyone can sing to', 'spark'],
      ['Pick something nobody’s heard yet', 'wanderer'],
      ['Choose the song with the best lyrics', 'poet'],
      ['Hand it back. Music is personal', 'daydreamer'],
    ],
  },
  {
    text: 'Your year in music would say…',
    answers: [
      ['200 genres and no favourite', 'wanderer'],
      ['One artist, on repeat, all year', 'tide-keeper'],
      ['Mostly high-energy workout mixes', 'storm-chaser'],
      ['Party playlists and road-trip songs', 'spark'],
    ],
  },
]

const picks = ref([])
const step = computed(() => picks.value.length)
const done = computed(() => step.value === QUESTIONS.length)

// The type picked most; a tie goes to the earliest answer.
const result = computed(() => {
  if (!done.value) return null
  const counts = {}
  for (const type of picks.value) counts[type] = (counts[type] ?? 0) + 1
  const best = Math.max(...Object.values(counts))
  const id = picks.value.find((type) => counts[type] === best)
  return { id, ...TYPES[id] }
})
</script>

<template>
  <div class="taste-card" aria-live="polite">
    <Transition name="swap" mode="out-in">
      <div v-if="!done" :key="step" class="taste-question">
        <p class="taste-step">Question {{ step + 1 }} of {{ QUESTIONS.length }}</p>
        <div class="taste-progress" aria-hidden="true">
          <span v-for="index in QUESTIONS.length" :key="index" :class="{ 'is-done': index <= step }" />
        </div>
        <h3>{{ QUESTIONS[step].text }}</h3>
        <div class="taste-answers">
          <button v-for="[label, type] in QUESTIONS[step].answers" :key="label" type="button" @click="picks.push(type)">
            {{ label }}
          </button>
        </div>
      </div>

      <div v-else key="result" class="taste-result">
        <img class="taste-icon" :src="typeIcon(result.id)" alt="" width="80" height="80" />
        <p class="taste-step">You might be</p>
        <h3>{{ result.name }}</h3>
        <p class="taste-tagline">{{ result.tagline }}</p>
        <div class="taste-actions">
          <RouterLink class="taste-cta" to="/quiz">Take the full quizzes →</RouterLink>
          <button type="button" class="taste-again glass-secondary" @click="picks = []">Try again</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.taste-card {
  display: grid;
  min-height: 320px;
  padding: 32px;
  place-items: center;
  border: 1px solid var(--ui-border);
  border-radius: 18px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 6px 18px rgba(125, 71, 55, 0.08);
  text-align: center;
}
.taste-question,
.taste-result {
  width: 100%;
}
.taste-step {
  margin: 0 0 8px;
  color: var(--ui-primary);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.taste-progress {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 18px;
}
.taste-progress span {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--ui-bg-accented);
  transition: background-color 300ms ease;
}
.taste-progress .is-done {
  background: var(--ui-primary);
}
.taste-card h3 {
  margin: 0 0 22px;
  color: var(--ui-text);
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}
.taste-answers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.taste-answers button {
  min-height: 56px;
  padding: 10px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  color: var(--ui-text);
  background: var(--ui-bg);
  font-family: var(--font-serif);
  font-size: 1.05rem;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background-color 160ms ease;
}
.taste-answers button:hover {
  border-color: var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg));
  transform: translateY(-2px);
}
.taste-card button:focus-visible,
.taste-cta:focus-visible {
  outline: 3px solid var(--color-brand-400);
  outline-offset: 2px;
}
.taste-icon {
  display: block;
  margin: 0 auto 12px;
  animation: grow 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* The icons are black line art, so they're flipped to light in dark mode. */
:global(.dark .taste-icon) {
  filter: invert(0.94);
}
.taste-result h3 {
  margin-bottom: 8px;
  font-size: clamp(1.6rem, 3vw, 2rem);
  font-weight: 800;
}
.taste-tagline {
  margin: 0 0 22px;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
}
.taste-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  align-items: center;
}
.taste-cta {
  padding: 10px 18px;
  border-radius: 999px;
  color: #fff;
  background: var(--ui-primary);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}

.swap-enter-active,
.swap-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}
.swap-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.swap-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
@keyframes grow {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
}

@media (max-width: 600px) {
  .taste-card {
    padding: 22px 18px;
  }
  .taste-answers {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .swap-enter-active,
  .swap-leave-active,
  .taste-answers button,
  .taste-icon {
    transition: none;
    animation: none;
  }
}

</style>
