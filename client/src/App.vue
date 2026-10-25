<script setup>
import Navbar from "./components/layout/navbar.vue"
import ListeningDock from "./components/listening/ListeningDock.vue"
</script>

<template>
  <UApp>
    <Navbar />
    <RouterView />
    <ListeningDock />
  </UApp>
</template>

<style scoped></style>
