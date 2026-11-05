<script setup>
import { computed, ref, watch } from 'vue'
import { getMoodInsights } from '@/api/listens'

// Show each day's leading music mood for the month.
const AXES = ['happy', 'relaxed', 'sad', 'angry', 'anxious']
const MOOD_NAME = {
  happy: 'Happy',
  relaxed: 'Relaxed',
  sad: 'Sad',
  anxious: 'Anxious',
  angry: 'Angry',
}
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const today = new Date()
// 0 is this month, -1 the month before, and so on.
const monthOffset = ref(0)
const monthStart = computed(
  () => new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1),
)
const monthName = computed(() =>
  monthStart.value.toLocaleDateString(undefined, {
    month: 'long',
    ...(monthStart.value.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  }),
)
// Monday first, so the first day sits under its weekday.
const offset = computed(() => (monthStart.value.getDay() + 6) % 7)

const days = ref([])
const loading = ref(true)
const error = ref('')
const selectedDate = ref(null)
let loadVersion = 0

const isoDate = (date) => date.toLocaleDateString('en-CA')

async function load() {
  const version = ++loadVersion
  const first = monthStart.value
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const dates = []
  for (const day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
    dates.push({ date: isoDate(day), future: day > today })
  }
  loading.value = true
  error.value = ''
  selectedDate.value = null
  try {
    const insights = await getMoodInsights(isoDate(first), isoDate(last < today ? last : today))
    if (version !== loadVersion) return
    const byDate = new Map(insights.days.map((day) => [day.date, day]))
    days.value = dates.map(({ date, future }) => {
      const day = byDate.get(date)
      const axes = day?.axes ?? {}
      const top = AXES.reduce((best, axis) => ((axes[axis] ?? 0) > (axes[best] ?? 0) ? axis : best))
      return { date, future, plays: day?.listenCount ?? 0, mood: axes[top] > 0 ? top : null }
    })
  } catch (failure) {
    if (version === loadVersion) error.value = failure.message
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
watch(monthOffset, load, { immediate: true })

const busiest = computed(() => Math.max(1, ...days.value.map((day) => day.plays)))
// Quiet days stay visible at a third of the colour.
const strength = (day) => 0.35 + (0.65 * day.plays) / busiest.value

const dayLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
function describe(day) {
  const plays = `${day.plays} ${day.plays === 1 ? 'play' : 'plays'}`
  if (day.mood) return `${dayLabel(day.date)}: mostly ${MOOD_NAME[day.mood]} · ${plays}`
  return `${dayLabel(day.date)}: ${day.plays ? `${plays}, not analysed yet` : 'no plays'}`
}
const readout = computed(() => {
  const day = days.value.find((entry) => entry.date === selectedDate.value)
  return day ? describe(day) : 'Select a day to see its mood.'
})
</script>

<template>
  <div class="month-moods">
    <div class="month-nav">
      <button type="button" aria-label="Previous month" @click="monthOffset--">‹</button>
      <strong aria-live="polite">{{ monthName }}</strong>
      <button
        type="button"
        aria-label="Next month"
        :disabled="monthOffset === 0"
        @click="monthOffset++"
      >
        ›
      </button>
    </div>
    <p v-if="error" class="month-status" role="alert">
      {{ error }}
      <button type="button" class="month-retry" @click="load">Try again</button>
    </p>
    <div v-else class="month-body" :class="{ loading }">
      <div class="month-calendar">
        <div class="month-weekdays" aria-hidden="true">
          <span v-for="(weekday, index) in WEEKDAYS" :key="index">{{ weekday }}</span>
        </div>
        <ol
          :key="monthStart.getTime()"
          class="month-grid"
          :aria-label="`Music moods in ${monthName}`"
        >
          <li
            v-for="(day, index) in days"
            :key="day.date"
            :style="{
              gridColumnStart: index === 0 ? offset + 1 : null,
              '--delay': `${index * 18}ms`,
            }"
          >
            <button
              type="button"
              :class="{ 'has-mood': day.mood, 'has-plays': day.plays }"
              :style="
                day.mood
                  ? { '--mood': `var(--color-mood-${day.mood}-500)`, '--strength': strength(day) }
                  : null
              "
              :disabled="day.future"
              :aria-label="describe(day)"
              :aria-pressed="selectedDate === day.date"
              @pointerenter="selectedDate = day.date"
              @focus="selectedDate = day.date"
              @click="selectedDate = day.date"
            />
          </li>
        </ol>
      </div>
      <div class="month-copy">
        <p class="month-readout" aria-live="polite">{{ readout }}</p>
        <RouterLink class="month-link" to="/calendar">Open the Mood Calendar →</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.month-moods {
  font-family: var(--font-sans);
}
.month-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  font-size: var(--text-label);
}
.month-nav strong {
  min-width: 96px;
  text-align: center;
  font-weight: 600;
}
.month-nav button,
.month-retry {
  display: grid;
  place-items: center;
  min-width: 32px;
  height: 32px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  font-size: var(--text-lead);
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease;
}
.month-retry {
  display: inline-grid;
  padding: 0 12px;
  font-size: var(--text-label);
  font-weight: 600;
}
.month-nav button:hover:not(:disabled),
.month-retry:hover {
  border-color: var(--ui-primary);
  color: var(--ui-primary);
}
.month-nav button:disabled {
  cursor: default;
  opacity: 0.35;
}
.month-body {
  display: grid;
  grid-template-columns: minmax(0, 236px) minmax(0, 1fr);
  align-items: center;
  gap: 28px;
  transition: opacity 200ms ease;
}
.month-body.loading {
  opacity: 0.5;
}
.month-weekdays,
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.month-weekdays {
  margin-bottom: 6px;
  color: var(--ui-text-muted);
  font-size: var(--text-caption);
  text-align: center;
}
/* Each square pops in a moment after the one before. */
.month-grid li {
  animation: square-in 360ms cubic-bezier(0.16, 1, 0.3, 1) var(--delay) backwards;
}
.month-grid button {
  display: block;
  position: relative;
  isolation: isolate;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  background: var(--ui-border);
  cursor: pointer;
  transition: transform 160ms ease;
}
.month-grid button.has-mood::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--mood);
  opacity: var(--strength);
}
.month-grid button.has-plays:not(.has-mood) {
  background: color-mix(in srgb, var(--ui-text-muted) 30%, transparent);
}
.month-grid button:disabled {
  background: none;
  border: 1px dashed var(--ui-border);
  cursor: default;
}
.month-grid button:not(:disabled):is(:hover, [aria-pressed='true']) {
  transform: scale(1.12);
  outline: 2px solid var(--ui-text);
  outline-offset: 1px;
}
.month-grid button:focus-visible,
.month-nav button:focus-visible,
.month-link:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.month-readout,
.month-status {
  min-height: 24px;
  margin: 10px 0 0;
  color: var(--ui-text-muted);
  font-size: var(--text-label);
  line-height: 1.5;
}
.month-link {
  display: inline-block;
  margin-top: 10px;
  color: var(--ui-text-muted);
  font-size: var(--text-label);
  text-decoration: none;
}
.month-link:hover {
  color: var(--ui-primary);
}
@keyframes square-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}
@media (max-width: 560px) {
  .month-body {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .month-calendar {
    max-width: 280px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .month-grid li,
  .month-grid button {
    animation: none;
    transition: none;
  }
}
</style>
