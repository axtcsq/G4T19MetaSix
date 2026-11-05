<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SiteFooter from '@/components/layout/footer.vue'
import MoodTag from '@/components/mood/MoodTag.vue'
import MoodFace from '@/components/journal/MoodFace.vue'
import { getMoods } from '@/api/moods'
import { authorizeSpotify, hasSpotifySession, recentSpotify } from '@/api/spotify'
import { getRecommendations } from '@/api/recommendations'
import { getListens, getOverallMood, syncBeforeReading, usesStoredHistory } from '@/api/listens'
import { useListeningRoom } from '@/composables/useListeningRoom'

defineOptions({ name: "MoodCalendar" })

const musicMoodLabel = { happy: 'Uplifting', calm: 'Calm', sad: 'Melancholic', tense: 'Intense' }
const musicMoodType = { happy: 'Happy', calm: 'Relaxed', sad: 'Sad', tense: 'Anxious' }
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
// The shown month's mood from the journal and listening together, from the server.
const overallMood = ref(null)
// True while another month's plays and overall mood load.
const monthLoading = ref(false)
const recommendationsError = ref('')
const recommendationPage = ref(0)
const shownRecommendationIds = new Set()
let recommendationRequest = 0
// The test account's plays come from our database, one month at a time.
const storedHistory = usesStoredHistory()
const router = useRouter()
const listeningRoom = useListeningRoom()

function playRecommendation(track) {
  router.push({ name: 'listen', query: { track: track.id, uri: track.uri, title: track.name, artist: track.artists.join(', '), image: track.imageUrl || undefined } })
}

function openRecommendationSong(event, track) {
  event.stopPropagation()
  router.push(`/song/${track.id}`)
}

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
const selectedListens = computed(() =>
  [...(listensByDate.value.get(selectedKey.value) || [])].sort(
    (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime(),
  ),
)
const showAllSelectedListens = ref(false)
watch(selectedKey, () => {
  showAllSelectedListens.value = false
})
function toggleAllSelectedListens() {
  showAllSelectedListens.value = !showAllSelectedListens.value
}
const selectedListeningMood = computed(() => listeningMoodFor(selectedDate.value))
const recommendationArtists = computed(() => {
  const artists = new Map()
  for (const item of listens.value) {
    const date = new Date(item.played_at)
    if (date.getMonth() !== shownMonth.value.getMonth() || date.getFullYear() !== shownMonth.value.getFullYear()) continue
    for (const artist of item.track?.artists || []) {
      const key = artist.id || artist.name?.toLocaleLowerCase()
      if (!key || !artist.name) continue
      const current = artists.get(key) || { id: artist.id, name: artist.name, plays: 0 }
      current.plays++
      artists.set(key, current)
    }
  }
  return [...artists.values()].sort((a, b) => b.plays - a.plays).slice(0, 5)
})
const recommendationTypeMix = computed(() => {
  let known = 0
  let instrumental = 0
  for (const item of listens.value) {
    const date = new Date(item.played_at)
    if (date.getMonth() !== shownMonth.value.getMonth() || date.getFullYear() !== shownMonth.value.getFullYear()) continue
    const value = item.moods?.instrumentalness
    if (!Number.isFinite(value)) continue
    known++
    if (value >= 0.5) instrumental++
  }
  const instrumentalShare = known ? instrumental / known : 0.5
  return { instrumental: Math.round(instrumentalShare * 4), vocal: 4 - Math.round(instrumentalShare * 4) }
})
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
// Uplifting picks after a sad month, calming ones after a tense one. Uses the
// journal and listening together when the server has them, else plays only.
const MOOD_NAMES = { happy: 'happy', relaxed: 'calm', sad: 'sad', angry: 'angry', anxious: 'anxious' }
const AXIS_FACES = { happy: 'Happy', relaxed: 'Relaxed', sad: 'Sad', angry: 'Angry', anxious: 'Anxious' }
// Each day's journal and music blended, from the server ("YYYY-MM-DD" -> axis).
const overallByDate = computed(() => new Map((overallMood.value?.days || []).map((day) => [day.date, day.main])))
// The face a day shows: the blend when there is one, else the journal, else the music.
function dayFaceFor(date) {
  if (!date) return null
  const main = overallByDate.value.get(keyForDate(date))
  if (main) return { type: AXIS_FACES[main], title: `Overall mood: ${MOOD_NAMES[main]} (journal and music together)` }
  const journal = moodFor(date)
  if (journal) return { type: journal, title: `Journal mood: ${journal}` }
  const listening = listeningMoodFor(date)
  return listening && { type: moodFaceType(listening.family), title: `Listening mood: ${listening.name}` }
}
const selectedOverall = computed(() => selectedDate.value && overallByDate.value.get(selectedKey.value))
const combinedTarget = computed(() => {
  const mood = overallMood.value
  if (!mood?.main) return null
  const { happy, relaxed, sad, angry, anxious } = mood.axes
  const tense = angry + anxious
  if (sad + tense === 0) return happy >= relaxed ? 'happy' : 'calm'
  return sad >= tense ? 'happy' : 'calm'
})
const recommendationTarget = computed(() => {
  if (combinedTarget.value) return combinedTarget.value
  const { happy, calm, sad, tense } = songMoodTrend.value
  const analyzed = happy + calm + sad + tense
  if (!analyzed) return null
  if (sad + tense === 0) return happy >= calm ? 'happy' : 'calm'
  return sad >= tense ? 'happy' : 'calm'
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
  await Promise.all([moodsRequest, spotifyRequest, loadOverallMood()])
  loading.value = false
  restartRecommendations()
}
// Only signed-in users have a stored journal and history to combine.
function loadOverallMood() {
  const month = shownMonth.value
  overallMood.value = null
  if (!storedHistory) return Promise.resolve()
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  return getOverallMood(keyForDate(month), keyForDate(last))
    .then((data) => { if (shownMonth.value === month) overallMood.value = data })
    // The plays-only trend stands in.
    .catch(() => {})
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
  const month = shownMonth.value
  monthLoading.value = true
  Promise.all([storedHistory ? loadStoredMonth() : null, loadOverallMood()]).finally(() => {
    if (shownMonth.value !== month) return
    monthLoading.value = false
    restartRecommendations()
  })
}
function selectDay(date) {
  selectedDate.value = selectedDate.value && keyForDate(selectedDate.value) === keyForDate(date) ? null : date
}
function isToday(date) { return keyForDate(date) === keyForDate(today) }
function tracksFor(date) { return listensByDate.value.get(keyForDate(date)) || [] }
const mostReplayedByDate = computed(() => {
  const mostReplayed = new Map()
  for (const [dateKey, items] of listensByDate.value) {
    const playCounts = new Map()
    for (const item of items) {
      const track = item.track
      if (!track) continue
      const trackKey = track.id || `${track.name}-${(track.artists || []).map((artist) => artist.name).join(',')}`
      const current = playCounts.get(trackKey) || { track, count: 0, lastPlayed: 0 }
      current.count += 1
      current.lastPlayed = Math.max(current.lastPlayed, new Date(item.played_at).getTime())
      playCounts.set(trackKey, current)
    }
    const favorite = [...playCounts.values()].sort((a, b) => b.count - a.count || b.lastPlayed - a.lastPlayed)[0]
    const images = favorite?.track.album?.images || []
    const cover = images[images.length > 1 ? 1 : 0]?.url
    if (favorite && cover) mostReplayed.set(dateKey, { ...favorite, cover })
  }
  return mostReplayed
})
function mostReplayedFor(date) { return date ? mostReplayedByDate.value.get(keyForDate(date)) : null }
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
function moodFaceType(mood) { return musicMoodType[mood] || mood }
function moodFaceClass(mood) {
  const type = moodFaceType(mood).toLowerCase()
  return [`mood-reaction--${type}`, `mood-color--${type}`]
}
function trackName(item) { return item.track?.name || 'Unknown track' }
function trackArtists(item) { return item.track?.artists?.map((artist) => artist.name).join(', ') || 'Spotify track' }

async function loadRecommendations() {
  const request = ++recommendationRequest
  recommendations.value = []
  recommendationsError.value = ''
  recommendationsLoading.value = false
  const target = recommendationTarget.value
  const artists = recommendationArtists.value
  if (!target || !artists.length) return
  recommendationsLoading.value = true
  try {
    // Skip songs already played this month and ones suggested before.
    const exclude = new Set(listens.value.map((item) => item.track?.id).filter(Boolean))
    shownRecommendationIds.forEach((id) => exclude.add(id))
    const { tracks } = await getRecommendations({
      target,
      artists: artists.map(({ name, plays }) => ({ name, plays })),
      mix: recommendationTypeMix.value,
      exclude: [...exclude].slice(-2000),
      page: recommendationPage.value,
    })
    if (request !== recommendationRequest) return
    recommendations.value = tracks
    tracks.forEach((track) => shownRecommendationIds.add(track.id))
  } catch (error) {
    if (request === recommendationRequest) recommendationsError.value = error.message
  } finally {
    if (request === recommendationRequest) recommendationsLoading.value = false
  }
}

function refreshRecommendations() {
  if (recommendationsLoading.value) return
  recommendationPage.value++
  loadRecommendations()
}

function restartRecommendations() {
  recommendationPage.value = 0
  shownRecommendationIds.clear()
  loadRecommendations()
}
// A month's plays and its overall mood arrive separately; asking for suggestions
// after each would hit the server's few-second limit, so wait for both.
watch([recommendationTarget, recommendationArtists, recommendationTypeMix], () => {
  if (loading.value || monthLoading.value) return
  restartRecommendations()
})
onMounted(() => {
  loadData()
  listeningRoom.initialize()
})
</script>

<template>
  <div class="calendar-page">
    <main class="calendar-content">
      <header class="calendar-intro">
        <h1 class="page-title">Mood Calendar</h1>
      </header>

      <!-- A faded calendar stands in while the month loads. -->
      <section v-if="loading" class="calendar-shell calendar-skeleton" role="status" aria-label="Loading your mood calendar">
        <span class="month-arrow" aria-hidden="true" />
        <div class="calendar-center" aria-hidden="true">
          <div class="month-heading"><span class="skeleton-bar skeleton-month" /></div>
          <div class="calendar-grid">
            <div v-for="weekday in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="weekday" class="weekday">{{ weekday }}</div>
            <span v-for="cell in 35" :key="cell" class="day-cell skeleton-cell" />
          </div>
        </div>
        <span class="month-arrow" aria-hidden="true" />
      </section>
      <div v-else-if="moodError" class="calendar-message error-message" role="alert">Could not load mood logs: {{ moodError }}</div>

      <template v-else>
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
              <div v-if="recommendationArtists.length" class="recommendation-personalization">
                <span>Artists similar to the ones you played most:</span>
                <span v-for="artist in recommendationArtists" :key="artist.id || artist.name" class="artist-chip">{{ artist.name }}</span>
              </div>
            </div>
            <div class="recommendation-actions">
              <span v-if="recommendationTarget" class="recommendation-mood">{{ recommendationTarget === 'happy' ? 'Uplifting' : 'Calming' }}</span>
              <button
                v-if="recommendationTarget && recommendationArtists.length"
                type="button"
                class="refresh-recommendations glass-secondary"
                :disabled="recommendationsLoading"
                @click="refreshRecommendations"
              >
                {{ recommendationsLoading ? 'Refreshing…' : 'Refresh songs' }}
              </button>
            </div>
          </div>
          <p v-if="recommendationsLoading" class="recommendation-status" role="status">Finding songs for you…</p>
          <p v-else-if="recommendationsError" class="recommendation-status" role="alert">{{ recommendationsError }}</p>
          <div v-else-if="recommendations.length" class="recommendation-list">
            <div v-for="track in recommendations" :key="track.id" class="recommendation-card">
              <span class="art-link" aria-hidden="true">
                <img v-if="track.imageUrl" :src="track.imageUrl" alt="" />
                <span v-else class="track-art">♫</span>
              </span>
              <span class="track-copy"><a class="recommendation-title" :href="`/song/${track.id}`" @click.prevent="openRecommendationSong($event, track)"><strong>{{ track.name }}</strong></a><small>{{ track.artists.join(', ') }}</small><small class="recommendation-source">{{ track.because }}</small><MoodTag :track-id="track.id" size="sm" :link="false" :hide-pending-lyrics="track.instrumental" /></span>
              <button class="recommendation-open" type="button" @click="playRecommendation(track)">Play song</button>
            </div>
          </div>
          <p v-else-if="!recommendationTarget" class="recommendation-status">Listen history with analyzed song moods will help shape suggestions for this month.</p>
          <p v-else class="recommendation-status">No fully analysed songs by similar artists matched the mood yet. New matches are being analysed, so try refreshing later or for other artists.</p>
        </section>

        <section class="calendar-shell" aria-label="Mood calendar">
          <button class="month-arrow previous glass-icon" type="button" aria-label="Previous month" @click="moveMonth(-1)">‹</button>
          <div class="calendar-center">
            <div class="month-heading">
              <button type="button" class="month-step glass-icon" aria-label="Previous month" @click="moveMonth(-1)">‹</button>
              <h2>{{ monthLabel }}</h2>
              <button type="button" class="month-step glass-icon" aria-label="Next month" @click="moveMonth(1)">›</button>
            </div>
            <div class="calendar-grid">
              <div v-for="weekday in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="weekday" class="weekday">{{ weekday }}</div>
              <button
                v-for="(date, index) in monthCells"
                :key="date ? keyForDate(date) : `blank-${index}`"
                type="button"
                class="day-cell"
                :class="{ 'is-empty': !date, 'is-today': date && isToday(date), 'is-selected': date && selectedKey === keyForDate(date), 'has-content': date && (moodFor(date) || tracksFor(date).length), 'has-listens': date && tracksFor(date).length }"
                :disabled="!date"
                :aria-label="date ? `${date.toLocaleDateString('en-SG', { day: 'numeric', month: 'long' })}${overallByDate.get(keyForDate(date)) ? `, overall mood ${MOOD_NAMES[overallByDate.get(keyForDate(date))]}` : ''}${moodFor(date) ? `, journal mood ${moodFor(date)}` : ''}${listeningMoodFor(date) ? `, listening mood ${listeningMoodFor(date).name}` : ''}, ${tracksFor(date).length} songs${mostReplayedFor(date) ? `, most replayed ${mostReplayedFor(date).track.name}` : ''}` : undefined"
                @click="date && selectDay(date)"
              >
                <span v-if="date && mostReplayedFor(date)" class="day-artwork-cover" aria-hidden="true">
                  <img :src="mostReplayedFor(date).cover" alt="" loading="lazy" decoding="async" />
                </span>
                <span v-if="date" class="day-number">{{ date.getDate() }}</span>
                <span v-if="date && dayFaceFor(date)" class="calendar-face mood-reaction" :class="moodFaceClass(dayFaceFor(date).type)" :title="dayFaceFor(date).title">
                  <MoodFace :mood="dayFaceFor(date).type" class="button-mood-face calendar-face-svg" />
                </span>
                <span v-if="date && moodFor(date) && listeningMoodFor(date)" class="listening-mood-dot" :title="`Listening mood: ${listeningMoodFor(date).name}`">♫</span>
                <span v-if="date && tracksFor(date).length" class="song-count">♫ {{ tracksFor(date).length }}</span>
                <span v-if="date && !moodFor(date) && !listeningMoodFor(date) && !tracksFor(date).length" class="empty-day" aria-hidden="true" />
              </button>
            </div>
            <p class="calendar-hint">Select a day to see its mood log and songs</p>
          </div>
          <button class="month-arrow next glass-icon" type="button" aria-label="Next month" @click="moveMonth(1)">›</button>
        </section>

        <section v-if="selectedDate" class="day-detail" aria-live="polite">
          <div class="detail-header">
            <div>
              <p class="eyebrow">On this day</p><h3>{{ selectedDate.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' }) }}</h3>
              <p v-if="selectedOverall" class="day-overall">Overall, with journal and music together: <strong>{{ MOOD_NAMES[selectedOverall] }}</strong></p>
            </div>
            <button class="close-detail glass-icon" type="button" aria-label="Close day details" @click="selectedDate = null">×</button>
          </div>
          <div class="day-detail-grid">
            <section class="day-detail-column journal-column" aria-labelledby="journal-history-title">
              <h4 id="journal-history-title" class="column-title">Mood &amp; Journal <span>{{ selectedLogs.length }}</span></h4>
              <div v-if="selectedLogs.length" class="mood-logs">
                <RouterLink
                  v-for="(entry, index) in selectedLogs"
                  :key="entry._id || index"
                  :to="{ name: 'daily-mood', query: { entryId: entry._id } }"
                  class="mood-entry-link"
                  :aria-label="`Open full ${entry.mood} journal entry from ${new Date(entry.createdAt).toLocaleDateString('en-SG')}`"
                >
                  <article class="mood-entry">
                    <span class="detail-mood-face mood-reaction" :class="moodFaceClass(entry.mood)">
                      <MoodFace :mood="entry.mood" class="button-mood-face detail-face-svg" />
                    </span>
                    <div><strong>{{ entry.mood }}</strong><p v-if="entry.journal">“{{ entry.journal }}”</p><p v-else class="no-journal">No written reflection.</p><time>{{ new Date(entry.createdAt).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) }}</time></div>
                  </article>
                </RouterLink>
              </div>
              <p v-else class="empty-note">No mood log saved on this day.</p>
            </section>

            <section class="day-detail-column listening-column" aria-labelledby="listening-history-title">
              <h4 id="listening-history-title" class="column-title">Songs You Played <span>{{ selectedListens.length }}</span></h4>
              <div v-if="selectedListeningMood" class="listening-mood-summary">
                <span class="listening-mood-icon mood-reaction" :class="moodFaceClass(selectedListeningMood.family)">
                  <MoodFace :mood="moodFaceType(selectedListeningMood.family)" class="button-mood-face listening-face-svg" />
                </span>
                <span class="listening-mood-copy"><small>Most common music mood</small><strong>{{ selectedListeningMood.name }}</strong></span>
                <span class="analyzed-count">{{ selectedListeningMood.count }} / {{ selectedListeningMood.total }} analyzed</span>
              </div>
              <p v-else-if="selectedListens.length" class="analysis-note">Mood analysis isn’t available for these songs yet.</p>
              <div v-if="selectedListens.length" class="listening-carousel" role="group" aria-roledescription="carousel" aria-label="Listening history">
                <div class="track-list" :class="{ 'is-carousel': !showAllSelectedListens, 'is-all-tracks': showAllSelectedListens }" tabindex="0" aria-label="Song cards; scroll horizontally to browse">
                    <!-- Keep Spotify artwork and song mood links separate. -->
                    <article v-for="(item, index) in selectedListens" :key="`${item.played_at}-${index}`" class="track-card">
                      <a class="track-link" :href="item.track?.external_urls?.spotify || '#'" target="_blank" rel="noopener noreferrer" :aria-label="`Open ${trackName(item)} on Spotify (opens new tab)`">
                        <img v-if="item.track?.album?.images?.[0]?.url" :src="item.track.album.images[item.track.album.images.length > 1 ? 1 : 0].url" alt="" />
                        <span v-else class="track-art">♫</span>
                      </a>
                      <span class="track-copy"><RouterLink v-if="item.track?.id" class="title-link" :to="`/song/${item.track.id}`"><strong>{{ trackName(item) }}</strong><span class="sr-only">, see its mood</span></RouterLink><strong v-else>{{ trackName(item) }}</strong><small>{{ trackArtists(item) }}</small></span>
                      <MoodTag :track-id="item.track?.id" size="sm" />
                      <span class="play-time">{{ new Date(item.played_at).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) }}</span>
                    </article>
                  </div>
              </div>
              <button
                v-if="selectedListens.length > 4"
                class="history-toggle"
                type="button"
                :aria-expanded="showAllSelectedListens"
                @click="toggleAllSelectedListens"
              >
                {{ showAllSelectedListens ? 'Show less' : 'View all' }}
              </button>
              <p v-if="!selectedListens.length" class="empty-note">No recent Spotify plays found for this day.</p>
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
.calendar-content { width: var(--page-width); margin: 0 auto; padding: var(--page-top) 0 var(--page-bottom); flex: 1; }
.calendar-intro { margin-bottom: 22px; }
.eyebrow { margin: 0 0 8px; }
.calendar-intro h1 { margin: 0; }
.calendar-intro > p:last-child { margin: 10px 0 0; color: var(--ui-text-muted); }
.day-overall { margin: 4px 0 0; color: var(--ui-text-muted); }
.day-overall strong { color: var(--ui-text); }
.song-summary { color: var(--calendar-accent); font-family: var(--font-sans); font-weight: 700; }
.inline-note { margin: 12px 0 0; color: var(--ui-text-muted); font-size: var(--text-label); }
.spotify-connect-note { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 16px 0 0; color: var(--ui-text-muted); }
.spotify-connect-note p { margin: 0; font-size: var(--text-label); }

.recommendation-panel { width: 100%; margin: 24px 0 0; padding: 22px; border: 1px solid var(--ui-border); border-radius: 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--ui-bg-elevated), var(--color-brand-100) 32%), var(--ui-bg-elevated) 72%); box-shadow: 0 10px 28px #211a210b; }
.recommendation-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.recommendation-heading h2 { margin: 0; font-size: var(--text-subheader); font-weight: 600; }
.recommendation-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.refresh-recommendations { min-height: 34px !important; padding: 5px 11px !important; font-size: var(--text-label) !important; }
.refresh-recommendations:disabled { opacity: .65; cursor: wait; }
.recommendation-personalization { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 10px 0 0; color: var(--ui-text-muted); font-family: var(--font-sans); font-size: var(--text-caption); }
.artist-chip { padding: 4px 9px; border-radius: 999px; color: var(--calendar-accent); background: var(--calendar-accent-soft); font-weight: 700; }
.recommendation-mood { flex: 0 0 auto; padding: 6px 12px; border-radius: 999px; color: var(--calendar-accent); background: var(--calendar-accent-soft); font-size: var(--text-caption); font-weight: 800; }
.recommendation-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
.recommendation-card { display: flex; min-width: 0; align-items: center; gap: 10px; padding: 9px; border: 1px solid var(--ui-border); border-radius: 12px; color: inherit; background: var(--ui-bg-elevated); transition: border-color .16s ease, transform .16s ease; }
.recommendation-card:hover { border-color: var(--color-brand-300); }
.recommendation-card img, .recommendation-card .track-art { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 8px; object-fit: cover; }
.recommendation-card .track-copy { display: grid; min-width: 0; gap: 3px; }
.recommendation-card .track-copy strong, .recommendation-card .track-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recommendation-card .track-copy strong { font-size: var(--text-caption); }
.recommendation-card .track-copy small { color: var(--ui-text-muted); font-size: var(--text-caption); }
.recommendation-card .track-copy .recommendation-source { color: var(--calendar-accent); font-size: var(--text-caption); font-weight: 700; }
.recommendation-open { flex: 0 0 auto; margin-left: auto; padding: 7px 10px; border: 0; border-radius: 999px; color: var(--calendar-accent); background: var(--calendar-accent-soft); font: inherit; font-size: var(--text-caption); font-weight: 700; cursor: pointer; }
.recommendation-status { margin: 14px 0 0; color: var(--ui-text-muted); font-size: var(--text-label); }
.calendar-shell { display: grid; width: 100%; grid-template-columns: 48px minmax(0, 1fr) 48px; gap: 8px; align-items: center; margin: 24px auto 0; }
.calendar-center { width: 100%; }
.month-heading { display: flex; justify-content: center; align-items: center; gap: 18px; margin: 0 0 16px; }
.month-heading h2 { min-width: 230px; margin: 0; text-align: center; font-family: var(--font-sans); font-size: var(--text-header); }
.month-step { display: none; }
.month-arrow { width: 56px; height: 70px; border: 0; color: var(--calendar-accent); background: transparent; font-size: 4.4rem; line-height: 1; cursor: pointer; transition: transform .16s ease; }
.month-arrow:hover { transform: scale(1.12); }
.month-arrow:focus-visible, .month-step:focus-visible, .day-cell:focus-visible { outline: 3px solid var(--color-brand-400); outline-offset: 2px; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--ui-border); border-left: 1px solid var(--ui-border); }
.weekday { padding: 10px 4px; color: var(--ui-text-muted); font-size: var(--text-caption); font-weight: 800; letter-spacing: .06em; text-align: center; text-transform: uppercase; }
.day-cell { position: relative; display: flex; min-width: 0; min-height: clamp(74px, 10vw, 116px); flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 12px 4px 7px; border: 0; border-right: 1px solid var(--ui-border); border-bottom: 1px solid var(--ui-border); color: var(--ui-text); background: var(--ui-bg-elevated); cursor: pointer; transition: background-color .15s ease, box-shadow .15s ease; }
.day-cell > :not(.day-artwork-cover) { z-index: 1; }
.day-artwork-cover { position: absolute; inset: 0; overflow: hidden; opacity: .38; pointer-events: none; }
.day-artwork-cover img { width: 100%; height: 100%; object-fit: cover; }
.day-cell.has-listens .day-number, .day-cell.has-listens .song-count { color: #fff; background: rgba(23, 27, 39, .72); }
.day-cell.has-listens .day-number { border-radius: 999px; }
.day-cell.has-listens .song-count { padding: 2px 6px; border-radius: 999px; }
.day-cell:hover:not(:disabled) { background: var(--ui-bg-accented); }
.day-cell.is-empty { background: color-mix(in srgb, var(--ui-bg-accented), transparent 35%); cursor: default; }
.day-cell.is-selected { z-index: 1; box-shadow: inset 0 0 0 2px #cd6651; }
.day-cell.is-today .day-number { color: var(--calendar-accent); background: var(--calendar-accent-soft); }
.day-number { position: absolute; top: 6px; left: 7px; display: grid; width: 23px; height: 23px; place-items: center; border-radius: 50%; color: var(--ui-text-muted); font-size: var(--text-caption); font-weight: 700; }
.calendar-face, .detail-mood-face, .listening-mood-icon { display: grid; flex: none; place-items: center; border: 1px solid color-mix(in srgb, var(--mood-color), transparent 68%); border-radius: 50%; color: var(--mood-color); background: color-mix(in srgb, var(--mood-color) 16%, var(--ui-bg-elevated)); }
.calendar-face { width: 46px; height: 46px; box-shadow: 0 2px 5px color-mix(in srgb, var(--mood-color), transparent 88%); }
.detail-mood-face { width: 40px; height: 40px; }
.listening-mood-icon { width: 42px; height: 42px; }
.calendar-face-svg, .detail-face-svg, .listening-face-svg { width: 82%; height: 82%; }
.calendar-page :deep(.mood-face) { stroke-width: 2.2; }
.mood-color--happy { --mood-color: #f2c335; }
.mood-color--sad { --mood-color: #4389d1; }
.mood-color--relaxed { --mood-color: #998ba1; }
.mood-color--anxious { --mood-color: #ed8a35; }
.mood-color--angry { --mood-color: #d94a45; }
.mood-color--excited { --mood-color: #d96f9f; }
.mood-color--tired { --mood-color: #7e8ca6; }
.mood-color--lonely { --mood-color: #4f8f95; }
.listening-mood-dot { position: absolute; top: 8px; right: 8px; color: var(--calendar-accent); font-family: var(--font-sans); font-size: var(--text-caption); font-weight: 800; }
.song-count { color: var(--calendar-accent); font-size: var(--text-caption); font-weight: 800; }
.empty-day { width: 5px; height: 5px; border-radius: 50%; background: transparent; }
.calendar-hint { margin: 12px 0 0; color: var(--ui-text-muted); font-size: var(--text-caption); }
.calendar-message { padding: 52px 20px; color: var(--ui-text-muted); text-align: center; }
.calendar-skeleton { opacity: .55; cursor: progress; }
.calendar-skeleton .skeleton-cell { cursor: progress; animation: skeleton-pulse 1.4s ease-in-out infinite; }
.skeleton-bar { display: block; border-radius: 999px; background: var(--ui-bg-accented); animation: skeleton-pulse 1.4s ease-in-out infinite; }
.skeleton-month { width: 230px; height: 2rem; }
@keyframes skeleton-pulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .calendar-skeleton .skeleton-cell, .skeleton-bar { animation: none; } }
.error-message { color: #a53e36; }
.day-detail { width: 100%; margin: 28px 0 0; padding: 22px; border: 1px solid var(--ui-border); border-radius: 18px; background: var(--ui-bg-elevated); box-shadow: 0 12px 32px #211a2112; }
.detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.detail-header h3 { margin: 0; font-size: var(--text-subheader); font-weight: 600; }
.close-detail { width: 34px; height: 34px; border: 0; border-radius: 50%; color: var(--ui-text-muted); background: var(--ui-bg-accented); font-size: var(--text-subheader); cursor: pointer; }
.day-detail-grid { display: grid; grid-template-columns: minmax(150px, .55fr) minmax(0, 1.45fr); gap: 20px; }
.day-detail-column { min-width: 0; padding: 16px; border: 1px solid var(--ui-border); border-radius: 14px; background: color-mix(in srgb, var(--ui-bg), var(--ui-bg-elevated) 55%); }
.column-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; font-size: var(--text-subheader); font-weight: 600; }
.column-title span { color: var(--ui-text-muted); font-size: var(--text-caption); }
.listening-mood-summary { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px; border: 1px solid var(--ui-border); border-radius: 11px; background: var(--ui-bg-elevated); }
.listening-mood-copy { display: grid; gap: 2px; }
.listening-mood-copy small { color: var(--ui-text-muted); font-family: var(--font-sans); font-size: var(--text-caption); }
.listening-mood-copy strong { font-family: var(--font-sans); font-size: var(--text-label); }
.analyzed-count { margin-left: auto; color: var(--ui-text-muted); font-family: var(--font-sans); font-size: var(--text-caption); text-align: right; }
.analysis-note { margin: 0 0 12px; color: var(--ui-text-muted); font-family: var(--font-sans); font-size: var(--text-caption); }
.mood-logs { display: grid; gap: 10px; }
.mood-entry { display: flex; gap: 12px; padding: 12px; border-radius: 12px; background: var(--ui-bg-accented); }
.mood-entry-link { display: block; border-radius: 12px; color: inherit; text-decoration: none; }
.mood-entry-link:focus-visible { outline: 2px solid var(--calendar-accent); outline-offset: 3px; }
.mood-entry-link:hover .mood-entry { background: var(--ui-bg-elevated); }
.mood-entry > div { min-width: 0; overflow-wrap: anywhere; }
.mood-entry p { margin: 5px 0; color: var(--ui-text-muted); font-family: var(--font-serif); font-size: var(--text-body); }
.mood-entry .no-journal { font-style: italic; }
.mood-entry time { color: var(--ui-text-muted); font-size: var(--text-caption); }
.track-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 10px; margin-top: 20px; }
.track-list.is-carousel { display: flex; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: thin; padding-bottom: 6px; }
.track-list.is-carousel .track-card { flex: 0 0 calc((100% - 30px) / 4); scroll-snap-align: start; }
.track-list h4 { grid-column: 1 / -1; }
.history-toggle { margin-top: 14px; padding: 7px 13px; border: 1px solid var(--ui-border); border-radius: 999px; background: transparent; color: var(--calendar-accent); font-weight: 700; cursor: pointer; }
.track-card { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 9px; padding: 10px; border: 1px solid var(--ui-border); border-radius: 13px; color: inherit; background: var(--ui-bg-elevated); text-decoration: none; transition: background-color .15s ease, border-color .15s ease, transform .15s ease; }
.track-card:hover { transform: translateY(-1px); border-color: var(--color-brand-300); background: var(--ui-bg-accented); }
.track-link { display: flex; width: 100%; min-width: 0; flex-direction: column; align-items: flex-start; gap: 9px; border-radius: 9px; color: inherit; text-decoration: none; }
.track-link:focus-visible { outline: 3px solid var(--color-brand-400); outline-offset: 2px; }
/* Song titles open the song's mood page. */
.title-link { display: block; min-width: 0; border-radius: 4px; color: inherit; text-decoration: none; }
.recommendation-title { display: block; min-width: 0; border-radius: 4px; color: inherit; text-decoration: none; }
.recommendation-title:hover strong { text-decoration: underline; text-underline-offset: 3px; }
.title-link strong { display: block; }
.title-link:hover strong { text-decoration: underline; text-underline-offset: 3px; }
.title-link:focus-visible, .recommendation-title:focus-visible, .art-link:focus-visible, .recommendation-open:focus-visible { outline: 3px solid var(--color-brand-400); outline-offset: 2px; }
.art-link { display: block; flex: 0 0 auto; line-height: 0; }
.track-card img, .track-card .track-art { width: 100%; aspect-ratio: 1; flex: 0 0 auto; border-radius: 9px; object-fit: cover; }
.track-art { display: grid; place-items: center; color: #fff; background: #81747c; font-size: var(--text-subheader); }
.track-copy { display: grid; min-width: 0; gap: 3px; }
.track-card .track-copy { width: 100%; }
.track-copy strong, .track-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-copy strong { font-size: var(--text-label); }
.track-copy small { color: var(--ui-text-muted); font-size: var(--text-caption); }
.play-time { margin: auto 0 0; color: var(--ui-text-muted); font-size: var(--text-caption); white-space: nowrap; }
.empty-note { margin: 10px 0; color: var(--ui-text-muted); font-size: var(--text-label); }
.mood-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.mood-tags span { padding: 6px 13px; border-radius: 999px; color: var(--ui-text); background: var(--ui-bg-accented); font-size: var(--text-caption); font-weight: 700; }
@media (max-width: 768px) {
  .calendar-shell { display: block; margin-top: 18px; }
  .month-heading { justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  .month-heading h2 { min-width: 0; }
  .month-step { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid var(--ui-border); border-radius: 50%; color: var(--calendar-accent); background: var(--ui-bg-elevated); font-size: var(--text-subheader); line-height: 1; }
  .month-arrow { display: none; }
  .weekday { padding: 8px 1px; font-size: var(--text-caption); }
  .day-cell { min-height: clamp(57px, 14vw, 78px); padding: 11px 2px 4px; }
  .day-number { top: 3px; left: 3px; width: 19px; height: 19px; font-size: var(--text-caption); }
  .song-count { font-size: var(--text-caption); }
  .day-detail { padding: 17px; }
  .day-detail-grid { grid-template-columns: 1fr; gap: 12px; }
  .day-detail-column { padding: 13px; }
  .recommendation-panel { padding: 16px; }
  .recommendation-heading { display: block; }
  .recommendation-actions { margin-top: 10px; }
  .recommendation-mood { display: inline-flex; }
  .recommendation-list { grid-template-columns: 1fr; }
  .track-list.is-carousel .track-card { flex-basis: calc((100% - 10px) / 2); }
}
</style>
