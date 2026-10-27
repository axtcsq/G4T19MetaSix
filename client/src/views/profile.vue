<script setup>
// The profile page: who is logged in, their MetaFor personality, a few
// listening facts and the privacy settings. Editing the profile comes later.
import { computed, onMounted, reactive, ref } from 'vue'
import SiteFooter from '@/components/layout/footer.vue'
import { updateSettings } from '@/api/auth'
import { getPersonality } from '@/api/quiz'
import { useAuthStore } from '@/stores/auth'
import { useLogOut } from '@/composables/useLogOut'
import '@/assets/css/personality-theme.css'
import { typeIcon } from '@/utils/typeIcons'
defineOptions({ name: 'ProfilePage' })

const auth = useAuthStore()
const user = computed(() => auth.user)
const initial = computed(() => user.value?.displayName?.trim()?.[0]?.toUpperCase() ?? '?')

const personality = ref(null)
const loading = ref(true)
const loadError = ref('')

onMounted(async () => {
  try {
    personality.value = await getPersonality()
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
})

const spotifyStatus = computed(() => {
  if (user.value?.isDemo) return 'Test account, not connected to Spotify'
  if (!user.value?.spotifyLinked) return 'Log in with Spotify again to reconnect'
  if (user.value.preferences?.savePlays === false) return 'Connected, not saving new plays'
  return user.value.tracking?.status === 'active' ? 'Connected, saving your plays' : 'Connected'
})

const lastSynced = computed(() => {
  const at = user.value?.tracking?.lastPolledAt
  if (!at) return 'Not yet'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at))
})

// Only the facts there is data for.
const listeningFacts = computed(() => {
  const stats = personality.value?.stats
  if (!stats) return []
  return [
    ['Top artist', stats.topArtist],
    ['Top track', stats.topTrack],
    ['Top genre', stats.topGenre],
    ['Repeat listens', stats.repeatListens === null || stats.repeatListens === undefined ? null : `${stats.repeatListens}%`],
  ].filter(([, value]) => value)
})

// Each toggle saves as soon as it flips, and flips back if saving fails.
const settings = computed(() => [
  {
    key: 'analyseLyrics',
    label: 'Analyse song lyrics',
    description:
      'Let MetaFor read the mood of the lyrics in the songs you play. When this is off, your moods come only from how songs sound.',
    on: user.value?.preferences?.moodLens !== 'sound',
  },
  {
    key: 'savePlays',
    label: 'Save my Spotify plays',
    description: user.value?.isDemo
      ? 'The test account isn’t connected to Spotify, so there are no new plays to save.'
      : 'Keep a record of what you play so your calendar and patterns stay up to date. Turning this off keeps the plays already saved.',
    on: user.value?.preferences?.savePlays !== false,
    disabled: user.value?.isDemo,
  },
])
const saving = reactive({})
const settingsMessage = ref('')

async function toggle(setting) {
  const next = !setting.on
  const previous = user.value
  saving[setting.key] = true
  settingsMessage.value = ''
  auth.user = {
    ...previous,
    preferences: {
      ...previous.preferences,
      ...(setting.key === 'analyseLyrics' ? { moodLens: next ? 'lyrics' : 'sound' } : { savePlays: next }),
    },
  }
  try {
    auth.user = await updateSettings({ [setting.key]: next })
    settingsMessage.value = 'Saved.'
  } catch (error) {
    auth.user = previous
    settingsMessage.value = `Couldn’t save: ${error.message}`
  } finally {
    saving[setting.key] = false
  }
}

const logOut = useLogOut()
</script>

<template>
  <div class="profile-page personality-theme">
    <main class="profile-shell">
      <h1 class="page-title">Your Profile</h1>

      <section class="card identity" aria-label="Account">
        <img v-if="user?.avatarUrl" class="avatar" :src="user.avatarUrl" alt="" />
        <span v-else class="avatar avatar-initial" aria-hidden="true">{{ initial }}</span>
        <div class="identity-text">
          <p class="name">
            {{ user?.displayName }}
            <span v-if="user?.isDemo" class="badge">Test account</span>
          </p>
          <dl class="details">
            <div>
              <dt>Spotify</dt>
              <dd>{{ spotifyStatus }}</dd>
            </div>
            <div>
              <dt>Last synced</dt>
              <dd>{{ lastSynced }}</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>{{ user?.timezone || 'Not set' }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div class="grid">
        <section class="card" aria-labelledby="personality-title">
          <h2 id="personality-title" class="card-title">Your MetaFor Personality</h2>
          <p v-if="loading" class="muted">Loading…</p>
          <p v-else-if="loadError" class="muted">{{ loadError }}</p>
          <template v-else-if="personality">
            <div class="type-row">
              <img
                class="type-icon"
                :src="typeIcon(personality.type.id)"
                alt=""
                width="64"
                height="64"
              />
              <div>
                <p class="type-name">{{ personality.type.name }}</p>
                <p class="muted">{{ personality.type.tagline }}</p>
              </div>
            </div>
            <p class="muted small">
              {{ personality.type.match }}% match from {{ personality.quizResults.length }}
              {{ personality.quizResults.length === 1 ? 'quiz' : 'quizzes' }}.
            </p>
            <RouterLink class="text-link" :to="{ name: 'personality', hash: '#patterns' }">
              See your patterns →
            </RouterLink>
          </template>
          <template v-else>
            <p class="muted">Take a quiz to find out which MetaFor personality you are.</p>
            <RouterLink class="text-link" :to="{ name: 'personality' }">Find your personality →</RouterLink>
          </template>
        </section>

        <section class="card" aria-labelledby="listening-title">
          <h2 id="listening-title" class="card-title">Your Listening</h2>
          <dl v-if="listeningFacts.length" class="facts">
            <div v-for="[label, value] in listeningFacts" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl>
          <p v-else-if="!loading" class="muted">
            Your top artist, track and genre show here once you've taken a quiz.
          </p>
          <RouterLink class="text-link" to="/dashboard">Go to Home →</RouterLink>
        </section>
      </div>

      <section class="card" aria-labelledby="privacy-title">
        <h2 id="privacy-title" class="card-title">Privacy and Data</h2>
        <ul class="settings">
          <li v-for="setting in settings" :key="setting.key" class="setting">
            <div>
              <p :id="`${setting.key}-label`" class="setting-label">{{ setting.label }}</p>
              <p :id="`${setting.key}-description`" class="muted small">{{ setting.description }}</p>
            </div>
            <button
              type="button"
              role="switch"
              class="switch"
              :aria-checked="setting.on"
              :aria-labelledby="`${setting.key}-label`"
              :aria-describedby="`${setting.key}-description`"
              :disabled="setting.disabled || saving[setting.key]"
              @click="toggle(setting)"
            >
              <span class="switch-thumb" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <p class="muted small privacy-note">
          MetaFor only keeps mood scores worked out from lyrics, never the lyrics themselves.
        </p>
        <p class="muted small" role="status" aria-live="polite">{{ settingsMessage }}</p>
      </section>

      <section class="card coming-soon" aria-labelledby="soon-title">
        <h2 id="soon-title" class="card-title">Coming Soon</h2>
        <p class="muted">Editing your profile and your birthday for Spotify Horoscope.</p>
      </section>

      <button type="button" class="glass-action log-out" @click="logOut">Log out</button>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.profile-page {
  min-height: calc(100vh - 77px);
  color: var(--pq-on-surface);
  background: var(--ui-bg);
}

.profile-shell {
  display: grid;
  width: min(900px, var(--page-width));
  gap: 20px;
  margin-inline: auto;
  padding-block: var(--page-top) var(--page-bottom);
}


.card {
  padding: 1.5rem 1.75rem;
  border: 1px solid var(--pq-border);
  border-radius: 18px;
  background: var(--pq-surface);
  box-shadow: 0 6px 18px rgba(118, 62, 50, 0.08);
}

.identity {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.avatar {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--pq-brown);
  background: var(--pq-peach);
  font-family: var(--font-serif);
  font-size: 2.4rem;
  font-weight: 700;
}

.name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 700;
}

.badge {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  color: var(--pq-brown);
  background: var(--pq-peach);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
}

.details,
.facts {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.details div,
.facts div {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.75rem;
}

dt {
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

dd {
  overflow-wrap: anywhere;
  font-family: var(--font-serif);
  font-size: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.grid .card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-title {
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}

.type-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.type-icon {
  flex-shrink: 0;
}

/* The icons are black line art, so they're flipped to light in dark mode. */
:global(.dark .profile-page .type-icon) {
  filter: invert(0.94);
}

.type-name {
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 700;
}

.muted {
  color: var(--pq-muted);
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.45;
}

.small {
  font-size: 0.9rem;
}

.text-link {
  margin-top: auto;
  color: var(--pq-accent);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}

.text-link:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.text-link:focus-visible {
  border-radius: 4px;
  outline: 3px solid var(--pq-focus);
  outline-offset: 3px;
}

.settings {
  display: grid;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding-block: 1rem;
  border-bottom: 1px solid var(--pq-border);
}

.setting:first-child {
  padding-top: 0.25rem;
}

.setting-label {
  margin-bottom: 0.2rem;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 700;
}

.privacy-note {
  margin-top: 1rem;
}

/* An on/off switch: a pill with a thumb that slides right and fills with the
   accent colour when on. */
.switch {
  position: relative;
  width: 46px;
  height: 26px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--pq-border);
  border-radius: 999px;
  background: var(--pq-tint);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

.switch[aria-checked='true'] {
  border-color: var(--pq-accent);
  background: var(--pq-accent);
}

.switch:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.switch:focus-visible {
  outline: 3px solid var(--pq-focus);
  outline-offset: 3px;
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 160ms ease;
}

.switch[aria-checked='true'] .switch-thumb {
  transform: translateX(20px);
}

@media (prefers-reduced-motion: reduce) {
  .switch,
  .switch-thumb {
    transition: none;
  }
}

.coming-soon {
  border-style: dashed;
  background: var(--pq-tint);
  box-shadow: none;
}

.log-out {
  justify-self: start;
  cursor: pointer;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .identity {
    flex-direction: column;
    align-items: flex-start;
  }

  .card {
    padding: 1.25rem;
  }
}
</style>
