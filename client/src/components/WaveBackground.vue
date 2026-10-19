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
    colour = mix(colour, peach, smoothstep(0.4, 1.0, wave3) * 0.35);

    // Faint ripples running along the waves.
    float ripple = sin(p.y * 12.0 + wave1 * 2.0 + t * 2.0) * 0.5 + 0.5;
    colour += ripple * 0.02;

    gl_FragColor = vec4(colour, 1.0);
  }
`

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, powerPreference: 'low-power' })
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
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))

  const { width, height } = canvas.value.getBoundingClientRect()
  renderer.setSize(width, height, false)
  material.uniforms.uResolution.value.set(width, height)
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
