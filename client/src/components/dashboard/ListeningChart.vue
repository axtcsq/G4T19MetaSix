<script setup>
import { computed } from 'vue'
const props = defineProps({
  type: { type: String, required: true },
  data: { type: Object, required: true },
})
const peakHour = computed(() => props.data.hourly.indexOf(Math.max(...props.data.hourly)))
const formatHour = (i) => `${i % 12 || 12} ${i < 12 ? 'am' : 'pm'}`
const dailyMaximum = computed(() => Math.max(1, ...props.data.daily.map((day) => day.value)))
const repeatTotal = computed(() =>
  props.data.repeatListening.reduce((sum, item) => sum + item.value, 0),
)
</script>
<template>
  <div class="listening-chart" :class="`chart-${type}`">
    <template v-if="type === 'days'">
      <p class="chart-explanation">Plays by date in the returned Spotify history.</p>
      <ol class="daily-plays" aria-label="Recorded plays by day">
        <li v-for="point in data.daily" :key="point.date">
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
        <li v-for="item in data.repeatListening" :key="item.name">
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
        role="img"
        :aria-label="`Recorded plays across 24 hours. Busiest at ${formatHour(peakHour)}. Taller bars mean more recorded plays.`"
      >
        <div v-for="(value, i) in data.hourly" :key="i" class="hour-column">
          <span
            :class="{ peak: i === peakHour }"
            :style="{ height: `${(value / Math.max(1, ...data.hourly)) * 100}%` }"
          />
        </div>
      </div>
      <div class="hour-axis" aria-hidden="true">
        <span>Midnight</span><span>6 am</span><span>Noon</span><span>6 pm</span><span>11 pm</span>
      </div>
    </template>
  </div>
</template>
<style scoped>
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
  font: 18px/1.4 var(--font-serif);
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
  font-size: 24px;
  margin: 0 0 22px;
}
.hour-chart {
  display: flex;
  gap: 5px;
  height: 140px;
  align-items: end;
}
.hour-column {
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
  background: var(--dash-ink);
}
.hour-axis {
  display: flex;
  justify-content: space-between;
  font: 12px var(--font-sans);
  color: var(--dash-muted);
  margin-top: 12px;
}
</style>
