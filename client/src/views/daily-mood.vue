<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { createMood, getMoods } from '@/api/moods'
import { generateJournalIdea } from '@/api/journal'
import SiteFooter from '@/components/layout/footer.vue'
import JournalCanvas from '@/components/journal/JournalCanvas.vue'

const moods = ['Sad', 'Happy', 'Relaxed', 'Anxious', 'Angry']
const selectedMood = ref(null)
const journalEntry = ref('')
const drawingData = ref(null)
const drawingSource = ref('')
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
    selectedMood.value = null
    journalEntry.value = ''
    drawingData.value = null
    drawingSource.value = ''
  } catch (error) {
    saveError.value = error.message
  } finally {
    isSaving.value = false
  }
}

function clearSaveFeedback() {
  saveError.value = ''
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

async function viewDrawing(log) {
  if (!log.drawing?.items?.length) return

  drawingData.value = JSON.parse(JSON.stringify(log.drawing))
  drawingSource.value = `Showing drawing saved on ${formatDate(log.createdAt)}. Saving it again creates a new journal entry.`
  await nextTick()
  document.getElementById('journal-canvas-heading')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

onMounted(loadEntries)
</script>

<template>
  <div class="daily-mood-page">
    <main class="daily-mood-content flex-1 py-12">
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-12">
        <section class="journal-column lg:col-span-2 xl:col-span-6">
          <h1 class="page-title">Daily Mood Log</h1>
          <p class="body-text mt-2 text-muted">How are you feeling today?</p>

          <form
            id="daily-journal-form"
            class="journal-form mt-10"
            novalidate
            @submit.prevent="saveEntry"
          >
            <fieldset>
              <legend class="sub-header">Choose your emotions</legend>
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
              <label for="journal-entry" class="sub-header"
                >Tell us about your day</label
              >
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
                {{ journalEntry.length }} / 5000 characters. Your reflection is optional.
              </p>
            </div>
          </form>
        </section>

        <aside class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:col-span-2 xl:contents">
          <div class="journal-history rounded-xl border border-default bg-white p-5 xl:col-span-3">
            <div class="mb-5 flex items-center justify-between gap-3">
              <h2 class="journal-history-title sub-header">
                <svg
                  aria-hidden="true"
                  class="journal-history-clock"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
                Journal History
              </h2>
              <UBadge color="primary" variant="subtle">
                {{ logs.length }} {{ logs.length === 1 ? 'entry' : 'entries' }}
              </UBadge>
            </div>

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
                No journal entries yet. Save your first journal above.
              </p>
            </div>

            <div v-else class="max-h-[540px] space-y-3 overflow-y-auto pr-1">
              <article
                v-for="log in logs"
                :key="log._id"
                class="journal-entry rounded-lg border border-default p-4"
              >
                <div class="flex items-center justify-between gap-3">
                  <time :datetime="log.createdAt" class="font-sans text-xs text-muted">
                    {{ formatDate(log.createdAt) }}
                  </time>
                  <UBadge :class="['mood-badge', moodBadgeClass(log.mood)]" variant="soft">
                    {{ log.mood }}
                  </UBadge>
                </div>

                <p
                  class="body-text mt-3 whitespace-pre-wrap break-words text-default"
                >
                  {{ log.journal || 'No written reflection.' }}
                </p>
                <button
                  v-if="log.drawing?.items?.length"
                  type="button"
                  class="view-drawing-button mt-3"
                  @click="viewDrawing(log)"
                >
                  View drawing
                </button>
              </article>
            </div>
          </div>

          <section class="journal-idea-card xl:col-span-3" aria-labelledby="journal-idea-heading">
            <video
              class="helper-liquid"
              src="/videos/banner-sunset.mp4"
              poster="/videos/banner-sunset.jpg"
              autoplay
              muted
              loop
              playsinline
              aria-hidden="true"
            />
            <div class="helper-liquid-scrim" aria-hidden="true" />
            <div class="journal-idea-content">
              <h2 id="journal-idea-heading" class="journal-idea-title sub-header">
                <img src="@/assets/images/journal-helper-sparkle.png" alt="" class="journal-helper-icon" />
                Helper
              </h2>
              <p class="mt-2 text-sm text-muted">Need help? Describe what happened today</p>

              <form class="mt-4 space-y-3" @submit.prevent="createJournalIdea">
                <label for="journal-idea-prompt" class="text-sm font-medium text-default">
                  Your prompt
                </label>
                <textarea
                  id="journal-idea-prompt"
                  v-model="ideaPrompt"
                  class="journal-idea-prompt"
                  maxlength="800"
                  rows="3"
                  placeholder="Need help ideating journal? Try writing a prompt to get started."
                  :disabled="isGeneratingIdea"
                  @input="clearJournalIdea"
                ></textarea>
                <div class="flex flex-wrap gap-3">
                  <UButton
                    type="submit"
                    color="primary"
                    class="glass-action rounded-full font-sans"
                    :disabled="!ideaPrompt.trim() || isGeneratingIdea"
                    :loading="isGeneratingIdea"
                  >
                    {{ isGeneratingIdea ? 'Thinking...' : 'Generate idea' }}
                  </UButton>
                  <UButton
                    type="button"
                    color="primary"
                    class="glass-action rounded-full font-sans"
                    :disabled="!journalIdea || isGeneratingIdea"
                    @click="insertJournalIdea"
                  >
                    Insert
                  </UButton>
                </div>
              </form>

              <div
                class="journal-idea-result"
                :class="{ 'is-empty': !journalIdea }"
                role="region"
                aria-label="Generated journal idea"
                aria-live="polite"
              >
                {{ journalIdea || 'Your journal idea will appear here after you generate one.' }}
              </div>

              <p v-if="ideaError" role="alert" class="mt-3 text-sm text-error">
                {{ ideaError }}
              </p>
              <p v-if="ideaStatus" role="status" aria-live="polite" class="mt-3 text-sm text-muted">
                {{ ideaStatus }}
              </p>

              <div class="helper-attribution">
                <p class="text-xs text-muted">
                  Your prompt would be processed by Groq AI. AI usage limit applies.
                </p>
                <img class="groq-mark" src="@/assets/images/groq-logo.svg" alt="Groq" />
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section class="mt-10" aria-labelledby="journal-canvas-heading">
        <div class="mb-5">
          <h2 id="journal-canvas-heading" class="section-title">Canvas</h2>
          <p class="body-text mt-1 text-muted">Can't describe your thoughts? Draw it.</p>
        </div>
        <p v-if="drawingSource" class="mb-3 text-sm text-muted" role="status">
          {{ drawingSource }}
        </p>
        <JournalCanvas v-model="drawingData" />
      </section>

      <div class="mt-6 flex flex-wrap items-center gap-4">
        <UButton
          form="daily-journal-form"
          type="submit"
          color="primary"
          class="glass-action rounded-full font-sans"
          :disabled="!canSave"
          :loading="isSaving"
        >
          Save Journal
        </UButton>
      </div>
      <p v-if="saveError" role="alert" class="mt-4 text-sm text-error">
        {{ saveError }} Your entry is still here so you can retry.
      </p>
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
  width: var(--page-width);
  margin-inline: auto;
}

@media (max-width: 600px) {
  .daily-mood-content {
    width: calc(100% - 48px);
  }
}

@media (min-width: 1280px) {
  .journal-column {
    display: flex;
    flex-direction: column;
  }

  .journal-form {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .journal-field-group {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .journal-field-group .notebook-field {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .journal-field-group .notebook-field :deep(textarea) {
    flex: 1;
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

.journal-history {
  background: var(--ui-bg-elevated);
}

.journal-history h2 {
  color: var(--ui-text);
}

.journal-history-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.journal-history-clock {
  width: 1.15em;
  height: 1.15em;
  flex: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
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

.journal-idea-card {
  position: relative;
  overflow: hidden;
  padding: 20px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background:
    radial-gradient(ellipse at 85% 15%, rgba(207, 156, 255, 0.95), transparent 48%),
    linear-gradient(125deg, #654ed8, #9160e7 58%, #aa79e9);
  box-shadow: 0 5px 16px rgba(59, 43, 35, 0.05);
}

.helper-liquid,
.helper-liquid-scrim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.helper-liquid {
  z-index: 0;
  object-fit: cover;
}

.helper-liquid-scrim {
  z-index: 1;
  background:
    radial-gradient(ellipse 58% 66% at 82% 18%, rgba(189, 135, 255, 0.38), transparent 100%),
    linear-gradient(115deg, rgba(51, 37, 139, 0.5), rgba(90, 52, 164, 0.28));
}

.journal-idea-content {
  position: relative;
  z-index: 2;
}

.journal-idea-content .text-muted,
.journal-idea-content .text-default {
  color: rgba(255, 255, 255, 0.94);
}

.journal-idea-content .text-error {
  color: #ffe1df;
}

.journal-idea-content h2 {
  color: #fff;
}

.journal-idea-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.journal-helper-icon {
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
}

.journal-idea-prompt {
  display: block;
  width: 100%;
  min-height: 90px;
  padding: 12px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  color: var(--ui-text);
  background: var(--ui-bg);
  font: 0.92rem/1.5 var(--font-sans);
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

.journal-idea-prompt:disabled {
  opacity: 0.7;
  cursor: wait;
}

.journal-idea-result {
  display: flex;
  width: 100%;
  min-height: 120px;
  margin-top: 14px;
  padding: 12px 14px;
  align-items: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-left: 4px solid #a77cf0;
  border-radius: 12px;
  color: #312943;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 5px 16px rgba(39, 26, 72, 0.14);
  font: 0.92rem/1.5 var(--font-sans);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.journal-idea-result.is-empty {
  color: #756d82;
  font-style: italic;
}

.helper-attribution {
  margin-top: 1.1rem;
  text-align: center;
}

.groq-mark {
  display: block;
  width: 3.75rem;
  height: auto;
  margin: 0.65rem auto 0;
}

.notebook-field :deep(textarea) {
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
.journal-entry {
  background: var(--ui-bg);
}

.view-drawing-button {
  padding: 0;
  border: 0;
  color: var(--ui-primary);
  background: transparent;
  font: 600 0.82rem var(--font-sans);
  cursor: pointer;
}

.view-drawing-button:hover {
  text-decoration: underline;
}

@media (max-width: 600px) {
  .daily-mood-page {
    min-height: calc(100vh - 66px);
  }
}
</style>
