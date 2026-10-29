<script setup>
import { computed, ref, watch } from 'vue'
import { getSongAnalysis, searchSongs } from '@/api/songs'

const query = ref('')
// Songs that match what has been typed so far.
const suggestions = ref([])
// The song picked from the suggestions, waiting for "Analyse".
const chosen = ref(null)
// The analysed song on show: the chosen song plus its analysis.
const selected = ref(null)
const isAnalysing = ref(false)
const searchError = ref('')

// The breakdown bars, in the same order and words as the song page.
const FEATURES = [
  {
    key: 'valence',
    label: 'Valence (sound)',
    low: 'Sad',
    high: 'Happy',
    about: 'How musically positive the track sounds.',
  },
  {
    key: 'energy',
    label: 'Energy',
    low: 'Calm',
    high: 'Intense',
    about: 'Perceived intensity: loudness, speed and noise.',
  },
  {
    key: 'danceability',
    label: 'Danceability',
    low: 'Hard to dance to',
    high: 'Very danceable',
    about: 'How suitable the rhythm is for dancing: tempo, beat strength and regularity.',
  },
]

function strength(value) {
  if (value >= 0.75) return 'high'
  if (value >= 0.5) return 'fairly high'
  if (value >= 0.25) return 'fairly low'
  return 'low'
}

// 0.965 -> 97
const percent = (value) => Math.round(value * 100)

// The three strongest emotions in the lyrics, leaving out "neutral".
const topEmotions = computed(() => {
  const emotions = selected.value?.lyrics?.emotions ?? {}
  return Object.entries(emotions)
    .filter(([name]) => name !== 'neutral')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value }))
})

// Where each reading sits on the mood map: valence left to right, energy bottom to top.
const mapPoints = computed(() => {
  const song = selected.value
  if (!song) return []
  const points = [
    { kind: 'sound', label: 'sound', valence: song.valence.sound },
    { kind: 'combined', label: 'combined', valence: song.valence.combined },
  ]
  if (song.valence.lyrics != null) {
    points.splice(1, 0, { kind: 'lyrics', label: 'lyrics', valence: song.valence.lyrics })
  }
  return points.map((point) => ({
    ...point,
    left: `${percent(point.valence)}%`,
    bottom: `${percent(song.features.energy)}%`,
  }))
})

// Songs we already have lyrics for, so their analysis shows everything.
const EXAMPLE_SONGS = [
  { id: '2PpruBYCo4H7WOBJ7Q2EwM', name: 'Hey Ya!', artists: ['Outkast'] },
  { id: '5wANPM4fQCJwkGd4rN57mH', name: 'drivers license', artists: ['Olivia Rodrigo'] },
  { id: '39LLxExYz6ewLAcYrzQQyP', name: 'Levitating', artists: ['Dua Lipa'] },
  { id: '70LcF31zb1H0PyJoS1Sx1r', name: 'Creep', artists: ['Radiohead'] },
]

const songLabel = (song) => `${song.name} · ${song.artists.join(', ')}`

// Looks the words up 300 ms after the visitor stops typing, so every key press
// doesn't send a request.
let searchTimer
let latestSearch = 0

watch(query, (text) => {
  window.clearTimeout(searchTimer)
  // Typing again after picking a song starts a new search.
  if (chosen.value && text === songLabel(chosen.value)) return
  chosen.value = null
  // Clearing the box clears the analysis too, and ignores any search still on its way.
  if (!text.trim()) {
    selected.value = null
    searchError.value = ''
    latestSearch += 1
  }
  if (text.trim().length < 2) {
    suggestions.value = []
    return
  }
  searchTimer = window.setTimeout(() => findSuggestions(text.trim()), 300)
})

async function findSuggestions(text) {
  // Only the newest search may fill the list, in case an older one answers late.
  const search = ++latestSearch
  try {
    const songs = await searchSongs(text)
    if (search === latestSearch) {
      suggestions.value = songs
      searchError.value = ''
    }
  } catch (error) {
    if (search === latestSearch) searchError.value = error.message
  }
}

function chooseSong(song) {
  chosen.value = song
  query.value = songLabel(song)
  suggestions.value = []
}

// An example skips the typing: pick it and analyse it straight away.
function tryExample(song) {
  chooseSong(song)
  analyse()
}

async function analyse() {
  if (!chosen.value) return

  isAnalysing.value = true
  searchError.value = ''
  try {
    const analysis = await getSongAnalysis(chosen.value.id)
    selected.value = { ...chosen.value, ...analysis }
  } catch (error) {
    searchError.value = error.message
  } finally {
    isAnalysing.value = false
  }
}
</script>

<template>
  <div class="song-search">
    <form class="search-form" role="search" @submit.prevent="analyse">
      <div class="search-box">
        <UInput
          v-model="query"
          class="search-input"
          size="xl"
          placeholder="Type a song or artist, then pick one"
          aria-label="Song or artist"
          autocomplete="off"
        />
        <!-- The songs that match, shown under the box while typing. -->
        <ul v-if="suggestions.length" class="suggestions" aria-label="Matching songs">
          <li v-for="song in suggestions" :key="song.id">
            <button type="button" class="suggestion" @click="chooseSong(song)">
              <img
                v-if="song.album?.imageUrl"
                class="suggestion-cover"
                :src="song.album.imageUrl"
                alt=""
              />
              <span>
                <strong>{{ song.name }}</strong>
                <span class="suggestion-artist">{{ song.artists.join(', ') }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
      <UButton
        class="glass-action justify-center rounded-full font-sans"
        type="submit"
        size="lg"
        :loading="isAnalysing"
        :disabled="!chosen"
      >
        Analyse
      </UButton>
    </form>

    <p v-if="!suggestions.length" class="examples">
      <span>Try:</span>
      <button
        v-for="song in EXAMPLE_SONGS"
        :key="song.id"
        type="button"
        class="example"
        @click="tryExample(song)"
      >
        {{ song.name }}
      </button>
    </p>

    <UAlert
      v-if="searchError"
      class="mt-4"
      color="error"
      variant="subtle"
      :description="searchError"
      role="alert"
    />

    <div v-if="selected" class="analysis">
      <header class="song-header">
        <img
          v-if="selected.album?.imageUrl"
          class="song-cover"
          :src="selected.album.imageUrl"
          :alt="`${selected.album.name} cover`"
        />
        <div>
          <h3 class="song-title">{{ selected.name }}</h3>
          <p class="song-artist">{{ selected.artists.join(', ') }}</p>
          <p v-if="selected.album?.name" class="song-album">{{ selected.album.name }}</p>
        </div>
      </header>

      <div class="song-feeling">
        <span class="song-feeling-label">This song feels</span>
        <strong>{{ selected.mood.name }}</strong>
        <span>{{ selected.mood.blurb }}</span>
      </div>

      <div class="analysis-grid">
        <section class="analysis-card" aria-labelledby="mood-map-title">
          <h4 id="mood-map-title" class="card-title">Mood map</h4>
          <div class="mood-map" role="img" :aria-label="`Mood map: ${selected.mood.name}`">
            <span class="corner top-left">Negative, intense</span>
            <span class="corner top-right">Positive, intense</span>
            <span class="corner bottom-left">Negative, calm</span>
            <span class="corner bottom-right">Positive, calm</span>
            <span
              v-for="point in mapPoints"
              :key="point.kind"
              class="map-point"
              :class="point.kind"
              :style="{ left: point.left, bottom: point.bottom }"
            />
          </div>
          <p class="map-axis"><span>← Negative</span><span>Valence</span><span>Positive →</span></p>
          <p class="card-note">Vertical axis: energy, calm at the bottom to intense at the top.</p>
          <p class="map-legend">
            <span v-for="point in mapPoints" :key="point.kind">
              <span class="map-point" :class="point.kind" /> {{ point.label }}
            </span>
          </p>
        </section>

        <section class="analysis-card" aria-labelledby="breakdown-title">
          <h4 id="breakdown-title" class="card-title">Breakdown</h4>
          <div v-for="feature in FEATURES" :key="feature.key" class="score">
            <p class="score-head">
              <span>{{ feature.label }}</span>
              <span>{{ percent(selected.features[feature.key]) }}</span>
            </p>
            <span class="score-bar">
              <span :style="{ width: `${percent(selected.features[feature.key])}%` }" />
            </span>
            <p class="score-ends">
              <span>{{ feature.low }}</span
              ><span>{{ feature.high }}</span>
            </p>
            <p class="card-note">
              {{ feature.about }} This track scores
              <strong>{{ strength(selected.features[feature.key]) }}</strong
              >.
            </p>
          </div>
        </section>
      </div>

      <section class="analysis-card" aria-labelledby="lyrics-title">
        <h4 id="lyrics-title" class="card-title">Lyrics</h4>

        <p v-if="!selected.lyrics" class="card-note">
          We haven't read the lyrics of this song yet, so its mood comes from the melody alone.
        </p>

        <template v-else>
          <div class="score">
            <p class="score-head">
              <span>Lyric sentiment</span>
              <span>{{ percent(selected.valence.lyrics) }}</span>
            </p>
            <span class="score-bar">
              <span :style="{ width: `${percent(selected.valence.lyrics)}%` }" />
            </span>
            <p class="score-ends"><span>Negative</span><span>Positive</span></p>
          </div>
          <p class="card-note">
            {{ percent(selected.lyrics.emotionalShare) }}% of the lyrics carry a clear emotion. The
            lyrics count for <strong>{{ percent(selected.lyrics.weight) }}%</strong> of the final
            valence ({{ percent(selected.valence.sound) }} from the sound →
            {{ percent(selected.valence.combined) }} combined).
          </p>

          <ul class="emotion-list">
            <li v-for="emotion in topEmotions" :key="emotion.name">
              <span>{{ emotion.name }}</span>
              <span class="score-bar">
                <span :style="{ width: `${percent(emotion.value)}%` }" />
              </span>
              <span>{{ percent(emotion.value) }}%</span>
            </li>
          </ul>

          <div class="passages">
            <div>
              <h5 class="passage-title">Most positive passages</h5>
              <blockquote v-for="line in selected.lyrics.highlights.positive" :key="line">
                {{ line }}
              </blockquote>
            </div>
            <div>
              <h5 class="passage-title">Most negative passages</h5>
              <blockquote v-for="line in selected.lyrics.highlights.negative" :key="line">
                {{ line }}
              </blockquote>
            </div>
          </div>
        </template>

        <p v-if="selected.lyrics" class="source-note">
          Lyrics from LRCLIB, read verse by verse with an emotion model
          (emotion-english-distilroberta-base).
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.song-search {
  font-family: var(--font-sans);
}
/* flex-start keeps the button its own height while the list below the box grows. */
.search-form {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.search-box {
  flex: 1;
}
.search-input {
  width: 100%;
}
/* In the page flow, not floating, so the page's overflow: hidden can't cut it off. */
.suggestions {
  margin: 6px 0 0;
  padding: 6px;
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 10px 24px rgba(125, 71, 55, 0.14);
  list-style: none;
}
.examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 12px 0 0;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}
.example {
  padding: 4px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 9999px;
  color: var(--ui-text);
  cursor: pointer;
}
.example:hover {
  background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
}
.suggestion {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  color: var(--ui-text);
  text-align: left;
  cursor: pointer;
}
.suggestion:hover,
.suggestion:focus-visible {
  background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
}
.suggestion-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}
.suggestion-artist {
  display: block;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}

.analysis {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 28px;
}
.song-header {
  display: flex;
  align-items: center;
  gap: 20px;
}
.song-cover {
  width: 96px;
  height: 96px;
  border-radius: 10px;
  object-fit: cover;
}
.song-title {
  margin: 0;
  font-size: var(--text-header);
}
.song-artist,
.song-album {
  margin: 4px 0 0;
  color: var(--ui-text-muted);
}
.song-feeling {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 24px;
  border-left: 4px solid var(--ui-primary);
  border-radius: 12px;
  color: var(--ui-text-muted);
  background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
}
.song-feeling-label {
  font-size: 0.8rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.song-feeling strong {
  color: var(--ui-primary);
  font-size: var(--text-title);
  line-height: 1.1;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.analysis-card {
  padding: 24px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg-elevated);
}
.card-title {
  margin: 0 0 16px;
  font-size: 1.1rem;
}
.card-note {
  margin: 6px 0 0;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Four corners: negative and intense, positive and intense, negative and
   calm, positive and calm. */
.mood-map {
  position: relative;
  aspect-ratio: 1;
  /* Room for the corner labels above and below the map. */
  margin-block: 22px;
  border-radius: 10px;
  background:
    linear-gradient(to right, rgba(206, 91, 75, 0.15) 50%, rgba(255, 210, 120, 0.2) 50%) top / 100%
      50% no-repeat,
    linear-gradient(to right, rgba(102, 120, 200, 0.15) 50%, rgba(110, 200, 140, 0.15) 50%) bottom /
      100% 50% no-repeat;
  font-size: 0.8rem;
  font-weight: 700;
}
/* The labels sit just outside the map, so the song's points never cover
   them, and each keeps to its own half. */
.corner {
  position: absolute;
  max-width: calc(50% - 6px);
  overflow: hidden;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.top-left {
  bottom: calc(100% + 4px);
  left: 0;
  color: #c45a4b;
}
.top-right {
  right: 0;
  bottom: calc(100% + 4px);
  color: #b8862b;
}
.bottom-left {
  top: calc(100% + 4px);
  left: 0;
  color: #5d72c4;
}
.bottom-right {
  top: calc(100% + 4px);
  right: 0;
  color: #3f9a62;
}
/* Sound is a dashed ring, lyrics a square, combined a filled dot. */
.map-point {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--ui-primary);
  border-radius: 50%;
  vertical-align: -2px;
}
.mood-map .map-point {
  position: absolute;
  transform: translate(-50%, 50%);
}
.map-point.sound {
  border-style: dashed;
}
.map-point.lyrics {
  border-radius: 2px;
}
.map-point.combined {
  background: var(--ui-primary);
}
.map-axis,
.score-ends {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 0 0;
  color: var(--ui-text-muted);
  font-size: 0.85rem;
}
.map-legend {
  display: flex;
  gap: 16px;
  margin: 10px 0 0;
  color: var(--ui-text-muted);
  font-size: 0.85rem;
}

.score + .score {
  margin-top: 20px;
}
.score-head {
  display: flex;
  justify-content: space-between;
  margin: 0 0 8px;
  font-weight: 700;
}
.score-bar {
  display: block;
  height: 10px;
  overflow: hidden;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--ui-text) 10%, transparent);
}
.score-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-primary);
}

.emotion-list {
  display: flex;
  max-width: 520px;
  flex-direction: column;
  gap: 10px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}
.emotion-list li {
  display: grid;
  grid-template-columns: 90px 1fr 40px;
  align-items: center;
  gap: 16px;
}
.passages {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-top: 24px;
}
.passage-title {
  margin: 0 0 8px;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}
.passages blockquote {
  margin: 0 0 10px;
  padding-left: 14px;
  border-left: 2px solid var(--ui-border);
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-style: italic;
}
.source-note {
  margin: 20px 0 0;
  color: var(--ui-text-muted);
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .search-form {
    flex-direction: column;
  }
  .analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
