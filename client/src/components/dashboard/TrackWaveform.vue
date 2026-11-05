<script setup>
import { computed, ref, watch } from 'vue'

// The top tracks as one pulsing sound wave. Each song is a stretch of it, as wide as its share of the plays and coloured from its own cover.
const props = defineProps({
  songs: { type: Array, required: true },
  period: { type: String, required: true },
  paused: { type: Boolean, default: false },
})
// Each song's colour by id, so the list below can use the same colours.
const emit = defineEmits(['colors'])

// Used until a cover's colour is read, or when it can't be, or when two covers come out too alike to tell apart.
const FALLBACK_COLORS = ['#8a7fd1', '#e0533f', '#2fa38f', '#e2a93b', '#3f8fd6']
// About this many bars across the whole wave.
const TOTAL_BARS = 90
const MIN_BARS = 5

const coverColors = ref({})
const selected = ref(null)

// The vivid part of a cover, like the listening room's accent colour.
function readCoverColor(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 24
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0, 24, 24)
        const pixels = context.getImageData(0, 0, 24, 24).data
        const colors = []
        for (let i = 0; i < pixels.length; i += 4) {
          const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]]
          const [red, green, blue] = rgb.map((value) => value / 255)
          const high = Math.max(red, green, blue)
          const low = Math.min(red, green, blue)
          const saturation = high === low ? 0 : (high - low) / high
          const brightness = (red + green + blue) / 3
          if (saturation > 0.18 && brightness > 0.15 && brightness < 0.9) {
            colors.push({ rgb, score: saturation * (1 - Math.abs(brightness - 0.55)) })
          }
        }
        if (!colors.length) return resolve(null)
        colors.sort((first, second) => second.score - first.score)
        const vivid = colors.slice(0, Math.max(1, Math.ceil(colors.length * 0.22)))
        resolve(
          [0, 1, 2].map((channel) =>
            Math.round(
              vivid.reduce((total, entry) => total + entry.rgb[channel], 0) / vivid.length,
            ),
          ),
        )
      } catch {
        // A cover without CORS keeps its fallback colour.
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
}

watch(
  () => props.songs.map((song) => song.art),
  async (arts) => {
    const missing = arts.filter((art) => art && !(art in coverColors.value))
    const found = await Promise.all(missing.map(readCoverColor))
    coverColors.value = {
      ...coverColors.value,
      ...Object.fromEntries(missing.map((art, index) => [art, found[index]])),
    }
  },
  { immediate: true },
)

const distance = (first, second) =>
  first.reduce((total, value, channel) => total + Math.abs(value - second[channel]), 0)

// A bar's resting height and pulse, the same on every render.
const barStyle = (song, bar) => {
  const seed = Math.sin((song + 1) * 97.3 + bar * 12.9) * 43758.5
  const random = seed - Math.floor(seed)
  const swell = 0.5 + 0.5 * Math.abs(Math.sin(bar / 4 + song))
  return {
    height: `${Math.round(18 + 82 * swell * (0.25 + 0.75 * random))}%`,
    animationDuration: `${(0.9 + random * 0.8).toFixed(2)}s`,
    animationDelay: `-${(random * 2).toFixed(2)}s`,
  }
}

const stretches = computed(() => {
  const total = props.songs.reduce((sum, song) => sum + song[props.period], 0)
  const used = []
  return props.songs.map((song, index) => {
    const rgb = coverColors.value[song.art]
    // Each song keeps a colour of its own.
    const color =
      rgb && used.every((other) => distance(rgb, other) > 70)
        ? `rgb(${rgb.join(', ')})`
        : FALLBACK_COLORS[index % FALLBACK_COLORS.length]
    if (rgb) used.push(rgb)
    const plays = song[props.period]
    const share = total ? plays / total : 0
    const bars = Math.max(MIN_BARS, Math.round(share * TOTAL_BARS))
    return {
      ...song,
      color,
      plays,
      share: Math.round(share * 100),
      bars: Array.from({ length: bars }, (_, bar) => barStyle(index, bar)),
    }
  })
})

watch(
  () => stretches.value.map((song) => [song.id, song.color]),
  (colors) => emit('colors', Object.fromEntries(colors)),
  { immediate: true },
)

const readout = computed(() => {
  const song = stretches.value.find((entry) => entry.id === selected.value)
  return song
    ? `${song.title} · ${song.artist} · ${song.plays} plays (${song.share}%)`
    : 'Point at the wave to see each song.'
})
</script>

<template>
  <div v-if="stretches.length" class="track-wave" :class="{ 'is-paused': paused }">
    <div class="wave" :class="{ 'has-selection': selected }">
      <button
        v-for="song in stretches"
        :key="song.id"
        type="button"
        class="stretch"
        :class="{ 'is-selected': selected === song.id }"
        :style="{ '--song': song.color, flexGrow: song.bars.length }"
        :aria-label="`${song.title} by ${song.artist}, ${song.plays} plays`"
        :aria-pressed="selected === song.id"
        @pointerenter="selected = song.id"
        @pointerleave="selected = null"
        @focus="selected = song.id"
        @blur="selected = null"
        @click="selected = song.id"
      >
        <span v-for="(bar, index) in song.bars" :key="index" class="bar" :style="bar" />
      </button>
    </div>
    <p class="wave-readout" aria-live="polite">{{ readout }}</p>
  </div>
</template>

<style scoped>
.wave {
  display: flex;
  gap: 6px;
  height: 120px;
}
/* No box around a song: just its bars, which stand out when it's picked. */
.stretch {
  display: flex;
  flex-basis: 0;
  align-items: center;
  justify-content: space-between;
  /* Small minimums, so all the bars still fit on the narrowest phones. */
  gap: 1px;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: none;
  cursor: pointer;
  transition: opacity 200ms ease;
}
.has-selection .stretch:not(.is-selected) {
  opacity: 0.3;
}
.bar {
  flex: 0 1 4px;
  min-width: 1px;
  border-radius: 999px;
  background: var(--song);
  animation: wave-pulse ease-in-out infinite alternate;
  transition: scale 200ms ease;
}
.is-selected .bar {
  scale: 1 1.15;
}
.is-paused .bar {
  animation-play-state: paused;
}
.wave-readout {
  min-height: 22px;
  margin: 8px 0 18px;
  color: var(--dash-muted);
  font: 13px/1.5 var(--font-sans);
}
@keyframes wave-pulse {
  from {
    transform: scaleY(0.45);
  }
  to {
    transform: scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar {
    animation: none;
  }
}
</style>
