<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import VinylTurntable from '@/components/listening/VinylTurntable.vue'
import SiteFooter from '@/components/layout/footer.vue'
import { useListeningRoom } from '@/composables/useListeningRoom'

defineOptions({ name: 'ListeningRoom' })
const room = useListeningRoom()
const {
  track,
  connected,
  ready,
  busy,
  error,
  paused,
  spinning,
  position,
  duration,
  volume,
  accent,
  results,
  query,
  searching,
  records,
  historyLoading,
  historyError,
} = room
const searchInput = ref(null)
const cover = computed(() => track.value.album?.images?.[0]?.url)
const artist = computed(() => track.value.artists?.map((item) => item.name).join(', '))
const formatTime = (ms) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
let searchTimer,
  composing = false
function queueSearch(event) {
  clearTimeout(searchTimer)
  room.cancelSearch()
  if (event?.isComposing || composing) return
  searchTimer = setTimeout(room.search, 300)
}
function submitSearch() {
  clearTimeout(searchTimer)
  if (!composing) room.search()
}
function finishComposition() {
  composing = false
  queueSearch()
}
function clearSearch() {
  clearTimeout(searchTimer)
  query.value = ''
  room.search()
  searchInput.value?.focus()
}
function connect() {
  room.connect()
}
onMounted(() => {
  room.initialize()
})
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
})
</script>

<template>
  <main class="listening-room" :style="{ '--record-color': accent }">
    <div class="room-inner">
      <header class="room-heading">
        <div>
          <h1 class="page-title">Listening Room</h1>
          <p>Put a record on. Let the rest wait.</p>
        </div>
        <div class="connection">
          <template v-if="connected">
            <span class="connection-state"
              ><i :class="{ live: ready }" />{{
                ready ? 'Spotify connected' : 'Player offline'
              }}</span
            >
            <button v-if="!ready" class="text-button" :disabled="busy" @click="room.reconnect">
              {{ busy ? 'Connecting…' : 'Reconnect player' }}
            </button>
            <button class="text-button" :disabled="busy" @click="room.disconnect">
              Disconnect
            </button>
          </template>
          <template v-else
            ><button class="connect-button" :disabled="busy" @click="connect">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="11" fill="currentColor" />
                <path
                  d="M6 9c4-1.3 8-1 12 1M7 12c3.5-1 6.7-.7 10 1M8 15c2.6-.7 5-.4 7.5.7"
                  fill="none"
                  stroke="var(--room-dark)"
                  stroke-width="1.5"
                  stroke-linecap="round"
                /></svg
              >{{ busy ? 'Connecting…' : 'Connect Spotify' }}</button
            ><span>Spotify Premium required</span></template
          >
        </div>
      </header>

      <p v-if="error" class="room-error" role="alert">
        {{ error }} <button class="text-button" @click="error = ''">Dismiss</button>
      </p>

      <section class="record-room" aria-label="Record player">
        <div class="deck-stage">
          <div class="deck-model">
            <VinylTurntable
              :spinning="spinning"
              :artwork="cover"
              :color="accent"
              @toggle="room.toggle"
            />
          </div>
        </div>
        <div class="now-playing">
          <div class="album-sleeve" :style="{ '--cover-art': `url(${cover})` }">
            <img
              v-if="cover"
              :src="cover"
              :alt="`${track.album?.name} album artwork`"
              fetchpriority="high"
            />
          </div>
          <div class="track-copy" aria-live="polite">
            <h2>{{ track.name }}</h2>
            <p>{{ artist }}</p>
            <span>{{ track.album?.name }}</span>
          </div>
          <a
            v-if="track.external_urls?.spotify"
            class="spotify-link"
            :href="track.external_urls.spotify"
            target="_blank"
            rel="noopener noreferrer"
            >Listen on Spotify ↗</a
          >
          <a
            v-else-if="track.id"
            class="spotify-link"
            :href="`https://open.spotify.com/search/${encodeURIComponent(track.name + ' ' + artist)}`"
            target="_blank"
            rel="noopener noreferrer"
            >Find on Spotify ↗</a
          >
        </div>
      </section>

      <section class="transport" aria-label="Playback controls">
        <div class="transport-buttons">
          <button
            class="icon-button"
            aria-label="Previous track"
            :disabled="!connected || !ready || busy"
            @click="room.skip(-1)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5h2v14H5zM19 5v14L8 12z" /></svg
            ><span aria-hidden="true">Previous</span>
          </button>
          <button
            class="play-button"
            :aria-label="paused ? 'Play' : 'Pause'"
            :disabled="!connected || !ready || !track.id || busy"
            @click="room.toggle"
          >
            <svg v-if="spinning" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg
            ><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 13 8-13 8z" /></svg
            ><span aria-hidden="true">{{ spinning ? 'Pause' : 'Play' }}</span>
          </button>
          <button
            class="icon-button"
            aria-label="Next track"
            :disabled="!connected || !ready || busy"
            @click="room.skip(1)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17 5h2v14h-2zM5 5v14l11-7z" /></svg
            ><span aria-hidden="true">Next</span>
          </button>
        </div>
        <div class="seek-control">
          <span>{{ formatTime(position) }}</span
          ><label class="sr-only" for="playback-position">Playback position</label
          ><input
            id="playback-position"
            type="range"
            min="0"
            :max="duration || 1"
            step="1000"
            :value="position"
            :aria-valuetext="formatTime(position)"
            :disabled="!connected || !ready || busy"
            @change="room.seek($event.target.value)"
          /><span>{{ formatTime(duration) }}</span>
        </div>
        <div class="volume-control">
          <label for="playback-volume"
            ><svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m11 5-6 4H2v6h3l6 4z" />
              <path
                d="M15 8q6 4 0 8M18 4q10 8 0 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              /></svg
            ><span>Volume</span></label
          ><input
            id="playback-volume"
            type="range"
            min="0"
            max="100"
            :value="volume"
            :disabled="!connected || !ready || busy"
            @change="room.changeVolume($event.target.value)"
          /><span>{{ volume }}%</span>
        </div>
      </section>

      <section class="record-selection" aria-label="Choose a record">
        <form
          v-if="connected"
          class="search-form"
          role="search"
          novalidate
          @submit.prevent="submitSearch"
        >
          <label class="sr-only" for="song-search">Search songs or artists</label
          ><svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="10.5"
              cy="10.5"
              r="6.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <path d="m16 16 5 5" stroke="currentColor" stroke-width="1.6" />
          </svg>
          <input
            id="song-search"
            ref="searchInput"
            v-model="query"
            type="search"
            placeholder="Search for a song or artist"
            :disabled="!connected"
            autocomplete="off"
            @input="queueSearch"
            @compositionstart="composing = true"
            @compositionend="finishComposition"
          />
          <button
            v-if="query"
            type="button"
            class="text-button"
            aria-label="Clear song search"
            @click="clearSearch"
          >
            Clear</button
          ><button class="search-button" :disabled="!connected || searching || !query.trim()">
            {{ searching ? 'Searching…' : 'Search' }}
          </button>
        </form>
        <div
          v-if="query.trim() && connected"
          class="search-results"
          aria-live="polite"
          :aria-busy="searching"
        >
          <p v-if="searching">Looking through Spotify…</p>
          <p v-else-if="!results.length && !error">No songs found. Try another title or artist.</p>
          <button
            v-for="item in results"
            :key="item.id"
            class="result-row"
            :disabled="busy || !ready || item.is_playable === false"
            @click="room.selectRecord(item)"
          >
            <img
              v-if="item.album?.images?.length"
              :src="item.album?.images?.[0]?.url"
              alt=""
            /><span
              ><strong>{{ item.name }}</strong
              ><span>{{ item.artists.map((a) => a.name).join(', ') }}</span></span
            ><span>{{
              item.is_playable === false ? 'Unavailable' : formatTime(item.duration_ms)
            }}</span
            ><span aria-hidden="true">↗</span>
          </button>
        </div>
        <template v-else>
          <p v-if="!connected">Connect Spotify to load your music and start listening.</p>
          <p v-else-if="historyLoading" role="status">Loading your recent songs…</p>
          <p v-else-if="historyError" role="alert">
            {{ historyError }}
            <button class="text-button" @click="room.refreshHistory">Retry history</button>
          </p>
          <p v-else-if="!records.length">
            No recent songs yet. Search Spotify to choose your first record.
          </p>
          <div class="record-shelf">
            <button
              v-for="item in records"
              :key="item.id"
              class="shelf-record"
              :aria-pressed="track.id === item.id"
              :disabled="!connected || !ready || busy"
              @click="room.selectRecord(item)"
            >
              <div class="shelf-art">
                <img
                  v-if="item.album?.images?.[0]?.url"
                  :src="item.album.images[0].url"
                  :alt="item.album?.name || item.name"
                  loading="lazy"
                />
              </div>
              <strong>{{ item.name }}</strong
              ><span class="sr-only">{{
                item.artists?.map((artist) => artist.name).join(', ')
              }}</span>
            </button>
          </div>
        </template>
      </section>
    </div>
  </main>
  <SiteFooter />
</template>

<style scoped>
.listening-room {
  --room-paper: var(--ui-bg);
  --room-ground: var(--ui-bg-accented);
  --room-ink: var(--ui-text);
  --room-muted: var(--ui-text-muted);
  --room-dark: #763e32;
  --room-white: #fff;
  --room-error: #f5dfd8;
  --room-error-ink: #7c3224;
  --room-focus: var(--color-brand-700);
  background: var(--room-paper);
  color: var(--room-ink);
  padding: var(--page-top) 0 var(--page-bottom);
  font: 20px/1.5 var(--font-serif);
}
/* The shared tokens switch for dark mode; the controls and alerts follow. */
:global(.dark .listening-room) {
  --room-dark: var(--color-brand-600);
  --room-error: #3a2a30;
  --room-error-ink: #f09595;
  --room-focus: var(--color-brand-300);
}
.room-inner {
  width: var(--page-width);
  margin-inline: auto;
}
.room-heading {
  display: flex;
  justify-content: space-between;
  /* Top-aligned, so the title stays at the same height as on other pages
     however tall the Spotify controls get. */
  align-items: flex-start;
  gap: 28px;
}
h1 {
  margin: 0 0 10px;
}
.room-heading p {
  margin: 0;
  color: var(--room-muted);
}
.connection {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  font: 12px/1.5 var(--font-sans);
  color: var(--room-muted);
}
button,
input {
  font-family: var(--font-sans);
}
button,
a,
input {
  -webkit-tap-highlight-color: transparent;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
:is(button, a, input):focus-visible {
  outline: 2px solid var(--room-focus);
  outline-offset: 5px;
}
.connect-button {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--room-white);
  background: var(--room-dark);
  border: 0;
  border-radius: 999px;
  padding: 12px 20px;
  min-height: 44px;
  font-size: 14px;
  font-weight: 600;
}
.connect-button svg {
  width: 20px;
  height: 20px;
}
.connect-button:hover:not(:disabled) {
  background: var(--room-ink);
}
.text-button {
  background: none;
  border: 0;
  color: inherit;
  font-size: 13px;
  min-height: 44px;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.connection-state {
  display: flex;
  align-items: center;
  gap: 8px;
}
.connection-state i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--room-muted);
}
.connection-state i.live {
  background: var(--room-dark);
}
.record-room {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.8fr);
  align-items: center;
  gap: 48px;
  margin-top: 42px;
}
.deck-stage {
  position: relative;
  min-width: 0;
}
.deck-model {
  height: 400px;
}
.now-playing {
  min-width: 0;
  padding: 16px 20px 16px 0;
}
.album-sleeve {
  position: relative;
  isolation: isolate;
  margin: 0 0 28px;
}
.album-sleeve::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -16px;
  background-image: var(--cover-art);
  background-size: cover;
  filter: blur(28px);
  opacity: 0.5;
  transform: translateY(12px);
}
.album-sleeve::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -24px;
  /* prettier-ignore */
  background: linear-gradient( /* taste-skill-ignore: user-requested cover glow. */
    150deg,
    color-mix(in srgb, var(--record-color) 35%, transparent),
    transparent 65%
  );
  filter: blur(24px);
}
.album-sleeve img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
  border-radius: 4px;
  box-shadow: 0 14px 28px #30352f24; /* taste-skill-ignore: user requested glow around the album cover. */
}
.track-copy h2 {
  font: 600 var(--text-subheader)/1.3 var(--font-sans);
  letter-spacing: -0.025em;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}
.track-copy p {
  font-size: var(--text-body);
  line-height: 1.3;
  margin: 0 0 4px;
}
.track-copy > span {
  font-size: var(--text-body);
  color: var(--room-muted);
}
.spotify-link {
  display: inline-flex;
  align-items: center;
  font: 13px var(--font-sans);
  min-height: 44px;
  margin-top: 12px;
  text-decoration: underline;
  text-underline-offset: 5px;
}
.spotify-link:hover {
  color: var(--room-focus);
}
.transport {
  display: grid;
  grid-template-columns: 218px minmax(0, 1fr) 150px;
  align-items: center;
  gap: 32px;
  margin-top: 28px;
  padding: 24px 0;
}
.transport-buttons {
  display: flex;
  align-items: stretch;
  gap: 6px;
}
.icon-button,
.play-button {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 7px;
  min-width: 64px;
  height: 66px;
  background: var(--room-ground);
  color: var(--room-ink);
  border: 0;
  border-radius: 4px;
  transition:
    transform 150ms ease,
    background 150ms ease;
  font: 11px var(--font-sans);
}
.play-button {
  min-width: 78px;
  background: var(--room-dark);
  color: var(--room-white);
}
.transport-buttons button:hover:not(:disabled) {
  transform: translateY(-2px);
}
.transport-buttons button:active:not(:disabled) {
  transform: translateY(1px);
}
.transport svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
.seek-control {
  display: flex;
  align-items: center;
  gap: 12px;
  font: 13px var(--font-sans);
  font-variant-numeric: tabular-nums;
}
.seek-control > span {
  min-width: 32px;
}
.volume-control {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 8px;
  align-items: center;
  font: 12px var(--font-sans);
  font-variant-numeric: tabular-nums;
}
.volume-control label {
  display: flex;
  gap: 7px;
  align-items: center;
}
.volume-control label svg {
  width: 16px;
  height: 16px;
}
.volume-control input {
  grid-row: 2;
  grid-column: 1 / -1;
}
.volume-control > span {
  grid-column: 2;
  grid-row: 1;
}
input[type='range'] {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  min-width: 0;
  height: 44px;
  background: transparent;
  cursor: pointer;
  margin: 0;
}
input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--room-ink);
  border-radius: 2px;
}
input[type='range']::-moz-range-track {
  height: 4px;
  background: var(--room-ink);
  border-radius: 2px;
}
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 20px;
  margin-top: -8px;
  background: var(--room-dark);
  border: 2px solid var(--room-paper);
  border-radius: 3px;
}
input[type='range']::-moz-range-thumb {
  width: 8px;
  height: 16px;
  background: var(--room-dark);
  border: 2px solid var(--room-paper);
  border-radius: 3px;
}
input:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.record-selection {
  padding-top: 38px;
}
.record-shelf {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
}
.shelf-record {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 0;
  background: none;
  border: 0;
  color: var(--room-ink);
  min-width: 0;
}
.shelf-art {
  width: 100%;
  overflow: hidden;
}
.shelf-art img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
  transition: transform 200ms ease;
}
.shelf-record:hover:not(:disabled) img {
  transform: scale(1.035);
}
.shelf-record[aria-pressed='true'] .shelf-art {
  outline: 2px solid var(--room-ink);
  outline-offset: 5px;
}
.shelf-record > strong {
  font: 400 var(--text-body)/1.3 var(--font-serif);
  margin-top: 14px;
}
.shelf-record[aria-pressed='true'] > strong {
  text-decoration: underline;
  text-underline-offset: 5px;
}
.search-form {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--room-ground);
  margin-bottom: 28px;
}
.search-form > svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.search-form input {
  min-width: 0;
  width: 100%;
  min-height: 44px;
  background: none;
  border: 0;
  font-size: 16px;
  color: var(--room-ink);
}
.search-form input::placeholder {
  color: var(--room-muted);
  opacity: 1;
}
.search-button {
  min-height: 44px;
  padding: 8px 16px;
  background: var(--room-dark);
  color: var(--room-white);
  font-size: 13px;
}
.search-results {
  min-height: 120px;
}
.result-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  text-align: left;
  background: var(--room-ground);
  color: var(--room-ink);
  margin-bottom: 8px;
}
.result-row img {
  width: 52px;
  height: 52px;
  object-fit: cover;
}
.result-row > span:first-of-type {
  flex: 1;
  min-width: 0;
}
.result-row strong {
  font: 600 16px var(--font-sans);
  display: block;
  overflow-wrap: anywhere;
}
.result-row span span {
  display: block;
  font: 18px var(--font-serif);
  margin-top: 4px;
}
.result-row > span {
  font-size: 13px;
}
.room-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: var(--room-error);
  color: var(--room-error-ink);
  padding: 16px 20px;
  margin: 24px 0 0;
  font-size: var(--text-body);
}
@media (max-width: 1000px) {
  .record-room {
    gap: 24px;
  }
  .deck-model {
    height: 340px;
  }
  .now-playing {
    padding-right: 0;
  }
  .transport {
    grid-template-columns: 218px minmax(0, 1fr);
    gap: 12px 24px;
  }
  .volume-control {
    grid-column: 2;
    width: 150px;
    justify-self: end;
  }
}
@media (max-width: 768px) {
  .room-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 20px;
  }
  .connection {
    align-items: flex-start;
  }
  .record-room {
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 26px;
  }
  .deck-model {
    height: 260px;
  }
  .now-playing {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr);
    gap: 0 22px;
    align-items: center;
    padding: 20px 0;
  }
  .album-sleeve {
    grid-row: span 2;
    margin: 0;
  }
  .album-sleeve::before {
    inset: -8px;
    filter: blur(18px);
  }
  .spotify-link {
    font-size: 12px;
    margin-top: 0;
  }
  .transport {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 4px;
    padding-block: 12px;
  }
  .transport-buttons {
    justify-content: center;
  }
  .seek-control {
    grid-row: 2;
  }
  .volume-control {
    grid-column: 1;
    justify-self: center;
    width: 150px;
  }
  .record-selection {
    padding-top: 36px;
  }
  .record-shelf {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 18px;
  }
  .shelf-record > strong {
    font-size: 21px;
  }
  .search-form {
    gap: 8px;
    padding-inline: 8px;
  }
  .search-form input {
    font-size: 14px;
  }
  .search-button {
    padding-inline: 10px;
  }
}
@media (forced-colors: active) {
  .album-sleeve::before,
  .album-sleeve::after {
    display: none;
  }
  .transport-buttons button {
    border: 1px solid ButtonText;
  }
  input[type='range'] {
    appearance: auto;
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
</style>
