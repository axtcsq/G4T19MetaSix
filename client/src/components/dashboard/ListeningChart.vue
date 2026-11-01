<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

// The listening clock: one wedge per hour around a 24-hour dial, midnight at
// the top and noon at the bottom. Longer wedges mean more recorded plays.
const CLOCK_CENTRE = 120
const CLOCK_INNER = 34
const CLOCK_OUTER = 104
const hourlyMaximum = computed(() => Math.max(1, ...props.data.hourly))

function clockPoint(radius, hour) {
  const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2
  const x = CLOCK_CENTRE + Math.cos(angle) * radius
  const y = CLOCK_CENTRE + Math.sin(angle) * radius
  return `${x.toFixed(2)} ${y.toFixed(2)}`
}

// A small gap either side keeps neighbouring hours apart. Hours with no plays
// keep a thin sliver so the dial still reads as a full day.
function hourWedge(hour, value) {
  const length = Math.max(3, (value / hourlyMaximum.value) * (CLOCK_OUTER - CLOCK_INNER))
  const outer = CLOCK_INNER + length
  const start = hour + 0.06
  const end = hour + 0.94
  return [
    `M ${clockPoint(CLOCK_INNER, start)}`,
    `L ${clockPoint(outer, start)}`,
    `A ${outer} ${outer} 0 0 1 ${clockPoint(outer, end)}`,
    `L ${clockPoint(CLOCK_INNER, end)}`,
    `A ${CLOCK_INNER} ${CLOCK_INNER} 0 0 0 ${clockPoint(CLOCK_INNER, start)}`,
    'Z',
  ].join(' ')
}

const clockLabels = [
  { text: 'Midnight', hour: 0 },
  { text: '6 am', hour: 6 },
  { text: 'Noon', hour: 12 },
  { text: '6 pm', hour: 18 },
].map((label) => {
  const [x, y] = clockPoint(CLOCK_OUTER + 12, label.hour).split(' ')
  return { ...label, x, y }
})

// The hand points at the time now. It moves a quarter of a degree a minute,
// so checking once a minute is enough, and it rests while the tab is hidden.
const now = ref(new Date())
const handAngle = computed(
  () => ((now.value.getHours() + now.value.getMinutes() / 60) / 24) * 360,
)
let clockTimer
function tick() {
  now.value = new Date()
}
function startClock() {
  window.clearInterval(clockTimer)
  if (!document.hidden) clockTimer = window.setInterval(tick, 60_000)
  tick()
}
onMounted(() => {
  if (props.type !== 'hours') return
  startClock()
  document.addEventListener('visibilitychange', startClock)
})
onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', startClock)
})
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
      <svg
        class="hour-clock"
        viewBox="0 0 240 240"
        role="group"
        :aria-label="`Recorded plays across 24 hours, drawn as a clock with midnight at the top. Busiest at ${formatHour(peakHour)}. Longer wedges mean more recorded plays.`"
      >
        <circle
          v-for="radius in [CLOCK_INNER, 69, CLOCK_OUTER]"
          :key="radius"
          class="clock-ring"
          :cx="CLOCK_CENTRE"
          :cy="CLOCK_CENTRE"
          :r="radius"
        />
        <g class="clock-wedges">
          <path
            v-for="(value, i) in data.hourly"
            :key="i"
            class="hour-wedge"
            :class="{ peak: i === peakHour, selected: i === selectedHour }"
            :d="hourWedge(i, value)"
            tabindex="0"
            role="button"
            :aria-label="`${formatHour(i)}: ${value} recorded plays`"
            @pointerenter="selectedHour = i"
            @focus="selectedHour = i"
            @click="selectedHour = i"
          />
        </g>
        <text
          v-for="label in clockLabels"
          :key="label.text"
          class="clock-label"
          :x="label.x"
          :y="label.y"
          aria-hidden="true"
        >
          {{ label.text }}
        </text>
        <g class="clock-hand" :style="{ transform: `rotate(${handAngle}deg)` }" aria-hidden="true">
          <line
            :x1="CLOCK_CENTRE"
            :y1="CLOCK_CENTRE - CLOCK_INNER + 4"
            :x2="CLOCK_CENTRE"
            :y2="CLOCK_CENTRE - CLOCK_OUTER - 2"
          />
          <circle :cx="CLOCK_CENTRE" :cy="CLOCK_CENTRE - CLOCK_OUTER - 2" r="3" />
        </g>
        <text class="clock-centre-label" :x="CLOCK_CENTRE" :y="CLOCK_CENTRE - 5" aria-hidden="true">
          {{ selectedHour === null ? 'peak' : 'plays' }}
        </text>
        <text class="clock-centre-value" :x="CLOCK_CENTRE" :y="CLOCK_CENTRE + 12" aria-hidden="true">
          {{ selectedHour === null ? formatHour(peakHour) : data.hourly[selectedHour] }}
        </text>
      </svg>
      <p class="calendar-readout" aria-live="polite">
        {{
          selectedHour === null
            ? 'Select an hour to explore. The hand shows the time now.'
            : `${formatHour(selectedHour)}: ${data.hourly[selectedHour]} recorded plays`
        }}
      </p>
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
.bar-track span {
  transform-origin: bottom left;
  animation: chart-fill 500ms cubic-bezier(0.16, 1, 0.3, 1);
  transition: filter 180ms;
}
.daily-plays li:is(:hover, :focus-visible) .bar-track span,
.repeat-plays li:is(:hover, :focus-visible) .bar-track span {
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
@keyframes clock-grow {
  from {
    transform: scale(0.35);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar-track span,
  .clock-wedges,
  .clock-hand,
  .hour-wedge {
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
/* The wedges grow out from the middle when the chart appears or the period
   changes; the hand turns round the same centre. */
.hour-clock {
  display: block;
  width: min(100%, 320px);
  margin: 0 auto;
  overflow: visible;
}
.clock-ring {
  fill: none;
  stroke: var(--dash-rule);
}
.clock-wedges {
  transform-box: view-box;
  transform-origin: 120px 120px;
  animation: clock-grow 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
.hour-wedge {
  fill: var(--dash-meter-soft);
  cursor: pointer;
  transition:
    fill 180ms,
    filter 180ms;
}
.hour-wedge.peak {
  fill: var(--dash-strong);
}
.hour-wedge:is(:hover, .selected) {
  filter: brightness(0.82);
}
.hour-wedge:focus-visible {
  outline: none;
  stroke: var(--dash-accent);
  stroke-width: 2;
}
.clock-label {
  fill: var(--dash-muted);
  font: 11px var(--font-sans);
  text-anchor: middle;
  dominant-baseline: middle;
}
.clock-hand {
  transform-box: view-box;
  transform-origin: 120px 120px;
  transition: transform 800ms ease;
  pointer-events: none;
}
.clock-hand line {
  stroke: var(--dash-ink);
  stroke-width: 1.6;
  stroke-linecap: round;
}
.clock-hand circle {
  fill: var(--dash-ink);
}
.clock-centre-label {
  fill: var(--dash-muted);
  font: 11px var(--font-sans);
  text-anchor: middle;
}
.clock-centre-value {
  fill: var(--dash-strong);
  font: 700 15px var(--font-sans);
  text-anchor: middle;
}
</style>
