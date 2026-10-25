<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getQuiz, submitQuiz } from '@/api/quiz'
import '@/assets/css/personality-theme.css'
import SiteFooter from '@/components/layout/footer.vue'
import { setPageTitle } from '@/utils/pageTitle'

const route = useRoute()
const router = useRouter()

const quiz = ref(null)
const answers = ref({})
const birthday = ref('')
const currentIndex = ref(0)
const isLoading = ref(true)
const isSubmitting = ref(false)
const loadError = ref('')
const submitError = ref('')

const today = new Date().toISOString().slice(0, 10)

// The birthday, when a quiz needs one, is asked before the questions.
// TODO: read it from the user's profile once accounts are merged, and only
// ask when it's missing.
const steps = computed(() => [
  ...(quiz.value?.needsBirthday ? [{ type: 'birthday', id: 'birthday' }] : []),
  ...(quiz.value?.questions ?? []).map((question) => ({ type: 'question', id: question.id, question })),
])
const currentStep = computed(() => steps.value[currentIndex.value])
const isLastStep = computed(() => currentIndex.value === steps.value.length - 1)
const progress = computed(() =>
  steps.value.length ? Math.round((currentIndex.value / steps.value.length) * 100) : 0,
)
const hasAnsweredCurrent = computed(() => {
  if (!currentStep.value) return false
  if (currentStep.value.type === 'birthday') return Boolean(birthday.value) && birthday.value <= today
  return currentStep.value.id in answers.value
})

async function loadQuiz() {
  isLoading.value = true
  loadError.value = ''

  try {
    quiz.value = await getQuiz(route.params.quizId)
    setPageTitle(quiz.value.title)
  } catch (error) {
    loadError.value = error.message
  } finally {
    isLoading.value = false
  }
}

function selectOption(optionId) {
  answers.value = { ...answers.value, [currentStep.value.id]: optionId }
  submitError.value = ''
}

function goBack() {
  if (currentIndex.value > 0) currentIndex.value -= 1
}

async function goNext() {
  if (!hasAnsweredCurrent.value) return

  if (!isLastStep.value) {
    currentIndex.value += 1
    return
  }

  isSubmitting.value = true
  submitError.value = ''

  try {
    const submission = quiz.value.needsBirthday
      ? { ...answers.value, birthday: birthday.value }
      : answers.value
    await submitQuiz(quiz.value.id, submission)
    router.push({ name: 'personality-result', params: { quizId: quiz.value.id } })
  } catch (error) {
    submitError.value = error.message
    isSubmitting.value = false
  }
}

onMounted(loadQuiz)
</script>

<template>
  <div class="quiz-page personality-theme">
    <main class="mx-auto w-[min(48rem,var(--page-width))] flex-1 pt-(--page-top) pb-(--page-bottom)">
      <RouterLink class="back-link" :to="{ name: 'personality' }">← All quizzes</RouterLink>

      <p v-if="isLoading" role="status" aria-live="polite" class="body-text mt-8 text-muted">
        Preparing your quiz...
      </p>

      <div v-else-if="loadError" role="alert" class="mt-8">
        <p class="text-sm text-error">{{ loadError }}</p>
        <button type="button" class="peach-button mt-4 max-w-[334px]" @click="loadQuiz">
          Try again
        </button>
      </div>

      <template v-else>
        <h1 class="page-title mt-6">{{ quiz.title }}</h1>
        <p class="body-text mt-1 text-(--pq-muted)">{{ quiz.description }}</p>

        <form class="quiz-panel mt-8" novalidate @submit.prevent="goNext">
          <template v-if="steps.length > 1">
            <div class="flex items-center justify-between font-sans text-sm text-muted">
              <span>Step {{ currentIndex + 1 }} of {{ steps.length }}</span>
              <span>{{ progress }}%</span>
            </div>
            <div
              class="progress-rail mt-2"
              role="progressbar"
              :aria-valuenow="progress"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div class="progress-fill" :style="{ width: `${progress}%` }" />
            </div>
          </template>

          <div v-if="currentStep.type === 'birthday'" class="mt-8">
            <label for="birthday" class="sub-header block">When's your birthday?</label>
            <p class="body-text mt-2 text-(--pq-muted)">
              We use it to find your star sign, then read it alongside your Spotify listening.
            </p>
            <input
              id="birthday"
              v-model="birthday"
              type="date"
              class="birthday-input mt-6"
              :max="today"
              min="1900-01-01"
              required
              @input="submitError = ''"
            />
          </div>

          <fieldset v-else class="mt-8">
            <legend class="sub-header">{{ currentStep.question.text }}</legend>
            <div class="mt-6 grid gap-3">
              <button
                v-for="option in currentStep.question.options"
                :key="option.id"
                type="button"
                class="quiz-option"
                :class="{ 'is-selected': answers[currentStep.id] === option.id }"
                :aria-pressed="answers[currentStep.id] === option.id"
                @click="selectOption(option.id)"
              >
                {{ option.text }}
              </button>
            </div>
          </fieldset>

          <p v-if="submitError" role="alert" class="mt-4 text-sm text-error">
            {{ submitError }} Your answers are kept so you can retry.
          </p>

          <div class="mt-8 flex items-center justify-between gap-4">
            <button
              type="button"
              class="back-button"
              :disabled="currentIndex === 0 || isSubmitting"
              @click="goBack"
            >
              Back
            </button>
            <button
              type="submit"
              class="peach-button next-button"
              :disabled="!hasAnsweredCurrent || isSubmitting"
            >
              {{ isSubmitting ? 'Working out your result...' : isLastStep ? 'See my result' : 'Next' }}
            </button>
          </div>
        </form>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.quiz-page {
  display: flex;
  min-height: calc(100vh - 76px);
  flex-direction: column;
  background: var(--ui-bg);
}


.sub-header {
  color: var(--pq-on-surface);
  font-family: var(--font-sans);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
}

.body-text {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  line-height: 1.3;
}

.back-link {
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}

.back-link:hover {
  color: var(--pq-accent);
}

.quiz-panel {
  padding: 1.75rem;
  border: 1px solid var(--pq-border);
  border-radius: 10px;
  color: var(--pq-on-surface);
  background: var(--pq-surface);
  box-shadow: 0 4px 4px var(--pq-shadow);
}

.progress-rail {
  height: 10px;
  overflow: hidden;
  border-radius: 40px;
  background: var(--pq-rail);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--pq-accent);
  transition: width 240ms ease;
}

.quiz-option {
  min-height: 55px;
  padding: 0.75rem 1.1rem;
  border: 1px solid var(--pq-border);
  border-radius: 10px;
  color: var(--pq-on-surface);
  background: var(--pq-surface);
  font-family: var(--font-serif);
  font-size: 1.2rem;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.quiz-option:hover {
  border-color: var(--pq-border-strong);
  transform: translateY(-1px);
}

.quiz-option:focus-visible,
.peach-button:focus-visible,
.back-button:focus-visible {
  outline: 3px solid var(--pq-focus);
  outline-offset: 3px;
}

.quiz-option.is-selected {
  border-color: var(--pq-accent);
  background: var(--pq-peach);
}

.peach-button {
  display: flex;
  min-height: 55px;
  align-items: center;
  justify-content: center;
  padding-inline: 1.5rem;
  border: 1px solid var(--pq-border);
  border-radius: 10px;
  color: var(--pq-on-peach);
  background: var(--pq-peach);
  box-shadow: 0 4px 4px var(--pq-shadow);
  font-family: var(--font-serif);
  font-size: 1.375rem;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 160ms ease;
}

.peach-button:hover:not(:disabled) {
  background: var(--pq-peach-hover);
  transform: translateY(-1px);
}

.peach-button:disabled {
  color: var(--pq-muted);
  background: var(--pq-disabled);
  box-shadow: none;
  cursor: not-allowed;
}

.next-button {
  min-width: 200px;
}

.birthday-input {
  width: min(100%, 320px);
  min-height: 55px;
  padding: 0 1rem;
  border: 1px solid var(--pq-border-strong);
  border-radius: 10px;
  color: var(--pq-on-surface);
  background: var(--pq-surface);
  font-family: var(--font-serif);
  font-size: 1.25rem;
  color-scheme: light;
}

/* Dark date picker in dark mode. */
.dark .birthday-input {
  color-scheme: dark;
}

.birthday-input:focus-visible {
  outline: 3px solid var(--pq-focus);
  outline-offset: 3px;
}

.back-button {
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  color: var(--pq-brown);
  background: transparent;
  font-family: var(--font-sans);
  font-weight: 600;
  cursor: pointer;
}

.back-button:disabled {
  color: var(--pq-muted);
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .quiz-page {
    min-height: calc(100vh - 66px);
  }

  .quiz-panel {
    padding: 1.25rem;
  }


  .sub-header {
    font-size: 1.25rem;
  }

  .next-button {
    min-width: 0;
    flex: 1;
  }
}
</style>
