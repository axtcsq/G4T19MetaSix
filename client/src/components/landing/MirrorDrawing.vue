<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

// A small drawing at the top of each "Your Playlist Is a Mirror" card. Each
// one draws itself in its own way when the card scrolls into view: a song
// looping on repeat, a pattern line plotting itself, and lines being written
// on a journal page.
defineProps({
  kind: {
    type: String,
    required: true,
    validator: (value) => ['repeat', 'pattern', 'journal'].includes(value),
  },
})

const root = ref(null)
const drawn = ref(false)
let observer

onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    drawn.value = true
    return
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      drawn.value = true
      observer.disconnect()
    },
    { threshold: 0.6 },
  )
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <svg
    ref="root"
    class="mirror-drawing"
    :class="[`is-${kind}`, { 'is-drawn': drawn }]"
    viewBox="0 0 240 64"
    aria-hidden="true"
  >
    <template v-if="kind === 'repeat'">
      <g class="loop">
        <path class="ink" pathLength="1" d="M120 14a18 18 0 1 1 -15.6 9" />
        <path class="ink arrow" pathLength="1" d="M100 16l4.4 7 7.6-3" />
      </g>
      <g class="note note-left">
        <ellipse cx="66" cy="42" rx="6.5" ry="5" />
        <path class="stem" d="M72 42V20l11 4" />
      </g>
      <g class="note note-right">
        <ellipse cx="170" cy="40" rx="6.5" ry="5" />
        <path class="stem" d="M176 40V18l11 4" />
      </g>
    </template>

    <template v-else-if="kind === 'pattern'">
      <polyline class="ink" pathLength="1" points="26,48 62,38 98,43 134,24 170,31 204,16" />
      <polyline class="ink tail" points="204,16 228,19" />
      <circle class="dot" cx="62" cy="38" r="3.5" />
      <circle class="dot" cx="134" cy="24" r="3.5" />
      <circle class="dot last" cx="204" cy="16" r="4.5" />
    </template>

    <template v-else>
      <rect class="page" x="74" y="6" width="92" height="52" rx="5" />
      <path class="ink line line-1" pathLength="1" d="M86 20H154" />
      <path class="ink line line-2" pathLength="1" d="M86 31H148" />
      <path class="ink line line-3" pathLength="1" d="M86 42H122" />
      <g class="pen">
        <path class="pen-body" d="M124 45l26-22" />
        <path class="pen-tip" d="M124 45l-4 4" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.mirror-drawing {
  display: block;
  width: 100%;
  height: 64px;
  margin-bottom: 18px;
  border-radius: 12px;
  /* A soft tint of the theme colour, so it works in light and dark mode. */
  background: color-mix(in srgb, var(--ui-primary) 8%, transparent);
  color: var(--ui-primary);
  overflow: visible;
}
.ink {
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  /* Hidden until the card is in view, then drawn along its length. */
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
.is-drawn .ink {
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 900ms ease-out;
}

/* On repeat: the loop draws, then keeps turning while the notes bob. */
.loop {
  transform-box: fill-box;
  transform-origin: center;
}
.is-drawn .loop {
  animation: turn 6s linear 900ms infinite;
}
.note {
  fill: currentColor;
  opacity: 0;
}
.note .stem {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.is-drawn .note {
  opacity: 1;
  transition: opacity 400ms ease 500ms;
  animation: bob 2.4s ease-in-out 900ms infinite;
}
.is-drawn .note-right {
  opacity: 0.6;
  animation-delay: 2.1s;
}

/* Patterns: the line plots left to right, then the points pop in. */
.is-drawn.is-pattern .ink {
  transition-duration: 1200ms;
}
.tail {
  stroke-dasharray: 2 7;
  stroke-dashoffset: 0;
  opacity: 0;
}
.is-drawn .tail {
  opacity: 1;
  transition: opacity 400ms ease 1200ms;
}
.dot {
  fill: currentColor;
  transform-box: fill-box;
  transform-origin: center;
  scale: 0;
}
.dot.last {
  fill: var(--color-brand-800);
}
.is-drawn .dot {
  scale: 1;
  transition: scale 300ms cubic-bezier(0.34, 1.56, 0.64, 1) 500ms;
}
.is-drawn .dot:nth-of-type(2) {
  transition-delay: 800ms;
}
.is-drawn .dot.last {
  transition-delay: 1150ms;
}

/* Journal: the lines are written one after another as the pen moves down. */
.page {
  fill: var(--ui-bg-elevated);
  stroke: color-mix(in srgb, var(--ui-primary) 30%, transparent);
}
.line {
  stroke-width: 2.5;
  opacity: 0.75;
}
.is-drawn .line-2 {
  transition-delay: 700ms;
}
.is-drawn .line-3 {
  transition-delay: 1400ms;
}
.pen {
  transform: translate(-40px, -22px);
  opacity: 0;
}
.pen-body {
  stroke: #f0ae27;
  stroke-width: 6;
  stroke-linecap: round;
}
.pen-tip {
  stroke: #2f2f33;
  stroke-width: 3;
  stroke-linecap: round;
}
.is-drawn .pen {
  animation: write 2.3s ease-in-out forwards;
}

@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}
@keyframes bob {
  50% {
    transform: translateY(-4px);
  }
}
@keyframes write {
  0% {
    opacity: 1;
    transform: translate(-40px, -22px);
  }
  30% {
    transform: translate(0, -22px);
  }
  35% {
    transform: translate(-40px, -11px);
  }
  60% {
    transform: translate(-6px, -11px);
  }
  65% {
    transform: translate(-40px, 0);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mirror-drawing * {
    animation: none !important;
    transition: none !important;
  }
  .ink {
    stroke-dashoffset: 0;
  }
  .note,
  .tail,
  .pen {
    opacity: 1;
  }
  .dot {
    scale: 1;
  }
  .pen {
    transform: none;
  }
}
</style>
