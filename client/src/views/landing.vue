<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import SiteFooter from '@/components/footer.vue'

const CassetteViewer = defineAsyncComponent(() => import('@/components/CassetteViewer.vue'))
// The closing banner's liquid stays still for people who reduce motion.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fullTitle = "What's MetaFor?"
const displayedTitle = ref('')

let typingTimer

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
</script>

<template>
  <main class="landing-page">
    <section id="about" class="intro landing-shell" aria-labelledby="intro-title">
      <div class="intro-copy">
        <h1 id="intro-title" aria-label="What's MetaFor?">
          <span aria-hidden="true">{{ displayedTitle }}</span
          ><span class="typing-cursor" aria-hidden="true"></span>
        </h1>
        <p class="intro-description">
          Your music can be a window into how you feel. MetaFor brings your Spotify listening and
          daily reflections together, helping you notice the moods and moments behind your playlists.
        </p>
      </div>

      <div class="cassette-area">
        <CassetteViewer />
        <p class="rotate-hint">Drag the cassette to rotate</p>
      </div>
    </section>

    <section class="music-journal landing-shell" aria-label="Spotify and journal">
      <img class="spotify-image" src="/images/spotify-logo.png" alt="Spotify" />
      <span class="plus-sign" aria-hidden="true">+</span>
      <img
        class="journal-image"
        src="/images/journal.png"
        alt="Journal, ribbon bookmark, and pencil"
      />
    </section>

    <section id="how-it-works" class="mirror-section landing-shell" aria-labelledby="mirror-title">
      <h2 id="mirror-title">Your playlist is a mirror.</h2>
      <div class="feature-grid">
        <article class="feature-card follow" @pointermove="followPointer" @pointerleave="resetPointer">
          <span class="feature-step" aria-hidden="true">01</span>
          <h3 class="glow-text">Listen to yourself</h3>
          <p class="glow-text">
            The songs you return to can hold clues about your mood, memories, and what matters to you.
          </p>
        </article>
        <article class="feature-card follow" @pointermove="followPointer" @pointerleave="resetPointer">
          <span class="feature-step" aria-hidden="true">02</span>
          <h3 class="glow-text">Find the patterns</h3>
          <p class="glow-text">
            Explore your Spotify playlists and see your listening habits from a fresh perspective.
          </p>
        </article>
        <article class="feature-card follow" @pointermove="followPointer" @pointerleave="resetPointer">
          <span class="feature-step" aria-hidden="true">03</span>
          <h3 class="glow-text">Make space to reflect</h3>
          <p class="glow-text">
            Pair music insights with a daily mood log and journal to understand yourself over time.
          </p>
        </article>
      </div>
    </section>

    <section
      class="closing landing-shell follow"
      aria-labelledby="closing-title"
      @pointermove="followPointer"
      @pointerleave="resetPointer"
    >
      <!-- Slow-moving colour blobs that merge like thick liquid (the blur and
           alpha contrast) with rippling edges (the moving noise). -->
      <svg class="liquid-filter" aria-hidden="true" focusable="false">
        <filter id="closing-liquid" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            result="goo"
          />
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="2" seed="3" result="noise">
            <animate
              v-if="!reduceMotion"
              attributeName="baseFrequency"
              dur="18s"
              values="0.006 0.018; 0.009 0.026; 0.006 0.018"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="goo" in2="noise" scale="38" xChannelSelector="R" yChannelSelector="G" result="wave" />
          <feGaussianBlur in="wave" stdDeviation="1.5" />
        </filter>
      </svg>
      <div class="liquid" aria-hidden="true">
        <span class="blob blob-1" />
        <span class="blob blob-2" />
        <span class="blob blob-3" />
        <span class="blob blob-4" />
        <span class="blob blob-5" />
      </div>
      <h2 id="closing-title" class="glow-text">Ready to discover<br />the real you?</h2>
      <p class="closing-text glow-text">Connect Spotify, log how you feel, and see what your music says.</p>
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
  min-height: calc(100vh - 77px);
  overflow: hidden;
  color: var(--ink);
  background: var(--ui-bg);
}

.landing-shell {
  width: min(1110px, calc(100% - 56px));
  margin-inline: auto;
}

.intro {
  display: grid;
  min-height: 365px;
  grid-template-columns: 1fr 0.9fr;
  align-items: center;
  gap: 34px;
  padding-block: 28px 18px;
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
  font-size: 1.08rem;
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

.music-journal {
  display: flex;
  min-height: 245px;
  align-items: center;
  justify-content: center;
  gap: clamp(24px, 5vw, 64px);
  padding-block: 12px 24px;
}
.spotify-image {
  display: block;
  width: clamp(130px, 18vw, 190px);
  height: clamp(130px, 18vw, 190px);
  object-fit: contain;
}
.plus-sign {
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: clamp(2.8rem, 6vw, 4.3rem);
  font-weight: 500;
  line-height: 1;
}
.journal-image {
  display: block;
  width: clamp(190px, 28vw, 300px);
  height: clamp(170px, 22vw, 230px);
  object-fit: contain;
}

.mirror-section {
  padding-block: 8px 30px;
}
.mirror-section h2 {
  width: fit-content;
  margin: 0 auto 20px;
  padding: 7px 0;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: clamp(1.3rem, 2.4vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  text-align: center;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
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
  --glow-ink: #3d2219;
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
  background: radial-gradient(circle var(--glow-size) at var(--mx) var(--my), var(--glow), transparent 70%);
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}
.follow:hover::before {
  opacity: 1;
}
.closing.follow {
  --glow: rgba(255, 236, 220, 0.4);
  --glow-size: 360px;
  --glow-ink: #3d2219;
  --tilt-scale: 0.4;
}
/* Light text under the bright glow would wash out, so the words it covers
   change colour: the text is filled with a gradient centred on the pointer
   (set per text block by followPointer). Near-black where the glow is
   brightest, white where it fades, then the usual colour. The stops are where
   each colour keeps about 4.5:1 contrast against the glow; a gradual blend
   between them would pass through a mid-tone that matches the glow. */
.glow-text {
  --tx: 50%;
  --ty: 50%;
}
/* On the cards the words under the glow just turn white, with no dark
   centre, and fade back to their usual colour where the glow ends. */
.feature-card .glow-text {
  --ink-until: 0%;
  --white-until: 57%;
}
.feature-card h3 {
  --text: var(--ink);
  --text-from: 64%;
}
.feature-card p {
  --text: var(--ui-text-muted);
  --text-from: 64%;
}
/* The liquid behind the banner changes colour as it moves, so the words only
   turn dark in the middle of the glow and are white everywhere else. */
.closing .glow-text {
  --ink-until: 30%;
  --white-until: 100%;
  --text-from: 100%;
}
.closing h2 {
  --text: #fff;
}
.closing-text {
  --text: rgba(255, 255, 255, 0.92);
}
/* The cards only need it in dark mode; the banner's text is white in both. */
:global(.dark .landing-page .feature-card.follow:hover .glow-text),
.closing.follow:hover .glow-text {
  color: transparent;
  background: radial-gradient(
    circle var(--glow-size) at var(--tx) var(--ty),
    var(--glow-ink) var(--ink-until),
    #fff var(--ink-until) var(--white-until),
    var(--text) var(--text-from)
  );
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: none;
}
/* A thin white outline makes the hovered card's words bolder without
   changing the font weight, which would re-wrap the text and make it jump. */
:global(.dark .landing-page .feature-card.follow:hover .glow-text) {
  -webkit-text-stroke: 0.45px rgba(255, 255, 255, 0.6);
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
  font-size: 1.08rem;
  font-weight: 700;
}
.feature-card p {
  max-width: 260px;
  margin: 0;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.55;
}

.closing {
  display: flex;
  min-height: 275px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-bottom: 44px;
  padding: 40px 24px;
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
  font-size: 1.1rem;
  line-height: 1.45;
  text-shadow: 0 1px 2px rgba(60, 30, 24, 0.25);
}

/* The liquid layer sits under the glow and the text. The banner clips it. */
.closing {
  overflow: hidden;
}
.liquid-filter {
  position: absolute;
  width: 0;
  height: 0;
}
.liquid {
  position: absolute;
  z-index: -2;
  inset: -10%;
  filter: url(#closing-liquid);
  opacity: 0.9;
  pointer-events: none;
}
.blob {
  position: absolute;
  aspect-ratio: 1;
  border-radius: 50%;
  animation: blob-drift var(--duration) ease-in-out infinite alternate;
  will-change: transform;
}
/* Mid and deep tones only, so the white text stays readable over them. */
.blob-1 {
  --duration: 14s;
  --dx: 18%;
  --dy: 12%;
  top: 18%;
  left: 4%;
  width: 34%;
  background: #b9543f;
}
.blob-2 {
  --duration: 18s;
  --dx: -14%;
  --dy: -16%;
  top: 44%;
  left: 28%;
  width: 28%;
  background: #8f7ea0;
}
.blob-3 {
  --duration: 16s;
  --dx: -20%;
  --dy: 14%;
  top: 6%;
  left: 52%;
  width: 32%;
  background: #cd6651;
}
.blob-4 {
  --duration: 20s;
  --dx: 12%;
  --dy: -18%;
  top: 48%;
  left: 70%;
  width: 28%;
  background: #763e32;
}
.blob-5 {
  --duration: 22s;
  --dx: 22%;
  --dy: -10%;
  top: 60%;
  left: 12%;
  width: 24%;
  background: #6f5a7a;
}
@keyframes blob-drift {
  0% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(var(--dx), var(--dy)) scale(1.15);
  }
  100% {
    transform: translate(calc(var(--dx) * -0.6), calc(var(--dy) * 0.8)) scale(0.9);
  }
}
.closing h2 {
  margin: 0;
  padding: 8px 0;
  color: #fff;
  font-family: var(--font-sans);
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-style: italic;
  font-weight: 800;
  line-height: 1.08;
  text-shadow: 0 2px 6px rgba(60, 30, 24, 0.25);
}
.get-started {
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

@media (max-width: 700px) {
  .landing-shell {
    width: calc(100% - 36px);
  }
  .intro {
    grid-template-columns: 1fr;
    gap: 0;
    padding-top: 32px;
  }
  .intro-description {
    font-size: 1rem;
  }
  .cassette-area {
    min-height: 270px;
  }
  .music-journal {
    min-height: 185px;
    gap: 18px;
  }
  .spotify-image {
    width: min(27vw, 150px);
    height: min(27vw, 150px);
  }
  .plus-sign {
    font-size: 2.7rem;
  }
  .journal-image {
    width: min(46vw, 235px);
    height: min(38vw, 190px);
  }
  .feature-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .feature-card {
    min-height: 0;
    padding: 24px 20px;
  }
  .closing {
    min-height: 250px;
    gap: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-cursor {
    animation: none;
  }
  .get-started {
    transition: none;
  }
  .blob {
    animation: none;
  }
  /* The light still follows the mouse, but nothing moves. */
  .follow {
    transform: none;
    transition: none;
  }
}
</style>
