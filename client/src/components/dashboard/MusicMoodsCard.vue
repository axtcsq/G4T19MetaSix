<script setup>
import { computed, ref } from 'vue'
const selected = ref(null)

// Home's Your Music's Moods: what the mood analysis heard in the user's last two weeks of plays, from
// musicMoods in /api/quiz/mood-music: one bar of how the plays spread over the
// journal's five moods, the music moods played most, and how often the music
// matched the mood they logged.
const props = defineProps({
  data: { type: Object, required: true },
})

const JOURNAL_MOOD = {
  happy: 'Happy',
  relaxed: 'Relaxed',
  sad: 'Sad',
  angry: 'Angry',
  anxious: 'Anxious',
}

const colour = (axis) => `var(--color-mood-${axis}-500)`

const lead = computed(() => {
  const [first] = props.data.top
  const journal = JOURNAL_MOOD[first.axis]
  return journal
    ? `Your music has mostly been ${first.name.toLowerCase()}, which reads as ${journal}.`
    : `Your music has mostly been ${first.name.toLowerCase()}.`
})

const match = computed(() => {
  const { comparedDays, matchedDays } = props.data
  if (!comparedDays)
    return 'Log your mood on days you listen to see if your music matches how you feel.'
  if (!matchedDays)
    return `On the ${comparedDays} days you logged, your music told a different story from your mood.`
  return `Your music matched how you felt on ${matchedDays} of the ${comparedDays} days you logged.`
})

const source = computed(() =>
  props.data.lens === 'lyrics'
    ? 'Read from how your songs sound and what they say.'
    : 'Read from how your songs sound.',
)
</script>

<template>
  <div class="music-moods">
    <div class="moods-copy">
      <h3 class="sub-header">Your Music’s Moods</h3>
      <p class="insight-text mt-2">{{ lead }} {{ match }}</p>
      <p class="source-note">{{ source }} Last 14 days, {{ data.plays }} analysed plays.</p>
    </div>

    <div class="moods-visual">
      <div
        class="mood-bar"
        role="group"
        :aria-label="
          data.axes.map((entry) => `${JOURNAL_MOOD[entry.axis]} ${entry.share}%`).join(', ')
        "
      >
        <button
          v-for="entry in data.axes"
          :key="entry.axis"
          type="button"
          class="mood-segment"
          :aria-label="`${JOURNAL_MOOD[entry.axis]} ${entry.share}%`"
          @pointerenter="selected = entry"
          @focus="selected = entry"
          @click="selected = entry"
          :style="{ flexGrow: entry.share, background: colour(entry.axis) }"
          :title="`${JOURNAL_MOOD[entry.axis]} ${entry.share}%`"
        />
      </div>
      <p class="segment-readout" aria-live="polite">
        {{
          selected
            ? `${JOURNAL_MOOD[selected.axis]}: ${selected.share}% of analysed plays`
            : 'Select a mood to explore its share.'
        }}
      </p>
      <p class="bar-legend" aria-hidden="true">
        <span v-for="entry in data.axes" :key="entry.axis" class="legend-item">
          <span class="legend-dot" :style="{ background: colour(entry.axis) }" />
          {{ JOURNAL_MOOD[entry.axis] }} {{ entry.share }}%
        </span>
      </p>

      <ol class="top-moods">
        <li v-for="(mood, index) in data.top" :key="mood.name" class="top-mood">
          <span class="rank">{{ index + 1 }}</span>
          <span class="mood-name">
            <span
              class="legend-dot"
              :style="{ background: mood.axis ? colour(mood.axis) : 'var(--ui-text-muted)' }"
            />
            {{ mood.name }}
          </span>
          <span class="mood-share">{{ mood.share }}%</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.segment-readout {
  min-height: 24px;
  margin-top: 8px;
  font: 13px/1.5 var(--font-sans);
  color: var(--ui-text-muted);
}
.mood-segment {
  cursor: pointer;
  padding: 0;
  transition:
    flex-grow 400ms,
    filter 180ms;
  animation: mix-reveal 500ms ease-out;
}
.mood-segment:is(:hover, :focus-visible) {
  filter: brightness(0.75);
  outline: 2px solid var(--ui-text);
  outline-offset: -2px;
}
@keyframes mix-reveal {
  from {
    opacity: 0.25;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mood-segment {
    animation: none;
    transition: none;
  }
}
.music-moods {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 2rem;
}

.sub-header {
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}

.insight-text {
  font-family: var(--font-serif);
  font-size: var(--text-body);
  line-height: 1.4;
}

.source-note {
  margin-top: 0.75rem;
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
}

.mood-bar {
  display: flex;
  height: 18px;
  gap: 3px;
  overflow: hidden;
  border-radius: 999px;
}

.mood-segment {
  min-width: 6px;
  flex-basis: 0;
}

.bar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin-top: 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.85rem;
}

.legend-item,
.mood-name {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
}

.top-moods {
  display: grid;
  gap: 0.4rem;
  margin-top: 1.25rem;
}

.top-mood {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: center;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
  background: var(--ui-bg-accented);
  font-family: var(--font-sans);
}

.rank {
  color: var(--ui-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.mood-name {
  font-weight: 600;
}

.mood-share {
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}

@media (max-width: 1000px) {
  .music-moods {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
}
</style>
