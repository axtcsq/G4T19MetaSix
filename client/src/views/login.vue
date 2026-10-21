<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { spotifyLoginUrl } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import SiteFooter from '@/components/footer.vue'
defineOptions({ name: 'LoginPage' })

const route = useRoute()
const auth = useAuthStore()
const isRedirecting = ref(false)

// The server sends people back here with ?error= when a login doesn't finish.
const errorMessages = {
  expired: 'That login took too long or was opened in another tab. Please try again.',
  denied: 'Spotify access was not granted. You can try again whenever you are ready.',
  'not-allowed':
    'This Spotify account is not on the app’s test user list yet. Ask the team to add your Spotify email.',
  spotify: 'Spotify could not be reached. Please try again in a moment.',
}

const errorMessage = computed(() => errorMessages[route.query.error] || auth.error)

function continueWithSpotify() {
  isRedirecting.value = true
  const next = typeof route.query.next === 'string' ? route.query.next : undefined
  window.location.assign(spotifyLoginUrl(next))
}
</script>

<template>
  <div class="login-page">
    <main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 class="font-serif text-4xl text-highlighted">Welcome to MetaFor</h1>
      <p class="mt-3 font-sans text-muted">
        Log in with Spotify to see how your music and your mood move together.
      </p>

      <UAlert
        v-if="errorMessage"
        class="mt-8"
        color="error"
        variant="subtle"
        :description="errorMessage"
        role="alert"
      />

      <UButton
        class="glass-action mt-8 justify-center rounded-full font-sans"
        size="lg"
        block
        :loading="isRedirecting"
        @click="continueWithSpotify"
      >
        Continue with Spotify
      </UButton>

      <p class="mt-6 font-sans text-sm text-muted">
        MetaFor reads your recently played tracks to follow your mood, and uses Spotify’s player in
        the Listening room (Spotify Premium only). It never posts anything or changes your playlists
        or library. Your first login creates your MetaFor account.
      </p>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  min-height: calc(100vh - 76px);
  flex-direction: column;
}
</style>
