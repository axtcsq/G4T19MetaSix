<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { drawItem } from './drawItem'

const props = defineProps({
  drawing: { type: Object, required: true },
  label: { type: String, required: true },
})
const stage = ref(null)
const note = ref(null)
const canvas = ref(null)
const x = ref(0)
const y = ref(0)
const moved = ref(false)
const dragging = ref(false)
let observer
let previousWidth = 0
let start

function place(nextX, nextY) {
  if (!stage.value || !note.value) return
  x.value = Math.max(12, Math.min(nextX, stage.value.clientWidth - note.value.offsetWidth - 12))
  y.value = Math.max(16, Math.min(nextY, stage.value.clientHeight - note.value.offsetHeight - 12))
}
function layout() {
  if (!stage.value?.clientWidth) return
  if (previousWidth !== stage.value.clientWidth) {
    moved.value = false
    previousWidth = stage.value.clientWidth
  }
  place(
    moved.value ? x.value : stage.value.clientWidth - note.value.offsetWidth - 20,
    moved.value ? y.value : stage.value.clientHeight - note.value.offsetHeight - 20,
  )
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
function grab(event) {
  if (event.button !== 0) return
  start = { pointerX: event.clientX, pointerY: event.clientY, x: x.value, y: y.value }
  event.currentTarget.setPointerCapture(event.pointerId)
  dragging.value = true
}
function drag(event) {
  if (!dragging.value) return
  moved.value = true
  place(start.x + event.clientX - start.pointerX, start.y + event.clientY - start.pointerY)
}
function release() {
  dragging.value = false
}
function move(dx, dy) {
  moved.value = true
  place(x.value + dx, y.value + dy)
}
function onKey(event) {
  const directions = {
    ArrowLeft: [-16, 0],
    ArrowRight: [16, 0],
    ArrowUp: [0, -16],
    ArrowDown: [0, 16],
  }
  if (!directions[event.key]) return
  event.preventDefault()
  move(...directions[event.key])
}
const directions = [
  { label: 'Move drawing left', dx: -24, dy: 0, path: 'm14 6-6 6 6 6' },
  { label: 'Move drawing up', dx: 0, dy: -24, path: 'm6 14 6-6 6 6' },
  { label: 'Move drawing down', dx: 0, dy: 24, path: 'm6 10 6 6 6-6' },
  { label: 'Move drawing right', dx: 24, dy: 0, path: 'm10 6 6 6-6 6' },
]
onMounted(() => {
  observer = new ResizeObserver(layout)
  observer.observe(stage.value)
  nextTick(layout)
})
watch(
  () => props.drawing,
  () => nextTick(layout),
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="stage" class="note-stage">
    <aside
      ref="note"
      class="drawing-note"
      :class="{ 'is-dragging': dragging }"
      :style="{ transform: 'translate(' + x + 'px,' + y + 'px)' }"
      :aria-label="label"
    >
      <svg class="paper-clip" viewBox="0 0 32 70" aria-hidden="true">
        <path d="M23 47V15a9 9 0 0 0-18 0v38a12 12 0 0 0 24 0V20M11 44V16a3 3 0 0 1 6 0v33" />
      </svg>
      <button
        type="button"
        class="note-handle"
        aria-label="Move drawing. Drag or use arrow keys."
        @pointerdown="grab"
        @pointermove="drag"
        @pointerup="release"
        @pointercancel="release"
        @lostpointercapture="release"
        @keydown="onKey"
      >
        A little sketch
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8h.01M16 8h.01M8 12h.01M16 12h.01M8 16h.01M16 16h.01" />
        </svg>
      </button>
      <canvas ref="canvas" role="img" :aria-label="label" />
      <div class="note-moves" aria-label="Move drawing">
        <button
          v-for="direction in directions"
          :key="direction.label"
          type="button"
          :aria-label="direction.label"
          :title="direction.label"
          @click="move(direction.dx, direction.dy)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="direction.path" /></svg>
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.note-stage {
  position: absolute;
  inset: 0;
  pointer-events: none;
  white-space: normal;
}
.drawing-note {
  position: absolute;
  top: 0;
  left: 0;
  width: min(240px, calc(100% - 32px));
  padding: 12px 14px 4px;
  background: #f8e6aa;
  color: #51432d;
  box-shadow: 2px 7px 12px #3a2b2426;
  pointer-events: auto;
  border-radius: 2px 2px 12px 2px;
}
.drawing-note.is-dragging {
  box-shadow: 3px 12px 20px #3a2b2433;
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
.note-handle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  padding-left: 32px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  font: 600 12px var(--font-sans);
}
.is-dragging .note-handle {
  cursor: grabbing;
}
.note-handle svg {
  width: 20px;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
}
canvas {
  display: block;
  width: 100%;
  height: 146px;
}
.note-moves {
  display: flex;
  justify-content: flex-end;
}
.note-moves button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  cursor: pointer;
  border-radius: 4px;
}
.note-moves button:hover {
  background: #e7cc82;
}
.note-moves svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
button:focus-visible {
  outline: 2px solid #7d4737;
  outline-offset: 2px;
}
@media (forced-colors: active) {
  .drawing-note {
    background: Canvas;
    color: CanvasText;
    border: 1px solid CanvasText;
  }
}
</style>
