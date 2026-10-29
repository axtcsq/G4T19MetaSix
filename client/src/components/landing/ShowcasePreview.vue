<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MoodFace from '@/components/journal/MoodFace.vue'

// A small, made-up preview of one part of the app for the landing page. It
// plays a short demo when it scrolls into view, then visitors can try it:
// pick a mood, look at a day, play a song or see another personality.
const props = defineProps({
  kind: { type: String, required: true, validator: (value) => ['mood', 'calendar', 'listen', 'personality'].includes(value) },
  name: { type: String, required: true },
})

const root = ref(null)
const shown = ref(false)
const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const timers = []
const later = (fn, ms) => timers.push(window.setTimeout(fn, ms))

// Daily Mood: the note types itself out for whichever mood is picked.
const MOODS = {
  Sad: 'Long day. Put on something slow and let it rain.',
  Happy: 'Finally finished my project. Played my favourite album on the way home.',
  Relaxed: 'Lazy Sunday with tea and an acoustic playlist.',
  Anxious: 'Exams tomorrow. Lo-fi on loop to keep me focused.',
  Angry: 'Missed the bus twice. Loud music all the way home.',
  Excited: 'Got great news today. I can’t stop smiling.',
  Tired: 'Long day. I’m taking it slow tonight.',
  Lonely: 'Missing my friends, so I put on a song we love.',
}
const pickedMood = ref(null)
const typedNote = ref('')
let typing
watch(pickedMood, (mood) => {
  window.clearInterval(typing)
  const note = MOODS[mood] ?? ''
  if (reduceMotion) {
    typedNote.value = note
    return
  }
  let length = 0
  typing = window.setInterval(() => {
    length += 1
    typedNote.value = note.slice(0, length)
    if (length >= note.length) window.clearInterval(typing)
  }, 28)
})

// Mood Calendar: the faces pop in, and each day says what was played. The
// faces are the same drawn ones as the Mood Calendar page.
const DAYS = {
  2: ['Happy', 'Sunlit Window'],
  3: ['Relaxed', 'Slow Tide'],
  6: ['Sad', 'Rainy Platform'],
  9: ['Happy', 'Paper Planes'],
  10: ['Happy', 'Golden Streets'],
  13: ['Anxious', 'Static Hearts'],
  16: ['Relaxed', 'Low Light'],
  17: ['Happy', 'Summer Static'],
  20: ['Angry', 'Brake Lights'],
  23: ['Relaxed', 'Quiet Hours'],
}
const dayOrder = Object.keys(DAYS).map(Number)
const selectedDay = ref(null)
const dayDetail = computed(() => {
  const day = DAYS[selectedDay.value]
  return day ? `Oct ${selectedDay.value} · ${day[0]} · Most played: ${day[1]}` : 'Hover or tap a day to see what you played.'
})

// Listening Room: a player that really counts along.
const TRACKS = [
  { title: 'Your top track this week', detail: 'Played 23 times', length: 30 },
  { title: 'Your late-night favourite', detail: 'Played 11 times', length: 24 },
  { title: 'On repeat since Monday', detail: 'Played 17 times', length: 27 },
]
const trackIndex = ref(0)
const playing = ref(false)
const elapsed = ref(0)
const track = computed(() => TRACKS[trackIndex.value])
const progress = computed(() => `${(elapsed.value / track.value.length) * 100}%`)
const clock = (seconds) => `0:${String(Math.floor(seconds)).padStart(2, '0')}`
let ticking
function skip(step) {
  trackIndex.value = (trackIndex.value + step + TRACKS.length) % TRACKS.length
  elapsed.value = 0
}
watch(playing, (isPlaying) => {
  window.clearInterval(ticking)
  if (!isPlaying) return
  ticking = window.setInterval(() => {
    elapsed.value += 0.1
    if (elapsed.value >= track.value.length) skip(1)
  }, 100)
})

// Personality: the trait bars fill, and there are a few results to flick through.
const RESULTS = [
  { type: 'The Daydreamer', traits: [34, 72, 58] },
  { type: 'The Storm Chaser', traits: [86, 28, 40] },
  { type: 'The Poet', traits: [22, 64, 18] },
]
const TRAITS = [
  ['Amped', 'Mellow'],
  ['Explorer', 'Loyalist'],
  ['Wordsmith', 'Soundscaper'],
]
const resultIndex = ref(0)
const result = computed(() => RESULTS[resultIndex.value])

function playDemo() {
  shown.value = true
  if (props.kind === 'mood') later(() => (pickedMood.value ??= 'Happy'), reduceMotion ? 0 : 700)
  if (props.kind === 'listen' && !reduceMotion) later(() => (playing.value = true), 500)
}

let observer
onMounted(() => {
  if (reduceMotion || !('IntersectionObserver' in window)) {
    playDemo()
    return
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      playDemo()
    },
    { threshold: 0.4 },
  )
  observer.observe(root.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  timers.forEach((timer) => window.clearTimeout(timer))
  window.clearInterval(typing)
  window.clearInterval(ticking)
})
</script>

<template>
  <div
    ref="root"
    class="preview"
    :class="[`preview-${kind}`, { 'is-shown': shown }]"
    role="group"
    :aria-label="`Try a preview of ${name}`"
  >
    <template v-if="kind === 'mood'">
      <p class="preview-label">How are you feeling today?</p>
      <div class="preview-moods">
        <button
          v-for="(note, mood, index) in MOODS"
          :key="mood"
          type="button"
          :class="[`mood-${mood.toLowerCase()}`, { 'is-picked': mood === pickedMood }]"
          :style="{ '--i': index }"
          :aria-pressed="mood === pickedMood"
          @click="pickedMood = mood"
        >
          {{ mood }}
        </button>
      </div>
      <p class="preview-note" aria-live="polite">
        {{ typedNote }}<span v-if="typedNote.length < (MOODS[pickedMood] ?? '').length" class="caret" aria-hidden="true" />
      </p>
    </template>

    <template v-else-if="kind === 'calendar'">
      <p class="preview-label">October</p>
      <div class="calendar-grid" @mouseleave="selectedDay = null">
        <span v-for="(day, index) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']" :key="index" class="weekday" aria-hidden="true">{{
          day
        }}</span>
        <template v-for="day in 28" :key="day">
          <button
            v-if="DAYS[day]"
            type="button"
            class="day has-mood mood-reaction"
            :class="[`mood-reaction--${DAYS[day][0].toLowerCase()}`, { 'is-selected': selectedDay === day }]"
            :style="{ '--i': dayOrder.indexOf(day) }"
            :aria-label="`October ${day}, ${DAYS[day][0]}`"
            @mouseenter="selectedDay = day"
            @focus="selectedDay = day"
            @click="selectedDay = day"
          >
            <small>{{ day }}</small
            ><span class="face" aria-hidden="true"><MoodFace :mood="DAYS[day][0]" class="button-mood-face" /></span>
          </button>
          <span v-else class="day" :class="{ 'is-today': day === 24 }" aria-hidden="true"><small>{{ day }}</small></span>
        </template>
      </div>
      <p class="preview-detail" aria-live="polite">{{ dayDetail }}</p>
    </template>

    <template v-else-if="kind === 'listen'">
      <div class="preview-record" :class="{ 'is-playing': playing }" aria-hidden="true"><span /></div>
      <div class="preview-player">
        <strong>{{ track.title }}</strong>
        <small>{{ track.detail }}</small>
        <div class="preview-bar" aria-hidden="true"><span :style="{ width: progress }" /></div>
        <div class="preview-times" aria-hidden="true">
          <span>{{ clock(elapsed) }}</span><span>{{ clock(track.length) }}</span>
        </div>
        <div class="preview-controls">
          <button type="button" class="glass-icon" aria-label="Previous track" @click="skip(-1)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h2v11H3zM13.5 2.5v11L6 8z" /></svg>
          </button>
          <button type="button" class="is-main glass-icon glass-action" :aria-label="playing ? 'Pause' : 'Play'" @click="playing = !playing">
            <svg v-if="playing" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" />
            </svg>
            <svg v-else viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
          </button>
          <button type="button" class="glass-icon" aria-label="Next track" @click="skip(1)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2.5h2v11h-2zM2.5 2.5v11L10 8z" /></svg>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <p class="preview-label">Your MetaFor personality</p>
      <strong class="preview-type" aria-live="polite">{{ result.type }}</strong>
      <div v-for="([left, right], index) in TRAITS" :key="left" class="preview-trait">
        <span>{{ left }}</span>
        <div class="preview-bar" aria-hidden="true"><span :style="{ width: shown ? `${result.traits[index]}%` : '0%' }" /></div>
        <span>{{ right }}</span>
      </div>
      <button type="button" class="preview-again glass-secondary" @click="resultIndex = (resultIndex + 1) % RESULTS.length">
        See another result ↻
      </button>
    </template>
  </div>
</template>

<style scoped>
/* The preview cards share the feature cards' look. */
.preview {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  padding: 26px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 6px 18px rgba(125, 71, 55, 0.08);
  font-family: var(--font-sans);
  user-select: none;
}
.preview button {
  font: inherit;
  cursor: pointer;
}
.preview button:focus-visible {
  outline: 3px solid var(--color-brand-400);
  outline-offset: 2px;
}
.preview-label {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

/* The same mood colours as the Daily Mood page. The pills pop in one by one. */
.preview-moods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.preview-moods button {
  --mood: #cd6651;
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, var(--mood), transparent 55%);
  border-radius: 999px;
  color: var(--ui-text);
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0;
  transform: translateY(6px);
  transition:
    background-color 200ms ease,
    border-color 200ms ease,
    color 200ms ease,
    opacity 300ms ease calc(var(--i) * 70ms),
    transform 300ms ease calc(var(--i) * 70ms);
}
.is-shown .preview-moods button {
  opacity: 1;
  transform: none;
}
.preview-moods button:hover {
  border-color: var(--mood);
}
.preview-moods .mood-sad { --mood: #4389d1; }
.preview-moods .mood-happy { --mood: #f2c335; }
.preview-moods .mood-relaxed { --mood: #998ba1; }
.preview-moods .mood-anxious { --mood: #ed8a35; }
.preview-moods .mood-angry { --mood: #d94a45; }
.preview-moods .mood-excited { --mood: #d96f9f; }
.preview-moods .mood-tired { --mood: #7e8ca6; }
.preview-moods .mood-lonely { --mood: #4f8f95; }
.preview-moods .is-picked {
  border-color: var(--mood);
  color: #30261d;
  background: var(--mood);
  animation: pick 260ms ease;
}
.preview-note {
  min-height: 62px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  color: var(--ui-text);
  background:
    repeating-linear-gradient(transparent 0 25px, color-mix(in srgb, var(--ui-border), transparent 20%) 25px 26px),
    var(--ui-bg);
  /* Starts under the top padding so each line sits under a row of text. */
  background-position: 0 10px, 0 0;
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 26px;
}
.caret {
  display: inline-block;
  width: 1px;
  height: 1em;
  margin-left: 1px;
  background: currentColor;
  vertical-align: -0.15em;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  text-align: center;
}
.calendar-grid .weekday {
  color: var(--ui-text-muted);
  font-size: 0.7rem;
  font-weight: 700;
}
.calendar-grid .day {
  display: flex;
  aspect-ratio: 1.6;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: var(--ui-bg-accented);
  font-size: clamp(0.85rem, 1.6vw, 1.1rem);
  line-height: 1;
}
.calendar-grid small {
  color: var(--ui-text-muted);
  font-size: 0.6rem;
}
.calendar-grid .is-today {
  box-shadow: inset 0 0 0 2px #cd6651;
}
.calendar-grid .has-mood {
  transition: transform 150ms ease;
}
.calendar-grid .has-mood:hover,
.calendar-grid .is-selected {
  background: color-mix(in srgb, var(--color-brand-400), transparent 70%);
  transform: scale(1.08);
}
/* Each face pops in a moment after the one before, in its mood's colour. */
.face {
  display: inline-block;
  color: var(--mood);
  transform: scale(0);
}
.face .button-mood-face {
  display: block;
  width: clamp(20px, 2.6vw, 28px);
  height: clamp(20px, 2.6vw, 28px);
}
.mood-reaction--happy { --mood: #f2c335; }
.mood-reaction--sad { --mood: #4389d1; }
.mood-reaction--relaxed { --mood: #998ba1; }
.mood-reaction--anxious { --mood: #ed8a35; }
.mood-reaction--angry { --mood: #d94a45; }
.mood-reaction--excited { --mood: #d96f9f; }
.mood-reaction--tired { --mood: #7e8ca6; }
.mood-reaction--lonely { --mood: #4f8f95; }
.is-shown .face {
  animation: pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) calc(var(--i) * 90ms) forwards;
}
.preview-detail {
  min-height: 1.3em;
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.preview-listen {
  flex-direction: row;
  align-items: center;
  gap: 24px;
}
.preview-record {
  display: grid;
  width: clamp(110px, 14vw, 150px);
  flex-shrink: 0;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  background: repeating-radial-gradient(circle, #1b1517 0 2px, #2c2326 2px 4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  animation: spin 6s linear infinite paused;
}
.preview-record.is-playing {
  animation-play-state: running;
}
.preview-record span {
  width: 36%;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle, #1b1517 0 8%, transparent 9%),
    linear-gradient(135deg, var(--color-brand-400), #998ba1);
}
.preview-player {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}
.preview-player strong {
  color: var(--ui-text);
  font-size: 1rem;
}
.preview-player small,
.preview-times {
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}
.preview-times {
  display: flex;
  justify-content: space-between;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}
.preview-bar {
  height: 4px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(127, 127, 127, 0.3);
}
.preview-bar span {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--color-brand-500);
}
.preview-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 6px;
  color: var(--ui-text);
}
.preview-controls button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: inherit;
  background: transparent;
}
.preview-controls button:hover {
  background: var(--ui-bg-accented);
}
.preview-controls svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
.preview-controls .is-main {
  color: #fff;
  background: var(--color-brand-500);
}
.preview-controls .is-main:hover {
  background: var(--color-brand-600, var(--color-brand-500));
}

.preview-type {
  margin-top: -8px;
  color: var(--ui-text);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.preview-trait {
  display: grid;
  grid-template-columns: 5.5rem 1fr 5.5rem;
  align-items: center;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}
.preview-trait span:last-child {
  text-align: right;
}
.preview-trait .preview-bar {
  margin: 0;
}
.preview-trait .preview-bar span {
  transition: width 700ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pop {
  to {
    transform: scale(1);
  }
}
@keyframes pick {
  50% {
    transform: scale(1.12);
  }
}

@media (max-width: 768px) {
  .preview {
    min-height: 0;
    padding: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .preview *,
  .preview-record {
    transition: none !important;
    animation: none !important;
  }
  .face {
    transform: none;
  }
  .preview-moods button {
    opacity: 1;
    transform: none;
  }
}

.preview-again { align-self: flex-start; }
</style>
