<script setup>
import { computed, ref } from 'vue'
const props = defineProps({
  type: { type: String, required: true },
  data: { type: Object, required: true },
})
const peakHour = computed(() => props.data.hourly.indexOf(Math.max(...props.data.hourly)))
const formatHour = (i) => `${i % 12 || 12} ${i < 12 ? 'am' : 'pm'}`
const dailyMaximum = computed(() => Math.max(1, ...props.data.daily.map((day) => day.value)))
const selectedDay = ref(null)
const selectedHour = ref(null)
const dayReadout = computed(() => props.data.daily.find((day) => day.date === selectedDay.value))
const calendarOffset = computed(
  () => (new Date(`${props.data.daily[0]?.date}T00:00:00`).getDay() + 6) % 7,
)
const repeatTotal = computed(() =>
  props.data.repeatListening.reduce((sum, item) => sum + item.value, 0),
)
</script>
<template>
  <div class="listening-chart" :class="`chart-${type}`">
    <template v-if="type === 'days'">
      <p class="chart-explanation">Plays by date in the returned Spotify history.</p>
      <template v-if="data.period === 'monthly'">
        <div class="calendar-weekdays" aria-hidden="true">
          <span v-for="(day, index) in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="index">{{
            day
          }}</span>
        </div>
        <ol class="play-calendar" aria-label="Recorded plays by date">
          <li
            v-for="(point, index) in data.daily"
            :key="point.date"
            :style="index === 0 ? { gridColumnStart: calendarOffset + 1 } : null"
          >
            <button
              type="button"
              :aria-label="`${point.label}: ${point.value} recorded plays`"
              :aria-pressed="selectedDay === point.date"
              :class="{ 'has-plays': point.value > 0 }"
              :style="{
                '--intensity': point.value ? 0.18 + (0.82 * point.value) / dailyMaximum : 0,
              }"
              @pointerenter="selectedDay = point.date"
              @focus="selectedDay = point.date"
              @click="selectedDay = point.date"
            >
              {{ index + 1 }}
            </button>
          </li>
        </ol>
        <p class="calendar-readout" aria-live="polite">
          {{
            dayReadout
              ? `${dayReadout.label}: ${dayReadout.value} recorded plays`
              : 'Select a date to see recorded plays.'
          }}
        </p>
      </template>
      <ol v-else class="daily-plays" aria-label="Recorded plays by day">
        <li
          v-for="point in data.daily"
          :key="point.date"
          tabindex="0"
          :aria-label="`${point.label}: ${point.value} recorded plays`"
        >
          <span>{{ point.label }}</span>
          <div class="bar-track" aria-hidden="true">
            <span :style="{ width: `${(point.value / dailyMaximum) * 100}%` }" />
          </div>
          <strong>{{ point.value }}</strong>
        </li>
      </ol>
    </template>
    <template v-else-if="type === 'repeats'">
      <p class="chart-explanation">How often songs appeared again in the returned history.</p>
      <ul class="repeat-plays" aria-label="First and repeat plays">
        <li
          v-for="item in data.repeatListening"
          :key="item.name"
          tabindex="0"
          :aria-label="`${item.name}: ${item.value} plays`"
        >
          <div>
            <span>{{ item.name }}</span
            ><strong>{{ item.value }} {{ item.value === 1 ? 'play' : 'plays' }}</strong>
          </div>
          <div class="bar-track" aria-hidden="true">
            <span
              :style="{
                width: `${repeatTotal ? (item.value / repeatTotal) * 100 : 0}%`,
                background: item.color,
              }"
            />
          </div>
        </li>
      </ul>
    </template>
    <template v-else-if="type === 'hours'">
      <p class="hours-summary">
        Most recorded plays were around <strong>{{ formatHour(peakHour) }}</strong
        >.
      </p>
      <div
        class="hour-chart"
        role="group"
        :aria-label="`Recorded plays across 24 hours. Busiest at ${formatHour(peakHour)}. Taller bars mean more recorded plays.`"
      >
        <button
          v-for="(value, i) in data.hourly"
          :key="i"
          type="button"
          class="hour-column"
          :aria-label="`${formatHour(i)}: ${value} recorded plays`"
          @pointerenter="selectedHour = i"
          @focus="selectedHour = i"
          @click="selectedHour = i"
        >
          <span
            :class="{ peak: i === peakHour }"
            :style="{ height: `${(value / Math.max(1, ...data.hourly)) * 100}%` }"
          />
        </button>
      </div>
      <p class="calendar-readout" aria-live="polite">
        {{
          selectedHour === null
            ? 'Select an hour to explore.'
            : `${formatHour(selectedHour)}: ${data.hourly[selectedHour]} recorded plays`
        }}
      </p>
      <div class="hour-axis" aria-hidden="true">
        <span>Midnight</span><span>6 am</span><span>Noon</span><span>6 pm</span><span>11 pm</span>
      </div>
    </template>
  </div>
</template>
<style scoped>
.calendar-weekdays,
.play-calendar {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
  padding: 0;
  margin: 0;
  list-style: none;
  text-align: center;
  font: 12px var(--font-sans);
}
.calendar-weekdays {
  margin-bottom: 8px;
  color: var(--dash-muted);
}
.play-calendar button {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 36px;
  cursor: pointer;
  border-radius: 5px;
  font: 13px var(--font-sans);
  background: var(--dash-rule);
}
.play-calendar button::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--dash-meter);
  opacity: var(--intensity);
  z-index: -1;
}
.play-calendar button:hover,
.play-calendar button[aria-pressed='true'] {
  outline: 2px solid var(--dash-strong);
  outline-offset: 1px;
}
.calendar-readout {
  min-height: 24px;
  margin-top: 12px;
  font: 13px/1.5 var(--font-sans);
  color: var(--dash-muted);
}
.bar-track span,
.hour-column span {
  transform-origin: bottom left;
  animation: chart-grow 500ms cubic-bezier(0.16, 1, 0.3, 1);
  transition: filter 180ms;
}
.daily-plays li:is(:hover, :focus-visible) .bar-track span,
.repeat-plays li:is(:hover, :focus-visible) .bar-track span,
.hour-column:is(:hover, :focus-visible) span {
  filter: brightness(0.8);
}
.daily-plays li:focus-visible,
.repeat-plays li:focus-visible {
  outline: 2px solid var(--dash-accent);
  outline-offset: 4px;
}
.chart-days .bar-track span,
.chart-repeats .bar-track span {
  animation-name: chart-fill;
}
@keyframes chart-fill {
  from {
    transform: scaleX(0.1);
  }
  to {
    transform: scaleX(1);
  }
}
@keyframes chart-grow {
  from {
    transform: scaleY(0.1);
  }
  to {
    transform: scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar-track span,
  .hour-column span {
    animation: none;
    transition: none;
  }
}
.daily-plays,
.repeat-plays {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}
.daily-plays li {
  display: grid;
  grid-template-columns: 70px minmax(20px, 1fr) 32px;
  align-items: center;
  gap: 12px;
}
.daily-plays strong,
.repeat-plays strong {
  font: 600 13px var(--font-sans);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.daily-plays .bar-track span {
  background: var(--dash-meter);
}
.repeat-plays li > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  align-items: baseline;
}
.repeat-plays {
  gap: 24px;
}
.listening-chart {
  font: var(--text-body)/1.5 var(--font-serif);
}
.listening-chart .chart-explanation {
  margin: 0 0 18px;
  color: var(--dash-muted);
}
.bar-track {
  height: 10px;
  background: var(--dash-rule);
}
.bar-track span {
  display: block;
  height: 100%;
}
.listening-chart .hours-summary {
  font-size: var(--text-quote);
  font-style: italic;
  margin: 0 0 22px;
}
.hour-chart {
  display: flex;
  gap: 5px;
  height: 140px;
  align-items: end;
}
.hour-column {
  cursor: pointer;
  padding: 0;
  height: 100%;
  flex: 1;
  display: flex;
  align-items: end;
}
.hour-column span {
  width: 100%;
  min-height: 3px;
  background: var(--dash-meter-soft);
}
.hour-column .peak {
  background: var(--dash-strong);
}
.hour-axis {
  display: flex;
  justify-content: space-between;
  font: 12px var(--font-sans);
  color: var(--dash-muted);
  margin-top: 12px;
}
</style>
