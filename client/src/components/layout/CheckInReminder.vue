<script setup>
// Reminds the user to check in, once a day, after the time they set on the
// profile page. Only while MetaFor is open: a toast, plus a browser
// notification when the tab is in the background and they allowed those.
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'
import { useToast } from '#imports'

const auth = useAuthStore()
const today = useTodayMoodStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const SHOWN_KEY = 'metafor.reminderShown'
let timer = null

function localDate() {
  return new Date().toDateString()
}

// The reminder only shows once a day, even across reloads.
function shownToday() {
  try {
    return localStorage.getItem(SHOWN_KEY) === localDate()
  } catch {
    return false
  }
}

function markShown() {
  try {
    localStorage.setItem(SHOWN_KEY, localDate())
  } catch {
    // Without storage it may show again after a reload, which is fine.
  }
}

function isDue() {
  const time = auth.user?.preferences?.reminderTime
  if (!time || !today.loaded || today.checkedIn || shownToday()) return false
  if (route.name === 'daily-mood') return false
  const now = new Date()
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return current >= time
}

function remind() {
  if (!isDue()) return
  markShown()
  const goToJournal = () => router.push({ name: 'daily-mood' })
  toast.add({
    title: 'Time to check in',
    description: 'How are you feeling today? A quick check-in keeps your patterns up to date.',
    duration: 15000,
    actions: [{ label: 'Check in', onClick: goToJournal }],
  })
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Time to check in', { body: 'How are you feeling today?' })
    notification.onclick = () => {
      window.focus()
      goToJournal()
    }
  }
}

// Check as soon as today's check-ins load, then every minute.
watch(() => today.loaded, remind)

onMounted(() => {
  remind()
  timer = window.setInterval(remind, 60 * 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <span hidden />
</template>
