<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getLatestResult } from '@/api/quiz'
import '@/assets/css/personality-theme.css'
import SiteFooter from '@/components/footer.vue'
import { setPageTitle } from '@/utils/pageTitle'
import TraitBar from '@/components/TraitBar.vue'

const route = useRoute()

const result = ref(null)
const isLoading = ref(true)
const loadError = ref('')

async function loadResult() {
  isLoading.value = true
  loadError.value = ''

  try {
    result.value = await getLatestResult(route.params.quizId)
    setPageTitle(`${result.value.quizTitle} Result`)
  } catch (error) {
    loadError.value = error.message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadResult)
</script>

<template>
  <div class="result-page personality-theme">
    <main class="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <RouterLink class="back-link" :to="{ name: 'personality' }">← All quizzes</RouterLink>

      <p v-if="isLoading" role="status" aria-live="polite" class="body-text mt-8 text-muted">
        Loading your result...
      </p>

      <div v-else-if="loadError" role="alert" class="mt-8">
        <p class="body-text">{{ loadError }}</p>
        <div class="mt-4 flex flex-wrap gap-4">
          <RouterLink
            class="peach-button"
            :to="{ name: 'personality-quiz', params: { quizId: route.params.quizId } }"
          >
            Take the quiz
          </RouterLink>
          <button type="button" class="peach-button peach-button--quiet" @click="loadResult">
            Try again
          </button>
        </div>
      </div>

      <template v-else>
        <p class="quiz-name mt-6">{{ result.quizTitle }}</p>

        <section class="result-panel mt-4" aria-labelledby="result-title">
          <p class="body-text">{{ result.headline }}</p>
          <h1 id="result-title" class="result-title mt-3">{{ result.title }}</h1>
          <p class="sub-header mt-1">{{ result.subtitle }}</p>
          <p class="body-text mt-5">{{ result.description }}</p>

          <h2 class="section-title mt-8">Why We Think So</h2>
          <ul class="mt-3 space-y-2">
            <li v-for="reason in result.justification" :key="reason" class="body-text reason">
              {{ reason }}
            </li>
          </ul>

          <h2 class="section-title mt-8">Your Breakdown</h2>
          <div class="mt-4 space-y-4">
            <template v-for="row in result.breakdown" :key="row.label">
              <div v-if="row.kind === 'scale'">
                <p class="row-label">{{ row.label }}</p>
                <TraitBar :trait="row" />
              </div>

              <div v-else-if="row.kind === 'share'">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="row-label">{{ row.label }}</p>
                  <p class="row-label">{{ row.percent }}%</p>
                </div>
                <div
                  class="share-rail mt-1"
                  role="meter"
                  :aria-label="`${row.label}: ${row.percent}%`"
                  :aria-valuenow="row.percent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div class="share-fill" :style="{ width: `${row.percent}%` }" />
                </div>
              </div>
            </template>

            <dl v-if="result.breakdown.some((row) => row.kind === 'tag')" class="tag-list">
              <div
                v-for="row in result.breakdown.filter((item) => item.kind === 'tag')"
                :key="row.label"
                class="tag"
              >
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
          </div>

          <div class="mt-10 grid gap-4 sm:grid-cols-2">
            <RouterLink class="peach-button" :to="{ name: 'personality', hash: '#patterns' }">
              See your patterns
            </RouterLink>
            <RouterLink
              class="peach-button peach-button--quiet"
              :to="{ name: 'personality-quiz', params: { quizId: result.quizId } }"
            >
              Retake quiz
            </RouterLink>
          </div>
        </section>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.result-page {
  display: flex;
  min-height: calc(100vh - 76px);
  flex-direction: column;
  background: var(--ui-bg);
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

.quiz-name {
  color: var(--ui-text);
  font-family: var(--font-sans);
  font-size: 1.5rem;
  font-weight: 600;
}

.result-panel {
  padding: 2rem;
  border: 1px solid var(--pq-border);
  border-radius: 10px;
  color: var(--pq-on-surface);
  background: var(--pq-surface);
  box-shadow: 0 4px 4px var(--pq-shadow);
}

.result-title {
  color: var(--pq-brown);
  font-family: var(--font-sans);
  font-size: var(--text-title);
  font-weight: 800;
  line-height: 1.1;
}

.sub-header {
  font-family: var(--font-sans);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
}

.body-text {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  line-height: 1.35;
}

.reason {
  position: relative;
  padding-left: 1.25rem;
}

.reason::before {
  position: absolute;
  top: 0.55em;
  left: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pq-accent);
  content: '';
}

.row-label {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
}

.share-rail {
  height: 20px;
  overflow: hidden;
  border-radius: 40px;
  background: var(--pq-rail);
}

.share-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--pq-accent);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tag {
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--pq-border);
  border-radius: 10px;
  background: var(--pq-result);
}

.tag dt {
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
}

.tag dd {
  font-family: var(--font-sans);
  font-size: 1.25rem;
  font-weight: 700;
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

@media (max-width: 600px) {
  .result-page {
    min-height: calc(100vh - 66px);
  }

  .result-panel {
    padding: 1.25rem;
  }

  .sub-header,
  .quiz-name {
    font-size: 1.25rem;
  }

  .body-text,
  .row-label {
    font-size: 1.1rem;
  }
}
</style>
