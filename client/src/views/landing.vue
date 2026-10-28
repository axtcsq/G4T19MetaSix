<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import SiteFooter from '@/components/layout/footer.vue'
import NoteMargins from '@/components/landing/NoteMargins.vue'
import MusicJournal from '@/components/landing/MusicJournal.vue'
import ShowcasePreview from '@/components/landing/ShowcasePreview.vue'
import TasteQuiz from '@/components/landing/TasteQuiz.vue'
import CassetteTune from '@/components/landing/CassetteTune.vue'
import StoryMode from '@/components/landing/StoryMode.vue'

const CassetteViewer = defineAsyncComponent(
  () => import('@/components/listening/CassetteViewer.vue'),
)
const fullTitle = "What's MetaFor?"
const displayedTitle = ref('')
const bannerVideo = ref(null)

let typingTimer

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // The banner shows the video's first frame instead of playing it.
    bannerVideo.value?.pause()
    displayedTitle.value = fullTitle
    return
  }

  let character = 0
  typingTimer = window.setInterval(() => {
    character += 1
    displayedTitle.value = fullTitle.slice(0, character)

    if (character >= fullTitle.length) {
      window.clearInterval(typingTimer)
    }
  }, 95)
})

onBeforeUnmount(() => window.clearInterval(typingTimer))

// The cards and the closing banner light up where the mouse is and tilt a
// little towards it. Touch doesn't hover, so only the mouse drives it.
const MAX_TILT = 5

function followPointer(event) {
  if (event.pointerType !== 'mouse') return
  const card = event.currentTarget
  const rect = card.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  card.style.setProperty('--mx', `${x * 100}%`)
  card.style.setProperty('--my', `${y * 100}%`)
  card.style.setProperty('--ry', `${(x - 0.5) * 2 * MAX_TILT}deg`)
  card.style.setProperty('--rx', `${(0.5 - y) * 2 * MAX_TILT}deg`)
  // Each text block needs the pointer in its own coordinates, so the words
  // under the glow can change colour.
  for (const text of card.querySelectorAll('.glow-text')) {
    const box = text.getBoundingClientRect()
    text.style.setProperty('--tx', `${event.clientX - box.left}px`)
    text.style.setProperty('--ty', `${event.clientY - box.top}px`)
  }
}

function resetPointer(event) {
  const card = event.currentTarget
  card.style.setProperty('--rx', '0deg')
  card.style.setProperty('--ry', '0deg')
}
// A wave that swells and fades, repeating every 1200 units, for the closing.
const WAVE = Array.from({ length: 241 }, (_, step) => {
  const x = step * 10
  const swell = 0.35 + 0.65 * Math.abs(Math.sin((x / 1200) * Math.PI))
  return `${step ? 'L' : 'M'}${x} ${(60 + Math.sin((x / 150) * Math.PI) * 34 * swell).toFixed(1)}`
}).join(' ')

// The three Mirror cards.
const mirrorCards = [
  {
    title: 'Listen to Yourself',
    text: 'The songs you return to can hold clues about your mood, memories, and what matters to you.',
  },
  {
    title: 'Find the Patterns',
    text: 'Explore your Spotify playlists and see your listening habits from a fresh perspective.',
  },
  {
    title: 'Make Space to Reflect',
    text: 'Pair music insights with a daily mood log and journal to understand yourself over time.',
  },
]

// A short trail of notes follows the mouse across the hero.
const TRAIL_GLYPHS = ['♪', '♫', '♩', '♬']
const trail = ref([])
let trailId = 0
let lastTrail = 0
function leaveTrail(event) {
  if (
    event.pointerType !== 'mouse' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return
  const now = performance.now()
  if (now - lastTrail < 70) return
  lastTrail = now
  const box = event.currentTarget.getBoundingClientRect()
  const id = (trailId += 1)
  trail.value = [
    ...trail.value.slice(-11),
    {
      id,
      x: event.clientX - box.left,
      y: event.clientY - box.top,
      glyph: TRAIL_GLYPHS[id % TRAIL_GLYPHS.length],
      drift: `${(Math.random() - 0.5) * 40}px`,
    },
  ]
  window.setTimeout(() => (trail.value = trail.value.filter((note) => note.id !== id)), 900)
}

// The Get Started button leans towards the mouse when it gets close.
const PULL_RANGE = 140
function pullButton(event) {
  followPointer(event)
  if (event.pointerType !== 'mouse') return
  const button = event.currentTarget.querySelector('.get-started')
  const box = button.getBoundingClientRect()
  const dx = event.clientX - (box.left + box.width / 2)
  const dy = event.clientY - (box.top + box.height / 2)
  const near = Math.hypot(dx, dy) < PULL_RANGE
  button.style.translate = near ? `${dx * 0.25}px ${dy * 0.35}px` : ''
}
function releaseButton(event) {
  resetPointer(event)
  event.currentTarget.querySelector('.get-started').style.translate = ''
}

// Picking a mood in the hero tints the page, recolours the margin notes and
// says what MetaFor would play. Picking it again clears it.
const HERO_MOODS = {
  Happy: { colour: '#f2c335', line: 'Bright and upbeat. MetaFor would keep the good mood going.' },
  Sad: { colour: '#4389d1', line: 'Gentle and slow. Songs to sit with you, then lift you up.' },
  Relaxed: { colour: '#998ba1', line: 'Soft and easy. Acoustic and lo-fi to keep things calm.' },
  Anxious: { colour: '#ed8a35', line: 'Steady and calming. A slow beat to help you breathe.' },
  Angry: { colour: '#d94a45', line: 'Loud first, calmer after. Let it out, then wind down.' },
}
const heroMood = ref(null)
const moodStyle = computed(() =>
  heroMood.value ? { '--mood-colour': HERO_MOODS[heroMood.value].colour } : {},
)

// One row per part of the app, each with a small made-up preview to try.
const showcase = [
  {
    id: 'mood',
    eyebrow: 'Daily Mood',
    title: 'Check in with how you feel',
    text: 'Pick a mood and write a few lines about your day. It only takes a minute.',
    to: '/daily-mood',
    link: 'Log today’s mood',
  },
  {
    id: 'calendar',
    eyebrow: 'Mood Calendar',
    title: 'See your month at a glance',
    text: 'Every check-in lands on your calendar, next to what you were listening to that day.',
    to: '/calendar',
    link: 'Open the calendar',
  },
  {
    id: 'listen',
    eyebrow: 'Listening Room',
    title: 'Play your music while you reflect',
    text: 'Connect Spotify to see your top tracks, spin them on the turntable and keep them playing as you browse.',
    to: '/listen',
    link: 'Step into the room',
  },
  {
    id: 'personality',
    eyebrow: 'Personality',
    title: 'Find out what your taste says about you',
    text: 'Take short, light-hearted quizzes and get a personality built from your answers and your listening.',
    to: '/quiz',
    link: 'Take a quiz',
  },
]
</script>

<template>
  <main class="landing-page" :class="{ 'has-mood': heroMood }" :style="moodStyle">
    <NoteMargins />
    <section
      id="about"
      class="intro landing-shell"
      aria-labelledby="intro-title"
      @pointermove="leaveTrail"
    >
      <span
        v-for="note in trail"
        :key="note.id"
        class="trail-note"
        :style="{ left: `${note.x}px`, top: `${note.y}px`, '--drift': note.drift }"
        aria-hidden="true"
        >{{ note.glyph }}</span
      >
      <div class="intro-copy">
        <h1 id="intro-title" aria-label="What's MetaFor?">
          <span aria-hidden="true">{{ displayedTitle }}</span
          ><span class="typing-cursor" aria-hidden="true"></span>
        </h1>
        <p class="intro-description">
          Your music can be a window into how you feel. MetaFor brings your Spotify listening and
          daily reflections together, helping you notice the moods and moments behind your
          playlists.
        </p>
        <div class="hero-mood" role="group" aria-labelledby="hero-mood-label">
          <p id="hero-mood-label" class="hero-mood-label">How are you feeling right now?</p>
          <div class="hero-mood-options">
            <button
              v-for="(mood, name) in HERO_MOODS"
              :key="name"
              type="button"
              :style="{ '--chip': mood.colour }"
              :aria-pressed="heroMood === name"
              @click="heroMood = heroMood === name ? null : name"
            >
              {{ name }}
            </button>
          </div>
          <p class="hero-mood-line" aria-live="polite">
            {{ heroMood ? HERO_MOODS[heroMood].line : '' }}
          </p>
        </div>
        <StoryMode />
      </div>

      <div class="cassette-area">
        <CassetteViewer />
        <p class="rotate-hint">Drag the cassette to rotate</p>
        <CassetteTune />
      </div>
    </section>

    <MusicJournal />

    <section id="how-it-works" class="mirror-section landing-shell" aria-labelledby="mirror-title">
      <!-- A soft band of colour that slowly pans sideways. The margin lines
           and notes start inside it, so the top of the page stays clear. -->
      <div class="pan-band" aria-hidden="true" />
      <h2 id="mirror-title">Your Playlist Is a Mirror.</h2>
      <div class="feature-grid">
        <article
          v-for="(card, index) in mirrorCards"
          :key="card.title"
          class="feature-card follow"
          @pointermove="followPointer"
          @pointerleave="resetPointer"
        >
          <span class="feature-step" aria-hidden="true">0{{ index + 1 }}</span>
          <h3 class="glow-text">{{ card.title }}</h3>
          <p class="glow-text">{{ card.text }}</p>
        </article>
      </div>
    </section>

    <section class="showcase landing-shell" aria-labelledby="showcase-title">
      <h2 id="showcase-title">Everything in One Place.</h2>
      <article v-for="feature in showcase" :key="feature.id" class="showcase-row">
        <div class="showcase-copy">
          <p class="showcase-eyebrow">{{ feature.eyebrow }}</p>
          <h3>{{ feature.title }}</h3>
          <p class="showcase-text">{{ feature.text }}</p>
          <RouterLink class="showcase-link" :to="feature.to">{{ feature.link }} →</RouterLink>
        </div>

        <ShowcasePreview :kind="feature.id" :name="feature.eyebrow" />
      </article>
    </section>

    <TasteQuiz />

    <StatementLine />

    <section
      class="closing landing-shell follow"
      aria-labelledby="closing-title"
      @pointermove="pullButton"
      @pointerleave="releaseButton"
    >
      <!-- Mesh Gradient from motion.page/backgrounds (free, no attribution
           needed), recoloured to the sunset palette and shrunk for the web. -->
      <video
        ref="bannerVideo"
        class="liquid"
        src="/videos/banner-sunset.mp4"
        poster="/videos/banner-sunset.jpg"
        autoplay
        muted
        loop
        playsinline
        aria-hidden="true"
      />
      <div class="liquid-scrim" aria-hidden="true" />
      <!-- A faint sound wave drifting sideways behind the text. It's two
           repeats wide, so sliding it by half loops without a jump. -->
      <svg
        class="closing-wave"
        viewBox="0 0 2400 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path :d="WAVE" />
      </svg>
      <h2 id="closing-title">
        <span class="closing-lead">Ready to discover</span>
        <span class="closing-accent">The Real You?</span>
      </h2>
      <p class="closing-text">Connect Spotify, log how you feel, and see what your music says.</p>
      <RouterLink class="get-started glass-action" to="/login">Get Started</RouterLink>
    </section>
  </main>

  <SiteFooter />
</template>

<style scoped>
.landing-page {
  --brand: var(--ui-primary);
  --brown: var(--ui-primary);
  --ink: var(--ui-text);
  position: relative;
  isolation: isolate;
  min-height: calc(100vh - 77px);
  overflow: hidden;
  color: var(--ink);
  background: var(--ui-bg);
}

/* The picked mood's colour glows softly across the top of the page, under
   everything else, and the margin notes take it on too. */
.landing-page::before {
  position: absolute;
  z-index: -1;
  inset: 0 0 auto;
  height: 900px;
  background: radial-gradient(
    ellipse 70% 60% at 30% 0%,
    color-mix(in srgb, var(--mood-colour, transparent) 22%, transparent),
    transparent 70%
  );
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 600ms ease;
}
.landing-page.has-mood::before {
  opacity: 1;
}
.landing-page.has-mood {
  --note-colour: color-mix(in srgb, var(--mood-colour) 85%, var(--ui-text));
}
.hero-mood {
  margin-top: 22px;
}
.hero-mood-label {
  margin: 0 0 10px;
  color: var(--ui-text);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
}
.hero-mood-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hero-mood-options button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--chip), transparent 50%);
  border-radius: 999px;
  color: var(--ui-text);
  background: transparent;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}
.hero-mood-options button:hover {
  border-color: var(--chip);
  transform: translateY(-1px);
}
.hero-mood-options button[aria-pressed='true'] {
  border-color: var(--chip);
  color: #30261d;
  background: var(--chip);
}
.hero-mood-options button:focus-visible {
  outline: 3px solid var(--color-brand-400);
  outline-offset: 2px;
}
.hero-mood-line {
  min-height: 1.5em;
  margin: 10px 0 0;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: 1.05rem;
}

.landing-shell {
  width: var(--page-width);
  margin-inline: auto;
}

.intro {
  position: relative;
  display: grid;
  min-height: 365px;
  grid-template-columns: 1fr 0.9fr;
  align-items: center;
  gap: 34px;
  padding-block: 72px 18px;
}

.intro-copy {
  max-width: 590px;
}
.intro h1 {
  min-height: 1.15em;
  margin: 0 0 12px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: clamp(2.4rem, 5vw, 3.6rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.05;
}
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 0.85em;
  margin-left: 3px;
  background: var(--brand);
  vertical-align: -0.06em;
  animation: cursor-blink 0.8s steps(2, start) infinite;
}
.intro-description {
  max-width: 550px;
  margin: 0;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  line-height: 1.58;
}
.cassette-area {
  display: flex;
  min-height: 290px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.rotate-hint {
  margin: -4px 0 0;
  color: var(--brown);
  font-family: var(--font-sans);
  font-size: 0.74rem;
}

.mirror-section {
  position: relative;
  padding-block: 24px 80px;
}
/* Full width, behind the page, fading out at its top and bottom. */
.pan-band {
  position: absolute;
  z-index: -1;
  top: -140px;
  left: 50%;
  width: 100vw;
  height: 420px;
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--note-colour, var(--ui-primary)) 16%, transparent),
    color-mix(in srgb, #998ba1 18%, transparent),
    color-mix(in srgb, #4389d1 12%, transparent),
    color-mix(in srgb, var(--note-colour, var(--ui-primary)) 16%, transparent)
  );
  background-size: 300% 100%;
  mask-image: linear-gradient(to bottom, transparent, #000 40%, #000 60%, transparent);
  translate: -50% 0;
  animation: pan 24s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes pan {
  from {
    background-position: 0% 50%;
  }
  to {
    background-position: 100% 50%;
  }
}
.mirror-section h2 {
  width: fit-content;
  margin: 0 auto 40px;
  padding: 7px 0;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-title);
  font-weight: 800;
  letter-spacing: -0.035em;
  text-align: center;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
}
/* Warm cream cards in the same palette as the intro above. */
.feature-card {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 25px;
  border: 1px solid var(--ui-border);
  border-radius: 16px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 6px 18px rgba(125, 71, 55, 0.08);
  text-align: center;
}
.feature-card:hover {
  --lift: -3px;
  box-shadow: 0 10px 24px rgba(125, 71, 55, 0.14);
}

/* Set from followPointer: where the mouse is, and how far to tilt. */
.follow {
  --mx: 50%;
  --my: 50%;
  --rx: 0deg;
  --ry: 0deg;
  --lift: 0px;
  --glow: rgba(255, 211, 172, 0.6);
  --glow-size: 220px;
  position: relative;
  isolation: isolate;
  transform: perspective(900px) translateY(var(--lift))
    rotateX(calc(var(--rx) * var(--tilt-scale, 1))) rotateY(calc(var(--ry) * var(--tilt-scale, 1)));
  transition:
    transform 160ms ease-out,
    box-shadow 180ms ease;
}
.follow::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    circle var(--glow-size) at var(--mx) var(--my),
    var(--glow),
    transparent 70%
  );
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}
.follow:hover::before {
  opacity: 1;
}
/* Peach looks grey on the dark cards, so dark mode uses a warmer orange to
   match how the glow looks in light mode. */
:global(.dark .landing-page .feature-card.follow) {
  --glow: rgba(255, 135, 60, 0.42);
}
/* With a mood picked in the hero, the cards' glow, the light on their words
   and their hover edge all take the mood's colour. */
.landing-page.has-mood .feature-card.follow {
  --glow: color-mix(in srgb, var(--mood-colour) 45%, transparent);
}
.landing-page.has-mood .feature-card .glow-text {
  --lit: color-mix(in srgb, var(--mood-colour) 50%, #2a140e);
}
.landing-page.has-mood .feature-card:hover {
  border-color: color-mix(in srgb, var(--mood-colour) 50%, var(--ui-border));
  box-shadow: 0 10px 28px color-mix(in srgb, var(--mood-colour) 28%, transparent);
}
:global(.dark .landing-page.has-mood .feature-card.follow) {
  --glow: color-mix(in srgb, var(--mood-colour) 60%, transparent);
}
:global(.dark .landing-page.has-mood .feature-card .glow-text) {
  --lit: color-mix(in srgb, var(--mood-colour) 65%, #fff);
}
.closing.follow {
  --glow-size: 360px;
  --tilt-scale: 0.4;
}
/* The banner's moving background is enough, so it has no glow. */
.closing.follow::before {
  display: none;
}
/* The words under the glow change colour: the text is filled with a gradient
   centred on the pointer (set per text block by followPointer), --lit where
   the glow is and the usual colour beyond it. Light mode darkens them, dark
   mode turns them white. */
.glow-text {
  --tx: 50%;
  --ty: 50%;
}
.feature-card .glow-text {
  --lit: #3d1f17;
  --lit-until: 57%;
}
.feature-card h3 {
  --text: var(--ink);
  --text-from: 64%;
}
.feature-card p {
  --text: var(--ui-text-muted);
  --text-from: 64%;
}
:global(.dark .landing-page .feature-card .glow-text) {
  --lit: #fff;
}
.feature-card.follow:hover .glow-text {
  color: transparent;
  background: radial-gradient(
    circle var(--glow-size) at var(--tx) var(--ty),
    var(--lit) 0 var(--lit-until),
    var(--text) var(--text-from)
  );
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: none;
}
/* A thin outline in the lit colour makes the hovered headings bolder without
   changing the font weight, which would re-wrap the text and make it jump.
   The body text only changes colour. */
.feature-card.follow:hover h3.glow-text {
  -webkit-text-stroke: 0.45px color-mix(in srgb, var(--lit) 60%, transparent);
}
.feature-step {
  display: inline-flex;
  width: 56px;
  height: 56px;
  margin-bottom: 16px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--brown);
  /* A soft tint of the theme colour, so it works in light and dark mode. */
  background: color-mix(in srgb, var(--ui-primary) 18%, transparent);
  font-family: var(--font-sans);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.feature-card h3 {
  margin: 0 0 10px;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}
.feature-card p {
  max-width: 260px;
  margin: 0;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  line-height: 1.55;
}

/* Each row is the words on one side and the preview on the other, swapping
   sides every row. */
.showcase {
  padding-block: 0 80px;
}
.showcase h2 {
  margin: 0 0 48px;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-title);
  font-weight: 800;
  letter-spacing: -0.035em;
  text-align: center;
}
.showcase-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: clamp(32px, 6vw, 80px);
}
.showcase-row + .showcase-row {
  margin-top: 64px;
}
.showcase-row:nth-child(odd of .showcase-row) .preview {
  order: -1;
}
.showcase-copy {
  max-width: 460px;
}
.showcase-eyebrow {
  margin: 0 0 8px;
  color: var(--brand);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.showcase-copy h3 {
  margin: 0 0 12px;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}
.showcase-text {
  margin: 0 0 18px;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  line-height: 1.55;
}
.showcase-link {
  color: var(--brand);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 4px;
  transition: text-decoration-color 160ms ease;
}
.showcase-link:hover,
.showcase-link:focus-visible {
  text-decoration-color: currentColor;
}

.closing {
  display: flex;
  min-height: 460px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin-bottom: var(--page-bottom);
  padding: 88px 24px;
  border: 1px solid #763e32;
  border-radius: 18px;
  /* The same warm mauve-to-terracotta blend as the Patterns card. */
  background:
    linear-gradient(117.92deg, rgba(102, 95, 120, 0.2) 2.94%, rgba(118, 62, 50, 0.2) 100%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%),
    linear-gradient(109.07deg, rgba(118, 62, 50, 0.3) 42.18%, rgba(255, 205, 166, 0.3) 91.17%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%), #fff;
  box-shadow:
    inset 0 9px 6.2px rgba(0, 0, 0, 0.12),
    0 10px 24px rgba(118, 62, 50, 0.16);
  text-align: center;
}
.closing-text {
  max-width: 34ch;
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  line-height: 1.45;
  text-shadow: 0 1px 2px rgba(60, 30, 24, 0.25);
}

/* The video sits under the text, and the banner clips it. Until it loads the
   banner's own gradient shows instead. */
.closing {
  overflow: hidden;
}
.liquid {
  position: absolute;
  z-index: -2;
  width: 100%;
  height: 100%;
  inset: 0;
  object-fit: cover;
  pointer-events: none;
}
/* Darkens the middle so the white text stays readable over the pale bands. */
.liquid-scrim {
  position: absolute;
  z-index: -2;
  inset: 0;
  background: radial-gradient(ellipse 55% 60% at 50% 50%, rgba(40, 24, 42, 0.5), transparent 100%);
  pointer-events: none;
}
.closing-wave {
  position: absolute;
  z-index: -1;
  bottom: 18%;
  left: 0;
  width: 200%;
  height: 120px;
  fill: none;
  stroke: rgba(255, 255, 255, 0.35);
  stroke-width: 2.5;
  vector-effect: non-scaling-stroke;
  animation: wave-slide 26s linear infinite;
  pointer-events: none;
}
@keyframes wave-slide {
  to {
    translate: -50% 0;
  }
}
.closing h2 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin: 0;
  color: #fff;
  line-height: 1;
}
/* A small, spaced-out lead-in, then the question in large type. */
.closing-lead {
  font-family: var(--font-sans);
  font-size: clamp(0.85rem, 1.6vw, 1rem);
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  opacity: 0.88;
  text-shadow: 0 1px 4px rgba(40, 20, 30, 0.35);
}
/* The site's heading font, white fading into peach. drop-shadow (unlike
   text-shadow) works with transparent text. */
.closing-accent {
  padding-bottom: 0.08em;
  background: linear-gradient(100deg, #fff 20%, #ffe1c9 55%, #ffc9a3 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-family: var(--font-sans);
  font-size: clamp(2.4rem, 7vw, 4.2rem);
  font-weight: 800;
  filter: drop-shadow(0 2px 10px rgba(60, 24, 30, 0.35));
}
/* Notes that float up and fade where the mouse has been. */
.trail-note {
  position: absolute;
  z-index: 3;
  color: var(--note-colour, var(--ui-primary));
  font-size: 1.1rem;
  pointer-events: none;
  animation: trail 900ms ease-out forwards;
}
@keyframes trail {
  from {
    opacity: 0.85;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 0;
    transform: translate(calc(-50% + var(--drift)), -150%) scale(1.15) rotate(12deg);
  }
}
/* Its position is set from pullButton; it eases back when the mouse leaves. */
.get-started {
  transition:
    translate 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 160ms ease;
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
}

@keyframes cursor-blink {
  to {
    visibility: hidden;
  }
}

@media (max-width: 768px) {
  .intro {
    grid-template-columns: 1fr;
    gap: 0;
    padding-top: 48px;
  }
  .cassette-area {
    min-height: 270px;
  }
  .feature-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .feature-card {
    min-height: 0;
    padding: 24px 20px;
  }
  .showcase-row {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .showcase-row + .showcase-row {
    margin-top: 48px;
  }
  .showcase-row:nth-child(odd of .showcase-row) .preview {
    order: 0;
  }
  .closing {
    min-height: 320px;
    gap: 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .closing-wave {
    animation: none;
  }
  .pan-band {
    animation: none;
  }
  .typing-cursor {
    animation: none;
  }
  .get-started,
  .hero-mood-options button,
  .landing-page::before {
    transition: none;
  }
  /* The light still follows the mouse, but nothing moves. */
  .follow {
    transform: none;
    transition: none;
  }
}
</style>
