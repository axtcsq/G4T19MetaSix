<script setup>
// Slowly flowing marbled paint, drawn with a small WebGL shader: noise warped
// into itself a few times (domain warping), turned into bands of deep red,
// rose and pale pink. It only animates while it's on screen and the tab is
// visible, draws one still frame for people who reduce motion, and leaves the
// plain gradient behind it showing if WebGL isn't available.
import { onBeforeUnmount, onMounted, ref } from 'vue'
defineOptions({ name: 'MarbleBackground' })

const canvas = ref(null)
// Seconds of flow per real second; low, so it reads as thick paint.
const SPEED = 0.05
const MAX_PIXEL_RATIO = 1.5

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAGMENT = `
// Full precision where the device has it; lower precision leaves straight
// seams in the noise.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform float time;

// A hash without sin(), which loses precision and shows grid seams.
float hash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(p.x * p.y * (p.x + p.y));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  // Quintic smoothing, so stretched noise folds smoothly instead of creasing.
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  // Few layers keep the folds smooth; the streaks come from the bands.
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  // Zoomed out, so a few large swirls fill the banner.
  vec2 p = gl_FragCoord.xy / resolution.y * 0.9;
  float t = time;

  // Each layer of noise bends the next, which makes the swirls.
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(
    fbm(p + 2.2 * q + vec2(1.7, 9.2) + 0.6 * t),
    fbm(p + 2.2 * q + vec2(8.3, 2.8) - 0.5 * t)
  );
  float f = fbm(p + 2.6 * r);

  // Bands across the warped field, like streaks of paint.
  // Many fine streaks inside the large swirls.
  float bands = 0.5 + 0.5 * sin((f * 7.0 + length(r) * 3.0) * 6.2832);

  vec3 maroon = vec3(0.18, 0.03, 0.05);
  vec3 crimson = vec3(0.52, 0.10, 0.14);
  vec3 rose = vec3(0.78, 0.40, 0.48);
  vec3 blush = vec3(0.95, 0.82, 0.86);

  vec3 colour = mix(maroon, crimson, smoothstep(0.0, 0.55, bands));
  colour = mix(colour, rose, smoothstep(0.55, 0.85, bands));
  colour = mix(colour, blush, smoothstep(0.88, 0.99, bands));
  colour *= 0.8 + 0.35 * f;

  gl_FragColor = vec4(colour, 1.0);
}
`

let gl = null
let frame = 0
let start = 0
let visible = false
let observer = null
let resizeObserver = null
let timeLocation = null
let resolutionLocation = null
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function compile(type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader))
  }
  return shader
}

function setUp() {
  gl = canvas.value.getContext('webgl', { antialias: false, premultipliedAlpha: false })
  if (!gl) return false

  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  gl.useProgram(program)

  // One rectangle covering the canvas; the fragment shader does the rest.
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  timeLocation = gl.getUniformLocation(program, 'time')
  resolutionLocation = gl.getUniformLocation(program, 'resolution')
  return true
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  const { clientWidth, clientHeight } = canvas.value
  canvas.value.width = Math.max(1, Math.round(clientWidth * ratio))
  canvas.value.height = Math.max(1, Math.round(clientHeight * ratio))
  gl.viewport(0, 0, canvas.value.width, canvas.value.height)
  gl.uniform2f(resolutionLocation, canvas.value.width, canvas.value.height)
  draw(performance.now())
}

function draw(now) {
  gl.uniform1f(timeLocation, ((now - start) / 1000) * SPEED)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

function loop(now) {
  draw(now)
  frame = requestAnimationFrame(loop)
}

function play() {
  if (reduceMotion || frame || !visible || document.hidden) return
  frame = requestAnimationFrame(loop)
}

function pause() {
  cancelAnimationFrame(frame)
  frame = 0
}

function onVisibilityChange() {
  if (document.hidden) pause()
  else play()
}

onMounted(() => {
  try {
    if (!setUp()) return
  } catch (error) {
    console.error('[Marble] WebGL set-up failed:', error.message)
    gl = null
    return
  }
  canvas.value.classList.add('is-ready')
  start = performance.now()
  resize()

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) play()
    else pause()
  })
  observer.observe(canvas.value)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  pause()
  observer?.disconnect()
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
})
</script>

<template>
  <canvas ref="canvas" class="marble-background" aria-hidden="true" />
</template>

<style scoped>
.marble-background {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 600ms ease;
}

/* Fades in once the shader has drawn, so a failed set-up shows nothing. */
.marble-background.is-ready {
  opacity: 1;
}
</style>
