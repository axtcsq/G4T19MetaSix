<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'

// A soft gradient drawn with a three.js shader, used behind the Patterns section.
const canvas = ref(null)

let renderer
let scene
let camera
let material

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;

  // Colours from the Figma Patterns band.
  const vec3 brown = vec3(0.463, 0.243, 0.196);
  const vec3 terracotta = vec3(0.808, 0.357, 0.294);
  const vec3 peach = vec3(1.0, 0.804, 0.651);
  const vec3 lavender = vec3(0.4, 0.373, 0.471);

  void main() {
    vec3 colour = mix(lavender, terracotta, vUv.x);
    colour = mix(colour, brown, (1.0 - vUv.y) * 0.4);
    colour = mix(colour, peach, vUv.x * vUv.y * 0.3);
    gl_FragColor = vec4(colour, 1.0);
  }
`

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  material = new THREE.ShaderMaterial({ vertexShader, fragmentShader })
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))

  const { width, height } = canvas.value.getBoundingClientRect()
  renderer.setSize(width, height, false)
  renderer.render(scene, camera)
})

onBeforeUnmount(() => {
  renderer?.dispose()
})
</script>

<template>
  <div class="wave-background" aria-hidden="true">
    <canvas ref="canvas" class="wave-canvas" />
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

.wave-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
