<script setup>
// The profile page: who is logged in, their MetaFor personality, a few
// listening facts and the privacy settings. Editing the profile comes later.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import SiteFooter from '@/components/layout/footer.vue'
import { clearHistory, disconnectSpotify, exportData, updateSettings } from '@/api/auth'
import { getMood } from '@/api/moods'
import { getPersonality } from '@/api/quiz'
import MoodFace from '@/components/journal/MoodFace.vue'
import { useAuthStore } from '@/stores/auth'
import { useTodayMoodStore } from '@/stores/todayMood'
import { useLogOut } from '@/composables/useLogOut'
import '@/assets/css/personality-theme.css'
import { typeIcon } from '@/utils/typeIcons'
// Nuxt UI's colour mode, which sets the .dark class on <html> and remembers the choice.
import { useColorMode } from '#imports'
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
const settingsPending = computed(() => Object.values(saving).some(Boolean))
// The saved or failed message, shown in the card the toggle is in.
const messages = reactive({ privacy: '', birthday: '', reminder: '', pinned: '' })

async function toggle(setting) {
  if (settingsPending.value || !user.value) return
  const next = !setting.on
  const previous = user.value
  const card = setting.card ?? 'privacy'
  saving[setting.key] = true
  messages[card] = ''
  auth.user = {
    ...previous,
    preferences: {
      ...previous.preferences,
      ...(setting.key === 'analyseLyrics' ? { moodLens: next ? 'lyrics' : 'sound' } : { [setting.key]: next }),
    },
  }
  const optimistic = auth.user
  try {
    const updated = await updateSettings({ [setting.key]: next })
    if (auth.user !== optimistic) return
    auth.user = updated
    messages[card] = 'Saved.'
  } catch (error) {
    if (auth.user !== optimistic) return
    auth.user = previous
    messages[card] = `Couldn’t save: ${error.message}`
  } finally {
    saving[setting.key] = false
  }
}

// Saves settings that aren't on/off switches, like the birthday.
async function saveSettings(changes, card) {
  saving[card] = true
  messages[card] = ''
  try {
    auth.user = await updateSettings(changes)
    messages[card] = 'Saved.'
    return true
  } catch (error) {
    messages[card] = `Couldn’t save: ${error.message}`
    return false
  } finally {
    saving[card] = false
  }
}

// The birthday, for the star sign and the Spotify Horoscope quiz.
const today = new Date().toISOString().slice(0, 10)
const birthday = ref('')
watch(
  () => user.value?.birthday,
  (saved) => {
    birthday.value = saved ?? ''
  },
  { immediate: true },
)
const birthdayChanged = computed(() => birthday.value !== (user.value?.birthday ?? ''))
function saveBirthday() {
  saveSettings({ birthday: birthday.value || null }, 'birthday')
}
const birthdayLabel = computed(() =>
  user.value?.birthday
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
        new Date(user.value.birthday),
      )
    : '',
)

// The daily check-in reminder. It shows while MetaFor is open, so browser
// notifications are asked for too, for when the tab is in the background.
const reminderTime = ref('')
watch(
  () => user.value?.preferences?.reminderTime,
  (saved) => {
    reminderTime.value = saved ?? ''
  },
  { immediate: true },
)
const reminderChanged = computed(
  () => reminderTime.value !== (user.value?.preferences?.reminderTime ?? ''),
)
async function saveReminder(time = reminderTime.value || null) {
  const saved = await saveSettings({ reminderTime: time }, 'reminder')
  if (saved && time && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

// The journal entry pinned from Past Entries.
const pinnedEntry = ref(null)
watch(
  () => user.value?.pinnedEntryId,
  async (id) => {
    pinnedEntry.value = null
    if (!id) return
    try {
      pinnedEntry.value = await getMood(id)
    } catch (error) {
      messages.pinned = `Couldn’t load your pinned entry: ${error.message}`
    }
  },
  { immediate: true },
)
const pinnedDate = computed(() =>
  pinnedEntry.value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(pinnedEntry.value.createdAt))
    : '',
)

// Dark mode is kept in this browser, not the account. index.html makes light
// the default.
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleDark() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

// Export, clear history and disconnect Spotify. The last two ask first.
const dataMessage = ref('')
const dataBusy = ref(false)
const confirmDialog = ref(null)
const confirming = ref(null)
const todayMood = useTodayMoodStore()

const dangerActions = {
  clear: {
    title: 'Clear your history?',
    body: 'This deletes every journal entry, your listening history and your quiz results. Your account, settings and Spotify connection stay. It can’t be undone.',
    button: 'Clear history',
    async run() {
      auth.user = await clearHistory()
      personality.value = null
      // Today's check-ins are gone too, so the reminder can show.
      todayMood.load()
      return 'Your history has been cleared.'
    },
  },
  disconnect: {
    title: 'Disconnect Spotify?',
    body: 'MetaFor will forget your Spotify login and stop saving your plays. Plays already saved stay. Log in with Spotify again any time to reconnect.',
    button: 'Disconnect',
    async run() {
      auth.user = await disconnectSpotify()
      return 'Spotify is disconnected.'
    },
  },
}

function askToConfirm(action) {
  confirming.value = dangerActions[action]
  confirmDialog.value.showModal()
}

async function runConfirmed() {
  const action = confirming.value
  confirmDialog.value.close()
  dataBusy.value = true
  dataMessage.value = ''
  try {
    dataMessage.value = await action.run()
  } catch (error) {
    dataMessage.value = `Couldn’t finish: ${error.message}`
  } finally {
    dataBusy.value = false
  }
}

async function downloadData() {
  dataBusy.value = true
  dataMessage.value = ''
  try {
    const data = await exportData()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `metafor-data-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    dataMessage.value = 'Your data has been downloaded.'
  } catch (error) {
    dataMessage.value = `Couldn’t download: ${error.message}`
  } finally {
    dataBusy.value = false
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

      <section class="card" aria-labelledby="pinned-title">
        <h2 id="pinned-title" class="card-title">Pinned Entry</h2>
        <article v-if="pinnedEntry" class="pinned-entry">
          <header class="pinned-meta">
            <time :datetime="pinnedEntry.createdAt">{{ pinnedDate }}</time>
            <span class="pinned-mood" :style="{ color: `var(--color-mood-${pinnedEntry.mood.toLowerCase()}-600)` }">
              <MoodFace :mood="pinnedEntry.mood" class="pinned-face" />
              {{ pinnedEntry.mood }}
            </span>
          </header>
          <p class="pinned-text">{{ pinnedEntry.journal || 'No written reflection.' }}</p>
          <p v-if="pinnedEntry.song" class="muted small">
            Song of the Day:
            <RouterLink class="text-link" :to="`/song/${pinnedEntry.song.id}`">{{ pinnedEntry.song.name }}</RouterLink>
            by {{ pinnedEntry.song.artists.join(', ') }}
          </p>
          <p v-if="pinnedEntry.drawing?.items?.length" class="muted small">This entry has a drawing.</p>
          <div class="pinned-actions">
            <RouterLink class="text-link" :to="{ name: 'daily-mood', hash: '#past-entries' }">
              See all entries →
            </RouterLink>
            <button
              type="button"
              class="glass-secondary data-button"
              :disabled="saving.pinned"
              @click="saveSettings({ pinnedEntryId: null }, 'pinned')"
            >
              Unpin
            </button>
          </div>
        </article>
        <template v-else-if="!user?.pinnedEntryId">
          <p class="muted">Pin a favourite journal entry to keep it here.</p>
          <RouterLink class="text-link" :to="{ name: 'daily-mood', hash: '#past-entries' }">
            Choose one from Past Entries →
          </RouterLink>
        </template>
        <p class="muted small" role="status" aria-live="polite">{{ messages.pinned }}</p>
      </section>

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
              :disabled="setting.disabled || settingsPending"
              @click="toggle(setting)"
            >
              <span class="switch-thumb" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <p class="muted small privacy-note">
          MetaFor only keeps mood scores worked out from lyrics, never the lyrics themselves.
        </p>
        <p class="muted small" role="status" aria-live="polite">{{ messages.privacy }}</p>

        <h3 class="data-title">Your data</h3>
        <ul class="settings">
          <li class="setting">
            <div>
              <p class="setting-label">Export my data</p>
              <p class="muted small">Download your journal, listening history and quiz answers as a JSON file.</p>
            </div>
            <button type="button" class="glass-secondary data-button" :disabled="dataBusy" @click="downloadData">
              Export
            </button>
          </li>
          <li class="setting">
            <div>
              <p class="setting-label">Clear history</p>
              <p class="muted small">Delete your journal entries, listening history and quiz results.</p>
            </div>
            <button
              type="button"
              class="glass-secondary data-button danger"
              :disabled="dataBusy"
              @click="askToConfirm('clear')"
            >
              Clear
            </button>
          </li>
          <li class="setting">
            <div>
              <p class="setting-label">Disconnect Spotify</p>
              <p class="muted small">
                {{
                  user?.spotifyLinked
                    ? 'Stop MetaFor using your Spotify account.'
                    : 'Spotify isn’t connected right now.'
                }}
              </p>
            </div>
            <button
              type="button"
              class="glass-secondary data-button danger"
              :disabled="dataBusy || !user?.spotifyLinked"
              @click="askToConfirm('disconnect')"
            >
              Disconnect
            </button>
          </li>
        </ul>
        <p class="muted small" role="status" aria-live="polite">{{ dataMessage }}</p>

        <dialog ref="confirmDialog" class="confirm-dialog" aria-labelledby="confirm-title">
          <template v-if="confirming">
            <h3 id="confirm-title" class="card-title">{{ confirming.title }}</h3>
            <p class="muted">{{ confirming.body }}</p>
            <div class="confirm-actions">
              <button type="button" class="glass-secondary" @click="confirmDialog.close()">Cancel</button>
              <button type="button" class="glass-action danger-fill" @click="runConfirmed">
                {{ confirming.button }}
              </button>
            </div>
          </template>
        </dialog>
      </section>

      <section class="card" aria-labelledby="appearance-title">
        <h2 id="appearance-title" class="card-title">Appearance</h2>
        <ul class="settings">
          <li class="setting">
            <div>
              <p id="dark-mode-label" class="setting-label">Dark mode</p>
              <p id="dark-mode-description" class="muted small">
                Dim the colours for night-time journaling. Saved on this device.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              class="switch"
              :aria-checked="isDark"
              aria-labelledby="dark-mode-label"
              aria-describedby="dark-mode-description"
              @click="toggleDark"
            >
              <span class="switch-thumb" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <section class="card" aria-labelledby="birthday-title">
        <h2 id="birthday-title" class="card-title">Birthday and Horoscope</h2>
        <form class="inline-form" @submit.prevent="saveBirthday">
          <label for="birthday" class="setting-label">Your birthday</label>
          <div class="inline-row">
            <input id="birthday" v-model="birthday" class="field" type="date" :max="today" min="1900-01-01" />
            <button
              type="submit"
              class="glass-action data-button"
              :disabled="!birthdayChanged || saving.birthday"
            >
              Save
            </button>
          </div>
          <p class="muted small">Only used for your star sign. Clear the date and save to remove it.</p>
        </form>
        <div v-if="user?.starSign" class="horoscope">
          <p class="type-name">{{ user.starSign.name }}</p>
          <p class="muted small">
            Born {{ birthdayLabel }}, {{ user.starSign.element === 'air' || user.starSign.element === 'earth' ? 'an' : 'a' }}
            {{ user.starSign.element }} sign.
          </p>
          <p class="muted">{{ user.starSign.reading }}</p>
          <RouterLink class="text-link" :to="{ name: 'personality-quiz', params: { quizId: 'spotify-horoscope' } }">
            Read your full Spotify Horoscope →
          </RouterLink>
        </div>
        <p class="muted small" role="status" aria-live="polite">{{ messages.birthday }}</p>
      </section>

      <section class="card" aria-labelledby="reminder-title">
        <h2 id="reminder-title" class="card-title">Daily Reminder</h2>
        <form class="inline-form" @submit.prevent="saveReminder()">
          <label for="reminder-time" class="setting-label">Remind me to check in at</label>
          <div class="inline-row">
            <input id="reminder-time" v-model="reminderTime" class="field" type="time" />
            <button
              type="submit"
              class="glass-action data-button"
              :disabled="!reminderChanged || !reminderTime || saving.reminder"
            >
              Save
            </button>
            <button
              v-if="user?.preferences?.reminderTime"
              type="button"
              class="glass-secondary data-button"
              :disabled="saving.reminder"
              @click="saveReminder(null)"
            >
              Turn off
            </button>
          </div>
          <p class="muted small">
            {{
              user?.preferences?.reminderTime
                ? `If you haven’t checked in by ${user.preferences.reminderTime}, MetaFor will remind you while it’s open.`
                : 'No reminder set. Pick a time and MetaFor will remind you while it’s open, if you haven’t checked in yet.'
            }}
          </p>
        </form>
        <p class="muted small" role="status" aria-live="polite">{{ messages.reminder }}</p>
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

.identity > div {
  min-width: 0;
  overflow-wrap: anywhere;
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
  font-size: var(--text-subheader);
  font-weight: 700;
}

.badge {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  color: var(--pq-brown);
  background: var(--pq-peach);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
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
  font-size: var(--text-caption);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

dd {
  overflow-wrap: anywhere;
  font-family: var(--font-serif);
  font-size: var(--text-small);
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
  font-size: var(--text-small);
  line-height: 1.45;
}

.small {
  font-size: var(--text-label);
}

.text-link {
  margin-top: auto;
  color: var(--pq-accent);
  font-family: var(--font-sans);
  font-size: var(--text-label);
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
  font-size: var(--text-small);
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

.inline-form {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.inline-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.field {
  min-height: 44px;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--pq-border);
  border-radius: 12px;
  color: var(--pq-on-surface);
  background: var(--ui-bg-elevated);
  font: 400 var(--text-small) var(--font-sans);
  color-scheme: light dark;
}

.field:focus-visible {
  outline: 3px solid var(--pq-focus);
  outline-offset: 2px;
}

.horoscope {
  display: grid;
  gap: 0.35rem;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--pq-border);
}

.horoscope .text-link {
  margin-block: 0.5rem;
}

.pinned-entry {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.pinned-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: var(--text-label);
  font-weight: 700;
}

.pinned-mood {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

:global(.dark .profile-page .pinned-mood) {
  filter: brightness(1.6);
}

.pinned-face {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pinned-text {
  font-family: var(--font-journal);
  font-size: var(--text-subheader);
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pinned-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.pinned-actions .text-link {
  margin-top: 0;
}

.data-title {
  margin-top: 1.75rem;
  font-family: var(--font-sans);
  font-size: var(--text-small);
  font-weight: 700;
}

.data-button {
  flex-shrink: 0;
  cursor: pointer;
}

.data-button:disabled {
  cursor: not-allowed;
}

.data-button.danger {
  --button-ink: var(--color-mood-angry-700);
}

:global(.dark .profile-page .data-button.danger) {
  --button-ink: var(--color-mood-angry-300);
}

.confirm-dialog {
  width: min(440px, calc(100vw - 32px));
  margin: auto;
  padding: 1.5rem 1.75rem;
  border: 1px solid var(--pq-border);
  border-radius: 18px;
  color: var(--pq-on-surface);
  background: var(--pq-surface);
}

.confirm-dialog::backdrop {
  background: rgb(30 20 15 / 45%);
}

.confirm-dialog .muted {
  margin-top: 0.5rem;
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.confirm-actions button {
  cursor: pointer;
}

.danger-fill {
  --button-base: var(--color-mood-angry-600);
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

@media (max-width: 400px) {
  .details div,
  .facts div {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }
}
</style>
