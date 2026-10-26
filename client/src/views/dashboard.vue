<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ListeningChart from '@/components/dashboard/ListeningChart.vue'
import ListeningArtwork from '@/components/dashboard/ListeningArtwork.vue'
import SiteFooter from '@/components/layout/footer.vue'
import { getDashboard } from '@/data/spotifyDashboard'
import { useSpotifyHistory } from '@/composables/useSpotifyHistory'
import { useAuthStore } from '@/stores/auth'
import { getMoodInsights } from '@/api/listens'
defineOptions({ name: 'ListeningDashboard' })

const period = ref('weekly')
const spotify = useSpotifyHistory()
const { connected, source, busy, history, historyLoading, historyError, error } = spotify
const auth = useAuthStore()
const historyLabel = computed(() =>
  source.value !== 'stored'
    ? 'Spotify recent history'
    : auth.user?.isDemo
      ? 'Test account listening history'
      : 'Your listening history',
)
const data = computed(() => getDashboard(period.value, history.value))
const motionPaused = ref(false)
onMounted(() => {
  spotify.initialize()
})

// Mood Over Time and Emotion Profile, from the moods of the songs played.
// Only logged-in users have stored plays to read them from.
const MOOD_AXES = [
  { key: 'happy', label: 'Happy', color: '#e9a23b' },
  { key: 'relaxed', label: 'Relaxed', color: '#6fae8a' },
  { key: 'sad', label: 'Sad', color: '#6b83c4' },
  { key: 'anxious', label: 'Anxious', color: '#9a6fb0' },
  { key: 'angry', label: 'Angry', color: '#c8553d' },
]
const insights = ref(null)
const insightsError = ref('')

async function loadInsights() {
  const days = data.value.daily
  if (!auth.user || !days.length) return
  insightsError.value = ''
  try {
    insights.value = await getMoodInsights(days[0].date, days[days.length - 1].date)
  } catch (failure) {
    insightsError.value = failure.message
  }
}
// Reload when the period changes or new plays arrive.
watch([period, history], loadInsights)
onMounted(loadInsights)

// One stacked bar per day: each mood's share of that day's analysed plays,
// scaled against the busiest day.
const moodDays = computed(() => {
  const byDate = new Map((insights.value?.days ?? []).map((day) => [day.date, day]))
  const rows = data.value.daily.map(({ date, label }) => {
    const day = byDate.get(date)
    const parts = MOOD_AXES.map((axis) => ({ ...axis, value: day?.axes?.[axis.key] ?? 0 }))
    return { date, label, parts, total: parts.reduce((sum, part) => sum + part.value, 0) }
  })
  const busiest = Math.max(1, ...rows.map((row) => row.total))
  return rows.map((row) => ({
    ...row,
    parts: row.parts.map((part) => ({ ...part, height: (part.value / busiest) * 100 })),
  }))
})
const hasMoodDays = computed(() => moodDays.value.some((day) => day.total > 0))

// The overall listening mood for the period: the top music moods, how the
// plays lean, and what was played on the days each journal mood was logged.
const percentOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)
const moodSummary = computed(() => {
  const plays = insights.value?.analysedPlays ?? 0
  if (!plays) return null
  const moods = insights.value.musicMoods.map((mood) => ({
    ...mood,
    percent: percentOf(mood.count, plays),
  }))
  // Each play adds up to 1 across the five moods, so the shares add up too.
  const totals = Object.fromEntries(
    MOOD_AXES.map((axis) => [
      axis.key,
      insights.value.days.reduce((sum, day) => sum + (day.axes?.[axis.key] ?? 0), 0),
    ]),
  )
  const brighter = totals.happy + totals.relaxed
  return {
    plays,
    top: moods[0],
    others: moods.slice(1, 5),
    brighterPercent: percentOf(brighter, plays),
    heavierPercent: percentOf(plays - brighter, plays),
    journal: insights.value.journal.map((entry) => ({
      ...entry,
      percent: Math.round(entry.share * 100),
    })),
  }
})

// The lyric emotions, strongest first. "neutral" is left out: it says how much
// of the lyrics carry no emotion, not a feeling.
const emotionRows = computed(() => {
  const emotions = insights.value?.emotions
  if (!emotions) return []
  const rows = Object.entries(emotions)
    .filter(([name]) => name !== 'neutral')
    .sort((a, b) => b[1] - a[1])
  // The strongest emotion fills its bar; the rest are drawn against it.
  const strongest = rows[0]?.[1] || 1
  return rows.map(([name, value]) => ({
    name: name[0].toUpperCase() + name.slice(1),
    percent: Math.round(value * 100),
    width: (value / strongest) * 100,
  }))
})
</script>

<template>
  <main class="dashboard" :class="{ 'motion-paused': motionPaused }">
    <div class="dashboard-inner">
      <div class="dashboard-top">
        <div>
          <h1 class="page-title">Your Listening Portrait</h1>
          <p class="dashboard-meta">
            <span class="period-date">{{ data.date }}</span
            ><span>{{ historyLabel }}</span>
          </p>
        </div>
        <div class="dashboard-toolbar" data-ui>
          <div class="period-control" role="group" aria-label="Listening period">
            <button
              v-for="option in ['weekly', 'monthly']"
              :key="option"
              type="button"
              :aria-pressed="period === option"
              @click="period = option"
            >
              {{ option === 'weekly' ? 'Last 7 days' : 'This month' }}
            </button>
          </div>
          <div v-if="connected" class="history-actions">
            <button class="art-pause" :disabled="historyLoading" @click="spotify.refreshHistory">
              Refresh history
            </button>
          </div>
        </div>
      </div>
      <p v-if="!connected">
        Connect Spotify to see your listening portrait.
        <button class="art-pause" :disabled="busy" @click="spotify.connect">Connect Spotify</button>
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="historyLoading" role="status">Loading your listening history…</p>
      <p v-else-if="historyError" role="alert">
        {{ historyError }}
        <button class="art-pause" @click="spotify.refreshHistory">Retry history</button>
      </p>
      <template v-if="connected && !historyLoading && !historyError">
        <p v-if="!data.plays">
          No recent plays in this period.
          <a href="https://open.spotify.com/" target="_blank" rel="noopener noreferrer"
            >Listen on Spotify</a
          >, then refresh your history.
        </p>
        <section class="portrait-layout" aria-labelledby="garden-heading">
          <div class="portrait-art">
            <div class="art-heading">
              <h2 id="garden-heading">Your Listening Garden</h2>
              <button
                type="button"
                class="art-pause"
                :aria-pressed="motionPaused"
                @click="motionPaused = !motionPaused"
              >
                {{ motionPaused ? 'Animate' : 'Pause' }}
              </button>
            </div>
            <ListeningArtwork :data="data" :paused="motionPaused" />
          </div>
          <aside class="portrait-notes">
            <p class="mood-summary">Your recent listening, growing into a garden.</p>
            <div class="sleeve-totals">
              <div>
                <strong>{{ data.plays }}</strong
                ><span>plays in returned history</span>
              </div>
              <div>
                <strong>{{ data.tracks }}</strong
                ><span>different songs</span>
              </div>
              <div>
                <strong>{{ data.artistsCount }}</strong
                ><span>artists heard</span>
              </div>
            </div>
            <p v-if="data.peak" class="peak-note">
              Most recorded plays were around <strong>{{ data.peak }}</strong
              >.
            </p>
          </aside>
        </section>
        <section v-if="moodSummary" class="listening-mood" aria-labelledby="mood-summary-heading">
          <p class="summary-label">Your listening mood</p>
          <h2 id="mood-summary-heading" class="summary-title">
            Mostly <strong>{{ moodSummary.top.name }}</strong>
          </h2>
          <p class="summary-text">
            {{ moodSummary.top.percent }}% of the {{ moodSummary.plays }} analysed plays in this
            period.
            <template v-if="moodSummary.brighterPercent >= moodSummary.heavierPercent">
              Overall, {{ moodSummary.brighterPercent }}% of your listening leaned happy or relaxed.
            </template>
            <template v-else>
              Overall, {{ moodSummary.heavierPercent }}% of your listening leaned sad, anxious or
              angry.
            </template>
          </p>
          <ul v-if="moodSummary.others.length" class="summary-moods">
            <li v-for="mood in moodSummary.others" :key="mood.name">
              {{ mood.name }} <span>{{ mood.percent }}%</span>
            </li>
          </ul>
          <ul v-if="moodSummary.journal.length" class="summary-journal">
            <li v-for="entry in moodSummary.journal" :key="entry.mood">
              On days you logged <strong>{{ entry.mood }}</strong> ({{ entry.days }}
              {{ entry.days === 1 ? 'day' : 'days' }}), you mostly played
              <strong>{{ entry.musicMood }}</strong> songs ({{ entry.percent }}%).
            </li>
          </ul>
        </section>
        <section class="restored-charts" aria-label="Mood insights">
          <article class="chart-panel">
            <div class="panel-heading">
              <h3>Mood Over Time</h3>
              <span>{{ insights?.lens === 'sound' ? 'From the sound' : 'Sound and lyrics' }}</span>
            </div>
            <p v-if="insightsError" class="unavailable-note" role="alert">{{ insightsError }}</p>
            <p v-else-if="!auth.user || !hasMoodDays" class="unavailable-note">
              No analysed songs in this period yet. Songs get a mood shortly after they're played.
            </p>
            <template v-else>
              <div class="mood-columns" role="img" aria-label="Music mood for each day">
                <div
                  v-for="day in moodDays"
                  :key="day.date"
                  class="mood-column"
                  :title="`${day.label}: ${day.parts
                    .filter((part) => part.value)
                    .map((part) => `${part.label} ${Math.round(part.value)}`)
                    .join(', ')}`"
                >
                  <span
                    v-for="part in day.parts"
                    :key="part.key"
                    :style="{ height: `${part.height}%`, background: part.color }"
                  />
                </div>
              </div>
              <p class="mood-axis">
                <span>{{ moodDays[0].label }}</span
                ><span>{{ moodDays[moodDays.length - 1].label }}</span>
              </p>
              <p class="mood-legend">
                <span v-for="axis in MOOD_AXES" :key="axis.key">
                  <i :style="{ background: axis.color }" />{{ axis.label }}
                </span>
              </p>
            </template>
          </article>
          <article class="chart-panel">
            <div class="panel-heading">
              <h3>Emotion Profile</h3>
              <span>From the lyrics</span>
            </div>
            <p v-if="!emotionRows.length" class="unavailable-note">
              None of the songs played in this period have had their lyrics read yet.
            </p>
            <template v-else>
              <ul class="emotion-rows">
                <li v-for="emotion in emotionRows" :key="emotion.name">
                  <span>{{ emotion.name }}</span>
                  <span class="emotion-track"
                    ><span :style="{ width: `${emotion.width}%` }"
                  /></span>
                  <span>{{ emotion.percent }}%</span>
                </li>
              </ul>
              <p class="emotion-note">
                Based on {{ insights.lyricPlays }} of {{ insights.totalPlays }} plays whose lyrics
                were read.
              </p>
            </template>
          </article>
        </section>
        <section class="music-section" aria-labelledby="music-heading">
          <div class="section-intro">
            <div>
              <h2 id="music-heading">Most Played in Returned History</h2>
            </div>
            <a
              href="https://open.spotify.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="spotify-link"
              ><img src="@/assets/images/spotify-logo.png" alt="" width="18" height="18" />Open
              Spotify <span aria-hidden="true">↗</span></a
            >
          </div>
          <div class="music-layout">
            <article class="artists-panel">
              <div class="panel-heading">
                <h3>Top Artists</h3>
                <span>Recorded plays</span>
              </div>
              <ol class="artist-list">
                <li v-for="(artist, index) in data.artists" :key="artist.name">
                  <span class="rank">{{ index + 1 }}</span
                  ><img
                    v-if="artist.art"
                    :src="artist.art"
                    :alt="`${artist.album} album artwork`"
                    width="56"
                    height="56"
                    loading="lazy"
                  />
                  <div class="artist-detail">
                    <a :href="artist.url" target="_blank" rel="noopener noreferrer"
                      >{{ artist.name }}<span class="sr-only"> on Spotify (opens new tab)</span></a
                    >
                    <div class="artist-meter" aria-hidden="true">
                      <span
                        :style="{ width: `${(artist[period] / data.artists[0][period]) * 100}%` }"
                      />
                    </div>
                  </div>
                  <strong>{{ artist[period] }}</strong>
                </li>
              </ol>
            </article>
            <article class="songs-panel">
              <div class="panel-heading">
                <h3>Top Tracks</h3>
                <span>Plays</span>
              </div>
              <ol class="song-list">
                <li v-for="(song, index) in data.songs" :key="song.title">
                  <span class="rank">{{ index + 1 }}</span
                  ><a
                    class="song-art"
                    :href="song.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="`Find ${song.title} by ${song.artist} on Spotify (opens new tab)`"
                    ><img
                      v-if="song.art"
                      :src="song.art"
                      :alt="`${song.title} release artwork`"
                      width="48"
                      height="48"
                      loading="lazy"
                    /><span aria-hidden="true">↗</span></a
                  >
                  <div class="song-detail">
                    <a :href="song.url" target="_blank" rel="noopener noreferrer"
                      >{{ song.title }}<span class="sr-only"> on Spotify (opens new tab)</span></a
                    ><span>{{ song.artist }}</span>
                  </div>
                  <strong>{{ song[period] }}</strong>
                </li>
              </ol>
            </article>
          </div>
        </section>

        <section v-if="data.plays" class="habits-layout" aria-label="Listening habits">
          <article class="chart-panel hours-panel">
            <div class="panel-heading">
              <div>
                <h3>Recorded Plays by Hour</h3>
              </div>
              <svg
                class="night-icon"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </div>
            <ListeningChart :key="`hours-${period}`" type="hours" :data="data" />
          </article>
          <article class="chart-panel">
            <div class="panel-heading">
              <h3>Genre Mix</h3>
              <span>Unavailable</span>
            </div>
            <p class="unavailable-note">
              Genre labels are not included in your connected listening history, so there are no
              genre shares to display.
            </p>
          </article>
          <article class="chart-panel">
            <div class="panel-heading"><h3>Recorded Plays by Day</h3></div>
            <ListeningChart :key="`days-${period}`" type="days" :data="data" />
          </article>
          <article class="chart-panel">
            <div class="panel-heading"><h3>Repeat Listening</h3></div>
            <ListeningChart :key="`repeats-${period}`" type="repeats" :data="data" />
          </article>
        </section>
      </template>
    </div>
  </main>
  <SiteFooter />
</template>

<style scoped>
.restored-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  border-top: 1px solid var(--dash-rule);
  padding-top: 32px;
  margin-top: 40px;
}
.listening-mood {
  margin-top: 40px;
  padding: 28px 32px;
  border: 1px solid var(--dash-rule);
  border-radius: 16px;
  background: var(--dash-paper);
}
.summary-label {
  color: var(--dash-accent);
  font: 800 12px var(--font-sans);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.dashboard .summary-title {
  margin-top: 8px;
  font-family: var(--font-sans);
  font-size: var(--text-header);
  font-weight: 700;
}
.summary-title strong {
  color: var(--dash-accent);
}
.summary-text {
  margin-top: 8px;
  color: var(--dash-muted);
  font: 18px/1.5 var(--font-serif);
}
.summary-moods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding: 0;
  list-style: none;
}
.summary-moods li {
  padding: 4px 12px;
  border: 1px solid var(--dash-rule);
  border-radius: 9999px;
  font-size: 14px;
}
.summary-moods span {
  color: var(--dash-muted);
}
.summary-journal {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 20px;
  padding: 16px 0 0;
  border-top: 1px solid var(--dash-rule);
  color: var(--dash-muted);
  list-style: none;
  font: 17px/1.5 var(--font-serif);
}
.summary-journal strong {
  color: var(--dash-ink);
}
.mood-columns {
  display: flex;
  height: 160px;
  align-items: flex-end;
  gap: 3px;
}
/* One day: its moods stacked from the bottom. */
.mood-column {
  display: flex;
  height: 100%;
  flex: 1;
  flex-direction: column-reverse;
  border-radius: 3px;
  overflow: hidden;
}
.mood-axis,
.mood-legend,
.emotion-note {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--dash-muted);
  font-size: 13px;
}
/* The page caps paragraph width for reading; these lines run under a chart. */
.dashboard :is(.mood-axis, .mood-legend, .emotion-note) {
  max-width: none;
}
.mood-legend {
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 14px;
}
.mood-legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
}
.emotion-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  list-style: none;
}
.emotion-rows li {
  display: grid;
  grid-template-columns: 80px 1fr 40px;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}
.emotion-track {
  height: 8px;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--dash-hover);
}
.emotion-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--dash-meter);
}
.unavailable-note {
  color: var(--dash-muted);
  font: 20px/1.5 var(--font-serif);
  max-width: 48ch;
}
.history-actions {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
}
.dashboard-toolbar {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.history-actions .art-pause:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 768px) {
  .restored-charts {
    grid-template-columns: 1fr;
    gap: 28px;
  }
}
.dashboard {
  --dash-ground: var(--ui-bg);
  --dash-paper: var(--ui-bg-elevated);
  --dash-ink: var(--ui-text);
  --dash-muted: var(--ui-text-muted);
  --dash-accent: var(--color-brand-700);
  --dash-rule: var(--ui-border);
  --dash-hover: var(--ui-bg-accented);
  --dash-meter: var(--color-brand-400);
  --dash-meter-soft: var(--color-brand-200);
  /* Selected pills and highlighted bars: the Personality brown. */
  --dash-strong: #763e32;
  background: var(--dash-ground);
  color: var(--dash-ink);
  min-height: 100svh;
  font: 20px/1.5 var(--font-serif);
  padding-bottom: 90px;
}
/* The shared tokens switch for dark mode; only the accents need lightening.
   The garden draws its own sky. */
:global(.dark .dashboard) {
  --dash-accent: var(--color-brand-300);
  --dash-meter: var(--color-brand-400);
  --dash-meter-soft: #4a3a3f;
  --dash-strong: var(--color-brand-300);
}
.dashboard-inner {
  width: var(--page-width);
  padding: var(--page-top) 0 20px;
  margin: auto;
}
.dashboard :is(h1, h2, h3, p) {
  margin: 0;
}
.dashboard :is(h1, h2) {
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  text-wrap: balance;
}
.dashboard h2 {
  font-size: var(--text-header);
}
.dashboard h3 {
  font-size: var(--text-subheader);
  font-weight: 600;
  line-height: 1.3;
}
.dashboard p {
  max-width: 65ch;
}
.dashboard-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}
.dashboard-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  font-family: var(--font-serif);
  font-size: var(--text-body);
  color: var(--dash-muted);
  margin-top: 10px !important;
}
.period-control {
  display: flex;
  gap: 4px;
}
.period-control button {
  min-height: 44px;
  padding: 8px 17px;
  border-radius: 30px;
  cursor: pointer;
  color: var(--dash-muted);
  font-size: 13px;
}
.period-control button[aria-pressed='true'] {
  background: var(--dash-strong);
  color: var(--dash-paper);
}
.period-control button:hover {
  background: var(--dash-hover);
  color: var(--dash-ink);
}
.portrait-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr);
  gap: 48px;
  align-items: start;
}
.portrait-art {
  min-width: 0;
}
.art-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 12px;
}
.art-pause {
  cursor: pointer;
  font-size: 13px;
  min-height: 44px;
  text-decoration: underline;
  text-underline-offset: 5px;
  color: var(--dash-muted);
}
.portrait-notes {
  padding: 48px 0 0;
}
.mood-summary {
  font-family: var(--font-serif);
  font-size: var(--text-quote);
  font-style: italic;
  line-height: 1.4;
  max-width: 28ch !important;
}
.sleeve-totals {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 26px 20px;
  margin-top: 30px;
}
.sleeve-totals strong {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: clamp(44px, 4.5vw, 56px);
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.sleeve-totals strong small {
  font-size: 13px;
  font-weight: 400;
}
.sleeve-totals div > span {
  display: block;
  font-size: 13px;
  color: var(--dash-muted);
  margin-top: 5px;
}
.peak-note {
  margin-top: 24px !important;
  font-size: 16px;
  max-width: 24ch !important;
}
.peak-note strong {
  font-weight: 500;
}
.mood-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  margin-top: 36px;
}
.chart-panel {
  min-width: 0;
}
.panel-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}
.panel-heading :is(h2, h3) {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.4;
}
.panel-heading > span {
  color: var(--dash-muted);
  font-size: 13px;
}
.section-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin: 36px 0 16px;
}
.spotify-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dash-ink);
  font-size: 13px;
  white-space: nowrap;
  min-height: 44px;
  text-decoration: none;
}
.spotify-link img {
  object-fit: contain;
}
.music-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
}
.artist-list,
.song-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.artist-list li,
.song-list li {
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 70px;
}
.rank {
  flex-shrink: 0;
  width: 14px;
  font-size: 13px;
  color: var(--dash-muted);
  font-variant-numeric: tabular-nums;
}
.artist-list img {
  width: 44px;
  height: 44px;
  object-fit: cover;
}
.artist-detail {
  min-width: 0;
  flex: 1;
}
.artist-detail a,
.song-detail a {
  display: block;
  color: var(--dash-ink);
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  width: fit-content;
}
.artist-detail a:hover,
.song-detail a:hover {
  text-decoration: underline;
  text-underline-offset: 5px;
}
.artist-meter {
  height: 3px;
  width: 85%;
  background: var(--dash-hover);
  margin-top: 8px;
}
.artist-meter > span {
  display: block;
  height: 100%;
  background: var(--dash-meter);
  transition: width 0.3s;
}
.artist-list strong,
.song-list strong {
  font-size: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.artist-list small {
  display: block;
  font-size: 13px;
  text-align: right;
  color: var(--dash-muted);
  font-weight: 400;
}
.song-art {
  display: block;
  flex-shrink: 0;
  position: relative;
}
.song-art img {
  display: block;
  object-fit: cover;
  width: 44px;
  height: 44px;
}
.song-art > span {
  display: none;
}
.song-detail {
  flex: 1;
  min-width: 0;
}
.song-detail > span {
  display: block;
  font-size: 13px;
  color: var(--dash-muted);
}
.artwork-credit {
  font-size: 13px;
  color: var(--dash-muted);
  margin-top: 14px;
}
.artwork-credit summary {
  min-height: 40px;
  padding-block: 7px;
  cursor: pointer;
  width: fit-content;
}
.artwork-note {
  max-width: 65ch;
  font-size: 13px;
}
.artwork-note a {
  color: inherit;
  text-underline-offset: 4px;
}
.habits-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 48px;
  margin-top: 32px;
}
.night-icon {
  display: none;
}
.dashboard :is(button, a, summary, input):focus-visible {
  outline: 2px solid var(--dash-accent);
  outline-offset: 5px;
}
.dashboard button:active {
  transform: translateY(1px);
}
.dashboard a:hover,
.art-pause:hover {
  color: var(--dash-accent);
}
.dashboard ::selection {
  background: #d5a58b;
  color: #202b32;
}
@media (max-width: 1000px) {
  .portrait-layout {
    grid-template-columns: minmax(0, 1.4fr) minmax(230px, 1fr);
    gap: 30px;
  }
  .portrait-notes {
    padding-top: 62px;
  }
  .mood-layout,
  .music-layout,
  .habits-layout {
    gap: 30px;
  }
}
@media (max-width: 768px) {
  .dashboard-inner {
    width: calc(100% - 40px);
    padding: var(--page-top) 0 20px;
  }
  .dashboard-top {
    align-items: start;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }
  .dashboard-toolbar {
    width: 100%;
  }
  .portrait-layout {
    grid-template-columns: 1fr;
    gap: 22px;
  }
  .portrait-notes {
    padding: 0;
  }
  .mood-summary {
    max-width: 32ch !important;
  }
  .sleeve-totals {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-top: 18px;
  }
  .peak-note {
    margin-top: 18px !important;
    max-width: 35ch !important;
  }
  .mood-layout {
    grid-template-columns: 1fr;
    gap: 28px;
    margin-top: 30px;
  }
  .music-layout,
  .habits-layout {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .section-intro {
    margin-top: 28px;
  }
  .artist-list li,
  .song-list li {
    gap: 12px;
  }
}
@media (max-width: 400px) {
  .sleeve-totals {
    grid-template-columns: 1fr 1fr;
    gap: 18px 28px;
  }
  .art-heading {
    gap: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
.dashboard :is(button, summary, .panel-heading > span, .spotify-link, .rank) {
  font-family: var(--font-sans);
}
.dashboard .panel-heading :is(h2, h3) {
  font-size: var(--text-subheader);
}
.sleeve-totals {
  gap: 24px;
}
.sleeve-totals strong {
  font-family: var(--font-serif);
  flex-wrap: wrap;
  gap: 4px;
}
.sleeve-totals div > span {
  font-size: var(--text-body);
  line-height: 1.3;
}
.mood-summary strong {
  display: block;
  font: 700 var(--text-header)/1.2 var(--font-sans);
  font-style: normal;
  margin-bottom: 8px;
}
.portrait-notes .peak-note {
  font-size: 20px;
  max-width: 30ch !important;
}
.mood-layout,
.habits-layout,
.music-section {
  border-top: 1px solid var(--dash-rule);
  padding-top: 32px;
  margin-top: 40px;
}
.section-intro {
  margin-top: 0;
}
.artist-detail a,
.song-detail a {
  font-family: var(--font-serif);
  font-size: 21px;
}
.song-detail > span {
  font-size: 17px;
}
.period-control button[aria-pressed='true']:hover {
  background: var(--dash-strong);
  color: var(--dash-paper);
}
@media (min-width: 769px) {
  .mood-layout {
    grid-template-rows: repeat(6, auto);
    row-gap: 0;
  }
  .mood-layout .chart-panel {
    display: grid;
    grid-row: span 6;
    grid-template-rows: subgrid;
  }
  .mood-layout .panel-heading {
    grid-row: 1;
  }
  .mood-layout :deep(.listening-chart) {
    display: contents;
  }
  .mood-layout :deep(.chart-explanation) {
    grid-row: 2;
  }
  .mood-layout :deep(.day-picker) {
    grid-row: 3;
  }
  .mood-layout :deep(.flow-readout) {
    grid-row: 4;
  }
  .mood-layout :deep(.mood-bars) {
    grid-row: 5;
  }
  .mood-layout :deep(.chart-footnote) {
    grid-row: 6;
  }
}
@media (max-width: 768px) {
  .mood-summary strong {
    font-size: 30px;
  }
  .portrait-notes {
    padding-top: 0;
  }
  .dashboard-toolbar {
    align-items: flex-start;
  }
  .history-actions {
    justify-content: flex-start;
  }
}
</style>
