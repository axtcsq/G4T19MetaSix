<script setup>
import { computed, onMounted, ref } from 'vue'
import { createMood, getMoods } from '@/api/moods'

const moods = ['Sad', 'Happy', 'Relaxed', 'Anxious', 'Angry']
const selectedMood = ref(null)
const journalEntry = ref('')
const logs = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveStatus = ref('')

const canSave = computed(() => selectedMood.value !== null && !isLoading.value && !isSaving.value)

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
    saveStatus.value = 'Entry saved.'
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
  <div class="mx-auto max-w-7xl px-6 py-12">
    <div class="grid grid-cols-1 gap-12 lg:grid-cols-5">
      <section class="lg:col-span-3">
        <h1 class="font-serif text-4xl text-highlighted">Daily Mood Log</h1>
        <p class="mt-2 font-sans text-muted">How are you feeling today?</p>

        <form class="mt-10" novalidate @submit.prevent="saveEntry">
          <fieldset>
            <legend class="font-sans font-medium">Choose your emotions</legend>
            <div class="mt-4 flex flex-wrap gap-3" role="group" aria-label="Choose a mood">
              <UButton
                v-for="mood in moods"
                :key="mood"
                type="button"
                :color="selectedMood === mood ? 'primary' : 'neutral'"
                :variant="selectedMood === mood ? 'solid' : 'outline'"
                :aria-pressed="selectedMood === mood"
                class="font-sans"
                @click="selectMood(mood)"
              >
                {{ mood }}
              </UButton>
            </div>
          </fieldset>

          <div class="mt-10">
            <label for="journal-entry" class="font-sans font-medium">Tell us about your day</label>
            <UTextarea
              id="journal-entry"
              v-model="journalEntry"
              placeholder="Write your thoughts here..."
              :rows="7"
              maxlength="5000"
              aria-describedby="journal-help"
              class="mt-4 w-full resize-none"
              :ui="{ base: 'w-full font-sans resize-none' }"
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
              class="font-sans"
              :disabled="!canSave"
              :loading="isSaving"
            >
              Save Entry
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
        <div class="rounded-xl border border-default p-5">
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
              color="neutral"
              variant="outline"
              class="mt-4"
              @click="loadEntries"
            >
              Try again
            </UButton>
          </div>

          <div v-else-if="logs.length === 0" class="py-10 text-center">
            <p class="font-sans text-sm text-muted">
              No journal entries yet. Save your first mood above.
            </p>
          </div>

          <div v-else class="max-h-[540px] space-y-3 overflow-y-auto pr-1">
            <article
              v-for="log in logs"
              :key="log._id"
              class="rounded-lg border border-default bg-elevated p-4"
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
  </div>
</template>
