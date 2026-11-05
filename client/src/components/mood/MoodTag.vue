<script setup>
// Show a track's mood status and optionally link to its analysis page.
import { computed, toRef } from 'vue'
import { RouterLink } from 'vue-router'
import { useTrackMood } from '@/composables/useTrackMoods'

const props = defineProps({
  trackId: { type: String, default: '' },
  size: { type: String, default: 'md' },
  link: { type: Boolean, default: true },
  hidePendingLyrics: { type: Boolean, default: false },
})

const tag = computed(useTrackMood(toRef(props, 'trackId')))
const reading = computed(() => tag.value?.lyrics ?? tag.value?.sound ?? null)

// Use readable mood colors in both themes.
const TEXT = {
  sad: 'text-(color:--ui-color-sad-800) dark:text-(color:--ui-color-sad-200)',
  happy: 'text-(color:--ui-color-happy-800) dark:text-(color:--ui-color-happy-200)',
  relaxed: 'text-(color:--ui-color-relaxed-800) dark:text-(color:--ui-color-relaxed-200)',
  anxious: 'text-(color:--ui-color-anxious-800) dark:text-(color:--ui-color-anxious-200)',
  angry: 'text-(color:--ui-color-angry-800) dark:text-(color:--ui-color-angry-200)',
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
    why: 'We couldn’t read this song’s lyrics after several tries, so this mood is from the sound only.',
  },
  instrumental: {
    label: 'Instrumental',
    why: 'This song has no vocals, so its mood is from the sound only.',
  },
  'lyrics-only': {
    label: 'Lyrics only',
    why: 'Our audio data source doesn’t have this song, so this mood is a rough guess from its lyrics alone.',
  },
  none: {
    label: 'No lyrics',
    why: 'We couldn’t find lyrics we could read for this song, so its mood is from the sound only.',
  },
}
const lyricsNote = computed(() => {
  if (props.hidePendingLyrics && tag.value?.lyricsNote === 'pending') return null
  return LYRICS_NOTES[tag.value?.lyricsNote] ?? null
})

const NO_MOOD = {
  'no-data':
    'Our audio data source doesn’t have this song, which is common for new releases, so it has no mood.',
  failed: 'Something kept going wrong while analysing this song, so it has no mood.',
}
const noMood = computed(() => NO_MOOD[tag.value?.noMood] ?? null)

const details = computed(() => {
  const { sound, lyrics, lyricsNote: note } = tag.value ?? {}
  if (!reading.value) return ''
  const counts = `Counts as ${JOURNAL_MOOD[reading.value.axis] ?? 'no journal mood'}.`
  if (!sound) return `${lyrics.name}, a rough guess from the lyrics alone. ${counts}`
  if (lyrics && !note) {
    return lyrics.name === sound.name
      ? `${sound.name} from both sound and lyrics. ${counts}`
      : `${lyrics.name} from sound and lyrics; ${sound.name} from sound alone. ${counts}`
  }
  return `${sound.name}, from how the song sounds. ${counts}`
})
</script>

<template>
  <!-- A plain wrapper as the root, so a page's scoped styles (like a bare "span" rule) only reach it and never the badge inside. -->
  <span v-if="reading || tag?.analysing || noMood" class="mood-tag-root">
    <template v-if="reading">
      <UTooltip :text="details">
        <component
          :is="link ? RouterLink : 'span'"
          v-bind="link ? { to: `/song/${trackId}` } : {}"
          class="mood-tag-link"
        >
          <span
            :data-axis="reading.axis || 'neutral'"
            class="mood-tag"
            :class="[TEXT[reading.axis], `mood-tag--${size}`]"
          >
            <svg class="mood-line" viewBox="0 0 32 22" aria-hidden="true">
              <path v-if="reading.axis === 'happy'" d="M2 17 Q10 17 14 9 T30 5" />
              <path v-else-if="reading.axis === 'sad'" d="M2 5 Q10 5 16 12 T30 17" />
              <path
                v-else-if="reading.axis === 'anxious'"
                d="M2 13 L8 7 L12 17 L18 5 L23 15 L30 9"
              />
              <path v-else-if="reading.axis === 'angry'" d="M2 16 L10 5 L14 16 L22 5 L30 9" />
              <path v-else d="M2 12 Q9 6 16 12 T30 12" />
            </svg>
            <span class="sr-only">Song mood: </span>{{ reading.name
            }}<span v-if="link" class="sr-only">, see why</span>
          </span>
        </component>
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  font-family: var(--font-serif);
  font-size: var(--text-small);
  font-style: italic;
  line-height: 1.4;
}
.mood-tag--sm {
  font-size: var(--text-label);
}
.mood-tag--lg {
  font-size: var(--text-lead);
}
.mood-tag-link {
  display: inline-flex;
  max-width: 100%;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
}
a.mood-tag-link:hover .mood-tag {
  text-decoration: underline;
  text-underline-offset: 3px;
}
a.mood-tag-link:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.mood-line {
  width: 28px;
  height: 20px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (forced-colors: active) {
  .mood-line {
    stroke: CanvasText;
  }
}
</style>
