<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDemoStatus, spotifyLoginUrl } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import SiteFooter from '@/components/layout/footer.vue'
import SongSearch from '@/components/landing/SongSearch.vue'
import daydreamer from '@/assets/images/personality/types/daydreamer.png'
import poet from '@/assets/images/personality/types/poet.png'
import spark from '@/assets/images/personality/types/spark.png'

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

// The closing banner tilts a little towards the mouse. Touch doesn't hover, so
// only the mouse drives it.
const MAX_TILT = 2

function followPointer(event) {
  if (event.pointerType !== 'mouse') return
  const banner = event.currentTarget
  const rect = banner.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  banner.style.setProperty('--ry', `${(x - 0.5) * 2 * MAX_TILT}deg`)
  banner.style.setProperty('--rx', `${(0.5 - y) * 2 * MAX_TILT}deg`)
}

function resetPointer(event) {
  const banner = event.currentTarget
  banner.style.setProperty('--rx', '0deg')
  banner.style.setProperty('--ry', '0deg')
}
</script>

<template>
  <main class="landing-page">
    <!-- Hero: what MetaFor is, and the way in. -->
    <section id="about" class="hero landing-shell" aria-labelledby="hero-title">
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
      </div>

      <div class="cassette-area">
        <CassetteViewer />
        <p class="drag-hint">Drag the cassette to rotate</p>
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

    <!-- A short closing call to action. -->
    <section
      class="closing landing-shell"
      aria-labelledby="closing-title"
      @pointermove="followPointer"
      @pointerleave="resetPointer"
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
  --ink: var(--ui-text);
  /* Every section is this far from the next, so the page has one rhythm. */
  --section-space: 96px;
  min-height: calc(100vh - 77px);
  overflow: hidden;
  color: var(--ink);
  background: var(--ui-bg);
}

.landing-shell {
  width: var(--page-width);
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

/* Closing banner */
/* Set from followPointer: how far to tilt. */
.closing {
  --rx: 0deg;
  --ry: 0deg;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: var(--section-space);
  padding: 56px 24px;
  overflow: hidden;
  isolation: isolate;
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
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));
  transition: transform 160ms ease-out;
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

@media (max-width: 768px) {
  .landing-page {
    --section-space: 64px;
  }
  .landing-shell {
    width: calc(100% - 36px);
  }
  .hero {
    grid-template-columns: 1fr;
    gap: 16px;
    padding-top: 40px;
  }
  .cassette-area {
    min-height: 270px;
  }
  .feature-grid,
  .more-features {
    grid-template-columns: 1fr;
  }
  .feature-card {
    padding: 24px 20px;
  }
  .card-visual {
    height: 240px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .closing {
    transform: none;
    transition: none;
  }
}
</style>
