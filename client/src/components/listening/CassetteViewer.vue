<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const canvas = ref(null)
const loading = ref(true)
const loadError = ref(false)

let renderer
let scene
let camera
let controls
let animationFrame
let resizeObserver

function resizeRenderer() {
  if (!renderer || !canvas.value) return

  const { width, height } = canvas.value.getBoundingClientRect()
  if (!width || !height) return

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate() {
  animationFrame = requestAnimationFrame(animate)
  controls?.update()
  renderer?.render(scene, camera)
}

onMounted(() => {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  camera.position.set(0, 0.1, 5.6)

  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  scene.add(new THREE.HemisphereLight(0xfff2df, 0x6d5261, 2.2))

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2)
  keyLight.position.set(-3, 4, 5)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xd7ddff, 2.1)
  fillLight.position.set(4, -2, -3)
  scene.add(fillLight)

  controls = new OrbitControls(camera, canvas.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.065
  controls.enablePan = false
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  controls.autoRotateSpeed = 1.25
  controls.minDistance = 3.4
  controls.maxDistance = 7
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 2.55

  resizeObserver = new ResizeObserver(resizeRenderer)
  resizeObserver.observe(canvas.value)
  resizeRenderer()

  new GLTFLoader().load(
    '/cassette_tape.glb',
    ({ scene: model }) => {
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const largestSide = Math.max(size.x, size.y, size.z)

      model.position.sub(center)
      model.scale.setScalar(3.15 / largestSide)
      model.rotation.y = -0.28
      scene.add(model)
      loading.value = false
    },
    undefined,
    (error) => {
      console.error('Could not load the cassette model:', error)
      loading.value = false
      loadError.value = true
    },
  )

  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div class="cassette-viewer">
    <canvas ref="canvas" aria-label="3D cassette tape. Drag to rotate." role="img"></canvas>
    <span v-if="loading" class="viewer-status">Loading the tape…</span>
    <span v-else-if="loadError" class="viewer-status">Cassette preview unavailable</span>
  </div>
</template>

<style scoped>
.cassette-viewer {
  position: relative;
  z-index: 1;
  width: min(100%, 390px);
  height: min(37vw, 270px);
  min-height: 220px;
  cursor: grab;
  touch-action: pan-y;
}

.cassette-viewer:active { cursor: grabbing; }
canvas { display: block; width: 100%; height: 100%; outline: none; }
.viewer-status { position: absolute; right: 0; bottom: 0; left: 0; color: #8b7c70; font-size: 0.72rem; text-align: center; }

@media (max-width: 768px) {
  .cassette-viewer { height: 260px; min-height: 0; }
}
</style>
