<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import SiteFooter from '@/components/footer.vue'
import { getMoods } from '@/api/moods'
import { authorizeSpotify, hasSpotifySession, recentSpotify, searchSpotify } from '@/api/spotify'
import { getListens, syncBeforeReading, usesStoredHistory } from '@/api/listens'

const moodEmoji = { Happy: '😊', Relaxed: '😌', Sad: '😟', Anxious: '😰', Angry: '😠' }
const moodTags = {
  Happy: ['Joyful', 'Hopeful'], Relaxed: ['Calm', 'Peace'], Sad: ['Low-Fi', 'Reflective'],
  Anxious: ['Restless', 'Uncertain'], Angry: ['Intense', 'Frustrated'],
}
const musicMoodEmoji = { happy: '😊', calm: '😌', sad: '😟', tense: '😤' }
const musicMoodLabel = { happy: 'Uplifting', calm: 'Calm', sad: 'Melancholic', tense: 'Intense' }
const today = new Date()
const shownMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selectedDate = ref(null)
const moodLogs = ref([])
const listens = ref([])
const loading = ref(true)
const moodError = ref('')
const spotifyError = ref('')
const isConnectingSpotify = ref(false)
const recommendations = ref([])
const recommendationsLoading = ref(false)
const recommendationsError = ref('')
let recommendationRequest = 0
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
const analyzedMoodsByDate = computed(() => {
  const grouped = new Map()
  for (const listen of listens.value) {
    const reading = listen.moods?.lyrics || listen.moods?.sound
    if (!reading?.family) continue
    const key = keyForDate(new Date(listen.played_at))
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(reading)
  }
  return grouped
})
const selectedKey = computed(() => selectedDate.value ? keyForDate(selectedDate.value) : '')
const selectedLogs = computed(() => logsByDate.value.get(selectedKey.value) || [])
const selectedListens = computed(() => listensByDate.value.get(selectedKey.value) || [])
const selectedListeningMood = computed(() => listeningMoodFor(selectedDate.value))
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
const songMoodTrend = computed(() => {
  const counts = { happy: 0, calm: 0, sad: 0, tense: 0 }
  for (const item of listens.value) {
    const date = new Date(item.played_at)
    if (date.getMonth() !== shownMonth.value.getMonth() || date.getFullYear() !== shownMonth.value.getFullYear()) continue
    const family = item.moods?.lyrics?.family || item.moods?.sound?.family
    if (Object.hasOwn(counts, family)) counts[family]++
  }
  return counts
})
const recommendationTarget = computed(() => {
  const { happy, calm, sad, tense } = songMoodTrend.value
  const analyzed = happy + calm + sad + tense
  if (!analyzed) return null
  if (sad + tense === 0) return happy >= calm ? 'happy' : 'calm'
  return sad >= tense ? 'happy' : 'calm'
})
const moodTrendSummary = computed(() => {
  const { happy, calm, sad, tense } = songMoodTrend.value
  const negative = sad + tense
  const total = happy + calm + sad + tense
  if (!total) return 'We need mood-analyzed songs from this month to spot a listening trend.'
  if (!negative) return `Your analyzed songs have mostly been uplifting or calm (${total} plays). Here are more ${recommendationTarget.value === 'happy' ? 'uplifting' : 'calming'} picks.`
  const trend = sad >= tense ? 'sad' : 'intense'
  return `${negative} of ${total} analyzed plays leaned ${trend}. Here are some ${recommendationTarget.value === 'happy' ? 'uplifting' : 'calming'} picks to shift the tone.`
})

async function loadData() {
  loading.value = true
  moodError.value = ''
  spotifyError.value = ''
  const moodsRequest = getMoods().then((data) => { moodLogs.value = data }).catch((error) => { moodError.value = error.message })
  const spotifyRequest = storedHistory
    ? syncBeforeReading().then(loadStoredMonth)
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
function listeningMoodFor(date) {
  if (!date) return null
  const readings = analyzedMoodsByDate.value.get(keyForDate(date)) || []
  if (!readings.length) return null
  const counts = new Map()
  for (const reading of readings) {
    const family = reading.family
    const current = counts.get(family) || { family, count: 0, names: new Map() }
    current.count++
    if (reading.name) current.names.set(reading.name, (current.names.get(reading.name) || 0) + 1)
    counts.set(family, current)
  }
  const winner = [...counts.values()].sort((a, b) => b.count - a.count)[0]
  const songMoodName = [...winner.names].sort((a, b) => b[1] - a[1])[0]?.[0]
  return { family: winner.family, count: winner.count, total: readings.length, name: songMoodName || musicMoodLabel[winner.family] || 'Mixed' }
}
function trackName(item) { return item.track?.name || 'Unknown track' }
function trackArtists(item) { return item.track?.artists?.map((artist) => artist.name).join(', ') || 'Spotify track' }

async function loadRecommendations() {
  const request = ++recommendationRequest
  recommendations.value = []
  recommendationsError.value = ''
  recommendationsLoading.value = false
  const target = recommendationTarget.value
  if (!target || !hasSpotifySession()) return
  recommendationsLoading.value = true
  const query = target === 'happy' ? 'uplifting feel good pop' : 'calm soothing acoustic'
  try {
    const response = await searchSpotify(query)
    if (request !== recommendationRequest) return
    const listenedIds = new Set(listens.value.map((item) => item.track?.id))
    recommendations.value = (response.tracks?.items || [])
      .filter((track) => track.id && !listenedIds.has(track.id))
      .slice(0, 4)
  } catch (error) {
    if (request === recommendationRequest) recommendationsError.value = error.message
  } finally {
    if (request === recommendationRequest) recommendationsLoading.value = false
  }
}

watch(songMoodTrend, loadRecommendations)
onMounted(loadData)
</script>

<template>
  <div class="calendar-page">
    <main class="calendar-content">
      <header class="calendar-intro">
        <h1 class="page-title">Mood Calendar</h1>
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
          <button v-if="!hasSpotifySession()" type="button" class="connect-spotify glass-action" :disabled="isConnectingSpotify" @click="connectSpotify">
            {{ isConnectingSpotify ? 'Connecting…' : 'Connect Spotify' }}
          </button>
        </div>
        <div v-else-if="!hasSpotifySession()" class="spotify-connect-note">
          <p>{{ storedHistory ? 'Connect your Spotify account to get song recommendations.' : 'Connect Spotify to see your recent songs and get recommendations. Spotify provides up to 50 recent plays here.' }}</p>
          <button type="button" class="connect-spotify glass-action" :disabled="isConnectingSpotify" @click="connectSpotify">
            {{ isConnectingSpotify ? 'Connecting…' : 'Connect Spotify' }}
          </button>
        </div>

        <section class="recommendation-panel" aria-labelledby="recommendations-title" aria-live="polite">
          <div class="recommendation-heading">
            <div>
              <p class="eyebrow">A small listening nudge</p>
              <h2 id="recommendations-title">Songs for a Brighter Moment</h2>
              <p class="recommendation-reason">{{ moodTrendSummary }}</p>
            </div>
            <span v-if="recommendationTarget" class="recommendation-mood">{{ recommendationTarget === 'happy' ? 'Uplifting' : 'Calming' }}</span>
          </div>
          <p v-if="recommendationsLoading" class="recommendation-status" role="status">Finding songs for you…</p>
          <p v-else-if="recommendationsError" class="recommendation-status" role="alert">{{ recommendationsError }}</p>
          <div v-else-if="recommendations.length" class="recommendation-list">
            <a v-for="track in recommendations" :key="track.id" class="recommendation-card" :href="track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`" target="_blank" rel="noopener noreferrer">
              <img v-if="track.album?.images?.length" :src="track.album.images[track.album.images.length > 1 ? 1 : 0].url" alt="" />
              <span v-else class="track-art">♫</span>
              <span class="track-copy"><strong>{{ track.name }}</strong><small>{{ track.artists?.map((artist) => artist.name).join(', ') }}</small></span>
              <span class="recommendation-open" aria-hidden="true">↗</span>
            </a>
          </div>
          <p v-else-if="!recommendationTarget" class="recommendation-status">Listen history with analyzed song moods will help shape suggestions for this month.</p>
          <p v-else-if="!hasSpotifySession()" class="recommendation-status">Connect Spotify to explore matching tracks.</p>
          <p v-else class="recommendation-status">No new matching tracks came up. Try again after more songs are analyzed.</p>
        </section>

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
                :aria-label="date ? `${date.toLocaleDateString('en-SG', { day: 'numeric', month: 'long' })}${moodFor(date) ? `, journal mood ${moodFor(date)}` : ''}${listeningMoodFor(date) ? `, listening mood ${listeningMoodFor(date).name}` : ''}, ${tracksFor(date).length} songs` : undefined"
                @click="date && selectDay(date)"
              >
                <span v-if="date" class="day-number">{{ date.getDate() }}</span>
                <span v-if="date && moodFor(date)" class="mood-face" :title="`Journal mood: ${moodFor(date)}`">{{ moodEmoji[moodFor(date)] || '•' }}</span>
                <span v-else-if="date && listeningMoodFor(date)" class="mood-face" :title="`Listening mood: ${listeningMoodFor(date).name}`">{{ musicMoodEmoji[listeningMoodFor(date).family] || '♫' }}</span>
                <span v-if="date && moodFor(date) && listeningMoodFor(date)" class="listening-mood-dot" :title="`Listening mood: ${listeningMoodFor(date).name}`">♫</span>
                <span v-if="date && tracksFor(date).length" class="song-count">♫ {{ tracksFor(date).length }}</span>
                <span v-if="date && !moodFor(date) && !listeningMoodFor(date) && !tracksFor(date).length" class="empty-day" aria-hidden="true" />
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
          <div class="day-detail-grid">
            <section class="day-detail-column journal-column" aria-labelledby="journal-history-title">
              <h4 id="journal-history-title" class="column-title">Mood &amp; Journal <span>{{ selectedLogs.length }}</span></h4>
              <div v-if="selectedLogs.length" class="mood-logs">
                <article v-for="(entry, index) in selectedLogs" :key="entry._id || index" class="mood-entry">
                  <span class="detail-emoji">{{ moodEmoji[entry.mood] }}</span>
                  <div><strong>{{ entry.mood }}</strong><p v-if="entry.journal">“{{ entry.journal }}”</p><p v-else class="no-journal">No written reflection.</p><time>{{ new Date(entry.createdAt).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) }}</time></div>
                </article>
              </div>
              <p v-else class="empty-note">No mood log saved on this day.</p>
              <div v-if="selectedLogs.length" class="mood-tags"><span v-for="tag in moodTags[selectedLogs[0].mood] || []" :key="tag">{{ tag }}</span></div>
            </section>

            <section class="day-detail-column listening-column" aria-labelledby="listening-history-title">
              <h4 id="listening-history-title" class="column-title">Songs You Played <span>{{ selectedListens.length }}</span></h4>
              <div v-if="selectedListeningMood" class="listening-mood-summary">
                <span class="listening-mood-icon">{{ musicMoodEmoji[selectedListeningMood.family] || '♫' }}</span>
                <span class="listening-mood-copy"><small>Most common music mood</small><strong>{{ selectedListeningMood.name }}</strong></span>
                <span class="analyzed-count">{{ selectedListeningMood.count }} / {{ selectedListeningMood.total }} analyzed</span>
              </div>
              <p v-else-if="selectedListens.length" class="analysis-note">Mood analysis isn’t available for these songs yet.</p>
              <div v-if="selectedListens.length" class="track-list">
                <a v-for="(item, index) in selectedListens" :key="`${item.played_at}-${index}`" class="track-card" :href="item.track?.external_urls?.spotify || '#'" target="_blank" rel="noopener noreferrer" :aria-label="`Open ${trackName(item)} on Spotify`">
                  <img v-if="item.track?.album?.images?.[0]?.url" :src="item.track.album.images[item.track.album.images.length > 1 ? 1 : 0].url" alt="" />
                  <span v-else class="track-art">♫</span>
                  <span class="track-copy"><strong>{{ trackName(item) }}</strong><small>{{ trackArtists(item) }}</small></span>
                  <span class="play-time">{{ new Date(item.played_at).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) }}</span>
                </a>
              </div>
              <p v-else class="empty-note">No recent Spotify plays found for this day.</p>
            </section>
          </div>
        </section>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.calendar-page { --calendar-accent: var(--color-brand-700); --calendar-accent-soft: var(--color-brand-100); min-height: calc(100vh - 76px); display: flex; flex-direction: column; background: var(--ui-bg); color: var(--ui-text); font: var(--text-body)/1.5 var(--font-serif); }
.calendar-page :is(button, time, .eyebrow, .weekday, .day-number, .song-count, .inline-note, .calendar-hint, .track-copy, .play-time, .mood-tags, .calendar-message) { font-family: var(--font-sans); }
.calendar-page :is(h1, h2, h3, h4) { font-family: var(--font-sans); }
.calendar-content { width: min(1120px, calc(100% - 40px)); margin: 0 auto; padding: clamp(36px, 6vw, 72px) 0 64px; flex: 1; }
.calendar-intro { margin-bottom: 22px; }
.eyebrow { margin: 0 0 8px; }
.calendar-intro h1 { margin: 0; }
.calendar-intro > p:last-child { margin: 10px 0 0; color: var(--ui-text-muted); }
.month-summary { display: flex; flex-wrap: wrap; gap: 8px 20px; color: var(--ui-text-muted); }
.month-summary strong { color: var(--ui-text); }
.song-summary { color: var(--calendar-accent); font-family: var(--font-sans); font-weight: 700; }
.inline-note { margin: 12px 0 0; color: var(--ui-text-muted); font-size: .84rem; }
.spotify-connect-note { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 16px 0 0; color: var(--ui-text-muted); }
.spotify-connect-note p { margin: 0; font-size: .9rem; }
.connect-spotify { min-height: 40px !important; padding: .5rem 1rem !important; font-size: .82rem !important; }
.recommendation-panel { width: min(790px, 100%); margin: 24px auto 0; padding: 22px; border: 1px solid var(--ui-border); border-radius: 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--ui-bg-elevated), var(--color-brand-100) 32%), var(--ui-bg-elevated) 72%); box-shadow: 0 10px 28px #211a210b; }
.recommendation-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.recommendation-heading h2 { margin: 0; font-size: var(--text-subheader); font-weight: 600; }
.recommendation-reason { max-width: 62ch; margin: 7px 0 0; color: var(--ui-text-muted); font-size: .94rem; }
.recommendation-mood { flex: 0 0 auto; padding: 6px 12px; border-radius: 999px; color: var(--calendar-accent); background: var(--calendar-accent-soft); font-size: .72rem; font-weight: 800; }
.recommendation-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
.recommendation-card { display: flex; min-width: 0; align-items: center; gap: 10px; padding: 9px; border: 1px solid var(--ui-border); border-radius: 12px; color: inherit; background: var(--ui-bg-elevated); text-decoration: none; transition: border-color .16s ease, transform .16s ease; }
.recommendation-card:hover { transform: translateY(-1px); border-color: var(--color-brand-300); }
.recommendation-card img, .recommendation-card .track-art { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 8px; object-fit: cover; }
.recommendation-card .track-copy { display: grid; min-width: 0; gap: 3px; }
.recommendation-card .track-copy strong, .recommendation-card .track-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recommendation-card .track-copy strong { font-size: .8rem; }
.recommendation-card .track-copy small { color: var(--ui-text-muted); font-size: .7rem; }
.recommendation-open { margin-left: auto; color: var(--calendar-accent); font-size: 1.1rem; }
.recommendation-status { margin: 14px 0 0; color: var(--ui-text-muted); font-size: .85rem; }
.calendar-shell { display: grid; grid-template-columns: 64px minmax(0, 1fr) 64px; gap: 10px; align-items: center; margin: 24px auto 0; }
.calendar-center { width: min(100%, 790px); }
.month-heading { display: flex; justify-content: center; align-items: center; gap: 18px; margin: 0 0 16px; }
.month-heading h2 { min-width: 230px; margin: 0; text-align: center; font-family: var(--font-sans); font-size: var(--text-header); }
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
.listening-mood-dot { position: absolute; top: 8px; right: 8px; color: var(--calendar-accent); font-family: var(--font-sans); font-size: .7rem; font-weight: 800; }
.song-count { color: var(--calendar-accent); font-size: .68rem; font-weight: 800; }
.empty-day { width: 5px; height: 5px; border-radius: 50%; background: transparent; }
.calendar-hint { margin: 12px 0 0; color: var(--ui-text-muted); font-size: .78rem; }
.calendar-message { padding: 52px 20px; color: var(--ui-text-muted); text-align: center; }
.error-message { color: #a53e36; }
.day-detail { width: min(1040px, 100%); margin: 28px auto 0; padding: 22px; border: 1px solid var(--ui-border); border-radius: 18px; background: var(--ui-bg-elevated); box-shadow: 0 12px 32px #211a2112; }
.detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.detail-header h3 { margin: 0; font-size: var(--text-subheader); font-weight: 600; }
.close-detail { width: 34px; height: 34px; border: 0; border-radius: 50%; color: var(--ui-text-muted); background: var(--ui-bg-accented); font-size: 1.4rem; cursor: pointer; }
.day-detail-grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 20px; }
.day-detail-column { min-width: 0; padding: 16px; border: 1px solid var(--ui-border); border-radius: 14px; background: color-mix(in srgb, var(--ui-bg), var(--ui-bg-elevated) 55%); }
.column-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; font-size: var(--text-subheader); font-weight: 600; }
.column-title span { color: var(--ui-text-muted); font-size: .76rem; }
.listening-mood-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px; border: 1px solid var(--ui-border); border-radius: 11px; background: var(--ui-bg-elevated); }
.listening-mood-icon { font-size: 1.5rem; }
.listening-mood-copy { display: grid; gap: 2px; }
.listening-mood-copy small { color: var(--ui-text-muted); font-family: var(--font-sans); font-size: .68rem; }
.listening-mood-copy strong { font-family: var(--font-sans); font-size: .86rem; }
.analyzed-count { margin-left: auto; color: var(--ui-text-muted); font-family: var(--font-sans); font-size: .68rem; text-align: right; }
.analysis-note { margin: 0 0 12px; color: var(--ui-text-muted); font-family: var(--font-sans); font-size: .78rem; }
.mood-logs { display: grid; gap: 10px; }
.mood-entry { display: flex; gap: 12px; padding: 12px; border-radius: 12px; background: var(--ui-bg-accented); }
.detail-emoji { font-size: 1.6rem; }
.mood-entry p { margin: 5px 0; color: var(--ui-text-muted); font-family: var(--font-serif); font-size: var(--text-body); }
.mood-entry .no-journal { font-style: italic; }
.mood-entry time { color: var(--ui-text-muted); font-size: .72rem; }
.track-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 20px; }
.track-list h4 { grid-column: 1 / -1; }
.track-card { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 9px; padding: 10px; border: 1px solid var(--ui-border); border-radius: 13px; color: inherit; background: var(--ui-bg-elevated); text-decoration: none; transition: background-color .15s ease, border-color .15s ease, transform .15s ease; }
.track-card:hover { transform: translateY(-1px); border-color: var(--color-brand-300); background: var(--ui-bg-accented); }
.track-card img, .track-card .track-art { width: 100%; aspect-ratio: 1; flex: 0 0 auto; border-radius: 9px; object-fit: cover; }
.track-art { display: grid; place-items: center; color: #fff; background: #81747c; font-size: 1.4rem; }
.track-copy { display: grid; min-width: 0; gap: 3px; }
.track-card .track-copy { width: 100%; }
.track-copy strong, .track-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-copy strong { font-size: .87rem; }
.track-copy small { color: var(--ui-text-muted); font-size: .75rem; }
.play-time { margin: auto 0 0; color: var(--ui-text-muted); font-size: .72rem; white-space: nowrap; }
.empty-note { margin: 10px 0; color: var(--ui-text-muted); font-size: .86rem; }
.mood-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.mood-tags span { padding: 6px 13px; border-radius: 999px; color: var(--ui-text); background: var(--ui-bg-accented); font-size: .72rem; font-weight: 700; }
@media (max-width: 768px) {
  .calendar-content { width: min(100% - 24px, 520px); padding-top: 34px; }
  .calendar-shell { display: block; margin-top: 18px; }
  .month-heading { justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  .month-heading h2 { min-width: 0; }
  .month-step { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid var(--ui-border); border-radius: 50%; color: var(--calendar-accent); background: var(--ui-bg-elevated); font-size: 1.7rem; line-height: 1; }
  .month-arrow { display: none; }
  .weekday { padding: 8px 1px; font-size: .58rem; }
  .day-cell { min-height: clamp(57px, 14vw, 78px); padding: 11px 2px 4px; }
  .day-number { top: 3px; left: 3px; width: 19px; height: 19px; font-size: .65rem; }
  .song-count { font-size: .6rem; }
  .day-detail { padding: 17px; }
  .day-detail-grid { grid-template-columns: 1fr; gap: 12px; }
  .day-detail-column { padding: 13px; }
  .recommendation-panel { padding: 16px; }
  .recommendation-heading { display: block; }
  .recommendation-mood { display: inline-flex; margin-top: 10px; }
  .recommendation-list { grid-template-columns: 1fr; }
}
</style>
