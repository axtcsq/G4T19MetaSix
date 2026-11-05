<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ListeningChart from '@/components/dashboard/ListeningChart.vue'
import ListeningArtwork from '@/components/dashboard/ListeningArtwork.vue'
import SiteFooter from '@/components/layout/footer.vue'
import RecordLoader from '@/components/layout/RecordLoader.vue'
import MoodTag from '@/components/mood/MoodTag.vue'
import TodayStory from '@/components/dashboard/TodayStory.vue'
import MusicMoodsCard from '@/components/dashboard/MusicMoodsCard.vue'
import ArtistRecords from '@/components/dashboard/ArtistRecords.vue'
import TrackWaveform from '@/components/dashboard/TrackWaveform.vue'
import GenreMixChart from '@/components/dashboard/GenreMixChart.vue'
import { getMoodMusic, getGenreMix } from '@/api/quiz'
import { getDashboard } from '@/data/spotifyDashboard'
import { useSpotifyHistory } from '@/composables/useSpotifyHistory'
import { useAuthStore } from '@/stores/auth'
defineOptions({ name: 'ListeningDashboard' })

const periods = [
  { value: 'daily', label: 'Today', days: 1 },
  { value: 'weekly', label: 'Last 7 days', days: 7 },
  { value: 'monthly', label: 'Last 30 days', days: 30 },
]
const period = ref('weekly')
const spotify = useSpotifyHistory()
const { connected, source, history, historyLoading, historyError, error } = spotify
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
// Each top track's colour from the waveform, for its play bar in the list.
const songColors = ref({})
// The selected period's logged moods and music moods, for the mood insights.
const moodMusic = ref(null)
const moodMusicError = ref(false)
const genreMix = ref(null)
const genreError = ref(false)
onMounted(() => {
  spotify.initialize()
})

// Loads a card's data for the selected period, once the signed-in user is known, which can be
// after the page mounts. Each period is fetched once, so switching back to one is instant.
function loadForPeriod(fetchDays, result, failed) {
  const fetched = new Map()
  watch(
    () => [auth.user?.id, period.value],
    async ([id, selected], _, onCleanup) => {
      let active = true
      onCleanup(() => {
        active = false
      })
      failed.value = false
      const key = `${id}:${selected}`
      result.value = fetched.get(key) ?? null
      if (!id || result.value) return
      try {
        const data = await fetchDays(periods.find((option) => option.value === selected).days)
        fetched.set(key, data)
        if (active) result.value = data
      } catch {
        if (active) failed.value = true
      }
    },
    { immediate: true },
  )
}
loadForPeriod(getMoodMusic, moodMusic, moodMusicError)
loadForPeriod(getGenreMix, genreMix, genreError)

// Says what the server actually sent; a server without the filter always sends 30 days.
const genrePeriod = computed(() => {
  const days = genreMix.value
    ? (genreMix.value.days ?? 30)
    : periods.find((option) => option.value === period.value).days
  return days === 1 ? 'Today' : `Last ${days} days`
})
</script>

<template>
  <main class="dashboard" :class="{ 'motion-paused': motionPaused }">
    <div class="dashboard-inner">
      <div class="dashboard-top">
        <div>
          <h1 class="page-title">Your Music at a Glance</h1>
          <p class="dashboard-meta">
            <span class="period-date">{{ data.date }}</span
            ><span>{{ historyLabel }}</span>
          </p>
        </div>
        <div class="dashboard-toolbar" data-ui>
          <div class="period-control" role="group" aria-label="Listening period">
            <button
              v-for="option in periods"
              :key="option.value"
              type="button"
              class="glass-secondary"
              :aria-pressed="period === option.value"
              @click="period = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
      <TodayStory v-if="auth.user" />
      <p v-if="!connected" class="spotify-signin-note">
        Sign out and sign in with Spotify to see your listening history here.
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
      <RecordLoader v-if="historyLoading" label="Loading your listening history…" />
      <p v-else-if="historyError" role="alert">
        {{ historyError }}
        <button class="art-pause glass-secondary" @click="spotify.refreshHistory">
          Retry history
        </button>
      </p>
      <template v-if="connected && !historyLoading && !historyError">
        <p v-if="!data.plays">
          No recent plays in this period.
          <a href="https://open.spotify.com/" target="_blank" rel="noopener noreferrer"
            >Listen on Spotify</a
          >, then return to this page to see your history.
        </p>
        <section class="portrait-layout" aria-labelledby="garden-heading">
          <div class="portrait-art">
            <div class="art-heading">
              <h2 id="garden-heading">Your Listening Garden</h2>
              <button
                type="button"
                class="art-pause glass-secondary"
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
          </aside>
        </section>
        <!-- The moods the analysis heard, over the selected period. -->
        <section class="restored-charts mood-insights" aria-label="Mood insights">
          <p v-if="moodMusicError" class="unavailable-note">
            Your mood insights couldn’t load right now.
          </p>
          <template v-else-if="moodMusic">
            <article class="chart-panel">
              <MusicMoodsCard
                v-if="moodMusic.musicMoods"
                :data="moodMusic.musicMoods"
                :dates="moodMusic.days.map((day) => day.date)"
              />
              <p v-else class="unavailable-note">
                No analysed plays in this period yet. Your songs’ moods show here once MetaFor has
                listened to them, usually within a few minutes of a sync.
              </p>
            </article>
          </template>
          <article v-else class="chart-panel">
            <RecordLoader label="Reading your songs’ moods…" />
          </article>
        </section>
        <section class="music-section" aria-labelledby="music-heading">
          <div class="section-intro">
            <div>
              <h2 id="music-heading">Most Played in Returned History</h2>
            </div>
          </div>
          <div class="music-layout">
            <article class="artists-panel">
              <div class="panel-heading">
                <h3>Top Artists</h3>
              </div>
              <ArtistRecords :artists="data.artists" :period="period" :paused="motionPaused" />
            </article>
            <article class="songs-panel">
              <div class="panel-heading">
                <h3>Top Tracks</h3>
              </div>
              <TrackWaveform
                :songs="data.songs"
                :period="period"
                :paused="motionPaused"
                @colors="songColors = $event"
              />
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
                    <!-- Logged in, the title opens the song's mood page; the artwork opens Spotify. -->
                    <RouterLink v-if="auth.user" :to="`/song/${song.id}`"
                      >{{ song.title }}<span class="sr-only">, see its mood</span></RouterLink
                    ><a v-else :href="song.url" target="_blank" rel="noopener noreferrer"
                      >{{ song.title }}<span class="sr-only"> on Spotify (opens new tab)</span></a
                    ><span>{{ song.artist }}</span>
                    <div class="song-mood"><MoodTag :track-id="song.id" size="sm" /></div>
                  </div>
                  <strong class="play-count"
                    >{{ song[period]
                    }}<span>{{ song[period] === 1 ? 'play' : 'plays' }}</span></strong
                  >
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
          <article class="chart-panel genre-panel">
            <div class="panel-heading">
              <h3>Genre Mix</h3>
              <span class="genre-period">{{ genrePeriod }}</span>
            </div>
            <GenreMixChart v-if="genreMix" :data="genreMix" :paused="motionPaused" />
            <p v-else-if="genreError" class="unavailable-note" role="alert">
              Genre mix could not load. Reload to try again.
            </p>
            <RecordLoader v-else label="Loading genre mix…" />
          </article>
          <!-- A single day would be one lone bar, so Today leaves this chart out. It spans the full width so each day's column has room. -->
          <article v-if="period !== 'daily'" class="chart-panel days-panel">
            <div class="panel-heading"><h3>Recorded Plays by Day</h3></div>
            <ListeningChart
              :key="`days-${period}`"
              type="days"
              :data="data"
              :paused="motionPaused"
            />
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
.mood-insights {
  grid-template-columns: 1fr;
  gap: 40px;
}
.unavailable-note {
  color: var(--dash-muted);
  font: var(--text-body)/1.5 var(--font-serif);
  max-width: 48ch;
}
.dashboard-toolbar {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
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
  font: var(--text-body)/1.5 var(--font-serif);
}
/* The shared tokens switch for dark mode; only the accents need lightening. The garden draws its own sky. */
:global(.dark .dashboard) {
  --dash-accent: var(--color-brand-300);
  --dash-meter: var(--color-brand-400);
  --dash-meter-soft: #4a382f;
  --dash-strong: var(--color-brand-300);
}
.dashboard-inner {
  width: var(--page-width);
  padding: var(--page-top) 0 var(--page-bottom);
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
  flex-wrap: wrap;
  gap: 4px;
}
.period-control button {
  min-height: 44px;
  padding: 8px 17px;
  border-radius: 30px;
  cursor: pointer;
  color: var(--dash-muted);
  font-size: var(--text-label);
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
  flex-shrink: 0;
  cursor: pointer;
  font-size: var(--text-label);
  white-space: nowrap;
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
  font-size: var(--text-title);
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.sleeve-totals strong small {
  font-size: var(--text-label);
  font-weight: 400;
}
.sleeve-totals div > span {
  display: block;
  font-size: var(--text-label);
  color: var(--dash-muted);
  margin-top: 5px;
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
  font-size: var(--text-small);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.4;
}
.panel-heading > span {
  color: var(--dash-muted);
  font-size: var(--text-label);
}
.section-intro {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin: 36px 0 16px;
}
.spotify-link {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  color: var(--dash-ink);
  font-size: var(--text-label);
  white-space: nowrap;
  min-height: 44px;
  text-decoration: none;
}
.spotify-link img {
  object-fit: contain;
}
.music-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
}
/* The records stretch down to the bottom of the Top Tracks list beside them. */
.artists-panel {
  display: flex;
  flex-direction: column;
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
  font-size: var(--text-label);
  color: var(--dash-muted);
  font-variant-numeric: tabular-nums;
}
.song-list .rank {
  width: 20px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}
.song-detail a {
  display: block;
  color: var(--dash-ink);
  font-size: var(--text-small);
  font-weight: 500;
  text-decoration: none;
  width: fit-content;
}
.song-detail a:hover {
  text-decoration: underline;
  text-underline-offset: 5px;
}
/* Each song's plays in a pill tinted with its colour from the waveform. */
.song-list .play-count {
  display: grid;
  flex-shrink: 0;
  justify-items: center;
  color: var(--dash-ink);
  font: 600 24px/1 var(--font-serif);
  font-variant-numeric: tabular-nums;
}
.play-count span {
  margin-top: 3px;
  color: var(--dash-muted);
  font: 500 11px var(--font-sans);
  letter-spacing: 0.04em;
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
  font-size: var(--text-label);
  color: var(--dash-muted);
}
/* Plays against the top song, in the song's colour from the waveform. */
.song-detail > .play-bar {
  min-width: 8px;
  max-width: 100%;
  height: 6px;
  margin: 5px 0 6px;
  border-radius: 999px;
  background: var(--dash-meter);
  transform-origin: left;
  animation: play-bar-grow 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes play-bar-grow {
  from {
    transform: scaleX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .song-detail > .play-bar {
    animation: none;
  }
}
.song-mood {
  display: flex;
  margin-top: 4px;
}
.song-mood:empty {
  display: none;
}
.artwork-credit {
  font-size: var(--text-label);
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
  font-size: var(--text-label);
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
.days-panel {
  grid-column: 1 / -1;
}
.genre-panel {
  border-left: 1px solid var(--dash-rule);
  padding-left: clamp(24px, 3vw, 48px);
}
.day-chart-panel {
  grid-column: 1 / -1;
}
.night-icon {
  display: none;
}
/* The hour clock and the genre mix sit on spinning vinyl: grooves, a rim and
   a light that sweeps round. */
@property --vinyl-turn {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
.habits-layout :deep(:is(.hour-clock, .genre-disc)) {
  border-radius: 50%;
  background:
    conic-gradient(
      from var(--vinyl-turn),
      transparent 0 10%,
      color-mix(in srgb, var(--dash-ink) 9%, transparent) 16%,
      transparent 24% 60%,
      color-mix(in srgb, var(--dash-ink) 6%, transparent) 66%,
      transparent 74%
    ),
    repeating-radial-gradient(
      circle,
      color-mix(in srgb, var(--dash-ink) 5%, transparent) 0 1px,
      transparent 1px 5px
    ),
    color-mix(in srgb, var(--dash-ink) 4%, transparent);
  box-shadow:
    0 0 0 6px color-mix(in srgb, var(--dash-ink) 7%, transparent),
    0 0 0 7px var(--dash-rule),
    0 14px 30px rgb(0 0 0 / 20%);
  animation: vinyl-turn 6s linear infinite;
}
.motion-paused .habits-layout :deep(:is(.hour-clock, .genre-disc)) {
  animation-play-state: paused;
}
@keyframes vinyl-turn {
  to {
    --vinyl-turn: 360deg;
  }
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
  .mood-layout {
    grid-template-columns: 1fr;
    gap: 28px;
    margin-top: 30px;
  }
  .music-layout,
  .habits-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }
  .genre-panel {
    border-top: 1px solid var(--dash-rule);
    border-left: 0;
    padding-top: 28px;
    padding-left: 0;
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
.song-detail a {
  font-family: var(--font-serif);
  font-size: var(--text-body);
}
.song-detail > span {
  font-size: var(--text-lead);
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
    font-size: var(--text-header);
  }
  .portrait-notes {
    padding-top: 0;
  }
  .dashboard-toolbar {
    align-items: flex-start;
  }
}
</style>
