<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// The Spotify tile or the journal on the landing page, built from simple
// shapes so there is no model file or image to load. It sways gently and can
// be dragged round, like the cassette above it.
const props = defineProps({
  object: { type: String, required: true, validator: (value) => ['spotify', 'journal'].includes(value) },
  // False when the page moves the whole canvas instead, like dragging the
  // Spotify tile into the journal.
  rotatable: { type: Boolean, default: true },
})

const canvas = ref(null)
// How far back the camera sits, and the box shape that distance was set for.
// A narrower box moves the camera back so nothing is cut off.
const FRAMING = {
  spotify: { distance: 5.2, aspect: 1 },
  journal: { distance: 5.4, aspect: 300 / 230 },
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

const glossy = (color, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, ...extra })
const matte = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra })

function buildSpotify() {
  const group = new THREE.Group()
  // The corner radius has to stay under half the depth, or the sides fold in.
  const tile = new THREE.Mesh(new RoundedBoxGeometry(2, 2, 0.6, 8, 0.28), glossy(0x141414))
  group.add(tile)

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.14, 64), glossy(0x1ed760))
  disc.rotation.x = Math.PI / 2
  disc.position.z = 0.33
  group.add(disc)

  // Three arcs, widest at the top, bowing upwards like the icon's sound waves.
  const arcs = [
    { radius: 0.62, tube: 0.065, top: 0.33, sweep: 1.85 },
    { radius: 0.5, tube: 0.056, top: 0.08, sweep: 1.8 },
    { radius: 0.38, tube: 0.048, top: -0.16, sweep: 1.75 },
  ]
  const arcMaterial = glossy(0x141414)
  for (const { radius, tube, top, sweep } of arcs) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 48, sweep), arcMaterial)
    arc.rotation.z = Math.PI / 2 - sweep / 2
    arc.position.set(0, top - radius, 0.42)
    group.add(arc)
  }
  // The icon's waves tilt slightly upwards to the right.
  for (const child of group.children.slice(2)) child.rotation.z += 0.12

  group.rotation.set(0.25, -0.5, 0.18)
  return group
}

// Thin lines on the edges of the pages.
function pagesTexture() {
  const paper = document.createElement('canvas')
  paper.width = 64
  paper.height = 64
  const draw = paper.getContext('2d')
  draw.fillStyle = '#fbf3dd'
  draw.fillRect(0, 0, 64, 64)
  draw.fillStyle = '#e6d7b2'
  for (let y = 0; y < 64; y += 4) draw.fillRect(0, y, 64, 1)
  const texture = new THREE.CanvasTexture(paper)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 2)
  return texture
}

function buildJournal() {
  const group = new THREE.Group()
  const cover = glossy(0x2d4f8f, { roughness: 0.45, clearcoat: 0.4 })

  // Front and back boards, the spine flush with their left edge, and the
  // pages between them. Each corner radius stays under half the thickness,
  // and the pages are a touch thinner than the gap, so no faces overlap.
  for (const z of [0.15, -0.15]) {
    const board = new THREE.Mesh(new RoundedBoxGeometry(1.8, 2.3, 0.07, 3, 0.02), cover)
    board.position.z = z
    group.add(board)
  }
  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.1, 2.3, 0.37, 3, 0.04), cover)
  spine.position.x = -0.85
  group.add(spine)

  const pageEdges = matte(0xffffff, { map: pagesTexture() })
  const pages = new THREE.Mesh(new THREE.BoxGeometry(1.68, 2.2, 0.22), [
    pageEdges,
    pageEdges,
    pageEdges,
    pageEdges,
    matte(0xf4e8c8),
    matte(0xf4e8c8),
  ])
  pages.position.x = 0.03
  group.add(pages)

  // A ribbon bookmark hanging out of the bottom, with a notched end.
  const ribbonShape = new THREE.Shape()
  ribbonShape.moveTo(-0.07, 0)
  ribbonShape.lineTo(0.07, 0)
  ribbonShape.lineTo(0.07, -0.62)
  ribbonShape.lineTo(0, -0.52)
  ribbonShape.lineTo(-0.07, -0.62)
  ribbonShape.closePath()
  const ribbon = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ribbonShape, { depth: 0.012, bevelEnabled: false }),
    matte(0xd8402f, { side: THREE.DoubleSide }),
  )
  ribbon.position.set(0.15, -1.05, 0)
  ribbon.rotation.set(0.5, 0, 0.12)
  group.add(ribbon)

  // A yellow pencil lying across the cover.
  const pencil = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.5, 6), glossy(0xf5b52e, { clearcoat: 0.6 }))
  pencil.add(body)
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 6), matte(0xe9c99a))
  wood.position.y = -0.87
  wood.rotation.x = Math.PI
  pencil.add(wood)
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.085, 12), matte(0x333333))
  lead.position.y = -0.955
  lead.rotation.x = Math.PI
  pencil.add(lead)
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 24), glossy(0xc9ccd2, { metalness: 0.9 }))
  ferrule.position.y = 0.81
  pencil.add(ferrule)
  const eraser = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.16, 0.15, 3, 0.05), matte(0x3a6fd8))
  eraser.position.y = 0.94
  pencil.add(eraser)
  // Resting on the cover: its top face plus the pencil's radius.
  pencil.position.set(0.15, 0.25, 0.262)
  pencil.rotation.z = -0.7
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

  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 0.85

  // Soft studio reflections, so the glossy surfaces shine like the old renders.
  const pmrem = new THREE.PMREMGenerator(renderer)
  environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = 0.55
  pmrem.dispose()
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(-3, 4, 5)
  scene.add(key)

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
  scene?.traverse((child) => {
    child.geometry?.dispose()
    for (const material of [child.material].flat()) {
      material?.map?.dispose()
      material?.dispose()
    }
  })
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
    :aria-label="rotatable ? LABELS[object] : LABELS[object].replace('Drag to rotate.', 'Drag it into the journal.')"
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
