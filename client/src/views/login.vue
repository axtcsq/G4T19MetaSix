<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDemoStatus, spotifyLoginUrl } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import SiteFooter from '@/components/layout/footer.vue'
defineOptions({ name: 'LoginPage' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isRedirecting = ref(false)
// The test account is offered only when the server has DEMO_LOGIN=true.
const demoEnabled = ref(false)
const isDemoLoading = ref(false)
const demoError = ref('')

// The server sends people back here with ?error= when a login doesn't finish.
const errorMessages = {
  expired: 'That login took too long or was opened in another tab. Please try again.',
  denied: 'Spotify access was not granted. You can try again whenever you are ready.',
  'not-allowed':
    'This Spotify account is not on the app’s test user list yet. Ask the team to add your Spotify email.',
  spotify: 'Spotify could not be reached. Please try again in a moment.',
}

const errorMessage = computed(
  () => demoError.value || errorMessages[route.query.error] || auth.error,
)
const next = computed(() => (typeof route.query.next === 'string' ? route.query.next : undefined))

function continueWithSpotify() {
  isRedirecting.value = true
  window.location.assign(spotifyLoginUrl(next.value))
}

async function useTestAccount() {
  isDemoLoading.value = true
  demoError.value = ''
  try {
    await auth.demoLogin()
    router.replace(
      next.value?.startsWith('/') && !next.value.startsWith('//') ? next.value : '/dashboard',
    )
  } catch (error) {
    demoError.value = error.message
  } finally {
    isDemoLoading.value = false
  }
}

onMounted(async () => {
  try {
    demoEnabled.value = (await getDemoStatus()).enabled
  } catch {
    demoEnabled.value = false
  }
})
</script>

<template>
  <div class="login-page">
    <main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 class="page-title">Welcome to MetaFor</h1>
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

      <UButton
        v-if="demoEnabled"
        class="mt-3 justify-center rounded-full font-sans"
        color="neutral"
        variant="outline"
        size="lg"
        block
        :loading="isDemoLoading"
        @click="useTestAccount"
      >
        Use the test account
      </UButton>
      <p v-if="demoEnabled" class="mt-2 font-sans text-sm text-muted">
        A shared account with a year of sample listening history. It has no Spotify connection, so
        the dashboard and Listening room stay empty.
      </p>

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
