import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getDailyMetaphor } from '@/api/auth'
import { metaphorFor } from '@/data/dailyMetaphors'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'

const withArticle = (word) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`

// Today's metaphor: the general line of the day, swapped for one written for
// the user's mood and music taste once it arrives. { line, basis }
export function useDailyMetaphor() {
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
      // The general line is already there.
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

  // What the line was written for, so it's clear it's meant for them.
  const basis = computed(() => {
    const mood = personal.value?.mood?.toLowerCase()
    const genre = personal.value?.genre
    if (mood && genre) return `For ${withArticle(mood)} day, with a little ${genre}`
    if (mood) return `For ${withArticle(mood)} day`
    if (genre) return `For your ${genre} taste`
    return ''
  })

  return { line, basis }
}
