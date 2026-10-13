<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const items = computed(() => [
  {
    label: 'Home',
    to: '/',
    active: route.path === '/',
  },
  {
    label: 'Daily Mood',
    to: '/daily-mood',
    active: route.path === '/daily-mood',
  },
  {
    label: 'Calendar',
    to: '/calendar',
    active: route.path === '/calendar',
  },
  {
    label: 'Canvas',
    to: '/canvas',
    active: route.path === '/canvas',
  },
  {
    label: 'Profile',
    to: '/profile',
    active: route.path === '/profile',
  },
])
</script>

<template>
  <UHeader>
    <template #left>
      <span class="text-xl font-bold">MetaFor</span>
      <UColorModeButton />

      <UTooltip text="Open on GitHub" :kbds="['meta', 'G']">
        <UButton
          color="neutral"
          variant="ghost"
          to="https://github.com/nuxt/ui"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
        />
      </UTooltip>
    </template>
    <template #right>
      <UNavigationMenu :items="items" />
    </template>
  </UHeader>
</template>
