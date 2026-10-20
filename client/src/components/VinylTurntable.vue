<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const props = defineProps({
  spinning: Boolean,
  artwork: String,
  color: { type: String, default: '#c9d0b5' },
})
const emit = defineEmits(['toggle'])
const canvas = ref(null)
const failed = ref(false)
let renderer,
  scene,
  camera,
  controls,
  frame,
  observer,
  record,
  arm,
  deckMaterial,
  labelMaterial,
  lightMaterial
let textureVersion = 0,
  disposed = false,
  last = 0,
  startPoint,
  resize,
  media
const reduced = ref(false)
const geometries = new Set(),
  materials = new Set()
function mesh(geometry, material, parent = scene) {
  geometries.add(geometry)
  materials.add(material)
  const item = new THREE.Mesh(geometry, material)
  item.castShadow = true
  item.receiveShadow = true
  parent.add(item)
  return item
}
const material = (color, metalness = 0, roughness = 0.6) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness })
function cylinder(radius, height, mat, x, y, z, parent = scene) {
  const item = mesh(new THREE.CylinderGeometry(radius, radius, height, 96), mat, parent)
  item.position.set(x, y, z)
  return item
}
function box(w, h, d, mat, x, y, z, parent = scene) {
  const item = mesh(new THREE.BoxGeometry(w, h, d), mat, parent)
  item.position.set(x, y, z)
  return item
}
function updateCover() {
  if (!labelMaterial || !props.artwork) return
  const version = ++textureVersion
  new THREE.TextureLoader().load(
    props.artwork,
    (texture) => {
      if (disposed || version !== textureVersion) {
        texture.dispose()
        return
      }
      texture.colorSpace = THREE.SRGBColorSpace
      labelMaterial.map?.dispose()
      labelMaterial.map = texture
      labelMaterial.needsUpdate = true
    },
    undefined,
    () => {
      labelMaterial.map?.dispose()
      labelMaterial.map = null
      labelMaterial.needsUpdate = true
    },
  )
}
function resetView() {
  camera?.position.set(0.6, 7.8, 7.5)
  controls?.target.set(0, 0, 0)
  controls?.update()
}
defineExpose({ resetView })
watch(() => props.artwork, updateCover)
watch(
  () => props.color,
  (color) => deckMaterial?.color.set(color),
)

onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  const preference = () => {
    reduced.value = media.matches
  }
  preference()
  media.addEventListener('change', preference)
  media.cleanup = () => media.removeEventListener('change', preference)
  try {
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80)
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.3
    scene.add(new THREE.HemisphereLight(0xfffaf1, 0x747b71, 3))
    const key = new THREE.DirectionalLight(0xfff4e2, 4)
    key.position.set(-3, 8, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -6
    key.shadow.camera.right = 6
    key.shadow.camera.top = 6
    key.shadow.camera.bottom = -6
    key.shadow.normalBias = 0.025
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 2)
    fill.position.set(4, 3, -4)
    scene.add(fill)
    const dark = material('#202723', 0.35, 0.5),
      silver = material('#b9bcb5', 0.8, 0.25)
    const brass = material('#bfa77c', 0.75, 0.3),
      vinyl = material('#141917', 0.3, 0.3)
    const grooveMat = material('#353b37', 0.55, 0.44)
    deckMaterial = material(props.color, 0.12, 0.55)
    box(6.2, 0.38, 4.5, deckMaterial, 0, 0, 0)
    box(6.1, 0.16, 4.4, dark, 0, -0.25, 0)
    for (const x of [-2.5, 2.5])
      for (const z of [-1.65, 1.65]) cylinder(0.28, 0.2, dark, x, -0.4, z)
    cylinder(1.94, 0.12, silver, -0.72, 0.25, 0)
    cylinder(1.87, 0.08, dark, -0.72, 0.34, 0)
    record = new THREE.Group()
    record.position.set(-0.72, 0.4, 0)
    scene.add(record)
    const disc = cylinder(1.81, 0.035, vinyl, 0, 0, 0, record)
    disc.userData.playControl = true
    for (let r = 0.77; r < 1.78; r += 0.036) {
      const groove = mesh(new THREE.TorusGeometry(r, 0.003, 3, 160), grooveMat, record)
      groove.rotation.x = Math.PI / 2
      groove.position.y = 0.021
      groove.userData.playControl = true
    }
    cylinder(0.65, 0.014, brass, 0, 0.027, 0, record)
    labelMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' })
    const label = mesh(new THREE.PlaneGeometry(0.85, 0.85), labelMaterial, record)
    label.rotation.x = -Math.PI / 2
    label.position.y = 0.04
    label.userData.playControl = true
    cylinder(0.065, 0.12, silver, 0, 0.075, 0, record)
    cylinder(0.33, 0.17, dark, 2.1, 0.29, -1.45)
    cylinder(0.24, 0.2, brass, 2.1, 0.42, -1.45)
    arm = new THREE.Group()
    arm.position.set(2.1, 0.6, -1.45)
    scene.add(arm)
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.35),
      new THREE.Vector3(0, 0, 0.35),
      new THREE.Vector3(-0.16, 0, 1.4),
      new THREE.Vector3(-0.53, -0.06, 2.4),
    ])
    mesh(new THREE.TubeGeometry(path, 32, 0.045, 12, false), silver, arm)
    cylinder(0.15, 0.5, dark, 0, 0, -0.4, arm).rotation.x = Math.PI / 2
    const head = box(0.22, 0.12, 0.43, dark, -0.53, -0.08, 2.37, arm)
    head.rotation.y = -0.28
    box(0.035, 0.16, 0.04, brass, -0.56, -0.2, 2.48, arm)
    box(0.12, 0.42, 0.14, silver, 2.13, 0.33, 0.45)
    cylinder(0.2, 0.07, silver, -2.54, 0.24, 1.78).userData.playControl = true
    cylinder(0.08, 0.08, dark, -2.54, 0.3, 1.78).userData.playControl = true
    cylinder(0.23, 0.13, dark, 2.45, 0.27, 1.7)
    box(0.025, 0.01, 0.14, brass, 2.45, 0.34, 1.72)
    lightMaterial = new THREE.MeshBasicMaterial({ color: '#817d6c' })
    cylinder(0.035, 0.02, lightMaterial, -2.19, 0.22, 1.8)
    const floor = mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.13 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.51
    floor.castShadow = false
    controls = new OrbitControls(camera, canvas.value)
    canvas.value.style.touchAction = 'pan-y'
    controls.enableDamping = true
    controls.enablePan = false
    controls.enableZoom = false
    controls.minPolarAngle = 0.25
    controls.maxPolarAngle = 1.12
    controls.minAzimuthAngle = -0.65
    controls.maxAzimuthAngle = 0.65
    resetView()
    updateCover()
    resize = () => {
      if (!canvas.value) return
      const { width, height } = canvas.value.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.fov = camera.aspect > 1.5 ? 28 : 35
      camera.updateProjectionMatrix()
    }
    observer = new ResizeObserver(resize)
    observer.observe(canvas.value)
    resize()
    const animate = (now) => {
      frame = requestAnimationFrame(animate)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (document.hidden) return
      if (props.spinning && !reduced.value) record.rotation.y -= dt * Math.PI * 1.11
      const target = props.spinning ? -0.43 : 0
      arm.rotation.y = reduced.value ? target : THREE.MathUtils.damp(arm.rotation.y, target, 5, dt)
      lightMaterial.color.set(props.spinning ? '#b85b40' : '#817d6c')
      controls.update()
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)
  } catch {
    failed.value = true
  }
})
function pointerDown(event) {
  startPoint = { x: event.clientX, y: event.clientY }
}
function pointerUp(event) {
  if (
    !renderer ||
    !startPoint ||
    Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > 6
  )
    return
  const bounds = canvas.value.getBoundingClientRect()
  const ray = new THREE.Raycaster()
  ray.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    ),
    camera,
  )
  if (ray.intersectObjects(scene.children, true).some((hit) => hit.object.userData.playControl))
    emit('toggle')
}
onBeforeUnmount(() => {
  disposed = true
  ++textureVersion
  cancelAnimationFrame(frame)
  observer?.disconnect()
  controls?.dispose()
  media?.cleanup()
  labelMaterial?.map?.dispose()
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
  renderer?.dispose()
})
</script>

<template>
  <div class="turntable-scene">
    <canvas
      v-show="!failed"
      ref="canvas"
      aria-label="3D vinyl turntable. Drag to rotate the view; use the playback buttons below to control music."
      @pointerdown="pointerDown"
      @pointerup="pointerUp"
    />
    <div v-if="failed" class="turntable-fallback">
      <img :src="artwork" alt="Selected album artwork" />
      <p>The 3D view isn’t available in this browser. All music controls still work below.</p>
    </div>
  </div>
</template>

<style scoped>
.turntable-scene {
  width: 100%;
  height: 100%;
  min-height: 280px;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: pan-y;
  cursor: grab;
}
canvas:active {
  cursor: grabbing;
}
.turntable-fallback {
  display: grid;
  place-items: center;
  gap: 20px;
  padding: 30px;
  text-align: center;
}
.turntable-fallback img {
  width: 200px;
}
</style>
