<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDemoStatus, spotifyLoginUrl } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import SiteFooter from '@/components/layout/footer.vue'
import MoodFace from '@/components/journal/MoodFace.vue'
import NoteMargins from '@/components/landing/NoteMargins.vue'
import MusicJournal from '@/components/landing/MusicJournal.vue'
import ShowcasePreview from '@/components/landing/ShowcasePreview.vue'
import TasteQuiz from '@/components/landing/TasteQuiz.vue'
import StoryMode from '@/components/landing/StoryMode.vue'
import StatementLine from '@/components/landing/StatementLine.vue'
import SongSearch from '@/components/landing/SongSearch.vue'
import daydreamer from '@/assets/images/personality/types/daydreamer.png'
import poet from '@/assets/images/personality/types/poet.png'
import spark from '@/assets/images/personality/types/spark.png'

defineOptions({ name: 'LandingPage' })

const CassetteViewer = defineAsyncComponent(
  () => import('@/components/listening/CassetteViewer.vue'),
)
const VinylTurntable = defineAsyncComponent(
  () => import('@/components/listening/VinylTurntable.vue'),
)
// The record player in the Listen card spins when its play button is clicked.
// It plays no music here; that needs Spotify in the Listening Room.
const recordSpinning = ref(false)

// The smaller features, in one strip under the cards.
const personalityImages = [daydreamer, poet, spark]
const calendarMoods = ['😊', '😌', '😟', '😰', '😠']
// Bar heights for the little Listening Portrait chart, in percent.
const portraitBars = [40, 75, 55, 90, 65]

const bannerVideo = ref(null)

// The hero and the closing banner log people in straight from here, the same
// way as the login page.
const router = useRouter()
const auth = useAuthStore()
const isRedirecting = ref(false)
// The test account is offered only when the server has DEMO_LOGIN=true.
const demoEnabled = ref(false)
const isDemoLoading = ref(false)
const loginError = ref('')

function continueWithSpotify() {
  isRedirecting.value = true
  window.location.assign(spotifyLoginUrl('/dashboard'))
}

async function useTestAccount() {
  isDemoLoading.value = true
  loginError.value = ''
  try {
    await auth.demoLogin()
    router.push('/dashboard')
  } catch (error) {
    loginError.value = error.message
  } finally {
    isDemoLoading.value = false
  }
}

onMounted(async () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // The banner shows the video's first frame instead of playing it.
    bannerVideo.value?.pause()
  }

  try {
    demoEnabled.value = (await getDemoStatus()).enabled
  } catch {
    demoEnabled.value = false
  }
})

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

// The closing banner's button leans towards the mouse when it gets close.
const PULL_RANGE = 140
function pullButton(event) {
  followPointer(event)
  if (event.pointerType !== 'mouse') return
  const button = event.currentTarget.querySelector('.get-started, .spotify-login')
  const box = button.getBoundingClientRect()
  const dx = event.clientX - (box.left + box.width / 2)
  const dy = event.clientY - (box.top + box.height / 2)
  const near = Math.hypot(dx, dy) < PULL_RANGE
  button.style.translate = near ? `${dx * 0.25}px ${dy * 0.35}px` : ''
}
function releaseButton(event) {
  resetPointer(event)
  event.currentTarget.querySelector('.get-started, .spotify-login').style.translate = ''
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
    <!-- Hero: what MetaFor is, and the way in. -->
    <section
      id="about"
      class="hero landing-shell"
      aria-labelledby="hero-title"
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
      <div class="hero-copy">
        <p class="eyebrow-label">Music journalling</p>
        <h1 id="hero-title" class="hero-title">
          Your music, <span class="accent">your mood,</span> your journal.
        </h1>
        <p class="hero-text">
          Your music can be a window into how you feel. MetaFor brings your Spotify listening and
          daily reflections together, helping you notice the moods and moments behind your
          playlists.
        </p>

        <!-- Already logged in: nothing to log in to, so go straight in. -->
        <div class="hero-actions">
          <RouterLink v-if="auth.user" class="get-started glass-action" to="/dashboard">
            Go to your dashboard
          </RouterLink>
          <template v-else>
            <UButton
              class="spotify-login justify-center rounded-full font-sans"
              size="lg"
              :loading="isRedirecting"
              @click="continueWithSpotify"
            >
              <!-- The Spotify icon, drawn in the button's text colour. -->
              <svg class="spotify-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                />
              </svg>
              Continue with Spotify
            </UButton>
            <UButton
              v-if="demoEnabled"
              class="test-account justify-center rounded-full font-sans"
              color="neutral"
              variant="outline"
              size="lg"
              :loading="isDemoLoading"
              @click="useTestAccount"
            >
              Use the test account
            </UButton>
          </template>
        </div>
        <p v-if="loginError" class="login-error" role="alert">{{ loginError }}</p>
        <p v-if="!auth.user" class="privacy-note">
          We only read your recently played songs. We never post or change your playlists.
        </p>
        <div class="hero-mood" role="group" aria-labelledby="hero-mood-label">
          <p id="hero-mood-label" class="hero-mood-label">How are you feeling right now?</p>
          <div class="hero-mood-options">
            <button
              v-for="(mood, name) in HERO_MOODS"
              :key="name"
              type="button"
              class="glass-secondary mood-reaction"
              :class="`mood-reaction--${name.toLowerCase()}`"
              :style="{ '--chip': mood.colour }"
              :aria-pressed="heroMood === name"
              @click="heroMood = heroMood === name ? null : name"
            >
              <MoodFace :mood="name" class="button-mood-face" />
              {{ name }}
            </button>
          </div>
          <p class="hero-mood-line" aria-live="polite">
            {{ heroMood ? HERO_MOODS[heroMood].line : '' }}
          </p>
        </div>
      </div>

      <div class="cassette-area">
        <CassetteViewer />
        <p class="drag-hint">Drag the cassette to rotate</p>
      </div>
    </section>

    <div class="story-launch landing-shell">
      <StoryMode />
    </div>

    <MusicJournal />

    <section id="how-it-works" class="mirror-section landing-shell" aria-labelledby="mirror-title">
      <!-- A soft band of colour that slowly pans sideways. The margin lines
           and notes start inside it, so the top of the page stays clear. -->
      <div class="pan-band" aria-hidden="true" />
      <h2 id="mirror-title">Your Playlist Is a Mirror.</h2>
      <div class="mirror-grid">
        <article
          v-for="(card, index) in mirrorCards"
          :key="card.title"
          class="mirror-card follow"
          @pointermove="followPointer"
          @pointerleave="resetPointer"
        >
          <span class="feature-step" aria-hidden="true">0{{ index + 1 }}</span>
          <h3 class="glow-text">{{ card.title }}</h3>
          <p class="glow-text">{{ card.text }}</p>
        </article>
      </div>
    </section>

    <!-- The three main features, then the smaller ones. -->
    <section class="features landing-shell" aria-labelledby="features-title">
      <header class="section-header">
        <p class="eyebrow-label">Features</p>
        <h2 id="features-title" class="section-title">Start journalling now!</h2>
        <p class="section-text">Write, listen and reflect, all in one place.</p>
      </header>

      <div class="feature-grid">
        <article class="feature-card" aria-labelledby="mood-card-title">
          <p class="card-label">Journal</p>
          <h3 id="mood-card-title" class="card-title">Log your daily mood</h3>
          <p class="card-text">
            Pick a mood, then draw it, write it, or both. Every entry is saved to your mood
            calendar.
          </p>
          <div class="card-visual">
            <img
              class="mood-preview"
              src="@/assets/images/daily-mood-preview.png"
              alt="The Daily Mood Log, with mood buttons, a journal page, past entries and the Helper"
            />
          </div>
        </article>

        <article class="feature-card" aria-labelledby="listen-card-title">
          <p class="card-label">Listen</p>
          <h3 id="listen-card-title" class="card-title">Listen while you write</h3>
          <p class="card-text">
            Play songs in the background while you journal, on a record player in the Listening
            Room.
          </p>
          <div class="card-visual">
            <VinylTurntable
              :spinning="recordSpinning"
              :zoom="0.75"
              @toggle="recordSpinning = !recordSpinning"
            />
            <p class="drag-hint visual-hint">Drag to rotate · Click play to spin the record</p>
          </div>
        </article>

        <article class="feature-card song-card" aria-labelledby="song-card-title">
          <p class="card-label">Analyse</p>
          <h3 id="song-card-title" class="card-title">Search a song, see how it feels</h3>
          <p class="card-text">
            MetaFor reads a song's sound and lyrics and turns them into a mood. Try it here.
          </p>
          <SongSearch />
        </article>
      </div>

      <h3 class="more-title">And there's more inside</h3>
      <ul class="more-features">
        <li>
          <RouterLink class="more-item" to="/quiz">
            <span class="more-visual personality-faces" aria-hidden="true">
              <img v-for="image in personalityImages" :key="image" :src="image" alt="" />
            </span>
            <strong>Personality quizzes</strong>
            <span>Six quizzes that match you to one of six music personalities.</span>
          </RouterLink>
        </li>
        <li>
          <RouterLink class="more-item" to="/calendar">
            <span class="more-visual calendar-moods" aria-hidden="true">
              <span v-for="mood in calendarMoods" :key="mood">{{ mood }}</span>
            </span>
            <strong>Mood Calendar</strong>
            <span>Every mood you log, day by day, next to what you listened to.</span>
          </RouterLink>
        </li>
        <li>
          <RouterLink class="more-item" to="/dashboard">
            <span class="more-visual portrait-bars" aria-hidden="true">
              <span
                v-for="(bar, index) in portraitBars"
                :key="index"
                :style="{ height: `${bar}%` }"
              />
            </span>
            <strong>Listening Portrait</strong>
            <span>Your listening history, turned into artwork and charts.</span>
          </RouterLink>
        </li>
      </ul>
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

    <!-- A short closing call to action. -->
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
      <RouterLink v-if="auth.user" class="get-started glass-action" to="/dashboard">
        Go to your dashboard
      </RouterLink>
      <UButton
        v-else
        class="spotify-login justify-center rounded-full font-sans"
        size="lg"
        :loading="isRedirecting"
        @click="continueWithSpotify"
      >
        <svg class="spotify-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
          />
        </svg>
        Continue with Spotify
      </UButton>
    </section>
  </main>

  <SiteFooter />
</template>

<style scoped>
.landing-page {
  --brand: var(--ui-primary);
  --brown: var(--ui-primary);
  --ink: var(--ui-text);
  /* Every section is this far from the next, so the page has one rhythm. */
  --section-space: 96px;
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
  gap: 6px;
}
/* Compact chips, so all five fit on one row; the shared glossy button style
   is roomier, hence the !important. */
.hero-mood-options .mood-reaction.glass-secondary {
  gap: 5px;
  min-height: 36px !important;
  padding: 0.3rem 0.8rem 0.3rem 0.4rem !important;
  font-size: 0.8rem !important;
}
.story-launch {
  display: flex;
  justify-content: center;
  padding-block: 8px 36px;
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
.hero-mood-options .button-mood-face {
  width: 24px;
  height: 24px;
  flex: none;
  transform-origin: center;
}
.hero-mood-options button:is(:hover, :focus-visible, [aria-pressed='true']) {
  --button-top: color-mix(in srgb, var(--chip), white 48%);
  --button-base: var(--chip);
  --button-ink: #30261d;
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
  width: var(--landing-width);
  margin-inline: auto;
}

/* One heading style for the whole page: Raleway, bold, tight spacing. */
.hero-title,
.section-title,
.card-title,
.more-title {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-sans);
  font-weight: 800;
  letter-spacing: -0.03em;
}
/* The small uppercase label above a heading. */
.eyebrow-label,
.card-label {
  margin: 0 0 12px;
  color: var(--brand);
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* Hero */
.hero {
  position: relative;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: 48px;
  padding-block: 72px var(--section-space);
}
.hero-title {
  font-size: clamp(2.6rem, 5.5vw, 4rem);
  line-height: 1.05;
}
.hero-title .accent {
  color: var(--brand);
}
.hero-text {
  max-width: 540px;
  margin: 20px 0 32px;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  line-height: 1.55;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.privacy-note,
.login-error {
  margin: 16px 0 0;
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: 0.85rem;
}
.login-error {
  color: var(--color-error-500, #d14343);
}
.cassette-area {
  display: flex;
  min-height: 340px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.drag-hint {
  margin: 0;
  color: var(--ui-text-muted);
  font-family: var(--font-sans);
  font-size: 0.78rem;
  text-align: center;
}

/* Buttons */
/* Spotify's own green and black, like the "Continue with Spotify" buttons in
   other apps. */
.spotify-login {
  transition: translate 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
  min-height: 48px;
  gap: 10px;
  padding: 0 24px;
  color: #000;
  background: #1ed760;
  font-weight: 700;
}
.spotify-login:hover {
  background: #3be477;
}
.spotify-icon {
  width: 22px;
  height: 22px;
}
.test-account {
  min-height: 48px;
  padding: 0 22px;
}
.get-started {
  transition:
    translate 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 160ms ease;
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
}

/* Features */
.features {
  padding-bottom: var(--section-space);
}
.section-header {
  max-width: 620px;
  margin: 0 auto 48px;
  text-align: center;
}
.section-title {
  font-size: var(--text-header);
  line-height: 1.15;
}
.section-text {
  margin: 12px 0 0;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: var(--text-body);
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
/* Every card has the same frame. */
.feature-card {
  display: flex;
  flex-direction: column;
  padding: 32px;
  border: 1px solid var(--ui-border);
  border-radius: 20px;
  background: var(--ui-bg-elevated);
}
/* The song search gets the whole row under the first two cards. */
.song-card {
  grid-column: 1 / -1;
}
.card-title {
  font-size: 1.5rem;
  line-height: 1.2;
}
.card-text {
  margin: 10px 0 24px;
  color: var(--ui-text-muted);
  font-family: var(--font-serif);
  font-size: 1.15rem;
  line-height: 1.5;
}
/* The picture area of the first two cards: same height, same soft background,
   so the two cards line up. */
.card-visual {
  position: relative;
  height: 300px;
  margin-top: auto;
  overflow: hidden;
  border-radius: 14px;
  background: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg));
}
.mood-preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top left;
}
.visual-hint {
  position: absolute;
  right: 0;
  bottom: 12px;
  left: 0;
  pointer-events: none;
}

/* The smaller features */
.more-title {
  margin: 64px 0 24px;
  font-size: var(--text-subheader);
  text-align: center;
}
.more-features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.more-item {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 24px;
  border: 1px solid var(--ui-border);
  border-radius: 20px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  text-align: center;
  transition: border-color 180ms ease;
}
.more-item:hover {
  border-color: var(--ui-primary);
}
.more-item strong {
  color: var(--ink);
  font-size: 1.05rem;
}
/* Each item's small picture sits in the same 56px-tall space. */
.more-visual {
  display: flex;
  height: 56px;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}
/* The illustrations are dark line art, so they keep a light circle behind them
   in dark mode too. */
.personality-faces img {
  width: 52px;
  height: 52px;
  border: 2px solid var(--ui-bg-elevated);
  border-radius: 50%;
  background: #fdf3ea;
  object-fit: cover;
}
/* Overlap the faces a little. */
.personality-faces img + img {
  margin-left: -14px;
}
.calendar-moods {
  gap: 4px;
  font-size: 1.5rem;
}
.portrait-bars {
  align-items: flex-end;
  gap: 6px;
}
.portrait-bars span {
  width: 10px;
  border-radius: 4px 4px 0 0;
  background: var(--brand);
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
.mirror-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
}
/* Warm cream cards in the same palette as the hero above. */
.mirror-card {
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
.mirror-card:hover {
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
:global(.dark .landing-page .mirror-card.follow) {
  --glow: rgba(255, 135, 60, 0.42);
}
/* With a mood picked in the hero, the cards' glow, the light on their words
   and their hover edge all take the mood's colour. */
.landing-page.has-mood .mirror-card.follow {
  --glow: color-mix(in srgb, var(--mood-colour) 45%, transparent);
}
.landing-page.has-mood .mirror-card .glow-text {
  --lit: color-mix(in srgb, var(--mood-colour) 50%, #2a140e);
}
.landing-page.has-mood .mirror-card:hover {
  border-color: color-mix(in srgb, var(--mood-colour) 50%, var(--ui-border));
  box-shadow: 0 10px 28px color-mix(in srgb, var(--mood-colour) 28%, transparent);
}
:global(.dark .landing-page.has-mood .mirror-card.follow) {
  --glow: color-mix(in srgb, var(--mood-colour) 60%, transparent);
}
:global(.dark .landing-page.has-mood .mirror-card .glow-text) {
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
.mirror-card .glow-text {
  --lit: #3d1f17;
  --lit-until: 57%;
}
.mirror-card h3 {
  --text: var(--ink);
  --text-from: 64%;
}
.mirror-card p {
  --text: var(--ui-text-muted);
  --text-from: 64%;
}
:global(.dark .landing-page .mirror-card .glow-text) {
  --lit: #fff;
}
.mirror-card.follow:hover .glow-text {
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
.mirror-card.follow:hover h3.glow-text {
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
.mirror-card h3 {
  margin: 0 0 10px;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-subheader);
  font-weight: 600;
}
.mirror-card p {
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

/* Closing banner */
.closing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: var(--section-space);
  padding: 56px 24px;
  overflow: hidden;
  border: 1px solid #763e32;
  border-radius: 20px;
  /* The same warm mauve-to-terracotta blend as the Patterns card. Shows until
     the video loads. */
  background:
    linear-gradient(117.92deg, rgba(102, 95, 120, 0.2) 2.94%, rgba(118, 62, 50, 0.2) 100%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%),
    linear-gradient(109.07deg, rgba(118, 62, 50, 0.3) 42.18%, rgba(255, 205, 166, 0.3) 91.17%),
    linear-gradient(225.44deg, rgba(102, 95, 120, 0.4) 18.89%, rgba(206, 91, 75, 0.4) 81.12%), #fff;
  box-shadow: 0 10px 24px rgba(118, 62, 50, 0.16);
  text-align: center;
}
/* The video sits under the text, and the banner clips it. */
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
.closing h2 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
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
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
  filter: drop-shadow(0 2px 10px rgba(60, 24, 30, 0.35));
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
@media (max-width: 768px) {
  .landing-page {
    --section-space: 64px;
  }
  .hero {
    grid-template-columns: 1fr;
    gap: 16px;
    padding-top: 40px;
  }
  .cassette-area {
    min-height: 270px;
  }
  .mirror-grid,
  .feature-grid,
  .more-features {
    grid-template-columns: 1fr;
  }
  .mirror-grid {
    gap: 14px;
  }
  .mirror-card {
    min-height: 0;
    padding: 24px 20px;
  }
  .feature-card {
    padding: 24px 20px;
  }
  .card-visual {
    height: 240px;
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
}

@media (prefers-reduced-motion: reduce) {
  .closing-wave,
  .pan-band {
    animation: none;
  }
  .get-started,
  .spotify-login,
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
