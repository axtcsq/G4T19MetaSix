<script setup>
import Navbar from "./components/layout/navbar.vue"
import ListeningDock from "./components/listening/ListeningDock.vue"
import CheckInReminder from "./components/layout/CheckInReminder.vue"
import { watch } from "vue"
import { useAuthStore } from "./stores/auth"
import { useTodayMoodStore } from "./stores/todayMood"

// Today's check-ins decide whether the reminder shows, so load them once
// someone logs in.
const auth = useAuthStore()
const todayMood = useTodayMoodStore()
watch(
  () => auth.user?.id,
  (id) => {
    if (id) todayMood.load()
    else todayMood.clear()
  },
  { immediate: true },
)
</script>

<template>
  <UApp>
    <CheckInReminder />
    <Navbar />
    <RouterView :key="$route.path" />
    <ListeningDock />
  </UApp>
</template>

<style scoped></style>
