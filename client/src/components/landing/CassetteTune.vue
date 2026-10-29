<script setup>
import { onBeforeUnmount, ref } from 'vue'

// "Play a tune" under the landing page cassette: a short tune made in the
// browser, with bars that move to the sound. Nothing is downloaded.
const bars = ref(null)
const playing = ref(false)

// A gentle eight-bar melody in C major pentatonic, with a bass note per bar.
// Each melody note is [semitones above middle C, length in beats].
const MELODY = [
  [4, 1], [7, 1], [9, 1], [7, 1], [12, 2], [9, 2],
  [7, 1], [4, 1], [2, 1], [4, 1], [7, 4],
  [9, 1], [12, 1], [14, 1], [12, 1], [9, 2], [7, 2],
  [4, 1], [2, 1], [0, 1], [2, 1], [0, 4],
]
const BASS = [-12, -15, -20, -17, -12, -15, -20, -24]
const BEAT = 0.24
const BAR_COUNT = 14

let audio
let analyser
let master
let frame
let stopTimer
const sounds = []

const hz = (semitones) => 261.63 * 2 ** (semitones / 12)

function note(type, semitones, start, length, volume) {
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = type
  oscillator.frequency.value = hz(semitones)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  oscillator.connect(gain).connect(master)
  oscillator.start(start)
  oscillator.stop(start + length + 0.05)
  sounds.push(oscillator)
}

function draw() {
  frame = requestAnimationFrame(draw)
  const levels = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(levels)
  const spans = bars.value?.children ?? []
  for (let index = 0; index < spans.length; index += 1) {
    const level = levels[2 + index * 3] / 255
    spans[index].style.transform = `scaleY(${0.12 + level * 0.88})`
  }
}

function play() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  audio ??= new AudioContext()
  audio.resume()
  master = audio.createGain()
  master.gain.value = 0.5
  analyser = audio.createAnalyser()
  analyser.fftSize = 128
  master.connect(analyser).connect(audio.destination)

  let time = audio.currentTime + 0.05
  const start = time
  for (const [semitones, beats] of MELODY) {
    note('triangle', semitones, time, beats * BEAT * 1.6, 0.18)
    time += beats * BEAT
  }
  BASS.forEach((semitones, index) => note('sine', semitones, start + index * 4 * BEAT, 4 * BEAT, 0.22))

  playing.value = true
  draw()
  stopTimer = window.setTimeout(stop, (time - audio.currentTime + 0.6) * 1000)
}

function stop() {
  window.clearTimeout(stopTimer)
  cancelAnimationFrame(frame)
  for (const oscillator of sounds.splice(0)) {
    try {
      oscillator.stop()
    } catch {
      // Already finished.
    }
  }
  master?.disconnect()
  for (const span of bars.value?.children ?? []) span.style.transform = ''
  playing.value = false
}

onBeforeUnmount(() => {
  stop()
  audio?.close()
})
</script>

<template>
  <div class="tune">
    <button type="button" class="tune-button glass-secondary" :aria-pressed="playing" @click="playing ? stop() : play()">
      <svg v-if="playing" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" /></svg>
      <svg v-else viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
      {{ playing ? 'Stop the tune' : 'Play a tune' }}
    </button>
    <div ref="bars" class="tune-bars" :class="{ 'is-playing': playing }" aria-hidden="true">
      <span v-for="index in BAR_COUNT" :key="index" />
    </div>
  </div>
</template>

<style scoped>
.tune {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.tune-button svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}
/* Bars rest low and only move while the tune plays. */
.tune-bars {
  display: flex;
  height: 26px;
  align-items: flex-end;
  gap: 3px;
}
.tune-bars span {
  width: 4px;
  height: 100%;
  border-radius: 2px;
  background: var(--ui-primary);
  opacity: 0.35;
  transform: scaleY(0.12);
  transform-origin: bottom;
  transition: opacity 200ms ease;
}
.tune-bars.is-playing span {
  opacity: 0.9;
}
.tune-button {
  gap: 6px;
}
</style>
