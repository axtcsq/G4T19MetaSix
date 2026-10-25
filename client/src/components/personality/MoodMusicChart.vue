<script setup>
import { computed } from 'vue'

// Two weeks of how the user felt next to how happy their music sounded, from
// /api/quiz/mood-music. moodLink is Patterns' one-line comparison, used when
// no day has both a mood and plays yet.
const props = defineProps({
  data: { type: Object, required: true },
  moodLink: { type: Object, default: null },
})

// The same mood colours as Daily Mood.
const MOOD_COLORS = {
  Sad: '#4389d1',
  Happy: '#f2c335',
  Relaxed: '#998ba1',
  Anxious: '#ed8a35',
  Angry: '#d94a45',
}

const days = computed(() =>
  props.data.days.map((day) => {
    const date = new Date(`${day.date}T00:00:00`)
    return {
      ...day,
      dayNumber: date.getDate(),
      label: date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }),
    }
  }),
)

const loggedMoods = computed(() => Object.keys(MOOD_COLORS).filter((mood) => days.value.some((day) => day.mood === mood)))

const summary = computed(() => {
  const matches = [...props.data.byMood].sort((a, b) => b.days - a.days).slice(0, 2)
  if (matches.length) {
    const [first, second] = matches
    const lead = `On ${first.mood} days your music averaged ${first.happiness}% happiness`
    return second ? `${lead}, and on ${second.mood} days ${second.happiness}%.` : `${lead}.`
  }
  return props.moodLink?.text ?? "Log your mood on days you listen, and you'll see how the two line up here."
})

function describe(day) {
  const mood = day.mood ? `felt ${day.mood}` : 'no mood logged'
  const music = day.happiness === null ? 'no plays' : `music ${day.happiness}% happy`
  return `${day.label}: ${mood}, ${music}`
}
</script>

<template>
  <div class="mood-music">
    <div class="mood-copy">
      <h3 class="sub-header">Mood × Music</h3>
      <p class="insight-text mt-2">{{ summary }}</p>
      <p class="legend" aria-hidden="true">
        <span class="legend-item"><span class="legend-bar" /> How happy your music sounded</span>
        <span v-for="mood in loggedMoods" :key="mood" class="legend-item">
          <span class="legend-dot" :style="{ background: MOOD_COLORS[mood] }" /> {{ mood }}
        </span>
      </p>
    </div>

    <ol class="chart" aria-label="The last two weeks, day by day">
      <li v-for="day in days" :key="day.date" class="chart-day">
        <span class="sr-only">{{ describe(day) }}</span>
        <span
          class="mood-dot"
          :class="{ 'is-empty': !day.mood }"
          :style="day.mood ? { background: MOOD_COLORS[day.mood] } : null"
          :title="day.mood ?? undefined"
          aria-hidden="true"
        />
        <span class="bar-track" :class="{ 'is-empty': day.happiness === null }" aria-hidden="true">
          <span
            v-if="day.happiness !== null"
            class="bar"
            :style="{ height: `${Math.max(day.happiness, 4)}%` }"
            :title="`${day.happiness}% happy`"
          />
        </span>
        <span class="day-number" aria-hidden="true">{{ day.dayNumber }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* A wide, short card: the words on the left and the chart on the right. */
.mood-music {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
  align-items: center;
  gap: 2.5rem;
}

.chart {
  display: grid;
  grid-template-columns: repeat(14, minmax(0, 1fr));
  gap: 8px;
}

.chart-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.mood-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.mood-dot.is-empty {
  border: 1px dashed var(--pq-border-strong);
}

.bar-track {
  display: flex;
  width: 100%;
  height: 80px;
  align-items: flex-end;
  overflow: hidden;
  border-radius: 6px;
  background: var(--pq-rail);
}

/* A day without plays is an outline, so it doesn't read as a full bar. */
.bar-track.is-empty {
  border: 1px dashed var(--pq-border-strong);
  background: transparent;
}

.bar {
  width: 100%;
  border-radius: 6px;
  background: var(--pq-accent);
}

.day-number {
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.75rem;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 1rem;
  color: var(--pq-muted);
  font-family: var(--font-sans);
  font-size: 0.8rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-bar {
  width: 10px;
  height: 14px;
  border-radius: 3px;
  background: var(--pq-accent);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.insight-text {
  font-family: var(--font-serif);
  font-size: var(--text-body);
  line-height: 1.4;
}

@media (max-width: 1000px) {
  .mood-music {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
}

@media (max-width: 600px) {
  .chart {
    gap: 3px;
  }

  .bar-track {
    height: 64px;
  }

  .mood-dot {
    width: 9px;
    height: 9px;
  }
}
</style>
