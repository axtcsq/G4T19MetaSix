import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getMoods } from '@/api/moods'

function isToday(date) {
  return new Date(date).toDateString() === new Date().toDateString()
}

// Today's mood check-ins, for the check-in reminder.
export const useTodayMoodStore = defineStore('todayMood', () => {
  const entries = ref([])
  const loaded = ref(false)

  async function load() {
    try {
      const logs = await getMoods()
      entries.value = logs.filter((log) => isToday(log.createdAt))
    } catch {
      // No reminder is better than an error on every page.
      entries.value = []
    } finally {
      loaded.value = true
    }
  }

  // Call after saving a check-in, so the reminder knows straight away.
  function add(entry) {
    if (isToday(entry.createdAt)) entries.value = [entry, ...entries.value]
  }

  function clear() {
    entries.value = []
    loaded.value = false
  }

  const checkedIn = computed(() => entries.value.length > 0)

  return { entries, loaded, checkedIn, load, add, clear }
})
