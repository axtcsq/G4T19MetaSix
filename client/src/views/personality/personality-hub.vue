<script setup>
import { computed, onMounted, ref } from 'vue'
import { getMoodMusic, getPersonality, getQuizzes } from '@/api/quiz'
import '@/assets/css/personality-theme.css'
import { typeIcon } from '@/utils/typeIcons'
import SiteFooter from '@/components/layout/footer.vue'
import PersonalityBreakdown from '@/components/personality/PersonalityBreakdown.vue'
import ShareCardDialog from '@/components/personality/ShareCardDialog.vue'
import MoodMusicChart from '@/components/personality/MoodMusicChart.vue'
import TraitBar from '@/components/personality/TraitBar.vue'
import WaveBackground from '@/components/personality/WaveBackground.vue'
import musicMbtiImage from '@/assets/images/personality/music-mbti.png'
import spotifyHoroscopeImage from '@/assets/images/personality/spotify-horoscope.png'
import auxAlignmentImage from '@/assets/images/personality/aux-alignment.png'
import loveOnRepeatImage from '@/assets/images/personality/love-on-repeat.png'
import soundwoodsImage from '@/assets/images/personality/soundwoods.png'
import musicalNeedsImage from '@/assets/images/personality/musical-needs.png'

// Card images by quiz id, from Unsplash (credits in docs/PersonalityQuiz.md).
// Quizzes without one show the lilac placeholder.
const quizImages = {
  'music-mbti': musicMbtiImage,
  'spotify-horoscope': spotifyHoroscopeImage,
  'aux-alignment': auxAlignmentImage,
  'love-on-repeat': loveOnRepeatImage,
  soundwoods: soundwoodsImage,
  'musical-needs': musicalNeedsImage,
}

const quizzes = ref([])
const personality = ref(null)
const moodMusic = ref(null)
const isLoading = ref(true)
const loadError = ref('')
// Patterns loads on its own, since its AI write-up can take a few seconds and
// the quizzes shouldn't wait for it.
const patternsLoading = ref(true)
const patternsError = ref('')
const shareDialog = ref(null)
// The quiz whose Retake is waiting to be confirmed.
const confirmingRetake = ref(null)

const takenCount = computed(() => quizzes.value.filter((quiz) => quiz.latestResult).length)
const progressNudge = computed(() => {
  const left = quizzes.value.length - takenCount.value
  if (!takenCount.value) return 'Take one to meet your MetaFor type.'
  if (left) return `${left} more for a sharper match.`
  return 'Your match is as sharp as it gets.'
})
// Where the empty Patterns card sends a new user.
const firstQuiz = computed(() => quizzes.value.find((quiz) => !quiz.latestResult) ?? quizzes.value[0])

// Scores this close to 0 don't lean either way (the same as How It Adds Up).
const BALANCED = 0.05

// What each source said about one trait, for the explanation under its bar.
function traitSources(trait) {
  return (personality.value.sources ?? []).map((source) => {
    const score = source.traits[trait.id]
    const leaning =
      typeof score !== 'number' || Math.abs(score) < BALANCED
        ? 'no lean either way'
        : `leans ${score > 0 ? trait.firstPoleName : trait.secondPoleName}`
    return { id: source.id, label: source.label, leaning }
  })
}

async function loadPatterns() {
  patternsLoading.value = true
  patternsError.value = ''

  try {
    const [profile, mood] = await Promise.all([getPersonality(), getMoodMusic()])
    personality.value = profile
    moodMusic.value = mood
  } catch (error) {
    patternsError.value = error.message
  } finally {
    patternsLoading.value = false
  }
}

async function loadPage() {
  isLoading.value = true
  loadError.value = ''
  loadPatterns()

  try {
    quizzes.value = await getQuizzes()
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
      <section class="page-width hub-intro pb-16">
        <!-- The title on the left, and quiz progress beside it. -->
        <div class="hub-header">
          <div>
            <h1 class="page-title">Find Your Personality</h1>
            <p class="body-text mt-1 text-(--pq-muted)">A light-hearted and easier way to understand yourself.</p>
          </div>

          <!-- A quiet line of text, and one thin segment per quiz under it. -->
          <div
            v-if="!isLoading && quizzes.length"
            class="quiz-progress"
            role="progressbar"
            :aria-valuenow="takenCount"
            aria-valuemin="0"
            :aria-valuemax="quizzes.length"
            :aria-label="`${takenCount} of ${quizzes.length} quizzes taken`"
          >
            <p class="progress-text">
              <strong>{{ takenCount }} of {{ quizzes.length }}</strong> quizzes taken · {{ progressNudge }}
            </p>
            <ol class="progress-steps" aria-hidden="true">
              <li
                v-for="quiz in quizzes"
                :key="quiz.id"
                :class="{ 'is-done': quiz.latestResult }"
                :title="quiz.title"
              />
            </ol>
          </div>
        </div>

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
              <div v-if="confirmingRetake === quiz.id" class="retake-confirm" role="group" :aria-label="`Retake ${quiz.title}?`">
                <p class="retake-question">
                  Retaking replaces your {{ quiz.latestResult.title }} result.
                </p>
                <div class="card-actions">
                  <RouterLink
                    class="peach-button"
                    :to="{ name: 'personality-quiz', params: { quizId: quiz.id } }"
                  >
                    Retake
                  </RouterLink>
                  <button type="button" class="peach-button peach-button--quiet" @click="confirmingRetake = null">
                    Cancel
                  </button>
                </div>
              </div>
              <div v-else class="card-actions card-actions--retry">
                <RouterLink
                  class="peach-button"
                  :to="{ name: 'personality-result', params: { quizId: quiz.id } }"
                >
                  View result
                </RouterLink>
                <button
                  type="button"
                  class="peach-button peach-button--quiet retry-button"
                  :aria-label="`Retake ${quiz.title}`"
                  title="Retake"
                  @click="confirmingRetake = quiz.id"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </svg>
                </button>
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
          <!-- Sits in the corner above the heading, so the section keeps its size. -->
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
            with your Spotify listening to show the habits that keep showing up, and the unique
            MetaFor personality they add up to. The more quizzes you take, the clearer the picture
            gets.
          </p>

          <div v-if="patternsLoading" class="pattern-card patterns-loading mt-8" role="status">
            <p class="sub-header">Reading your patterns…</p>
            <p class="body-text mt-1">Weaving your quiz answers together with your listening.</p>
            <span class="skeleton-line" aria-hidden="true" />
            <span class="skeleton-line is-short" aria-hidden="true" />
          </div>

          <div v-else-if="patternsError" class="pattern-card patterns-empty mt-8" role="alert">
            <p class="body-text">Your patterns couldn't load: {{ patternsError }}</p>
            <button type="button" class="peach-button empty-button" @click="loadPatterns">Try again</button>
          </div>

          <div v-else-if="!personality" class="pattern-card patterns-empty mt-8">
            <svg
              class="empty-icon"
              viewBox="0 0 24 24"
              width="64"
              height="64"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
            <p class="sub-header">Meet your MetaFor type</p>
            <p class="body-text">
              Take a quiz and we'll start finding the patterns in how you listen, then match you
              with one of six MetaFor personalities.
            </p>
            <RouterLink
              v-if="firstQuiz"
              class="peach-button empty-button"
              :to="{ name: 'personality-quiz', params: { quizId: firstQuiz.id } }"
            >
              Start with {{ firstQuiz.title }}
            </RouterLink>
          </div>

          <template v-else-if="personality">
            <div class="pattern-row mt-8">
              <div class="pattern-card type-card">
                <div class="type-header">
                  <img
                    :src="typeIcon(personality.type.id)"
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
                <p class="traits-hint">Tap a trait to see what shaped it.</p>
                <details v-for="trait in personality.traits" :key="trait.id" class="trait-details">
                  <summary>
                    <TraitBar :trait="trait" compact />
                  </summary>
                  <div class="trait-explain">
                    <p class="insight-text">{{ trait.trait }}</p>
                    <ul v-if="personality.sources" class="trait-sources">
                      <li v-for="source in traitSources(trait)" :key="source.id">
                        <span>{{ source.label }}</span> {{ source.leaning }}
                      </li>
                    </ul>
                  </div>
                </details>
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
                <p v-if="personality.source === 'scoring'" class="fallback-note">
                  These insights come from your scores, as the AI write-up isn't available right
                  now. Check back in a minute.
                </p>
                <p class="match-note font-sans text-sm text-(--pq-muted)">
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

            <!-- A wide, short card: the song, why it was picked, then where to play it. -->
            <div v-if="personality.song" class="pattern-card song-card mt-8">
              <div class="song-body">
                <img
                  v-if="personality.song.imageUrl"
                  :src="personality.song.imageUrl"
                  alt=""
                  width="96"
                  height="96"
                  class="song-art"
                />
                <svg v-else class="song-art song-art--vinyl" viewBox="0 0 112 112" aria-hidden="true">
                  <circle cx="56" cy="56" r="54" />
                  <circle cx="56" cy="56" r="38" class="groove" />
                  <circle cx="56" cy="56" r="26" class="groove" />
                  <circle cx="56" cy="56" r="14" class="label" />
                </svg>
                <div>
                  <h3 class="song-heading">A Song for You</h3>
                  <p class="song-name">{{ personality.song.name }}</p>
                  <p class="song-artist">{{ personality.song.artist }}</p>
                </div>
              </div>
              <p class="insight-text">{{ personality.song.reason }}</p>
              <div class="song-actions">
                <a
                  class="peach-button"
                  :href="`https://open.spotify.com/track/${personality.song.id}`"
                  target="_blank"
                  rel="noopener"
                >
                  Open in Spotify
                </a>
                <RouterLink class="peach-button peach-button--quiet" to="/listen">
                  Listening Room
                </RouterLink>
              </div>
            </div>

            <div v-if="moodMusic" class="pattern-card mood-card mt-8">
              <MoodMusicChart :data="moodMusic" :mood-link="personality.moodLink" />
            </div>

            <ShareCardDialog
              ref="shareDialog"
              :personality="personality"
              :icon="typeIcon(personality.type.id)"
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
  width: var(--page-width);
  margin-inline: auto;
}

.hub-intro {
  padding-top: var(--page-top);
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
  font-size: var(--text-subheader);
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
/* In the card's top corner, above the heading, so it stays clear of the
   title and intro text at every width. */
.share-trigger {
  position: absolute;
  top: 1rem;
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
  font-size: var(--text-header);
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

/* Cards on the band are frosted glass, so the moving waves glow softly through
   them: milky white in light mode, warm espresso in dark mode (plum clashed with
   the waves). The tokens are set on the card so its trait bars and chips follow. */
.patterns .pattern-card {
  --pq-surface: rgba(255, 255, 255, 0.74);
  --pq-tint: rgba(102, 95, 120, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
}

.dark .pattern-card {
  --pq-surface: rgba(38, 25, 27, 0.66);
  --pq-rail: rgba(255, 205, 166, 0.14);
  --pq-peach: rgba(255, 205, 166, 0.12);
  --pq-tint: rgba(255, 205, 166, 0.08);
  --pq-line: rgba(255, 205, 166, 0.14);
  --pq-border-strong: rgba(255, 205, 166, 0.22);
  border: 1px solid rgba(255, 205, 166, 0.16);
}

@media (prefers-reduced-transparency: reduce) {
  .patterns .pattern-card {
    --pq-surface: #fff;
  }

  .dark .pattern-card {
    --pq-surface: #2a1d20;
  }
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

/* The icons are black line art, so they're flipped to light in dark mode. */
.dark .type-icon {
  filter: invert(0.94);
}

.type-intro {
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}

.type-name {
  margin-top: 0.15rem;
  font-family: var(--font-sans);
  font-size: var(--text-header);
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
  font-size: var(--text-body);
  line-height: 1.45;
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
  font-size: var(--text-body);
  line-height: 1.4;
}

/* Explanation under each trait bar, opened by tapping the bar. */
.traits-hint {
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
}

.trait-details summary {
  list-style: none;
  border-radius: 12px;
  cursor: pointer;
}

.trait-details summary::-webkit-details-marker {
  display: none;
}

.trait-details summary:hover {
  background: var(--pq-tint);
}

.trait-details summary:focus-visible {
  outline: 3px solid var(--pq-focus);
  outline-offset: 3px;
}

.trait-explain {
  margin: 0.5rem 0 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--pq-tint);
}

.trait-sources {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.5rem;
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
}

.trait-sources span {
  color: var(--pq-on-surface);
  font-weight: 600;
}

.fallback-note {
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  color: var(--pq-muted);
  background: var(--pq-tint);
  font-family: var(--font-sans);
  font-size: 0.85rem;
}

/* The title on the left, and the progress at the bottom right, level with
   the subtext. */
.hub-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem 3rem;
}

/* Quiet on purpose: muted text and a thin line, no card. */
.quiz-progress {
  width: min(100%, 340px);
}

.progress-text {
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  line-height: 1.35;
}

.progress-text strong {
  color: var(--pq-on-surface);
  font-weight: 600;
}

.progress-steps {
  display: flex;
  gap: 4px;
  margin-top: 0.4rem;
}

.progress-steps li {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--pq-rail);
  transition: background-color 320ms ease;
}

.progress-steps li.is-done {
  background: var(--pq-accent);
}

/* View result takes the room, and Retake is a square icon button beside it. */
.card-actions--retry {
  grid-template-columns: 1fr 55px;
}

.retry-button {
  padding: 0;
}

.retake-confirm {
  margin-top: 0.75rem;
}

.retake-question {
  font-family: var(--font-serif);
  font-size: 1.05rem;
}

/* Patterns while it loads, has no quizzes yet, or fails. */
.patterns-loading,
.patterns-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1.5rem;
  text-align: center;
}

.patterns-empty .body-text {
  max-width: 560px;
}

.empty-icon {
  color: var(--pq-accent);
}

.empty-button {
  max-width: 334px;
}

.skeleton-line {
  width: min(420px, 80%);
  height: 14px;
  margin-top: 0.75rem;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--pq-rail), var(--pq-tint), var(--pq-rail));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-line.is-short {
  width: min(260px, 55%);
  margin-top: 0.25rem;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
  }
}

/* A song for your type, and the mood chart under it: both full-width rows. */
.song-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 300px;
  align-items: center;
  gap: 2rem;
  padding: 1.5rem 1.75rem;
}

.mood-card {
  padding: 1.5rem 1.75rem;
}

.song-heading {
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.song-body {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.song-art {
  flex-shrink: 0;
  border-radius: 10px;
  object-fit: cover;
}

.song-art--vinyl {
  width: 96px;
  height: 96px;
  fill: #2b2422;
}

.song-art--vinyl .groove {
  fill: none;
  stroke: rgba(255, 255, 255, 0.14);
}

.song-art--vinyl .label {
  fill: var(--pq-accent);
}

.song-name {
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
  line-height: 1.25;
}

.song-artist {
  color: var(--pq-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
}

.song-actions {
  display: grid;
  gap: 0.25rem;
}

.insights-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 40px;
}

.breakdown-card {
  padding: 1.5rem 1.75rem;
}

/* The text card stretches to the height of the card beside it. Its text
   stays together at the top and the match note sits at the bottom. */
.insights-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem 1.75rem;
}

.match-note {
  margin-top: auto;
  padding-top: 0.5rem;
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

@media (max-width: 1000px) {
  .pattern-row,
  .insights-row {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .song-card {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  /* The progress drops under the title. */
  .hub-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .song-actions {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .traits-card {
    padding: 1.25rem;
  }
}

@media (max-width: 600px) {
  .personality-page {
    min-height: calc(100vh - 66px);
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

  /* Icon only on phones, so it takes less room. */
  .share-trigger {
    top: 0.75rem;
    width: 42px;
    justify-content: center;
    padding: 0;
  }

  .share-label {
    display: none;
  }
}
</style>
