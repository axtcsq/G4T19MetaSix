<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { drawItem } from './drawItem'

// A saved drawing on a sticky note, clipped to a past entry beside its Song
// of the Day, right after the writing.
const props = defineProps({
  drawing: { type: Object, required: true },
  label: { type: String, required: true },
})
const canvas = ref(null)
let observer

function layout() {
  const context = canvas.value?.getContext('2d')
  if (!context) return
  const width = canvas.value.clientWidth
  const height = canvas.value.clientHeight
  const ratio = window.devicePixelRatio || 1
  canvas.value.width = width * ratio
  canvas.value.height = height * ratio
  context.scale(ratio, ratio)
  const scale = Math.min(width / props.drawing.width, height / props.drawing.height)
  if (!Number.isFinite(scale) || scale <= 0) return
  context.translate(
    (width - props.drawing.width * scale) / 2,
    (height - props.drawing.height * scale) / 2,
  )
  context.scale(scale, scale)
  props.drawing.items.forEach((item) => drawItem(context, item))
}
onMounted(() => {
  observer = new ResizeObserver(layout)
  observer.observe(canvas.value)
  nextTick(layout)
})
watch(
  () => props.drawing,
  () => nextTick(layout),
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <aside class="drawing-note" :aria-label="label">
    <svg class="paper-clip" viewBox="0 0 32 70" aria-hidden="true">
      <path d="M23 47V15a9 9 0 0 0-18 0v38a12 12 0 0 0 24 0V20M11 44V16a3 3 0 0 1 6 0v33" />
    </svg>
    <p class="note-title">A little sketch</p>
    <canvas ref="canvas" role="img" :aria-label="label" />
  </aside>
</template>

<style scoped>
/* A slight tilt, so the note still looks clipped on by hand. */
.drawing-note {
  position: relative;
  width: min(240px, 100%);
  padding: 12px 14px 16px;
  background: #f8e6aa;
  color: #51432d;
  box-shadow: 2px 7px 12px #3a2b2426;
  border-radius: 2px 2px 12px 2px;
  transform: rotate(1.5deg);
  white-space: normal;
}
.paper-clip {
  position: absolute;
  top: -19px;
  left: 20px;
  width: 24px;
  height: 54px;
  fill: none;
  stroke: #7f8585;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(1px 2px 1px #0002);
  pointer-events: none;
}
.note-title {
  display: flex;
  align-items: center;
  min-height: 32px;
  margin: 0;
  padding-left: 32px;
  font: 600 12px var(--font-sans);
}
canvas {
  display: block;
  width: 100%;
  height: 146px;
}
@media (forced-colors: active) {
  .drawing-note {
    background: Canvas;
    color: CanvasText;
    border: 1px solid CanvasText;
  }
}
</style>
