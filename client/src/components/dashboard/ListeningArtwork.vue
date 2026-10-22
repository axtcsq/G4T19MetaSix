<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gardenParameters } from './artworkModel'
import { drawWeather } from './gardenWeather'
import { useGardenWeather } from '@/composables/useGardenWeather'
const props = defineProps({ data: { type: Object, required: true }, paused: Boolean })
const { scene, description } = useGardenWeather()
const host = ref(null)
const ready = ref(false)
const error = ref('')
const parameters = computed(() => gardenParameters(props.data))
const reduced = ref(false)
const inView = ref(true)
let instance,
  intersectionObserver,
  media,
  disposed = false
let phase = 0
const sway = () => 2.5 + Math.min(scene.value?.wind || 0, 65) * 0.16
function syncPlayback() {
  if (!instance || !ready.value) return
  if (props.paused || reduced.value || !inView.value || document.hidden) instance.noLoop()
  else instance.loop()
}
function onPreference(event) {
  reduced.value = event.matches
  syncPlayback()
}
async function initialise() {
  error.value = ''
  try {
    const { default: P5 } = await import('p5')
    if (disposed) return
    instance = new P5((p) => {
      p.setup = () => {
        const canvas = p.createCanvas(1000, 650)
        canvas.attribute('role', 'img')
        canvas.attribute(
          'aria-label',
          `A listening garden with one flower per top artist. Larger blooms represent more recorded plays in the returned Spotify history. ${description.value}.`,
        )
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
        p.frameRate(18)
        p.bezierOrder(3)
        ready.value = true
        if (props.paused || reduced.value) p.noLoop()
        syncPlayback()
      }
      // p5 2.x accepts one control/anchor point per bezierVertex call.
      const cubic = (x1, y1, x2, y2, x3, y3) => {
        p.bezierVertex(x1, y1)
        p.bezierVertex(x2, y2)
        p.bezierVertex(x3, y3)
      }
      const leaf = (x, y, angle, size) => {
        p.push()
        p.translate(x, y)
        p.rotate(angle)
        p.fill('#8d9c80')
        p.stroke('#71866d')
        p.strokeWeight(0.65)
        p.beginShape()
        p.vertex(0, 0)
        cubic(size * 0.2, -size * 0.38, size * 0.8, -size * 0.34, size, 0)
        cubic(size * 0.6, size * 0.3, size * 0.2, size * 0.16, 0, 0)
        p.endShape(p.CLOSE)
        p.noFill()
        p.stroke('#60765f')
        p.bezier(0, 0, size * 0.3, -3, size * 0.65, -3, size, 0)
        p.pop()
      }
      const bloom = (flower, index) => {
        p.push()
        p.translate(flower.x + Math.sin(phase + index) * sway(), flower.y)
        p.rotate(Math.sin(phase * 0.6 + index) * 0.018 + index * 0.23)
        const layers = flower.fullness > 0.6 ? 3 : 2
        for (let layer = 0; layer < layers; layer++) {
          const length = flower.radius * (1 - layer * 0.25),
            width = length * (0.32 + flower.fullness * 0.15)
          const tone = p.lerpColor(p.color(flower.color), p.color('#faf4e7'), layer * 0.18)
          for (let petal = 0; petal < flower.petals; petal++) {
            p.push()
            p.rotate((petal * p.TWO_PI) / flower.petals + layer * 0.28)
            const asymmetry = 1 + 0.055 * Math.sin(petal * 2.3 + index)
            p.fill(tone)
            p.stroke(p.lerpColor(p.color(flower.color), p.color('#716455'), 0.14))
            p.strokeWeight(0.65)
            p.beginShape()
            p.vertex(0, 9)
            cubic(
              -width * 0.6,
              -length * 0.1,
              -width,
              -length * 0.72,
              -width * 0.33,
              -length * asymmetry,
            )
            cubic(
              width * 0.02,
              -length * 1.12,
              width * 0.7,
              -length * 1.03,
              width * 0.72,
              -length * 0.69,
            )
            cubic(width * 0.75, -length * 0.3, width * 0.28, -length * 0.02, 0, 9)
            p.endShape(p.CLOSE)
            p.noFill()
            p.stroke(p.lerpColor(p.color(flower.color), p.color('#f7eada'), 0.48))
            p.strokeWeight(0.55)
            for (let vein = -1; vein <= 1; vein++)
              p.bezier(
                vein * 3,
                0,
                vein * width * 0.3,
                -length * 0.3,
                vein * width * 0.45,
                -length * 0.6,
                vein * width * 0.25,
                -length * 0.91,
              )
            p.pop()
          }
        }
        p.noStroke()
        p.fill(flower.center)
        p.ellipse(0, 0, flower.radius * 0.33, flower.radius * 0.29)
        for (let seed = 0; seed < 46; seed++) {
          const angle = seed * 2.39996,
            distance = Math.sqrt(seed / 46) * flower.radius * 0.14
          p.fill(seed % 3 === 0 ? '#e6c886' : '#b69758')
          p.circle(Math.cos(angle) * distance, Math.sin(angle) * distance, 1.8)
        }
        p.pop()
      }
      p.draw = () => {
        p.background('#eae8df')
        drawWeather(p, scene.value, phase * 12)
        const { flowers } = parameters.value
        flowers.forEach((flower, index) => {
          const endX = flower.x + Math.sin(phase + index) * sway(),
            endY = flower.y + 8
          const rootX = 510 + index * 3,
            bendX = flower.x + (500 - flower.x) * 0.45
          p.noFill()
          p.stroke('#71836b')
          p.strokeWeight(2.2)
          p.bezier(rootX, 620, rootX - 22, 510, bendX, endY + 90, endX, endY)
          for (let j = 0; j < flower.leaves; j++) {
            const t = 0.24 + j * 0.13
            const x = p.bezierPoint(rootX, rootX - 22, bendX, endX, t),
              y = p.bezierPoint(620, 510, endY + 90, endY, t)
            leaf(x, y, (j % 2 === 0 ? -2.6 : -0.55) + index * 0.06, 36 + (index % 3) * 10)
          }
        })
        flowers.forEach(bloom)
        drawWeather(p, scene.value, phase * 12, true)
        if (!props.paused && !reduced.value) phase += 0.009
      }
    }, host.value)
    intersectionObserver = new IntersectionObserver(([entry]) => {
      inView.value = entry.isIntersecting
      syncPlayback()
    })
    intersectionObserver.observe(host.value)
  } catch {
    instance?.remove()
    instance = undefined
    ready.value = false
    error.value = 'Your garden could not load. Try again, or explore the listening stats below.'
  }
}
watch(
  () => parameters.value.seed,
  () => {
    phase = 0
    instance?.redraw()
  },
)
watch(() => props.paused, syncPlayback)
watch(scene, () => {
  instance?.redraw()
  host.value
    ?.querySelector('canvas')
    ?.setAttribute(
      'aria-label',
      `A listening garden with one flower per top artist. Larger blooms represent more recorded plays. ${description.value}.`,
    )
})
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced.value = media.matches
  media.addEventListener('change', onPreference)
  document.addEventListener('visibilitychange', syncPlayback)
  initialise()
})
onBeforeUnmount(() => {
  disposed = true
  intersectionObserver?.disconnect()
  media?.removeEventListener('change', onPreference)
  document.removeEventListener('visibilitychange', syncPlayback)
  instance?.remove()
})
</script>
<template>
  <div class="listening-artwork">
    <div ref="host" class="artwork-canvas">
      <p v-if="!ready && !error" class="artwork-status" role="status">Growing your garden…</p>
      <div v-if="error" class="artwork-status" role="alert">
        <p>{{ error }}</p>
        <button type="button" @click="initialise">Try again</button>
      </div>
    </div>
    <div class="garden-caption">
      <p>Bigger blooms mean more recorded plays.</p>
    </div>
    <div class="garden-key">
      <p class="garden-key-title">Your top artists, by flower color</p>
      <ul>
        <li v-for="flower in parameters.flowers" :key="flower.artist">
          <i :style="{ background: flower.color }" /><span>{{ flower.artist }}</span
          ><span class="sr-only">{{ flower.plays }} recorded plays</span>
        </li>
      </ul>
    </div>
  </div>
</template>
<style scoped>
.artwork-canvas {
  position: relative;
  aspect-ratio: 1000/650;
  background: #eae8df;
  overflow: hidden;
}
.artwork-canvas :deep(canvas) {
  display: block;
  width: 100% !important;
  height: auto !important;
}
.artwork-status {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  padding: 24px;
  color: var(--dash-ink);
  font-size: 16px;
  text-align: center;
}
.garden-caption {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 20px;
  margin-top: 14px;
  font-size: 13px;
  color: var(--dash-muted);
}
.garden-caption p {
  font-size: 16px;
  color: var(--dash-ink);
  margin: 0;
  max-width: 45ch;
  line-height: 1.6;
}
button {
  min-height: 44px;
  padding-block: 0;
  color: var(--dash-ink);
  text-decoration: underline;
  text-underline-offset: 5px;
  cursor: pointer;
}
button:hover {
  color: var(--dash-accent);
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
:is(button, summary):focus-visible {
  outline: 2px solid var(--dash-accent);
  outline-offset: 4px;
}
.garden-key {
  margin-top: 4px;
  font-size: 13px;
  color: var(--dash-muted);
}
.garden-key ul {
  margin: 6px 0 12px;
  padding: 0;
  list-style: none;
  max-width: 400px;
}
.garden-key li {
  display: flex;
  align-items: center;
  gap: 10px;
  line-height: 2;
}
.garden-key li > span:last-child {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.garden-key i {
  width: 9px;
  height: 9px;
  display: inline-block;
  border-radius: 50%;
}
.garden-key p {
  max-width: 50ch;
  line-height: 1.6;
  margin: 0;
}
@media (max-width: 768px) {
  .garden-caption {
    gap: 12px;
  }
  .garden-caption p {
    font-size: 16px;
    color: var(--dash-ink);
    max-width: 26ch;
  }
}
.garden-key {
  font: 14px/1.5 var(--font-sans);
  margin-top: 12px;
}
.garden-key-title {
  color: var(--dash-ink);
  font-weight: 600;
}
.garden-key ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  max-width: none;
  margin-bottom: 8px;
}
.garden-caption p {
  font: 18px/1.4 var(--font-serif);
}
</style>
