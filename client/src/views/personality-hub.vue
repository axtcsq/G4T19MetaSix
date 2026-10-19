<script setup>
import { onMounted, ref } from 'vue'
import { getPersonality, getQuizzes } from '@/api/quiz'
import '@/assets/css/personality-theme.css'
import SiteFooter from '@/components/footer.vue'
import PersonalityBreakdown from '@/components/PersonalityBreakdown.vue'
import ShareCardDialog from '@/components/ShareCardDialog.vue'
import TraitBar from '@/components/TraitBar.vue'
import WaveBackground from '@/components/WaveBackground.vue'
import musicMbtiImage from '@/assets/images/personality/music-mbti.png'
import spotifyHoroscopeImage from '@/assets/images/personality/spotify-horoscope.png'
import auxAlignmentImage from '@/assets/images/personality/aux-alignment.png'
import loveOnRepeatImage from '@/assets/images/personality/love-on-repeat.png'
import soundwoodsImage from '@/assets/images/personality/soundwoods.png'
import musicalNeedsImage from '@/assets/images/personality/musical-needs.png'
import starIcon from '@/assets/images/personality/star.svg'
import daydreamerIcon from '@/assets/images/personality/types/daydreamer.png'
import poetIcon from '@/assets/images/personality/types/poet.png'
import sparkIcon from '@/assets/images/personality/types/spark.png'
import stormChaserIcon from '@/assets/images/personality/types/storm-chaser.png'
import tideKeeperIcon from '@/assets/images/personality/types/tide-keeper.png'
import wandererIcon from '@/assets/images/personality/types/wanderer.png'

// Card images by quiz id, from Unsplash (credits in PersonalityQuiz.md).
// Quizzes without one show the lilac placeholder.
const quizImages = {
  'music-mbti': musicMbtiImage,
  'spotify-horoscope': spotifyHoroscopeImage,
  'aux-alignment': auxAlignmentImage,
  'love-on-repeat': loveOnRepeatImage,
  soundwoods: soundwoodsImage,
  'musical-needs': musicalNeedsImage,
}

// Icons by personality type id. A type without one shows the star.
const typeIcons = {
  'storm-chaser': stormChaserIcon,
  'tide-keeper': tideKeeperIcon,
  poet: poetIcon,
  daydreamer: daydreamerIcon,
  spark: sparkIcon,
  wanderer: wandererIcon,
}

const quizzes = ref([])
const personality = ref(null)
const isLoading = ref(true)
const loadError = ref('')
const shareDialog = ref(null)

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
  <div class="personality-page personality-theme">
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

            <template v-if="quiz.latestResult">
              <p class="latest-result">
                <span class="latest-label">Your result</span>
                <span class="latest-title">{{ quiz.latestResult.title }}</span>
                <span class="latest-subtitle">{{ quiz.latestResult.subtitle }}</span>
              </p>
              <div class="card-actions">
                <RouterLink
                  class="peach-button"
                  :to="{ name: 'personality-result', params: { quizId: quiz.id } }"
                >
                  View result
                </RouterLink>
                <RouterLink
                  class="peach-button peach-button--quiet"
                  :to="{ name: 'personality-quiz', params: { quizId: quiz.id } }"
                >
                  Retake
                </RouterLink>
              </div>
            </template>
            <RouterLink
              v-else
              class="peach-button"
              :to="{ name: 'personality-quiz', params: { quizId: quiz.id } }"
            >
              Get Started
            </RouterLink>
          </li>
        </ul>
      </section>
      <!-- Patterns -->
      <section id="patterns" class="patterns" aria-labelledby="patterns-heading">
        <WaveBackground />
        <div class="page-width py-12">
          <!-- Sits in the corner beside the heading, so the section keeps its size. -->
          <button
            v-if="personality"
            type="button"
            class="share-trigger"
            aria-label="Share my personality card"
            @click="shareDialog.open()"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12" />
              <path d="m7 8 5-5 5 5" />
              <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
            </svg>
            <span class="share-label">Share card</span>
          </button>
          <h2 id="patterns-heading" class="patterns-title">Patterns</h2>
          <p class="body-text patterns-intro">
            Every quiz you take adds a thread. Here we weave your answers from all of them together
            with your Spotify listening to show the habits that keep showing up, and the unqiue
            MetaFor personality they add up to. The more quizzes you take, the clearer the picture
            gets.
          </p>

          <div v-if="!isLoading && !loadError && !personality" class="pattern-card mt-8 p-10">
            <p class="body-text text-center">
              Take a quiz above and we'll start finding the patterns in how you listen.
            </p>
          </div>

          <template v-else-if="personality">
            <div class="pattern-row mt-8">
              <div class="pattern-card type-card">
                <div class="type-header">
                  <img
                    :src="typeIcons[personality.type.id] ?? starIcon"
                    alt=""
                    width="136"
                    height="136"
                    class="type-icon"
                  />
                  <div>
                    <p class="type-intro">You are</p>
                    <p class="type-name">{{ personality.type.name }}</p>
                    <p class="body-text type-tagline">{{ personality.type.tagline }}</p>
                  </div>
                </div>
                <p class="type-meaning">{{ personality.type.description }}</p>
              </div>

              <div class="pattern-card traits-card">
                <TraitBar
                  v-for="trait in personality.traits"
                  :key="trait.id"
                  :trait="trait"
                  compact
                />
              </div>
            </div>

            <div class="insights-row mt-8">
              <div class="pattern-card insights-card">
                <p class="emphasis-text">{{ personality.headline }}</p>
                <ul class="insight-list">
                  <li v-for="insight in personality.insights" :key="insight" class="insight-text">
                    {{ insight }}
                  </li>
                </ul>
                <p v-if="personality.moodLink" class="mood-link insight-text">
                  <span class="mood-label">Mood × music</span>
                  {{ personality.moodLink.text }}
                </p>
                <p class="font-sans text-sm text-(--pq-muted)">
                  {{ personality.type.match }}% match, based on
                  {{ personality.quizResults.length }}
                  {{ personality.quizResults.length === 1 ? 'quiz' : 'quizzes' }} and your
                  listening.
                </p>
              </div>

              <div v-if="personality.sources" class="pattern-card breakdown-card">
                <PersonalityBreakdown :personality="personality" />
              </div>
            </div>

            <ShareCardDialog
              ref="shareDialog"
              :personality="personality"
              :icon="typeIcons[personality.type.id] ?? starIcon"
            />
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
  border: 1px solid var(--pq-border);
  border-radius: 10px;
  background: var(--pq-placeholder);
  box-shadow: 0 4px 4px var(--pq-shadow);
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

.peach-button:hover {
  background: var(--pq-peach-hover);
  transform: translateY(-1px);
}

.peach-button:focus-visible {
  outline: 3px solid var(--pq-focus);
  outline-offset: 3px;
}

.peach-button--quiet {
  color: var(--pq-on-surface);
  background: var(--pq-quiet);
}

.latest-result {
  display: flex;
  flex-direction: column;
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-left: 4px solid var(--pq-accent);
  border-radius: 0 10px 10px 0;
  color: var(--pq-on-surface);
  background: var(--pq-result);
}

.latest-label {
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.latest-title {
  font-family: var(--font-sans);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.25;
}

.latest-subtitle {
  font-family: var(--font-serif);
  font-size: 1.05rem;
}

.card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.patterns {
  position: relative;
  isolation: isolate;
  width: min(1320px, calc(100% - 32px));
  margin-inline: auto;
  border: 1px solid #763e32;
  border-radius: 18px;
  background:
    linear-gradient(117.92deg, rgba(102, 95, 120, 0.2) 2.94%, rgba(118, 62, 50, 0.2) 100%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%),
    linear-gradient(109.07deg, rgba(118, 62, 50, 0.3) 42.18%, rgba(255, 205, 166, 0.3) 91.17%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%), #fff;
  box-shadow: inset 0 9px 6.2px rgba(0, 0, 0, 0.25);
}

/* Content sits above the moving waves. */
.patterns > .page-width {
  position: relative;
  z-index: 1;
}

/* Taken out of the flow and lined up with the heading, so adding it doesn't
   change the section's height. */
.share-trigger {
  position: absolute;
  top: 3rem;
  right: 0;
  display: flex;
  height: 42px;
  align-items: center;
  gap: 0.5rem;
  padding-inline: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition:
    background-color 160ms ease,
    transform 160ms ease;
}

.share-trigger:hover {
  background: rgba(255, 255, 255, 0.26);
  transform: translateY(-1px);
}

.share-trigger:focus-visible {
  outline: 3px solid rgba(255, 205, 166, 0.8);
  outline-offset: 3px;
}

.patterns-title {
  color: #fff;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}

.patterns-intro {
  max-width: 760px;
  margin: 0.5rem auto 0;
  color: #fff;
  text-align: center;
}

.pattern-card {
  overflow: hidden;
  border-radius: 10px;
  color: var(--pq-on-surface);
  background: var(--pq-surface);
  box-shadow: 0 4px 4px var(--pq-shadow);
}

/* Same two equal columns as the row below, so the cards line up. */
.pattern-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 40px;
}

.type-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1.5rem 1.75rem;
}

.type-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.type-icon {
  flex-shrink: 0;
}

.type-intro {
  font-family: var(--font-sans);
  font-size: 1.15rem;
  font-weight: 600;
}

.type-name {
  margin-top: 0.15rem;
  font-family: var(--font-sans);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
}

.type-tagline {
  margin-top: 0.6rem;
}

.type-meaning {
  margin-top: 1.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--pq-line);
  font-family: var(--font-serif);
  font-size: 1.05rem;
  line-height: 1.4;
}

.traits-card {
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 0.5rem;
  padding: 1.5rem 1.75rem;
}

.insight-text {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  line-height: 1.35;
}

.mood-link {
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  background: var(--pq-tint);
}

.mood-label {
  display: block;
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.insights-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 40px;
}

.breakdown-card {
  padding: 1.5rem 1.75rem;
}

/* The text card stretches to the height of the card beside it, so its
   blocks are spread evenly down it rather than bunched at the top. */
.insights-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.75rem;
}

.insight-list {
  display: grid;
  gap: 0.6rem;
}

.summary-text {
  max-width: 1135px;
  padding-block: 3.5rem 4rem;
  color: var(--ui-text);
  text-align: center;
}

@media (max-width: 860px) {
  .pattern-row,
  .insights-row {
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

  .insights-card,
  .breakdown-card,
  .type-card,
  .traits-card {
    padding: 1.25rem;
  }

  .type-header {
    gap: 1rem;
  }

  .type-icon {
    width: 88px;
    height: 88px;
  }

  /* Icon only on phones, so it doesn't crowd the heading. */
  .share-trigger {
    width: 42px;
    justify-content: center;
    padding: 0;
  }

  .share-label {
    display: none;
  }
}
</style>
