<script setup>
// Show a song's mood readings, audio features, and lyric analysis.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SiteFooter from '@/components/layout/footer.vue'
import RecordLoader from '@/components/layout/RecordLoader.vue'
import MoodTag from '@/components/mood/MoodTag.vue'
import { getTrack } from '@/api/tracks'
import { setPageTitle } from '@/utils/pageTitle'

defineOptions({ name: 'SongMood' })

const route = useRoute()
const router = useRouter()
const fromCalendar = computed(() => route.query.from === 'calendar')
const song = ref(null)
const loading = ref(true)
const error = ref('')

async function load(id) {
  loading.value = true
  error.value = ''
  song.value = null
  try {
    song.value = await getTrack(id)
    setPageTitle(song.value.name)
  } catch (failure) {
    error.value =
      failure.status === 404
        ? 'We haven’t analysed this song yet. Play it once and its mood will appear here.'
        : failure.message
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  (id) => id && load(id),
  { immediate: true },
)

const JOURNAL_MOOD = {
  sad: 'Sad',
  happy: 'Happy',
  relaxed: 'Relaxed',
  anxious: 'Anxious',
  angry: 'Angry',
}
const pct = (value) => Math.round(value * 100)

const artists = computed(() => song.value?.artists?.join(', ') ?? '')
// The reading the app counts: sound + lyrics when the lyrics were read.
const counted = computed(
  () => song.value?.withLyrics ?? song.value?.sound ?? song.value?.lyricsOnly ?? null,
)
const agree = computed(() => song.value?.withLyrics?.name === song.value?.sound?.name)
const blend = computed(() => song.value?.blend)
const lyrics = computed(() => song.value?.lyrics ?? null)
const instrumentalSong = computed(() => {
  const current = song.value
  return Boolean(
    current &&
    (current.instrumental ||
      current.lyricsStatus === 'instrumental' ||
      /\binstrumental\b|器樂|器乐|伴奏版/i.test(current.name || '')),
  )
})
// Only draw the sound-only dot when the lyrics moved the song noticeably.
const showSoundDot = computed(
  () => blend.value?.lyrics != null && Math.abs(blend.value.valence - blend.value.audio) >= 0.02,
)

const lastPlayed = computed(() =>
  song.value?.lastPlayedAt
    ? new Date(song.value.lastPlayedAt).toLocaleDateString('en-SG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null,
)
const playLine = computed(() => {
  const plays = song.value?.plays ?? 0
  if (!plays) return 'You haven’t played this yet.'
  const times = plays === 1 ? 'once' : `${plays} times`
  return `You’ve played this ${times}, most recently on ${lastPlayed.value}.`
})

// DeepL's language code ("ES") as a name ("Spanish").
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })
const translatedFrom = computed(() => {
  const code = lyrics.value?.translatedFrom
  return code ? (languageNames.of(code.toLowerCase()) ?? code) : null
})

// Why there's no sound + lyrics reading, or why it matches the sound one.
const lyricsWhy = computed(() => {
  const s = song.value
  if (!s) return ''
  if (s.lyricsOff)
    return 'Lyrics analysis is off in your profile, so this song’s mood comes from the sound only.'
  if (instrumentalSong.value)
    return 'This song is instrumental and contains no lyrics. Its mood comes from the sound alone.'
  if (s.lyricsStatus === 'not-found' || lyrics.value?.status === 'not-found')
    return 'No lyrics were found for this song, so its mood comes from the sound alone.'
  const note = s.tag?.lyricsNote
  if (note === 'pending')
    return 'The lyrics haven’t been read yet. They’re usually read within a few hours.'
  if (note === 'unavailable')
    return 'We couldn’t read this song’s lyrics after several tries, so the mood comes from the sound only.'
  if (note === 'instrumental')
    return 'This song is instrumental and contains no lyrics. Its mood comes from the sound alone.'
  if (lyrics.value?.status === 'untranslatable')
    return 'The lyrics aren’t in English and couldn’t be translated reliably, so the mood comes from the sound only.'
  if (blend.value?.lyrics == null)
    return 'The lyrics read as emotionally neutral, so they don’t change the mood.'
  if (blend.value.contrastLabel)
    return `${blend.value.contrastLabel}: the clash between them is the mood.`
  const moved = `The lyrics moved the song’s positivity from ${pct(blend.value.audio)} to ${pct(blend.value.valence)}`
  return agree.value ? `${moved}, which keeps the same mood.` : `${moved}, which changes the mood.`
})

function back() {
  if (fromCalendar.value) {
    router.push('/calendar')
    return
  }
  if (window.history.state?.back) router.back()
  else router.push('/dashboard')
}
</script>

<template>
  <div class="song-page">
    <main class="song-shell">
      <button type="button" class="back glass-text" @click="back">
        {{ fromCalendar ? '← Back to calendar' : '← Back' }}
      </button>

      <RecordLoader v-if="loading" label="Reading the song…" />
      <p v-else-if="error" class="status" role="alert">{{ error }}</p>

      <template v-else-if="song">
        <header class="song-header">
          <img v-if="song.album.imageUrl" :src="song.album.imageUrl" alt="" class="cover" />
          <span v-else class="cover cover-blank" aria-hidden="true">
            <svg viewBox="0 0 100 100" width="70%" fill="none" stroke="currentColor">
              <circle cx="50" cy="50" r="43" />
              <circle cx="50" cy="50" r="34" />
              <circle cx="50" cy="50" r="24" />
              <circle cx="50" cy="50" r="6" />
            </svg>
          </span>
          <div class="song-heading">
            <h1 class="page-title">{{ song.name }}</h1>
            <p class="artist">{{ artists }}</p>
            <p v-if="song.album.name" class="album">{{ song.album.name }}</p>
            <p class="plays">{{ playLine }}</p>
            <a
              class="glass-secondary spotify-green spotify"
              :href="song.spotifyUrl"
              target="_blank"
              rel="noopener noreferrer"
              >Open in Spotify<span class="sr-only"> (opens new tab)</span></a
            >
          </div>
        </header>

        <section
          v-if="counted"
          class="card summary"
          :class="`axis-${counted.axis}`"
          aria-labelledby="summary-title"
        >
          <h2 id="summary-title" class="sr-only">Mood</h2>
          <MoodTag
            :track-id="song.id"
            size="lg"
            :link="false"
            :hide-pending-lyrics="instrumentalSong"
          />
          <p class="summary-line">
            Counts as <strong>{{ JOURNAL_MOOD[counted.axis] }}</strong> in your mood history.
          </p>
          <p v-if="song.lyricsOnly" class="prose">
            Our audio data source doesn’t have this song, so this is a rough guess from the lyrics
            alone. Without how it sounds, we can’t tell upbeat from calm or loud from quiet.
          </p>
        </section>

        <section v-else class="card" aria-labelledby="none-title">
          <h2 id="none-title" class="sub-header">No mood for this song</h2>
          <p class="prose">
            <template v-if="song.tag?.noMood === 'no-data'">
              Our audio data source doesn’t have this song, which is common for new releases.
              Without how the song sounds, we can’t work out its mood.
            </template>
            <template v-else-if="song.tag?.analysing"
              >It’s still being analysed. Check back in a few minutes.</template
            >
            <template v-else>Something kept going wrong while analysing this song.</template>
          </p>
        </section>

        <template v-if="song.sound">
          <div class="panels">
            <section class="card" aria-labelledby="map-title">
              <h2 id="map-title" class="sub-header">Mood map</h2>
              <div class="map-grid">
              <div class="mood-labels" aria-hidden="true">
                <span>Tense</span><span>Happy</span>
              </div>
              <div class="axis-labels axis-labels-y" aria-hidden="true">
                <span>← Calm</span><span>Energy</span><span>Intense →</span>
              </div>
              <figure
                class="plane"
                role="img"
                :aria-label="`Mood map. Positivity ${pct(blend.valence)} out of 100, energy ${pct(song.energy)} out of 100. Left is negative, right is positive, bottom is calm, and top is intense. The usual mood is tense at the top left, happy at the top right, sad at the bottom left, and relaxed at the bottom right.`"
              >
                <!-- Positions, not verdicts: a loud sad song sits top-left but isn't tense. -->
                <span class="quadrant quadrant-negative-intense" />
                <span class="quadrant quadrant-positive-intense" />
                <span class="quadrant quadrant-negative-calm" />
                <span class="quadrant quadrant-positive-calm" />
                <span
                  v-if="showSoundDot"
                  class="dot dot-sound"
                  :style="{ left: `${blend.audio * 100}%`, bottom: `${song.energy * 100}%` }"
                />
                <span
                  v-if="blend.lyrics != null"
                  class="dot dot-words"
                  :style="{ left: `${blend.lyrics * 100}%`, bottom: `${song.energy * 100}%` }"
                />
                <span
                  class="dot dot-song"
                  :class="`axis-${counted.axis}`"
                  :style="{ left: `${blend.valence * 100}%`, bottom: `${song.energy * 100}%` }"
                />
              </figure>
              <div class="mood-labels" aria-hidden="true">
                <span>Sad</span><span>Relaxed</span>
              </div>
              <div class="axis-labels axis-labels-x" aria-hidden="true">
                <span>← Negative</span><span>Positivity</span><span>Positive →</span>
              </div>
              </div>
              <p v-if="blend.lyrics != null" class="caption legend">
                <span v-if="showSoundDot"><span class="key dot-sound" /> sound only</span>
                <span><span class="key dot-words" /> lyrics</span>
                <span><span class="key dot-song" :class="`axis-${counted.axis}`" /> this song</span>
              </p>
            </section>

            <section class="card" aria-labelledby="breakdown-title">
              <h2 id="breakdown-title" class="sub-header">How it sounds</h2>
              <ul class="bars">
                <li v-for="feature in song.features" :key="feature.key">
                  <div class="bar-head">
                    <span>{{ feature.label }}</span
                    ><span class="value">{{ pct(feature.value) }}</span>
                  </div>
                  <div
                    class="bar"
                    role="meter"
                    :aria-label="feature.label"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-valuenow="pct(feature.value)"
                  >
                    <span :style="{ width: `${feature.value * 100}%` }" />
                  </div>
                  <div class="bar-ends" aria-hidden="true">
                    <span>{{ feature.low }}</span
                    ><span>{{ feature.high }}</span>
                  </div>
                  <p class="caption">
                    {{ feature.about }} This song scores <strong>{{ feature.strength }}</strong
                    >.
                  </p>
                </li>
              </ul>
            </section>
          </div>

          <details class="analysis-details">
            <summary>Compare sound and lyrics</summary>
            <div class="readings">
              <section class="card reading" :class="`axis-${song.sound.axis}`">
                <p class="reading-label">Sound only</p>
                <h2 class="sub-header">{{ song.sound.name }}</h2>
                <p class="prose">{{ song.sound.blurb }}</p>
                <p class="basis">From the song’s positivity, energy and danceability.</p>
              </section>
              <section
                class="card reading"
                :class="song.withLyrics ? `axis-${song.withLyrics.axis}` : 'is-missing'"
              >
                <p class="reading-label">Sound + lyrics</p>
                <template v-if="song.withLyrics">
                  <h2 class="sub-header">{{ song.withLyrics.name }}</h2>
                  <p class="prose">{{ song.withLyrics.blurb }}</p>
                </template>
                <h2 v-else class="sub-header">Not available</h2>
                <p class="basis">{{ lyricsWhy }}</p>
              </section>
            </div>
            <p v-if="song.withLyrics" class="agreement">
              <template v-if="agree"
                >Both readings agree: the lyrics don’t change this song’s mood.</template
              >
              <template v-else>
                The readings differ: <strong>{{ song.sound.name }}</strong> from the sound alone,
                <strong>{{ song.withLyrics.name }}</strong> once the lyrics count.
              </template>
            </p>
          </details>
          <details class="analysis-details">
            <summary>What the lyrics add</summary>
            <section class="lyrics-body" aria-labelledby="lyrics-title">
              <h2 id="lyrics-title" class="sr-only">What the lyrics add</h2>
              <p v-if="!lyrics || blend.lyrics == null" class="prose">{{ lyricsWhy }}</p>
              <template v-else>
                <p v-if="blend.contrastLabel" class="contrast">{{ blend.contrastLabel }}</p>
                <p v-if="translatedFrom" class="caption">
                  Translated from {{ translatedFrom }} before reading.
                </p>
                <p v-if="lyrics.darkThemes.length" class="prose">
                  Dark themes in the words: <strong>{{ lyrics.darkThemes.join(', ') }}</strong
                  >.
                </p>
                <div class="bar-head">
                  <span>How positive the words are</span
                  ><span class="value">{{ pct(blend.lyrics) }}</span>
                </div>
                <div
                  class="bar"
                  role="meter"
                  aria-label="How positive the words are"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="pct(blend.lyrics)"
                >
                  <span :style="{ width: `${blend.lyrics * 100}%` }" />
                </div>
                <div class="bar-ends" aria-hidden="true">
                  <span>Negative</span><span>Positive</span>
                </div>
                <p class="prose">
                  <template v-if="lyrics.emotionalShare != null">
                    {{ pct(lyrics.emotionalShare) }}% of the lyrics carry a clear emotion.
                  </template>
                  The words count for <strong>{{ pct(blend.weight) }}%</strong> of the song’s
                  positivity: {{ pct(blend.audio) }} from the sound becomes
                  {{ pct(blend.valence) }} with the lyrics.
                </p>

                <ul
                  v-if="lyrics.emotions.length"
                  class="emotions"
                  aria-label="Strongest feelings in the lyrics"
                >
                  <li v-for="[emotion, share] in lyrics.emotions" :key="emotion">
                    <span class="emotion-name">{{ emotion }}</span>
                    <span class="emotion-bar" aria-hidden="true"
                      ><span :style="{ width: `${share * 100}%` }"
                    /></span>
                    <span class="value">{{ pct(share) }}%</span>
                  </li>
                </ul>

                <div class="quotes">
                  <div v-if="lyrics.highlights.positive.length">
                    <h3 class="quote-title">Most positive lines</h3>
                    <blockquote v-for="line in lyrics.highlights.positive" :key="line">
                      {{ line }}
                    </blockquote>
                  </div>
                  <div v-if="lyrics.highlights.negative.length">
                    <h3 class="quote-title">Most negative lines</h3>
                    <blockquote v-for="line in lyrics.highlights.negative" :key="line">
                      {{ line }}
                    </blockquote>
                  </div>
                </div>
              </template>
            </section>
          </details>
        </template>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.song-page {
  display: flex;
  min-height: calc(100vh - 77px);
  flex-direction: column;
  background: var(--ui-bg);
}
.song-shell {
  display: grid;
  width: min(1080px, var(--page-width));
  flex: 1;
  align-content: start;
  gap: 32px;
  margin-inline: auto;
  padding-block: var(--page-top) var(--page-bottom);
}
.back {
  justify-self: start;
}
.status {
  margin: 0;
  color: var(--ui-text-muted);
  font: var(--text-body) / 1.4 var(--font-serif);
}

/* Header: cover, title, who and how often */
.song-header {
  display: flex;
  align-items: center;
  gap: clamp(24px, 5vw, 64px);
}
.cover {
  width: clamp(180px, 26vw, 280px);
  height: auto;
  aspect-ratio: 1;
  flex-shrink: 0;
  border-radius: 2px;
  object-fit: cover;
}
.cover-blank {
  display: grid;
  place-items: center;
  color: #fff;
  background: #81747c;
  font-size: 2.5rem;
}
.song-heading {
  min-width: 0;
}
.song-heading .page-title {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.12;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.artist,
.album,
.plays {
  margin: 6px 0 0;
  font-family: var(--font-serif);
}
.artist {
  font-size: var(--text-body);
}
.album,
.plays {
  color: var(--ui-text-muted);
  font-size: var(--text-small);
}
.spotify {
  margin-top: 14px;
}

/* Cards */
.card {
  min-width: 0;
}
.card .sub-header {
  margin: 0 0 8px;
}
.prose {
  margin: 8px 0 0;
  font: var(--text-lead) / 1.45 var(--font-serif);
}
.caption,
.basis {
  margin: 8px 0 0;
  color: var(--ui-text-muted);
  font: var(--text-label) / 1.4 var(--font-sans);
}
.reading-label {
  margin: 0 0 16px;
  color: var(--ui-text-muted);
  font: 500 var(--text-small) / 1.4 var(--font-sans);
}
.value {
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums;
}

/* The counted mood, and each reading, wear their journal mood's colour. */
.axis-sad {
  --mood: var(--color-mood-sad-500);
}
.axis-happy {
  --mood: var(--color-mood-happy-500);
}
.axis-relaxed {
  --mood: var(--color-mood-relaxed-500);
}
.axis-anxious {
  --mood: var(--color-mood-anxious-500);
}
.axis-angry {
  --mood: var(--color-mood-angry-500);
}
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 24px 28px;
  background: var(--ui-bg-elevated);
}
.summary-line {
  margin: 0;
  font: var(--text-lead) / 1.4 var(--font-serif);
}
.readings,
.panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(28px, 5vw, 64px);
}
.reading {
  padding-block: 24px;
}
.reading.is-missing .sub-header {
  color: var(--ui-text-muted);
}
.agreement {
  margin: -4px 0 0;
  color: var(--ui-text-muted);
  font: var(--text-small) / 1.4 var(--font-serif);
}
.agreement strong {
  color: var(--ui-text);
}

/* Mood map: positivity across, energy up */
.map-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px;
  margin-top: 12px;
}
.plane {
  position: relative;
  display: grid;
  grid-template: 1fr 1fr / 1fr 1fr;
  aspect-ratio: 1;
  margin: 0;
  overflow: hidden;
  border-radius: 2px;
}
.quadrant {
  min-width: 0;
  min-height: 0;
}
.quadrant-negative-intense {
  background: color-mix(in srgb, var(--color-mood-angry-500) 24%, var(--ui-bg-elevated));
}
.quadrant-positive-intense {
  background: color-mix(in srgb, var(--color-mood-happy-500) 24%, var(--ui-bg-elevated));
}
.quadrant-negative-calm {
  background: color-mix(in srgb, var(--color-mood-sad-500) 24%, var(--ui-bg-elevated));
}
.quadrant-positive-calm {
  background: color-mix(in srgb, var(--color-mood-relaxed-500) 24%, var(--ui-bg-elevated));
}
/* Sit outside the map, centred over or under their half, so dots can't cover them. */
.mood-labels {
  display: grid;
  grid-column: 2;
  grid-template-columns: 1fr 1fr;
  color: var(--ui-text);
  font: 600 var(--text-caption) / 1.2 var(--font-sans);
  text-align: center;
}
.dot {
  position: absolute;
  z-index: 1;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  transform: translate(-50%, 50%);
}
.dot-song {
  border: 3px solid var(--ui-bg-elevated);
  background: var(--mood);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-text) 28%, transparent);
}
.dot-words {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-lavender);
  background: color-mix(in srgb, var(--color-lavender) 24%, var(--ui-bg-elevated));
}
.dot-sound {
  width: 12px;
  height: 12px;
  border: 2px dashed var(--ui-text-muted);
  background: var(--ui-bg-elevated);
}
.axis-labels {
  display: flex;
  justify-content: space-between;
  color: var(--ui-text-muted);
  font: var(--text-caption) / 1.2 var(--font-sans);
}
/* Reads bottom to top, so Calm sits at the bottom and Intense at the top. */
.axis-labels-y {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
.axis-labels-x {
  grid-column: 2;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}
.legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.key {
  position: static;
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transform: none;
}
.key.dot-song {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

/* Feature and lyric bars */
.bars {
  display: grid;
  gap: 18px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.bar-head {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  font: 600 var(--text-label) / 1.3 var(--font-sans);
}
.bars .bar-head {
  margin-top: 0;
}
.bar {
  height: 8px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-bg-accented);
}
.bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-primary);
}
.bar-ends {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  color: var(--ui-text-muted);
  font: var(--text-caption) / 1.2 var(--font-sans);
}

/* Lyrics */
.contrast {
  display: inline-block;
  margin: 0 0 4px;
  padding: 4px 12px;
  border-radius: 999px;
  color: var(--color-mood-anxious-800);
  background: color-mix(in srgb, var(--color-mood-anxious-500) 16%, transparent);
  font: 700 var(--text-caption) / 1.4 var(--font-sans);
}
.emotions {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
.emotions li {
  display: grid;
  grid-template-columns: 90px 1fr 44px;
  align-items: center;
  gap: 12px;
  font: var(--text-label) / 1.3 var(--font-sans);
}
.emotion-name {
  text-transform: capitalize;
}
.emotion-bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-bg-accented);
}
.emotion-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-lavender);
}
.emotions .value {
  text-align: right;
}
.quotes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 16px;
  margin-top: 16px;
}
.quote-title {
  margin: 0 0 8px;
  font: 600 var(--text-label) / 1.3 var(--font-sans);
}
blockquote {
  margin: 0 0 10px;
  padding-left: 12px;
  font: italic var(--text-lead) / 1.4 var(--font-serif);
}

.panels {
  align-items: start;
  padding-block: 8px 16px;
}
.bars {
  gap: 28px;
  margin-top: 28px;
}
.analysis-details {
  min-width: 0;
  padding: 24px 28px;
  background: var(--ui-bg-elevated);
}
.analysis-details > summary {
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  list-style: none;
  font: 600 var(--text-body) / 1.4 var(--font-sans);
  transition: color 180ms ease;
}
.analysis-details > summary::-webkit-details-marker {
  display: none;
}
.analysis-details > summary::after {
  content: '+';
  margin-left: auto;
  font-size: var(--text-subheader);
}
.analysis-details[open] > summary::after {
  content: '\2212';
}
.analysis-details > summary:hover {
  color: var(--ui-primary);
}
.analysis-details > summary:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 8px;
}
.lyrics-body {
  padding-top: 28px;
}
.analysis-details[open] > :not(summary) {
  animation: notes-in 240ms ease-out;
}
@keyframes notes-in {
  from {
    opacity: 0.5;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .analysis-details > summary {
    transition: none;
  }
  .analysis-details[open] > :not(summary) {
    animation: none;
  }
}
@media (max-width: 768px) {
  .readings,
  .panels {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .song-header {
    flex-direction: column;
  }
  .cover {
    width: min(64vw, 240px);
    height: auto;
  }
  .summary {
    padding: 16px;
  }
}
</style>
