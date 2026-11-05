<script setup>
import { computed, ref } from 'vue'
const props = defineProps({
  type: { type: String, required: true },
  data: { type: Object, required: true },
  paused: Boolean,
})
const peakHour = computed(() => props.data.hourly.indexOf(Math.max(...props.data.hourly)))
const formatHour = (i) => `${i % 12 || 12} ${i < 12 ? 'am' : 'pm'}`
const dailyMaximum = computed(() => Math.max(1, ...props.data.daily.map((day) => day.value)))
const selectedDay = ref(null)
const selectedHour = ref(null)
const dayReadout = computed(() => props.data.daily.find((day) => day.date === selectedDay.value))

// The days equaliser: one column of blocks per day, the busiest day full. A month only labels every fifth date, so thirty columns still fit a phone.
const EQUALISER_BLOCKS = 10
const busiestDay = computed(() =>
  props.data.daily.findIndex((day) => day.value === dailyMaximum.value),
)
const isMonth = computed(() => props.data.period === 'monthly')
const litBlocks = (value) =>
  value ? Math.max(1, Math.round((value / dailyMaximum.value) * EQUALISER_BLOCKS)) : 0
// The 30 days can cross into a new month, so each label is the day's real date.
const dayLabel = (point, index) =>
  isMonth.value
    ? index === 0 || (index + 1) % 5 === 0
      ? Number(point.date.slice(8))
      : ''
    : point.label
// Each column bounces at its own pace, so the bars never move in step. The bounce waits for the rise-in to finish.
const bounceStyle = (index) => ({
  '--bounce-time': `${1.6 + ((index * 7) % 5) * 0.22}s`,
  '--bounce-delay': `${0.6 + ((index * 3) % 7) * 0.15}s`,
})

// The listening clock: one wedge per hour around a 24-hour dial, midnight at the top and noon at the bottom. Longer wedges mean more recorded plays.
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

// A small gap either side keeps neighbouring hours apart. Hours with no plays keep a thin sliver so the dial still reads as a full day.
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

</script>
<template>
  <div class="listening-chart" :class="`chart-${type}`">
    <template v-if="type === 'days'">
      <p class="chart-explanation">Plays by date in the returned Spotify history.</p>
      <ol
        class="play-equaliser"
        :class="{ 'is-month': isMonth, 'is-paused': paused }"
        :style="{ '--days': data.daily.length }"
        aria-label="Recorded plays by day"
      >
        <li v-for="(point, index) in data.daily" :key="point.date">
          <button
            type="button"
            :aria-label="`${point.label}: ${point.value} recorded plays`"
            :aria-pressed="selectedDay === point.date"
            @pointerenter="selectedDay = point.date"
            @focus="selectedDay = point.date"
            @click="selectedDay = point.date"
          >
            <strong
              v-if="!isMonth || index === busiestDay"
              class="day-value"
              :class="{ empty: !point.value }"
              aria-hidden="true"
              >{{ point.value }}</strong
            >
            <span class="day-track" aria-hidden="true">
              <span
                class="day-blocks"
                :class="{ busiest: index === busiestDay }"
                :style="bounceStyle(index)"
              >
                <span v-for="block in litBlocks(point.value)" :key="block" />
              </span>
            </span>
            <span class="day-label" aria-hidden="true">{{ dayLabel(point, index) }}</span>
          </button>
        </li>
      </ol>
      <p class="calendar-readout" aria-live="polite">
        {{
          dayReadout
            ? `${dayReadout.label}: ${dayReadout.value} recorded plays`
            : 'Select a day to see its plays.'
        }}
      </p>
    </template>
    <template v-else-if="type === 'hours'">
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
            ? 'Select an hour to explore.'
            : `${formatHour(selectedHour)}: ${data.hourly[selectedHour]} recorded plays`
        }}
      </p>
    </template>
  </div>
</template>
<style scoped>
/* Each day is a column of ten block slots, lit from the bottom. The lit blocks rise in when the chart appears, then bounce gently. */
.play-equaliser {
  display: grid;
  grid-template-columns: repeat(var(--days), minmax(0, 1fr));
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
  font: var(--text-caption) var(--font-sans);
}
.play-equaliser.is-month {
  gap: 3px;
}
.play-equaliser button {
  display: grid;
  grid-template-rows: 20px 147px 18px;
  justify-items: center;
  align-items: end;
  gap: 6px;
  width: 100%;
  padding: 0;
  cursor: pointer;
  color: var(--dash-muted);
}
/* Fixed rows, so a month's columns without a number still line up. */
.day-value {
  grid-row: 1;
  font: 600 var(--text-label) var(--font-sans);
  color: var(--dash-ink);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.day-value.empty {
  color: var(--dash-muted);
  font-weight: 400;
}
.day-track {
  grid-row: 2;
  display: flex;
  align-items: flex-end;
  width: min(100%, 30px);
  height: 147px;
  background: repeating-linear-gradient(to top, var(--dash-rule) 0 12px, transparent 12px 15px);
}
.day-blocks {
  display: flex;
  flex-direction: column-reverse;
  gap: 3px;
  width: 100%;
  transform-origin: bottom;
  animation:
    equaliser-rise 600ms cubic-bezier(0.16, 1, 0.3, 1),
    equaliser-bounce var(--bounce-time) ease-in-out var(--bounce-delay) infinite alternate;
}
.day-blocks span {
  flex: 0 0 12px;
  background: var(--dash-meter);
  transition: filter 180ms;
}
.day-blocks.busiest span {
  background: var(--dash-strong);
}
.day-label {
  grid-row: 3;
  white-space: nowrap;
}
.play-equaliser button:is(:hover, [aria-pressed='true']) .day-blocks span {
  filter: brightness(0.8);
}
.play-equaliser button:is(:hover, [aria-pressed='true']) .day-label {
  color: var(--dash-ink);
}
.play-equaliser button:focus-visible {
  outline: 2px solid var(--dash-accent);
  outline-offset: 3px;
}
.play-equaliser.is-paused .day-blocks {
  animation-play-state: paused;
}
@keyframes equaliser-rise {
  from {
    transform: scaleY(0);
  }
}
@keyframes equaliser-bounce {
  to {
    transform: scaleY(0.86);
  }
}
.calendar-readout {
  min-height: 24px;
  margin-top: 12px;
  font: var(--text-label)/1.5 var(--font-sans);
  color: var(--dash-muted);
}
@media (prefers-reduced-motion: reduce) {
  .day-blocks,
  .hour-wedge {
    animation: none;
    transition: none;
  }
}
.listening-chart {
  font: var(--text-body)/1.5 var(--font-serif);
}
.listening-chart .chart-explanation {
  margin: 0 0 18px;
  color: var(--dash-muted);
}
/* The wedges grow out from the middle when the chart appears or the period changes; the hand turns round the same centre. */
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
.hour-wedge.selected {
  fill: var(--dash-strong);
  stroke: var(--dash-accent);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.hour-wedge:hover:not(.selected) {
  filter: brightness(0.82);
}
.hour-wedge:focus {
  outline: 0 !important;
}
.hour-wedge:focus-visible {
  outline: 0 !important;
  stroke: var(--dash-accent);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.clock-label {
  fill: var(--dash-muted);
  font: var(--text-caption) var(--font-sans);
  text-anchor: middle;
  dominant-baseline: middle;
}
.clock-centre-label {
  fill: var(--dash-muted);
  font: var(--text-caption) var(--font-sans);
  text-anchor: middle;
}
.clock-centre-value {
  fill: var(--dash-strong);
  font: 700 var(--text-small) var(--font-sans);
  text-anchor: middle;
}
</style>
