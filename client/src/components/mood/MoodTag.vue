<script setup>
// A song's mood, as a small tinted label in the colour of the journal mood it
// counts towards (Bittersweet is Sad's blue). Shows the sound + lyrics reading
// when there is one, otherwise sound only; the tooltip gives both. Songs the
// analysis job hasn't reached yet show a grey "Analysing…", and songs with no
// possible mood show nothing.
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

const details = computed(() => {
  const { sound, lyrics, lyricsPending } = tag.value ?? {}
  if (!sound) return ''
  const counts = `Counts as ${JOURNAL_MOOD[reading.value.axis] ?? 'no journal mood'}.`
  if (lyrics) {
    return lyrics.name === sound.name
      ? `${sound.name} from both sound and lyrics. ${counts}`
      : `${lyrics.name} from sound and lyrics; ${sound.name} from sound alone. ${counts}`
  }
  const why = lyricsPending ? 'The lyrics haven’t been read yet.' : 'From how the song sounds.'
  return `${sound.name}. ${why} ${counts}`
})
</script>

<template>
  <!-- A plain wrapper as the root, so a page's scoped styles (like a bare
       "span" rule) only reach it and never the badge inside. -->
  <span v-if="reading || tag?.analysing" class="mood-tag-root">
    <UTooltip v-if="reading" :text="details">
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
    <UBadge
      v-else-if="tag?.analysing"
      color="neutral"
      variant="subtle"
      :size="size"
      class="mood-tag text-muted"
    >
      <span class="sr-only">Song mood: </span>Analysing…
    </UBadge>
  </span>
</template>

<style scoped>
.mood-tag-root {
  display: inline-flex;
  max-width: 100%;
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
