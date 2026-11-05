<script setup>
import { computed } from 'vue'
import MoodRiver from '@/components/dashboard/MoodRiver.vue'

// Show the user's music moods and their daily distribution.
const props = defineProps({
  data: { type: Object, required: true },
  // The days the card covers, oldest first, like 2026-10-19.
  dates: { type: Array, default: () => [] },
})

const MOOD_NAME = {
  happy: 'Happy',
  relaxed: 'Relaxed',
  sad: 'Sad',
  angry: 'Angry',
  anxious: 'Anxious',
}

const colour = (axis) => `var(--color-mood-${axis}-500)`

// Every song mood played, with the big mood it belongs to. Older servers only
// send the top three.
const songMoods = computed(() => props.data.moods ?? props.data.top)

// The big moods, biggest first, each with its song moods.
const groups = computed(() =>
  [...props.data.axes]
    .sort((a, b) => b.share - a.share)
    .map((entry) => ({
      ...entry,
      name: MOOD_NAME[entry.axis],
      songs: songMoods.value.filter((mood) => mood.axis === entry.axis && mood.share > 0),
    })),
)

// Song moods like Bittersweet count towards two big moods, so the numbers
// under a big mood don't always add up to it exactly.
const mixedSongs = computed(() =>
  songMoods.value.filter((mood) => mood.mixed).map((mood) => mood.name),
)

const source = computed(() =>
  props.data.lens === 'lyrics' ? 'From sound and lyrics' : 'From sound',
)
</script>

<template>
  <div class="music-moods">
    <div class="moods-copy">
      <h3 class="sub-header">Your Music’s Moods</h3>
      <p class="source-note">{{ source }} · last 14 days · {{ data.plays }} plays</p>

      <!-- Beside the river, so the card stays short. -->
      <section class="mood-breakdown" aria-labelledby="mood-breakdown-title">
        <h4 id="mood-breakdown-title" class="breakdown-title">What’s in each mood</h4>
        <p class="breakdown-note">Each song has its own mood, like Melancholic.</p>
        <ul class="mood-groups">
          <li v-for="group in groups" :key="group.axis" class="mood-group">
            <span class="group-head">
              <strong
                ><span class="legend-dot" :style="{ background: colour(group.axis) }" />{{
                  group.name
                }}</strong
              >
              <span class="group-share" :style="{ '--mood': colour(group.axis) }"
                >{{ group.share }}%</span
              >
            </span>
            <span class="group-bar" aria-hidden="true">
              <span :style="{ width: `${group.share}%`, background: colour(group.axis) }" />
            </span>
            <span v-if="group.songs.length" class="group-songs">
              <span v-for="song in group.songs" :key="song.name" class="song-mood">
                {{ song.name }}{{ song.mixed ? '*' : '' }} <span>{{ song.share }}%</span>
              </span>
            </span>
          </li>
        </ul>
        <p v-if="mixedSongs.length" class="breakdown-note">* Also counts partly as another mood.</p>
      </section>
    </div>

    <div class="moods-visual">
      <MoodRiver v-if="dates.length" :from="dates[0]" :to="dates.at(-1)" />
      <!-- The same shares as the breakdown, as dials. -->
      <ul class="mood-dials" aria-label="Your music's moods as dials">
        <li v-for="group in groups" :key="group.axis" class="mood-dial">
          <svg class="dial-gauge" viewBox="0 0 100 56" aria-hidden="true">
            <path class="dial-track" d="M8 50 A42 42 0 0 1 92 50" pathLength="100" />
            <path
              class="dial-fill"
              d="M8 50 A42 42 0 0 1 92 50"
              pathLength="100"
              :style="{ stroke: colour(group.axis), strokeDasharray: `${group.share} 100` }"
            />
          </svg>
          <strong>{{ group.share }}%</strong>
          <span>{{ group.name }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.music-moods {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 2rem;
}

.sub-header {
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}

.source-note {
  margin-top: 0.75rem;
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-label);
}

.mood-breakdown {
  margin-top: 1.25rem;
  font-family: var(--font-sans);
}

.breakdown-title {
  font-size: var(--text-small);
  font-weight: 700;
}

.breakdown-note {
  margin-top: 0.25rem;
  color: var(--ui-text-muted);
  font-size: var(--text-caption);
  line-height: 1.45;
}

.mood-groups {
  display: grid;
  gap: 0.15rem;
  margin: 0.6rem 0 0.4rem;
  padding: 0;
  list-style: none;
}

/* Each big mood is one slim row: name, a bar of its share and the share,
   with the song moods inside it on a small line underneath. */
.mood-group {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) 4rem;
  align-items: center;
  column-gap: 0.75rem;
  row-gap: 0;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--ui-border);
  font-size: var(--text-label);
}

.mood-group:last-child {
  border-bottom: none;
}

.group-head {
  display: contents;
}

.group-head strong {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

/* Each share in a pill tinted with its mood, like Top Tracks' play counts. */
.group-share {
  grid-column: 3;
  justify-self: end;
  min-width: 3.5rem;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--mood) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--mood) 18%, transparent);
  font: 600 1.15rem/1 var(--font-serif);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.group-bar {
  display: block;
  grid-column: 2;
  grid-row: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-text) 10%, transparent);
}

.group-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  animation: share-fill 600ms cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: left;
}

.group-songs {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 0 0.8rem;
  font-size: var(--text-caption);
}

.song-mood span {
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
}

.legend-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
}

@keyframes share-fill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.mood-dials {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-sans);
  text-align: center;
}

.mood-dial {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.dial-gauge {
  width: 100%;
  max-width: 90px;
  overflow: visible;
}

.dial-gauge path {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}

.dial-track {
  stroke: color-mix(in srgb, var(--ui-text) 10%, transparent);
}

/* Each dial fills from empty to its share. */
.dial-fill {
  animation: dial-fill 900ms cubic-bezier(0.16, 1, 0.3, 1);
}

.mood-dial strong {
  margin-top: 4px;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.mood-dial span {
  color: var(--ui-text-muted);
  font-size: 0.75rem;
}

@keyframes dial-fill {
  from {
    stroke-dasharray: 0 100;
  }
}

@media (prefers-reduced-motion: reduce) {
  .group-bar span,
  .dial-fill {
    animation: none;
  }
}

@media (max-width: 1000px) {
  .music-moods {
    /* minmax(0, …) lets the river shrink to the screen instead of holding the
       column at its old width. */
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }
}
</style>
