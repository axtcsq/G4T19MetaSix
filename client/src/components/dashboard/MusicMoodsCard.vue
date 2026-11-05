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

// Every song mood played, with the big mood it belongs to. Older servers only send the top three.
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

// Song moods like Bittersweet count towards two big moods, so the numbers under a big mood don't always add up exactly.
const mixedSongs = computed(() =>
  songMoods.value.filter((mood) => mood.mixed).map((mood) => mood.name),
)

const source = computed(() =>
  props.data.lens === 'lyrics' ? 'From sound and lyrics' : 'From sound',
)

// A river needs at least two days to flow between.
const singleDay = computed(() => props.dates.length === 1)
const period = computed(() => (singleDay.value ? 'today' : `last ${props.dates.length} days`))
</script>

<template>
  <div class="music-moods" :class="{ 'is-single-day': singleDay }">
    <div class="moods-copy">
      <h3 class="sub-header">Your Music’s Moods</h3>
      <p class="source-note">
        {{ source }} · {{ period }} · {{ data.plays }} {{ data.plays === 1 ? 'play' : 'plays' }}
      </p>

      <section class="mood-breakdown" aria-labelledby="mood-breakdown-title">
        <h4 id="mood-breakdown-title" class="breakdown-title">What’s in each mood</h4>
        <ul class="mood-groups">
          <li
            v-for="group in groups"
            :key="group.axis"
            class="mood-group"
            :style="{ '--mood': colour(group.axis) }"
          >
            <span class="group-head">
              <strong>{{ group.name }}</strong>
              <span class="group-share">{{ group.share }}%</span>
            </span>
            <span class="group-meter" :style="{ '--share': `${group.share}%` }" aria-hidden="true">
              <span />
            </span>
            <span v-if="group.songs.length" class="group-songs">
              <span v-for="song in group.songs" :key="song.name" class="song-mood">
                {{ song.name }}{{ song.mixed ? '*' : '' }} <span>{{ song.share }}%</span>
              </span>
            </span>
          </li>
        </ul>
        <p v-if="mixedSongs.length" class="breakdown-note">
          * {{ mixedSongs.join(', ') }} counts partly toward another mood.
        </p>
      </section>
    </div>

    <div v-if="dates.length > 1" class="moods-visual">
      <MoodRiver :from="dates[0]" :to="dates.at(-1)" />
    </div>
  </div>
</template>

<style scoped>
.music-moods {
  display: grid;
  grid-template-columns: minmax(250px, 0.8fr) minmax(0, 1.6fr);
  align-items: stretch;
  gap: clamp(1.5rem, 4vw, 3.5rem);
}

.music-moods.is-single-day {
  grid-template-columns: minmax(0, 1fr);
}

.sub-header {
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}

.source-note {
  margin-top: 0.35rem;
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-label);
}

.mood-breakdown {
  margin-top: 1.5rem;
  font-family: var(--font-sans);
}

.moods-visual {
  display: flex;
  min-width: 0;
}

.breakdown-title {
  color: var(--ui-text-muted);
  font-size: var(--text-caption);
  font-weight: 500;
}

.breakdown-note {
  margin-top: 0.25rem;
  color: var(--ui-text-muted);
  font-size: var(--text-caption);
  line-height: 1.45;
}

.mood-groups {
  display: grid;
  gap: 0;
  margin: 0.45rem 0 0.4rem;
  padding: 0;
  list-style: none;
}

.mood-group {
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--ui-border);
  font-size: var(--text-label);
}

.mood-group:last-child {
  border-bottom: none;
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  color: var(--mood);
}

.group-head strong {
  color: var(--ui-text);
  font-size: var(--text-label);
  font-weight: 600;
}

.group-share {
  font: 500 var(--text-label)/1 var(--font-sans);
  font-variant-numeric: tabular-nums;
}

.group-meter {
  display: block;
  height: 4px;
  margin-top: 0.5rem;
  overflow: hidden;
  border-radius: 99px;
  background: color-mix(in srgb, var(--mood) 14%, transparent);
}

.group-meter span {
  display: block;
  width: var(--share);
  height: 100%;
  border-radius: inherit;
  background: var(--mood);
}

.group-songs {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.65rem;
  margin-top: 0.35rem;
  font-size: var(--text-caption);
  line-height: 1.55;
}

.song-mood span {
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1000px) {
  .music-moods {
    /* minmax(0, …) lets the river shrink to the screen instead of holding the column at its old width. */
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }
}
</style>
