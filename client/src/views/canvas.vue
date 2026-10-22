<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import SiteFooter from '@/components/footer.vue'

const stage = ref(null)
const canvas = ref(null)
const selectedTool = ref('pen')
const selectedColor = ref('#292321')
const brushSize = ref(5)
const drawings = ref([])
const textPosition = ref(null)
const textDraft = ref('')
const textInput = ref(null)

const colors = ['#292321', '#cd6651', '#ed8a35', '#f2c335', '#5b9a79', '#4389d1', '#998ba1']
const tools = [
  { value: 'pen', label: 'Pen', color: '#cd6651' },
  { value: 'marker', label: 'Marker', color: '#ed8a35' },
  { value: 'eraser', label: 'Eraser', color: '#998ba1' },
  { value: 'line', label: 'Line', color: '#4389d1' },
  { value: 'rectangle', label: 'Rectangle', color: '#5b9a79' },
  { value: 'circle', label: 'Circle', color: '#a17b12' },
  { value: 'text', label: 'Text', color: '#7d4737' },
]

let activeDrawing = null
let resizeObserver

function drawItem(context, item) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = item.width
  context.strokeStyle = item.color
  context.fillStyle = item.color

  if (item.type === 'marker') context.globalAlpha = 0.32
  if (item.type === 'eraser') context.globalCompositeOperation = 'destination-out'

  if (item.type === 'pen' || item.type === 'marker' || item.type === 'eraser') {
    context.beginPath()
    context.moveTo(item.points[0].x, item.points[0].y)
    item.points.forEach((point) => context.lineTo(point.x, point.y))
    context.stroke()
  } else if (item.type === 'line') {
    context.beginPath()
    context.moveTo(item.startX, item.startY)
    context.lineTo(item.endX, item.endY)
    context.stroke()
  } else if (item.type === 'rectangle') {
    context.strokeRect(item.startX, item.startY, item.endX - item.startX, item.endY - item.startY)
  } else if (item.type === 'circle') {
    const radiusX = (item.endX - item.startX) / 2
    const radiusY = (item.endY - item.startY) / 2
    const centerX = item.startX + radiusX
    const centerY = item.startY + radiusY
    context.beginPath()
    context.ellipse(centerX, centerY, Math.abs(radiusX), Math.abs(radiusY), 0, 0, Math.PI * 2)
    context.stroke()
  } else if (item.type === 'text') {
    context.font = `600 ${item.width}px Raleway, sans-serif`
    item.text.split('\n').forEach((line, index) => {
      context.fillText(line, item.x, item.y + index * item.width * 1.4)
    })
  }

  context.restore()
}

function redrawCanvas() {
  if (!canvas.value || !stage.value) return
  const context = canvas.value.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, stage.value.clientWidth, stage.value.clientHeight)
  drawings.value.forEach((item) => drawItem(context, item))
  if (activeDrawing) drawItem(context, activeDrawing)
}

function resizeCanvas() {
  if (!canvas.value || !stage.value) return
  const ratio = window.devicePixelRatio || 1
  const width = stage.value.clientWidth
  const height = stage.value.clientHeight
  canvas.value.width = width * ratio
  canvas.value.height = height * ratio
  const context = canvas.value.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  redrawCanvas()
}

function getPoint(event) {
  const bounds = canvas.value.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function startDrawing(event) {
  if (selectedTool.value === 'text') {
    textPosition.value = getPoint(event)
    textDraft.value = ''
    nextTick(() => textInput.value?.focus())
    return
  }

  const point = getPoint(event)
  activeDrawing = {
    type: selectedTool.value,
    color: selectedColor.value,
    width: selectedTool.value === 'marker' ? brushSize.value * 3 : brushSize.value,
    startX: point.x,
    startY: point.y,
    endX: point.x,
    endY: point.y,
    points: [point],
  }
  canvas.value.setPointerCapture(event.pointerId)
}

function continueDrawing(event) {
  if (!activeDrawing) return
  const point = getPoint(event)
  if (activeDrawing.points) activeDrawing.points.push(point)
  activeDrawing.endX = point.x
  activeDrawing.endY = point.y
  redrawCanvas()
}

function finishDrawing() {
  if (!activeDrawing) return
  drawings.value.push(activeDrawing)
  activeDrawing = null
  redrawCanvas()
}

function addText() {
  const text = textDraft.value.trim()
  if (!text || !textPosition.value) return

  drawings.value.push({
    type: 'text',
    text,
    x: textPosition.value.x,
    y: textPosition.value.y + brushSize.value * 2,
    width: Math.max(16, brushSize.value * 4),
    color: selectedColor.value,
  })
  textPosition.value = null
  textDraft.value = ''
  redrawCanvas()
}

function cancelText() {
  textPosition.value = null
  textDraft.value = ''
}

function undoDrawing() {
  drawings.value.pop()
  redrawCanvas()
}

function clearCanvas() {
  drawings.value = []
  activeDrawing = null
  cancelText()
  redrawCanvas()
}

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(stage.value)
  resizeCanvas()
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div class="canvas-page">
    <main class="canvas-content">
      <div class="canvas-heading">
        <h1 class="page-title">Canvas</h1>
        <p>Can't describe your thoughts? Draw it.</p>
      </div>

      <section class="drawing-panel" aria-label="Drawing canvas">
        <div class="drawing-toolbar">
          <div class="tool-group" role="group" aria-label="Drawing tools">
            <button
              v-for="tool in tools"
              :key="tool.value"
              type="button"
              class="tool-button"
              :class="{ 'is-active': selectedTool === tool.value }"
              :style="{ '--tool-accent': tool.color }"
              :data-tooltip="tool.label"
              :aria-label="`${tool.label} tool`"
              :title="tool.label"
              :aria-pressed="selectedTool === tool.value"
              @click="selectedTool = tool.value"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <template v-if="tool.value === 'pen'">
                  <path d="m4 20 4.2-1 10.9-10.9-3.2-3.2L5 15.8 4 20Z" />
                  <path d="m14.8 6.2 3.2 3.2M4 20l4.2-1" />
                </template>
                <template v-else-if="tool.value === 'marker'">
                  <path d="m4 16 10-10 5 5L9 21H4v-5Z" />
                  <path d="m12 8 5 5M4 18h5" />
                </template>
                <template v-else-if="tool.value === 'eraser'">
                  <path d="m4 14 9-10 7 7-9 10H7l-3-3v-4Z" />
                  <path d="m10 21 7-8" />
                </template>
                <template v-else-if="tool.value === 'line'"><path d="m4 19 16-14" /></template>
                <template v-else-if="tool.value === 'rectangle'"><rect x="4" y="5" width="16" height="14" rx="1" /></template>
                <template v-else-if="tool.value === 'circle'"><circle cx="12" cy="12" r="8" /></template>
                <template v-else><path d="M5 4h14v16H5zM9 8h6M12 8v9" /></template>
              </svg>
            </button>
          </div>

          <div class="color-controls">
            <span class="toolbar-label">Color</span>
            <button
              v-for="color in colors"
              :key="color"
              type="button"
              class="color-swatch"
              :class="{ 'is-selected': selectedColor === color }"
              :style="{ '--swatch-color': color }"
              :aria-label="`Choose ${color} color`"
              :title="`Choose ${color} color`"
              :aria-pressed="selectedColor === color"
              @click="selectedColor = color"
            ></button>
            <label class="custom-color" aria-label="Choose a custom color">
              <span aria-hidden="true">+</span>
              <input v-model="selectedColor" type="color" title="Choose a custom color" />
            </label>
          </div>

          <label class="size-control">
            <span class="toolbar-label">Size</span>
            <input v-model="brushSize" type="range" min="2" max="14" />
          </label>

          <div class="canvas-actions">
            <button
              type="button"
              class="canvas-action"
              aria-label="Undo last action"
              title="Undo"
              :disabled="drawings.length === 0"
              @click="undoDrawing"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h9a7 7 0 0 1 0 14h-2" />
              </svg>
            </button>
            <button
              type="button"
              class="canvas-action"
              aria-label="Clear canvas"
              title="Clear canvas"
              :disabled="drawings.length === 0"
              @click="clearCanvas"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        </div>

        <p class="canvas-hint">
          Choose a tool and draw on the canvas. Select Text, then click where you want your words.
        </p>

        <div ref="stage" class="drawing-stage">
          <canvas
            ref="canvas"
            aria-label="Drawing area"
            @pointerdown="startDrawing"
            @pointermove="continueDrawing"
            @pointerup="finishDrawing"
            @pointercancel="finishDrawing"
            @lostpointercapture="finishDrawing"
          ></canvas>

          <form
            v-if="textPosition"
            class="text-editor"
            :style="{ left: `${textPosition.x}px`, top: `${textPosition.y}px` }"
            @submit.prevent="addText"
            @pointerdown.stop
          >
            <textarea
              ref="textInput"
              v-model="textDraft"
              placeholder="Write something..."
              rows="3"
            />
            <div class="text-editor-actions">
              <button type="button" @click="cancelText">Cancel</button>
              <button type="submit">Add text</button>
            </div>
          </form>
        </div>
      </section>

      <section class="analysis-section" aria-labelledby="analysis-heading">
        <h2 id="analysis-heading" class="section-title">AI Analysis</h2>
        <textarea
          class="analysis-output"
          value="Your canvas analysis will appear here once an AI service is connected."
          readonly
          aria-label="Canvas analysis placeholder"
        ></textarea>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.canvas-page {
  display: flex;
  min-height: calc(100vh - 76px);
  flex-direction: column;
  background: var(--ui-bg-accented);
  color: var(--ui-text);
}

.canvas-content {
  width: min(1180px, calc(100% - 56px));
  flex: 1;
  margin-inline: auto;
  padding-block: clamp(32px, 5vw, 58px) 56px;
}

.canvas-heading {
  margin-bottom: 26px;
  text-align: center;
}

.canvas-heading h1 {
  margin: 0;
}

.canvas-heading > p:last-child {
  margin: 5px 0 0;
  color: var(--ui-text-muted);
  font-size: 1rem;
}

.drawing-panel {
  padding: 20px;
  border: 1px solid var(--ui-border);
  border-radius: 18px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 8px 24px rgba(59, 43, 35, 0.06);
}

.drawing-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 22px;
}

.tool-group,
.color-controls,
.canvas-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.tool-button,
.canvas-action,
.text-editor-actions button {
  min-height: 38px;
  padding: 0 13px;
  border: 1px solid #ded3ce;
  border-radius: 9999px;
  color: #514742;
  background: #faf8f6;
  font: 600 0.85rem var(--font-sans);
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}

.tool-button,
.canvas-action {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  min-height: 42px;
  padding: 0;
  place-items: center;
  border-color: rgba(255, 255, 255, 0.94);
  border-radius: 50%;
  color: var(--tool-accent, #514742);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.54)),
    linear-gradient(180deg, #fff, #eee9e6);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.98),
    inset 0 -2px 4px rgba(86, 65, 55, 0.12),
    0 3px 8px rgba(59, 43, 35, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.tool-button svg,
.canvas-action svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.tool-button::after,
.tool-button::before {
  position: absolute;
  z-index: 5;
  left: 50%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease, transform 120ms ease;
}

.tool-button::after {
  bottom: calc(100% + 9px);
  padding: 5px 9px;
  transform: translate(-50%, 4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 7px;
  color: #fff;
  background: #292321;
  box-shadow: 0 4px 10px rgba(41, 35, 33, 0.2);
  content: attr(data-tooltip);
  font: 600 0.76rem/1.2 var(--font-sans);
  white-space: nowrap;
}

.tool-button::before {
  bottom: calc(100% + 3px);
  transform: translate(-50%, 4px);
  border: 4px solid transparent;
  border-top-color: #292321;
  content: '';
}

.tool-button:hover::after,
.tool-button:hover::before,
.tool-button:focus-visible::after,
.tool-button:focus-visible::before {
  transform: translate(-50%, 0);
  opacity: 1;
}

.tool-button:hover,
.canvas-action:hover:not(:disabled),
.text-editor-actions button:hover {
  border-color: var(--color-brand-500);
}

.tool-button:hover,
.canvas-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.98),
    inset 0 -2px 4px rgba(86, 65, 55, 0.14),
    0 5px 11px rgba(59, 43, 35, 0.16);
}

.tool-button.is-active {
  border-color: color-mix(in srgb, var(--tool-accent), white 52%);
  color: var(--tool-accent);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.06) 58%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--tool-accent), white 72%),
      color-mix(in srgb, var(--tool-accent), white 85%) 68%
    );
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.88),
    inset 0 -3px 5px color-mix(in srgb, var(--tool-accent), transparent 78%),
    0 4px 10px color-mix(in srgb, var(--tool-accent), transparent 82%);
}

.toolbar-label {
  color: var(--ui-text-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.color-swatch {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.96);
  border-radius: 50%;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.02) 54%),
    var(--swatch-color);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.66),
    inset 0 -2px 3px rgba(50, 38, 33, 0.2),
    0 2px 6px rgba(59, 43, 35, 0.16);
  cursor: pointer;
  transition: box-shadow 140ms ease, transform 140ms ease;
}

.color-swatch:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.8),
    inset 0 -2px 3px rgba(50, 38, 33, 0.2),
    0 4px 9px rgba(59, 43, 35, 0.2);
}

.color-swatch.is-selected {
  box-shadow:
    0 0 0 2px var(--color-brand-500),
    inset 0 2px 2px rgba(255, 255, 255, 0.66),
    inset 0 -2px 3px rgba(50, 38, 33, 0.2),
    0 3px 8px rgba(59, 43, 35, 0.17);
}

.custom-color {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  overflow: hidden;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.96);
  border-radius: 50%;
  color: #514742;
  background: linear-gradient(180deg, #fff, #eee9e6);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.98),
    inset 0 -2px 4px rgba(86, 65, 55, 0.12),
    0 3px 8px rgba(59, 43, 35, 0.12);
  font-size: 1.2rem;
  font-weight: 500;
  cursor: pointer;
}

.custom-color input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.size-control {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.size-control input {
  width: 100px;
  accent-color: var(--color-brand-500);
}

.canvas-actions {
  margin-left: auto;
}

.canvas-action:disabled {
  border-color: rgba(255, 255, 255, 0.88);
  color: #a59d99;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.32)),
    linear-gradient(180deg, #e6e2df, #d7d1cd);
  box-shadow:
    inset 0 2px 2px rgba(255, 255, 255, 0.88),
    inset 0 -2px 4px rgba(86, 65, 55, 0.08),
    0 2px 5px rgba(59, 43, 35, 0.08);
  cursor: not-allowed;
  transform: none;
}

.canvas-action:focus-visible,
.tool-button:focus-visible,
.color-swatch:focus-visible,
.custom-color:focus-within {
  outline: 3px solid rgba(205, 102, 81, 0.35);
  outline-offset: 3px;
}

.canvas-hint {
  margin: 16px 0 12px;
  color: var(--ui-text-muted);
  font-size: 0.85rem;
}

.drawing-stage {
  position: relative;
  height: clamp(360px, 58vw, 620px);
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: #faf8f6;
}

.drawing-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
}

.analysis-section {
  margin-top: 34px;
}

.analysis-section h2 {
  margin: 0 0 12px;
}

.analysis-output {
  display: block;
  width: 100%;
  min-height: 205px;
  padding: 20px;
  resize: vertical;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  color: var(--ui-text);
  background: var(--ui-bg-elevated);
  box-shadow: inset 0 2px 5px rgba(59, 43, 35, 0.04);
  font: 1rem/1.65 var(--font-sans);
}

.analysis-output:focus {
  outline: 2px solid rgba(205, 102, 81, 0.3);
  outline-offset: 2px;
}

.text-editor {
  position: absolute;
  z-index: 1;
  width: min(230px, calc(100% - 20px));
  padding: 9px;
  border: 1px solid #e7dcd7;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(59, 43, 35, 0.14);
}

.text-editor textarea {
  display: block;
  width: 100%;
  resize: vertical;
  border: 0;
  outline: none;
  color: #292321;
  font: 0.9rem/1.4 var(--font-sans);
}

.text-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 7px;
}

.text-editor-actions button {
  min-height: 32px;
  padding-inline: 10px;
  font-size: 0.75rem;
}

.text-editor-actions button[type='submit'] {
  border-color: var(--color-brand-500);
  color: #fff;
  background: var(--color-brand-500);
}

@media (max-width: 768px) {
  .canvas-content {
    width: calc(100% - 32px);
  }

  .drawing-panel {
    padding: 13px;
  }

  .drawing-toolbar {
    gap: 13px;
  }

  .canvas-actions {
    margin-left: 0;
  }

  .drawing-stage {
    height: min(125vw, 540px);
  }

  .analysis-output {
    min-height: 180px;
    padding: 15px;
  }
}
</style>
