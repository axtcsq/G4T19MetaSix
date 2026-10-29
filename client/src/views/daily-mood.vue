<script setup>
import { computed, onMounted, ref } from 'vue'
import { createMood, getMoods } from '@/api/moods'
import { generateJournalIdea } from '@/api/journal'
import SiteFooter from '@/components/layout/footer.vue'
import MoodFace from '@/components/journal/MoodFace.vue'
import JournalDrawingNote from '@/components/journal/JournalDrawingNote.vue'
import JournalCanvas from '@/components/journal/JournalCanvas.vue'

const showHistory = ref(false)
const showDrawing = ref(false)
const saveStatus = ref('')

const moods = ['Sad', 'Happy', 'Relaxed', 'Anxious', 'Angry']
const selectedMood = ref(null)
const journalEntry = ref('')
const drawingData = ref(null)
const helperOpen = ref(false)
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const logs = ref([])
const historyQuery = ref('')
const isLoading = ref(true)
const isSaving = ref(false)
const loadError = ref('')
const saveError = ref('')
const ideaPrompt = ref('')
const journalIdea = ref('')
const isGeneratingIdea = ref(false)
const ideaError = ref('')
const ideaStatus = ref('')

const canSave = computed(
  () =>
    selectedMood.value !== null &&
    (journalEntry.value.trim().length > 0 || drawingData.value?.items?.length > 0) &&
    !isLoading.value &&
    !isSaving.value,
)

const filteredLogs = computed(() => {
  const query = historyQuery.value.trim().toLocaleLowerCase()
  if (!query) return logs.value

  return logs.value.filter((log) => {
    const searchableText = [
      log.journal,
      log.mood,
      formatDate(log.createdAt),
      log.createdAt,
      log.drawing?.items?.length ? 'drawing' : '',
    ]
      .join(' ')
      .toLocaleLowerCase()

    return searchableText.includes(query)
  })
})

async function loadEntries() {
  isLoading.value = true
  loadError.value = ''

  try {
    logs.value = await getMoods()
  } catch (error) {
    loadError.value = error.message
  } finally {
    isLoading.value = false
  }
}

async function saveEntry() {
  if (!canSave.value) return

  isSaving.value = true
  saveError.value = ''

  try {
    const savedEntry = await createMood({
      mood: selectedMood.value,
      journal: journalEntry.value.trim(),
      drawing: drawingData.value,
    })

    logs.value = [savedEntry, ...logs.value]
    saveStatus.value = 'Entry saved.'
    selectedMood.value = null
    journalEntry.value = ''
    drawingData.value = null
    helperOpen.value = false
  } catch (error) {
    saveError.value = error.message
  } finally {
    isSaving.value = false
  }
}

function clearSaveFeedback() {
  saveError.value = ''
  saveStatus.value = ''
}

function selectMood(mood) {
  selectedMood.value = mood
  clearSaveFeedback()
}

async function createJournalIdea() {
  const prompt = ideaPrompt.value.trim()
  if (!prompt || isGeneratingIdea.value) return

  isGeneratingIdea.value = true
  ideaError.value = ''
  ideaStatus.value = ''
  journalIdea.value = ''

  try {
    journalIdea.value = await generateJournalIdea(prompt)
    ideaStatus.value = 'Your journal idea is ready.'
  } catch (error) {
    ideaError.value = error.message
  } finally {
    isGeneratingIdea.value = false
  }
}

function clearJournalIdea() {
  journalIdea.value = ''
  ideaError.value = ''
  ideaStatus.value = ''
}

function insertJournalIdea() {
  if (!journalIdea.value) return

  const existingText = journalEntry.value.trimEnd()
  journalEntry.value = existingText ? `${existingText}\n\n${journalIdea.value}` : journalIdea.value
  clearSaveFeedback()
  ideaStatus.value = 'Added to journal.'
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(loadEntries)
</script>

<template>
  <div class="daily-mood-page">
    <main class="daily-mood-content flex-1">
      <header class="journal-header">
        <div>
          <h1 class="page-title">{{ showHistory ? 'Past Entries' : 'Today’s Journal' }}</h1>
          <p class="body-text mt-2 text-muted">
            {{
              showHistory
                ? 'Your days, in your own words.'
                : 'A little space to check in with yourself.'
            }}
          </p>
        </div>
        <button
          type="button"
          class="history-toggle glass-secondary"
          :aria-expanded="showHistory"
          aria-controls="past-entries"
          @click="showHistory = !showHistory"
        >
          <svg v-if="!showHistory" class="history-clock" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v6l4 2" />
          </svg>
          {{ showHistory ? 'Back to Writing' : 'Past Entries' }}
        </button>
      </header>
      <div class="journal-layout">
        <section v-show="!showHistory" class="journal-column">
          <form id="daily-journal-form" class="journal-form" novalidate @submit.prevent="saveEntry">
            <fieldset>
              <legend class="sub-header">How are you feeling?</legend>
              <div class="mt-4 flex flex-wrap gap-3" role="group" aria-label="Choose a mood">
                <button
                  v-for="mood in moods"
                  :key="mood"
                  type="button"
                  class="mood-option mood-reaction"
                  :class="[
                    `mood-option--${mood.toLowerCase()}`,
                    `mood-reaction--${mood.toLowerCase()}`,
                    { 'is-selected': selectedMood === mood },
                  ]"
                  :aria-pressed="selectedMood === mood"
                  @click="selectMood(mood)"
                >
                  <MoodFace :mood="mood" class="button-mood-face" />
                  {{ mood }}
                </button>
              </div>
            </fieldset>

            <div class="journal-field-group mt-10">
              <label for="journal-entry" class="sub-header">What’s on your mind?</label>
              <UTextarea
                id="journal-entry"
                v-model="journalEntry"
                placeholder="Write your thoughts here..."
                :rows="7"
                autoresize
                maxlength="5000"
                aria-describedby="journal-help"
                class="notebook-field mt-4 w-full resize-none"
                :ui="{ base: 'notebook-input w-full resize-none' }"
                @update:model-value="clearSaveFeedback"
              />
              <p id="journal-help" class="mt-2 text-sm text-muted">
                {{ journalEntry.length }} / 5000 characters. Write a reflection or add a drawing.
              </p>
            </div>
          </form>
          <div class="helper-widget">
            <UPopover
              v-model:open="helperOpen"
              :content="{ side: 'top', align: 'end', sideOffset: 12 }"
            >
              <button
                type="button"
                class="helper-launcher"
                aria-label="Open MetaFor Helper"
                title="MetaFor Helper"
              >
                <img
                  src="@/assets/images/journal-helper-sparkle.png"
                  alt=""
                  width="46"
                  height="46"
                />
              </button>
              <template #content>
                <section class="helper-popover" aria-labelledby="helper-title">
                  <div class="helper-backdrop" aria-hidden="true">
                    <video
                      v-if="!reduceMotion"
                      class="helper-liquid"
                      src="/videos/banner-sunset.mp4"
                      poster="/videos/banner-sunset.jpg"
                      autoplay
                      muted
                      loop
                      playsinline
                    />
                    <div class="helper-liquid-scrim" />
                  </div>
                  <div class="helper-content">
                    <header class="helper-header">
                      <h2 id="helper-title">MetaFor Helper</h2>
                      <button
                        type="button"
                        class="helper-close glass-icon"
                        aria-label="Close MetaFor Helper"
                        @click="helperOpen = false"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m6 6 12 12M6 18 18 6" />
                        </svg>
                      </button>
                    </header>
                    <form @submit.prevent="createJournalIdea">
                      <label class="sr-only" for="journal-idea-prompt"
                        >What would you like to reflect on?</label
                      >
                      <textarea
                        id="journal-idea-prompt"
                        v-model="ideaPrompt"
                        maxlength="800"
                        rows="3"
                        class="journal-idea-prompt"
                        placeholder="What would you like to reflect on?"
                        :disabled="isGeneratingIdea"
                        @input="clearJournalIdea"
                      />
                      <UButton
                        type="submit"
                        class="glass-action mt-3"
                        :disabled="!ideaPrompt.trim() || isGeneratingIdea"
                        :loading="isGeneratingIdea"
                        >{{ isGeneratingIdea ? 'Thinking…' : 'Find a Starting Point' }}</UButton
                      >
                    </form>
                    <div v-if="journalIdea" class="helper-result">
                      <p class="body-text">{{ journalIdea }}</p>
                      <UButton
                        type="button"
                        variant="outline"
                        class="mt-3"
                        @click="insertJournalIdea"
                        >Add to My Entry</UButton
                      >
                    </div>
                    <p v-if="ideaError" role="alert" class="mt-3 text-sm text-error">
                      {{ ideaError }}
                    </p>
                    <p v-if="ideaStatus" role="status" class="sr-only">{{ ideaStatus }}</p>
                    <p class="helper-privacy">Only this prompt is sent to Groq AI when you ask.</p>
                  </div>
                </section>
              </template>
            </UPopover>
          </div>
        </section>

        <section v-show="showHistory" id="past-entries" aria-label="Past Entries">
          <div class="journal-history">
            <label class="history-search">
              <span class="sr-only">Search past entries</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.3" />
                <path d="m15.5 15.5 4.2 4.2" />
              </svg>
              <input
                v-model="historyQuery"
                type="search"
                placeholder="Search your past entries…"
                autocomplete="off"
              />
            </label>
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
                @click="loadEntries"
              >
                Try Again
              </UButton>
            </div>

            <div v-else-if="logs.length === 0" class="py-10 text-center">
              <p class="font-sans text-sm text-muted">
                No entries yet. Choose “Back to Writing” to make your first entry.
              </p>
            </div>

            <div v-else-if="filteredLogs.length === 0" class="py-10 text-center">
              <p class="font-sans text-sm text-muted">
                No entries match “{{ historyQuery.trim() }}”.
              </p>
            </div>

            <div v-else class="history-list">
              <article v-for="log in filteredLogs" :key="log._id" class="journal-entry">
                <div
                  class="entry-sheet notebook-page"
                  :class="{ 'has-drawing': log.drawing?.items?.length }"
                >
                  <header class="entry-metadata">
                    <time :datetime="log.createdAt">{{ formatDate(log.createdAt) }}</time>
                    <span class="entry-emotion">
                      <MoodFace :mood="log.mood" class="emotion-sketch" />
                      {{ log.mood }}
                    </span>
                  </header>
                  <p>{{ log.journal || 'No written reflection.' }}</p>
                  <JournalDrawingNote
                    v-if="log.drawing?.items?.length"
                    :drawing="log.drawing"
                    :label="'Drawing from ' + formatDate(log.createdAt)"
                  />
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>

      <div v-show="!showHistory" class="writing-extras">
        <!-- The canvas stays folded away until someone wants to draw. -->
        <details
          class="drawing-disclosure"
          :open="showDrawing"
          @toggle="showDrawing = $event.target.open"
        >
          <summary>
            <span class="disclosure-text">
              <span id="journal-canvas-heading" class="section-title">Add a Drawing</span>
              <span class="body-text text-muted">Can't describe your thoughts? Draw it.</span>
            </span>
            <span class="disclosure-optional">Optional</span>
            <svg class="disclosure-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <section class="drawing-section" aria-labelledby="journal-canvas-heading">
            <JournalCanvas v-model="drawingData" />
          </section>
        </details>
        <div class="save-row">
          <UButton
            form="daily-journal-form"
            type="submit"
            color="primary"
            class="glass-action rounded-full font-sans"
            :disabled="!canSave"
            :loading="isSaving"
          >
            Save Entry
          </UButton>
        </div>
        <p v-if="saveStatus" role="status" class="mt-4">{{ saveStatus }}</p>
        <p v-if="saveError" role="alert" class="mt-4 text-sm text-error">
          {{ saveError }} Your entry is still here so you can retry.
        </p>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.daily-mood-page {
  display: flex;
  min-height: calc(100vh - 76px);
  flex-direction: column;
  background: var(--ui-bg);
}

/* The same width and edges as the other pages, so the title lines up. */
.daily-mood-content {
  width: var(--page-width);
  margin-inline: auto;
  padding-block: var(--page-top) var(--page-bottom);
}

.journal-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 24px;
  margin-bottom: 36px;
}
.history-toggle.glass-secondary {
  --button-top: color-mix(in srgb, var(--color-peach) 55%, white);
  --button-base: var(--color-peach);
  --button-ink: var(--color-brand-950);
  min-height: 44px;
  color: var(--ui-primary);
  box-shadow: none !important;
  font: 600 0.9rem var(--font-sans);
  cursor: pointer;
  flex-shrink: 0;
}
.history-toggle:hover {
  text-decoration: underline;
}
.history-clock {
  width: 22px;
  height: 22px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.history-toggle:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 4px;
}
.journal-column .sub-header {
  font-size: 1.15rem;
}
.writing-extras {
  margin-top: 24px;
}
.drawing-disclosure {
  margin-top: 40px;
}
.drawing-disclosure summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-radius: 16px;
  list-style: none;
  cursor: pointer;
}
.drawing-disclosure summary::-webkit-details-marker {
  display: none;
}
.drawing-disclosure summary:hover {
  background: color-mix(in srgb, var(--ui-primary) 6%, transparent);
}
.drawing-disclosure summary:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.disclosure-text {
  display: grid;
  flex: 1;
  gap: 2px;
}
.disclosure-optional {
  color: var(--ui-text-muted);
  font: 400 0.85rem var(--font-sans);
}
.disclosure-chevron {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 200ms ease;
}
.drawing-disclosure[open] .disclosure-chevron {
  transform: rotate(180deg);
}
.drawing-section {
  padding: 0 0 20px;
}
@media (prefers-reduced-motion: reduce) {
  .disclosure-chevron {
    transition: none;
  }
}
.save-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 28px;
}
@media (max-width: 600px) {
  .journal-header {
    flex-direction: column;
    gap: 12px;
  }
}
.mood-option {
  --mood-color: #cd6651;
  --mood-text: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 0.55rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.94);
  border-radius: 9999px;
  color: #292321;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.52)),
    linear-gradient(180deg, #fff, #f0ece9);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.98),
    inset 0 -2px 4px rgba(86, 65, 55, 0.12),
    0 3px 8px rgba(59, 43, 35, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.button-mood-face {
  width: 34px;
  height: 34px;
  flex: none;
  transform-origin: center;
}
.mood-option--sad {
  --mood-color: #4389d1;
}
.mood-option--happy {
  --mood-color: #f2c335;
  --mood-text: #30261d;
}
.mood-option--relaxed {
  --mood-color: #998ba1;
}
.mood-option--anxious {
  --mood-color: #ed8a35;
}
.mood-option--angry {
  --mood-color: #d94a45;
}

.mood-option:hover,
.mood-option:focus-visible,
.mood-option.is-selected {
  border-color: color-mix(in srgb, var(--mood-color), white 55%);
  color: var(--mood-text);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--mood-color), white 48%),
      var(--mood-color) 62%
    ),
    var(--mood-color);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.68),
    inset 0 -3px 5px rgba(55, 34, 25, 0.16),
    0 4px 10px color-mix(in srgb, var(--mood-color), transparent 72%);
  transform: translateY(-1px);
}

.mood-option:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--mood-color), transparent 65%);
  outline-offset: 3px;
}

.mood-option.is-selected {
  box-shadow: 0 0 0 2px #fff;
}

.history-list {
  display: grid;
  gap: 32px;
}
.history-search {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  margin-bottom: 24px;
  padding: 0 18px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);
  box-shadow: inset 0 1px 2px rgba(42, 35, 31, 0.06);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.history-search:focus-within {
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-primary) 18%, transparent);
}
.history-search svg {
  width: 20px;
  height: 20px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}
.history-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--ui-text);
  background: transparent;
  font: 0.95rem var(--font-sans);
}
.history-search input::placeholder {
  color: var(--ui-text-muted);
  opacity: 1;
}
.history-search input::-webkit-search-cancel-button {
  cursor: pointer;
}
.journal-entry {
  min-width: 0;
}

.journal-column {
  position: relative;
}
.helper-widget {
  position: absolute;
  right: 12px;
  bottom: 48px;
}
.helper-launcher {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--ui-bg-elevated);
  color: #ed8a35;
  border: 1px solid var(--ui-border);
  box-shadow: none;
  cursor: pointer;
  transition: transform 160ms ease;
}
.helper-launcher:hover {
  transform: translateY(-2px);
}
.helper-launcher img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
.helper-launcher:focus-visible,
.helper-close:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}
.helper-popover {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: min(340px, calc(100vw - 32px));
  padding: 20px;
  color: #fff;
  background: #654ed8;
  border-radius: 16px;
  font-family: var(--font-sans);
}
.helper-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  background: url('/videos/banner-sunset.jpg') center / cover;
}
.helper-liquid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.helper-liquid-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(ellipse 58% 66% at 82% 18%, rgba(189, 135, 255, 0.38), transparent 100%),
    linear-gradient(115deg, rgba(51, 37, 139, 0.7), rgba(90, 52, 164, 0.6));
}
.helper-content {
  position: relative;
  z-index: 2;
}
.helper-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.helper-header h2 {
  font: 600 18px var(--font-sans);
}
.helper-close.glass-icon {
  --button-ink: #fff;
  --button-top: #ca5555;
  --button-base: #a93232;
  width: 44px;
  height: 44px;
  margin: -4px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 50%;
}
.helper-close svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
}
.journal-idea-prompt {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
  color: var(--ui-text);
  font: 14px/1.5 var(--font-sans);
  resize: vertical;
}
.journal-idea-prompt::placeholder {
  color: var(--ui-text-muted);
  opacity: 1;
}
.journal-idea-prompt:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.helper-result {
  margin-top: 16px;
  overflow-wrap: anywhere;
}
.helper-privacy {
  margin-top: 12px;
  font: 12px/1.5 var(--font-sans);
  color: #fff;
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
@media (max-width: 600px) {
  .entry-metadata {
    font-size: 20px;
    gap: 4px 12px;
  }
  .emotion-sketch {
    width: 30px;
    height: 30px;
  }
}

.entry-sheet.has-drawing {
  padding-bottom: 288px;
  min-height: 420px;
}
@media (prefers-reduced-motion: reduce) {
  .helper-launcher {
    transition: none;
  }
}
.notebook-field :deep(textarea),
.notebook-page {
  --notebook-line-height: 36px;
  min-height: 300px;
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
  /* Keep the ruling aligned to each line as long reflections scroll. */
  background-attachment: local;
  box-shadow:
    inset 4px 0 9px #78694d0d,
    0 3px 9px #78694d12;
  color: #313c50;
  caret-color: #7d4737;
  font-family: var(--font-journal);
  font-size: 26px;
  font-weight: 400;
  line-height: var(--notebook-line-height);
  resize: none;
  overflow-wrap: anywhere;
  cursor:
    url('@/assets/images/ink-pen-cursor.svg') 3 29,
    text;
}

.notebook-field :deep(textarea) {
  padding-right: 72px;
}

.notebook-field :deep(textarea::placeholder) {
  color: #687181;
  opacity: 1;
}

.notebook-field :deep(textarea:focus-visible) {
  outline: 2px solid var(--ui-primary);
  outline-offset: 4px;
}

@media (forced-colors: active) {
  .notebook-field :deep(textarea) {
    background-image: none;
    color: FieldText;
    background-color: Field;
    cursor: text;
  }
}
.notebook-page {
  min-height: 144px;
  margin: 0;
  white-space: pre-wrap;
  cursor: auto;
}

@media (max-width: 600px) {
  .daily-mood-page {
    min-height: calc(100vh - 66px);
  }
}
</style>
