<script setup>
// Slowly flowing liquid in sunset tones from MetaFor's palette, drawn with a
// small WebGL shader: noise gently warped into itself (domain warping),
// coloured from dusky plum at the top to peach near the bottom, with a lit,
// glossy surface so it reads as thick, viscous paint. The liquid swirls around
// the pointer and settles back when it leaves. It only animates while it's on
// screen and the tab is visible, draws one still frame (with no swirling) for
// people who reduce motion, and leaves the plain gradient behind it showing
// if WebGL isn't available.
import { onBeforeUnmount, onMounted, ref } from 'vue'
defineOptions({ name: 'MarbleBackground' })

const canvas = ref(null)
// Seconds of flow per real second; low, so it reads as thick paint.
const SPEED = 0.05
// The shader samples the liquid three times per pixel for its lighting, so
// the canvas stays a little below full sharpness on high-density screens.
const MAX_PIXEL_RATIO = 1.25
// How quickly the swirl follows the pointer, and fades in and out (0 to 1 per
// frame; lower is smoother).
const FOLLOW = 0.12
const FADE = 0.05

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
// The pointer in canvas pixels, and how strongly the liquid swirls around it.
uniform vec2 mouse;
uniform float pull;

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

// Two layers, each rotated off the noise grid: smooth enough that warping by
// it doesn't fold into creases, and no straight grid lines show through.
float smoothNoise(vec2 p) {
  p = mat2(0.8, 0.6, -0.6, 0.8) * p;
  float value = 0.65 * noise(p);
  p = mat2(1.6, 1.2, -1.2, 1.6) * p;
  return value + 0.35 * noise(p);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  // Few layers keep the folds smooth.
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    amplitude *= 0.5;
  }
  return value;
}

// Scale from canvas pixels to noise space. Lower is more zoomed out: fewer,
// broader curves.
const float ZOOM = 0.6;

// The liquid's flow at a point: gently warped noise (each layer bends the
// next), turned around the pointer when it's near, like stirring paint.
// Returns the field and its warp, which the colour uses.
float flow(vec2 p, out vec2 r) {
  vec2 m = mouse / resolution.y * ZOOM;
  vec2 offset = p - m;
  float near = pull * exp(-dot(offset, offset) * 12.0);
  float turn = near * 2.0;
  p = m + mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * offset;

  float t = time;
  // The warp layers use smooth noise: finer detail in them gets stretched
  // and folded into knife-edge creases that catch the light as thin lines.
  // The detail lives only in the final layer.
  vec2 q = vec2(smoothNoise(p + vec2(0.0, t)), smoothNoise(p + vec2(5.2, 1.3) - t));
  r = vec2(
    smoothNoise(p + 1.2 * q + vec2(1.7, 9.2) + 0.5 * t),
    smoothNoise(p + 1.2 * q + vec2(8.3, 2.8) - 0.4 * t)
  );
  return fbm(p + 1.3 * r);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 p = gl_FragCoord.xy / resolution.y * ZOOM;

  vec2 r;
  float f = flow(p, r);
  float height = f;

  // Sunset: dusk at the top, warm light low down like a horizon.
  float v = clamp(f * 1.15 + 0.25 * r.x + (0.5 - uv.y) * 0.55, 0.0, 1.0);

  vec3 plum = vec3(0.23, 0.16, 0.27);
  vec3 mauve = vec3(0.40, 0.33, 0.45);
  vec3 rose = vec3(0.72, 0.36, 0.36);
  vec3 terracotta = vec3(0.84, 0.44, 0.33);
  vec3 apricot = vec3(0.94, 0.62, 0.45);
  vec3 peach = vec3(1.0, 0.83, 0.67);

  vec3 colour = mix(plum, mauve, smoothstep(0.0, 0.28, v));
  colour = mix(colour, rose, smoothstep(0.28, 0.48, v));
  colour = mix(colour, terracotta, smoothstep(0.48, 0.62, v));
  colour = mix(colour, apricot, smoothstep(0.62, 0.8, v));
  colour = mix(colour, peach, smoothstep(0.8, 0.97, v));

  // Light it as a thick, glossy surface from the top left. The slope comes
  // from sampling the height several pixels away, which rounds off tight
  // folds instead of catching them as thin bright lines (the GPU's own
  // per-block slopes drew dotted ones).
  float delta = 8.0 / resolution.y * ZOOM;
  vec2 rx;
  vec2 ry;
  float hx = flow(p + vec2(delta, 0.0), rx);
  float hy = flow(p + vec2(0.0, delta), ry);
  vec2 slope = vec2(hx - height, hy - height) / delta * 0.3;
  slope /= 1.0 + length(slope) * 0.6;
  vec3 normal = normalize(vec3(-slope, 1.0));
  vec3 light = normalize(vec3(-0.45, 0.6, 0.65));
  vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
  float diffuse = clamp(dot(normal, light), 0.0, 1.0);
  float shine = pow(max(dot(normal, halfway), 0.0), 50.0);
  colour *= 0.6 + 0.55 * diffuse;
  colour += vec3(1.0, 0.92, 0.84) * shine * 0.7;

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
let mouseLocation = null
let pullLocation = null
let ratio = 1
// Where the pointer is and how hard it pulls, eased towards each frame.
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 }
let pull = 0
let targetPull = 0
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
  mouseLocation = gl.getUniformLocation(program, 'mouse')
  pullLocation = gl.getUniformLocation(program, 'pull')
  return true
}

function resize() {
  ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  const { clientWidth, clientHeight } = canvas.value
  canvas.value.width = Math.max(1, Math.round(clientWidth * ratio))
  canvas.value.height = Math.max(1, Math.round(clientHeight * ratio))
  gl.viewport(0, 0, canvas.value.width, canvas.value.height)
  gl.uniform2f(resolutionLocation, canvas.value.width, canvas.value.height)
  draw(performance.now())
}

function draw(now) {
  mouse.x += (mouse.targetX - mouse.x) * FOLLOW
  mouse.y += (mouse.targetY - mouse.y) * FOLLOW
  pull += (targetPull - pull) * FADE
  gl.uniform1f(timeLocation, ((now - start) / 1000) * SPEED)
  gl.uniform2f(mouseLocation, mouse.x, mouse.y)
  gl.uniform1f(pullLocation, pull)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

// The canvas ignores the pointer (the text and button sit above it), so its
// parent reports where the pointer is, in the canvas's own pixels.
function onPointerMove(event) {
  const box = canvas.value.getBoundingClientRect()
  mouse.targetX = (event.clientX - box.left) * ratio
  mouse.targetY = (box.bottom - event.clientY) * ratio
  if (targetPull === 0) {
    // Start the swirl where the pointer came in, not from the last spot.
    mouse.x = mouse.targetX
    mouse.y = mouse.targetY
  }
  targetPull = 1
}

function onPointerLeave() {
  targetPull = 0
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

  if (!reduceMotion) {
    canvas.value.parentElement.addEventListener('pointermove', onPointerMove)
    canvas.value.parentElement.addEventListener('pointerleave', onPointerLeave)
  }
})

onBeforeUnmount(() => {
  pause()
  observer?.disconnect()
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  canvas.value?.parentElement?.removeEventListener('pointermove', onPointerMove)
  canvas.value?.parentElement?.removeEventListener('pointerleave', onPointerLeave)
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
