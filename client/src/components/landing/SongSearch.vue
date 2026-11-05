<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { getSongAnalysis, searchSongs } from '@/api/songs'
import { useAuthStore } from '@/stores/auth'

// Logged out, the result points to logging in for the full analysis.
const auth = useAuthStore()

const query = ref('')
// Songs that match what has been typed so far.
const suggestions = ref([])
// The song picked from the suggestions, waiting for "Analyse".
const chosen = ref(null)
// The analysed song on show: the chosen song plus its analysis.
const selected = ref(null)
const isAnalysing = ref(false)
const searchError = ref('')

// Songs we already have lyrics for, so their mood uses the lyrics too.
const EXAMPLE_SONGS = [
  { id: '2PpruBYCo4H7WOBJ7Q2EwM', name: 'Hey Ya!', artists: ['Outkast'] },
  { id: '5wANPM4fQCJwkGd4rN57mH', name: 'drivers license', artists: ['Olivia Rodrigo'] },
  { id: '39LLxExYz6ewLAcYrzQQyP', name: 'Levitating', artists: ['Dua Lipa'] },
  { id: '70LcF31zb1H0PyJoS1Sx1r', name: 'Creep', artists: ['Radiohead'] },
]

const songLabel = (song) => `${song.name} · ${song.artists.join(', ')}`

// Looks the words up 300 ms after the visitor stops typing, so every key press doesn't send a request.
let searchTimer
let latestSearch = 0

watch(query, (text) => {
  window.clearTimeout(searchTimer)
  latestSearch += 1
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
  if (!chosen.value || isAnalysing.value) return
  const song = chosen.value

  isAnalysing.value = true
  searchError.value = ''
  try {
    const analysis = await getSongAnalysis(song.id)
    if (chosen.value?.id === song.id) selected.value = { ...song, ...analysis }
  } catch (error) {
    searchError.value = error.message
  } finally {
    isAnalysing.value = false
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  latestSearch += 1
})
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
      <p v-if="!auth.user" class="login-note">
        <RouterLink to="/login">Log in</RouterLink> to see more in-depth song analysis.
      </p>
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
  font-size: var(--text-label);
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
  font-size: var(--text-label);
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
  font-size: var(--text-caption);
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.song-feeling strong {
  color: var(--ui-primary);
  font-size: var(--text-title);
  line-height: 1.1;
}
.login-note {
  margin: -8px 0 0;
  color: var(--ui-text-muted);
  font-size: var(--text-label);
}
/* Glows on hover like the other landing page links. */
.login-note a {
  color: var(--ui-primary);
  font-weight: 600;
  transition: text-shadow 200ms ease;
}
.login-note a:hover,
.login-note a:focus-visible {
  text-shadow:
    0 0 4px color-mix(in srgb, var(--ui-primary) 90%, transparent),
    0 0 12px color-mix(in srgb, var(--ui-primary) 70%, transparent),
    0 0 26px color-mix(in srgb, var(--ui-primary) 50%, transparent);
}

@media (max-width: 768px) {
  .search-form {
    flex-direction: column;
  }
  /* Stacked, the box would otherwise shrink to the size of its input. */
  .search-box {
    flex: none;
    width: 100%;
  }
}
</style>
