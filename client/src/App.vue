<script setup>
import Navbar from "./components/navbar.vue"
import ListeningDock from "./components/ListeningDock.vue"
</script>

<template>
  <UApp>
    <Navbar />
    <RouterView />
    <ListeningDock />
  </UApp>
</template>

<style scoped></style>
