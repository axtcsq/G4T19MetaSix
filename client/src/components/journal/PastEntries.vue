<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import MoodFace from '@/components/journal/MoodFace.vue'
import JournalDrawingNote from '@/components/journal/JournalDrawingNote.vue'

const MOOD_COLORS = {
  Sad: '#4389d1',
  Happy: '#f2c335',
  Relaxed: '#998ba1',
  Anxious: '#ed8a35',
  Angry: '#d94a45',
  Excited: '#d96f9f',
  Tired: '#7e8ca6',
  Lonely: '#4f8f95',
}

const props = defineProps({
  entries: {
    type: Array,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  loadError: {
    type: String,
    default: '',
  },
  // The entry pinned to the profile page, if any.
  pinnedId: {
    type: String,
    default: null,
  },
  focusEntryId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['retry', 'pin'])
const searchInput = ref('')
const searchQuery = ref('')

const filteredEntries = computed(() => {
  const query = searchQuery.value.toLocaleLowerCase()
  if (!query) return props.entries

  return props.entries.filter((entry) => {
    const searchableText = [
      entry.journal,
      entry.mood,
      formatDate(entry.createdAt),
      entry.createdAt,
      entry.drawing?.items?.length ? 'drawing' : '',
      entry.song?.name,
      entry.song?.artists?.join(' '),
    ]
      .join(' ')
      .toLocaleLowerCase()

    return searchableText.includes(query)
  })
})

function searchEntries() {
  searchQuery.value = searchInput.value.trim()
}

function clearSearch() {
  searchInput.value = ''
  searchQuery.value = ''
}

async function focusRequestedEntry() {
  if (!props.focusEntryId || props.isLoading) return
  await nextTick()
  const entry = document.getElementById(`journal-entry-${props.focusEntryId}`)
  if (!entry) return
  entry.focus({ preventScroll: true })
  entry.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

watch(() => [props.entries, props.focusEntryId, props.isLoading], focusRequestedEntry, { immediate: true })

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <section id="past-entries" aria-label="Past Entries">
    <div class="journal-history">
      <form class="history-search" role="search" @submit.prevent="searchEntries">
        <label for="history-search-input" class="sr-only">Search Past Entries</label>
        <input
          id="history-search-input"
          v-model="searchInput"
          type="search"
          placeholder="Search your past entries…"
          autocomplete="off"
        />
        <button type="submit" class="history-search-button" aria-label="Search Entries">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m15.5 15.5 4.2 4.2" />
          </svg>
        </button>
      </form>

      <p
        v-if="isLoading"
        role="status"
        aria-live="polite"
        class="py-10 text-center text-sm text-muted"
      >
        Loading your entries...
      </p>

      <div v-else-if="loadError" role="alert" class="py-8 text-center">
        <p class="text-sm text-error">{{ loadError }}</p>
        <UButton
          type="button"
          color="primary"
          class="glass-action mt-4 rounded-full font-sans"
          @click="emit('retry')"
        >
          Try Again
        </UButton>
      </div>

      <div v-else-if="entries.length === 0" class="py-10 text-center">
        <p class="font-sans text-sm text-muted">
          No entries yet. Choose “Back to Writing” to make your first entry.
        </p>
      </div>

      <div v-else-if="filteredEntries.length === 0" class="py-10 text-center">
        <p class="font-sans text-sm text-muted">No entries match “{{ searchQuery }}”.</p>
        <button type="button" class="clear-search" @click="clearSearch">Clear Search</button>
      </div>

      <div v-else class="history-list">
        <article
          v-for="entry in filteredEntries"
          :id="`journal-entry-${entry._id}`"
          :key="entry._id"
          class="journal-entry"
          :class="{ 'is-focused': entry._id === focusEntryId }"
          tabindex="-1"
        >
          <div
            class="entry-sheet notebook-page"
            :class="{ 'has-drawing': entry.drawing?.items?.length }"
          >
            <header class="entry-metadata">
              <time :datetime="entry.createdAt">{{ formatDate(entry.createdAt) }}</time>
              <span class="entry-emotion" :style="{ '--entry-mood-color': MOOD_COLORS[entry.mood] }">
                <MoodFace :mood="entry.mood" class="emotion-sketch" />
                {{ entry.mood }}
              </span>
              <button
                type="button"
                class="pin-button"
                aria-label="Pin to profile"
                :aria-pressed="entry._id === pinnedId"
                :title="entry._id === pinnedId ? 'Pinned to profile' : 'Pin to profile'"
                @click="emit('pin', entry._id === pinnedId ? null : entry._id)"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M12 17v5" />
                  <path
                    d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
                  />
                </svg>
              </button>
            </header>
            <p>{{ entry.journal || 'No written reflection.' }}</p>
            <!-- The Song of the Day and the drawing share one row under the
                 writing, so the entry stays short. -->
            <div v-if="entry.song || entry.drawing?.items?.length" class="entry-extras">
              <!-- The Song of the Day, clipped to the page like a ticket stub. -->
              <div v-if="entry.song" class="entry-song">
                <img v-if="entry.song.imageUrl" class="entry-song-cover" :src="entry.song.imageUrl" alt="" />
                <span class="entry-song-text">
                  <span class="entry-song-label">Song of the Day</span>
                  <RouterLink class="entry-song-title" :to="`/song/${entry.song.id}`"
                    >{{ entry.song.name }}<span class="sr-only">, see its mood</span></RouterLink
                  >
                  <span class="entry-song-artists">{{ entry.song.artists.join(', ') }}</span>
                </span>
              </div>
              <JournalDrawingNote
                v-if="entry.drawing?.items?.length"
                class="entry-drawing"
                :drawing="entry.drawing"
                :label="'Drawing from ' + formatDate(entry.createdAt)"
              />
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.history-list {
  display: grid;
  gap: 32px;
}

.history-search {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.history-search input {
  min-width: 0;
  flex: 1;
  min-height: 48px;
  padding: 10px 18px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font: 400 var(--text-small) var(--font-sans);
}

.history-search input::placeholder {
  color: var(--ui-text-muted);
  opacity: 1;
}

.history-search input:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}

.history-search-button {
  display: grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--ui-border);
  border-radius: 50%;
  color: var(--ui-primary);
  background: var(--ui-bg-elevated);
  box-shadow:
    inset 0 2px 3px rgb(255 255 255 / 72%),
    0 3px 9px rgb(59 43 35 / 12%);
  cursor: pointer;
}

.history-search-button:hover {
  transform: translateY(-1px);
}

.history-search-button:focus-visible,
.clear-search:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}

.history-search-button svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.clear-search {
  margin-top: 8px;
  color: var(--ui-primary);
  font: 600 var(--text-label) var(--font-sans);
  text-decoration: underline;
}

.journal-entry {
  min-width: 0;
}
.journal-entry.is-focused .entry-sheet {
  outline: 2px solid var(--ui-primary);
  outline-offset: 4px;
}

.entry-sheet {
  position: relative;
}

.entry-sheet > p {
  margin: 0;
}

.entry-metadata {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  margin-bottom: 36px;
  color: #313c50;
  font: 400 22px/36px var(--font-journal);
  white-space: normal;
}

.entry-emotion {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--entry-mood-color, #313c50);
}

.pin-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border: 1px solid #d9cdbb;
  border-radius: 50%;
  color: #687181;
  background: rgb(255 255 255 / 70%);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease;
}

.pin-button svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pin-button:hover {
  border-color: #b0573f;
  color: #b0573f;
}

/* Pinned: a filled pin on the brand colour. */
.pin-button[aria-pressed='true'] {
  border-color: #b0573f;
  color: #fff;
  background: #b0573f;
}

.pin-button[aria-pressed='true'] svg {
  fill: currentColor;
}

.pin-button:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.emotion-sketch {
  width: 36px;
  height: 36px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: rotate(-5deg);
}

/* Place the song and drawing side by side, wrapping on narrow screens. */
.entry-extras {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 28px 24px;
  margin-top: 24px;
  white-space: normal;
}
.entry-drawing {
  margin-left: auto;
}

.entry-song {
  display: flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 8px 16px 8px 8px;
  border: 1px solid #e3d6c4;
  border-radius: 12px;
  background: rgb(255 255 255 / 70%);
  box-shadow: 0 2px 6px #78694d14;
  white-space: normal;
  transform: rotate(-1deg);
}
.entry-song-cover {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}
.entry-song-text {
  display: grid;
  min-width: 0;
  font-family: var(--font-sans);
  line-height: 1.3;
}
.entry-song-label {
  color: #b0573f;
  font-size: var(--text-caption);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.entry-song-title {
  overflow: hidden;
  color: #313c50;
  font-size: var(--text-small);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-song-title:hover {
  color: #b0573f;
}
.entry-song-title:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.entry-song-artists {
  overflow: hidden;
  color: #687181;
  font-size: var(--text-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notebook-page {
  --notebook-line-height: 36px;
  min-height: 144px;
  margin: 0;
  padding: 18px 24px 18px 48px;
  border: 1px solid #d9cdbb;
  border-radius: 6px 14px 14px 6px;
  background-color: #fffaf0;
  background-image:
    linear-gradient(90deg, transparent 31px, #d6a09a 31px, #d6a09a 32px, transparent 32px),
    repeating-linear-gradient(180deg, transparent 0, transparent 35px, #b8c9d5 35px, #b8c9d5 36px),
    url('@/assets/images/paper-grain.svg');
  background-position:
    0 0,
    0 12px,
    0 0;
  background-attachment: local;
  box-shadow:
    inset 4px 0 9px #78694d0d,
    0 3px 9px #78694d12;
  color: #313c50;
  font-family: var(--font-journal);
  font-size: 26px;
  font-weight: 400;
  line-height: var(--notebook-line-height);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: auto;
}

@media (max-width: 600px) {
  .history-search {
    gap: 8px;
  }

  .history-search input,
  .history-search-button {
    min-height: 44px;
    height: 44px;
  }

  .history-search-button {
    width: 44px;
  }

  /* The pin stays in the corner, and a long mood wraps under the date instead. */
  .entry-metadata {
    position: relative;
    gap: 4px 12px;
    padding-right: 44px;
    font-size: 20px;
  }

  .pin-button {
    position: absolute;
    top: 0;
    right: 0;
  }

  .emotion-sketch {
    width: 30px;
    height: 30px;
  }
}
</style>
