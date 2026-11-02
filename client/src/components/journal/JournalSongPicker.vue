<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { searchSongs } from '@/api/songs'

// Search Spotify and select an optional song for the journal entry.
const song = defineModel({ type: Object, default: null })

const query = ref('')
const results = ref([])
const isSearching = ref(false)
const searchError = ref('')

// Looks the words up 300 ms after typing stops, so every key press doesn't
// send a request. Only the newest search may fill the list.
let searchTimer
let latestSearch = 0

watch(query, (text) => {
  window.clearTimeout(searchTimer)
  latestSearch += 1
  searchError.value = ''
  if (text.trim().length < 2) {
    latestSearch += 1
    results.value = []
    isSearching.value = false
    return
  }
  isSearching.value = true
  searchTimer = window.setTimeout(() => findSongs(text.trim()), 300)
})

async function findSongs(text) {
  const search = ++latestSearch
  try {
    const songs = await searchSongs(text)
    if (search === latestSearch) results.value = songs
  } catch (error) {
    if (search === latestSearch) searchError.value = error.message
  } finally {
    if (search === latestSearch) isSearching.value = false
  }
}

function pick(found) {
  song.value = {
    id: found.id,
    name: found.name,
    artists: found.artists,
    ...(found.album?.imageUrl ? { imageUrl: found.album.imageUrl } : {}),
  }
  query.value = ''
  results.value = []
}

function remove() {
  song.value = null
}

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  latestSearch += 1
})
</script>

<template>
  <div class="song-picker">
    <div v-if="song" class="picked-song">
      <img v-if="song.imageUrl" class="song-cover" :src="song.imageUrl" alt="" />
      <span v-else class="song-cover song-cover--empty" aria-hidden="true">♫</span>
      <span class="song-text">
        <strong>{{ song.name }}</strong>
        <span>{{ song.artists.join(', ') }}</span>
      </span>
      <button type="button" class="remove-song" @click="remove">Remove</button>
    </div>

    <template v-else>
      <label for="song-of-the-day-search" class="sr-only">Search for a song</label>
      <input
        id="song-of-the-day-search"
        v-model="query"
        class="song-search"
        type="search"
        placeholder="Search for a song or artist…"
        autocomplete="off"
      />
      <p v-if="isSearching" role="status" class="song-status">Searching…</p>
      <p v-else-if="searchError" role="alert" class="song-status text-error">{{ searchError }}</p>
      <p
        v-else-if="query.trim().length >= 2 && !results.length"
        role="status"
        class="song-status"
      >
        No songs found. Try another title or artist.
      </p>
      <ul v-if="results.length" class="song-results" aria-label="Matching songs">
        <li v-for="found in results" :key="found.id">
          <button type="button" class="song-result" @click="pick(found)">
            <img
              v-if="found.album?.imageUrl"
              class="song-cover song-cover--small"
              :src="found.album.imageUrl"
              alt=""
            />
            <span class="song-text">
              <strong>{{ found.name }}</strong>
              <span>{{ found.artists.join(', ') }}</span>
            </span>
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.song-picker {
  font-family: var(--font-sans);
}
.song-search {
  width: 100%;
  min-height: 48px;
  padding: 10px 18px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text);
  background: var(--ui-bg-elevated);
  font: 400 0.95rem var(--font-sans);
}
.song-search::placeholder {
  color: var(--ui-text-muted);
  opacity: 1;
}
.song-search:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}
.song-status {
  margin: 10px 4px 0;
  color: var(--ui-text-muted);
  font-size: 0.85rem;
}
.song-results {
  display: grid;
  gap: 2px;
  margin: 8px 0 0;
  padding: 6px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-bg-elevated);
  list-style: none;
}
.song-result {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 10px;
  color: var(--ui-text);
  text-align: left;
  cursor: pointer;
}
.song-result:hover,
.song-result:focus-visible {
  background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
}
.song-result:focus-visible,
.remove-song:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.picked-song {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg-elevated);
}
.song-cover {
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 10px;
  object-fit: cover;
}
.song-cover--small {
  width: 44px;
  height: 44px;
  border-radius: 8px;
}
.song-cover--empty {
  display: grid;
  place-items: center;
  color: var(--ui-primary);
  background: color-mix(in srgb, var(--ui-primary) 14%, transparent);
  font-size: 1.6rem;
}
.song-text {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}
.song-text strong,
.song-text span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-text span {
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}
.remove-song {
  flex: none;
  padding: 8px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  font: 600 0.85rem var(--font-sans);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease;
}
.remove-song:hover {
  border-color: var(--ui-primary);
  color: var(--ui-primary);
}
</style>
