<script setup>
import { computed, onMounted, ref } from 'vue'
import SiteFooter from '@/components/footer.vue'
import { getMoods } from '@/api/moods'
import { authorizeSpotify, hasSpotifySession, recentSpotify } from '@/api/spotify'
import { getListens, usesStoredHistory } from '@/api/listens'

const moodEmoji = { Happy: '😊', Relaxed: '😌', Sad: '😟', Anxious: '😰', Angry: '😠' }
const moodTags = {
  Happy: ['Joyful', 'Hopeful'], Relaxed: ['Calm', 'Peace'], Sad: ['Low-Fi', 'Reflective'],
  Anxious: ['Restless', 'Uncertain'], Angry: ['Intense', 'Frustrated'],
}
const today = new Date()
const shownMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selectedDate = ref(null)
const moodLogs = ref([])
const listens = ref([])
const loading = ref(true)
const moodError = ref('')
const spotifyError = ref('')
const isConnectingSpotify = ref(false)
// The test account's plays come from our database, one month at a time.
const storedHistory = usesStoredHistory()

const monthLabel = computed(() => shownMonth.value.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }))
const monthCells = computed(() => {
  const first = new Date(shownMonth.value.getFullYear(), shownMonth.value.getMonth(), 1)
  const offset = first.getDay()
  const days = new Date(shownMonth.value.getFullYear(), shownMonth.value.getMonth() + 1, 0).getDate()
  const rows = Math.ceil((offset + days) / 7) * 7
  return Array.from({ length: rows }, (_, index) => {
    const day = index - offset + 1
    return day < 1 || day > days ? null : new Date(first.getFullYear(), first.getMonth(), day)
  })
})
const keyForDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const logsByDate = computed(() => {
  const grouped = new Map()
  for (const log of moodLogs.value) {
    const key = keyForDate(new Date(log.createdAt))
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(log)
  }
  return grouped
})
const listensByDate = computed(() => {
  const grouped = new Map()
  for (const listen of listens.value) {
    const key = keyForDate(new Date(listen.played_at))
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(listen)
  }
  return grouped
})
const selectedKey = computed(() => selectedDate.value ? keyForDate(selectedDate.value) : '')
const selectedLogs = computed(() => logsByDate.value.get(selectedKey.value) || [])
const selectedListens = computed(() => listensByDate.value.get(selectedKey.value) || [])
const monthMoods = computed(() => {
  const counts = new Map()
  for (const [key, entries] of logsByDate.value) {
    const d = new Date(`${key}T12:00:00`)
    if (d.getMonth() === shownMonth.value.getMonth() && d.getFullYear() === shownMonth.value.getFullYear()) {
      for (const entry of entries) counts.set(entry.mood, (counts.get(entry.mood) || 0) + 1)
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
})
const monthSongCount = computed(() => listens.value.filter((item) => {
  const d = new Date(item.played_at)
  return d.getMonth() === shownMonth.value.getMonth() && d.getFullYear() === shownMonth.value.getFullYear()
}).length)
const monthMoodCount = computed(() => [...logsByDate.value].reduce((n, [key, entries]) => {
  const d = new Date(`${key}T12:00:00`)
  return n + (d.getMonth() === shownMonth.value.getMonth() && d.getFullYear() === shownMonth.value.getFullYear() ? entries.length : 0)
}, 0))

async function loadData() {
  loading.value = true
  moodError.value = ''
  spotifyError.value = ''
  const moodsRequest = getMoods().then((data) => { moodLogs.value = data }).catch((error) => { moodError.value = error.message })
  const spotifyRequest = storedHistory
    ? loadStoredMonth()
    : hasSpotifySession()
      ? recentSpotify().then((data) => { listens.value = data.items || [] }).catch((error) => { spotifyError.value = error.message })
      : Promise.resolve()
  await Promise.all([moodsRequest, spotifyRequest])
  loading.value = false
}
function loadStoredMonth() {
  const from = shownMonth.value
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  spotifyError.value = ''
  return getListens({ from, to, limit: 2000 })
    .then((data) => { if (shownMonth.value === from) listens.value = data.items || [] })
    .catch((error) => { spotifyError.value = error.message })
}
async function connectSpotify() {
  if (isConnectingSpotify.value) return
  isConnectingSpotify.value = true
  spotifyError.value = ''
  try {
    await authorizeSpotify()
  } catch (error) {
    spotifyError.value = error.message
    isConnectingSpotify.value = false
  }
}
function moveMonth(amount) {
  shownMonth.value = new Date(shownMonth.value.getFullYear(), shownMonth.value.getMonth() + amount, 1)
  selectedDate.value = null
  if (storedHistory) loadStoredMonth()
}
function selectDay(date) {
  selectedDate.value = selectedDate.value && keyForDate(selectedDate.value) === keyForDate(date) ? null : date
}
function isToday(date) { return keyForDate(date) === keyForDate(today) }
function tracksFor(date) { return listensByDate.value.get(keyForDate(date)) || [] }
function moodFor(date) { return (logsByDate.value.get(keyForDate(date)) || [])[0]?.mood }
function trackName(item) { return item.track?.name || 'Unknown track' }
function trackArtists(item) { return item.track?.artists?.map((artist) => artist.name).join(', ') || 'Spotify track' }

onMounted(loadData)
</script>

<template>
  <div class="calendar-page">
    <main class="calendar-content">
      <header class="calendar-intro">
        <p class="eyebrow">Your listening, your feelings</p>
        <h1>Mood Calendar</h1>
        <p>Track your daily moods and the songs that soundtracked them.</p>
      </header>

      <div v-if="loading" class="calendar-message" role="status">Gathering your days…</div>
      <div v-else-if="moodError" class="calendar-message error-message" role="alert">Could not load mood logs: {{ moodError }}</div>

      <template v-else>
        <section class="month-summary" aria-live="polite">
          <span v-if="monthMoodCount">This month, you logged <strong>{{ monthMoodCount }}</strong> mood{{ monthMoodCount === 1 ? '' : 's' }}<template v-if="monthMoods"> and most often felt <strong>{{ monthMoods.toLowerCase() }}</strong></template>.</span>
          <span v-else>No mood logs for this month yet. Add one in Daily Mood.</span>
          <span class="song-summary">{{ monthSongCount }} {{ storedHistory ? '' : 'recent Spotify ' }}play{{ monthSongCount === 1 ? '' : 's' }} shown</span>
        </section>
        <div v-if="spotifyError" class="spotify-connect-note" role="status">
          <p>{{ spotifyError }}</p>
          <button v-if="!hasSpotifySession() && !storedHistory" type="button" class="connect-spotify glass-action" :disabled="isConnectingSpotify" @click="connectSpotify">
            {{ isConnectingSpotify ? 'Connecting…' : 'Connect Spotify' }}
          </button>
        </div>
        <div v-else-if="!hasSpotifySession() && !storedHistory" class="spotify-connect-note">
          <p>Connect Spotify to see your recent songs. Spotify provides up to 50 recent plays here.</p>
          <button type="button" class="connect-spotify glass-action" :disabled="isConnectingSpotify" @click="connectSpotify">
            {{ isConnectingSpotify ? 'Connecting…' : 'Connect Spotify' }}
          </button>
        </div>

        <section class="calendar-shell" aria-label="Mood calendar">
          <button class="month-arrow previous" type="button" aria-label="Previous month" @click="moveMonth(-1)">‹</button>
          <div class="calendar-center">
            <div class="month-heading">
              <button type="button" class="month-step" aria-label="Previous month" @click="moveMonth(-1)">‹</button>
              <h2>{{ monthLabel }}</h2>
              <button type="button" class="month-step" aria-label="Next month" @click="moveMonth(1)">›</button>
            </div>
            <div class="calendar-grid">
              <div v-for="weekday in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="weekday" class="weekday">{{ weekday }}</div>
              <button
                v-for="(date, index) in monthCells"
                :key="date ? keyForDate(date) : `blank-${index}`"
                type="button"
                class="day-cell"
                :class="{ 'is-empty': !date, 'is-today': date && isToday(date), 'is-selected': date && selectedKey === keyForDate(date), 'has-content': date && (moodFor(date) || tracksFor(date).length) }"
                :disabled="!date"
                :aria-label="date ? `${date.toLocaleDateString('en-SG', { day: 'numeric', month: 'long' })}${moodFor(date) ? `, mood ${moodFor(date)}` : ''}, ${tracksFor(date).length} songs` : undefined"
                @click="date && selectDay(date)"
              >
                <span v-if="date" class="day-number">{{ date.getDate() }}</span>
                <span v-if="date && moodFor(date)" class="mood-face" :title="moodFor(date)">{{ moodEmoji[moodFor(date)] || '•' }}</span>
                <span v-if="date && tracksFor(date).length" class="song-count">♫ {{ tracksFor(date).length }}</span>
                <span v-if="date && !moodFor(date) && !tracksFor(date).length" class="empty-day" aria-hidden="true" />
              </button>
            </div>
            <p class="calendar-hint">Select a day to see its mood log and songs</p>
          </div>
          <button class="month-arrow next" type="button" aria-label="Next month" @click="moveMonth(1)">›</button>
        </section>

        <section v-if="selectedDate" class="day-detail" aria-live="polite">
          <div class="detail-header">
            <div><p class="eyebrow">On this day</p><h3>{{ selectedDate.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' }) }}</h3></div>
            <button class="close-detail" type="button" aria-label="Close day details" @click="selectedDate = null">×</button>
          </div>
          <div v-if="selectedLogs.length" class="mood-logs">
            <article v-for="(entry, index) in selectedLogs" :key="entry._id || index" class="mood-entry">
              <span class="detail-emoji">{{ moodEmoji[entry.mood] }}</span>
              <div><strong>{{ entry.mood }}</strong><p v-if="entry.journal">“{{ entry.journal }}”</p><time>{{ new Date(entry.createdAt).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) }}</time></div>
            </article>
          </div>
          <p v-else class="empty-note">No mood log saved on this day.</p>
          <div v-if="selectedListens.length" class="track-list">
            <h4>Songs you played <span>{{ selectedListens.length }}</span></h4>
            <a v-for="(item, index) in selectedListens" :key="`${item.played_at}-${index}`" class="track-card" :href="item.track?.external_urls?.spotify || '#'" target="_blank" rel="noopener noreferrer" :aria-label="`Open ${trackName(item)} on Spotify`">
              <img v-if="item.track?.album?.images?.[0]?.url" :src="item.track.album.images[item.track.album.images.length > 1 ? 1 : 0].url" alt="" />
              <span v-else class="track-art">♫</span>
              <span class="track-copy"><strong>{{ trackName(item) }}</strong><small>{{ trackArtists(item) }}</small></span>
              <span class="play-time">{{ new Date(item.played_at).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) }}</span>
            </a>
          </div>
          <p v-else class="empty-note">No recent Spotify plays found for this day.</p>
          <div v-if="selectedLogs.length" class="mood-tags"><span v-for="tag in moodTags[selectedLogs[0].mood] || []" :key="tag">{{ tag }}</span></div>
        </section>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.calendar-page { --calendar-accent: var(--color-brand-700); --calendar-accent-soft: var(--color-brand-100); min-height: calc(100vh - 76px); display: flex; flex-direction: column; background: var(--ui-bg); color: var(--ui-text); font: 18px/1.5 var(--font-serif); }
.calendar-page :is(button, time, .eyebrow, .weekday, .day-number, .song-count, .inline-note, .calendar-hint, .track-copy, .play-time, .mood-tags, .calendar-message) { font-family: var(--font-sans); }
.calendar-page :is(h1, h2, h3, h4) { font-family: var(--font-sans); }
.calendar-content { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: clamp(36px, 6vw, 72px) 0 64px; flex: 1; }
.calendar-intro { text-align: center; margin-bottom: 22px; }
.eyebrow { margin: 0 0 8px; color: var(--calendar-accent); font-size: .77rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.calendar-intro h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.2rem); }
.calendar-intro > p:last-child { margin: 10px 0 0; color: var(--ui-text-muted); }
.month-summary { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 20px; color: var(--ui-text-muted); text-align: center; }
.month-summary strong { color: var(--ui-text); }
.song-summary { color: var(--calendar-accent); font-family: var(--font-sans); font-weight: 700; }
.inline-note { margin: 12px auto 0; color: var(--ui-text-muted); font-size: .84rem; text-align: center; }
.spotify-connect-note { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; margin: 16px auto 0; color: var(--ui-text-muted); text-align: center; }
.spotify-connect-note p { margin: 0; font-size: .9rem; }
.connect-spotify { min-height: 40px !important; padding: .5rem 1rem !important; font-size: .82rem !important; }
.calendar-shell { display: grid; grid-template-columns: 64px minmax(0, 1fr) 64px; gap: 10px; align-items: center; margin: 24px auto 0; }
.calendar-center { width: min(100%, 790px); margin: 0 auto; }
.month-heading { display: flex; justify-content: center; align-items: center; gap: 18px; margin: 0 0 16px; }
.month-heading h2 { min-width: 230px; margin: 0; text-align: center; font-family: var(--font-sans); font-size: clamp(1.5rem, 4vw, 2rem); }
.month-step { display: none; }
.month-arrow { width: 56px; height: 70px; border: 0; color: var(--calendar-accent); background: transparent; font-size: 4.4rem; line-height: 1; cursor: pointer; transition: transform .16s ease; }
.month-arrow:hover { transform: scale(1.12); }
.month-arrow:focus-visible, .month-step:focus-visible, .day-cell:focus-visible { outline: 3px solid var(--color-brand-400); outline-offset: 2px; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--ui-border); border-left: 1px solid var(--ui-border); }
.weekday { padding: 10px 4px; color: var(--ui-text-muted); font-size: .7rem; font-weight: 800; letter-spacing: .06em; text-align: center; text-transform: uppercase; }
.day-cell { position: relative; display: flex; min-width: 0; min-height: clamp(74px, 10vw, 116px); flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 12px 4px 7px; border: 0; border-right: 1px solid var(--ui-border); border-bottom: 1px solid var(--ui-border); color: var(--ui-text); background: var(--ui-bg-elevated); cursor: pointer; transition: background-color .15s ease, box-shadow .15s ease; }
.day-cell:hover:not(:disabled) { background: var(--ui-bg-accented); }
.day-cell.is-empty { background: color-mix(in srgb, var(--ui-bg-accented), transparent 35%); cursor: default; }
.day-cell.is-selected { z-index: 1; box-shadow: inset 0 0 0 2px #cd6651; }
.day-cell.is-today .day-number { color: var(--calendar-accent); background: var(--calendar-accent-soft); }
.day-number { position: absolute; top: 6px; left: 7px; display: grid; width: 23px; height: 23px; place-items: center; border-radius: 50%; color: var(--ui-text-muted); font-size: .76rem; font-weight: 700; }
.mood-face { font-size: clamp(1.55rem, 3.8vw, 2.35rem); filter: drop-shadow(0 2px 2px #0002); }
.song-count { color: var(--calendar-accent); font-size: .68rem; font-weight: 800; }
.empty-day { width: 5px; height: 5px; border-radius: 50%; background: transparent; }
.calendar-hint { margin: 12px 0 0; color: var(--ui-text-muted); font-size: .78rem; text-align: center; }
.calendar-message { padding: 52px 20px; color: var(--ui-text-muted); text-align: center; }
.error-message { color: #a53e36; }
.day-detail { width: min(620px, 100%); margin: 28px auto 0; padding: 22px; border: 1px solid var(--ui-border); border-radius: 18px; background: var(--ui-bg-elevated); box-shadow: 0 12px 32px #211a2112; }
.detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.detail-header h3 { margin: 0; font-size: 1.35rem; }
.close-detail { width: 34px; height: 34px; border: 0; border-radius: 50%; color: var(--ui-text-muted); background: var(--ui-bg-accented); font-size: 1.4rem; cursor: pointer; }
.mood-logs { display: grid; gap: 10px; }
.mood-entry { display: flex; gap: 12px; padding: 12px; border-radius: 12px; background: var(--ui-bg-accented); }
.detail-emoji { font-size: 1.6rem; }
.mood-entry p { margin: 5px 0; color: var(--ui-text-muted); font-family: var(--font-serif); font-size: 1.02rem; }
.mood-entry time { color: var(--ui-text-muted); font-size: .72rem; }
.track-list { display: grid; gap: 8px; margin-top: 20px; }
.track-list h4 { display: flex; justify-content: space-between; margin: 0 0 2px; font-size: .95rem; }
.track-list h4 span { color: var(--ui-text-muted); font-size: .8rem; }
.track-card { display: flex; min-width: 0; align-items: center; gap: 12px; padding: 8px; border-radius: 11px; color: inherit; text-decoration: none; transition: background-color .15s ease; }
.track-card:hover { background: var(--ui-bg-accented); }
.track-card img, .track-art { width: 46px; height: 46px; flex: 0 0 46px; border-radius: 7px; object-fit: cover; }
.track-art { display: grid; place-items: center; color: #fff; background: #81747c; font-size: 1.4rem; }
.track-copy { display: grid; min-width: 0; gap: 3px; }
.track-copy strong, .track-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-copy strong { font-size: .87rem; }
.track-copy small { color: var(--ui-text-muted); font-size: .75rem; }
.play-time { margin-left: auto; color: var(--ui-text-muted); font-size: .72rem; white-space: nowrap; }
.empty-note { margin: 10px 0; color: var(--ui-text-muted); font-size: .86rem; }
.mood-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.mood-tags span { padding: 6px 13px; border-radius: 999px; color: var(--ui-text); background: var(--ui-bg-accented); font-size: .72rem; font-weight: 700; }
@media (max-width: 680px) {
  .calendar-content { width: min(100% - 24px, 520px); padding-top: 34px; }
  .calendar-shell { display: block; margin-top: 18px; }
  .month-heading { justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  .month-heading h2 { min-width: 0; font-size: 1.45rem; }
  .month-step { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid var(--ui-border); border-radius: 50%; color: var(--calendar-accent); background: var(--ui-bg-elevated); font-size: 1.7rem; line-height: 1; }
  .month-arrow { display: none; }
  .weekday { padding: 8px 1px; font-size: .58rem; }
  .day-cell { min-height: clamp(57px, 14vw, 78px); padding: 11px 2px 4px; }
  .day-number { top: 3px; left: 3px; width: 19px; height: 19px; font-size: .65rem; }
  .song-count { font-size: .6rem; }
  .day-detail { padding: 17px; }
}
</style>
