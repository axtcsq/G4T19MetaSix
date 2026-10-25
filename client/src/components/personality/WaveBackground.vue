<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'

// A soft gradient drawn with a three.js shader, used behind the Patterns section.
const canvas = ref(null)
const isReady = ref(false)

// How fast the waves drift. Kept low so the motion feels calm.
const SPEED = 0.2

let renderer
let scene
let camera
let material
let geometry
let clock
let animationFrame
let resizeObserver
let intersectionObserver
let elapsed = 0
let isOnScreen = false

// People who ask their device for less motion get a still frame of the waves.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function resize() {
  const { width, height } = canvas.value.getBoundingClientRect()
  if (!width || !height) return

  renderer.setSize(width, height, false)
  material.uniforms.uResolution.value.set(width, height)

  // Redraw straight away in case the animation is paused.
  renderer.render(scene, camera)
}

function animate() {
  animationFrame = requestAnimationFrame(animate)
  elapsed += clock.getDelta()
  material.uniforms.uTime.value = elapsed * SPEED
  renderer.render(scene, camera)
}

// Only animate while the section is on screen and the tab is visible.
function updatePlaying() {
  const shouldPlay = isOnScreen && !document.hidden && !reducedMotion.matches

  if (shouldPlay && !animationFrame) {
    clock.getDelta()
    animate()
  } else if (!shouldPlay && animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // Colours from the Figma Patterns band.
  const vec3 brown = vec3(0.463, 0.243, 0.196);
  const vec3 terracotta = vec3(0.808, 0.357, 0.294);
  const vec3 peach = vec3(1.0, 0.804, 0.651);
  const vec3 lavender = vec3(0.4, 0.373, 0.471);

  void main() {
    // Keep the waves the same shape however wide the section is.
    vec2 p = vec2(vUv.x * uResolution.x / uResolution.y, vUv.y);
    float t = uTime;

    // Three slow waves that bend into each other.
    float wave1 = sin(p.x * 2.2 + t * 1.3 + sin(p.y * 1.7 - t) * 1.2);
    float wave2 = sin(p.y * 3.1 - t * 0.9 + sin(p.x * 1.3 + t * 0.7) * 1.5);
    float wave3 = sin((p.x + p.y) * 1.6 + t * 1.1);

    vec3 colour = mix(lavender, terracotta, smoothstep(-1.0, 1.0, wave1) * 0.85);
    colour = mix(colour, brown, smoothstep(-0.2, 1.0, wave2) * 0.45);
    colour = mix(colour, peach, smoothstep(0.3, 1.0, wave3) * 0.45);

    // Faint ripples running along the waves.
    float ripple = sin(p.y * 12.0 + wave1 * 2.0 + t * 2.0) * 0.5 + 0.5;
    colour += ripple * 0.035;

    // Keep the white heading and intro text readable: deepen the top of the
    // section where they sit, and never let the waves get too light.
    float fromTop = (1.0 - vUv.y) * uResolution.y;
    colour = mix(colour, brown, (1.0 - smoothstep(120.0, 320.0, fromTop)) * 0.35);
    colour = min(colour, vec3(0.78, 0.6, 0.56));

    gl_FragColor = vec4(colour, 1.0);
  }
`

onMounted(() => {
  // Without WebGL the canvas stays hidden and the section's CSS gradient shows instead.
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, powerPreference: 'low-power' })
  } catch {
    return
  }
  isReady.value = true
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    },
  })
  geometry = new THREE.PlaneGeometry(2, 2)
  scene.add(new THREE.Mesh(geometry, material))

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  resize()

  clock = new THREE.Clock()
  renderer.render(scene, camera)

  intersectionObserver = new IntersectionObserver(([entry]) => {
    isOnScreen = entry.isIntersecting
    updatePlaying()
  })
  intersectionObserver.observe(canvas.value)
  document.addEventListener('visibilitychange', updatePlaying)
  reducedMotion.addEventListener('change', updatePlaying)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  document.removeEventListener('visibilitychange', updatePlaying)
  reducedMotion.removeEventListener('change', updatePlaying)
  intersectionObserver?.disconnect()
  resizeObserver?.disconnect()
  geometry?.dispose()
  material?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div class="wave-background" aria-hidden="true">
    <canvas ref="canvas" class="wave-canvas" :class="{ 'is-ready': isReady }" />
  </div>
</template>

<style scoped>
.wave-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

/* The section's inner shadow, redrawn on top so the canvas doesn't hide it. */
.wave-background::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 9px 6.2px rgba(0, 0, 0, 0.25);
  content: '';
}

.wave-canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 600ms ease;
}

.wave-canvas.is-ready {
  opacity: 1;
}

/* Softer waves in dark mode, so the band sits calmly on the navy page. */
.dark .wave-canvas {
  filter: brightness(0.8) saturate(0.9);
}
</style>
