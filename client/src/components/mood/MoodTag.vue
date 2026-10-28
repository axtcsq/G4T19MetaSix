<script setup>
// A song's mood, as a small tinted label in the colour of the journal mood it
// counts towards (Bittersweet is Sad's blue). Shows the sound + lyrics reading
// when there is one, otherwise sound only; the tooltip gives both. A second,
// grey tag appears only when the mood didn't use the lyrics, saying why. Songs
// still being analysed show a grey "Analysing…", and songs that can never get
// a mood a grey "No mood data". Songs we know nothing about show nothing.
import { computed, toRef } from 'vue'
import { useTrackMood } from '@/composables/useTrackMoods'

const props = defineProps({
  trackId: { type: String, default: '' },
  size: { type: String, default: 'md' },
})

const tag = computed(useTrackMood(toRef(props, 'trackId')))
const reading = computed(() => tag.value?.lyrics ?? tag.value?.sound ?? null)

// Nuxt UI's subtle badge uses the 500 shade for text, which is too light on a
// light card for yellow and lilac. These shades pass contrast in both themes.
const TEXT = {
  sad: 'text-(color:--ui-color-sad-800) dark:text-(color:--ui-color-sad-200)',
  happy: 'text-(color:--ui-color-happy-800) dark:text-(color:--ui-color-happy-200)',
  relaxed: 'text-(color:--ui-color-relaxed-800) dark:text-(color:--ui-color-relaxed-200)',
  anxious: 'text-(color:--ui-color-anxious-800) dark:text-(color:--ui-color-anxious-200)',
  angry: 'text-(color:--ui-color-angry-800) dark:text-(color:--ui-color-angry-200)',
}
const DOT = {
  sad: 'bg-(color:--ui-sad)',
  happy: 'bg-(color:--ui-happy)',
  relaxed: 'bg-(color:--ui-relaxed)',
  anxious: 'bg-(color:--ui-anxious)',
  angry: 'bg-(color:--ui-angry)',
}
const JOURNAL_MOOD = {
  sad: 'Sad',
  happy: 'Happy',
  relaxed: 'Relaxed',
  anxious: 'Anxious',
  angry: 'Angry',
}

// The second tag, for songs whose mood is from the sound alone.
const LYRICS_NOTES = {
  pending: {
    label: 'Lyrics pending',
    why: 'The lyrics haven’t been read yet, so this mood is from the sound only. They’re usually read within a few hours.',
  },
  unavailable: {
    label: 'Lyrics unavailable',
    why: 'The lyrics site was down every time we tried, so this mood is from the sound only.',
  },
  instrumental: {
    label: 'Instrumental',
    why: 'This song has no vocals, so its mood is from the sound only.',
  },
  none: {
    label: 'No lyrics',
    why: 'We couldn’t find lyrics we could read for this song, so its mood is from the sound only.',
  },
}
const lyricsNote = computed(() => LYRICS_NOTES[tag.value?.lyricsNote] ?? null)

const NO_MOOD = {
  'no-data':
    'Our audio data source doesn’t have this song, which is common for new releases, so it has no mood.',
  failed: 'Something kept going wrong while analysing this song, so it has no mood.',
}
const noMood = computed(() => NO_MOOD[tag.value?.noMood] ?? null)

const details = computed(() => {
  const { sound, lyrics, lyricsNote: note } = tag.value ?? {}
  if (!sound) return ''
  const counts = `Counts as ${JOURNAL_MOOD[reading.value.axis] ?? 'no journal mood'}.`
  if (lyrics && !note) {
    return lyrics.name === sound.name
      ? `${sound.name} from both sound and lyrics. ${counts}`
      : `${lyrics.name} from sound and lyrics; ${sound.name} from sound alone. ${counts}`
  }
  return `${sound.name}, from how the song sounds. ${counts}`
})
</script>

<template>
  <!-- A plain wrapper as the root, so a page's scoped styles (like a bare
       "span" rule) only reach it and never the badge inside. -->
  <span v-if="reading || tag?.analysing || noMood" class="mood-tag-root">
    <template v-if="reading">
      <UTooltip :text="details">
        <UBadge
          :color="reading.axis || 'neutral'"
          variant="subtle"
          :size="size"
          class="mood-tag"
          :class="TEXT[reading.axis]"
        >
          <span class="mood-dot" :class="DOT[reading.axis]" aria-hidden="true" />
          <span class="sr-only">Song mood: </span>{{ reading.name }}
        </UBadge>
      </UTooltip>
      <UTooltip v-if="lyricsNote" :text="lyricsNote.why">
        <UBadge color="neutral" variant="subtle" :size="size" class="mood-tag text-muted">
          {{ lyricsNote.label }}
        </UBadge>
      </UTooltip>
    </template>
    <UBadge
      v-else-if="tag?.analysing"
      color="neutral"
      variant="subtle"
      :size="size"
      class="mood-tag text-muted"
    >
      <span class="sr-only">Song mood: </span>Analysing…
    </UBadge>
    <UTooltip v-else-if="noMood" :text="noMood">
      <UBadge color="neutral" variant="subtle" :size="size" class="mood-tag text-muted">
        <span class="sr-only">Song mood: </span>No mood data
      </UBadge>
    </UTooltip>
  </span>
</template>

<style scoped>
.mood-tag-root {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 100%;
  /* Labels use the UI font, even inside serif text like song cards. */
  font-family: var(--font-sans);
}
.mood-tag {
  flex-shrink: 0;
  max-width: 100%;
  white-space: nowrap;
}
.mood-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  flex-shrink: 0;
}
@media (forced-colors: active) {
  .mood-dot {
    background: CanvasText;
  }
}
</style>
