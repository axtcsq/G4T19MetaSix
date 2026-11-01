<script setup>
import Navbar from "./components/layout/navbar.vue"
import ListeningDock from "./components/listening/ListeningDock.vue"
import MoodGlow from "./components/layout/MoodGlow.vue"
</script>

<template>
  <UApp>
    <MoodGlow />
    <Navbar />
    <RouterView />
    <ListeningDock />
  </UApp>
</template>

<style scoped></style>
