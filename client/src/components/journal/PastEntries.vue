<script setup>
import { computed, ref } from 'vue'
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
})

const emit = defineEmits(['retry'])
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
        <article v-for="entry in filteredEntries" :key="entry._id" class="journal-entry">
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
            </header>
            <p>{{ entry.journal || 'No written reflection.' }}</p>
            <JournalDrawingNote
              v-if="entry.drawing?.items?.length"
              :drawing="entry.drawing"
              :label="'Drawing from ' + formatDate(entry.createdAt)"
            />
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
  font: 400 0.95rem var(--font-sans);
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
  font: 600 0.9rem var(--font-sans);
  text-decoration: underline;
}

.journal-entry {
  min-width: 0;
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

.entry-sheet.has-drawing {
  min-height: 420px;
  padding-bottom: 288px;
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

  .entry-metadata {
    gap: 4px 12px;
    font-size: 20px;
  }

  .emotion-sketch {
    width: 30px;
    height: 30px;
  }
}
</style>
