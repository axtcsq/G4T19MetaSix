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

const lead = computed(() => {
  const [biggest] = groups.value
  if (!biggest) return ''
  const [song] = biggest.songs
  return song
    ? `Mostly ${biggest.name} (${biggest.share}%), led by ${song.name} songs.`
    : `Mostly ${biggest.name} (${biggest.share}%).`
})

const match = computed(() => {
  const { comparedDays, matchedDays } = props.data
  if (!comparedDays) return 'Log your mood to compare it with your music.'
  return `Matched your mood on ${matchedDays} of ${comparedDays} logged days.`
})

const source = computed(() =>
  props.data.lens === 'lyrics' ? 'From sound and lyrics' : 'From sound',
)
</script>

<template>
  <div class="music-moods">
    <div class="moods-copy">
      <h3 class="sub-header">Your Music’s Moods</h3>
      <p class="insight-text mt-2">{{ lead }} {{ match }}</p>
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
              <span class="group-share">{{ group.share }}%</span>
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

.mood-breakdown {
  margin-top: 1.25rem;
  font-family: var(--font-sans);
}

.breakdown-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.breakdown-note {
  margin-top: 0.25rem;
  color: var(--ui-text-muted);
  font-size: 0.8rem;
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
  grid-template-columns: 6.5rem minmax(0, 1fr) 2.75rem;
  align-items: center;
  column-gap: 0.75rem;
  row-gap: 0;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--ui-border);
  font-size: 0.9rem;
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

.group-share {
  grid-column: 3;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
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
  font-size: 0.76rem;
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

@media (prefers-reduced-motion: reduce) {
  .group-bar span {
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
