<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getDailyMetaphor } from '@/api/auth'
import { metaphorFor } from '@/data/dailyMetaphors'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'

// Today's metaphor. Everyone gets the general line of the day; a logged-in
// user's is then swapped for one written for their mood and music taste.
const auth = useAuthStore()
const todayMood = useTodayMoodStore()

const today = () => new Date().toDateString()
const day = ref(today())
const general = ref(metaphorFor())
const personal = ref(null)

let request = 0
async function load() {
  const id = ++request
  if (!auth.user) {
    personal.value = null
    return
  }
  try {
    const result = await getDailyMetaphor()
    // Only the latest answer counts, if a check-in asked again meanwhile.
    if (id === request) personal.value = result?.text ? result : null
  } catch {
    // The general line is already showing.
    if (id === request) personal.value = null
  }
}
// A new check-in means a new mood, so ask again.
watch([() => auth.user?.id, () => todayMood.entries.length], load, { immediate: true })

// If the page is left open past midnight, the new day's line shows the next
// time the tab comes back into view.
const refresh = () => {
  if (document.hidden || day.value === today()) return
  day.value = today()
  general.value = metaphorFor()
  load()
}
onMounted(() => document.addEventListener('visibilitychange', refresh))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', refresh))

const line = computed(() => personal.value?.text ?? general.value)

const withArticle = (word) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`
// What the line was written for, so it's clear it's meant for them.
const basis = computed(() => {
  const mood = personal.value?.mood?.toLowerCase()
  const genre = personal.value?.genre
  if (mood && genre) return `For ${withArticle(mood)} day, with a little ${genre}`
  if (mood) return `For ${withArticle(mood)} day`
  if (genre) return `For your ${genre} taste`
  return ''
})
</script>

<template>
  <figure class="daily-metaphor">
    <figcaption class="metaphor-kicker">
      Today’s metaphor<span v-if="basis" class="metaphor-basis"> · {{ basis }}</span>
    </figcaption>
    <blockquote class="metaphor-line">{{ line }}</blockquote>
  </figure>
</template>

<style scoped>
.daily-metaphor {
  margin: 0 0 24px;
  padding: 2px 0 2px 18px;
  border-left: 3px solid var(--color-brand-400);
}
.metaphor-kicker {
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.metaphor-basis {
  letter-spacing: 0.02em;
  text-transform: none;
}
.metaphor-line {
  margin: 4px 0 0;
  color: var(--ui-text);
  font-family: var(--font-serif);
  font-size: var(--text-quote);
  font-style: italic;
  line-height: 1.4;
}
@media (max-width: 600px) {
  .metaphor-line {
    font-size: var(--text-body);
  }
}
</style>
