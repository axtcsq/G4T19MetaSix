<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// The Spotify tile or the journal on the landing page, built from simple
// shapes so there is no model file to load. Their textures are drawn here too,
// with grain and worn edges to match the cassette above them. Each one sways
// gently and can be dragged round.
const props = defineProps({
  object: {
    type: String,
    required: true,
    validator: (value) => ['spotify', 'journal'].includes(value),
  },
  // False when the page moves the whole canvas instead, like dragging the
  // Spotify tile into the journal.
  rotatable: { type: Boolean, default: true },
})

const canvas = ref(null)
// How far back the camera sits, and the box shape that distance was set for.
// A narrower box moves the camera back so nothing is cut off.
const FRAMING = {
  spotify: { distance: 5.2, aspect: 1 },
  journal: { distance: 6.4, aspect: 300 / 230 },
}
const LABELS = {
  spotify: '3D Spotify icon. Drag to rotate.',
  journal: '3D journal with a ribbon bookmark and a pencil. Drag to rotate.',
}

let renderer
let scene
let camera
let controls
let model
let frame
let resizeObserver
let environment
const timer = new THREE.Timer()

// A small seeded random, so the textures look the same on every visit.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Draws a texture on a canvas. Colour maps are sRGB; roughness and bump maps
// are plain data, so they're left linear.
function paint(width, height, drawTexture, { colour = true } = {}) {
  const board = document.createElement('canvas')
  board.width = width
  board.height = height
  drawTexture(board.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(board)
  if (colour) texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// Soft blotches and fine speckle, like the grain on worn plastic or leather.
function grain(draw, width, height, { seed, blotches = 40, speckle = 16 }) {
  const random = seeded(seed)
  for (let index = 0; index < blotches; index += 1) {
    const x = random() * width
    const y = random() * height
    const radius = (0.04 + random() * 0.12) * Math.max(width, height)
    const glow = draw.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    draw.fillStyle = glow
    draw.fillRect(0, 0, width, height)
  }
  const image = draw.getImageData(0, 0, width, height)
  for (let index = 0; index < image.data.length; index += 4) {
    const shift = (random() - 0.5) * speckle
    image.data[index] += shift
    image.data[index + 1] += shift
    image.data[index + 2] += shift
  }
  draw.putImageData(image, 0, 0)
}

// Lighter scuffs and short scratches along the edges, where things wear first.
function wornEdges(draw, width, height, { seed, colour, size = 0.07, scratches = 30 }) {
  const random = seeded(seed)
  const depth = size * Math.min(width, height)
  const sides = [
    [0, 0, 0, depth, 0, 0, width, depth],
    [0, height, 0, height - depth, 0, height - depth, width, depth],
    [0, 0, depth, 0, 0, 0, depth, height],
    [width, 0, width - depth, 0, width - depth, 0, depth, height],
  ]
  for (const [x0, y0, x1, y1, left, top, w, h] of sides) {
    const fade = draw.createLinearGradient(x0, y0, x1, y1)
    fade.addColorStop(0, colour)
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    draw.fillStyle = fade
    draw.fillRect(left, top, w, h)
  }
  draw.strokeStyle = colour
  draw.lineCap = 'round'
  for (let index = 0; index < scratches; index += 1) {
    // Pick a spot near one of the four edges.
    const along = random()
    const inset = random() * depth * 1.4
    const side = Math.floor(random() * 4)
    const x = side < 2 ? along * width : side === 2 ? inset : width - inset
    const y = side >= 2 ? along * height : side === 0 ? inset : height - inset
    const angle = random() * Math.PI
    const length = (0.01 + random() * 0.04) * width
    draw.lineWidth = 0.5 + random() * 1.5
    draw.beginPath()
    draw.moveTo(x, y)
    draw.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    draw.stroke()
  }
}

// A grey map with the same grain, for roughness or bumps.
function greyGrain(seed, level, speckle, size = 256) {
  return paint(
    size,
    size,
    (draw) => {
      draw.fillStyle = `rgb(${level},${level},${level})`
      draw.fillRect(0, 0, size, size)
      grain(draw, size, size, { seed, blotches: 25, speckle })
    },
    { colour: false },
  )
}

// The icon's three sound waves, in units of the disc's width (y runs down):
// where each starts, the point it bows towards, where it ends, and how thick.
const WAVES = [
  [0.225, 0.37, 0.5, 0.2, 0.78, 0.405, 0.092],
  [0.265, 0.525, 0.5, 0.4, 0.745, 0.555, 0.074],
  [0.3, 0.675, 0.5, 0.585, 0.705, 0.7, 0.058],
]
function drawWaves(draw, size) {
  draw.lineCap = 'round'
  for (const [x0, y0, cx, cy, x1, y1, thickness] of WAVES) {
    draw.lineWidth = thickness * size
    draw.beginPath()
    draw.moveTo(x0 * size, y0 * size)
    draw.quadraticCurveTo(cx * size, cy * size, x1 * size, y1 * size)
    draw.stroke()
  }
}

function buildSpotify() {
  const group = new THREE.Group()

  // Soft-touch black plastic with scuffed edges, like the cassette's shell.
  const shell = new THREE.MeshPhysicalMaterial({
    map: paint(512, 512, (draw, width, height) => {
      draw.fillStyle = '#1e1e20'
      draw.fillRect(0, 0, width, height)
      wornEdges(draw, width, height, { seed: 3, colour: 'rgba(150,150,158,0.28)' })
      grain(draw, width, height, { seed: 4, speckle: 14 })
    }),
    roughnessMap: greyGrain(5, 150, 60),
    bumpMap: greyGrain(6, 128, 90),
    bumpScale: 1.2,
    clearcoat: 0.25,
    clearcoatRoughness: 0.45,
  })
  // The corner radius has to stay under half the depth, or the sides fold in.
  group.add(new THREE.Mesh(new RoundedBoxGeometry(2, 2, 0.6, 8, 0.28), shell))

  // The green disc: a short open tube, a rounded rim and a printed face. The
  // face is its own circle so nothing sits on top of the tube's ends.
  const green = new THREE.MeshPhysicalMaterial({
    color: 0x1ed760,
    roughness: 0.35,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  })
  const side = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 64, 1, true), green)
  side.rotation.x = Math.PI / 2
  side.position.z = 0.32
  group.add(side)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.03, 16, 96), green)
  rim.position.z = 0.36
  group.add(rim)

  const face = new THREE.MeshPhysicalMaterial({
    map: paint(1024, 1024, (draw, size) => {
      draw.fillStyle = '#1ed760'
      draw.fillRect(0, 0, size, size)
      draw.strokeStyle = '#161616'
      drawWaves(draw, size)
    }),
    // The logo is kept clean: no grain or wear, just matte waves on the
    // shiny green.
    roughnessMap: paint(
      512,
      512,
      (draw, size) => {
        draw.fillStyle = '#555'
        draw.fillRect(0, 0, size, size)
        draw.strokeStyle = '#d0d0d0'
        drawWaves(draw, size)
      },
      { colour: false },
    ),
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
  })
  const front = new THREE.Mesh(new THREE.CircleGeometry(0.69, 96), face)
  front.position.z = 0.39
  group.add(front)

  group.rotation.set(0.25, -0.5, 0.18)
  return group
}

// Navy leather: grain, darker mottling and paler worn edges.
function leather(draw, width, height, seed) {
  draw.fillStyle = '#2a4572'
  draw.fillRect(0, 0, width, height)
  wornEdges(draw, width, height, {
    seed,
    colour: 'rgba(170,185,210,0.3)',
    size: 0.05,
    scratches: 40,
  })
  grain(draw, width, height, { seed: seed + 1, blotches: 60, speckle: 22 })
}

// The front cover, drawn at the cover's own shape: 400 pixels to a unit. It
// has a pressed border and a paper label, like the label on the cassette.
const COVER = { width: 720, height: 920 }
const LABEL = { x: 150, y: 170, width: 420, height: 230 }
function drawCover(draw, width, height) {
  leather(draw, width, height, 11)

  // The pressed border: a dark groove with a pale edge under it.
  for (const [colour, shift] of [
    ['rgba(255,255,255,0.12)', 2],
    ['rgba(0,0,0,0.4)', 0],
  ]) {
    draw.strokeStyle = colour
    draw.lineWidth = 4
    draw.strokeRect(46 + shift, 46 + shift, width - 92, height - 92)
  }

  const { x, y, width: w, height: h } = LABEL
  draw.save()
  draw.shadowColor = 'rgba(0,0,0,0.35)'
  draw.shadowBlur = 8
  draw.shadowOffsetY = 3
  draw.fillStyle = '#efe4c8'
  draw.beginPath()
  draw.roundRect(x, y, w, h, 10)
  draw.fill()
  draw.restore()

  // Paper grain and a darker rim, only on the label.
  draw.save()
  draw.beginPath()
  draw.roundRect(x, y, w, h, 10)
  draw.clip()
  const rim = draw.createRadialGradient(
    x + w / 2,
    y + h / 2,
    h * 0.3,
    x + w / 2,
    y + h / 2,
    w * 0.7,
  )
  rim.addColorStop(0, 'rgba(0,0,0,0)')
  rim.addColorStop(1, 'rgba(120,80,30,0.22)')
  draw.fillStyle = rim
  draw.fillRect(x, y, w, h)
  draw.fillStyle = '#c95f4b'
  draw.fillRect(x, y + 26, w, 10)
  draw.restore()

  draw.fillStyle = '#7d4737'
  draw.textAlign = 'center'
  draw.font = '700 24px "Helvetica Neue", Arial, sans-serif'
  draw.letterSpacing = '6px'
  draw.fillText('METAFOR', x + w / 2, y + 78)
  draw.letterSpacing = '0px'
  draw.fillStyle = '#3b2a22'
  draw.font = 'italic 600 76px Georgia, "Times New Roman", serif'
  draw.fillText('Journal', x + w / 2, y + 158)
  draw.strokeStyle = 'rgba(59,42,34,0.35)'
  draw.lineWidth = 2
  draw.beginPath()
  draw.moveTo(x + 40, y + 186)
  draw.lineTo(x + w - 40, y + 186)
  draw.stroke()
  draw.fillStyle = '#7d4737'
  draw.font = '600 20px "Helvetica Neue", Arial, sans-serif'
  draw.textAlign = 'right'
  draw.fillText('VOL. 01', x + w - 40, y + 212)
}

// Bumps for the cover: leather grain, the sunken border and the raised label.
function drawCoverBumps(draw, width, height) {
  draw.fillStyle = '#808080'
  draw.fillRect(0, 0, width, height)
  grain(draw, width, height, { seed: 21, blotches: 10, speckle: 70 })
  draw.strokeStyle = '#303030'
  draw.lineWidth = 6
  draw.strokeRect(46, 46, width - 92, height - 92)
  draw.filter = 'blur(1.5px)'
  draw.fillStyle = '#b8b8b8'
  draw.beginPath()
  draw.roundRect(LABEL.x, LABEL.y, LABEL.width, LABEL.height, 10)
  draw.fill()
}

// Page edges: fine lines a little uneven in shade, slightly yellowed. The
// lines run along the edge, so the sides and the top and bottom need them
// turned different ways.
function pageEdges(across) {
  return paint(256, 256, (draw, size) => {
    draw.fillStyle = '#f6edd5'
    draw.fillRect(0, 0, size, size)
    const random = seeded(across ? 31 : 32)
    for (let at = 0; at < size; at += 3) {
      draw.fillStyle = `rgba(150,120,70,${0.12 + random() * 0.25})`
      if (across) draw.fillRect(0, at, size, 1)
      else draw.fillRect(at, 0, 1, size)
    }
    grain(draw, size, size, { seed: 33, blotches: 12, speckle: 8 })
  })
}

function buildJournal() {
  const group = new THREE.Group()
  const bumps = greyGrain(12, 128, 80)
  const leatherMaterial = (map, extra = {}) =>
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.62,
      bumpMap: bumps,
      bumpScale: 1.4,
      sheen: 0.4,
      sheenColor: 0x9fb4d8,
      ...extra,
    })
  const plain = leatherMaterial(paint(512, 512, (draw, w, h) => leather(draw, w, h, 13)))
  const front = leatherMaterial(paint(COVER.width, COVER.height, drawCover), {
    bumpMap: paint(COVER.width, COVER.height, drawCoverBumps, { colour: false }),
    bumpScale: 2,
  })

  // Front and back boards, the spine flush with their left edge, and the
  // pages between them. Each corner radius stays under half the thickness,
  // and the pages are a touch thinner than the gap, so no faces overlap. The
  // faces go right, left, top, bottom, front, back.
  const boardGeometry = new RoundedBoxGeometry(1.8, 2.3, 0.07, 3, 0.02)
  const frontBoard = new THREE.Mesh(boardGeometry, [plain, plain, plain, plain, front, plain])
  frontBoard.position.z = 0.15
  group.add(frontBoard)
  const backBoard = new THREE.Mesh(boardGeometry, plain)
  backBoard.position.z = -0.15
  group.add(backBoard)
  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.1, 2.3, 0.37, 3, 0.04), plain)
  spine.position.x = -0.85
  group.add(spine)

  const paper = new THREE.MeshStandardMaterial({ color: 0xf4e8c8, roughness: 0.9 })
  const sides = new THREE.MeshStandardMaterial({ map: pageEdges(false), roughness: 0.9 })
  const ends = new THREE.MeshStandardMaterial({ map: pageEdges(true), roughness: 0.9 })
  const pages = new THREE.Mesh(new THREE.BoxGeometry(1.68, 2.2, 0.22), [
    sides,
    sides,
    ends,
    ends,
    paper,
    paper,
  ])
  pages.position.x = 0.03
  group.add(pages)

  // A satin ribbon bookmark hanging out of the bottom, with a notched end.
  const ribbonShape = new THREE.Shape()
  ribbonShape.moveTo(-0.07, 0)
  ribbonShape.lineTo(0.07, 0)
  ribbonShape.lineTo(0.07, -0.62)
  ribbonShape.lineTo(0, -0.52)
  ribbonShape.lineTo(-0.07, -0.62)
  ribbonShape.closePath()
  const ribbon = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ribbonShape, { depth: 0.012, bevelEnabled: false }),
    new THREE.MeshPhysicalMaterial({
      color: 0xc63b2c,
      roughness: 0.5,
      sheen: 1,
      sheenColor: 0xff9a84,
      side: THREE.DoubleSide,
    }),
  )
  ribbon.position.set(0.15, -1.05, 0)
  ribbon.rotation.set(0.5, 0, 0.12)
  group.add(ribbon)

  // A painted yellow pencil lying across the bottom of the cover, below the
  // label, with its tip just past the edge.
  const pencil = new THREE.Group()
  const painted = new THREE.MeshPhysicalMaterial({
    map: paint(128, 128, (draw, size) => {
      draw.fillStyle = '#f0ae27'
      draw.fillRect(0, 0, size, size)
      grain(draw, size, size, { seed: 41, blotches: 8, speckle: 12 })
    }),
    roughness: 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
  })
  pencil.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.5, 6), painted))
  const wood = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.24, 6),
    new THREE.MeshStandardMaterial({
      map: paint(128, 128, (draw, size) => {
        draw.fillStyle = '#e2bf8c'
        draw.fillRect(0, 0, size, size)
        const random = seeded(42)
        for (let at = 0; at < size; at += 4) {
          draw.fillStyle = `rgba(140,90,40,${0.1 + random() * 0.2})`
          draw.fillRect(at, 0, 2, size)
        }
      }),
      roughness: 0.85,
    }),
  )
  wood.position.y = -0.87
  wood.rotation.x = Math.PI
  pencil.add(wood)
  const lead = new THREE.Mesh(
    new THREE.ConeGeometry(0.026, 0.085, 12),
    new THREE.MeshStandardMaterial({ color: 0x2f2f33, roughness: 0.35, metalness: 0.4 }),
  )
  lead.position.y = -0.955
  lead.rotation.x = Math.PI
  pencil.add(lead)
  // The metal band has ridges, drawn as stripes in its bump map.
  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.12, 24),
    new THREE.MeshStandardMaterial({
      color: 0xc9ccd2,
      metalness: 0.9,
      roughness: 0.35,
      bumpMap: paint(
        64,
        64,
        (draw, size) => {
          draw.fillStyle = '#000'
          draw.fillRect(0, 0, size, size)
          draw.fillStyle = '#fff'
          for (let at = 4; at < size; at += 12) draw.fillRect(0, at, size, 5)
        },
        { colour: false },
      ),
      bumpScale: 3,
    }),
  )
  ferrule.position.y = 0.81
  pencil.add(ferrule)
  const eraser = new THREE.Mesh(
    new RoundedBoxGeometry(0.15, 0.16, 0.15, 3, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xe58b8b, roughness: 0.9 }),
  )
  eraser.position.y = 0.94
  pencil.add(eraser)
  // Resting on the cover: its top face plus the pencil's radius.
  pencil.position.set(0.2, -0.45, 0.262)
  pencil.rotation.z = -1.15
  group.add(pencil)

  // Lying back so the cover faces up towards the camera.
  group.rotation.set(-0.85, 0.15, 0.4)
  return group
}

function resize() {
  const { width, height } = canvas.value.getBoundingClientRect()
  if (!width || !height) return
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  const { distance, aspect } = FRAMING[props.object]
  camera.position.setLength(distance * Math.max(1, aspect / camera.aspect))
  camera.updateProjectionMatrix()
}

function animate(timestamp) {
  frame = requestAnimationFrame(animate)
  timer.update(timestamp)
  const t = timer.getElapsed()
  // A slow float up and down with a little sway.
  model.position.y = Math.sin(t * 1.2) * 0.08
  model.rotation.y = model.userData.restY + Math.sin(t * 0.6) * 0.18
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0, FRAMING[props.object].distance)

  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 0.9

  // The same warm sky, key and cool fill lights as the cassette, plus soft
  // studio reflections for the shiny parts.
  const pmrem = new THREE.PMREMGenerator(renderer)
  environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = 0.35
  pmrem.dispose()
  scene.add(new THREE.HemisphereLight(0xfff2df, 0x6d5261, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(-3, 4, 5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xd7ddff, 1.2)
  fill.position.set(4, -2, -3)
  scene.add(fill)

  model = props.object === 'spotify' ? buildSpotify() : buildJournal()
  model.userData.restY = model.rotation.y
  scene.add(model)

  // Drag to turn it; no zoom, so scrolling over it still scrolls the page.
  controls = new OrbitControls(camera, canvas.value)
  controls.enableDamping = true
  controls.enablePan = false
  controls.enableZoom = false
  controls.enableRotate = props.rotatable

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  resize()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Still, but it can be dragged and is redrawn when it is.
    controls.addEventListener('change', () => renderer.render(scene, camera))
    renderer.render(scene, camera)
  } else {
    frame = requestAnimationFrame(animate)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  controls?.dispose()
  const textures = new Set()
  scene?.traverse((child) => {
    child.geometry?.dispose()
    for (const material of [child.material].flat()) {
      if (!material) continue
      for (const slot of ['map', 'roughnessMap', 'bumpMap'])
        if (material[slot]) textures.add(material[slot])
      material.dispose()
    }
  })
  for (const texture of textures) texture.dispose()
  environment?.dispose()
  renderer?.dispose()
  // Free the WebGL context now, or reopening the page can run out of them.
  renderer?.forceContextLoss()
})
</script>

<template>
  <canvas
    ref="canvas"
    class="landing-object"
    :class="{ 'is-rotatable': rotatable }"
    role="img"
    :aria-label="
      rotatable
        ? LABELS[object]
        : LABELS[object].replace('Drag to rotate.', 'Drag it into the journal.')
    "
  />
</template>

<style scoped>
.landing-object {
  display: block;
  outline: none;
}

.landing-object.is-rotatable {
  cursor: grab;
  touch-action: pan-y;
}

.landing-object.is-rotatable:active {
  cursor: grabbing;
}
</style>
