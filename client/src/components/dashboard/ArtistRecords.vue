<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Display top artists as records sized by play count.
const props = defineProps({
  artists: { type: Array, required: true },
  // 'weekly' or 'monthly', the key that holds each artist's plays.
  period: { type: String, required: true },
  paused: Boolean,
})

const root = ref(null)
const width = ref(0)
const height = ref(0)
// The narrowest a name may wrap to, and the heights of a name line and the
// play count line, with the 6px gaps between them and the record.
const TEXT_WIDTH = 88
const NAME_LINE = 20.4
const PLAYS_LINE = 18
const GAP = 10

// Labels without album art, one colour per rank so the top five differ.
const LABEL_COLOURS = ['#cd6651', '#4a7fc1', '#c8862f', '#4f9a76', '#8b62b0']

// How wide a name is in the record name font, to tell whether it wraps.
let measurer
function nameWidth(name) {
  if (measurer === undefined) {
    measurer = document.createElement('canvas').getContext?.('2d') ?? null
    if (measurer) {
      const serif = getComputedStyle(document.documentElement).getPropertyValue('--font-serif')
      measurer.font = `500 17px ${serif || 'serif'}`
    }
  }
  return measurer ? measurer.measureText(name).width : name.length * 8.5
}

const plays = (artist) => artist[props.period] || 0

// Stagger the top records vertically.
const STAGGER = [0, 0.3, 0.75]

// The records grow until they fill the height beside them, up to this much.
const MAX_GROW = 1.8

// Positions for each artist, worked out from the space available, with every
// record grown by grow and the ones below the top three by lowerGrow too.
// spread drops the 2nd and 3rd records further down the panel.
function arrange(space, grow, lowerGrow = 1, spread = 0) {
  const most = Math.max(1, ...props.artists.map(plays))
  const largest = Math.min(150, space * 0.38) * grow
  const smallest = Math.max(52, largest * 0.4)
  // On a narrow panel every record shrinks a little so the top three still
  // fit side by side.
  const sizeOf = (artist) => smallest + (largest - smallest) * (plays(artist) / most)
  const topThree = props.artists.slice(0, 3)
  const topWidth = (scale) =>
    topThree.reduce((sum, artist) => sum + Math.max(sizeOf(artist) * scale, TEXT_WIDTH), 0) +
    GAP * (topThree.length - 1)
  let shrink = 1
  while (shrink > 0.5 && topWidth(shrink) > space) shrink -= 0.02
  // A record below the top three never outgrows the second.
  const second = sizeOf(topThree[1] ?? topThree[0]) * shrink
  const boxes = props.artists.map((artist, index) => {
    const size = Math.round(
      index < 3 ? sizeOf(artist) * shrink : Math.min(sizeOf(artist) * shrink * lowerGrow, second),
    )
    const width = Math.max(size, TEXT_WIDTH)
    const name = nameWidth(artist.name)
    const lines = name > width ? 2 : 1
    const textHeight = Math.ceil(12 + lines * NAME_LINE + PLAYS_LINE)
    return {
      artist,
      size,
      width,
      textWidth: Math.min(width, Math.max(name, 64)),
      height: size + textHeight,
      textHeight,
    }
  })
  // The record and the name under it, as two separate areas, so another
  // record can sit beside a short name.
  const areas = (box) => [
    {
      left: box.left + (box.width - box.size) / 2,
      top: box.top,
      width: box.size,
      height: box.size,
    },
    {
      left: box.left + (box.width - box.textWidth) / 2,
      top: box.top + box.size,
      width: box.textWidth,
      height: box.textHeight,
    },
  ]
  const clear = (box, others) =>
    areas(box).every((area) =>
      others
        .flatMap(areas)
        .every(
          (other) =>
            area.left + area.width + GAP <= other.left ||
            other.left + other.width + GAP <= area.left ||
            area.top + area.height + GAP <= other.top ||
            other.top + other.height + GAP <= area.top,
        ),
    )

  // The top three, 1, 2, 3 from left to right, spread across the panel with
  // any spare room shared between the gaps.
  const top = boxes.slice(0, 3)
  const rowWidth = top.reduce((sum, box) => sum + box.width, 0) + GAP * (top.length - 1)
  const spare = Math.max(0, space - rowWidth)
  const gap = GAP + Math.min(spare / (top.length + 1), 28)
  let left = Math.max(0, (space - rowWidth - (gap - GAP) * (top.length - 1)) / 2)
  top.forEach((box, index) => {
    box.left = left
    box.top = Math.round((top[0].size - box.size) * STAGGER[index] + (spread * index) / 2)
    left += box.width + gap
  })

  // The rest sit under the gaps between the records above, as high as they
  // go without touching a record or a name.
  const middle = (box) => box.left + box.width / 2
  const below = boxes.slice(3)
  below.forEach((box, index) => {
    const leftOf = top[index] ?? top.at(-1)
    const rightOf = top[index + 1] ?? leftOf
    const centre = (middle(leftOf) + middle(rightOf)) / 2
    box.left = Math.min(Math.max(0, centre - box.width / 2), space - box.width)
    const previous = below[index - 1]
    if (previous && box.left < previous.left + previous.width + GAP) {
      box.left = Math.min(previous.left + previous.width + GAP, space - box.width)
    }
    const placed = [...top, ...below.slice(0, index)]
    box.top = 0
    while (!clear(box, placed)) box.top += 2
    // A small extra drop on every other record keeps this row uneven too.
    box.top += index * 8
  })

  // Kept in rank order, so screen readers and the tab key go 1 to 5.
  return {
    items: boxes,
    height: Math.max(...boxes.map((box) => box.top + box.height)),
    width: Math.max(...boxes.map((box) => box.left + box.width)),
  }
}

// The records' natural size sets the list's least height. Beside a taller
// Top Tracks list, the list stretches, and the records grow to fill it.
const layout = computed(() => {
  const space = width.value
  if (!space || !props.artists.length) return { items: [], height: 0, minHeight: 0 }
  const natural = arrange(space, 1)
  const fits = (next) => next.height <= height.value && next.width <= space
  let best = natural
  let grow = 1
  for (let next = 1.05; next <= MAX_GROW; next += 0.05) {
    const tried = arrange(space, next)
    if (!fits(tried)) break
    best = tried
    grow = next
  }
  // The top three run out of width first, so the records below them keep
  // growing into the height that's left.
  let lower = 1
  for (let next = 1.05; next <= MAX_GROW * 1.5; next += 0.05) {
    const tried = arrange(space, grow, next)
    if (!fits(tried)) break
    best = tried
    lower = next
  }
  // Then the 2nd and 3rd records step down the panel, and the rest follow
  // them, so the records spread over the whole height.
  for (let spread = 8; spread <= height.value; spread += 8) {
    const tried = arrange(space, grow, lower, spread)
    if (!fits(tried)) break
    best = tried
  }
  // Any height still left over goes between the two rows.
  const spare = Math.max(0, height.value - best.height)
  best.items.slice(3).forEach((box) => (box.top += spare * 0.5))
  return { ...best, minHeight: natural.height }
})

let observer
onMounted(() => {
  width.value = root.value.clientWidth
  height.value = root.value.clientHeight
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.floor(entry.contentRect.width)
    height.value = Math.floor(entry.contentRect.height)
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <ol
    ref="root"
    class="artist-list artist-records"
    :class="{ paused }"
    :style="{ minHeight: `${layout.minHeight}px` }"
  >
    <li
      v-for="(item, index) in layout.items"
      :key="item.artist.name"
      class="record-item"
      :style="{
        left: `${item.left}px`,
        top: `${item.top}px`,
        width: `${item.width}px`,
        '--record-size': `${item.size}px`,
      }"
    >
      <a
        class="record-link"
        :href="item.artist.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`${index + 1}. ${item.artist.name}, ${plays(item.artist)} recorded plays, on Spotify (opens new tab)`"
      >
        <span class="record" aria-hidden="true">
          <span class="record-turn">
            <span class="record-disc">
              <span
                v-if="item.artist.art"
                class="record-label has-art"
                :style="{ backgroundImage: `url(${item.artist.art})` }"
              />
              <span
                v-else
                class="record-label"
                :style="{ background: LABEL_COLOURS[index % LABEL_COLOURS.length] }"
                >{{ item.artist.name[0] }}</span
              >
            </span>
          </span>
        </span>
        <span class="record-name" aria-hidden="true">{{ item.artist.name }}</span>
        <span class="record-plays" aria-hidden="true"
          >{{ plays(item.artist) }} {{ plays(item.artist) === 1 ? 'play' : 'plays' }}</span
        >
      </a>
    </li>
  </ol>
</template>

<style scoped>
.artist-records {
  position: relative;
  flex: 1;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.record-item {
  position: absolute;
}
.record-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--dash-ink);
  text-align: center;
  text-decoration: none;
}
.record {
  display: block;
  width: var(--record-size);
  height: var(--record-size);
  border-radius: 50%;
  box-shadow: 0 6px 14px rgb(0 0 0 / 22%);
  transition:
    width 400ms ease,
    height 400ms ease;
}
/* Separate animations keep the spin speed change smooth. */
.record-turn,
.record-disc {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border-radius: 50%;
}
.record-turn {
  animation: record-spin 14s linear infinite;
}
.record-disc {
  position: relative;
  background: repeating-radial-gradient(circle, #1d1719 0 1.5px, #2b2326 1.5px 3px);
  animation: record-spin 1.4s linear infinite paused;
}
/* A soft shine across the grooves. */
.record-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 30deg,
    transparent 0 12%,
    rgb(255 255 255 / 12%) 18%,
    transparent 26% 62%,
    rgb(255 255 255 / 8%) 68%,
    transparent 76%
  );
}
.record-link:is(:hover, :focus-visible) .record-disc {
  animation-play-state: running;
}
.paused :is(.record-turn, .record-disc) {
  animation-play-state: paused !important;
}
.record-label {
  position: relative;
  display: grid;
  width: 55%;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--dash-meter) center / cover;
  font: 700 var(--text-lead) var(--font-sans);
}
/* The spindle hole, on labels showing album art. */
.record-label.has-art::after {
  content: '';
  width: 9%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #1d1719;
}
.record-name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font: 500 var(--text-lead)/1.2 var(--font-serif);
  overflow-wrap: anywhere;
}
.record-link:hover .record-name {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.record-link:focus-visible {
  outline: 2px solid var(--dash-accent);
  outline-offset: 5px;
  border-radius: 12px;
}
.record-plays {
  color: var(--dash-muted);
  font: var(--text-label) var(--font-sans);
  font-variant-numeric: tabular-nums;
}
@keyframes record-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .record,
  .record-turn,
  .record-disc {
    animation: none;
    transition: none;
  }
}
</style>
