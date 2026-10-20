<script setup>
import { computed, onMounted, ref } from 'vue'
import { createMood, getMoods } from '@/api/moods'
import SiteFooter from '@/components/footer.vue'

const moods = ['Sad', 'Happy', 'Relaxed', 'Anxious', 'Angry']
const selectedMood = ref(null)
const journalEntry = ref('')
const logs = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveStatus = ref('')

const canSave = computed(
  () =>
    selectedMood.value !== null &&
    journalEntry.value.trim().length > 0 &&
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
  saveStatus.value = ''

  try {
    const savedEntry = await createMood({
      mood: selectedMood.value,
      journal: journalEntry.value.trim(),
    })

    logs.value = [savedEntry, ...logs.value]
    selectedMood.value = null
    journalEntry.value = ''
    saveStatus.value = 'Journal saved.'
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
    <main class="daily-mood-content mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-5">
        <section class="lg:col-span-3">
          <h1 class="font-serif text-4xl text-highlighted">Daily Mood Log</h1>
          <p class="mt-2 font-sans text-muted">How are you feeling today?</p>

          <form class="mt-10" novalidate @submit.prevent="saveEntry">
            <fieldset>
              <legend class="font-sans font-medium">Choose your emotions</legend>
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

            <div class="mt-10">
              <label for="journal-entry" class="font-sans font-medium"
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

            <div class="mt-6 flex flex-wrap items-center gap-4">
              <UButton
                type="submit"
                color="primary"
                class="glass-action rounded-full font-sans"
                :disabled="!canSave"
                :loading="isSaving"
              >
                Save Journal
              </UButton>
              <p v-if="saveStatus" role="status" aria-live="polite" class="text-sm text-muted">
                {{ saveStatus }}
              </p>
            </div>

            <p v-if="saveError" role="alert" class="mt-4 text-sm text-error">
              {{ saveError }} Your entry is still here so you can retry.
            </p>
          </form>
        </section>

        <aside class="lg:col-span-2">
          <div class="journal-history rounded-xl border border-default bg-white p-5">
            <div class="mb-5 flex items-center justify-between gap-3">
              <h2 class="font-serif text-2xl text-highlighted">Journal History</h2>
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
                  <UBadge color="primary" variant="soft">
                    {{ log.mood }}
                  </UBadge>
                </div>

                <p
                  class="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-default"
                >
                  {{ log.journal || 'No written reflection.' }}
                </p>
              </article>
            </div>
          </div>
        </aside>
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
  background: var(--ui-bg-accented);
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
  background: #fff;
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
    url('/images/paper-grain.svg');
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
    url('/images/ink-pen-cursor.svg') 3 29,
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

@media (max-width: 600px) {
  .daily-mood-page {
    min-height: calc(100vh - 66px);
  }
}
</style>
