import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getMoods } from '@/api/moods'

function isToday(date) {
  return new Date(date).toDateString() === new Date().toDateString()
}

// Today's mood check-ins, for the mood glow and the check-in reminder.
export const useTodayMoodStore = defineStore('todayMood', () => {
  const entries = ref([])
  const loaded = ref(false)

  async function load() {
    try {
      const logs = await getMoods()
      entries.value = logs.filter((log) => isToday(log.createdAt))
    } catch {
      // No glow or reminder is better than an error on every page.
      entries.value = []
    } finally {
      loaded.value = true
    }
  }

  // Call after saving a check-in, so the glow changes straight away.
  function add(entry) {
    if (isToday(entry.createdAt)) entries.value = [entry, ...entries.value]
  }

  function clear() {
    entries.value = []
    loaded.value = false
  }

  const checkedIn = computed(() => entries.value.length > 0)

  // The mood checked in most often today. Ties go to the latest check-in,
  // since entries are newest first.
  const mainMood = computed(() => {
    const counts = {}
    for (const { mood } of entries.value) counts[mood] = (counts[mood] ?? 0) + 1
    let main = null
    for (const { mood } of entries.value) {
      if (!main || counts[mood] > counts[main]) main = mood
    }
    return main
  })

  return { entries, loaded, checkedIn, mainMood, load, add, clear }
})
