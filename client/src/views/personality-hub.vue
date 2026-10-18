<script setup>
import { onMounted, ref } from 'vue'
import { getPersonality, getQuizzes } from '@/api/quiz'
import SiteFooter from '@/components/footer.vue'
import TraitBar from '@/components/TraitBar.vue'
import musicMbtiImage from '@/assets/images/personality/music-mbti.png'
import starIcon from '@/assets/images/personality/star.svg'

// Card images by quiz id. Quizzes without one show the lilac placeholder.
const quizImages = {
  'music-mbti': musicMbtiImage,
}

const quizzes = ref([])
const personality = ref(null)
const isLoading = ref(true)
const loadError = ref('')

async function loadPage() {
  isLoading.value = true
  loadError.value = ''

  try {
    const [quizList, profile] = await Promise.all([getQuizzes(), getPersonality()])
    quizzes.value = quizList
    personality.value = profile
  } catch (error) {
    loadError.value = error.message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPage)
</script>

<template>
  <div class="personality-page">
    <main class="flex-1">
      <section class="page-width pt-12 pb-16">
        <h1 class="page-title">Find Your Personality</h1>
        <p class="body-text mt-1">A light-hearted and easier way to understand yourself.</p>

        <p v-if="isLoading" role="status" aria-live="polite" class="body-text mt-10 text-muted">
          Loading quizzes...
        </p>

        <div v-else-if="loadError" role="alert" class="mt-10">
          <p class="text-sm text-error">{{ loadError }}</p>
          <button type="button" class="peach-button mt-4 max-w-[334px]" @click="loadPage">
            Try again
          </button>
        </div>

        <ul v-else class="quiz-grid mt-8">
          <li v-for="quiz in quizzes" :key="quiz.id" class="quiz-card">
            <div class="quiz-image">
              <img v-if="quizImages[quiz.id]" :src="quizImages[quiz.id]" alt="" />
            </div>
            <h2 class="quiz-title">{{ quiz.title }}</h2>
            <p class="body-text quiz-description">{{ quiz.description }}</p>
            <RouterLink
              v-if="quiz.available"
              class="peach-button"
              :to="{ name: 'personality-quiz', params: { quizId: quiz.id } }"
            >
              {{ quiz.taken ? 'Retake' : 'Get Started' }}
            </RouterLink>
            <button v-else type="button" class="peach-button" disabled>Coming soon</button>
          </li>
        </ul>
      </section>

      <section class="patterns" aria-labelledby="patterns-heading">
        <div class="page-width py-12">
          <h2 id="patterns-heading" class="patterns-title">Patterns</h2>
          <p class="body-text text-center text-white">
            Through your personality test, this is what we observed about you...
          </p>

          <div v-if="!isLoading && !loadError && !personality" class="pattern-card mt-8 p-10">
            <p class="body-text text-center">
              Take a quiz above and we'll start finding the patterns in how you listen.
            </p>
          </div>

          <template v-else-if="personality">
            <div class="pattern-row mt-8">
              <div class="pattern-card type-card">
                <p class="type-intro">You are a</p>
                <img :src="starIcon" alt="" width="144" height="144" class="type-icon" />
                <p class="type-name">{{ personality.type.name }}</p>
                <p class="body-text">{{ personality.type.tagline }}</p>
              </div>

              <div class="pattern-card traits-card">
                <TraitBar v-for="trait in personality.traits" :key="trait.id" :trait="trait" />
              </div>
            </div>

            <div class="pattern-card insights-card mt-8">
              <p class="emphasis-text">{{ personality.headline }}</p>
              <ul class="mt-4 space-y-3">
                <li v-for="insight in personality.insights" :key="insight" class="body-text">
                  {{ insight }}
                </li>
              </ul>
              <p class="mt-5 font-sans text-sm text-[#665f78]">
                {{ personality.type.match }}% match. You're also close to
                {{ personality.runnerUp.name }} ({{ personality.runnerUp.match }}%). Based on
                {{ personality.quizzesTaken.length }}
                {{ personality.quizzesTaken.length === 1 ? 'quiz' : 'quizzes' }} and your
                listening.
              </p>
            </div>
          </template>
        </div>
      </section>

      <p v-if="personality" class="page-width body-text summary-text">
        {{ personality.summary }}
      </p>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.personality-page {
  display: flex;
  min-height: calc(100vh - 76px);
  flex-direction: column;
  background: var(--ui-bg);
}

.page-width {
  width: min(1210px, calc(100% - 48px));
  margin-inline: auto;
}

.page-title {
  color: var(--ui-text);
  font-size: 2rem;
  font-weight: 700;
}

.body-text {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  line-height: 1.3;
}

.emphasis-text {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
}

.quiz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 58px clamp(24px, 7vw, 97px);
}

.quiz-card {
  display: flex;
  flex-direction: column;
}

.quiz-image {
  height: 212px;
  overflow: hidden;
  border: 1px solid rgba(118, 62, 50, 0.2);
  border-radius: 10px;
  background: #b3a6b8;
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
}

.quiz-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.quiz-title {
  margin-top: 0.75rem;
  color: var(--ui-text);
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: normal;
}

.quiz-description {
  flex: 1;
  margin-top: 0.25rem;
}

.peach-button {
  display: flex;
  width: 100%;
  min-height: 55px;
  align-items: center;
  justify-content: center;
  margin-top: 0.75rem;
  border: 1px solid rgba(118, 62, 50, 0.2);
  border-radius: 10px;
  color: #000;
  background: rgba(255, 205, 166, 0.5);
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
  font-family: var(--font-serif);
  font-size: 1.375rem;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 160ms ease;
}

.peach-button:hover:not(:disabled) {
  background: rgba(255, 205, 166, 0.85);
  transform: translateY(-1px);
}

.peach-button:focus-visible {
  outline: 3px solid rgba(206, 91, 75, 0.45);
  outline-offset: 3px;
}

.peach-button:disabled {
  color: #665f78;
  background: rgba(179, 166, 184, 0.25);
  box-shadow: none;
  cursor: not-allowed;
}

.patterns {
  border: 1px solid #763e32;
  border-radius: 18px;
  background:
    linear-gradient(117.92deg, rgba(102, 95, 120, 0.2) 2.94%, rgba(118, 62, 50, 0.2) 100%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%),
    linear-gradient(109.07deg, rgba(118, 62, 50, 0.3) 42.18%, rgba(255, 205, 166, 0.3) 91.17%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%),
    #fff;
  box-shadow: inset 0 9px 6.2px rgba(0, 0, 0, 0.25);
}

.patterns-title {
  color: #fff;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}

.pattern-card {
  color: #000;
  background: #fff;
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
}

.pattern-row {
  display: grid;
  grid-template-columns: minmax(0, 321px) minmax(0, 1fr);
  gap: 40px;
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem 1rem 1.5rem;
  text-align: center;
}

.type-intro {
  font-family: var(--font-sans);
  font-size: 1.5rem;
  font-weight: 600;
}

.type-icon {
  margin-top: 0.75rem;
}

.type-name {
  margin-top: 0.5rem;
  font-family: var(--font-sans);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
}

.traits-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem 3.25rem;
}

.insights-card {
  min-height: 226px;
  padding: 1.75rem 2rem;
}

.summary-text {
  max-width: 1135px;
  padding-block: 3.5rem 4rem;
  color: var(--ui-text);
  text-align: center;
}

@media (max-width: 860px) {
  .pattern-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .traits-card {
    padding: 1.25rem;
  }
}

@media (max-width: 600px) {
  .personality-page {
    min-height: calc(100vh - 66px);
  }

  .page-width {
    width: calc(100% - 32px);
  }

  .quiz-title,
  .page-title,
  .patterns-title,
  .type-name {
    font-size: 1.6rem;
  }

  .body-text,
  .emphasis-text {
    font-size: 1.1rem;
  }

  .insights-card {
    padding: 1.25rem;
  }
}
</style>
