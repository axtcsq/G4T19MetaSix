<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import SiteFooter from '@/components/footer.vue'

const CassetteViewer = defineAsyncComponent(() => import('@/components/CassetteViewer.vue'))
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
        <article class="feature-card">
          <h3>Listen to yourself</h3>
          <p>
            The songs you return to can hold clues about your mood, memories, and what matters to you.
          </p>
        </article>
        <article class="feature-card">
          <h3>Find the patterns</h3>
          <p>
            Explore your Spotify playlists and see your listening habits from a fresh perspective.
          </p>
        </article>
        <article class="feature-card">
          <h3>Make space to reflect</h3>
          <p>
            Pair music insights with a daily mood log and journal to understand yourself over time.
          </p>
        </article>
      </div>
    </section>

    <section class="closing landing-shell" aria-labelledby="closing-title">
      <h2 id="closing-title">Ready to discover<br />the real you?</h2>
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
.feature-card {
  display: flex;
  min-height: 285px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 25px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg-elevated);
  text-align: center;
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
  gap: 25px;
  margin-bottom: 44px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 10px;
  background:
    radial-gradient(ellipse at 14% 38%, rgba(88, 66, 222, 0.42) 0%, transparent 34%),
    radial-gradient(ellipse at 76% 24%, rgba(226, 199, 255, 0.48) 0%, transparent 35%),
    radial-gradient(ellipse at 67% 88%, rgba(113, 75, 225, 0.42) 0%, transparent 38%),
    linear-gradient(120deg, #705be7 0%, #8465e9 52%, #a574ec 100%);
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, 0.42),
    inset 0 -4px 9px rgba(62, 39, 142, 0.14),
    0 8px 20px rgba(112, 91, 231, 0.18);
  text-align: center;
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
    min-height: 185px;
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
}
</style>
