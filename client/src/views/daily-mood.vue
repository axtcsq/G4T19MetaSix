<script setup>
import { computed, onMounted, ref } from 'vue'
import { createMood, getMoods } from '@/api/moods'
import { generateJournalIdea } from '@/api/journal'
import SiteFooter from '@/components/layout/footer.vue'
import JournalDrawingNote from '@/components/journal/JournalDrawingNote.vue'
import ButterflyMark from '@/components/layout/ButterflyMark.vue'
import JournalCanvas from '@/components/journal/JournalCanvas.vue'

const showHistory = ref(false)
const showDrawing = ref(false)
const saveStatus = ref('')

const moods = ['Sad', 'Happy', 'Relaxed', 'Anxious', 'Angry']
const selectedMood = ref(null)
const journalEntry = ref('')
const drawingData = ref(null)
const helperAvailable = ref(false)
const helperOpen = ref(false)
const logs = ref([])
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

function moodBadgeClass(mood) {
  return `mood-badge--${mood.toLowerCase()}`
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
          <h1 class="page-title">{{ showHistory ? 'Past entries' : 'Today’s journal' }}</h1>
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
          class="history-toggle"
          :aria-expanded="showHistory"
          aria-controls="past-entries"
          @click="showHistory = !showHistory"
        >
          {{ showHistory ? 'Back to writing' : 'Past entries' }}
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
                  class="mood-option"
                  :class="[
                    `mood-option--${mood.toLowerCase()}`,
                    { 'is-selected': selectedMood === mood },
                  ]"
                  :aria-pressed="selectedMood === mood"
                  @click="selectMood(mood)"
                >
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
                @focus="helperAvailable = true"
                @update:model-value="clearSaveFeedback"
              />
              <p id="journal-help" class="mt-2 text-sm text-muted">
                {{ journalEntry.length }} / 5000 characters. Write a reflection or add a drawing.
              </p>
            </div>
          </form>
          <div v-if="helperAvailable || journalEntry" class="helper-widget">
            <UPopover
              v-model:open="helperOpen"
              :content="{ side: 'top', align: 'end', sideOffset: 12 }"
            >
              <button
                type="button"
                class="helper-launcher"
                aria-label="Open MetaFor helper"
                title="MetaFor helper"
              >
                <ButterflyMark :size="27" />
              </button>
              <template #content>
                <section class="helper-popover" aria-labelledby="helper-title">
                  <header class="helper-header">
                    <h2 id="helper-title">MetaFor helper</h2>
                    <button
                      type="button"
                      class="helper-close"
                      aria-label="Close MetaFor helper"
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
                      >{{ isGeneratingIdea ? 'Thinking…' : 'Find a starting point' }}</UButton
                    >
                  </form>
                  <div v-if="journalIdea" class="helper-result">
                    <p class="body-text">{{ journalIdea }}</p>
                    <UButton type="button" variant="outline" class="mt-3" @click="insertJournalIdea"
                      >Add to my entry</UButton
                    >
                  </div>
                  <p v-if="ideaError" role="alert" class="mt-3 text-sm text-error">
                    {{ ideaError }}
                  </p>
                  <p v-if="ideaStatus" role="status" class="sr-only">{{ ideaStatus }}</p>
                  <p class="helper-privacy">Only this prompt is sent to Groq AI when you ask.</p>
                </section>
              </template>
            </UPopover>
          </div>
        </section>

        <section v-show="showHistory" id="past-entries" aria-label="Past entries">
          <div class="journal-history">
            <p class="history-count text-sm text-muted">
              {{ logs.length }} {{ logs.length === 1 ? 'entry' : 'entries' }}
            </p>

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
                Try again
              </UButton>
            </div>

            <div v-else-if="logs.length === 0" class="py-10 text-center">
              <p class="font-sans text-sm text-muted">
                No entries yet. Choose “Back to writing” to make your first entry.
              </p>
            </div>

            <div v-else class="history-list">
              <article v-for="log in logs" :key="log._id" class="journal-entry">
                <div class="flex items-center justify-between gap-3">
                  <time :datetime="log.createdAt" class="font-sans text-sm text-muted">
                    {{ formatDate(log.createdAt) }}
                  </time>
                  <UBadge :class="['mood-badge', moodBadgeClass(log.mood)]" variant="soft">
                    {{ log.mood }}
                  </UBadge>
                </div>

                <div
                  class="entry-sheet notebook-page"
                  :class="{ 'has-drawing': log.drawing?.items?.length }"
                >
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
        <details
          class="drawing-disclosure"
          :open="showDrawing"
          @toggle="showDrawing = $event.target.open"
        >
          <summary>Add a drawing <span>Optional</span></summary>
          <section class="mt-5" aria-labelledby="journal-canvas-heading">
            <div class="mb-5">
              <h2 id="journal-canvas-heading" class="section-title">Canvas</h2>
              <p class="body-text mt-1 text-muted">Can't describe your thoughts? Draw it.</p>
            </div>
            <JournalCanvas v-model="drawingData" />
          </section>
        </details>
        <div class="save-row">
          <p class="text-sm text-muted">A few words are enough.</p>
          <UButton
            form="daily-journal-form"
            type="submit"
            color="primary"
            class="glass-action rounded-full font-sans"
            :disabled="!canSave"
            :loading="isSaving"
          >
            Save entry
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

.daily-mood-content {
  width: min(820px, var(--page-width));
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
.history-toggle {
  min-height: 44px;
  color: var(--ui-primary);
  font: 600 0.9rem var(--font-sans);
  cursor: pointer;
  flex-shrink: 0;
}
.history-toggle:hover {
  text-decoration: underline;
}
.history-toggle:focus-visible,
summary:focus-visible {
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
  margin-top: 24px;
}
.drawing-disclosure summary {
  cursor: pointer;
  padding-block: 12px;
  font-weight: 600;
}
.drawing-disclosure summary span {
  margin-left: 12px;
  font-size: 0.85rem;
  color: var(--ui-text-muted);
  font-weight: 400;
}
.save-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  min-height: 44px;
  padding: 0.55rem 1.1rem;
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

.history-count {
  margin-bottom: 24px;
}
.history-list {
  display: grid;
  gap: 32px;
}
.journal-entry {
  min-width: 0;
}
.journal-entry > div {
  margin-bottom: 12px;
}
.mood-badge {
  border: 1px solid color-mix(in srgb, var(--mood-color), white 45%);
  color: var(--mood-text) !important;
  background: color-mix(in srgb, var(--mood-color), white 80%) !important;
}

.mood-badge--sad {
  --mood-color: #4389d1;
  --mood-text: #17436d;
}

.mood-badge--happy {
  --mood-color: #f2c335;
  --mood-text: #493713;
}

.mood-badge--relaxed {
  --mood-color: #998ba1;
  --mood-text: #4b4052;
}

.mood-badge--anxious {
  --mood-color: #ed8a35;
  --mood-text: #70400d;
}

.mood-badge--angry {
  --mood-color: #d94a45;
  --mood-text: #762722;
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
  box-shadow: 0 3px 12px #7d47372b;
  cursor: pointer;
  transition: transform 160ms ease;
}
.helper-launcher:hover {
  transform: translateY(-2px);
}
.helper-launcher:focus-visible,
.helper-close:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}
.helper-popover {
  width: min(340px, calc(100vw - 32px));
  padding: 20px;
  color: var(--ui-text);
  background: var(--ui-bg-elevated);
  border-radius: 16px;
  font-family: var(--font-sans);
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
.helper-close {
  width: 44px;
  height: 44px;
  margin: -4px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 50%;
}
.helper-close:hover {
  background: var(--ui-bg-accented);
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
  color: var(--ui-text-muted);
}
.entry-sheet {
  position: relative;
}
.entry-sheet > p {
  margin: 0;
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

.history-toggle {
  color: var(--color-brand-700);
}
:global(.dark .daily-mood-page .history-toggle) {
  color: var(--color-brand-300);
}

@media (max-width: 600px) {
  .daily-mood-page {
    min-height: calc(100vh - 66px);
  }
}
</style>
